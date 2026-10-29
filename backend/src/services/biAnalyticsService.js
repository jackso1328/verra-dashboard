const Order = require('../models/Order');
const Product = require('../models/Product');
const Expense = require('../models/Expense');
const InventoryMovement = require('../models/InventoryMovement');
const User = require('../models/User');

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

const mongoose = require('mongoose');

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

  // Aggregate metrics for a collection of orders
  const calculateMetrics = (orders, expenses) => {
    let grossSales = 0;
    let totalDiscounts = 0;
    let refundedAmount = 0;
    let qualifyingOrdersCount = 0;
    let refundedOrdersCount = 0;
    let unitsSold = 0;
    let totalCOGS = 0;

    orders.forEach(order => {
      if (order.orderStatus === 'refunded') {
        refundedOrdersCount++;
        refundedAmount += order.totalAmount;
      } else {
        qualifyingOrdersCount++;
        grossSales += order.grossSales;
        totalDiscounts += order.discountAmount;
        totalCOGS += order.totalCOGS;

        order.items.forEach(item => {
          if (!productId || String(item.product) === String(productId) || item.sku === productId) {
            unitsSold += item.quantity;
          }
        });
      }
    });

    const netRevenue = Math.max(0, grossSales - totalDiscounts);
    const grossProfit = netRevenue - totalCOGS;
    const grossProfitMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
    
    const operatingExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const netOperatingProfit = grossProfit - operatingExpenses;
    const averageOrderValue = qualifyingOrdersCount > 0 ? Math.round(netRevenue / qualifyingOrdersCount) : 0;
    
    const totalPlaced = orders.length;
    const refundRate = totalPlaced > 0 ? (refundedOrdersCount / totalPlaced) * 100 : 0;

    return {
      grossSales,
      netRevenue,
      totalOrders: qualifyingOrdersCount,
      unitsSold,
      cogs: totalCOGS,
      grossProfit,
      grossProfitMargin: parseFloat(grossProfitMargin.toFixed(1)),
      operatingExpenses,
      netOperatingProfit,
      averageOrderValue,
      refundRate: parseFloat(refundRate.toFixed(1))
    };
  };

  const currentMetrics = calculateMetrics(currentOrders, currentExpenses);
  const prevMetrics = calculateMetrics(prevOrders, prevExpenses);

  // Inventory valuation: sum of (current stock * unit cost)
  const inventoryValuation = allProducts.reduce((sum, prod) => sum + (prod.stockQuantity * prod.unitCost), 0);
  const totalStockUnits = allProducts.reduce((sum, prod) => sum + prod.stockQuantity, 0);

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

  // Group by date bucket (daily for <=30d, weekly for <=90d, monthly for 12m)
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
    const net = order.grossSales - order.discountAmount;
    row.revenue += net;
    row.grossSales += order.grossSales;
    row.cogs += order.totalCOGS;
    row.profit += (net - order.totalCOGS);
    row.orders += 1;
    row.units += order.items.reduce((s, i) => s + i.quantity, 0);
  });

  const timeline = Array.from(timeSeriesMap.values());

  // Aggregate by Sales Channel
  const channelMap = {};
  const regionMap = {};

  orders.forEach(order => {
    const ch = order.salesChannel || 'Storefront Online';
    const reg = order.region || 'South India';
    const net = order.grossSales - order.discountAmount;

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

  const productStats = {};
  products.forEach(p => {
    productStats[String(p._id)] = {
      id: p._id,
      name: p.name,
      sku: p.sku,
      sizeMl: p.sizeMl,
      image: p.image,
      currentPrice: p.price,
      currentStock: p.stockQuantity,
      unitsSold: 0,
      grossSales: 0,
      cogs: 0,
      grossProfit: 0,
      marginPercent: 0,
      revenueContribution: 0
    };
  });

  let totalBrandNetRevenue = 0;

  orders.forEach(order => {
    order.items.forEach(item => {
      const pId = String(item.product);
      if (productStats[pId]) {
        const itemGross = item.unitPrice * item.quantity;
        const itemCost = item.unitCost * item.quantity;
        const itemProfit = itemGross - itemCost;

        productStats[pId].unitsSold += item.quantity;
        productStats[pId].grossSales += itemGross;
        productStats[pId].cogs += itemCost;
        productStats[pId].grossProfit += itemProfit;
        totalBrandNetRevenue += itemGross;
      }
    });
  });

  // Calculate margin % and contribution %
  const performanceList = Object.values(productStats).map(p => {
    const margin = p.grossSales > 0 ? (p.grossProfit / p.grossSales) * 100 : 0;
    const contribution = totalBrandNetRevenue > 0 ? (p.grossSales / totalBrandNetRevenue) * 100 : 0;
    const asp = p.unitsSold > 0 ? Math.round(p.grossSales / p.unitsSold) : p.currentPrice;

    return {
      ...p,
      marginPercent: parseFloat(margin.toFixed(1)),
      revenueContribution: parseFloat(contribution.toFixed(1)),
      averageSellingPrice: asp
    };
  });

  // Sort by revenue descending
  performanceList.sort((a, b) => b.grossSales - a.grossSales);

  return {
    period,
    totalBrandRevenue: totalBrandNetRevenue,
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

  // Breakdown expenses by category
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
      grossRevenue,
      discounts,
      netRevenue,
      cogs: totalCOGS,
      grossProfit,
      grossMargin: parseFloat(grossMargin.toFixed(1)),
      totalOperatingExpenses: totalExpenses,
      expenseBreakdown,
      netOperatingProfit,
      operatingMargin: parseFloat(operatingMargin.toFixed(1))
    },
    recentExpenses: expenses.slice(0, 10)
  };
};

/**
 * 5. Inventory Analytics
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
 * 6. Customer Analytics & RFM Segmentation
 */
const getCustomerAnalytics = async () => {
  const customers = await User.find({ role: 'customer' }).sort({ createdAt: -1 });
  const orders = await Order.find({ orderStatus: { $ne: 'cancelled' } });

  const totalRegistered = customers.length;
  const customerOrderMap = {};

  orders.forEach(o => {
    const cId = String(o.customer || o.customerInfo.email);
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
    customerOrderMap[cId].totalSpent += o.totalAmount;
    if (new Date(o.orderDate) > new Date(customerOrderMap[cId].lastOrderDate)) {
      customerOrderMap[cId].lastOrderDate = o.orderDate;
    }
  });

  const customerList = Object.values(customerOrderMap);
  const repeatBuyers = customerList.filter(c => c.orderCount > 1);
  const singleBuyers = customerList.filter(c => c.orderCount === 1);
  const repeatPurchaseRate = customerList.length > 0 ? (repeatBuyers.length / customerList.length) * 100 : 0;

  // RFM Segments: Champions, Loyal, Potential, At Risk
  const rfmSegments = {
    champions: 0,
    loyal: 0,
    potential: 0,
    newCustomers: 0
  };

  customerList.forEach(c => {
    if (c.orderCount >= 3 && c.totalSpent > 4000) {
      rfmSegments.champions++;
    } else if (c.orderCount >= 2) {
      rfmSegments.loyal++;
    } else if (c.totalSpent > 1500) {
      rfmSegments.potential++;
    } else {
      rfmSegments.newCustomers++;
    }
  });

  return {
    totalRegistered,
    activeBuyersCount: customerList.length,
    newVsReturning: {
      newCustomers: singleBuyers.length,
      returningCustomers: repeatBuyers.length
    },
    repeatPurchaseRate: parseFloat(repeatPurchaseRate.toFixed(1)),
    rfmSegments,
    topCustomers: customerList.sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10)
  };
};

/**
 * 7. Transparent & Explainable Sales Forecasting
 * Method: 3-month moving average coupled with monthly linear slope trend
 */
const getSalesForecast = async (query = {}) => {
  // Fetch up to 12 months of qualifying historical orders
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const now = new Date();

  const orders = await Order.find({
    orderDate: { $gte: oneYearAgo, $lte: now },
    orderStatus: { $nin: ['cancelled', 'pending', 'refunded'] }
  }).sort({ orderDate: 1 });

  // Group by month
  const monthlyMap = new Map();
  orders.forEach(o => {
    const d = new Date(o.orderDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, { key, label, revenue: 0, orders: 0, units: 0 });
    }
    const row = monthlyMap.get(key);
    const net = o.grossSales - o.discountAmount;
    row.revenue += net;
    row.orders += 1;
    row.units += o.items.reduce((s, i) => s + i.quantity, 0);
  });

  const historical = Array.from(monthlyMap.values());

  // If insufficient history, provide fallback baseline
  if (historical.length < 2) {
    return {
      methodology: 'Baseline projection: Insufficient historical periods recorded.',
      historical,
      forecast: []
    };
  }

  // Calculate simple linear regression slope (y = mx + b)
  const n = historical.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  historical.forEach((pt, idx) => {
    const x = idx + 1;
    const y = pt.revenue;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // 3-month rolling weighted average
  const last3 = historical.slice(-3);
  const rollingAvg = last3.reduce((s, r) => s + r.revenue, 0) / last3.length;

  // Project next 3 future months
  const forecast = [];
  const lastDate = new Date(now);

  for (let step = 1; step <= 3; step++) {
    const futureDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + step, 1);
    const label = futureDate.toLocaleString('en-US', { month: 'short', year: 'numeric' }) + ' (Forecast)';
    const x = n + step;
    
    // Blend 60% linear trend with 40% recent rolling moving average for realistic stability
    const linearEstimate = Math.max(0, slope * x + intercept);
    const blendedEstimate = Math.round((linearEstimate * 0.6) + (rollingAvg * 0.4));

    // Confidence bounds (+/- 7.5%)
    const lowerBound = Math.round(blendedEstimate * 0.925);
    const upperBound = Math.round(blendedEstimate * 1.075);

    forecast.push({
      step,
      label,
      predictedRevenue: blendedEstimate,
      lowerBound,
      upperBound,
      growthRatePercent: parseFloat((((blendedEstimate - historical[historical.length - 1].revenue) / (historical[historical.length - 1].revenue || 1)) * 100).toFixed(1))
    });
  }

  return {
    methodology: 'Blended 60/40 Linear Monthly Trend Slope & 3-Month Rolling Weighted Moving Average with ±7.5% Confidence Interval.',
    historicalActualsCount: historical.length,
    historical,
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
 * 8. Dynamic Data-Driven Business Insights Generator
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
      description: `Yielding an elite ${topMarginProd.marginPercent}% gross margin with unit cost of ₹${topMarginProd.currentPrice - Math.round(topMarginProd.grossProfit / (topMarginProd.unitsSold || 1))}, outperforming portfolio average.`,
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

/**
 * 9. Upgraded Inventory Intelligence with Stock Runway & Turnover
 */
const getInventoryIntelligence = async () => {
  const baseData = await getInventoryAnalytics();
  
  // Calculate past 30-day sales velocity per product
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const pastOrders = await Order.find({
    orderDate: { $gte: thirtyDaysAgo },
    orderStatus: { $nin: ['cancelled', 'pending', 'refunded'] }
  });

  const salesVelocityMap = {};
  baseData.products.forEach(p => {
    salesVelocityMap[String(p._id)] = 0;
  });

  pastOrders.forEach(o => {
    o.items.forEach(item => {
      const pId = String(item.product);
      if (salesVelocityMap[pId] !== undefined) {
        salesVelocityMap[pId] += item.quantity;
      }
    });
  });

  let totalPastMonthCOGS = 0;

  const enrichedProducts = baseData.products.map(p => {
    const unitsSold30d = salesVelocityMap[String(p._id)] || 0;
    const dailyRunRate = parseFloat((unitsSold30d / 30).toFixed(2));
    const estimatedDaysRemaining = dailyRunRate > 0 ? Math.round(p.stockQuantity / dailyRunRate) : 999;
    const itemCOGS30d = unitsSold30d * p.unitCost;
    totalPastMonthCOGS += itemCOGS30d;

    let restockPriority = 'Healthy';
    if (p.stockQuantity === 0) restockPriority = 'Immediate Stockout';
    else if (estimatedDaysRemaining <= 15 || p.stockQuantity <= 20) restockPriority = 'High Priority';
    else if (estimatedDaysRemaining <= 30 || p.stockQuantity <= p.reorderThreshold) restockPriority = 'Medium Reorder';

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
      restockPriority,
      valuation: p.stockQuantity * p.unitCost
    };
  });

  // Annualized Inventory Turnover = (Past Month COGS * 12) / Total Stock Valuation
  const annualizedTurnover = baseData.totalStockValuation > 0
    ? parseFloat(((totalPastMonthCOGS * 12) / baseData.totalStockValuation).toFixed(2))
    : 0;

  return {
    ...baseData,
    products: enrichedProducts,
    inventoryTurnoverRatio: annualizedTurnover,
    lowStockRecommendations: enrichedProducts
      .filter(p => p.restockPriority !== 'Healthy')
      .sort((a, b) => a.estimatedDaysRemaining - b.estimatedDaysRemaining)
  };
};

module.exports = {
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
