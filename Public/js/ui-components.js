/**
 * ui-components.js — Shared UI Components & Utilities
 * Toasts, modals, badges, ripple effects, animated counters, helper functions
 */

(function () {
  'use strict';

  const CATEGORY_ICONS = {
    'broken streetlight': '💡',
    'open manhole': '🕳️',
    'waterlogging': '🌊',
    'unsafe crossing': '🚸',
    'broken footpath': '🧱',
    'obstruction': '🚧',
    'harassment spot': '🚨',
    'other': '⚠️'
  };

  const CATEGORY_LABELS = {
    'broken streetlight': 'Broken Streetlight',
    'open manhole': 'Open Manhole',
    'waterlogging': 'Waterlogging',
    'unsafe crossing': 'Unsafe Crossing',
    'broken footpath': 'Broken Footpath',
    'obstruction': 'Obstruction',
    'harassment spot': 'Unsafe Area',
    'other': 'Other Hazard'
  };

  const STATUS_MAP = {
    'pending_ai': { cls: 'badge-ai', text: 'AI Review', icon: '🤖' },
    'ai_rejected': { cls: 'badge-rejected', text: 'AI Rejected', icon: '🚫' },
    'flagged_duplicate': { cls: 'badge-duplicate', text: 'Duplicate', icon: '📋' },
    'pending_review': { cls: 'badge-pending', text: 'Pending Review', icon: '⏳' },
    'verified': { cls: 'badge-resolved', text: 'Verified', icon: '✅' },
    'in_progress': { cls: 'badge-progress', text: 'In Progress', icon: '🔧' },
    'resolved': { cls: 'badge-resolved', text: 'Resolved', icon: '✅' },
    'rejected': { cls: 'badge-rejected', text: 'Rejected', icon: '❌' }
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
  function showModal({ title, body, actions = [], onClose }) {
    const existing = document.querySelector('.modal-backdrop');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="text-subheading">${escapeHtml(title)}</h3>
          <button class="btn-icon modal-close" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">${body}</div>
        ${actions.length ? `<div class="modal-footer">${actions.map(a => 
          `<button class="btn ${a.cls || 'btn-secondary'}" data-action="${a.id}">${a.label}</button>`
        ).join('')}</div>` : ''}
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
      if (btn && a.onClick) btn.addEventListener('click', () => { a.onClick(); close(); });
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
    return CATEGORY_ICONS[(category || '').toLowerCase()] || '⚠️';
  }

  function getCategoryLabel(category) {
    return CATEGORY_LABELS[(category || '').toLowerCase()] || category || 'Other';
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
    SEVERITY_MAP
  };
})();
