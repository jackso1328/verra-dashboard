const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const productController = require('../controllers/productController');
const orderController = require('../controllers/orderController');
const expenseController = require('../controllers/expenseController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// All admin routes require authentication and admin role
router.use(protect, requireRole('admin'));

// BI Analytics
router.get('/overview', adminController.getOverview);
router.get('/sales-trend', adminController.getSalesTrend);
router.get('/product-performance', adminController.getProductPerformance);
router.get('/financials', adminController.getFinancials);
router.get('/inventory', adminController.getInventory);
router.get('/customers', adminController.getCustomers);
router.get('/reports/sales', adminController.getSalesReport);

// Admin Product Management
router.post('/products', productController.createProduct);
router.patch('/products/:id', productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);

// Admin Order Management
router.patch('/orders/:id/status', orderController.updateOrderStatus);

// Admin Operating Expenses
router.get('/expenses', expenseController.getExpenses);
router.post('/expenses', expenseController.createExpense);

module.exports = router;
