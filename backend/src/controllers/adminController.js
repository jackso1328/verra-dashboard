const biService = require('../services/biAnalyticsService');
const Order = require('../models/Order');

// @desc    Get executive overview KPIs
// @route   GET /api/admin/overview
// @access  Admin
const getOverview = async (req, res, next) => {
  try {
    const data = await biService.getExecutiveOverview(req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Get sales analytics
// @route   GET /api/admin/sales-trend
// @access  Admin
const getSalesTrend = async (req, res, next) => {
  try {
    const data = await biService.getSalesAnalytics(req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Get product performance
// @route   GET /api/admin/product-performance
// @access  Admin
const getProductPerformance = async (req, res, next) => {
  try {
    const data = await biService.getProductPerformance(req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Get financial P&L
// @route   GET /api/admin/financials
// @access  Admin
const getFinancials = async (req, res, next) => {
  try {
    const data = await biService.getFinancials(req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Get inventory stats and movements
// @route   GET /api/admin/inventory
// @access  Admin
const getInventory = async (req, res, next) => {
  try {
    const data = await biService.getInventoryAnalytics();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Get customer analytics
// @route   GET /api/admin/customers
// @access  Admin
const getCustomers = async (req, res, next) => {
  try {
    const data = await biService.getCustomerAnalytics();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Get comprehensive sales report with live table & CSV export support
// @route   GET /api/admin/reports/sales
// @access  Admin
const getSalesReport = async (req, res, next) => {
  try {
    const { period = '30d', customStart, customEnd, status, channel, region, format } = req.query;
    
    // Build query filter
    const filter = {};
    if (status && status !== 'all') {
      filter.orderStatus = status;
    }
    if (channel && channel !== 'all') {
      filter.salesChannel = channel;
    }
    if (region && region !== 'all') {
      filter.region = region;
    }

    const now = new Date();
    let startDate = new Date();
    let endDate = new Date(now);

    if (period === '7d') startDate.setDate(now.getDate() - 7);
    else if (period === '30d') startDate.setDate(now.getDate() - 30);
    else if (period === '90d') startDate.setDate(now.getDate() - 90);
    else if (period === '12m') startDate.setFullYear(now.getFullYear() - 1);
    else if (period === 'custom' && customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate.setDate(now.getDate() - 30);
    }

    filter.orderDate = { $gte: startDate, $lte: endDate };

    const orders = await Order.find(filter)
      .sort({ orderDate: -1 })
      .populate('items.product', 'name sku');

    // If CSV format requested, generate and return CSV stream
    if (format === 'csv') {
      let csv = 'Order ID,Date,Customer Name,Customer Email,Gross Sales (INR),Discounts (INR),Shipping (INR),Total (INR),COGS (INR),Gross Profit (INR),Status,Channel,Region\n';
      orders.forEach(o => {
        const net = o.grossSales - o.discountAmount;
        const profit = net - o.totalCOGS;
        const dateStr = new Date(o.orderDate).toISOString().split('T')[0];
        csv += `"${o.orderNumber}","${dateStr}","${o.customerInfo.name}","${o.customerInfo.email}",${o.grossSales},${o.discountAmount},${o.shippingFee},${o.totalAmount},${o.totalCOGS},${profit},"${o.orderStatus}","${o.salesChannel}","${o.region}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=verra_sales_report_${Date.now()}.csv`);
      return res.status(200).send(csv);
    }

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverview,
  getSalesTrend,
  getProductPerformance,
  getFinancials,
  getInventory,
  getCustomers,
  getSalesReport
};
