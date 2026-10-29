const Order = require('../models/Order');
const Product = require('../models/Product');
const InventoryMovement = require('../models/InventoryMovement');

// Generate unique order number (e.g. VR-2026-84920)
const generateOrderNumber = () => {
  const randomDigits = Math.floor(10000 + Math.random() * 90000);
  return `VR-2026-${randomDigits}`;
};

// @desc    Create a new order (Validated server-side against DB prices and stock)
// @route   POST /api/orders
// @access  Public / Customer (optionalAuth)
const createOrder = async (req, res, next) => {
  try {
    const { items, customerInfo, couponCode } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty. Please add botanical oils before checkout.'
      });
    }

    if (!customerInfo || !customerInfo.name || !customerInfo.email || !customerInfo.street || !customerInfo.city || !customerInfo.state || !customerInfo.postalCode) {
      return res.status(400).json({
        success: false,
        message: 'Please provide complete delivery and contact information.'
      });
    }

    // Server-side authoritative validation of items, prices, and stock
    let grossSales = 0;
    let totalCOGS = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId || item.id);
      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product "${item.name || 'Selected item'}" is currently unavailable.`
        });
      }

      const qty = parseInt(item.quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity specified for ${product.name}.`
        });
      }

      if (product.stockQuantity < qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Only ${product.stockQuantity} units available.`
        });
      }

      const itemSubtotal = product.price * qty;
      const itemCOGS = product.unitCost * qty;

      grossSales += itemSubtotal;
      totalCOGS += itemCOGS;

      validatedItems.push({
        product: product._id,
        name: product.name,
        sku: product.sku,
        sizeMl: product.sizeMl,
        quantity: qty,
        unitPrice: product.price,
        unitCost: product.unitCost, // Snapshot of cost at sale
        subtotal: itemSubtotal
      });
    }

    // Calculate discounts & shipping
    let discountAmount = 0;
    if (couponCode && couponCode.toUpperCase().trim() === 'VERRA10') {
      discountAmount = Math.round(grossSales * 0.10); // 10% botanical welcome discount
    } else if (couponCode && couponCode.toUpperCase().trim() === 'RITUAL15') {
      discountAmount = Math.round(grossSales * 0.15);
    }

    // Free shipping on orders over ₹1,500, else ₹99 flat luxury courier fee
    const shippingFee = (grossSales - discountAmount) >= 1500 ? 0 : 99;
    
    // 5% GST included or calculated
    const taxableAmount = (grossSales - discountAmount);
    const taxAmount = Math.round(taxableAmount * 0.05);
    const totalAmount = taxableAmount + shippingFee;

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

    // Create Order Record
    const orderNumber = generateOrderNumber();
    const order = await Order.create({
      orderNumber,
      customer: req.user ? req.user._id : null,
      customerInfo,
      items: validatedItems,
      grossSales,
      discountAmount,
      couponCode: couponCode ? couponCode.toUpperCase().trim() : null,
      shippingFee,
      taxAmount,
      totalAmount,
      totalCOGS,
      paymentStatus: 'paid', // Demonstration checkout marked as paid
      paymentMethod: 'Demonstration Luxury Gateway',
      orderStatus: 'processing',
      salesChannel: 'Storefront Online',
      region,
      orderDate: new Date()
    });

    // Safely decrement stock and record inventory movement
    for (const vItem of validatedItems) {
      const updatedProduct = await Product.findByIdAndUpdate(
        vItem.product,
        { $inc: { stockQuantity: -vItem.quantity } },
        { new: true }
      );

      await InventoryMovement.create({
        product: vItem.product,
        movementType: 'sale',
        quantityChange: -vItem.quantity,
        previousStock: updatedProduct.stockQuantity + vItem.quantity,
        newStock: updatedProduct.stockQuantity,
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
  updateOrderStatus
};
