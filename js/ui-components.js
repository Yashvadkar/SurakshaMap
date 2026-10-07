/**
 * ui-components.js — Shared UI Components & Utilities
 * Toasts, modals, badges, ripple effects, animated counters, helper functions
 */

(function () {
  'use strict';

  const CATEGORY_ICONS = {
    'accident': '💥',
    'road accident': '💥',
    'road_accident': '💥',
    'broken streetlight': '💡',
    'broken_streetlight': '💡',
    'broken_lighting': '💡',
    'lighting': '💡',
    'open manhole': '🕳️',
    'open_manhole': '🕳️',
    'manhole': '🕳️',
    'waterlogging': '🌊',
    'waterlogged': '🌊',
    'unsafe crossing': '🚸',
    'unsafe_crossing': '🚸',
    'crossing': '🚸',
    'broken footpath': '🧱',
    'broken_footpath': '🧱',
    'footpath': '🧱',
    'infrastructure': '🧱',
    'obstruction': '🚧',
    'road_obstruction': '🚧',
    'harassment spot': '🚨',
    'harassment_spot': '🚨',
    'harassment': '🚨',
    'unsafe area': '🚨',
    'unsafe_area': '🚨',
    'pothole': '🕳️',
    'potholes': '🕳️',
    'other': '⚠️',
    'other hazard': '⚠️',
    'other_hazard': '⚠️'
  };

  const CATEGORY_LABELS = {
    'accident': 'Road Accident',
    'road accident': 'Road Accident',
    'road_accident': 'Road Accident',
    'broken streetlight': 'Broken Streetlight',
    'broken_streetlight': 'Broken Streetlight',
    'broken_lighting': 'Broken Streetlight',
    'lighting': 'Street Lighting Hazard',
    'open manhole': 'Open Manhole',
    'open_manhole': 'Open Manhole',
    'manhole': 'Open Manhole',
    'waterlogging': 'Severe Waterlogging',
    'waterlogged': 'Severe Waterlogging',
    'unsafe crossing': 'Unsafe Crossing',
    'unsafe_crossing': 'Unsafe Crossing',
    'crossing': 'Pedestrian Crossing Hazard',
    'broken footpath': 'Broken Footpath',
    'broken_footpath': 'Broken Footpath',
    'footpath': 'Damaged Footpath',
    'infrastructure': 'Civic Infrastructure Hazard',
    'obstruction': 'Road Obstruction',
    'road_obstruction': 'Road Obstruction',
    'harassment spot': 'Unsafe / Harassment Area',
    'harassment_spot': 'Unsafe / Harassment Area',
    'harassment': 'Unsafe Area',
    'unsafe area': 'Unsafe Public Area',
    'unsafe_area': 'Unsafe Public Area',
    'pothole': 'Severe Pothole',
    'potholes': 'Severe Potholes',
    'other': 'Other Hazard',
    'other hazard': 'Other Hazard',
    'other_hazard': 'Other Hazard'
  };

  // ─── Municipal Civic Departments Matrix & SLAs ───
  const CIVIC_DEPARTMENTS = {
    'ELECTRICAL': {
      code: 'ELECTRICAL',
      name: 'Electrical & Street Lighting',
      icon: '💡',
      defaultSlaHours: 24,
      deskEmail: 'lighting.desk@mcgm.gov.in'
    },
    'SWD': {
      code: 'SWD',
      name: 'Storm Water Drainage & Sewage',
      icon: '🌊',
      defaultSlaHours: 12,
      deskEmail: 'swd.control@mcgm.gov.in'
    },
    'ROADS_BRIDGES': {
      code: 'ROADS_BRIDGES',
      name: 'Roads, Pavements & Infrastructure',
      icon: '🧱',
      defaultSlaHours: 48,
      deskEmail: 'roads.dispatch@mcgm.gov.in'
    },
    'TRAFFIC_POLICE': {
      code: 'TRAFFIC_POLICE',
      name: 'Traffic Planning & Police Control',
      icon: '🚦',
      defaultSlaHours: 6,
      deskEmail: 'traffic.ops@mahapolice.gov.in'
    },
    'DISASTER_MGMT': {
      code: 'DISASTER_MGMT',
      name: 'Emergency & Community Safety Patrol',
      icon: '🚨',
      defaultSlaHours: 8,
      deskEmail: 'safety.ward@mcgm.gov.in'
    }
  };

  const CATEGORY_DEPARTMENT_ROUTING = {
    'broken streetlight': { dept: 'ELECTRICAL', slaHours: 24, defaultSeverity: 'high' },
    'broken_streetlight': { dept: 'ELECTRICAL', slaHours: 24, defaultSeverity: 'high' },
    'broken_lighting': { dept: 'ELECTRICAL', slaHours: 24, defaultSeverity: 'high' },
    'lighting': { dept: 'ELECTRICAL', slaHours: 24, defaultSeverity: 'high' },
    'open manhole': { dept: 'SWD', slaHours: 6, defaultSeverity: 'critical' },
    'open_manhole': { dept: 'SWD', slaHours: 6, defaultSeverity: 'critical' },
    'manhole': { dept: 'SWD', slaHours: 6, defaultSeverity: 'critical' },
    'waterlogging': { dept: 'SWD', slaHours: 12, defaultSeverity: 'high' },
    'waterlogged': { dept: 'SWD', slaHours: 12, defaultSeverity: 'high' },
    'road accident': { dept: 'TRAFFIC_POLICE', slaHours: 2, defaultSeverity: 'critical' },
    'road_accident': { dept: 'TRAFFIC_POLICE', slaHours: 2, defaultSeverity: 'critical' },
    'accident': { dept: 'TRAFFIC_POLICE', slaHours: 2, defaultSeverity: 'critical' },
    'unsafe crossing': { dept: 'TRAFFIC_POLICE', slaHours: 12, defaultSeverity: 'high' },
    'unsafe_crossing': { dept: 'TRAFFIC_POLICE', slaHours: 12, defaultSeverity: 'high' },
    'broken footpath': { dept: 'ROADS_BRIDGES', slaHours: 48, defaultSeverity: 'medium' },
    'broken_footpath': { dept: 'ROADS_BRIDGES', slaHours: 48, defaultSeverity: 'medium' },
    'footpath': { dept: 'ROADS_BRIDGES', slaHours: 48, defaultSeverity: 'medium' },
    'infrastructure': { dept: 'ROADS_BRIDGES', slaHours: 48, defaultSeverity: 'medium' },
    'obstruction': { dept: 'ROADS_BRIDGES', slaHours: 24, defaultSeverity: 'high' },
    'pothole': { dept: 'ROADS_BRIDGES', slaHours: 36, defaultSeverity: 'high' },
    'unsafe area': { dept: 'DISASTER_MGMT', slaHours: 8, defaultSeverity: 'high' },
    'unsafe_area': { dept: 'DISASTER_MGMT', slaHours: 8, defaultSeverity: 'high' },
    'harassment spot': { dept: 'DISASTER_MGMT', slaHours: 8, defaultSeverity: 'critical' },
    'harassment': { dept: 'DISASTER_MGMT', slaHours: 8, defaultSeverity: 'critical' },
    'other': { dept: 'ROADS_BRIDGES', slaHours: 48, defaultSeverity: 'medium' }
  };

  const MUNICIPAL_WARDS = [
    { id: 'BMC_KW', name: 'Ward K-West (Andheri West)', city: 'Mumbai', bounds: { minLat: 19.11, maxLat: 19.16, minLng: 72.81, maxLng: 72.86 } },
    { id: 'BMC_KE', name: 'Ward K-East (Andheri East)', city: 'Mumbai', bounds: { minLat: 19.10, maxLat: 19.15, minLng: 72.85, maxLng: 72.90 } },
    { id: 'BMC_FN', name: 'Ward F-North (Matunga / Sion)', city: 'Mumbai', bounds: { minLat: 19.01, maxLat: 19.06, minLng: 72.84, maxLng: 72.88 } },
    { id: 'NMMC_BELAPUR', name: 'Ward Belapur (Sector 1-20)', city: 'Navi Mumbai', bounds: { minLat: 19.00, maxLat: 19.04, minLng: 73.02, maxLng: 73.06 } },
    { id: 'NMMC_VASHI', name: 'Ward Vashi (Sectors 1-30)', city: 'Navi Mumbai', bounds: { minLat: 19.06, maxLat: 19.09, minLng: 72.99, maxLng: 73.02 } },
    { id: 'DELHI_CENTRAL', name: 'Central Zone (Connaught Place / ITO)', city: 'Delhi', bounds: { minLat: 28.61, maxLat: 28.66, minLng: 77.20, maxLng: 77.26 } }
  ];

  const PIPELINE_STAGES = [
    { key: 'SUBMITTED', label: 'Report Submitted', icon: '📝', step: 1 },
    { key: 'AI_VERIFIED', label: 'AI Triage & Scored', icon: '🤖', step: 2 },
    { key: 'WARD_ASSIGNED', label: 'Escalated to Ward Desk', icon: '🏛️', step: 3 },
    { key: 'IN_PROGRESS', label: 'Field Work Order Dispatched', icon: '🔧', step: 4 },
    { key: 'RESOLVED', label: 'Resolved with Evidence', icon: '✅', step: 5 }
  ];

  const STATUS_MAP = {
    'pending_ai': { cls: 'badge-ai', text: 'AI Review', icon: '🤖' },
    'ai_rejected': { cls: 'badge-rejected', text: 'AI Rejected', icon: '🚫' },
    'flagged_duplicate': { cls: 'badge-duplicate', text: 'Duplicate', icon: '📋' },
    'pending_review': { cls: 'badge-pending', text: 'Pending Review', icon: '⏳' },
    'ward_assigned': { cls: 'badge-progress', text: 'Ward Assigned', icon: '🏛️' },
    'verified': { cls: 'badge-resolved', text: 'Verified', icon: '✅' },
    'in_progress': { cls: 'badge-progress', text: 'In Progress', icon: '🔧' },
    'resolved': { cls: 'badge-resolved', text: 'Resolved', icon: '✅' },
    'rejected': { cls: 'badge-rejected', text: 'Rejected', icon: '❌' }
  };

  
  const LOCATION_TYPE_LABELS = {
    'school': '🏫 School Zone',
    'bus_stop': '🚏 Bus Stop',
    'transit_hub': '🚆 Transit Hub',
    'park': '🌳 Community Park',
    'community_space': '🏛️ Community Space',
    'road_intersection': '🚦 Intersection',
    'general': '📍 General Public'
  };

  const INFRASTRUCTURE_LABELS = {
    'poor_lighting': '💡 Poor Lighting',
    'pothole': '🕳️ Severe Pothole',
    'broken_signal': '🚦 Broken Signal',
    'missing_sidewalk': '🚶 Missing Sidewalk',
    'waterlogged': '🌊 Waterlogged',
    'blind_corner': '⚠️ Blind Corner',
    'faded_zebra_crossing': '🚸 Faded Crossing',
    'normal': 'Standard'
  };

  const SEVERITY_MAP = {
    'low': { cls: 'badge-low', text: 'Low' },
    'medium': { cls: 'badge-moderate', text: 'Moderate' },
    'high': { cls: 'badge-high', text: 'High' },
    'critical': { cls: 'badge-critical', text: 'Critical' }
  };

  // ─── Toast Notifications ───
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ─── Modal ───
  function showModal({ title, body, actions = [], onClose, modalClass = '' }) {
    const existing = document.querySelector('.modal-backdrop');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    let footerHtml = '';
    if (actions.length) {
      const isReviewModal = modalClass.includes('modal-lg') || modalClass.includes('modal-review') || actions.length >= 4;
      const primaryActions = actions.filter(a => a.id !== 'close-modal' && a.id !== 'close' && a.id !== 'delete-now');
      const secondaryActions = actions.filter(a => a.id === 'close-modal' || a.id === 'close' || a.id === 'delete-now');

      if (isReviewModal && primaryActions.length >= 3) {
        footerHtml = `
          <div class="modal-footer modal-footer-structured">
            <div class="modal-footer-grid">
              ${primaryActions.map(a => `
                <button type="button" class="btn ${a.cls || 'btn-secondary'} modal-footer-btn" data-action="${a.id}">
                  ${a.label}
                </button>
              `).join('')}
            </div>
            ${secondaryActions.length ? `
              <div class="modal-footer-subrow">
                ${secondaryActions.map(a => `
                  <button type="button" class="btn ${a.cls || 'btn-ghost'} btn-sm" data-action="${a.id}">
                    ${a.label}
                  </button>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `;
      } else {
        footerHtml = `
          <div class="modal-footer">
            ${actions.map(a => `
              <button type="button" class="btn ${a.cls || 'btn-secondary'}" data-action="${a.id}">${a.label}</button>
            `).join('')}
          </div>
        `;
      }
    }

    backdrop.innerHTML = `
      <div class="modal-content ${modalClass}">
        <div class="modal-header">
          <h3 class="text-subheading">${escapeHtml(title)}</h3>
          <button class="btn-icon modal-close" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">${body}</div>
        ${footerHtml}
      </div>
    `;

    const close = () => {
      backdrop.style.opacity = '0';
      setTimeout(() => { backdrop.remove(); if (onClose) onClose(); }, 200);
    };

    backdrop.querySelector('.modal-close').addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

    actions.forEach(a => {
      const btn = backdrop.querySelector(`[data-action="${a.id}"]`);
      if (btn && a.onClick) {
        btn.addEventListener('click', async () => {
          try {
            await a.onClick();
          } finally {
            if (!a.preventClose) close();
          }
        });
      }
    });

    document.body.appendChild(backdrop);
    return close;
  }

  // ─── Badge Generators ───
  function createStatusBadge(status) {
    const item = STATUS_MAP[status] || STATUS_MAP['pending_review'];
    return `<span class="badge ${item.cls}">${item.icon} ${item.text}</span>`;
  }

  function createSeverityBadge(severity) {
    const item = SEVERITY_MAP[severity] || SEVERITY_MAP['low'];
    return `<span class="badge ${item.cls}">${item.text}</span>`;
  }

  function getCategoryIcon(category) {
    if (!category) return '⚠️';
    const key = String(category).trim().toLowerCase();
    return CATEGORY_ICONS[key] || '⚠️';
  }

  function getLocationTypeLabel(t) {
    return LOCATION_TYPE_LABELS[(t || '').toLowerCase()] || t || 'General';
  }

  function getInfrastructureLabel(i) {
    return INFRASTRUCTURE_LABELS[(i || '').toLowerCase()] || i || 'Normal';
  }

  function getCategoryLabel(category) {
    if (!category) return 'Other Hazard';
    const key = String(category).trim().toLowerCase();
    if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
    // Normalize snake_case or kebab-case to Title Case
    return key
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function getDepartmentForCategory(category) {
    const key = (category || '').trim().toLowerCase();
    const route = CATEGORY_DEPARTMENT_ROUTING[key] || { dept: 'ROADS_BRIDGES', slaHours: 48, defaultSeverity: 'medium' };
    const deptInfo = CIVIC_DEPARTMENTS[route.dept] || CIVIC_DEPARTMENTS['ROADS_BRIDGES'];
    return {
      code: deptInfo.code,
      name: deptInfo.name,
      icon: deptInfo.icon,
      slaHours: route.slaHours,
      defaultSeverity: route.defaultSeverity,
      deskEmail: deptInfo.deskEmail
    };
  }

  function getWardForCoordinates(lat, lng) {
    const nLat = Number(lat);
    const nLng = Number(lng);
    if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) {
      return { id: 'BMC_KW', name: 'Ward K-West (Andheri West)', city: 'Mumbai' };
    }
    for (const w of MUNICIPAL_WARDS) {
      if (nLat >= w.bounds.minLat && nLat <= w.bounds.maxLat && nLng >= w.bounds.minLng && nLng <= w.bounds.maxLng) {
        return { id: w.id, name: w.name, city: w.city };
      }
    }
    return { id: 'BMC_CENTRAL', name: 'Central City Ward (Civic HQ)', city: 'Municipal Jurisdiction' };
  }

  function getSlaCountdown(submittedAt, slaHours = 24) {
    if (!submittedAt) return { hoursRemaining: slaHours, isBreached: false, label: `${slaHours}h SLA` };
    const subDate = new Date(submittedAt);
    if (isNaN(subDate.getTime())) return { hoursRemaining: slaHours, isBreached: false, label: `${slaHours}h SLA` };
    const deadline = new Date(subDate.getTime() + slaHours * 3600000);
    const now = new Date();
    const diffMs = deadline - now;
    const diffHours = Math.round(diffMs / 3600000);
    if (diffMs <= 0) {
      return { hoursRemaining: 0, isBreached: true, label: `🚨 SLA Breached (${Math.abs(diffHours)}h overdue)` };
    }
    return { hoursRemaining: diffHours, isBreached: false, label: `⏳ ${diffHours}h left to SLA deadline` };
  }

  // ─── Ripple Effect ───
  function createRipple(e) {
    const el = e.currentTarget || e.target;
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    const rect = el.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    ripple.className = 'ripple-effect';
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }

  // ─── Animated Counter ───
  function animateCounter(el, target, duration = 1200) {
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    const diff = target - start;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = Math.round(start + diff * eased);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ─── Intersection Observer for Reveal Animations ───
  function initRevealObserver() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return observer;
  }

  // ─── Helpers ───
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(isoStr) {
    if (!isoStr) return 'Just now';
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return 'Just now';
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: diffDays > 365 ? 'numeric' : undefined });
  }

  function generateToken() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const prefix = SURAKSHAMAP_CONFIG?.app?.trackingTokenPrefix || 'SM';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return `${prefix}-${code}`;
  }

  function generateId() {
    return 'rpt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
  }

  // ─── Saved Tokens Management ───
  const TOKENS_KEY = 'surakshamap_my_tokens_v4';

  function saveToken(token) {
    try {
      const tokens = getSavedTokens();
      if (!tokens.includes(token)) {
        tokens.unshift(token);
        localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens.slice(0, 50)));
      }
    } catch (e) { console.warn('Could not save token:', e); }
  }

  function getSavedTokens() {
    try {
      return JSON.parse(localStorage.getItem(TOKENS_KEY) || '[]');
    } catch { return []; }
  }

  // ─── Export ───
  window.SurakshaUI = {
    showToast,
    showModal,
    createStatusBadge,
    createSeverityBadge,
    getCategoryIcon,
    getCategoryLabel,
    getLocationTypeLabel,
    getInfrastructureLabel,
    createRipple,
    animateCounter,
    initRevealObserver,
    escapeHtml,
    formatDate,
    generateToken,
    generateId,
    saveToken,
    getSavedTokens,
    CATEGORY_ICONS,
    CATEGORY_LABELS,
    STATUS_MAP,
    SEVERITY_MAP,
    CIVIC_DEPARTMENTS,
    CATEGORY_DEPARTMENT_ROUTING,
    MUNICIPAL_WARDS,
    PIPELINE_STAGES,
    getDepartmentForCategory,
    getWardForCoordinates,
    getSlaCountdown
  };
})();
