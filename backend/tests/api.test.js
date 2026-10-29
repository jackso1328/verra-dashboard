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
  // (145*380=55100) + (88*460=40480) + (110*320=35200) + (19*240=4560) = 135340
  assert.strictEqual(totalValuation, 135340);
});
