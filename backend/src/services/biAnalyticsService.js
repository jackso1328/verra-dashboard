const Order = require('../models/Order');
const Product = require('../models/Product');
const Expense = require('../models/Expense');
const InventoryMovement = require('../models/InventoryMovement');
const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * Helper to compute date range boundaries and previous equivalent period
 */
const getDateRangeBoundaries = (period = '30d', customStart, customEnd) => {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date(now);

  if (period === '7d') {
    startDate.setDate(now.getDate() - 7);
  } else if (period === '30d') {
    startDate.setDate(now.getDate() - 30);
  } else if (period === '90d') {
    startDate.setDate(now.getDate() - 90);
  } else if (period === '12m') {
    startDate.setFullYear(now.getFullYear() - 1);
  } else if (period === 'custom' && customStart && customEnd) {
    startDate = new Date(customStart);
    endDate = new Date(customEnd);
    endDate.setHours(23, 59, 59, 999);
  } else {
    // Default 30 days
    startDate.setDate(now.getDate() - 30);
  }

  // Calculate duration in milliseconds to determine equivalent previous period
  const durationMs = endDate.getTime() - startDate.getTime();
  const prevEndDate = new Date(startDate.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - durationMs);

  return { startDate, endDate, prevStartDate, prevEndDate };
};

/**
 * Filter generator for valid realized orders (excludes cancelled/pending)
 */
const getOrderFilter = (startDate, endDate, extraFilters = {}) => {
  const filter = {
    orderDate: { $gte: startDate, $lte: endDate },
    orderStatus: { $nin: ['cancelled', 'pending'] },
    paymentStatus: { $in: ['paid', 'refunded'] } // Include refunded to calculate refund metrics
  };

  if (extraFilters.productId) {
    const val = String(extraFilters.productId).trim();
    if (mongoose.Types.ObjectId.isValid(val) && String(new mongoose.Types.ObjectId(val)) === val) {
      filter['items.product'] = val;
    } else {
      filter['items.sku'] = val;
    }
  }
  if (extraFilters.salesChannel) {
    filter.salesChannel = extraFilters.salesChannel;
  }
  if (extraFilters.region) {
    filter.region = extraFilters.region;
  }
  if (extraFilters.orderStatus && extraFilters.orderStatus !== 'all') {
    filter.orderStatus = extraFilters.orderStatus;
  }

  return filter;
};

/**
 * Core pure calculation engine for Executive Metrics.
 * Handles overall orders OR product-filtered orders with proportional discount allocation.
 */
const calculateOrderMetrics = (orders, expenses = [], targetProductId = null) => {
  let grossSales = 0;
  let totalDiscounts = 0;
  let refundedAmount = 0;
  let qualifyingOrdersCount = 0;
  let refundedOrdersCount = 0;
  let unitsSold = 0;
  let totalCOGS = 0;

  orders.forEach(order => {
    // If filtering by product, identify matching line items
    let matchingItems = order.items || [];
    if (targetProductId) {
      const targetStr = String(targetProductId).trim();
      matchingItems = matchingItems.filter(item => {
        const itemProdId = item.product ? String(item.product) : '';
        const itemSku = item.sku || '';
        return itemProdId === targetStr || itemSku === targetStr;
      });
    }

    if (matchingItems.length === 0) return;

    const orderGross = order.grossSales || 0;
    const orderDiscount = order.discountAmount || 0;

    let itemsGross = 0;
    let itemsCOGS = 0;
    let itemsUnits = 0;

    matchingItems.forEach(item => {
      const lineGross = item.subtotal || (item.unitPrice * item.quantity);
      const lineCOGS = (item.unitCost || 0) * item.quantity;
      itemsGross += lineGross;
      itemsCOGS += lineCOGS;
      itemsUnits += item.quantity;
    });

    // Proportional order discount allocation to the selected line items
    let allocatedDiscount = 0;
    if (targetProductId) {
      allocatedDiscount = orderGross > 0 ? (orderDiscount * itemsGross) / orderGross : 0;
    } else {
      allocatedDiscount = orderDiscount;
    }

    if (order.orderStatus === 'refunded') {
      refundedOrdersCount++;
      const allocatedRefund = orderGross > 0 ? ((order.totalAmount || orderGross) * itemsGross) / orderGross : itemsGross;
      refundedAmount += allocatedRefund;
    } else {
      qualifyingOrdersCount++;
      grossSales += itemsGross;
      totalDiscounts += allocatedDiscount;
      totalCOGS += itemsCOGS;
      unitsSold += itemsUnits;
    }
  });

  const netRevenue = Math.max(0, grossSales - totalDiscounts);
  const grossProfit = netRevenue - totalCOGS;
  const grossProfitMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
  
  const operatingExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const netOperatingProfit = grossProfit - operatingExpenses;
  const averageOrderValue = qualifyingOrdersCount > 0 ? Math.round(netRevenue / qualifyingOrdersCount) : 0;
  
  const totalPlaced = qualifyingOrdersCount + refundedOrdersCount;
  const refundRate = totalPlaced > 0 ? (refundedOrdersCount / totalPlaced) * 100 : 0;

  return {
    grossSales: Math.round(grossSales),
    discounts: Math.round(totalDiscounts),
    netRevenue: Math.round(netRevenue),
    totalOrders: qualifyingOrdersCount,
    unitsSold,
    cogs: Math.round(totalCOGS),
    grossProfit: Math.round(grossProfit),
    grossProfitMargin: parseFloat(grossProfitMargin.toFixed(1)),
    operatingExpenses: Math.round(operatingExpenses),
    netOperatingProfit: Math.round(netOperatingProfit),
    averageOrderValue,
    refundRate: parseFloat(refundRate.toFixed(1)),
    refundedAmount: Math.round(refundedAmount),
    refundedOrdersCount
  };
};

/**
 * 1. Executive BI Overview (12 Standardized KPIs)
 */
const getExecutiveOverview = async (query = {}) => {
  const { period = '30d', customStart, customEnd, productId, salesChannel, region } = query;
  const { startDate, endDate, prevStartDate, prevEndDate } = getDateRangeBoundaries(period, customStart, customEnd);

  const currentFilter = getOrderFilter(startDate, endDate, { productId, salesChannel, region });
  const prevFilter = getOrderFilter(prevStartDate, prevEndDate, { productId, salesChannel, region });

  const [currentOrders, prevOrders, allProducts, currentExpenses, prevExpenses] = await Promise.all([
    Order.find(currentFilter),
    Order.find(prevFilter),
    Product.find({ isActive: true }),
    Expense.find({ date: { $gte: startDate, $lte: endDate } }),
    Expense.find({ date: { $gte: prevStartDate, $lte: prevEndDate } })
  ]);

  const currentMetrics = calculateOrderMetrics(currentOrders, currentExpenses, productId);
  const prevMetrics = calculateOrderMetrics(prevOrders, prevExpenses, productId);

  // Inventory valuation: if filtering by product, restrict to that product
  let relevantProducts = allProducts;
  if (productId) {
    const val = String(productId).trim();
    relevantProducts = allProducts.filter(p => String(p._id) === val || p.sku === val);
  }
  const inventoryValuation = relevantProducts.reduce((sum, prod) => sum + (prod.stockQuantity * prod.unitCost), 0);
  const totalStockUnits = relevantProducts.reduce((sum, prod) => sum + prod.stockQuantity, 0);

  // Growth percentages helper
  const calcChange = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return parseFloat((((curr - prev) / prev) * 100).toFixed(1));
  };

  return {
    period,
    dateRange: {
      startDate,
      endDate,
      prevStartDate,
      prevEndDate
    },
    kpis: {
      grossSales: {
        value: currentMetrics.grossSales,
        prevValue: prevMetrics.grossSales,
        change: calcChange(currentMetrics.grossSales, prevMetrics.grossSales)
      },
      netRevenue: {
        value: currentMetrics.netRevenue,
        prevValue: prevMetrics.netRevenue,
        change: calcChange(currentMetrics.netRevenue, prevMetrics.netRevenue)
      },
      totalOrders: {
        value: currentMetrics.totalOrders,
        prevValue: prevMetrics.totalOrders,
        change: calcChange(currentMetrics.totalOrders, prevMetrics.totalOrders)
      },
      unitsSold: {
        value: currentMetrics.unitsSold,
        prevValue: prevMetrics.unitsSold,
        change: calcChange(currentMetrics.unitsSold, prevMetrics.unitsSold)
      },
      cogs: {
        value: currentMetrics.cogs,
        prevValue: prevMetrics.cogs,
        change: calcChange(currentMetrics.cogs, prevMetrics.cogs)
      },
      grossProfit: {
        value: currentMetrics.grossProfit,
        prevValue: prevMetrics.grossProfit,
        change: calcChange(currentMetrics.grossProfit, prevMetrics.grossProfit)
      },
      grossProfitMargin: {
        value: currentMetrics.grossProfitMargin,
        prevValue: prevMetrics.grossProfitMargin,
        change: parseFloat((currentMetrics.grossProfitMargin - prevMetrics.grossProfitMargin).toFixed(1))
      },
      operatingExpenses: {
        value: currentMetrics.operatingExpenses,
        prevValue: prevMetrics.operatingExpenses,
        change: calcChange(currentMetrics.operatingExpenses, prevMetrics.operatingExpenses)
      },
      netOperatingProfit: {
        value: currentMetrics.netOperatingProfit,
        prevValue: prevMetrics.netOperatingProfit,
        change: calcChange(currentMetrics.netOperatingProfit, prevMetrics.netOperatingProfit)
      },
      averageOrderValue: {
        value: currentMetrics.averageOrderValue,
        prevValue: prevMetrics.averageOrderValue,
        change: calcChange(currentMetrics.averageOrderValue, prevMetrics.averageOrderValue)
      },
      refundRate: {
        value: currentMetrics.refundRate,
        prevValue: prevMetrics.refundRate,
        change: parseFloat((currentMetrics.refundRate - prevMetrics.refundRate).toFixed(1))
      },
      inventoryValuation: {
        value: inventoryValuation,
        totalStockUnits
      }
    }
  };
};

/**
 * 2. Sales Analytics (Time series, channels, regions)
 */
const getSalesAnalytics = async (query = {}) => {
  const { period = '30d', customStart, customEnd, productId, salesChannel, region } = query;
  const { startDate, endDate } = getDateRangeBoundaries(period, customStart, customEnd);
  const filter = getOrderFilter(startDate, endDate, { productId, salesChannel, region });
  filter.orderStatus = { $nin: ['cancelled', 'pending', 'refunded'] }; // Only qualifying realized sales

  const orders = await Order.find(filter).sort({ orderDate: 1 });

  const isMonthly = period === '12m';
  const timeSeriesMap = new Map();

  orders.forEach(order => {
    const d = new Date(order.orderDate);
    let key;
    if (isMonthly) {
      key = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    } else {
      key = d.toISOString().split('T')[0];
    }

    if (!timeSeriesMap.has(key)) {
      timeSeriesMap.set(key, {
        date: key,
        revenue: 0,
        grossSales: 0,
        cogs: 0,
        profit: 0,
        orders: 0,
        units: 0
      });
    }

    const row = timeSeriesMap.get(key);
    
    // If filtered by product, calculate only matching items
    let lineGross = 0;
    let lineCOGS = 0;
    let lineUnits = 0;

    order.items.forEach(item => {
      if (!productId || String(item.product) === String(productId) || item.sku === productId) {
        const itemSubtotal = item.subtotal || (item.unitPrice * item.quantity);
        lineGross += itemSubtotal;
        lineCOGS += ((item.unitCost || 0) * item.quantity);
        lineUnits += item.quantity;
      }
    });

    const allocatedDiscount = order.grossSales > 0 ? (order.discountAmount * lineGross) / order.grossSales : 0;
    const net = lineGross - allocatedDiscount;

    row.revenue += Math.round(net);
    row.grossSales += Math.round(lineGross);
    row.cogs += Math.round(lineCOGS);
    row.profit += Math.round(net - lineCOGS);
    row.orders += 1;
    row.units += lineUnits;
  });

  const timeline = Array.from(timeSeriesMap.values());

  // Aggregate by Sales Channel & Region
  const channelMap = {};
  const regionMap = {};

  orders.forEach(order => {
    const ch = order.salesChannel || 'Storefront Online';
    const reg = order.region || 'South India';
    
    let lineGross = 0;
    order.items.forEach(item => {
      if (!productId || String(item.product) === String(productId) || item.sku === productId) {
        lineGross += item.subtotal || (item.unitPrice * item.quantity);
      }
    });
    const allocatedDiscount = order.grossSales > 0 ? (order.discountAmount * lineGross) / order.grossSales : 0;
    const net = Math.round(lineGross - allocatedDiscount);

    channelMap[ch] = (channelMap[ch] || 0) + net;
    regionMap[reg] = (regionMap[reg] || 0) + net;
  });

  return {
    period,
    totalRecords: orders.length,
    timeline,
    byChannel: channelMap,
    byRegion: regionMap
  };
};

/**
 * Pure calculation function for product performance.
 * Allocates order-level discounts consistently across line items so product net sales
 * and gross profit reconcile with the overall dashboard within rounding tolerances.
 */
const calculateProductPerformanceData = (products, orders) => {
  const productStats = {};
  products.forEach(p => {
    productStats[String(p._id)] = {
      id: p._id,
      name: p.name,
      sku: p.sku,
      sizeMl: p.sizeMl,
      image: p.image,
      currentPrice: p.price,
      unitCost: p.unitCost,
      currentStock: p.stockQuantity,
      unitsSold: 0,
      grossSales: 0,
      discounts: 0,
      netSales: 0,
      cogs: 0,
      grossProfit: 0,
      marginPercent: 0,
      revenueContribution: 0
    };
  });

  let totalBrandNetRevenue = 0;

  orders.forEach(order => {
    const orderGross = order.grossSales || 0;
    const orderDiscount = order.discountAmount || 0;

    order.items.forEach(item => {
      const pId = String(item.product);
      if (productStats[pId]) {
        const itemGross = item.subtotal || (item.unitPrice * item.quantity);
        const itemDiscount = orderGross > 0 ? (orderDiscount * itemGross) / orderGross : 0;
        const itemNet = itemGross - itemDiscount;
        const itemCost = (item.unitCost || 0) * item.quantity;
        const itemProfit = itemNet - itemCost;

        productStats[pId].unitsSold += item.quantity;
        productStats[pId].grossSales += itemGross;
        productStats[pId].discounts += itemDiscount;
        productStats[pId].netSales += itemNet;
        productStats[pId].cogs += itemCost;
        productStats[pId].grossProfit += itemProfit;
        totalBrandNetRevenue += itemNet;
      }
    });
  });

  const performanceList = Object.values(productStats).map(p => {
    const net = Math.round(p.netSales);
    const profit = Math.round(p.grossProfit);
    const margin = net > 0 ? (profit / net) * 100 : 0;
    const contribution = totalBrandNetRevenue > 0 ? (p.netSales / totalBrandNetRevenue) * 100 : 0;
    const asp = p.unitsSold > 0 ? Math.round(p.grossSales / p.unitsSold) : p.currentPrice;

    return {
      ...p,
      grossSales: Math.round(p.grossSales),
      discounts: Math.round(p.discounts),
      netSales: net,
      cogs: Math.round(p.cogs),
      grossProfit: profit,
      marginPercent: parseFloat(margin.toFixed(1)),
      revenueContribution: parseFloat(contribution.toFixed(1)),
      averageSellingPrice: asp
    };
  });

  performanceList.sort((a, b) => b.netSales - a.netSales);

  return {
    totalBrandRevenue: Math.round(totalBrandNetRevenue),
    products: performanceList
  };
};

/**
 * 3. Product Performance Analytics
 */
const getProductPerformance = async (query = {}) => {
  const { period = '30d', customStart, customEnd } = query;
  const { startDate, endDate } = getDateRangeBoundaries(period, customStart, customEnd);
  const filter = getOrderFilter(startDate, endDate);
  filter.orderStatus = { $nin: ['cancelled', 'pending', 'refunded'] };

  const [orders, products] = await Promise.all([
    Order.find(filter),
    Product.find()
  ]);

  const { totalBrandRevenue, products: performanceList } = calculateProductPerformanceData(products, orders);

  return {
    period,
    totalBrandRevenue,
    products: performanceList
  };
};

/**
 * 4. Financial Analytics (P&L Breakdown)
 */
const getFinancials = async (query = {}) => {
  const { period = '30d', customStart, customEnd } = query;
  const { startDate, endDate } = getDateRangeBoundaries(period, customStart, customEnd);
  const filter = getOrderFilter(startDate, endDate);
  filter.orderStatus = { $nin: ['cancelled', 'pending', 'refunded'] };

  const [orders, expenses] = await Promise.all([
    Order.find(filter),
    Expense.find({ date: { $gte: startDate, $lte: endDate } })
  ]);

  let grossRevenue = 0;
  let discounts = 0;
  let totalCOGS = 0;

  orders.forEach(o => {
    grossRevenue += o.grossSales;
    discounts += o.discountAmount;
    totalCOGS += o.totalCOGS;
  });

  const netRevenue = Math.max(0, grossRevenue - discounts);
  const grossProfit = netRevenue - totalCOGS;
  const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

  const expenseBreakdown = {
    marketing: 0,
    packaging: 0,
    shipping_carrier: 0,
    operational: 0,
    salaries: 0,
    utilities: 0,
    other: 0
  };

  let totalExpenses = 0;
  expenses.forEach(e => {
    const cat = expenseBreakdown[e.category] !== undefined ? e.category : 'other';
    expenseBreakdown[cat] += e.amount;
    totalExpenses += e.amount;
  });

  const netOperatingProfit = grossProfit - totalExpenses;
  const operatingMargin = netRevenue > 0 ? (netOperatingProfit / netRevenue) * 100 : 0;

  return {
    period,
    pAndL: {
      grossRevenue: Math.round(grossRevenue),
      discounts: Math.round(discounts),
      netRevenue: Math.round(netRevenue),
      cogs: Math.round(totalCOGS),
      grossProfit: Math.round(grossProfit),
      grossMargin: parseFloat(grossMargin.toFixed(1)),
      totalOperatingExpenses: Math.round(totalExpenses),
      expenseBreakdown,
      netOperatingProfit: Math.round(netOperatingProfit),
      operatingMargin: parseFloat(operatingMargin.toFixed(1))
    },
    recentExpenses: expenses.slice(0, 10)
  };
};

/**
 * Pure calculation function for Customer Analytics & RFM Segmentation.
 * Evaluates genuine Recency (days since last purchase), Frequency (eligible order count),
 * and Monetary (net total spend) for each customer.
 */
const computeRfmAnalysis = (customers, eligibleOrders, referenceDate = new Date()) => {
  const customerOrderMap = {};

  eligibleOrders.forEach(o => {
    const cId = String(o.customer || o.customerInfo.email).toLowerCase();
    if (!customerOrderMap[cId]) {
      customerOrderMap[cId] = {
        name: o.customerInfo.name,
        email: o.customerInfo.email,
        orderCount: 0,
        totalSpent: 0,
        lastOrderDate: o.orderDate
      };
    }
    customerOrderMap[cId].orderCount += 1;
    // Realized customer spend is net product spend
    const netSpend = (o.grossSales || 0) - (o.discountAmount || 0);
    customerOrderMap[cId].totalSpent += netSpend;
    if (new Date(o.orderDate) > new Date(customerOrderMap[cId].lastOrderDate)) {
      customerOrderMap[cId].lastOrderDate = o.orderDate;
    }
  });

  const customerList = Object.values(customerOrderMap).map(c => {
    const recencyDays = Math.max(0, Math.floor((referenceDate.getTime() - new Date(c.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)));
    
    // Assign documented RFM segment
    let segment = 'New Patrons';
    if (c.orderCount >= 3 && c.totalSpent >= 3500 && recencyDays <= 90) {
      segment = 'Champions';
    } else if (c.orderCount >= 2 && recencyDays <= 180) {
      segment = 'Loyal Ritualists';
    } else if (recencyDays > 180) {
      segment = 'At Risk';
    } else if (c.totalSpent >= 1500 && recencyDays <= 90) {
      segment = 'Potential';
    } else {
      segment = 'New Patrons';
    }

    return {
      ...c,
      totalSpent: Math.round(c.totalSpent),
      recencyDays,
      segment
    };
  });

  const repeatBuyers = customerList.filter(c => c.orderCount > 1);
  const singleBuyers = customerList.filter(c => c.orderCount === 1);
  const repeatPurchaseRate = customerList.length > 0 ? (repeatBuyers.length / customerList.length) * 100 : 0;

  const rfmSegments = {
    champions: customerList.filter(c => c.segment === 'Champions').length,
    loyal: customerList.filter(c => c.segment === 'Loyal Ritualists').length,
    potential: customerList.filter(c => c.segment === 'Potential').length,
    atRisk: customerList.filter(c => c.segment === 'At Risk').length,
    newCustomers: customerList.filter(c => c.segment === 'New Patrons').length
  };

  return {
    totalRegistered: customers.length,
    activeBuyersCount: customerList.length,
    newVsReturning: {
      newCustomers: singleBuyers.length,
      returningCustomers: repeatBuyers.length
    },
    repeatPurchaseRate: parseFloat(repeatPurchaseRate.toFixed(1)),
    rfmDefinitions: {
      champions: "Frequency >= 3, Net Spend >= ₹3,500, Recency <= 90 days",
      loyal: "Frequency >= 2, Recency <= 180 days",
      potential: "Net Spend >= ₹1,500, Recency <= 90 days",
      atRisk: "Order Count >= 1, Inactive > 180 days",
      newCustomers: "Single order within the last 90 days"
    },
    rfmSegments,
    topCustomers: customerList.sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10)
  };
};

/**
 * 5. Customer Analytics & RFM Segmentation
 */
const getCustomerAnalytics = async () => {
  const [customers, orders] = await Promise.all([
    User.find({ role: 'customer' }).sort({ createdAt: -1 }),
    // Exclude cancelled, pending, and refunded orders
    Order.find({ orderStatus: { $nin: ['cancelled', 'pending', 'refunded'] } })
  ]);

  return computeRfmAnalysis(customers, orders);
};

/**
 * 6. Inventory Analytics
 */
const getInventoryAnalytics = async () => {
  const products = await Product.find().sort({ stockQuantity: 1 });
  const movements = await InventoryMovement.find()
    .sort({ date: -1 })
    .limit(20)
    .populate('product', 'name sku image');

  let totalStockValuation = 0;
  let totalUnits = 0;
  const lowStockAlerts = [];

  products.forEach(p => {
    const valuation = p.stockQuantity * p.unitCost;
    totalStockValuation += valuation;
    totalUnits += p.stockQuantity;

    if (p.stockQuantity <= p.reorderThreshold) {
      lowStockAlerts.push({
        id: p._id,
        name: p.name,
        sku: p.sku,
        stock: p.stockQuantity,
        threshold: p.reorderThreshold,
        severity: p.stockQuantity <= 10 ? 'critical' : 'warning'
      });
    }
  });

  return {
    totalUnits,
    totalStockValuation,
    products,
    lowStockAlerts,
    movements
  };
};

/**
 * Pure helper to build a continuous monthly series of 12 months including zero-sales months.
 */
const buildContinuousMonthlySeries = (orders, referenceDate = new Date()) => {
  const series = [];
  const monthlyBuckets = new Map();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    monthlyBuckets.set(key, {
      key,
      label,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      revenue: 0,
      grossSales: 0,
      cogs: 0,
      orders: 0,
      units: 0,
      isZeroMonth: true
    });
  }

  orders.forEach(o => {
    const d = new Date(o.orderDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyBuckets.has(key)) {
      const bucket = monthlyBuckets.get(key);
      const net = (o.grossSales || 0) - (o.discountAmount || 0);
      bucket.revenue += net;
      bucket.grossSales += (o.grossSales || 0);
      bucket.cogs += (o.totalCOGS || 0);
      bucket.orders += 1;
      bucket.units += (o.items || []).reduce((s, i) => s + i.quantity, 0);
      bucket.isZeroMonth = false;
    }
  });

  monthlyBuckets.forEach(b => {
    series.push({
      ...b,
      revenue: Math.round(b.revenue),
      grossSales: Math.round(b.grossSales),
      cogs: Math.round(b.cogs)
    });
  });

  return series;
};

/**
 * Pure forecasting projection model:
 * Continuous 12-month series, linear slope, 3-month weighted moving average (weights 3, 2, 1),
 * 60/40 blend, and empirical uncertainty band (±7.5%).
 */
const calculateSalesForecastProjection = (historicalSeries, referenceDate = new Date()) => {
  const n = historicalSeries.length;
  if (n < 2) {
    return {
      methodology: 'Baseline projection: Insufficient historical periods recorded.',
      historical: historicalSeries,
      forecast: []
    };
  }

  // 1. Linear regression slope & intercept over continuous time steps x = 1..n
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  historicalSeries.forEach((pt, idx) => {
    const x = idx + 1;
    const y = pt.revenue;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // 2. 3-Month Weighted Moving Average with weights: 3 (latest), 2 (mid), 1 (oldest)
  const last3 = historicalSeries.slice(-3);
  let weightedAvg = 0;
  if (last3.length === 3) {
    weightedAvg = (last3[2].revenue * 3 + last3[1].revenue * 2 + last3[0].revenue * 1) / 6;
  } else {
    weightedAvg = last3.reduce((s, r) => s + r.revenue, 0) / (last3.length || 1);
  }

  // 3. Project next 3 months
  const forecast = [];
  const lastMonthObj = historicalSeries[historicalSeries.length - 1];

  for (let step = 1; step <= 3; step++) {
    const futureDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + step, 1);
    const label = futureDate.toLocaleString('en-US', { month: 'short', year: 'numeric' }) + ' (Forecast)';
    const x = n + step;

    // 60% Linear Trend + 40% Weighted Moving Average
    const linearEstimate = Math.max(0, slope * x + intercept);
    const blendedEstimate = Math.round((linearEstimate * 0.6) + (weightedAvg * 0.4));

    // Empirical uncertainty band (±7.5% empirical estimate)
    const lowerBound = Math.max(0, Math.round(blendedEstimate * 0.925));
    const upperBound = Math.round(blendedEstimate * 1.075);

    const prevRev = step === 1 ? lastMonthObj.revenue : forecast[step - 2].predictedRevenue;
    const growthRatePercent = prevRev > 0 ? parseFloat((((blendedEstimate - prevRev) / prevRev) * 100).toFixed(1)) : 0;

    forecast.push({
      step,
      label,
      predictedRevenue: blendedEstimate,
      lowerBound,
      upperBound,
      growthRatePercent,
      isPrediction: true
    });
  }

  return {
    methodology: 'Blended 60/40 Linear Monthly Trend Slope & 3-Month Weighted Moving Average (Weights 3:2:1) with ±7.5% Empirical Uncertainty Range.',
    historicalActualsCount: historicalSeries.length,
    historical: historicalSeries,
    forecast,
    summary: {
      nextMonthProjectedRevenue: forecast[0] ? forecast[0].predictedRevenue : 0,
      nextQuarterProjectedRevenue: forecast.reduce((s, f) => s + f.predictedRevenue, 0),
      trendDirection: slope >= 0 ? 'Expanding (+)' : 'Contracting (-)',
      monthlySlopeInr: Math.round(slope)
    }
  };
};

/**
 * 7. Transparent & Explainable Sales Forecasting
 */
const getSalesForecast = async (query = {}) => {
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const orders = await Order.find({
    orderDate: { $gte: oneYearAgo, $lte: now },
    orderStatus: { $nin: ['cancelled', 'pending', 'refunded'] }
  }).sort({ orderDate: 1 });

  const continuousHistory = buildContinuousMonthlySeries(orders, now);
  return calculateSalesForecastProjection(continuousHistory, now);
};

/**
 * Pure function to calculate inventory intelligence metrics without arbitrary 999 runway days.
 */
const calculateInventoryIntelligenceMetrics = (baseData, past30dOrders) => {
  const salesVelocityMap = {};
  baseData.products.forEach(p => {
    salesVelocityMap[String(p._id)] = 0;
  });

  past30dOrders.forEach(o => {
    (o.items || []).forEach(item => {
      const pId = String(item.product);
      if (salesVelocityMap[pId] !== undefined) {
        salesVelocityMap[pId] += item.quantity;
      }
    });
  });

  let totalPast30dCOGS = 0;

  const enrichedProducts = baseData.products.map(p => {
    const unitsSold30d = salesVelocityMap[String(p._id)] || 0;
    const dailyRunRate = parseFloat((unitsSold30d / 30).toFixed(2));
    
    // Replace arbitrary 999 with genuine null and descriptive display
    const estimatedDaysRemaining = dailyRunRate > 0 ? Math.round(p.stockQuantity / dailyRunRate) : null;
    const runwayDisplay = estimatedDaysRemaining !== null ? `${estimatedDaysRemaining} days` : 'No recent sales';
    
    const itemCOGS30d = unitsSold30d * p.unitCost;
    totalPast30dCOGS += itemCOGS30d;

    let restockPriority = 'Healthy';
    if (p.stockQuantity === 0) {
      restockPriority = 'Immediate Stockout';
    } else if (estimatedDaysRemaining !== null && estimatedDaysRemaining <= 15) {
      restockPriority = 'High Urgency (<15d Runway)';
    } else if (p.stockQuantity <= p.reorderThreshold) {
      restockPriority = 'Reorder Threshold Met';
    } else if (estimatedDaysRemaining !== null && estimatedDaysRemaining <= 30) {
      restockPriority = 'Medium Attention (<30d Runway)';
    }

    return {
      _id: p._id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      price: p.price,
      unitCost: p.unitCost,
      stockQuantity: p.stockQuantity,
      reorderThreshold: p.reorderThreshold,
      image: p.image,
      unitsSold30d,
      dailyRunRate,
      estimatedDaysRemaining,
      runwayDisplay,
      restockPriority,
      valuation: p.stockQuantity * p.unitCost
    };
  });

  // Annualized Inventory Turnover = (Past 30D COGS * 12) / Total Stock Valuation (at Unit Cost)
  const annualizedTurnover = baseData.totalStockValuation > 0
    ? parseFloat(((totalPast30dCOGS * 12) / baseData.totalStockValuation).toFixed(2))
    : 0;

  return {
    ...baseData,
    products: enrichedProducts,
    turnoverFormula: 'Annualized Inventory Turnover = (Past 30-Day COGS × 12) ÷ Current Stock Valuation (at Unit Cost)',
    inventoryTurnoverRatio: annualizedTurnover,
    lowStockRecommendations: enrichedProducts
      .filter(p => p.restockPriority !== 'Healthy')
      .sort((a, b) => {
        const aDays = a.estimatedDaysRemaining !== null ? a.estimatedDaysRemaining : 9999;
        const bDays = b.estimatedDaysRemaining !== null ? b.estimatedDaysRemaining : 9999;
        return aDays - bDays;
      })
  };
};

/**
 * 8. Upgraded Inventory Intelligence
 */
const getInventoryIntelligence = async () => {
  const baseData = await getInventoryAnalytics();
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const pastOrders = await Order.find({
    orderDate: { $gte: thirtyDaysAgo },
    orderStatus: { $nin: ['cancelled', 'pending', 'refunded'] }
  });

  return calculateInventoryIntelligenceMetrics(baseData, pastOrders);
};

/**
 * 9. Dynamic Data-Driven Business Insights Generator
 */
const getAutomatedBusinessInsights = async (query = {}) => {
  const overview = await getExecutiveOverview(query);
  const prodPerf = await getProductPerformance(query);
  const custPerf = await getCustomerAnalytics();
  const invData = await getInventoryAnalytics();

  const { kpis } = overview;
  const insights = [];

  // Insight 1: Revenue & Growth Trajectory
  if (kpis.netRevenue.change > 0) {
    insights.push({
      type: 'growth',
      category: 'Revenue Trajectory',
      title: 'Strong Top-Line Revenue Expansion',
      description: `Net revenue increased by ${kpis.netRevenue.change}% compared to the prior equivalent period, reaching ₹${kpis.netRevenue.value.toLocaleString('en-IN')}.`,
      sentiment: 'positive',
      metric: `+${kpis.netRevenue.change}%`
    });
  } else if (kpis.netRevenue.change < 0) {
    insights.push({
      type: 'warning',
      category: 'Revenue Trajectory',
      title: 'Periodic Revenue Softening',
      description: `Net revenue adjusted by ${kpis.netRevenue.change}% vs the previous period. Monitor conversion velocity across digital acquisition channels.`,
      sentiment: 'warning',
      metric: `${kpis.netRevenue.change}%`
    });
  } else {
    insights.push({
      type: 'stable',
      category: 'Revenue Trajectory',
      title: 'Consistent Revenue Baseline',
      description: `Net revenue maintained stability at ₹${kpis.netRevenue.value.toLocaleString('en-IN')} across qualifying orders.`,
      sentiment: 'neutral',
      metric: '0.0%'
    });
  }

  // Insight 2: High Margin Formulation Leader
  if (prodPerf.products && prodPerf.products.length > 0) {
    const topMarginProd = [...prodPerf.products].sort((a, b) => b.marginPercent - a.marginPercent)[0];
    const topVolumeProd = [...prodPerf.products].sort((a, b) => b.unitsSold - a.unitsSold)[0];

    insights.push({
      type: 'product',
      category: 'Product Profitability',
      title: `${topMarginProd.name} Drives Premium Margins`,
      description: `Yielding an elite ${topMarginProd.marginPercent}% gross margin with unit cost of ₹${topMarginProd.unitCost}, outperforming portfolio average.`,
      sentiment: 'positive',
      metric: `${topMarginProd.marginPercent}% Margin`
    });

    if (topVolumeProd.id !== topMarginProd.id) {
      insights.push({
        type: 'volume',
        category: 'Sales Volume',
        title: `${topVolumeProd.name} Leads Ritual Adoptions`,
        description: `Highest volume mover with ${topVolumeProd.unitsSold} units placed, contributing ${topVolumeProd.revenueContribution}% of total brand catalog sales.`,
        sentiment: 'neutral',
        metric: `${topVolumeProd.unitsSold} Units`
      });
    }
  }

  // Insight 3: Inventory Runway & Reorder Urgency
  if (invData.lowStockAlerts && invData.lowStockAlerts.length > 0) {
    const mostCritical = invData.lowStockAlerts[0];
    insights.push({
      type: 'inventory_alert',
      category: 'Inventory Intelligence',
      title: `Low Stock Advisory: ${mostCritical.name}`,
      description: `Current stock of ${mostCritical.stock} units is at or below reorder threshold (${mostCritical.threshold}). Initiate supplier batch replenishment to prevent stockouts.`,
      sentiment: 'negative',
      metric: `${mostCritical.stock} Units Left`
    });
  } else {
    insights.push({
      type: 'inventory_healthy',
      category: 'Inventory Intelligence',
      title: 'Balanced Stock Distribution',
      description: `All botanical formulations are operating above their minimum reorder safety thresholds across fulfillment centers.`,
      sentiment: 'positive',
      metric: `${invData.totalUnits} Units`
    });
  }

  // Insight 4: Customer Retention & Repeat Purchase Power
  insights.push({
    type: 'customer_loyalty',
    category: 'Customer Retention',
    title: `${custPerf.repeatPurchaseRate}% Repeat Patronage Rate`,
    description: `High repeat frequency reflects strong customer ritual affinity. Champions and Loyal customer cohorts comprise ${custPerf.rfmSegments.champions + custPerf.rfmSegments.loyal} high-value profiles.`,
    sentiment: 'positive',
    metric: `${custPerf.repeatPurchaseRate}% Repeat Rate`
  });

  return {
    generatedAt: new Date(),
    period: query.period || '30d',
    totalInsightsCount: insights.length,
    insights
  };
};

module.exports = {
  getDateRangeBoundaries,
  getOrderFilter,
  calculateOrderMetrics,
  calculateProductPerformanceData,
  computeRfmAnalysis,
  buildContinuousMonthlySeries,
  calculateSalesForecastProjection,
  calculateInventoryIntelligenceMetrics,
  getExecutiveOverview,
  getSalesAnalytics,
  getProductPerformance,
  getFinancials,
  getInventoryAnalytics,
  getInventoryIntelligence,
  getCustomerAnalytics,
  getSalesForecast,
  getAutomatedBusinessInsights
};

