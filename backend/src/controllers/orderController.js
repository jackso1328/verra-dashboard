const Order = require('../models/Order');
const Product = require('../models/Product');
const InventoryMovement = require('../models/InventoryMovement');
const mongoose = require('mongoose');

// Generate unique order number (e.g. VR-2026-84920)
const generateOrderNumber = () => {
  const randomDigits = Math.floor(10000 + Math.random() * 90000);
  return `VR-2026-${randomDigits}`;
};

/**
 * Pure helper to aggregate duplicate product entries in cart items.
 * Validates ObjectId format and quantity.
 */
const aggregateCartItems = (rawItems) => {
  if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error('Your cart is empty. Please add botanical oils before checkout.');
  }

  const map = new Map();

  for (const item of rawItems) {
    const rawId = item.productId || item.id || item.product;
    if (!rawId) {
      throw new Error('Cart item is missing a valid product identifier.');
    }
    const pId = String(rawId).trim();

    if (!mongoose.Types.ObjectId.isValid(pId)) {
      throw new Error(`Invalid product ID "${pId}". Live catalog synchronization required; preview items cannot be checked out.`);
    }

    const qty = parseInt(item.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      throw new Error('Invalid quantity specified in cart item.');
    }

    if (map.has(pId)) {
      map.set(pId, map.get(pId) + qty);
    } else {
      map.set(pId, qty);
    }
  }

  return Array.from(map.entries()).map(([productId, quantity]) => ({ productId, quantity }));
};

/**
 * Pure helper to compute authoritative order totals.
 * Tax (5% GST) is included in product retail price (Indian MRP standard).
 * Net sales = grossSales - discountAmount.
 * Free luxury shipping on net sales >= ₹1,500, else ₹99.
 * Total amount to pay = net sales + shippingFee.
 */
const calculateCheckoutFinancials = (validatedItems, couponCode = null) => {
  let grossSales = 0;
  let totalCOGS = 0;

  validatedItems.forEach(item => {
    grossSales += item.subtotal;
    totalCOGS += item.unitCost * item.quantity;
  });

  let discountAmount = 0;
  const upperCode = couponCode ? String(couponCode).toUpperCase().trim() : '';
  if (upperCode === 'VERRA10') {
    discountAmount = Math.round(grossSales * 0.10);
  } else if (upperCode === 'RITUAL15') {
    discountAmount = Math.round(grossSales * 0.15);
  }

  const netProductSales = Math.max(0, grossSales - discountAmount);
  const shippingFee = netProductSales >= 1500 || netProductSales === 0 ? 0 : 99;
  // 5% GST included in retail price
  const taxAmount = Math.round(netProductSales * 0.05);
  const totalAmount = netProductSales + shippingFee;

  return {
    grossSales,
    discountAmount,
    netProductSales,
    shippingFee,
    taxAmount,
    totalAmount,
    totalCOGS
  };
};

// @desc    Create a new order (Validated server-side against DB prices and stock)
// @route   POST /api/orders
// @access  Public / Customer (optionalAuth)
const createOrder = async (req, res, next) => {
  const decrementedItems = []; // Track for rollback in case of subsequent failures
  try {
    const { items, customerInfo, couponCode } = req.body;

    if (!customerInfo || !customerInfo.name || !customerInfo.email || !customerInfo.street || !customerInfo.city || !customerInfo.state || !customerInfo.postalCode) {
      return res.status(400).json({
        success: false,
        message: 'Please provide complete delivery and contact information.'
      });
    }

    // 1. Aggregate duplicate product lines and validate IDs
    let aggregated;
    try {
      aggregated = aggregateCartItems(items);
    } catch (aggErr) {
      return res.status(400).json({
        success: false,
        message: aggErr.message
      });
    }

    // 2. Validate products and authoritative prices/costs from DB
    const validatedItems = [];
    for (const entry of aggregated) {
      const product = await Product.findById(entry.productId);
      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product is currently unavailable.`
        });
      }

      if (product.stockQuantity < entry.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Requested ${entry.quantity} units, but only ${product.stockQuantity} units available.`
        });
      }

      const itemSubtotal = product.price * entry.quantity;
      validatedItems.push({
        product: product._id,
        name: product.name,
        sku: product.sku,
        sizeMl: product.sizeMl,
        quantity: entry.quantity,
        unitPrice: product.price,
        unitCost: product.unitCost, // Snapshot of cost at sale
        subtotal: itemSubtotal
      });
    }

    // 3. Reconcile financials
    const financials = calculateCheckoutFinancials(validatedItems, couponCode);

    // Detect delivery region based on state
    const state = customerInfo.state.toLowerCase();
    let region = 'South India';
    if (/delhi|haryana|punjab|uttar pradesh|himachal|rajasthan|kashmir|jammu|uttarakhand/.test(state)) {
      region = 'North India';
    } else if (/maharashtra|gujarat|goa/.test(state)) {
      region = 'West India';
    } else if (/west bengal|odisha|bihar|jharkhand|assam|sikkim/.test(state)) {
      region = 'East India';
    } else if (/madhya pradesh|chhattisgarh/.test(state)) {
      region = 'Central India';
    }

    // 4. Conditional atomic stock decrement with rollback guarantee
    for (const vItem of validatedItems) {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: vItem.product, stockQuantity: { $gte: vItem.quantity } },
        { $inc: { stockQuantity: -vItem.quantity } },
        { new: true }
      );

      if (!updatedProduct) {
        // Atomic decrement failed: another checkout acquired the remaining stock
        // Rollback all already decremented items
        for (const rolled of decrementedItems) {
          await Product.findByIdAndUpdate(rolled.product, { $inc: { stockQuantity: rolled.quantity } });
        }
        return res.status(400).json({
          success: false,
          message: `Stock reservation failed for ${vItem.name}. The inventory level changed during checkout. Please try again.`
        });
      }

      decrementedItems.push({
        product: vItem.product,
        name: vItem.name,
        quantity: vItem.quantity,
        previousStock: updatedProduct.stockQuantity + vItem.quantity,
        newStock: updatedProduct.stockQuantity
      });
    }

    // 5. Create Order Record
    const orderNumber = generateOrderNumber();
    let order;
    try {
      order = await Order.create({
        orderNumber,
        customer: req.user ? req.user._id : null,
        customerInfo,
        items: validatedItems,
        grossSales: financials.grossSales,
        discountAmount: financials.discountAmount,
        couponCode: couponCode ? String(couponCode).toUpperCase().trim() : null,
        shippingFee: financials.shippingFee,
        taxAmount: financials.taxAmount,
        totalAmount: financials.totalAmount,
        totalCOGS: financials.totalCOGS,
        paymentStatus: 'paid', // Demonstration checkout marked as paid
        paymentMethod: 'Demonstration Luxury Gateway',
        orderStatus: 'processing',
        salesChannel: 'Storefront Online',
        region,
        orderDate: new Date()
      });
    } catch (orderCreateErr) {
      // Rollback stock decrements if order creation fails
      for (const rolled of decrementedItems) {
        await Product.findByIdAndUpdate(rolled.product, { $inc: { stockQuantity: rolled.quantity } });
      }
      throw orderCreateErr;
    }

    // 6. Record Inventory Movements
    for (const dec of decrementedItems) {
      await InventoryMovement.create({
        product: dec.product,
        movementType: 'sale',
        quantityChange: -dec.quantity,
        previousStock: dec.previousStock,
        newStock: dec.newStock,
        reason: `Customer order ${orderNumber}`,
        relatedOrder: order._id,
        performedBy: 'Checkout Service'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Your order has been placed successfully. Thank you for choosing VÉRRA.',
      data: order
    });
  } catch (error) {
    // Defensive rollback
    if (decrementedItems.length > 0) {
      for (const rolled of decrementedItems) {
        try {
          await Product.findByIdAndUpdate(rolled.product, { $inc: { stockQuantity: rolled.quantity } });
        } catch (e) {
          console.error('Failed to rollback item stock:', rolled.product, e);
        }
      }
    }
    next(error);
  }
};


// @desc    Get customer's own order history
// @route   GET /api/orders/my-orders
// @access  Private (Customer)
const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .sort({ orderDate: -1 })
      .populate('items.product', 'image name price');

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get order details by ID
// @route   GET /api/orders/my-orders/:id or /api/orders/:id
// @access  Private / Customer & Admin
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product', 'image name price');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    // Role check: Customers can only access their own order
    if (req.user.role !== 'admin' && String(order.customer) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this order.'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status (Admin only)
// @route   PATCH /api/admin/orders/:id/status
// @access  Admin
const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderStatus, paymentStatus } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    const previousStatus = order.orderStatus;

    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;

    // If order was cancelled or refunded, restore product stock
    if ((orderStatus === 'cancelled' || orderStatus === 'refunded') && previousStatus !== 'cancelled' && previousStatus !== 'refunded') {
      for (const item of order.items) {
        const prod = await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stockQuantity: item.quantity } },
          { new: true }
        );

        await InventoryMovement.create({
          product: item.product,
          movementType: 'return',
          quantityChange: item.quantity,
          previousStock: prod.stockQuantity - item.quantity,
          newStock: prod.stockQuantity,
          reason: `Order ${order.orderNumber} ${orderStatus}`,
          relatedOrder: order._id,
          performedBy: req.user ? req.user.name : 'Admin'
        });
      }
    }

    await order.save();

    res.json({
      success: true,
      message: `Order status updated to ${order.orderStatus}.`,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  aggregateCartItems,
  calculateCheckoutFinancials
};

