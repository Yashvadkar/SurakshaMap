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
    if (window.SurakshaUI) {
      SurakshaUI.initRevealObserver();
      SurakshaUI.initSpotlightCards();
      SurakshaUI.initMagneticElements();
    }
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

    // Re-bind motion physics & spotlight shaders for active view components
    setTimeout(() => {
      if (window.SurakshaUI) {
        SurakshaUI.initSpotlightCards();
        SurakshaUI.initMagneticElements();
      }
    }, 120);

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

  /* ── Ambient Particle Physics Canvas ── */
  let ambientCanvasRunning = false;
  let ambientAnimationId = null;
  let heroCanvasInitialized = false;

  function initHeroCanvas() {
    const canvas = document.getElementById('hero-ambient-canvas');
    if (!canvas) return;

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return; // Respect accessibility preferences
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let particles = [];
    let mouse = { x: -9999, y: -9999, active: false };
    const PARTICLE_COUNT = 32;

    function resize() {
      const rect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width || window.innerWidth;
      height = rect.height || 600;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    function createParticles() {
      particles = [];
      const palettes = [
        'rgba(201, 78, 67,',   // Coral / primary accent
        'rgba(225, 138, 82,',  // Amber / warning
        'rgba(164, 110, 85,',  // Muted terracotta
        'rgba(46, 125, 82,'    // Emerald safe pulse
      ];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * (width || 800),
          y: Math.random() * (height || 600),
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          radius: 1.4 + Math.random() * 1.8,
          color: palettes[i % palettes.length],
          baseAlpha: 0.22 + Math.random() * 0.35
        });
      }
    }

    function step() {
      if (currentRoute !== 'home' || document.hidden) {
        ambientCanvasRunning = false;
        return;
      }

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        // Bounce walls
        if (p.x < 0) { p.x = 0; p.vx *= -1; }
        else if (p.x > width) { p.x = width; p.vx *= -1; }
        if (p.y < 0) { p.y = 0; p.vy *= -1; }
        else if (p.y > height) { p.y = height; p.vy *= -1; }

        // Subtle gentle mouse repulsion
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 130 && dist > 1) {
            const force = (130 - dist) / 130 * 0.28;
            p.x -= (dx / dist) * force;
            p.y += (dy / dist) * force;
          }
        }

        // Draw particle dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color} ${p.baseAlpha})`;
        ctx.fill();

        // Connect nearby nodes
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 110) {
            const alpha = (1 - dist / 110) * 0.15;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(201, 78, 67, ${alpha})`;
            ctx.lineWidth = 0.85;
            ctx.stroke();
          }
        }
      }

      ambientAnimationId = requestAnimationFrame(step);
    }

    function startAnimation() {
      if (!ambientCanvasRunning) {
        ambientCanvasRunning = true;
        if (ambientAnimationId) cancelAnimationFrame(ambientAnimationId);
        ambientAnimationId = requestAnimationFrame(step);
      }
    }

    if (!heroCanvasInitialized) {
      heroCanvasInitialized = true;
      resize();
      createParticles();

      window.addEventListener('resize', () => {
        resize();
      }, { passive: true });

      const heroWrap = canvas.closest('.home-hero') || canvas.parentElement;
      if (heroWrap) {
        heroWrap.addEventListener('mousemove', (e) => {
          const rect = canvas.getBoundingClientRect();
          mouse.x = e.clientX - rect.left;
          mouse.y = e.clientY - rect.top;
          mouse.active = true;
        }, { passive: true });

        heroWrap.addEventListener('mouseleave', () => {
          mouse.active = false;
          mouse.x = -9999;
          mouse.y = -9999;
        }, { passive: true });
      }

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && currentRoute === 'home') {
          startAnimation();
        }
      });
    }

    startAnimation();
  }

  const SurakshaHome = {
    getMap: () => homeMap,
    invalidateSize: () => { if (homeMap) homeMap.invalidateSize(); },
    init: async function () {
      try {
        initHeroCanvas();
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
