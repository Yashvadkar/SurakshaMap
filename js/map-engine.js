/**
 * map-engine.js — Interactive Leaflet Map with Clustering & Bottom Sheet
 */

(function () {
  'use strict';

  let map = null;
  let markerClusterGroup = null;
  let hotspotCircles = [];
  let currentFilter = 'all';
  let reports = [];

  function init() {
    loadReports();
    initMap();
  }

  async function loadReports() {
    reports = await window.SurakshaDB.getAllReports();
    if (map) renderMarkers();
    renderBottomSheetList();

    // Listen for changes
    window.SurakshaDB.onReportsChange((updated) => {
      reports = updated;
      if (map) renderMarkers();
      renderBottomSheetList();
    });
  }

  function initMap() {
    const container = document.getElementById('map');
    if (!container) return;

    if (map) { map.invalidateSize(); renderMarkers(); return; }

    const center = SURAKSHAMAP_CONFIG?.app?.defaultCenter || { lat: 19.076, lng: 72.8777 };
    const zoom = SURAKSHAMAP_CONFIG?.app?.defaultZoom || 13;

    map = L.map('map', {
      center: [center.lat, center.lng],
      zoom: zoom,
      zoomControl: false,
      attributionControl: false
    });

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    L.tileLayer(isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png',
      { maxZoom: 19, attribution: '&copy; <a href="https://carto.com/">CARTO</a>' }
    ).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

    // Marker cluster group
    if (typeof L.markerClusterGroup === 'function') {
      markerClusterGroup = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        chunkedLoading: true
      });
      map.addLayer(markerClusterGroup);
    }

    renderMarkers();
    setupMapFilters();
    setupBottomSheet();
  }

  function getMarkerColor(severity) {
    const colors = { low: '#10B981', medium: '#F59E0B', high: '#EF4444', critical: '#DC2626' };
    return colors[(severity || 'medium').toLowerCase()] || '#F59E0B';
  }

  function createMarkerIcon(category, severity) {
    const color = getMarkerColor(severity);
    const emoji = SurakshaUI.getCategoryIcon(category);
    return L.divIcon({
      className: 'custom-map-pin',
      html: `<div style="width:34px;height:34px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer;">${emoji}</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
  }

  function renderMarkers() {
    // Clear
    if (markerClusterGroup) markerClusterGroup.clearLayers();
    hotspotCircles.forEach(c => map.removeLayer(c));
    hotspotCircles = [];

    const filtered = currentFilter === 'all'
      ? reports
      : reports.filter(r => (r.category || '').toLowerCase() === currentFilter.toLowerCase());

    // Render hotspot circles
    const hotspots = SurakshaRisk.groupIntoHotspots(filtered);
    hotspots.forEach(h => {
      if (!h.center) return;
      const color = h.riskLevel === 'critical' ? '#DC2626' : h.riskLevel === 'high' ? '#EF4444' : '#F59E0B';
      const circle = L.circle([h.center.latitude, h.center.longitude], {
        radius: 180, color, fillColor: color, fillOpacity: 0.12, weight: 2, dashArray: '5, 8'
      }).addTo(map);
      circle.bindTooltip(`⚠️ ${SurakshaUI.getCategoryLabel(h.dominantCategory)} Hotspot (Risk: ${h.score})`, { direction: 'top' });
      hotspotCircles.push(circle);
    });

    // Render markers
    filtered.forEach(r => {
      if (!SurakshaRisk.hasValidLocation(r)) return;
      const marker = L.marker([r.latitude, r.longitude], { icon: createMarkerIcon(r.category, r.severity) });

      marker.bindPopup(`
        <div style="font-family:var(--font-body);min-width:200px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong>${SurakshaUI.getCategoryLabel(r.category)}</strong>
            ${SurakshaUI.createSeverityBadge(r.severity)}
          </div>
          <p style="font-size:0.85rem;color:var(--c-text-muted);margin-bottom:8px;line-height:1.4;">${SurakshaUI.escapeHtml((r.description || '').substring(0, 120))}${(r.description || '').length > 120 ? '...' : ''}</p>
          ${r.photoUrl ? `<img src="${r.photoUrl}" style="width:100%;border-radius:8px;margin-bottom:8px;max-height:120px;object-fit:cover;" alt="Evidence">` : ''}
          <div style="display:flex;justify-content:space-between;align-items:center;">
            ${SurakshaUI.createStatusBadge(r.status)}
            <span style="font-size:0.75rem;color:var(--c-text-light);">${SurakshaUI.formatDate(r.submittedAt)}</span>
          </div>
          <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--c-text-light);margin-top:6px;">Token: ${r.trackingToken}</div>
        </div>
      `, { maxWidth: 300 });

      if (markerClusterGroup) {
        markerClusterGroup.addLayer(marker);
      } else {
        marker.addTo(map);
      }
    });

    // Update count
    const countEl = document.getElementById('bottom-sheet-count');
    if (countEl) countEl.textContent = `${filtered.length} incidents`;
  }

  function setupMapFilters() {
    document.querySelectorAll('.map-filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.map-filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentFilter = pill.dataset.filter || 'all';
        renderMarkers();
        renderBottomSheetList();
      });
    });
  }

  function setupBottomSheet() {
    const sheet = document.getElementById('bottom-sheet');
    const handle = document.getElementById('bottom-sheet-handle');
    if (!sheet || !handle) return;

    handle.addEventListener('click', () => sheet.classList.toggle('expanded'));

    // Touch drag
    let startY, currentY;
    handle.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
    handle.addEventListener('touchmove', (e) => { currentY = e.touches[0].clientY; }, { passive: true });
    handle.addEventListener('touchend', () => {
      if (startY && currentY) {
        if (startY - currentY > 50) sheet.classList.add('expanded');
        else if (currentY - startY > 50) sheet.classList.remove('expanded');
      }
      startY = currentY = null;
    });
  }

  function renderBottomSheetList() {
    const list = document.getElementById('bottom-sheet-list');
    if (!list) return;

    const filtered = currentFilter === 'all'
      ? reports
      : reports.filter(r => (r.category || '').toLowerCase() === currentFilter.toLowerCase());

    const recent = filtered.slice(0, 20);

    if (recent.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📍</div><p class="text-muted">No incidents in this view</p></div>';
      return;
    }

    list.innerHTML = recent.map(r => `
      <div class="incident-item" onclick="window.location.hash='#/track?token=${r.trackingToken}'">
        <div class="incident-icon" style="background:${getMarkerColor(r.severity)}20;">
          ${SurakshaUI.getCategoryIcon(r.category)}
        </div>
        <div class="incident-body">
          <div class="incident-title">${SurakshaUI.getCategoryLabel(r.category)}</div>
          <div class="incident-meta">${SurakshaUI.formatDate(r.submittedAt)} · ${SurakshaUI.escapeHtml((r.description || '').substring(0, 50))}...</div>
        </div>
        ${SurakshaUI.createSeverityBadge(r.severity)}
      </div>
    `).join('');
  }

  window.SurakshaMap = { init };
})();
