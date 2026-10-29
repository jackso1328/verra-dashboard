const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Public catalog routes
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);
router.post('/:id/reviews', productController.createReview);

module.exports = router;
