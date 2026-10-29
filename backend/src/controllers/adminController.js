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

// @desc    Get inventory stats, stock runway, and movements
// @route   GET /api/admin/inventory
// @access  Admin
const getInventory = async (req, res, next) => {
  try {
    const data = await biService.getInventoryIntelligence();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Get customer analytics & RFM
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

// @desc    Get explainable sales forecast
// @route   GET /api/admin/forecast
// @access  Admin
const getForecast = async (req, res, next) => {
  try {
    const data = await biService.getSalesForecast(req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dynamic automated business insights
// @route   GET /api/admin/insights
// @access  Admin
const getInsights = async (req, res, next) => {
  try {
    const data = await biService.getAutomatedBusinessInsights(req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Get comprehensive sales report with live table & multi-dataset CSV export support
// @route   GET /api/admin/reports/sales
// @access  Admin
const getSalesReport = async (req, res, next) => {
  try {
    const { period = '30d', customStart, customEnd, status, channel, region, format, type = 'sales' } = req.query;

    // Handle CSV export for Products
    if (format === 'csv' && type === 'products') {
      const prodData = await biService.getProductPerformance(req.query);
      let csv = 'Product ID,SKU,Name,Category,Retail Price (INR),Unit Cost (INR),Units Sold,Gross Sales (INR),COGS (INR),Gross Profit (INR),Margin %,Contribution %\n';
      prodData.products.forEach(p => {
        csv += `"${p.id}","${p.sku}","${p.name}","Botanical Hair Care",${p.currentPrice},${p.currentPrice - Math.round(p.grossProfit / (p.unitsSold || 1))},${p.unitsSold},${p.grossSales},${p.cogs},${p.grossProfit},${p.marginPercent},${p.revenueContribution}\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=verra_product_performance_${Date.now()}.csv`);
      return res.status(200).send(csv);
    }

    // Handle CSV export for Inventory
    if (format === 'csv' && type === 'inventory') {
      const invData = await biService.getInventoryIntelligence();
      let csv = 'SKU,Product Name,Current Stock,Reorder Threshold,Unit Cost (INR),Stock Valuation (INR),30D Sold Units,Runway Days,Status\n';
      invData.products.forEach(p => {
        csv += `"${p.sku}","${p.name}",${p.stockQuantity},${p.reorderThreshold},${p.unitCost},${p.valuation},${p.unitsSold30d},${p.estimatedDaysRemaining},"${p.restockPriority}"\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=verra_inventory_intelligence_${Date.now()}.csv`);
      return res.status(200).send(csv);
    }

    // Handle CSV export for Customers
    if (format === 'csv' && type === 'customers') {
      const custData = await biService.getCustomerAnalytics();
      let csv = 'Customer Name,Email,Total Orders,Lifetime Spend (INR),Last Order Date\n';
      custData.topCustomers.forEach(c => {
        const lastDate = new Date(c.lastOrderDate).toISOString().split('T')[0];
        csv += `"${c.name}","${c.email}",${c.orderCount},${c.totalSpent},"${lastDate}"\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=verra_customers_rfm_${Date.now()}.csv`);
      return res.status(200).send(csv);
    }
    
    // Default: Sales Orders Report
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

    // If CSV format requested for sales orders
    if (format === 'csv') {
      let csv = 'Order ID,Date,Customer Name,Customer Email,Gross Sales (INR),Discounts (INR),Shipping (INR),Total (INR),COGS (INR),Gross Profit (INR),Status,Channel,Region\n';
      orders.forEach(o => {
        const net = o.grossSales - o.discountAmount;
        const profit = net - o.totalCOGS;
        const dateStr = new Date(o.orderDate).toISOString().split('T')[0];
        csv += `"${o.orderNumber}","${dateStr}","${o.customerInfo.name}","${o.customerInfo.email}",${o.grossSales},${o.discountAmount},${o.shippingFee},${o.totalAmount},${o.totalCOGS},${profit},"${o.orderStatus}","${o.salesChannel}","${o.region}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=verra_sales_orders_${Date.now()}.csv`);
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
  getForecast,
  getInsights,
  getSalesReport
};
