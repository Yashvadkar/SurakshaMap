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
        if (window.SurakshaHome) {
          window.SurakshaHome.init();
          setTimeout(() => {
            if (window.SurakshaHome.invalidateSize) window.SurakshaHome.invalidateSize();
          }, 150);
        }
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

  
  /* ── SurakshaHome Controller (Reference Architecture) ── */
  let homeMap = null;
  let homeTileLayer = null;
  let homeMarkersLayer = null;

  function getHomeGoogleApiKey() {
    return window.__ENV__?.GOOGLE_MAPS_API_KEY || window.SURAKSHAMAP_CONFIG?.googleMapsApiKey || '';
  }

  function createHomeTileLayer(isDark) {
    const key = getHomeGoogleApiKey();
    const hasGoogleKey = key && key !== 'YOUR_GOOGLE_MAPS_API_KEY';

    if (hasGoogleKey) {
      return L.tileLayer(`https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=${key}`, {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 20,
        className: isDark ? 'map-tiles-dark' : '',
        attribution: '&copy; Google Maps'
      });
    }

    if (isDark) {
      return L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        attribution: '&copy; Esri'
      });
    }

    return L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '&copy; Esri'
    });
  }

  function initHomeMap(reports, hotspots) {
    const mapEl = document.getElementById('home-map');
    if (!mapEl || typeof L === 'undefined') return;

    try {
      const isDark = document.body.classList.contains('dark-theme') || document.documentElement.getAttribute('data-theme') === 'dark';

      if (!homeMap) {
        homeMap = L.map('home-map', {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: false,
          dragging: true
        });

        homeTileLayer = createHomeTileLayer(isDark);
        homeTileLayer.addTo(homeMap);

        homeMarkersLayer = L.layerGroup().addTo(homeMap);

        window.addEventListener('themeChanged', () => {
          if (homeMap && homeTileLayer) {
            const dark = document.body.classList.contains('dark-theme') || document.documentElement.getAttribute('data-theme') === 'dark';
            homeMap.removeLayer(homeTileLayer);
            homeTileLayer = createHomeTileLayer(dark);
            homeTileLayer.addTo(homeMap);
          }
        });

        if (window.ResizeObserver) {
          const ro = new ResizeObserver(() => {
            if (homeMap) homeMap.invalidateSize();
          });
          ro.observe(mapEl);
        }
      }

      const validReports = (reports || []).filter(r => r.latitude && r.longitude);
      const center = validReports.length > 0
        ? [Number(validReports[0].latitude), Number(validReports[0].longitude)]
        : [19.0760, 72.8777];

      homeMap.setView(center, 13);
      setTimeout(() => { if (homeMap) homeMap.invalidateSize(); }, 150);
      setTimeout(() => { if (homeMap) homeMap.invalidateSize(); }, 400);

      if (homeMarkersLayer) {
        homeMarkersLayer.clearLayers();
        validReports.slice(0, 10).forEach(r => {
          const isHigh = r.severity === 'critical' || r.severity === 'high';
          const isMed = r.severity === 'moderate' || r.severity === 'medium';
          const color = isHigh ? '#C94E43' : (isMed ? '#D9654E' : '#E5A23A');

          L.circleMarker([Number(r.latitude), Number(r.longitude)], {
            radius: 8,
            fillColor: color,
            color: '#FFFFFF',
            weight: 2,
            opacity: 0.95,
            fillOpacity: 0.85
          }).addTo(homeMarkersLayer);
        });
      }
    } catch (e) {
      console.warn('[SurakshaHome] Map preview init notice:', e.message);
    }
  }

  const SurakshaHome = {
    getMap: () => homeMap,
    invalidateSize: () => { if (homeMap) homeMap.invalidateSize(); },
    init: async function () {
      try {
        if (!window.SurakshaDB) return;
        const reports = await window.SurakshaDB.getAllReports();
        const total = reports.length;
        const resolved = reports.filter(r => r.status === 'resolved').length;
        const hotspots = window.SurakshaRisk ? window.SurakshaRisk.groupIntoHotspots(reports) : [];

        const elReports = document.getElementById('metric-reports');
        const elResolved = document.getElementById('metric-resolved');
        const elHotspots = document.getElementById('metric-hotspots');

        if (elReports && window.SurakshaUI) SurakshaUI.animateCounter(elReports, total);
        if (elResolved && window.SurakshaUI) SurakshaUI.animateCounter(elResolved, resolved);
        if (elHotspots && window.SurakshaUI) SurakshaUI.animateCounter(elHotspots, hotspots.length);

        // Update overlay badge
        const badgeArea = document.getElementById('mob-area-name');
        const badgeMeta = document.getElementById('mob-area-meta');
        if (hotspots.length > 0 && badgeArea) {
          const topHotspot = hotspots[0];
          badgeArea.textContent = topHotspot.locationName || topHotspot.label || 'Active Safety Cluster';
          if (badgeMeta) {
            badgeMeta.textContent = `${topHotspot.reports?.length || topHotspot.count || 2} reports · High Alert`;
          }
        }

        initHomeMap(reports, hotspots);
      } catch (err) {
        console.warn('[SurakshaHome] Metrics initialization notice:', err);
      }
    }
  };

  window.SurakshaHome = SurakshaHome;

  window.SurakshaApp = { handleRoute, getCurrentRoute: () => currentRoute };
})();
