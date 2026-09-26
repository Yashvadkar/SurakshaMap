/**
 * tracking.js — Citizen Report Tracking Portal
 */

(function () {
  'use strict';

  const STATUS_ORDER = ['pending_ai', 'pending_review', 'verified', 'in_progress', 'resolved'];
  const STATUS_LABELS = {
    'pending_ai': 'AI Review',
    'ai_rejected': 'Rejected by AI',
    'flagged_duplicate': 'Flagged as Duplicate',
    'pending_review': 'Pending Admin Review',
    'verified': 'Verified & Accepted',
    'in_progress': 'In Progress',
    'resolved': 'Resolved',
    'rejected': 'Rejected'
  };

  function init() {
    setupSearch();
    populateSavedTokens();

    // Check for token in URL
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const urlToken = params.get('token');
    if (urlToken) {
      const input = document.getElementById('track-token-input');
      if (input) input.value = urlToken;
      searchReport(urlToken);
    }
  }

  function setupSearch() {
    const searchBtn = document.getElementById('track-search-btn');
    const input = document.getElementById('track-token-input');
    if (searchBtn) searchBtn.addEventListener('click', () => searchReport(input?.value));
    if (input) input.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchReport(input.value); });
  }

  function populateSavedTokens() {
    const container = document.getElementById('saved-tokens');
    if (!container) return;
    const tokens = SurakshaUI.getSavedTokens();

    if (tokens.length === 0) {
      container.innerHTML = '<p class="text-small text-muted">No previously submitted reports.</p>';
      return;
    }

    container.innerHTML = `
      <p class="text-small text-muted" style="margin-bottom:8px;">Your recent reports:</p>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${tokens.slice(0, 10).map(t => `
          <button class="btn btn-secondary btn-sm saved-token-btn" data-token="${t}" style="font-family:var(--font-mono);font-size:0.78rem;">
            ${t}
          </button>
        `).join('')}
      </div>
    `;

    container.querySelectorAll('.saved-token-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('track-token-input');
        if (input) input.value = btn.dataset.token;
        searchReport(btn.dataset.token);
      });
    });
  }

  async function searchReport(token) {
    token = (token || '').trim().toUpperCase();
    const resultEl = document.getElementById('track-result');
    if (!resultEl) return;

    if (!token || token.length < 4) {
      SurakshaUI.showToast('Please enter a valid tracking token', 'warning');
      return;
    }

    resultEl.innerHTML = '<div style="text-align:center;padding:2rem;"><div class="spinner spinner-lg" style="margin:0 auto;"></div><p class="text-muted" style="margin-top:12px;">Searching...</p></div>';

    try {
      const report = await window.SurakshaDB.getReportByToken(token);

      if (!report) {
        resultEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-title">Report Not Found</div>
            <p class="empty-state-desc">No report found with token <strong style="font-family:var(--font-mono);">${SurakshaUI.escapeHtml(token)}</strong>. Please check and try again.</p>
          </div>
        `;
        return;
      }

      renderReport(report, resultEl);
    } catch (err) {
      console.error('Track search error:', err);
      resultEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><p class="text-muted">Search failed. Please try again.</p></div>';
    }
  }

  function renderReport(report, container) {
    const currentIdx = STATUS_ORDER.indexOf(report.status);
    const isTerminal = ['resolved', 'rejected', 'ai_rejected'].includes(report.status);

    container.innerHTML = `
      <div class="card animate-fade-in-up" style="margin-bottom:1.5rem;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="font-size:1.5rem;">${SurakshaUI.getCategoryIcon(report.category)}</span>
              <h3 class="text-subheading">${SurakshaUI.getCategoryLabel(report.category)}</h3>
            </div>
            <span class="text-mono text-small text-muted">${report.trackingToken}</span>
          </div>
          <div style="display:flex;gap:6px;">
            ${SurakshaUI.createSeverityBadge(report.severity)}
            ${SurakshaUI.createStatusBadge(report.status)}
          </div>
        </div>

        <p class="text-body" style="margin-bottom:16px;">${SurakshaUI.escapeHtml(report.description)}</p>

        ${report.photoUrl ? `<img src="${report.photoUrl}" style="width:100%;max-height:200px;object-fit:cover;border-radius:var(--radius-md);margin-bottom:16px;" alt="Evidence photo">` : ''}

        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:0.85rem;color:var(--c-text-muted);margin-bottom:20px;">
          <span>📍 ${Number(report.latitude).toFixed(5)}, ${Number(report.longitude).toFixed(5)}</span>
          <span>🕐 ${SurakshaUI.formatDate(report.submittedAt)}</span>
        </div>

        <!-- Status Timeline -->
        <h4 class="text-subheading" style="margin-bottom:12px;">Status Timeline</h4>
        <div class="timeline">
          ${STATUS_ORDER.map((status, i) => {
            const isCompleted = i < currentIdx;
            const isActive = status === report.status;
            const isFuture = i > currentIdx && !isTerminal;
            return `
              <div class="timeline-item ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}" style="${isFuture || (isTerminal && i > currentIdx) ? 'opacity:0.4;' : ''}">
                <div class="timeline-dot"></div>
                <div class="timeline-title">${STATUS_LABELS[status] || status}</div>
                ${isActive ? '<div class="timeline-time">Current status</div>' : ''}
                ${isCompleted ? '<div class="timeline-time">Completed</div>' : ''}
              </div>
            `;
          }).join('')}
        </div>

        ${report.aiReview ? `
          <div class="card" style="margin-top:16px;background:var(--c-surface-elevated);">
            <h4 class="text-small" style="font-weight:600;margin-bottom:4px;">🤖 AI Review</h4>
            <p class="text-small text-muted">${SurakshaUI.escapeHtml(report.aiReview.reason)}</p>
            <p class="text-caption" style="margin-top:4px;">Confidence: ${Math.round((report.aiReview.confidence || 0) * 100)}%</p>
          </div>
        ` : ''}

        ${report.citizenUpdate ? `
          <div class="card" style="margin-top:12px;background:${report.citizenUpdate === 'resolved' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'};">
            <p class="text-small" style="font-weight:600;">
              ${report.citizenUpdate === 'resolved' ? '✅ You marked this as resolved' : '⚠️ You reported: Issue Still There'}
            </p>
            ${report.citizenUpdateAt ? `<p class="text-caption">${SurakshaUI.formatDate(report.citizenUpdateAt)}</p>` : ''}
          </div>
        ` : ''}

        <!-- Citizen Action Buttons -->
        ${!isTerminal || report.status === 'resolved' || report.status === 'verified' || report.status === 'in_progress' ? `
          <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--c-border);">
            <p class="text-small text-muted" style="margin-bottom:10px;">Update this report:</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-success btn-sm citizen-update-btn" data-action="resolved" data-id="${report.id}">
                ✅ Mark as Resolved
              </button>
              <button class="btn btn-secondary btn-sm citizen-update-btn" data-action="issue_still_there" data-id="${report.id}">
                ⚠️ Issue Still There
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Setup citizen update buttons
    container.querySelectorAll('.citizen-update-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';

        try {
          await window.SurakshaDB.updateReport(id, {
            citizenUpdate: action,
            citizenUpdateAt: new Date().toISOString()
          });
          SurakshaUI.showToast(
            action === 'resolved' ? 'Thank you! Report marked as resolved.' : 'Thank you for the update. The issue has been noted.',
            'success'
          );
          // Re-render
          const updated = await window.SurakshaDB.getReportByToken(report.trackingToken);
          if (updated) renderReport(updated, container);
        } catch (err) {
          console.error('Update failed:', err);
          SurakshaUI.showToast('Update failed. Please try again.', 'error');
          btn.disabled = false;
          btn.innerHTML = action === 'resolved' ? '✅ Mark as Resolved' : '⚠️ Issue Still There';
        }
      });
    });
  }

  window.SurakshaTracking = { init };
})();
