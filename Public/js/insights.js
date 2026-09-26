/**
 * insights.js — Animated Dashboard with Chart.js
 */

(function () {
  'use strict';

  let charts = {};
  let initialized = false;

  async function init() {
    const reports = await window.SurakshaDB.getAllReports();
    renderStats(reports);
    renderCharts(reports);
    initialized = true;
  }

  function renderStats(reports) {
    const total = reports.length;
    const active = reports.filter(r => !['resolved', 'rejected', 'ai_rejected'].includes(r.status)).length;
    const resolved = reports.filter(r => r.status === 'resolved').length;
    const hotspots = SurakshaRisk.groupIntoHotspots(reports);

    const els = {
      'insight-total': total,
      'insight-active': active,
      'insight-resolved': resolved,
      'insight-hotspots': hotspots.length
    };

    Object.entries(els).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) SurakshaUI.animateCounter(el, val);
    });
  }

  function renderCharts(reports) {
    if (typeof Chart === 'undefined') {
      console.warn('[Insights] Chart.js not loaded');
      return;
    }

    // Chart.js defaults
    Chart.defaults.font.family = "'DM Sans', sans-serif";
    Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue('--c-text-muted').trim() || '#475569';
    Chart.defaults.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--c-border').trim() || '#E2E8F0';

    renderCategoryChart(reports);
    renderSeverityChart(reports);
    renderTrendChart(reports);
    renderStatusChart(reports);
  }

  function renderCategoryChart(reports) {
    const ctx = document.getElementById('chart-category');
    if (!ctx) return;
    if (charts.category) charts.category.destroy();

    const counts = {};
    reports.forEach(r => {
      const cat = SurakshaUI.getCategoryLabel(r.category);
      counts[cat] = (counts[cat] || 0) + 1;
    });

    const labels = Object.keys(counts);
    const data = Object.values(counts);
    const colors = ['#4F46E5', '#0D9488', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

    charts.category = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 2,
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--c-surface-card').trim() || '#fff',
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10, font: { size: 12 } } }
        },
        animation: { animateRotate: true, animateScale: true, duration: 1000, easing: 'easeOutQuart' }
      }
    });
  }

  function renderSeverityChart(reports) {
    const ctx = document.getElementById('chart-severity');
    if (!ctx) return;
    if (charts.severity) charts.severity.destroy();

    const levels = ['low', 'medium', 'high', 'critical'];
    const counts = levels.map(l => reports.filter(r => (r.severity || 'medium') === l).length);
    const colors = ['#10B981', '#F59E0B', '#EF4444', '#DC2626'];

    charts.severity = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Low', 'Moderate', 'High', 'Critical'],
        datasets: [{
          data: counts,
          backgroundColor: colors,
          borderRadius: 8,
          barThickness: 40
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { display: false } },
          x: { grid: { display: false } }
        },
        animation: { duration: 800, easing: 'easeOutQuart' }
      }
    });
  }

  function renderTrendChart(reports) {
    const ctx = document.getElementById('chart-trend');
    if (!ctx) return;
    if (charts.trend) charts.trend.destroy();

    const days = 14;
    const labels = [];
    const data = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      labels.push(d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }));
      data.push(reports.filter(r => r.submittedAt && r.submittedAt.startsWith(dateStr)).length);
    }

    charts.trend = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Reports',
          data,
          borderColor: '#4F46E5',
          backgroundColor: 'rgba(79, 70, 229, 0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#4F46E5',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          borderWidth: 2.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.04)' } },
          x: { grid: { display: false }, ticks: { maxRotation: 45 } }
        },
        animation: { duration: 1200, easing: 'easeOutQuart' }
      }
    });
  }

  function renderStatusChart(reports) {
    const ctx = document.getElementById('chart-status');
    if (!ctx) return;
    if (charts.status) charts.status.destroy();

    const statuses = {
      'Pending AI': reports.filter(r => r.status === 'pending_ai').length,
      'Under Review': reports.filter(r => r.status === 'pending_review').length,
      'Verified': reports.filter(r => r.status === 'verified').length,
      'In Progress': reports.filter(r => r.status === 'in_progress').length,
      'Resolved': reports.filter(r => r.status === 'resolved').length,
      'Rejected': reports.filter(r => ['rejected', 'ai_rejected'].includes(r.status)).length
    };

    const labels = Object.keys(statuses).filter(k => statuses[k] > 0);
    const data = labels.map(l => statuses[l]);
    const colors = ['#8B5CF6', '#3B82F6', '#10B981', '#06B6D4', '#10B981', '#EF4444'];

    charts.status = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderRadius: 6,
          barThickness: 32
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { display: false } },
          y: { grid: { display: false } }
        },
        animation: { duration: 800 }
      }
    });
  }

  window.SurakshaInsights = { init };
})();
