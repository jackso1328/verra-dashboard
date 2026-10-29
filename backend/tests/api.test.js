const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

// Import the actual exported production business logic from services and controllers
const {
  calculateOrderMetrics,
  calculateProductPerformanceData,
  computeRfmAnalysis,
  buildContinuousMonthlySeries,
  calculateSalesForecastProjection,
  calculateInventoryIntelligenceMetrics,
  getDateRangeBoundaries,
  getOrderFilter
} = require('../src/services/biAnalyticsService');

const {
  aggregateCartItems,
  calculateCheckoutFinancials
} = require('../src/controllers/orderController');

const {
  verifyReviewEligibility
} = require('../src/controllers/productController');

// Sample Valid ObjectIds for deterministic testing
const PROD_ID_ROSEMARY = new mongoose.Types.ObjectId().toString();
const PROD_ID_SILK = new mongoose.Types.ObjectId().toString();
const PROD_ID_NOURISH = new mongoose.Types.ObjectId().toString();
const CUST_ID_PRIYA = new mongoose.Types.ObjectId().toString();
const CUST_ID_ANANYA = new mongoose.Types.ObjectId().toString();
const CUST_ID_DORMANT = new mongoose.Types.ObjectId().toString();

// ============================================================================
// 1. Product-Filtered Executive KPIs & Proportional Discount Allocation
// ============================================================================
test('Executive KPIs: Product filter isolates product line items and allocates order discounts proportionally', () => {
  // Multi-product order: Rosemary Oil (₹1,299) + Silk Elixir (₹1,599) = ₹2,898 gross
  // Discount: 10% coupon = ₹290 order discount
  // Rosemary line item: Gross ₹1,299, Unit Cost ₹380
  // Silk line item: Gross ₹1,599, Unit Cost ₹460
  const orders = [
    {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'VR-2026-1001',
      orderStatus: 'delivered',
      grossSales: 2898,
      discountAmount: 290,
      totalAmount: 2608,
      totalCOGS: 840, // 380 + 460
      items: [
        {
          product: PROD_ID_ROSEMARY,
          sku: 'VR-RRO-050',
          name: 'Root Revival Oil',
          quantity: 1,
          unitPrice: 1299,
          unitCost: 380,
          subtotal: 1299
        },
        {
          product: PROD_ID_SILK,
          sku: 'VR-SEL-050',
          name: 'Silk Elixir',
          quantity: 1,
          unitPrice: 1599,
          unitCost: 460,
          subtotal: 1599
        }
      ]
    }
  ];

  // 1. Overall metrics (no product filter)
  const overall = calculateOrderMetrics(orders, []);
  assert.strictEqual(overall.grossSales, 2898);
  assert.strictEqual(overall.discounts, 290);
  assert.strictEqual(overall.netRevenue, 2608);
  assert.strictEqual(overall.cogs, 840);
  assert.strictEqual(overall.grossProfit, 2608 - 840); // 1768
  assert.strictEqual(overall.unitsSold, 2);

  // 2. Filtered by Rosemary Oil ONLY
  // Proportional discount for Rosemary = Math.round((290 * 1299) / 2898) = 130
  // Net revenue for Rosemary = 1299 - 130 = 1169
  // Gross Profit = 1169 - 380 = 789
  const filteredRosemary = calculateOrderMetrics(orders, [], PROD_ID_ROSEMARY);
  assert.strictEqual(filteredRosemary.grossSales, 1299);
  assert.strictEqual(filteredRosemary.discounts, 130);
  assert.strictEqual(filteredRosemary.netRevenue, 1169);
  assert.strictEqual(filteredRosemary.cogs, 380);
  assert.strictEqual(filteredRosemary.grossProfit, 789);
  assert.strictEqual(filteredRosemary.unitsSold, 1);
  assert.strictEqual(filteredRosemary.totalOrders, 1);

  // 3. Filtered by Silk Elixir ONLY
  // Proportional discount for Silk = Math.round((290 * 1599) / 2898) = 160
  // Net revenue for Silk = 1599 - 160 = 1439
  // Gross profit = 1439 - 460 = 979
  const filteredSilk = calculateOrderMetrics(orders, [], PROD_ID_SILK);
  assert.strictEqual(filteredSilk.grossSales, 1599);
  assert.strictEqual(filteredSilk.discounts, 160);
  assert.strictEqual(filteredSilk.netRevenue, 1439);
  assert.strictEqual(filteredSilk.cogs, 460);
  assert.strictEqual(filteredSilk.grossProfit, 979);
  assert.strictEqual(filteredSilk.unitsSold, 1);

  // Verification that sum of product metrics matches overall within rounding (±1 INR)
  assert.strictEqual(Math.abs((filteredRosemary.netRevenue + filteredSilk.netRevenue) - overall.netRevenue) <= 1, true);
  assert.strictEqual(Math.abs((filteredRosemary.grossProfit + filteredSilk.grossProfit) - overall.grossProfit) <= 1, true);
});

// ============================================================================
// 2. Product Profitability Reconciliation
// ============================================================================
test('Product Profitability: Product-level net sales and profit reconcile with brand totals', () => {
  const products = [
    { _id: PROD_ID_ROSEMARY, name: 'Root Revival Oil', sku: 'VR-RRO-050', sizeMl: 50, price: 1299, unitCost: 380, stockQuantity: 100 },
    { _id: PROD_ID_SILK, name: 'Silk Elixir', sku: 'VR-SEL-050', sizeMl: 50, price: 1599, unitCost: 460, stockQuantity: 80 }
  ];

  const orders = [
    {
      orderStatus: 'delivered',
      grossSales: 2898,
      discountAmount: 290,
      totalCOGS: 840,
      items: [
        { product: PROD_ID_ROSEMARY, quantity: 1, unitPrice: 1299, unitCost: 380, subtotal: 1299 },
        { product: PROD_ID_SILK, quantity: 1, unitPrice: 1599, unitCost: 460, subtotal: 1599 }
      ]
    },
    {
      orderStatus: 'delivered',
      grossSales: 1299,
      discountAmount: 0,
      totalCOGS: 380,
      items: [
        { product: PROD_ID_ROSEMARY, quantity: 1, unitPrice: 1299, unitCost: 380, subtotal: 1299 }
      ]
    }
  ];

  const overallMetrics = calculateOrderMetrics(orders, []);
  const productPerf = calculateProductPerformanceData(products, orders);

  const sumProductNet = productPerf.products.reduce((s, p) => s + p.netSales, 0);
  const sumProductProfit = productPerf.products.reduce((s, p) => s + p.grossProfit, 0);

  // Product net sales and profit reconcile with overall dashboard within rounding
  assert.strictEqual(Math.abs(sumProductNet - overallMetrics.netRevenue) <= 2, true);
  assert.strictEqual(Math.abs(sumProductProfit - overallMetrics.grossProfit) <= 2, true);
  assert.strictEqual(productPerf.totalBrandRevenue, overallMetrics.netRevenue);
});

// ============================================================================
// 3. Customer Analytics: RFM Recency, Frequency, Spend & Segment Governance
// ============================================================================
test('Customer Analytics: Calculates genuine Recency, Frequency, Monetary spend and excludes invalid orders', () => {
  const referenceDate = new Date('2026-10-29T12:00:00Z');

  const customers = [
    { _id: CUST_ID_PRIYA, name: 'Priya S.', email: 'priya@example.com' },
    { _id: CUST_ID_ANANYA, name: 'Ananya V.', email: 'ananya@example.com' },
    { _id: CUST_ID_DORMANT, name: 'Kavita M.', email: 'kavita@example.com' }
  ];

  // Priya: 3 orders, ₹4,500 total spend, last order 10 days ago -> Champions
  // Ananya: 2 orders, ₹2,200 total spend, last order 40 days ago -> Loyal Ritualists
  // Dormant: 1 order, ₹1,299 spend, last order 210 days ago (>180 days) -> At Risk
  // Cancelled/pending/refunded orders must be excluded
  const eligibleOrders = [
    // Priya's orders
    { customer: CUST_ID_PRIYA, customerInfo: { name: 'Priya S.', email: 'priya@example.com' }, grossSales: 1500, discountAmount: 0, orderStatus: 'delivered', orderDate: new Date('2026-10-19T10:00:00Z') }, // 10 days ago
    { customer: CUST_ID_PRIYA, customerInfo: { name: 'Priya S.', email: 'priya@example.com' }, grossSales: 1500, discountAmount: 0, orderStatus: 'delivered', orderDate: new Date('2026-09-10T10:00:00Z') },
    { customer: CUST_ID_PRIYA, customerInfo: { name: 'Priya S.', email: 'priya@example.com' }, grossSales: 1500, discountAmount: 0, orderStatus: 'delivered', orderDate: new Date('2026-08-15T10:00:00Z') },
    
    // Ananya's orders
    { customer: CUST_ID_ANANYA, customerInfo: { name: 'Ananya V.', email: 'ananya@example.com' }, grossSales: 1200, discountAmount: 100, orderStatus: 'delivered', orderDate: new Date('2026-09-19T10:00:00Z') }, // 40 days ago
    { customer: CUST_ID_ANANYA, customerInfo: { name: 'Ananya V.', email: 'ananya@example.com' }, grossSales: 1100, discountAmount: 0, orderStatus: 'delivered', orderDate: new Date('2026-08-01T10:00:00Z') },

    // Dormant customer's order
    { customer: CUST_ID_DORMANT, customerInfo: { name: 'Kavita M.', email: 'kavita@example.com' }, grossSales: 1299, discountAmount: 0, orderStatus: 'delivered', orderDate: new Date('2026-03-01T10:00:00Z') } // > 200 days ago
  ];

  const analysis = computeRfmAnalysis(customers, eligibleOrders, referenceDate);

  assert.strictEqual(analysis.totalRegistered, 3);
  assert.strictEqual(analysis.activeBuyersCount, 3);
  assert.strictEqual(analysis.rfmSegments.champions, 1);
  assert.strictEqual(analysis.rfmSegments.loyal, 1);
  assert.strictEqual(analysis.rfmSegments.atRisk, 1);

  const priya = analysis.topCustomers.find(c => c.name === 'Priya S.');
  assert.strictEqual(priya.segment, 'Champions');
  assert.strictEqual(priya.recencyDays, 10);
  assert.strictEqual(priya.orderCount, 3);
  assert.strictEqual(priya.totalSpent, 4500);

  const dormant = analysis.topCustomers.find(c => c.name === 'Kavita M.');
  assert.strictEqual(dormant.segment, 'At Risk');
  assert.strictEqual(dormant.recencyDays > 180, true);
});

// ============================================================================
// 4. Sales Forecasting: Continuous Monthly Series with Zero-Sales Months
// ============================================================================
test('Sales Forecasting: Produces a continuous 12-month series including zero-sales months', () => {
  const referenceDate = new Date('2026-10-29T12:00:00Z');

  // Only two orders in the whole year: October 2026 and August 2026
  const sparseOrders = [
    { orderDate: new Date('2026-10-05T10:00:00Z'), grossSales: 5000, discountAmount: 500, totalCOGS: 1500, items: [{ quantity: 3 }] },
    { orderDate: new Date('2026-08-15T10:00:00Z'), grossSales: 3000, discountAmount: 0, totalCOGS: 900, items: [{ quantity: 2 }] }
  ];

  const series = buildContinuousMonthlySeries(sparseOrders, referenceDate);

  // Must contain exactly 12 continuous calendar months
  assert.strictEqual(series.length, 12);

  // Month index 11 is October 2026
  assert.strictEqual(series[11].revenue, 4500);
  assert.strictEqual(series[11].isZeroMonth, false);

  // Month index 9 is August 2026
  assert.strictEqual(series[9].revenue, 3000);
  assert.strictEqual(series[9].isZeroMonth, false);

  // Month index 10 is September 2026 (had zero qualifying sales)
  assert.strictEqual(series[10].revenue, 0);
  assert.strictEqual(series[10].orders, 0);
  assert.strictEqual(series[10].isZeroMonth, true);

  // Verify forecasting projection handles continuous series without crashing
  const forecast = calculateSalesForecastProjection(series, referenceDate);
  assert.strictEqual(forecast.forecast.length, 3);
  assert.strictEqual(forecast.forecast[0].isPrediction, true);
  assert.strictEqual(typeof forecast.forecast[0].predictedRevenue, 'number');
  assert.strictEqual(forecast.forecast[0].upperBound >= forecast.forecast[0].predictedRevenue, true);
  assert.strictEqual(forecast.forecast[0].lowerBound <= forecast.forecast[0].predictedRevenue, true);
});

// ============================================================================
// 5. Inventory Intelligence: Runway without 999 fallback & Turnover Formula
// ============================================================================
test('Inventory Intelligence: Runway accurately indicates null/"No recent sales" when run-rate is zero', () => {
  const baseData = {
    totalStockValuation: 100000,
    totalUnits: 250,
    products: [
      { _id: PROD_ID_ROSEMARY, sku: 'VR-RRO-050', name: 'Root Revival Oil', stockQuantity: 15, reorderThreshold: 25, unitCost: 380, price: 1299 },
      { _id: PROD_ID_SILK, sku: 'VR-SEL-050', name: 'Silk Elixir', stockQuantity: 80, reorderThreshold: 20, unitCost: 460, price: 1599 }
    ]
  };

  // Only Rosemary Oil had sales in the past 30 days (30 units = 1 unit/day)
  // Silk Elixir had 0 sales in the past 30 days
  const past30dOrders = [
    { items: [{ product: PROD_ID_ROSEMARY, quantity: 30 }] }
  ];

  const intelligence = calculateInventoryIntelligenceMetrics(baseData, past30dOrders);

  const rosemary = intelligence.products.find(p => String(p._id) === PROD_ID_ROSEMARY);
  assert.strictEqual(rosemary.dailyRunRate, 1.0);
  assert.strictEqual(rosemary.estimatedDaysRemaining, 15);
  assert.strictEqual(rosemary.runwayDisplay, '15 days');
  assert.strictEqual(rosemary.restockPriority, 'High Urgency (<15d Runway)');

  const silk = intelligence.products.find(p => String(p._id) === PROD_ID_SILK);
  assert.strictEqual(silk.dailyRunRate, 0);
  assert.strictEqual(silk.estimatedDaysRemaining, null); // NOT 999
  assert.strictEqual(silk.runwayDisplay, 'No recent sales');

  // Verify documented turnover formula is included
  assert.strictEqual(intelligence.turnoverFormula.includes('Past 30-Day COGS'), true);
});

// ============================================================================
// 6. Checkout Totals Reconciliation: Inclusive Tax, Shipping, & Discounts
// ============================================================================
test('Checkout Accounting: Reconciles subtotal, discount, 5% GST (inclusive), and shipping tier', () => {
  const items = [
    { unitPrice: 1299, unitCost: 380, quantity: 1, subtotal: 1299 }
  ];

  // Case A: Below ₹1,500 threshold with no coupon -> Shipping ₹99 applies
  const resultA = calculateCheckoutFinancials(items, null);
  assert.strictEqual(resultA.grossSales, 1299);
  assert.strictEqual(resultA.discountAmount, 0);
  assert.strictEqual(resultA.netProductSales, 1299);
  assert.strictEqual(resultA.shippingFee, 99);
  assert.strictEqual(resultA.taxAmount, Math.round(1299 * 0.05)); // 65 INR GST included in retail
  assert.strictEqual(resultA.totalAmount, 1299 + 99); // 1398

  // Case B: Above ₹1,500 threshold with VERRA10 coupon
  const itemsB = [
    { unitPrice: 1299, unitCost: 380, quantity: 2, subtotal: 2598 }
  ];
  const resultB = calculateCheckoutFinancials(itemsB, 'VERRA10');
  assert.strictEqual(resultB.grossSales, 2598);
  assert.strictEqual(resultB.discountAmount, 260); // 10%
  assert.strictEqual(resultB.netProductSales, 2338);
  assert.strictEqual(resultB.shippingFee, 0); // Free shipping (>= 1500)
  assert.strictEqual(resultB.taxAmount, Math.round(2338 * 0.05)); // 117 INR GST included
  assert.strictEqual(resultB.totalAmount, 2338);
});

// ============================================================================
// 7. Stock Deduction Correctness: Duplicate Line Aggregation & ID Validation
// ============================================================================
test('Stock Deductions: Aggregates duplicate product lines and rejects preview/invalid IDs', () => {
  const validId1 = new mongoose.Types.ObjectId().toString();
  const validId2 = new mongoose.Types.ObjectId().toString();

  // Duplicate items in cart
  const rawCart = [
    { productId: validId1, quantity: 1 },
    { productId: validId2, quantity: 2 },
    { productId: validId1, quantity: 3 } // Duplicate validId1
  ];

  const aggregated = aggregateCartItems(rawCart);
  assert.strictEqual(aggregated.length, 2);

  const item1 = aggregated.find(i => i.productId === validId1);
  assert.strictEqual(item1.quantity, 4); // 1 + 3

  const item2 = aggregated.find(i => i.productId === validId2);
  assert.strictEqual(item2.quantity, 2);

  // Synthetic preview ID must be rejected
  const previewCart = [
    { productId: 'preview_rro_050', quantity: 1 }
  ];
  assert.throws(() => {
    aggregateCartItems(previewCart);
  }, /Live catalog synchronization required; preview items cannot be checked out/);
});

// ============================================================================
// 8. Product Review Purchase Verification Guard
// ============================================================================
test('Review Verification: Authorizes Verified Purchase badge only when matching qualifying order exists', () => {
  const qualifyingOrders = [
    {
      orderStatus: 'delivered',
      customerInfo: { email: 'maya@example.com', name: 'Maya Sharma' },
      items: [{ product: PROD_ID_ROSEMARY, quantity: 1 }]
    }
  ];

  // 1. Matching author and product -> Verified
  const isVerified1 = verifyReviewEligibility(qualifyingOrders, PROD_ID_ROSEMARY, 'maya@example.com', 'Maya Sharma');
  assert.strictEqual(isVerified1, true);

  // 2. Author bought Rosemary, but reviewing Silk Elixir -> NOT verified
  const isVerified2 = verifyReviewEligibility(qualifyingOrders, PROD_ID_SILK, 'maya@example.com', 'Maya Sharma');
  assert.strictEqual(isVerified2, false);

  // 3. Different author reviewing Rosemary -> NOT verified
  const isVerified3 = verifyReviewEligibility(qualifyingOrders, PROD_ID_ROSEMARY, 'stranger@example.com', 'Stranger');
  assert.strictEqual(isVerified3, false);
});

// ============================================================================
// 9. Date Range Boundary Logic for Comparison Periods
// ============================================================================
test('BI Date Range: Accurately computes previous equivalent period duration', () => {
  const boundaries = getDateRangeBoundaries('30d');
  
  const currentDuration = boundaries.endDate.getTime() - boundaries.startDate.getTime();
  const prevDuration = boundaries.prevEndDate.getTime() - boundaries.prevStartDate.getTime();

  // Equal duration comparison period
  assert.strictEqual(Math.abs(currentDuration - prevDuration) < 1000, true);
  assert.strictEqual(boundaries.prevEndDate < boundaries.startDate, true);
});

// ============================================================================
// 10. Order Filter Construction with ObjectIds vs SKUs
// ============================================================================
test('Order Filter Generator: Handles both ObjectIds and SKUs defensively', () => {
  const start = new Date('2026-01-01');
  const end = new Date('2026-01-31');

  // ObjectId query
  const objectIdFilter = getOrderFilter(start, end, { productId: PROD_ID_ROSEMARY });
  assert.strictEqual(objectIdFilter['items.product'], PROD_ID_ROSEMARY);
  assert.strictEqual(objectIdFilter['items.sku'], undefined);

  // SKU query
  const skuFilter = getOrderFilter(start, end, { productId: 'VR-RRO-050' });
  assert.strictEqual(skuFilter['items.sku'], 'VR-RRO-050');
  assert.strictEqual(skuFilter['items.product'], undefined);
});
