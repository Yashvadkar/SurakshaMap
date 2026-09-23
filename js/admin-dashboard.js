/**
 * admin-dashboard.js — Admin Panel Controller with Firebase Auth
 */

(function () {
  'use strict';

  let currentTab = 'pending';
  let reports = [];
  let unsubscribe = null;

  document.addEventListener('DOMContentLoaded', () => {
    setupAuth();
    setupTabs();
    setupExport();
  });

  // ─── Authentication ───
  function setupAuth() {
    const loginForm = document.getElementById('admin-login-form');
    const logoutBtn = document.getElementById('btn-admin-logout');

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email')?.value?.trim();
        const pass = document.getElementById('admin-password')?.value;
        const btn = loginForm.querySelector('button[type="submit"]');

        if (!email || !pass) { SurakshaUI.showToast('Enter email and password', 'warning'); return; }

        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Signing in...'; }

        try {
          if (window.FIREBASE_READY && window.auth) {
            await window.auth.signInWithEmailAndPassword(email, pass);
          } else {
            // Demo mode: accept any login
            if (email === 'admin@surakshamap.in' && pass === 'suraksha-demo') {
              sessionStorage.setItem('surakshamap_admin', 'true');
            } else {
              throw new Error('Invalid credentials. Demo: admin@surakshamap.in / suraksha-demo');
            }
          }
          showDashboard();
          SurakshaUI.showToast('Signed in successfully', 'success');
        } catch (err) {
          SurakshaUI.showToast(err.message || 'Login failed', 'error');
        } finally {
          if (btn) { btn.disabled = false; btn.innerHTML = '🔐 Sign In'; }
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          if (window.auth) await window.auth.signOut();
          sessionStorage.removeItem('surakshamap_admin');
        } catch {}
        hideDashboard();
        SurakshaUI.showToast('Signed out', 'info');
      });
    }

    // Check auth state
    if (window.auth) {
      window.auth.onAuthStateChanged((user) => {
        if (user) showDashboard();
        else hideDashboard();
      });
    } else if (sessionStorage.getItem('surakshamap_admin') === 'true') {
      showDashboard();
    }
  }

  function showDashboard() {
    const auth = document.getElementById('admin-auth-section');
    const dash = document.getElementById('admin-dashboard');
    const logout = document.getElementById('btn-admin-logout');
    if (auth) auth.style.display = 'none';
    if (dash) dash.style.display = 'block';
    if (logout) logout.style.display = 'inline-flex';
    loadReports();
  }

  function hideDashboard() {
    const auth = document.getElementById('admin-auth-section');
    const dash = document.getElementById('admin-dashboard');
    const logout = document.getElementById('btn-admin-logout');
    if (auth) auth.style.display = 'block';
    if (dash) dash.style.display = 'none';
    if (logout) logout.style.display = 'none';
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  }

  // ─── Data Loading ───
  function loadReports() {
    unsubscribe = window.SurakshaDB.onReportsChange((data) => {
      reports = data;
      updateStats();
      renderTab();
    });
  }

  // ─── Tabs ───
  function setupTabs() {
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        renderTab();
      });
    });
  }

  function updateStats() {
    const pending = reports.filter(r => r.status === 'pending_ai').length;
    const review = reports.filter(r => r.status === 'pending_review').length;
    const duplicates = reports.filter(r => r.status === 'flagged_duplicate').length;
    const verified = reports.filter(r => r.status === 'verified' || r.status === 'in_progress').length;

    setCount('tab-count-pending', pending);
    setCount('tab-count-review', review);
    setCount('tab-count-duplicates', duplicates);
    setCount('tab-count-active', verified);

    setStatValue('admin-stat-total', reports.length);
    setStatValue('admin-stat-pending', pending + review);
    setStatValue('admin-stat-resolved', reports.filter(r => r.status === 'resolved').length);
    setStatValue('admin-stat-rejected', reports.filter(r => ['rejected', 'ai_rejected'].includes(r.status)).length);
  }

  function setCount(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val > 0 ? val : '';
  }

  function setStatValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function getFilteredReports() {
    switch (currentTab) {
      case 'pending': return reports.filter(r => r.status === 'pending_ai');
      case 'review': return reports.filter(r => r.status === 'pending_review');
      case 'duplicates': return reports.filter(r => r.status === 'flagged_duplicate');
      case 'active': return reports.filter(r => r.status === 'verified' || r.status === 'in_progress');
      case 'resolved': return reports.filter(r => r.status === 'resolved');
      case 'rejected': return reports.filter(r => ['rejected', 'ai_rejected'].includes(r.status));
      case 'all': return reports;
      default: return reports;
    }
  }

  function renderTab() {
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;

    const search = (document.getElementById('admin-search')?.value || '').toLowerCase();
    let filtered = getFilteredReports();

    if (search) {
      filtered = filtered.filter(r =>
        (r.trackingToken || '').toLowerCase().includes(search) ||
        (r.category || '').toLowerCase().includes(search) ||
        (r.description || '').toLowerCase().includes(search)
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--c-text-muted);">No reports in this view</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(r => `
      <tr data-id="${r.id}">
        <td><code style="font-family:var(--font-mono);font-size:0.78rem;color:var(--c-primary);">${r.trackingToken}</code></td>
        <td>
          <span style="display:flex;align-items:center;gap:4px;">
            ${SurakshaUI.getCategoryIcon(r.category)}
            ${SurakshaUI.getCategoryLabel(r.category)}
          </span>
        </td>
        <td>${SurakshaUI.createSeverityBadge(r.severity)}</td>
        <td style="max-width:200px;">
          <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${SurakshaUI.escapeHtml((r.description || '').substring(0, 80))}</div>
          <div class="text-caption">${SurakshaUI.formatDate(r.submittedAt)}</div>
          ${r.aiReview ? `<div class="text-caption" style="margin-top:2px;">🤖 ${r.aiReview.genuine ? 'Genuine' : 'Flagged'} (${Math.round((r.aiReview.confidence || 0) * 100)}%)</div>` : ''}
          ${r.citizenUpdate ? `<div class="text-caption" style="margin-top:2px;">${r.citizenUpdate === 'resolved' ? '✅' : '⚠️'} Citizen: ${r.citizenUpdate}</div>` : ''}
        </td>
        <td>${SurakshaUI.createStatusBadge(r.status)}</td>
        <td>
          <div class="actions-cell">
            ${getActionButtons(r)}
          </div>
        </td>
      </tr>
    `).join('');

    // Attach action handlers
    tbody.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset.id));
    });
  }

  function getActionButtons(report) {
    const buttons = [];

    if (report.status === 'pending_ai') {
      buttons.push(`<button class="btn btn-primary btn-sm" data-action="run-ai" data-id="${report.id}">🤖 Run AI</button>`);
      buttons.push(`<button class="btn btn-success btn-sm" data-action="verify" data-id="${report.id}">✅</button>`);
      buttons.push(`<button class="btn btn-danger btn-sm" data-action="reject" data-id="${report.id}">❌</button>`);
    } else if (report.status === 'pending_review') {
      buttons.push(`<button class="btn btn-success btn-sm" data-action="verify" data-id="${report.id}">✅ Verify</button>`);
      buttons.push(`<button class="btn btn-danger btn-sm" data-action="reject" data-id="${report.id}">❌</button>`);
      buttons.push(`<button class="btn btn-secondary btn-sm" data-action="duplicate" data-id="${report.id}">📋</button>`);
    } else if (report.status === 'flagged_duplicate') {
      buttons.push(`<button class="btn btn-success btn-sm" data-action="verify" data-id="${report.id}">Keep</button>`);
      buttons.push(`<button class="btn btn-danger btn-sm" data-action="reject" data-id="${report.id}">Reject</button>`);
    } else if (report.status === 'verified') {
      buttons.push(`<button class="btn btn-secondary btn-sm" data-action="progress" data-id="${report.id}">🔧 In Progress</button>`);
      buttons.push(`<button class="btn btn-success btn-sm" data-action="resolve" data-id="${report.id}">✅ Resolve</button>`);
    } else if (report.status === 'in_progress') {
      buttons.push(`<button class="btn btn-success btn-sm" data-action="resolve" data-id="${report.id}">✅ Resolve</button>`);
    }

    if (!['resolved', 'rejected', 'ai_rejected'].includes(report.status)) {
      buttons.push(`<button class="btn btn-ghost btn-sm" data-action="delete" data-id="${report.id}" style="color:var(--c-error);">🗑️</button>`);
    }

    return buttons.join('');
  }

  async function handleAction(action, id) {
    try {
      switch (action) {
        case 'run-ai':
          SurakshaUI.showToast('Running AI review...', 'info');
          const result = await SurakshaAI.processReport(id);
          if (result) {
            SurakshaUI.showToast(
              result.action === 'reject' ? 'AI flagged as spam — auto-rejected' :
              result.action === 'flag_duplicate' ? 'AI found possible duplicate — flagged for review' :
              'AI marked as genuine — forwarded for your review',
              result.action === 'reject' ? 'warning' : 'success'
            );
          }
          break;
        case 'verify':
          await SurakshaDB.updateReport(id, { status: 'verified' });
          SurakshaUI.showToast('Report verified', 'success');
          break;
        case 'reject':
          await SurakshaDB.updateReport(id, { status: 'rejected' });
          SurakshaUI.showToast('Report rejected', 'info');
          break;
        case 'duplicate':
          await SurakshaDB.updateReport(id, { status: 'flagged_duplicate' });
          SurakshaUI.showToast('Marked as duplicate', 'info');
          break;
        case 'progress':
          await SurakshaDB.updateReport(id, { status: 'in_progress' });
          SurakshaUI.showToast('Marked as in progress', 'success');
          break;
        case 'resolve':
          await SurakshaDB.updateReport(id, { status: 'resolved' });
          SurakshaUI.showToast('Report resolved!', 'success');
          break;
        case 'delete':
          SurakshaUI.showModal({
            title: 'Delete Report',
            body: '<p>Are you sure you want to permanently delete this report?</p>',
            actions: [
              { id: 'confirm', label: 'Delete', cls: 'btn-danger', onClick: async () => {
                await SurakshaDB.deleteReport(id);
                SurakshaUI.showToast('Report deleted', 'info');
              }},
              { id: 'cancel', label: 'Cancel', cls: 'btn-secondary', onClick: () => {} }
            ]
          });
          break;
      }
    } catch (err) {
      console.error('Admin action failed:', err);
      SurakshaUI.showToast('Action failed: ' + err.message, 'error');
    }
  }

  // ─── Batch AI Review ───
  window.runBatchAIReview = async function () {
    const pending = reports.filter(r => r.status === 'pending_ai');
    if (pending.length === 0) { SurakshaUI.showToast('No reports pending AI review', 'info'); return; }

    SurakshaUI.showToast(`Processing ${pending.length} reports with AI...`, 'info');
    let processed = 0;
    for (const report of pending) {
      await SurakshaAI.processReport(report.id);
      processed++;
      if (processed % 5 === 0) {
        SurakshaUI.showToast(`Processed ${processed}/${pending.length}...`, 'info');
      }
    }
    SurakshaUI.showToast(`AI review complete: ${processed} reports processed`, 'success');
  };

  // ─── Export ───
  function setupExport() {
    document.getElementById('export-csv')?.addEventListener('click', () => exportData('csv'));
    document.getElementById('export-json')?.addEventListener('click', () => exportData('json'));
  }

  function exportData(format) {
    const filtered = getFilteredReports();
    if (filtered.length === 0) { SurakshaUI.showToast('No data to export', 'warning'); return; }

    let content, mime, ext;
    if (format === 'csv') {
      const headers = ['Token', 'Category', 'Severity', 'Description', 'Latitude', 'Longitude', 'Status', 'Submitted'];
      const rows = filtered.map(r => [
        r.trackingToken, r.category, r.severity,
        `"${(r.description || '').replace(/"/g, '""')}"`,
        r.latitude, r.longitude, r.status, r.submittedAt
      ]);
      content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      mime = 'text/csv';
      ext = 'csv';
    } else {
      content = JSON.stringify(filtered, null, 2);
      mime = 'application/json';
      ext = 'json';
    }

    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `surakshamap_reports_${new Date().toISOString().split('T')[0]}.${ext}`;
    a.click();
    SurakshaUI.showToast(`Exported ${filtered.length} reports as ${ext.toUpperCase()}`, 'success');
  }

  // Search handler
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('admin-search')?.addEventListener('input', renderTab);
  });
})();
