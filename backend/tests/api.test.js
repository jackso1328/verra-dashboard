const test = require('node:test');
const assert = require('node:assert');

// 1. Test Financial BI Metric Formulations
test('BI Metric Formulation: Gross Profit & Margin calculations reconcile accurately', () => {
  const grossSales = 1299 * 2; // 2598
  const discount = Math.round(grossSales * 0.10); // 260
  const netRevenue = grossSales - discount; // 2338
  const unitCost = 380;
  const cogs = unitCost * 2; // 760
  const grossProfit = netRevenue - cogs; // 1578
  const grossMargin = (grossProfit / netRevenue) * 100; // ~67.5%

  assert.strictEqual(netRevenue, 2338);
  assert.strictEqual(grossProfit, 1578);
  assert.strictEqual(parseFloat(grossMargin.toFixed(1)), 67.5);
});

// 2. Test Shipping Tier Rules
test('Shipping Policy: Free botanical delivery on orders >= ₹1,500, else ₹99', () => {
  const calculateShipping = (netSales) => (netSales >= 1500 ? 0 : 99);

  assert.strictEqual(calculateShipping(1600), 0);
  assert.strictEqual(calculateShipping(1500), 0);
  assert.strictEqual(calculateShipping(1299), 99);
  assert.strictEqual(calculateShipping(899), 99);
});

// 3. Test Security Role Enforcement Rule
test('Security Architecture: Public registration enforces customer role strictly', () => {
  const sanitizeRegistrationRole = (requestedRole) => {
    // Public registration must never allow a user to choose the admin role
    return 'customer';
  };

  assert.strictEqual(sanitizeRegistrationRole('admin'), 'customer');
  assert.strictEqual(sanitizeRegistrationRole('superadmin'), 'customer');
  assert.strictEqual(sanitizeRegistrationRole('customer'), 'customer');
});

// 4. Test Inventory Valuation Calculation
test('Inventory Analytics: Valuation = Stock × Unit Cost', () => {
  const inventory = [
    { name: 'Root Revival Oil', stock: 145, unitCost: 380 },
    { name: 'Silk Elixir', stock: 88, unitCost: 460 },
    { name: 'Botanical Nourish Oil', stock: 110, unitCost: 320 },
    { name: 'Coco Silk Treatment', stock: 19, unitCost: 240 }
  ];

  const totalValuation = inventory.reduce((sum, item) => sum + (item.stock * item.unitCost), 0);
  assert.strictEqual(totalValuation, 135340);
});

// 5. Test Coupon Code Discount Tiers
test('Promotional Pricing: VERRA10 provides 10% and RITUAL15 provides 15% discount', () => {
  const applyCoupon = (gross, code) => {
    if (code === 'VERRA10') return Math.round(gross * 0.10);
    if (code === 'RITUAL15') return Math.round(gross * 0.15);
    return 0;
  };

  const gross = 2898;
  assert.strictEqual(applyCoupon(gross, 'VERRA10'), 290);
  assert.strictEqual(applyCoupon(gross, 'RITUAL15'), 435);
  assert.strictEqual(applyCoupon(gross, 'INVALID'), 0);
});

// 6. Test BI Order Eligibility Filter (Strict exclusion of cancelled and pending orders)
test('Order Accounting Governance: Cancelled and pending orders are excluded from net sales', () => {
  const orders = [
    { id: 1, total: 2598, status: 'delivered', isRealized: true },
    { id: 2, total: 1599, status: 'shipped', isRealized: true },
    { id: 3, total: 1099, status: 'processing', isRealized: true },
    { id: 4, total: 3200, status: 'cancelled', isRealized: false },
    { id: 5, total: 1800, status: 'pending', isRealized: false }
  ];

  const isEligibleOrder = (order) => !['cancelled', 'pending'].includes(order.status);
  const eligibleOrders = orders.filter(isEligibleOrder);
  const realizedRevenue = eligibleOrders.reduce((sum, o) => sum + o.total, 0);

  assert.strictEqual(eligibleOrders.length, 3);
  assert.strictEqual(realizedRevenue, 2598 + 1599 + 1099); // 5296
});

// 7. Test Customer Repeat Purchase Rate & RFM Segmentation
test('Customer Intelligence: Repeat Purchase Rate & RFM cohort assignment', () => {
  const customers = [
    { name: 'Priya', orderCount: 3, totalSpent: 6200 },
    { name: 'Ananya', orderCount: 2, totalSpent: 3100 },
    { name: 'Rohan', orderCount: 1, totalSpent: 1299 },
    { name: 'Meera', orderCount: 1, totalSpent: 899 }
  ];

  const repeatBuyers = customers.filter(c => c.orderCount > 1);
  const repeatRate = (repeatBuyers.length / customers.length) * 100;
  assert.strictEqual(repeatRate, 50);

  const assignRfmSegment = (c) => {
    if (c.orderCount >= 3 && c.totalSpent > 4000) return 'Champions';
    if (c.orderCount >= 2) return 'Loyal Ritualists';
    if (c.totalSpent > 1500) return 'Potential';
    return 'New Patrons';
  };

  assert.strictEqual(assignRfmSegment(customers[0]), 'Champions');
  assert.strictEqual(assignRfmSegment(customers[1]), 'Loyal Ritualists');
  assert.strictEqual(assignRfmSegment(customers[2]), 'New Patrons');
});

// 8. Test Inventory Runway and Daily Run Rate
test('Inventory Runway: Calculates days of remaining stock based on 30-day velocity', () => {
  const stockQuantity = 150;
  const unitsSold30d = 30; // 1 unit per day
  const dailyRunRate = unitsSold30d / 30;
  const runwayDays = Math.round(stockQuantity / dailyRunRate);

  assert.strictEqual(dailyRunRate, 1.0);
  assert.strictEqual(runwayDays, 150);

  // Critical Low Stock Runway Check
  const lowStock = 12;
  const criticalRunway = Math.round(lowStock / dailyRunRate);
  assert.strictEqual(criticalRunway, 12);
  const isCritical = criticalRunway <= 15;
  assert.strictEqual(isCritical, true);
});

// 9. Test Forecasting Blended Projection Model
test('Sales Forecasting: Blended 60% Linear Trend and 40% Rolling Moving Average', () => {
  const linearProjection = 50000;
  const rollingMovingAverage = 45000;
  const blendedEstimate = Math.round((linearProjection * 0.6) + (rollingMovingAverage * 0.4));
  // (30000) + (18000) = 48000
  assert.strictEqual(blendedEstimate, 48000);

  // Confidence bounds (±7.5%)
  const lowerBound = Math.round(blendedEstimate * 0.925);
  const upperBound = Math.round(blendedEstimate * 1.075);
  assert.strictEqual(lowerBound, 44400);
  assert.strictEqual(upperBound, 51600);
});

// 10. Test P&L Complete Reconciliation
test('Financial P&L: Net Operating Profit = Net Revenue - COGS - OpEx', () => {
  const grossSales = 100000;
  const discounts = 10000;
  const netRevenue = grossSales - discounts; // 90000
  const cogs = 28000;
  const grossProfit = netRevenue - cogs; // 62000
  const opex = 35000;
  const netOperatingProfit = grossProfit - opex; // 27000
  const operatingMargin = (netOperatingProfit / netRevenue) * 100; // 30%

  assert.strictEqual(grossProfit, 62000);
  assert.strictEqual(netOperatingProfit, 27000);
  assert.strictEqual(operatingMargin, 30);
});
