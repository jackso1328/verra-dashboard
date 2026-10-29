const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');

router.post('/', optionalAuth, orderController.createOrder);
router.get('/my-orders', protect, orderController.getMyOrders);
router.get('/my-orders/:id', protect, orderController.getOrderById);
router.get('/:id', protect, orderController.getOrderById);

module.exports = router;
