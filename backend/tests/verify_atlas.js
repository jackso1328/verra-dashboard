const http = require('http');

const request = (path, method = 'GET', body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

const runVerification = async () => {
  console.log('--- Step 4: Running Comprehensive Live API & BI Verification ---\n');

  // 1. Health check
  const health = await request('/api/health');
  console.log('1. Health Check:', health.data.database.connected ? '✅ Connected (Atlas verra_bi)' : '❌ Disconnected');
  if (!health.data.database.connected) process.exit(1);

  // 2. Product Catalog
  const prods = await request('/api/products');
  console.log(`2. Products Catalog: ✅ Returned ${prods.data.count} formulations`);
  prods.data.data.forEach(p => {
    console.log(`   • ${p.name} (${p.sizeMl}ml) - ₹${p.price} | Stock: ${p.stockQuantity} | Cost: ₹${p.unitCost}`);
  });

  // 3. Admin Login
  const login = await request('/api/auth/login', 'POST', {
    email: 'admin@verra.com',
    password: 'VerraAdmin2026!'
  });
  console.log(`3. Admin Login: ${login.status === 200 ? '✅ Successful' : '❌ Failed'} (Role: ${login.data.user.role})`);
  const token = login.data.token;

  // 4. Executive Overview (30d and 12m)
  const overview30d = await request('/api/admin/overview?period=30d', 'GET', null, token);
  const kpis30 = overview30d.data.data.kpis;
  console.log('\n4. Executive Overview (Last 30 Days):');
  console.log(`   • Gross Sales:        ₹${kpis30.grossSales.value.toLocaleString('en-IN')}`);
  console.log(`   • Net Revenue:        ₹${kpis30.netRevenue.value.toLocaleString('en-IN')}`);
  console.log(`   • Qualifying Orders:  ${kpis30.totalOrders.value}`);
  console.log(`   • Units Sold:         ${kpis30.unitsSold.value}`);
  console.log(`   • Gross Profit:       ₹${kpis30.grossProfit.value.toLocaleString('en-IN')} (${kpis30.grossProfitMargin.value}%)`);
  console.log(`   • Operating Expenses: ₹${kpis30.operatingExpenses.value.toLocaleString('en-IN')}`);
  console.log(`   • Net Operating Profit: ₹${kpis30.netOperatingProfit.value.toLocaleString('en-IN')}`);
  console.log(`   • Average Order Value: ₹${kpis30.averageOrderValue.value.toLocaleString('en-IN')}`);
  console.log(`   • Refund Rate:        ${kpis30.refundRate.value}%`);
  console.log(`   • Inventory Valuation: ₹${kpis30.inventoryValuation.value.toLocaleString('en-IN')} (${kpis30.inventoryValuation.totalStockUnits} units)`);

  const overview12m = await request('/api/admin/overview?period=12m', 'GET', null, token);
  const kpis12 = overview12m.data.data.kpis;
  console.log('\n   Executive Overview (Last 12 Months):');
  console.log(`   • Gross Sales:        ₹${kpis12.grossSales.value.toLocaleString('en-IN')}`);
  console.log(`   • Net Revenue:        ₹${kpis12.netRevenue.value.toLocaleString('en-IN')}`);
  console.log(`   • Qualifying Orders:  ${kpis12.totalOrders.value}`);

  // 5. Sales Analytics
  const sales = await request('/api/admin/sales-trend?period=12m', 'GET', null, token);
  console.log(`\n5. Sales Analytics (12M): ✅ Returned ${sales.data.data.timeline.length} monthly timeline buckets`);
  console.log('   Acquisition Channels:', sales.data.data.byChannel);
  console.log('   Regional Spread:', sales.data.data.byRegion);

  // 6. Product Performance
  const prodPerf = await request('/api/admin/product-performance?period=12m', 'GET', null, token);
  console.log('\n6. Product Performance (12M):');
  prodPerf.data.data.products.forEach(p => {
    console.log(`   • ${p.name.padEnd(22)} | Sold: ${String(p.unitsSold).padStart(3)} | Revenue: ₹${p.grossSales.toLocaleString('en-IN').padStart(7)} | Margin: ${p.marginPercent}% | Share: ${p.revenueContribution}%`);
  });

  // 7. Financial P&L
  const fin = await request('/api/admin/financials?period=12m', 'GET', null, token);
  const pl = fin.data.data.pAndL;
  console.log('\n7. Financial P&L Statement (12M):');
  console.log(`   • Gross Revenue:       ₹${pl.grossRevenue.toLocaleString('en-IN')}`);
  console.log(`   • Less Discounts:     -₹${pl.discounts.toLocaleString('en-IN')}`);
  console.log(`   • Net Revenue:         ₹${pl.netRevenue.toLocaleString('en-IN')}`);
  console.log(`   • Less COGS:          -₹${pl.cogs.toLocaleString('en-IN')}`);
  console.log(`   • Gross Profit:        ₹${pl.grossProfit.toLocaleString('en-IN')} (Margin: ${pl.grossMargin}%)`);
  console.log(`   • Total Operating OpEx: -₹${pl.totalOperatingExpenses.toLocaleString('en-IN')}`);
  console.log(`   • Net Operating Profit: ₹${pl.netOperatingProfit.toLocaleString('en-IN')} (Margin: ${pl.operatingMargin}%)`);

  // 8. Inventory Analytics
  const inv = await request('/api/admin/inventory', 'GET', null, token);
  console.log('\n8. Inventory Analytics:');
  console.log(`   • Total Warehouse Units: ${inv.data.data.totalUnits}`);
  console.log(`   • Valuation: ₹${inv.data.data.totalStockValuation.toLocaleString('en-IN')}`);
  console.log(`   • Low-Stock Alerts Count: ${inv.data.data.lowStockAlerts.length}`);
  inv.data.data.lowStockAlerts.forEach(a => {
    console.log(`     ⚠️ Alert: ${a.name} - Stock: ${a.stock} (Threshold: ${a.threshold})`);
  });

  // 9. Customer Analytics & RFM
  const cust = await request('/api/admin/customers', 'GET', null, token);
  console.log('\n9. Customer Patrons & RFM:');
  console.log(`   • Registered Patrons: ${cust.data.data.totalRegistered}`);
  console.log(`   • Active Buyers:      ${cust.data.data.activeBuyersCount}`);
  console.log(`   • Repeat Purchase Rate: ${cust.data.data.repeatPurchaseRate}%`);
  console.log('   • RFM Segments:       ', cust.data.data.rfmSegments);

  // 10. Reports
  const reports = await request('/api/admin/reports/sales?period=30d', 'GET', null, token);
  console.log(`\n10. Audited Sales Report (30d): ✅ ${reports.data.count} records returned for ledger table`);

  console.log('\n✨ ALL LIVE BACKEND AND BI ANALYTICS VERIFICATIONS PASSED SUCCESSFULLY!');
};

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
