/**
 * app.js — SPA Router & Page Lifecycle Controller
 */

(function () {
  'use strict';

  let currentRoute = 'home';

  const ROUTES = {
    '': 'home', 'home': 'home', 'map': 'map', 'report': 'report',
    'insights': 'insights', 'track': 'track', 'about': 'about'
  };

  document.addEventListener('DOMContentLoaded', () => {
    setupRouting();
    setupNavigation();
    handleRoute(window.location.hash || '#/');
    SurakshaUI.initRevealObserver();
  });

  function setupRouting() {
    window.addEventListener('hashchange', () => handleRoute(window.location.hash));
  }

  function handleRoute(hash) {
    let clean = hash.replace(/^#\/?/, '').split('?')[0];
    const route = ROUTES[clean] || 'home';
    currentRoute = route;

    // Toggle views
    document.querySelectorAll('.view-container').forEach(el => {
      el.classList.remove('active-view');
    });
    const activeEl = document.getElementById(`view-${route}`);
    if (activeEl) {
      activeEl.classList.add('active-view');
    }

    // Sync navigation
    updateNav(route);

    // Route lifecycle
    switch (route) {
      case 'home':
        if (window.SurakshaHome) window.SurakshaHome.init();
        break;
      case 'map':
        setTimeout(() => {
          if (window.SurakshaMap) {
            window.SurakshaMap.init();
            const m = window.SurakshaMap.getMap();
            if (m) m.invalidateSize();
          }
        }, 150);
        break;
      case 'report':
        if (window.SurakshaWizard) window.SurakshaWizard.init();
        break;
      case 'insights':
        if (window.SurakshaInsights) window.SurakshaInsights.init();
        break;
      case 'track':
        if (window.SurakshaTracking) window.SurakshaTracking.init();
        break;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateNav(route) {
    // Mobile bottom nav
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
      const target = item.getAttribute('data-route');
      item.classList.toggle('active', target === route);
    });
    // Desktop nav
    document.querySelectorAll('.nav-links-desktop a').forEach(item => {
      const target = item.getAttribute('data-route');
      item.classList.toggle('active', target === route);
    });
  }

  function setupNavigation() {
    // Add ripple to all buttons with btn class
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-primary, .btn-secondary');
      if (btn) SurakshaUI.createRipple(e);
    });

    // FAB report button
    const fab = document.getElementById('fab-report');
    if (fab) {
      fab.addEventListener('click', () => {
        window.location.hash = '#/report';
      });
    }
  }

  window.SurakshaApp = { handleRoute, getCurrentRoute: () => currentRoute };
})();
