const Product = require('../models/Product');
const Review = require('../models/Review');
const Order = require('../models/Order');

/**
 * Pure helper to verify if an author qualifies for a 'Verified Purchase' badge.
 */
const verifyReviewEligibility = (qualifyingOrders, targetProductId, userEmail = '', userName = '') => {
  if (!qualifyingOrders || qualifyingOrders.length === 0) return false;
  const targetIdStr = String(targetProductId).trim();
  const cleanEmail = String(userEmail || '').trim().toLowerCase();
  const cleanName = String(userName || '').trim().toLowerCase();

  return qualifyingOrders.some(order => {
    // Must be a valid delivered, shipped, or processing order
    if (['cancelled', 'pending', 'refunded'].includes(order.orderStatus)) return false;

    // Must contain target product
    const hasProduct = (order.items || []).some(item => {
      const pId = item.product ? String(item.product) : '';
      const sku = item.sku || '';
      return pId === targetIdStr || sku === targetIdStr;
    });
    if (!hasProduct) return false;

    // Must match author
    const orderEmail = order.customerInfo?.email ? String(order.customerInfo.email).trim().toLowerCase() : '';
    const orderName = order.customerInfo?.name ? String(order.customerInfo.name).trim().toLowerCase() : '';

    return (cleanEmail && orderEmail === cleanEmail) || (cleanName && orderName === cleanName);
  });
};

// @desc    Get all active products with filters and sorting
// @route   GET /api/products
// @access  Public
const getAllProducts = async (req, res, next) => {
  try {
    const { category, search, sort, featured } = req.query;

    const query = { isActive: true };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (featured === 'true') {
      query.featured = true;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { keyIngredients: { $regex: search, $options: 'i' } }
      ];
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'price-low') {
      sortOption = { price: 1 };
    } else if (sort === 'price-high') {
      sortOption = { price: -1 };
    } else if (sort === 'name') {
      sortOption = { name: 1 };
    }

    const products = await Product.find(query).sort(sortOption);

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product by ID with reviews
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Botanical product not found.'
      });
    }

    const reviews = await Review.find({
      product: product._id,
      moderationStatus: 'approved'
    }).sort({ createdAt: -1 });

    const relatedProducts = await Product.find({
      _id: { $ne: product._id },
      isActive: true
    }).limit(3);

    res.json({
      success: true,
      data: product,
      reviews,
      relatedProducts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a product
// @route   POST /api/admin/products
// @access  Admin
const createProduct = async (req, res, next) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a product
// @route   PATCH /api/admin/products/:id
// @access  Admin
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    res.json({
      success: true,
      message: 'Product updated successfully.',
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete (soft-delete) a product
// @route   DELETE /api/admin/products/:id
// @access  Admin
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    res.json({
      success: true,
      message: 'Product archived successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit a review for a product
// @route   POST /api/products/:id/reviews
// @access  Public / Customer
const createReview = async (req, res, next) => {
  try {
    const { authorName, rating, headline, comment } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    if (!authorName || !rating || !headline || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Please provide author name, rating, headline, and comment.'
      });
    }

    const authorEmail = (req.body.authorEmail || (req.user ? req.user.email : '')).trim().toLowerCase();
    
    // Authoritatively check whether the reviewer placed a qualifying order for this formulation
    let isVerified = false;
    const orderMatchQuery = {
      'items.product': product._id,
      orderStatus: { $in: ['delivered', 'shipped', 'processing'] }
    };
    const orConditions = [];
    if (req.user) orConditions.push({ customer: req.user._id });
    if (authorEmail) orConditions.push({ 'customerInfo.email': authorEmail });
    if (authorName) orConditions.push({ 'customerInfo.name': authorName.trim() });

    if (orConditions.length > 0) {
      orderMatchQuery.$or = orConditions;
      const matchingOrder = await Order.findOne(orderMatchQuery);
      if (matchingOrder) {
        isVerified = true;
      }
    }

    const review = await Review.create({
      product: product._id,
      authorName: authorName.trim(),
      rating: Math.min(5, Math.max(1, parseInt(rating, 10) || 5)),
      headline: headline.trim(),
      comment: comment.trim(),
      isVerified,
      moderationStatus: 'approved'
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for sharing your botanical experience.',
      data: review
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createReview,
  verifyReviewEligibility
};

