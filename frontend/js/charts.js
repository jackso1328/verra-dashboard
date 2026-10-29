/**
 * VÉRRA Chart.js Luxury Theme Visualizations
 */

// Brand Palette Tokens for Charts
export const CHART_COLORS = {
  forest: '#284B3E',
  forestLight: '#3D6957',
  forestTransparent: 'rgba(40, 75, 62, 0.12)',
  gold: '#C6AA72',
  goldTransparent: 'rgba(198, 170, 114, 0.2)',
  sage: '#8FA892',
  taupe: '#B7A99A',
  cream: '#F4F1E8',
  text: '#292C28',
  textMuted: '#8E9189',
  border: '#E8E6DF'
};

// Global Chart Defaults
if (window.Chart) {
  Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = CHART_COLORS.textMuted;
  Chart.defaults.plugins.tooltip.backgroundColor = '#FFFFFF';
  Chart.defaults.plugins.tooltip.titleColor = CHART_COLORS.forest;
  Chart.defaults.plugins.tooltip.bodyColor = CHART_COLORS.text;
  Chart.defaults.plugins.tooltip.borderColor = CHART_COLORS.border;
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.tooltip.boxPadding = 6;
  Chart.defaults.plugins.tooltip.usePointStyle = true;
}

/**
 * 1. Revenue Over Time (Smooth Line Chart)
 */
export const createRevenueLineChart = (canvasId, timelineData) => {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');

  const labels = timelineData.map(d => d.date);
  const revenueValues = timelineData.map(d => d.revenue);
  const profitValues = timelineData.map(d => d.profit);

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Net Revenue (₹)',
          data: revenueValues,
          borderColor: CHART_COLORS.forest,
          backgroundColor: CHART_COLORS.forestTransparent,
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: CHART_COLORS.forest,
          pointRadius: labels.length > 20 ? 1.5 : 4,
          pointHoverRadius: 6
        },
        {
          label: 'Gross Profit (₹)',
          data: profitValues,
          borderColor: CHART_COLORS.gold,
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          borderWidth: 2,
          pointBackgroundColor: CHART_COLORS.gold,
          pointRadius: labels.length > 20 ? 0 : 3,
          pointHoverRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { boxWidth: 14, font: { weight: 600 } }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 12 }
        },
        y: {
          grid: { color: CHART_COLORS.border },
          ticks: {
            callback: (val) => `₹${Number(val).toLocaleString('en-IN')}`
          }
        }
      }
    }
  });
};

/**
 * 2. Revenue vs Profit Grouped Bar Chart
 */
export const createRevenueVsProfitBarChart = (canvasId, timelineData) => {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');

  const labels = timelineData.map(d => d.date);
  const revenueValues = timelineData.map(d => d.revenue);
  const profitValues = timelineData.map(d => d.profit);

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Net Sales',
          data: revenueValues,
          backgroundColor: CHART_COLORS.forest,
          borderRadius: 4
        },
        {
          label: 'Gross Profit',
          data: profitValues,
          backgroundColor: CHART_COLORS.gold,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 14, font: { weight: 600 } } }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: CHART_COLORS.border },
          ticks: { callback: (val) => `₹${Number(val).toLocaleString('en-IN')}` }
        }
      }
    }
  });
};

/**
 * 3. Donut / Doughnut Chart (Channels, Regions, Expenses)
 */
export const createDoughnutChart = (canvasId, labels, data, customColors) => {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');

  const colors = customColors || [
    CHART_COLORS.forest,
    CHART_COLORS.gold,
    CHART_COLORS.sage,
    CHART_COLORS.taupe,
    '#587C6C',
    '#D8B778'
  ];

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#FFFFFF'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12, padding: 16, font: { weight: 500 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw || 0;
              return ` ${ctx.label}: ₹${Number(val).toLocaleString('en-IN')}`;
            }
          }
        }
      }
    }
  });
};

/**
 * 5. Explainable Sales Forecast Chart (Historical Actuals vs Forecast Estimates)
 */
export const createForecastChart = (canvasId, historicalData, forecastData) => {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');

  // Combined labels: historical labels followed by forecast labels
  const histLabels = historicalData.map(h => h.label);
  const foreLabels = forecastData.map(f => f.label);
  const allLabels = [...histLabels, ...foreLabels];

  // Actuals series: actual numbers for history, null for future
  const actualsSeries = [
    ...historicalData.map(h => h.revenue),
    ...forecastData.map(() => null)
  ];

  // Forecast series: bridge from last historical point into forecast points
  const lastHistRevenue = historicalData.length > 0 ? historicalData[historicalData.length - 1].revenue : null;
  const forecastSeries = [
    ...historicalData.slice(0, -1).map(() => null),
    lastHistRevenue,
    ...forecastData.map(f => f.predictedRevenue)
  ];

  // Upper Bound series
  const upperSeries = [
    ...historicalData.slice(0, -1).map(() => null),
    lastHistRevenue,
    ...forecastData.map(f => f.upperBound)
  ];

  // Lower Bound series
  const lowerSeries = [
    ...historicalData.slice(0, -1).map(() => null),
    lastHistRevenue,
    ...forecastData.map(f => f.lowerBound)
  ];

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: allLabels,
      datasets: [
        {
          label: 'Historical Actuals (INR)',
          data: actualsSeries,
          borderColor: CHART_COLORS.forest,
          backgroundColor: CHART_COLORS.forestTransparent,
          fill: true,
          tension: 0.3,
          borderWidth: 2.5,
          pointBackgroundColor: CHART_COLORS.forest,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Projected Forecast (INR)',
          data: forecastSeries,
          borderColor: CHART_COLORS.gold,
          backgroundColor: 'transparent',
          borderDash: [6, 4],
          borderWidth: 2.5,
          pointBackgroundColor: CHART_COLORS.gold,
          pointRadius: 5,
          pointHoverRadius: 7
        },
        {
          label: 'Upper Empirical Estimate (+7.5%)',
          data: upperSeries,
          borderColor: 'rgba(198, 170, 114, 0.4)',
          backgroundColor: 'transparent',
          borderDash: [2, 2],
          borderWidth: 1,
          pointRadius: 0
        },
        {
          label: 'Lower Empirical Estimate (-7.5%)',
          data: lowerSeries,
          borderColor: 'rgba(198, 170, 114, 0.4)',
          backgroundColor: 'transparent',
          borderDash: [2, 2],
          borderWidth: 1,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { boxWidth: 14, font: { weight: 600 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.raw === null || ctx.raw === undefined) return null;
              return ` ${ctx.dataset.label}: ₹${Number(ctx.raw).toLocaleString('en-IN')}`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: CHART_COLORS.border },
          ticks: { callback: (val) => `₹${Number(val).toLocaleString('en-IN')}` }
        }
      }
    }
  });
};

/**
 * 6. Horizontal Bar Chart for Product Performance
 */
export const createHorizontalBarChart = (canvasId, labels, data, labelName = 'Gross Sales (₹)') => {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: labelName,
        data,
        backgroundColor: CHART_COLORS.forest,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: CHART_COLORS.border },
          ticks: { callback: (val) => `₹${Number(val).toLocaleString('en-IN')}` }
        },
        y: {
          grid: { display: false }
        }
      }
    }
  });
};
