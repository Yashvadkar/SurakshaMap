/**
 * tracking.js — Citizen Report Tracking Portal with 5-Stage Milestone Accountability
 */

(function () {
  'use strict';

  function init() {
    setupSearch();
    populateSavedTokens();

    // Check for token in URL hash or query params
    const hash = window.location.hash || '';
    const queryPart = hash.includes('?') ? hash.split('?')[1] : '';
    const params = new URLSearchParams(queryPart || window.location.search);
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
    const tokens = window.SurakshaUI?.getSavedTokens ? window.SurakshaUI.getSavedTokens() : [];

    if (tokens.length === 0) {
      container.innerHTML = '<p class="text-small text-muted">No previously submitted reports on this device.</p>';
      return;
    }

    container.innerHTML = `
      <p class="text-small text-muted" style="margin-bottom:8px;">Your recent anonymous reports:</p>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${tokens.slice(0, 8).map(t => `
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

    resultEl.innerHTML = '<div style="text-align:center;padding:2.5rem;"><div class="spinner spinner-lg" style="margin:0 auto;"></div><p class="text-muted" style="margin-top:12px;">Searching report records...</p></div>';

    try {
      const report = await window.SurakshaDB.getReportByToken(token);

      if (!report) {
        resultEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-title">Report Not Found</div>
            <p class="empty-state-desc">No incident found with tracking code <strong style="font-family:var(--font-mono);">${SurakshaUI.escapeHtml(token)}</strong>. Please check your 6-character receipt code and try again.</p>
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

  function getMilestoneIndex(status) {
    switch ((status || '').toLowerCase()) {
      case 'pending_ai':
        return 0; // Submitted, undergoing AI triage
      case 'pending_review':
        return 1; // AI Verified, pending municipal intake
      case 'verified':
        return 2; // Ward Escalated & Accepted
      case 'in_progress':
        return 3; // Field crew active
      case 'resolved':
        return 4; // Resolved & corroborated
      default:
        return 1;
    }
  }

  function renderReport(report, container) {
    const isRejected = ['rejected', 'ai_rejected'].includes(report.status);
    const activeStageIdx = isRejected ? -1 : getMilestoneIndex(report.status);

    const dept = SurakshaUI.getDepartmentForCategory(report.category);
    const ward = SurakshaUI.getWardForCoordinates(report.latitude, report.longitude);
    const sla = SurakshaUI.getSlaCountdown(report.submittedAt, report.severity);
    const stages = SurakshaUI.PIPELINE_STAGES || [
      { id: 'submitted', label: 'Report Submitted', icon: '📝', description: 'Citizen report received anonymously' },
      { id: 'ai_verified', label: 'AI Triage & Categorized', icon: '🤖', description: 'Severity estimated and category verified' },
      { id: 'ward_escalated', label: 'Ward & Dept Escalated', icon: '🏛️', description: 'Routed to jurisdiction ward & civic authority' },
      { id: 'in_progress', label: 'Field Crew In-Progress', icon: '🔧', description: 'Work order dispatched to field response team' },
      { id: 'resolved', label: 'Resolved & Corroborated', icon: '✅', description: 'Issue closed with evidence & citizen confirmation' }
    ];

    container.innerHTML = `
      <div class="card animate-fade-in-up" style="margin-bottom:1.5rem;box-shadow:var(--shadow-md);">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
              <span style="font-size:1.6rem;">${SurakshaUI.getCategoryIcon(report.category)}</span>
              <div>
                <h3 class="text-subheading" style="margin:0;font-size:1.15rem;font-weight:700;">${SurakshaUI.getCategoryLabel(report.category)}</h3>
                <span class="text-mono text-small text-muted">${report.trackingToken}</span>
              </div>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${SurakshaUI.createSeverityBadge(report.severity)}
            ${SurakshaUI.createStatusBadge(report.status)}
            <span class="badge ${sla.isBreached ? 'badge-rejected' : 'badge-pending'}" style="font-size:0.75rem;">
              ⏱️ ${sla.text}
            </span>
          </div>
        </div>

        <!-- Civic Accountability Badges -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:10px;margin-bottom:16px;padding:12px;background:var(--c-surface-elevated);border-radius:var(--radius-md);border:1px solid var(--c-border);">
          <div>
            <div class="text-caption text-muted" style="text-transform:uppercase;letter-spacing:0.04em;">Assigned Jurisdiction</div>
            <div style="font-weight:600;font-size:0.9rem;margin-top:2px;">🏛️ ${ward.name}</div>
            <div class="text-caption text-muted">${ward.zone}</div>
          </div>
          <div>
            <div class="text-caption text-muted" style="text-transform:uppercase;letter-spacing:0.04em;">Responsible Authority</div>
            <div style="font-weight:600;font-size:0.9rem;margin-top:2px;color:var(--c-primary);">${dept.icon} ${dept.name} (${dept.short})</div>
            <div class="text-caption text-muted">SLA Commitment: ${sla.targetHours}h</div>
          </div>
        </div>

        <!-- Description -->
        <p class="text-body" style="margin-bottom:16px;line-height:1.55;">${SurakshaUI.escapeHtml(report.description || 'No description provided')}</p>

        <!-- Evidence Photo -->
        ${report.photoUrl ? `
          <div style="margin-bottom:16px;">
            <img src="${report.photoUrl}" style="width:100%;max-height:240px;object-fit:cover;border-radius:var(--radius-md);border:1px solid var(--c-border);" alt="Evidence photo">
            <span class="text-caption text-muted" style="display:block;margin-top:4px;">🛡️ EXIF Metadata Sanitized (Anonymous Evidence)</span>
          </div>
        ` : ''}

        <!-- Geo & Time Metadata -->
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:0.85rem;color:var(--c-text-muted);margin-bottom:24px;border-bottom:1px solid var(--c-border);padding-bottom:16px;">
          <span>📍 ${Number(report.latitude).toFixed(5)}, ${Number(report.longitude).toFixed(5)}</span>
          <span>🕐 Submitted ${SurakshaUI.formatDate(report.submittedAt)}</span>
        </div>

        <!-- 5-Stage Milestone Stepper -->
        <div style="margin-bottom:24px;">
          <h4 class="text-subheading" style="margin-bottom:14px;font-size:1.02rem;font-weight:700;">Resolution Milestones</h4>
          
          ${isRejected ? `
            <div class="card" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);margin-bottom:16px;">
              <div style="font-weight:700;color:#DC2626;margin-bottom:4px;">❌ Report Rejected / Not Accepted</div>
              <p class="text-small text-muted" style="margin:0;">
                ${report.aiReview?.reason ? SurakshaUI.escapeHtml(report.aiReview.reason) : 'This report did not meet public safety verification criteria or was identified as duplicate.'}
              </p>
            </div>
          ` : `
            <div class="milestone-stepper" style="display:flex;flex-direction:column;gap:12px;">
              ${stages.map((stage, idx) => {
                const isCompleted = idx < activeStageIdx;
                const isCurrent = idx === activeStageIdx;
                const isUpcoming = idx > activeStageIdx;

                let stageDetail = stage.description;
                if (idx === 1 && report.aiReview?.confidence) {
                  stageDetail = `AI Confidence: ${Math.round(report.aiReview.confidence * 100)}% (${SurakshaUI.escapeHtml(report.aiReview.reason || 'Verified')})`;
                } else if (idx === 2) {
                  stageDetail = `Routed to ${dept.short} & ${ward.name}`;
                } else if (idx === 3 && isCurrent) {
                  stageDetail = `Field resolution active. Target SLA: ${sla.text}`;
                } else if (idx === 4 && isCompleted) {
                  stageDetail = 'Incident confirmed resolved on-ground.';
                }

                return `
                  <div class="milestone-step-item" style="display:flex;gap:14px;align-items:flex-start;position:relative;">
                    <div style="
                      width:36px;height:36px;border-radius:50%;
                      background:${isCompleted ? 'var(--c-success)' : isCurrent ? 'var(--c-primary)' : 'var(--c-surface-elevated)'};
                      color:${isCompleted || isCurrent ? '#FFFFFF' : 'var(--c-text-muted)'};
                      border:2px solid ${isCompleted ? 'var(--c-success)' : isCurrent ? 'var(--c-primary)' : 'var(--c-border)'};
                      display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;
                    ">
                      ${isCompleted ? '✓' : stage.icon}
                    </div>
                    <div style="flex:1;padding-bottom:12px;${idx < stages.length - 1 ? 'border-bottom:1px dashed var(--c-border);' : ''}">
                      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                        <span style="font-weight:${isCurrent ? '700' : '600'};font-size:0.95rem;color:${isCurrent ? 'var(--c-text)' : isUpcoming ? 'var(--c-text-muted)' : 'var(--c-text)'};">
                          ${stage.label}
                        </span>
                        <span class="badge ${isCompleted ? 'badge-verified' : isCurrent ? 'badge-active' : 'badge-ghost'}" style="font-size:0.7rem;">
                          ${isCompleted ? 'Completed' : isCurrent ? 'Current Stage' : 'Pending'}
                        </span>
                      </div>
                      <p class="text-caption text-muted" style="margin-top:4px;margin-bottom:0;line-height:1.4;">
                        ${stageDetail}
                      </p>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Citizen Corroboration Actions -->
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--c-border);">
          <p class="text-small text-muted" style="margin-bottom:10px;">Citizen Corroboration & Updates:</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm citizen-update-btn" data-action="issue_still_there" data-id="${report.id}">
              👍 Hazard Still There (+1)
            </button>
            <button class="btn btn-success btn-sm citizen-update-btn" data-action="resolved" data-id="${report.id}">
              ✅ Mark as Resolved
            </button>
          </div>
        </div>
      </div>
    `;

    // Attach citizen corroboration listeners
    container.querySelectorAll('.citizen-update-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;"></span> Submitting...';

        try {
          await window.SurakshaDB.updateReport(id, {
            citizenUpdate: action,
            citizenUpdateAt: new Date().toISOString()
          });
          SurakshaUI.showToast(
            action === 'resolved' ? 'Thank you! Marked as resolved for municipal verification.' : 'Corroboration logged! Civic urgency escalated.',
            'success'
          );
          const updated = await window.SurakshaDB.getReportByToken(report.trackingToken);
          if (updated) renderReport(updated, container);
        } catch (err) {
          console.error('Update failed:', err);
          SurakshaUI.showToast('Update failed. Please try again.', 'error');
          btn.disabled = false;
          btn.innerHTML = action === 'resolved' ? '✅ Mark as Resolved' : '👍 Hazard Still There (+1)';
        }
      });
    });
  }

  window.SurakshaTracking = { init };
})();
