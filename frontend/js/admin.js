/**
 * VÉRRA Admin Dashboard Core Logic
 */
import { api } from './api.js';
import { auth } from './auth.js';
import {
  createRevenueLineChart,
  createRevenueVsProfitBarChart,
  createDoughnutChart,
  createHorizontalBarChart
} from './charts.js';

class AdminController {
  constructor() {
    this.currentPeriod = '30d';
    this.customStart = null;
    this.customEnd = null;
    this.selectedProduct = null;
    this.selectedChannel = null;
    this.selectedRegion = null;
    this.selectedStatus = null;
    
    this.activeCharts = {};
  }

  async init(pageType = 'overview') {
    // Role & Authentication Guard
    if (!auth.requireAdmin('/login.html')) return;

    this.renderAdminProfile();
    this.checkDatabaseHealth();
    this.initFilterBar(pageType);

    if (pageType === 'overview') {
      await this.loadOverview();
    } else if (pageType === 'sales') {
      await this.loadSalesAnalytics();
    } else if (pageType === 'products') {
      await this.loadProductPerformance();
    } else if (pageType === 'finance') {
      await this.loadFinancials();
    } else if (pageType === 'inventory') {
      await this.loadInventory();
    } else if (pageType === 'customers') {
      await this.loadCustomers();
    } else if (pageType === 'reports') {
      await this.loadReports();
    }
  }

  renderAdminProfile() {
    const user = auth.getUser();
    const nameEl = document.getElementById('admin-sidebar-name');
    const avatarEl = document.getElementById('admin-sidebar-avatar');
    const logoutBtn = document.getElementById('admin-logout-btn');

    if (user) {
      if (nameEl) nameEl.textContent = user.name;
      if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        auth.logout();
      });
    }
  }

  async checkDatabaseHealth() {
    const statusPill = document.getElementById('db-status-pill');
    const statusText = document.getElementById('db-status-text');
    const statusDot = document.getElementById('db-status-dot');

    try {
      const res = await api.checkHealth();
      if (res.success && res.database && res.database.connected) {
        if (statusText) statusText.textContent = `MongoDB: ${res.database.database} (Live)`;
        if (statusDot) statusDot.className = 'db-status-dot';
      } else {
        if (statusText) statusText.textContent = 'MongoDB Atlas Disconnected';
        if (statusDot) statusDot.className = 'db-status-dot disconnected';
        this.showDatabaseNoticeBanner();
      }
    } catch (e) {
      if (statusText) statusText.textContent = 'Backend Offline';
      if (statusDot) statusDot.className = 'db-status-dot disconnected';
      this.showDatabaseNoticeBanner();
    }
  }

  showDatabaseNoticeBanner() {
    const banner = document.getElementById('db-notice-banner');
    if (banner) {
      banner.style.display = 'block';
    }
  }

  getFilterParams() {
    const params = { period: this.currentPeriod };
    if (this.currentPeriod === 'custom' && this.customStart && this.customEnd) {
      params.customStart = this.customStart;
      params.customEnd = this.customEnd;
    }
    if (this.selectedProduct) params.productId = this.selectedProduct;
    if (this.selectedChannel) params.salesChannel = this.selectedChannel;
    if (this.selectedRegion) params.region = this.selectedRegion;
    if (this.selectedStatus) params.orderStatus = this.selectedStatus;
    return params;
  }

  initFilterBar(pageType) {
    const pills = document.querySelectorAll('.filter-btn-pill');
    const customInputs = document.getElementById('custom-date-container');
    const applyCustomBtn = document.getElementById('apply-custom-btn');
    const productSelect = document.getElementById('filter-product-select');
    const channelSelect = document.getElementById('filter-channel-select');
    const regionSelect = document.getElementById('filter-region-select');

    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const period = pill.getAttribute('data-period');
        this.currentPeriod = period;

        if (period === 'custom') {
          if (customInputs) customInputs.style.display = 'flex';
        } else {
          if (customInputs) customInputs.style.display = 'none';
          this.refreshPage(pageType);
        }
      });
    });

    if (applyCustomBtn) {
      applyCustomBtn.addEventListener('click', () => {
        const start = document.getElementById('custom-start-date').value;
        const end = document.getElementById('custom-end-date').value;
        if (!start || !end) {
          alert('Please select both start and end dates.');
          return;
        }
        this.customStart = start;
        this.customEnd = end;
        this.refreshPage(pageType);
      });
    }

    if (productSelect) {
      productSelect.addEventListener('change', () => {
        this.selectedProduct = productSelect.value === 'all' ? null : productSelect.value;
        this.refreshPage(pageType);
      });
    }

    if (channelSelect) {
      channelSelect.addEventListener('change', () => {
        this.selectedChannel = channelSelect.value === 'all' ? null : channelSelect.value;
        this.refreshPage(pageType);
      });
    }

    if (regionSelect) {
      regionSelect.addEventListener('change', () => {
        this.selectedRegion = regionSelect.value === 'all' ? null : regionSelect.value;
        this.refreshPage(pageType);
      });
    }
  }

  refreshPage(pageType) {
    if (pageType === 'overview') this.loadOverview();
    else if (pageType === 'sales') this.loadSalesAnalytics();
    else if (pageType === 'products') this.loadProductPerformance();
    else if (pageType === 'finance') this.loadFinancials();
    else if (pageType === 'inventory') this.loadInventory();
    else if (pageType === 'customers') this.loadCustomers();
    else if (pageType === 'reports') this.loadReports();
  }

  destroyChart(key) {
    if (this.activeCharts[key]) {
      this.activeCharts[key].destroy();
      delete this.activeCharts[key];
    }
  }

  /**
   * 1. Overview Page Loader
   */
  async loadOverview() {
    try {
      const params = this.getFilterParams();
      const res = await api.get('admin/overview', params);

      if (res.success && res.data && res.data.kpis) {
        const { kpis } = res.data;

        // Populate 12 KPIs
        this.setKPI('gross-sales', `₹${kpis.grossSales.value.toLocaleString('en-IN')}`, kpis.grossSales.change);
        this.setKPI('net-revenue', `₹${kpis.netRevenue.value.toLocaleString('en-IN')}`, kpis.netRevenue.change);
        this.setKPI('total-orders', kpis.totalOrders.value.toLocaleString('en-IN'), kpis.totalOrders.change);
        this.setKPI('units-sold', kpis.unitsSold.value.toLocaleString('en-IN'), kpis.unitsSold.change);
        this.setKPI('cogs', `₹${kpis.cogs.value.toLocaleString('en-IN')}`, kpis.cogs.change, true);
        this.setKPI('gross-profit', `₹${kpis.grossProfit.value.toLocaleString('en-IN')}`, kpis.grossProfit.change);
        this.setKPI('gross-margin', `${kpis.grossProfitMargin.value}%`, kpis.grossProfitMargin.change);
        this.setKPI('operating-expenses', `₹${kpis.operatingExpenses.value.toLocaleString('en-IN')}`, kpis.operatingExpenses.change, true);
        this.setKPI('net-operating-profit', `₹${kpis.netOperatingProfit.value.toLocaleString('en-IN')}`, kpis.netOperatingProfit.change);
        this.setKPI('aov', `₹${kpis.averageOrderValue.value.toLocaleString('en-IN')}`, kpis.averageOrderValue.change);
        this.setKPI('refund-rate', `${kpis.refundRate.value}%`, kpis.refundRate.change, true);
        this.setKPI('inventory-valuation', `₹${kpis.inventoryValuation.value.toLocaleString('en-IN')}`, null, false, `${kpis.inventoryValuation.totalStockUnits} Units In Stock`);
      }

      // Also load overview trend chart
      const salesRes = await api.get('admin/sales-trend', params);
      if (salesRes.success && salesRes.data) {
        this.destroyChart('overviewLine');
        this.activeCharts['overviewLine'] = createRevenueLineChart('overview-trend-chart', salesRes.data.timeline);
      }
    } catch (e) {
      console.error('Failed to load overview data:', e);
    }
  }

  setKPI(id, val, change = null, invertChange = false, customSubtext = null) {
    const valEl = document.getElementById(`kpi-${id}-val`);
    const trendEl = document.getElementById(`kpi-${id}-trend`);

    if (valEl) valEl.textContent = val;

    if (trendEl) {
      if (customSubtext) {
        trendEl.innerHTML = `<span>${customSubtext}</span>`;
      } else if (change !== null) {
        const isUp = change >= 0;
        const isGood = invertChange ? !isUp : isUp;
        const badgeClass = isGood ? 'trend-up' : 'trend-down';
        const arrow = isUp ? '↑' : '↓';
        trendEl.innerHTML = `<span class="trend-pill ${badgeClass}">${arrow} ${Math.abs(change)}%</span> vs previous ${this.currentPeriod}`;
      }
    }
  }

  /**
   * 2. Sales Analytics Page
   */
  async loadSalesAnalytics() {
    try {
      const params = this.getFilterParams();
      const res = await api.get('admin/sales-trend', params);

      if (res.success && res.data) {
        const { timeline, byChannel, byRegion } = res.data;

        // Line Chart
        this.destroyChart('salesLine');
        this.activeCharts['salesLine'] = createRevenueLineChart('sales-timeline-chart', timeline);

        // Grouped Bar Chart
        this.destroyChart('salesBar');
        this.activeCharts['salesBar'] = createRevenueVsProfitBarChart('revenue-profit-bar-chart', timeline);

        // Channel Doughnut
        this.destroyChart('channelDoughnut');
        this.activeCharts['channelDoughnut'] = createDoughnutChart('sales-channel-chart', Object.keys(byChannel), Object.values(byChannel));

        // Region Doughnut
        this.destroyChart('regionDoughnut');
        this.activeCharts['regionDoughnut'] = createDoughnutChart('sales-region-chart', Object.keys(byRegion), Object.values(byRegion));
      }
    } catch (e) {
      console.error('Failed to load sales analytics:', e);
    }
  }

  /**
   * 3. Product Performance Page
   */
  async loadProductPerformance() {
    try {
      const params = this.getFilterParams();
      const res = await api.get('admin/product-performance', params);

      if (res.success && res.data) {
        const { products } = res.data;

        // Horizontal Bar Chart
        this.destroyChart('prodBar');
        this.activeCharts['prodBar'] = createHorizontalBarChart(
          'product-revenue-chart',
          products.map(p => p.name),
          products.map(p => p.grossSales)
        );

        // Table
        const tbody = document.getElementById('product-performance-tbody');
        if (tbody) {
          tbody.innerHTML = products.map(p => `
            <tr>
              <td>
                <div style="display:flex; align-items:center; gap:12px;">
                  <img src="/${p.image}" alt="${p.name}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;" onerror="this.src='/assets/images/hero_editorial.jpg'">
                  <div>
                    <strong>${p.name}</strong>
                    <div style="font-size:0.75rem; color:var(--color-taupe);">${p.sku} • ${p.sizeMl}ml</div>
                  </div>
                </div>
              </td>
              <td>${p.unitsSold.toLocaleString('en-IN')}</td>
              <td>₹${p.grossSales.toLocaleString('en-IN')}</td>
              <td>₹${p.cogs.toLocaleString('en-IN')}</td>
              <td><strong style="color:var(--color-forest);">₹${p.grossProfit.toLocaleString('en-IN')}</strong></td>
              <td><span class="badge badge-forest">${p.marginPercent}%</span></td>
              <td>₹${p.averageSellingPrice.toLocaleString('en-IN')}</td>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <div style="flex:1; height:6px; background:var(--color-border); border-radius:3px; overflow:hidden;">
                    <div style="width:${p.revenueContribution}%; height:100%; background:var(--color-forest);"></div>
                  </div>
                  <span style="font-size:0.75rem; font-weight:600;">${p.revenueContribution}%</span>
                </div>
              </td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.error('Failed to load product performance:', e);
    }
  }

  /**
   * 4. Financial P&L Analytics Page
   */
  async loadFinancials() {
    try {
      const params = this.getFilterParams();
      const res = await api.get('admin/financials', params);

      if (res.success && res.data) {
        const { pAndL } = res.data;

        // P&L Metric Values
        document.getElementById('pl-gross-revenue').textContent = `₹${pAndL.grossRevenue.toLocaleString('en-IN')}`;
        document.getElementById('pl-discounts').textContent = `-₹${pAndL.discounts.toLocaleString('en-IN')}`;
        document.getElementById('pl-net-revenue').textContent = `₹${pAndL.netRevenue.toLocaleString('en-IN')}`;
        document.getElementById('pl-cogs').textContent = `-₹${pAndL.cogs.toLocaleString('en-IN')}`;
        document.getElementById('pl-gross-profit').textContent = `₹${pAndL.grossProfit.toLocaleString('en-IN')}`;
        document.getElementById('pl-gross-margin').textContent = `${pAndL.grossMargin}%`;
        document.getElementById('pl-operating-expenses').textContent = `-₹${pAndL.totalOperatingExpenses.toLocaleString('en-IN')}`;
        document.getElementById('pl-net-operating-profit').textContent = `₹${pAndL.netOperatingProfit.toLocaleString('en-IN')}`;
        document.getElementById('pl-operating-margin').textContent = `${pAndL.operatingMargin}%`;

        // Expense Doughnut Chart
        const labels = Object.keys(pAndL.expenseBreakdown).map(k => k.replace('_', ' ').toUpperCase());
        const values = Object.values(pAndL.expenseBreakdown);

        this.destroyChart('expenseDoughnut');
        this.activeCharts['expenseDoughnut'] = createDoughnutChart('expense-breakdown-chart', labels, values);
      }
    } catch (e) {
      console.error('Failed to load financials:', e);
    }
  }

  /**
   * 5. Inventory Management Page
   */
  async loadInventory() {
    try {
      const res = await api.get('admin/inventory');
      if (res.success && res.data) {
        const { totalUnits, totalStockValuation, products, lowStockAlerts, movements } = res.data;

        document.getElementById('inv-total-units').textContent = totalUnits.toLocaleString('en-IN');
        document.getElementById('inv-valuation').textContent = `₹${totalStockValuation.toLocaleString('en-IN')}`;
        document.getElementById('inv-low-count').textContent = lowStockAlerts.length;

        // Products Stock Table
        const prodTbody = document.getElementById('inventory-stock-tbody');
        if (prodTbody) {
          prodTbody.innerHTML = products.map(p => {
            const isLow = p.stockQuantity <= p.reorderThreshold;
            const badgeClass = p.stockQuantity <= 10 ? 'badge-danger' : (isLow ? 'badge-warning' : 'badge-forest');
            const statusText = p.stockQuantity === 0 ? 'Out of Stock' : (isLow ? 'Low Stock Alert' : 'Healthy');

            return `
              <tr>
                <td>
                  <div style="display:flex; align-items:center; gap:12px;">
                    <img src="/${p.image}" alt="${p.name}" style="width:36px;height:36px;border-radius:4px;object-fit:cover;" onerror="this.src='/assets/images/hero_editorial.jpg'">
                    <div><strong>${p.name}</strong> <span style="font-size:0.75rem; color:var(--color-taupe);">(${p.sku})</span></div>
                  </div>
                </td>
                <td><strong>${p.stockQuantity}</strong></td>
                <td>${p.reorderThreshold}</td>
                <td>₹${p.unitCost}</td>
                <td>₹${(p.stockQuantity * p.unitCost).toLocaleString('en-IN')}</td>
                <td><span class="badge ${badgeClass}">${statusText}</span></td>
                <td>
                  <button class="btn btn-secondary btn-sm restock-modal-btn" data-id="${p._id}" data-name="${p.name}">Restock</button>
                </td>
              </tr>
            `;
          }).join('');

          // Restock handler
          prodTbody.querySelectorAll('.restock-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              const pId = btn.getAttribute('data-id');
              const pName = btn.getAttribute('data-name');
              const addedQty = prompt(`Enter quantity to replenish for ${pName}:`, '50');
              if (addedQty && !isNaN(parseInt(addedQty))) {
                this.restockProduct(pId, parseInt(addedQty, 10));
              }
            });
          });
        }

        // Movements Table
        const moveTbody = document.getElementById('inventory-movements-tbody');
        if (moveTbody) {
          moveTbody.innerHTML = movements.map(m => `
            <tr>
              <td>${new Date(m.date).toLocaleString()}</td>
              <td>${m.product ? m.product.name : 'Formula'}</td>
              <td><span class="badge ${m.movementType === 'restock' ? 'badge-success' : 'badge-forest'}">${m.movementType.toUpperCase()}</span></td>
              <td><strong>${m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}</strong></td>
              <td>${m.newStock}</td>
              <td style="font-size:0.85rem; color:var(--color-text-secondary);">${m.reason}</td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.error('Failed to load inventory data:', e);
    }
  }

  async restockProduct(productId, quantity) {
    try {
      const prodRes = await api.get(`products/${productId}`);
      if (prodRes.success && prodRes.data) {
        const newStock = prodRes.data.stockQuantity + quantity;
        await api.patch(`admin/products/${productId}`, { stockQuantity: newStock });
        alert(`Successfully added ${quantity} units. New stock is ${newStock}.`);
        this.loadInventory();
      }
    } catch (e) {
      alert(`Restock failed: ${e.message}`);
    }
  }

  /**
   * 6. Customer Analytics Page
   */
  async loadCustomers() {
    try {
      const res = await api.get('admin/customers');
      if (res.success && res.data) {
        const { totalRegistered, activeBuyersCount, newVsReturning, repeatPurchaseRate, rfmSegments, topCustomers } = res.data;

        document.getElementById('cust-total').textContent = totalRegistered.toLocaleString('en-IN');
        document.getElementById('cust-active').textContent = activeBuyersCount.toLocaleString('en-IN');
        document.getElementById('cust-repeat-rate').textContent = `${repeatPurchaseRate}%`;

        // RFM Segment Doughnut
        this.destroyChart('rfmDoughnut');
        this.activeCharts['rfmDoughnut'] = createDoughnutChart(
          'rfm-segments-chart',
          ['Champions', 'Loyal Ritualists', 'Potential', 'New Patrons'],
          [rfmSegments.champions, rfmSegments.loyal, rfmSegments.potential, rfmSegments.newCustomers]
        );

        // Top Patrons Table
        const tbody = document.getElementById('top-customers-tbody');
        if (tbody) {
          tbody.innerHTML = topCustomers.map(c => `
            <tr>
              <td><strong>${c.name}</strong></td>
              <td>${c.email}</td>
              <td><span class="badge badge-forest">${c.orderCount} Orders</span></td>
              <td><strong>₹${c.totalSpent.toLocaleString('en-IN')}</strong></td>
              <td>${new Date(c.lastOrderDate).toLocaleDateString()}</td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.error('Failed to load customers:', e);
    }
  }

  /**
   * 7. Reports & CSV Export Page
   */
  async loadReports() {
    const tableBody = document.getElementById('reports-table-tbody');
    const exportBtn = document.getElementById('export-csv-btn');
    const statusSelect = document.getElementById('report-status-filter');
    const channelSelect = document.getElementById('report-channel-filter');
    const regionSelect = document.getElementById('report-region-filter');

    const fetchReports = async () => {
      if (!tableBody) return;
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px;"><div class="spinner"></div></td></tr>`;

      const params = this.getFilterParams();
      if (statusSelect && statusSelect.value !== 'all') params.status = statusSelect.value;
      if (channelSelect && channelSelect.value !== 'all') params.channel = channelSelect.value;
      if (regionSelect && regionSelect.value !== 'all') params.region = regionSelect.value;

      try {
        const res = await api.get('admin/reports/sales', params);
        if (res.success && res.data) {
          if (res.data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px;">No records found for selected criteria.</td></tr>`;
            return;
          }

          tableBody.innerHTML = res.data.map(o => {
            const net = o.grossSales - o.discountAmount;
            const profit = net - o.totalCOGS;
            return `
              <tr>
                <td><strong>${o.orderNumber}</strong></td>
                <td>${new Date(o.orderDate).toISOString().split('T')[0]}</td>
                <td>${o.customerInfo.name}</td>
                <td>₹${o.grossSales.toLocaleString('en-IN')}</td>
                <td>-₹${o.discountAmount.toLocaleString('en-IN')}</td>
                <td><strong>₹${o.totalAmount.toLocaleString('en-IN')}</strong></td>
                <td style="color:var(--color-forest); font-weight:600;">₹${profit.toLocaleString('en-IN')}</td>
                <td><span class="badge ${o.orderStatus === 'delivered' ? 'badge-success' : 'badge-forest'}">${o.orderStatus}</span></td>
              </tr>
            `;
          }).join('');
        }
      } catch (e) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--color-danger);">Error: ${e.message}</td></tr>`;
      }
    };

    if (exportBtn) {
      exportBtn.onclick = async () => {
        const params = this.getFilterParams();
        params.format = 'csv';
        const queryStr = new URLSearchParams(params).toString();
        window.open(`${api.baseUrl}/admin/reports/sales?${queryStr}`, '_blank');
      };
    }

    if (statusSelect) statusSelect.onchange = fetchReports;
    if (channelSelect) channelSelect.onchange = fetchReports;
    if (regionSelect) regionSelect.onchange = fetchReports;

    await fetchReports();
  }
}

export const adminApp = new AdminController();
window.adminApp = adminApp;
