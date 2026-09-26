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
          let signedIn = false;
          if (window.FIREBASE_READY && window.auth) {
            try {
              await window.auth.signInWithEmailAndPassword(email, pass);
              signedIn = true;
            } catch (authErr) {
              // Fallback to admin credentials if Firebase Auth is not yet enabled or configured
              if (email === 'admin@surakshamap.in' && pass === 'suraksha-demo') {
                sessionStorage.setItem('surakshamap_admin', 'true');
                signedIn = true;
              } else {
                throw authErr;
              }
            }
          } else {
            // Local mode
            if (email === 'admin@surakshamap.in' && pass === 'suraksha-demo') {
              sessionStorage.setItem('surakshamap_admin', 'true');
              signedIn = true;
            } else {
              throw new Error('Invalid email or password.');
            }
          }

          if (signedIn) {
            showDashboard();
            SurakshaUI.showToast('Signed in successfully', 'success');
          }
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
        } catch {}
        sessionStorage.removeItem('surakshamap_admin');
        hideDashboard();
        SurakshaUI.showToast('Signed out', 'info');
      });
    }

    // Check auth state
    if (window.auth) {
      window.auth.onAuthStateChanged((user) => {
        if (user || sessionStorage.getItem('surakshamap_admin') === 'true') {
          showDashboard();
        } else {
          hideDashboard();
        }
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
          ${r.aiReview ? `
            <div class="text-caption" style="margin-top:2px;">
              ${r.aiReview.error
                ? '<span style="color:#d97706;font-weight:600;">⚠️ AI Review Failed — Manual Review</span>'
                : `🤖 ${r.aiReview.genuine ? 'Genuine' : 'Flagged'} (${Math.round((r.aiReview.confidence || 0) * 100)}%)`}
            </div>
            ${r.aiReview.summary && !r.aiReview.error ? `<div class="text-caption text-muted" style="font-style:italic;margin-top:1px;">"${SurakshaUI.escapeHtml(r.aiReview.summary.substring(0, 70))}"</div>` : ''}
          ` : (r.status === 'pending_ai' ? '<div class="text-caption text-muted" style="margin-top:2px;">⏳ Awaiting AI review...</div>' : '')}
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

    // Always offer manual inspection / review for active reports
    if (['pending_ai', 'pending_review', 'flagged_duplicate', 'rejected', 'ai_rejected'].includes(report.status)) {
      buttons.push(`<button class="btn btn-secondary btn-sm" data-action="manual-review" data-id="${report.id}" title="Inspect full details, photo, and review manually">📝 Manual Review</button>`);
    }

    if (report.status === 'pending_ai') {
      buttons.push(`<button class="btn btn-primary btn-sm" data-action="run-ai" data-id="${report.id}">🤖 Run AI</button>`);
      buttons.push(`<button class="btn btn-success btn-sm" data-action="verify" data-id="${report.id}">✅</button>`);
      buttons.push(`<button class="btn btn-danger btn-sm" data-action="reject" data-id="${report.id}">❌</button>`);
    } else if (report.status === 'pending_review') {
      if (report.aiReview?.error) {
        buttons.push(`<button class="btn btn-primary btn-sm" data-action="run-ai" data-id="${report.id}" title="Retry AI review">🔄 Retry AI</button>`);
      }
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

  function openManualReviewModal(id) {
    const report = reports.find(r => r.id === id);
    if (!report) {
      SurakshaUI.showToast('Report not found', 'warning');
      return;
    }

    const categoryIcon = SurakshaUI.getCategoryIcon(report.category);
    const categoryLabel = SurakshaUI.getCategoryLabel(report.category);
    const severityBadge = SurakshaUI.createSeverityBadge(report.severity);
    const statusBadge = SurakshaUI.createStatusBadge(report.status);
    const formattedDate = SurakshaUI.formatDate(report.submittedAt);
    const lat = Number(report.latitude || 0).toFixed(5);
    const lon = Number(report.longitude || 0).toFixed(5);
    const mapsUrl = `https://www.google.com/maps?q=${report.latitude},${report.longitude}`;

    const modalBody = `
      <div style="display:flex;flex-direction:column;gap:14px;text-align:left;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding-bottom:10px;border-bottom:1px solid var(--c-border);">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.6rem;">${categoryIcon}</span>
            <div>
              <strong style="font-size:1.05rem;">${categoryLabel}</strong>
              <div style="font-size:0.75rem;color:var(--c-text-muted);">Token: <code style="font-family:var(--font-mono);color:var(--c-primary);">${report.trackingToken}</code></div>
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            ${severityBadge}
            ${statusBadge}
          </div>
        </div>

        <div>
          <div style="font-size:0.75rem;font-weight:600;color:var(--c-text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">Citizen Description</div>
          <div style="background:var(--c-surface-raised, rgba(255,255,255,0.04));padding:12px;border-radius:var(--radius-md);border:1px solid var(--c-border);font-size:0.92rem;line-height:1.5;white-space:pre-wrap;">${SurakshaUI.escapeHtml(report.description || 'No description provided')}</div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:10px;">
          <div style="background:var(--c-surface-raised, rgba(255,255,255,0.04));padding:10px;border-radius:var(--radius-md);border:1px solid var(--c-border);">
            <div style="font-size:0.72rem;color:var(--c-text-muted);margin-bottom:2px;">Coordinates</div>
            <div style="font-family:var(--font-mono);font-size:0.85rem;">📍 ${lat}, ${lon}</div>
            <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="font-size:0.75rem;color:var(--c-primary);margin-top:4px;display:inline-block;">Open on Google Maps ↗</a>
          </div>
          <div style="background:var(--c-surface-raised, rgba(255,255,255,0.04));padding:10px;border-radius:var(--radius-md);border:1px solid var(--c-border);">
            <div style="font-size:0.72rem;color:var(--c-text-muted);margin-bottom:2px;">Submitted At</div>
            <div style="font-size:0.85rem;">🕒 ${formattedDate}</div>
            ${report.citizenUpdate ? `<div style="font-size:0.75rem;color:var(--c-primary);margin-top:4px;">Citizen Update: ${SurakshaUI.escapeHtml(report.citizenUpdate)}</div>` : ''}
          </div>
        </div>

        ${report.photoUrl ? `
          <div>
            <div style="font-size:0.75rem;font-weight:600;color:var(--c-text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">Evidence Photo</div>
            <a href="${report.photoUrl}" target="_blank" rel="noopener noreferrer" title="Click to view full image">
              <img src="${report.photoUrl}" alt="Evidence photo" style="max-height:200px;width:100%;object-fit:cover;border-radius:var(--radius-md);border:1px solid var(--c-border);">
            </a>
          </div>
        ` : ''}

        ${report.aiReview ? `
          <div style="background:var(--c-primary-light, rgba(59,130,246,0.08));padding:12px;border-radius:var(--radius-md);border:1px solid var(--c-primary);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <strong style="font-size:0.85rem;color:var(--c-primary);">
                ${report.aiReview.error ? '⚠️ AI Evaluation Unavailable' : `🤖 AI Evaluation: ${report.aiReview.genuine ? 'Genuine' : 'Flagged as Spam'} (${Math.round((report.aiReview.confidence || 0) * 100)}% Confidence)`}
              </strong>
              <span style="font-size:0.7rem;color:var(--c-text-muted);">${report.aiReview.model || 'Gemini'}</span>
            </div>
            <div style="font-size:0.85rem;line-height:1.45;margin-bottom:6px;">${SurakshaUI.escapeHtml(report.aiReview.reason || '')}</div>
            ${report.aiReview.summary ? `<div style="font-size:0.8rem;font-style:italic;color:var(--c-text-muted);border-left:2px solid var(--c-primary);padding-left:8px;">"${SurakshaUI.escapeHtml(report.aiReview.summary)}"</div>` : ''}
          </div>
        ` : `
          <div style="background:var(--c-surface-raised, rgba(255,255,255,0.04));padding:10px;border-radius:var(--radius-md);border:1px dashed var(--c-border);font-size:0.82rem;color:var(--c-text-muted);text-align:center;">
            ⏳ Awaiting AI review. You can manually verify or reject this report directly below.
          </div>
        `}
      </div>
    `;

    SurakshaUI.showModal({
      title: `📝 Manual Review — ${report.trackingToken}`,
      body: modalBody,
      actions: [
        {
          id: 'verify-now',
          label: '✅ Verify & Publish',
          cls: 'btn-success',
          onClick: async () => {
            await SurakshaDB.updateReport(id, { status: 'verified' });
            SurakshaUI.showToast('Report manually verified and published to map!', 'success');
          }
        },
        {
          id: 'reject-now',
          label: '❌ Reject',
          cls: 'btn-danger',
          onClick: async () => {
            await SurakshaDB.updateReport(id, { status: 'rejected' });
            SurakshaUI.showToast('Report rejected by administrator', 'info');
          }
        },
        {
          id: 'duplicate-now',
          label: '📋 Mark Duplicate',
          cls: 'btn-secondary',
          onClick: async () => {
            await SurakshaDB.updateReport(id, { status: 'flagged_duplicate' });
            SurakshaUI.showToast('Report marked as duplicate', 'info');
          }
        },
        {
          id: 'to-review-queue',
          label: '⏳ Move to Review Queue',
          cls: 'btn-secondary',
          onClick: async () => {
            await SurakshaDB.updateReport(id, { status: 'pending_review' });
            SurakshaUI.showToast('Report moved to manual review queue', 'info');
          }
        },
        {
          id: 'close-modal',
          label: 'Close',
          cls: 'btn-ghost',
          onClick: () => {}
        }
      ]
    });
  }

  async function requestAIReview(reportId) {
    const report = reports.find(r => r.id === reportId);
    if (!report) return null;

    // 1. Try Vercel / serverless backend endpoint
    try {
      const res = await fetch('/api/review-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, report })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.aiReview) {
          try {
            await SurakshaDB.updateReport(reportId, {
              aiReview: data.aiReview,
              status: data.status || 'pending_review'
            });
          } catch (dbErr) {
            console.warn('[Admin] Direct DB update notice:', dbErr.message);
          }
          return data;
        }
      }
    } catch (apiErr) {
      console.warn('[Admin] Serverless review call notice:', apiErr.message);
    }

    // 2. Try Firebase callable function if available
    if (window.firebase && typeof window.firebase.functions === 'function') {
      try {
        const retryFn = window.firebase.functions().httpsCallable('retryReportReview');
        const res = await retryFn({ reportId });
        return res.data;
      } catch (callErr) {
        console.warn('[Admin] Backend retry callable notice:', callErr.message);
      }
    }

    // 3. Fallback to client-side SurakshaAI runner
    try {
      return await SurakshaAI.processReport(reportId);
    } catch (clientErr) {
      console.error('[Admin] Client-side review error:', clientErr);
      return null;
    }
  }

  async function handleAction(action, id) {
    try {
      switch (action) {
        case 'manual-review':
          openManualReviewModal(id);
          break;
        case 'run-ai':
          SurakshaUI.showToast('Running AI review...', 'info');
          const result = await requestAIReview(id);
          if (result) {
            const isReject = result.action === 'reject' || result.status === 'ai_rejected';
            const isDup = result.action === 'flag_duplicate' || result.status === 'flagged_duplicate';
            const isErr = result.aiReview?.error;
            SurakshaUI.showToast(
              isErr ? 'AI review failed — manual review required' :
              isReject ? 'AI flagged as spam — auto-rejected' :
              isDup ? 'AI found possible duplicate — flagged for review' :
              'AI marked as genuine — forwarded for your review',
              (isErr || isReject) ? 'warning' : 'success'
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

  window.sendPendingToManualReview = async function () {
    const pending = reports.filter(r => r.status === 'pending_ai');
    if (pending.length === 0) {
      SurakshaUI.showToast('No reports waiting in AI queue', 'info');
      return;
    }
    for (const r of pending) {
      await SurakshaDB.updateReport(r.id, { status: 'pending_review' });
    }
    SurakshaUI.showToast(`Moved ${pending.length} report(s) to manual review queue`, 'success');
  };

  // ─── Batch AI Review ───
  window.runBatchAIReview = async function () {
    const pending = reports.filter(r => r.status === 'pending_ai' || (r.aiReview && r.aiReview.error));
    if (pending.length === 0) { SurakshaUI.showToast('No reports need AI review or retry', 'info'); return; }

    SurakshaUI.showToast(`Processing ${pending.length} reports with AI...`, 'info');
    let processed = 0;
    for (const report of pending) {
      await requestAIReview(report.id);
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
