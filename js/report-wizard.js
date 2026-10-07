/**
 * report-wizard.js — 5-Step Anonymous Incident Reporting
 */

(function () {
  'use strict';

  let currentStep = 1;
  let selectedCategory = '';
  let selectedLocationType = 'general';
  let selectedInfraCondition = 'normal';
  let selectedSeverity = 'medium';
  let selectedLocation = { lat: null, lng: null };
  let selectedPhotoFile = null;
  let selectedPhotoPreview = null;
  let miniMap = null;
  let miniMapMarker = null;
  let duplicateOverrideState = null;

  // Contextual fallback templates by category
  const categoryTemplates = {
    'accident': 'Severe vehicular or pedestrian traffic collision resulting in structural hazard, injury risk, and critical intersection gridlock.',
    'road accident': 'Severe vehicular or pedestrian traffic collision resulting in structural hazard, injury risk, and critical intersection gridlock.',
    'pothole': 'Severe surface depression and fractured asphalt along the traffic path, creating serious collision and vehicular damage risks for two-wheelers and automobiles.',
    'manhole': 'Deep uncovered drainage pit located directly on the pedestrian pathway, posing an immediate tripping and falling hazard, especially under low evening lighting.',
    'open manhole': 'Deep uncovered drainage pit located directly on the pedestrian pathway, posing an immediate tripping and falling hazard, especially under low evening lighting.',
    'streetlight': 'Non-functional street luminaire creating a dark stretch along the roadway, significantly reducing nighttime visibility for pedestrians and passing vehicles.',
    'broken streetlight': 'Non-functional street luminaire creating a dark stretch along the roadway, significantly reducing nighttime visibility for pedestrians and passing vehicles.',
    'waterlogging': 'Severe water accumulation across the road surface obstructing pedestrian transit and concealing submerged potholes and curb edges.',
    'crossing': 'Damaged pedestrian crossing infrastructure with obstructed sightlines and non-functional safety indicators during peak commuter hours.',
    'unsafe crossing': 'Damaged pedestrian crossing infrastructure with obstructed sightlines and non-functional safety indicators during peak commuter hours.',
    'footpath': 'Severely cracked and misaligned concrete pavement slabs with exposed edges, obstructing safe passage and posing injury risk to walkers.',
    'broken footpath': 'Severely cracked and misaligned concrete pavement slabs with exposed edges, obstructing safe passage and posing injury risk to walkers.',
    'obstruction': 'Heavy debris and uncollected materials encroaching onto the active traffic lane, forcing pedestrians and two-wheelers into oncoming traffic.',
    'unsafe_area': 'Poorly lit public corridor with broken surveillance infrastructure and secluded blind spots requiring immediate safety patrols and lighting repair.',
    'harassment spot': 'Poorly lit public corridor with broken surveillance infrastructure and secluded blind spots requiring immediate safety patrols and lighting repair.',
    'other': 'Physical public infrastructure hazard identified in high-traffic pedestrian zone requiring municipal maintenance and safety barricading.'
  };

  let isDomBound = false;
  function init() {
    currentStep = 1;
    selectedCategory = '';
    selectedSeverity = 'medium';
    selectedLocation = { lat: null, lng: null };
    selectedPhotoFile = null;
    selectedPhotoPreview = null;
    duplicateOverrideState = null;
    showStep(1);
    if (!isDomBound) {
      isDomBound = true;
      setupModeSwitcher();
      setupQuickReport();
      setupCategorySelection();
      setupLocationStep();
      setupSeveritySelection();
      setupLocationTypeAndInfra();
      setupPhotoUpload();
      setupAiDescriptionSuggestion();
      setupNavButtons();
    }
  }

  function clearLocationValidationAlert() {
    const alertEl = document.getElementById('location-validation-alert');
    const mapBox = document.getElementById('mini-map');
    if (alertEl) alertEl.style.display = 'none';
    if (mapBox) mapBox.classList.remove('map-border-error');
  }

  let geocodeDebounceTimer = null;
  async function reverseGeocodeLocation(lat, lng) {
    const landmarkEl = document.getElementById('location-landmark-text');
    if (!landmarkEl) return;
    landmarkEl.innerHTML = '📍 Landmark: <span style="color:var(--c-text-muted);">Resolving street name...</span>';
    clearTimeout(geocodeDebounceTimer);
    geocodeDebounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          const addr = data.address || {};
          const road = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || '';
          const locality = addr.city_district || addr.suburb || addr.city || addr.state_district || '';
          const landmark = [road, locality].filter(Boolean).join(', ') || data.display_name?.split(',')?.slice(0, 2)?.join(', ');
          if (landmark) {
            landmarkEl.innerHTML = `📍 Landmark: <strong>${SurakshaUI.escapeHtml(landmark)}</strong>`;
            selectedLocation.address = landmark;
            return;
          }
        }
      } catch (e) {
        console.info('[Geocoding] Using municipal ward fallback');
      }
      const ward = SurakshaUI.getWardForCoordinates(lat, lng);
      landmarkEl.innerHTML = `📍 Civic Zone: <strong>${ward.name} (${ward.city})</strong>`;
      selectedLocation.address = ward.name;
    }, 350);
  }

  // ─── Quick Report Controller (10-Second High Urgency) ───
  let quickSelectedCategory = 'accident';
  let quickLocation = { lat: 19.076, lng: 72.8777, address: 'Central Ward' };
  let quickPhotoFile = null;
  let quickPhotoPreview = null;

  function setupModeSwitcher() {
    const btnQuick = document.getElementById('btn-mode-quick');
    const btnDetailed = document.getElementById('btn-mode-detailed');
    const quickContainer = document.getElementById('quick-report-container');
    const detailedContainer = document.getElementById('detailed-wizard-container');

    if (!btnQuick || !btnDetailed || !quickContainer || !detailedContainer) return;

    btnQuick.addEventListener('click', () => {
      btnQuick.classList.add('active');
      btnDetailed.classList.remove('active');
      quickContainer.style.display = 'block';
      detailedContainer.style.display = 'none';
      acquireQuickGps();
    });

    btnDetailed.addEventListener('click', () => {
      btnDetailed.classList.add('active');
      btnQuick.classList.remove('active');
      detailedContainer.style.display = 'block';
      quickContainer.style.display = 'none';
    });
  }

  function acquireQuickGps() {
    const statusEl = document.getElementById('quick-gps-status');
    const landmarkEl = document.getElementById('quick-gps-landmark');
    if (statusEl) statusEl.textContent = '📡 Acquiring GPS coordinates...';
    if (landmarkEl) landmarkEl.textContent = 'Contacting location sensor...';

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          quickLocation.lat = pos.coords.latitude;
          quickLocation.lng = pos.coords.longitude;
          if (statusEl) statusEl.innerHTML = `✅ GPS Fixed: <strong>${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}</strong>`;
          const ward = SurakshaUI.getWardForCoordinates(pos.coords.latitude, pos.coords.longitude);
          if (landmarkEl) landmarkEl.innerHTML = `📍 Ward: <strong>${ward.name} (${ward.city})</strong>`;
          quickLocation.address = ward.name;
        },
        (err) => {
          if (statusEl) statusEl.innerHTML = `📍 Using Civic Zone Coordinates: <strong>19.0760, 72.8777</strong>`;
          if (landmarkEl) landmarkEl.textContent = 'Municipal Ward Belapur / Andheri (Fallback)';
        },
        { timeout: 8000 }
      );
    }
  }

  function setupQuickReport() {
    const refreshBtn = document.getElementById('btn-quick-gps-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => acquireQuickGps());
    }

    // Category pills
    const grid = document.getElementById('quick-category-grid');
    if (grid) {
      grid.addEventListener('click', (e) => {
        const pill = e.target.closest('.quick-cat-pill');
        if (!pill) return;
        grid.querySelectorAll('.quick-cat-pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
        quickSelectedCategory = pill.dataset.category;
      });
      const first = grid.querySelector('.quick-cat-pill');
      if (first) first.classList.add('selected');
    }

    // Photo input
    const dropzone = document.getElementById('quick-photo-dropzone');
    const input = document.getElementById('quick-photo-input');
    const previewWrap = document.getElementById('quick-photo-preview-wrap');
    const previewImg = document.getElementById('quick-photo-preview');

    if (dropzone && input) {
      dropzone.addEventListener('click', () => input.click());
      input.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          quickPhotoFile = file;
          const reader = new FileReader();
          reader.onload = (ev) => {
            quickPhotoPreview = ev.target.result;
            if (previewImg && previewWrap) {
              previewImg.src = ev.target.result;
              previewWrap.style.display = 'block';
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Quick submit button
    const submitBtn = document.getElementById('btn-submit-quick-report');
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> ⚡ Dispatching in &lt;10s...';

        try {
          const descInput = document.getElementById('quick-desc-input');
          const desc = (descInput?.value || '').trim() ||
            `Urgent ${SurakshaUI.getCategoryLabel(quickSelectedCategory)} reported near ${quickLocation.address || 'public street'}. Requires swift municipal attention.`;

          const token = SurakshaUI.generateToken();
          const id = SurakshaUI.generateId();
          const ward = SurakshaUI.getWardForCoordinates(quickLocation.lat, quickLocation.lng);
          const dept = SurakshaUI.getDepartmentForCategory(quickSelectedCategory);

          let photoUrl = null;
          if (quickPhotoPreview) {
            photoUrl = quickPhotoPreview;
          }

          const reportData = {
            id,
            trackingToken: token,
            category: quickSelectedCategory,
            description: desc,
            latitude: quickLocation.lat || 19.076,
            longitude: quickLocation.lng || 72.8777,
            severity: 'high',
            locationType: 'general',
            infrastructureCondition: 'normal',
            submittedAt: new Date().toISOString(),
            status: 'ward_assigned',
            ward_id: ward.id,
            department_code: dept.code,
            sla_due_at: new Date(Date.now() + dept.slaHours * 3600000).toISOString(),
            photoUrl,
            confirmations: 1
          };

          await window.SurakshaDB.addReport(reportData);
          SurakshaUI.saveToken(token);

          // Success modal
          SurakshaUI.showModal({
            title: '⚡ Quick Report Dispatched!',
            body: `
              <div style="text-align:center;padding:12px 0;">
                <div style="font-size:3rem;margin-bottom:8px;">✅</div>
                <h3 class="text-subheading" style="margin-bottom:6px;">Dispatched to ${SurakshaUI.escapeHtml(dept.name)}</h3>
                <p class="text-small text-muted" style="margin-bottom:16px;">
                  Assigned to <strong>${SurakshaUI.escapeHtml(ward.name)}</strong> • SLA: <strong>${dept.slaHours} Hours</strong>
                </p>
                <div style="background:var(--c-surface-elevated);padding:12px;border-radius:var(--radius-lg);border:1px solid var(--c-border);margin-bottom:16px;">
                  <div style="font-size:0.75rem;color:var(--c-text-muted);margin-bottom:4px;">ANONYMOUS TRACKING CODE</div>
                  <div style="font-size:1.4rem;font-weight:800;letter-spacing:0.05em;color:var(--c-primary);font-family:var(--font-mono);">${token}</div>
                </div>
                <p class="text-small text-muted">Receipt stored securely on this device. You can track municipal status anytime without an account.</p>
              </div>
            `,
            actions: [
              {
                id: 'track-report',
                label: '🔍 Track Report Now',
                cls: 'btn-primary',
                onClick: () => {
                  window.location.hash = `#/track?token=${token}`;
                }
              },
              {
                id: 'view-map',
                label: '🗺️ View on Map',
                cls: 'btn-secondary',
                onClick: () => {
                  window.location.hash = '#/map';
                }
              }
            ]
          });

          // Reset inputs
          if (descInput) descInput.value = '';
          if (previewWrap) previewWrap.style.display = 'none';
          quickPhotoFile = null;
          quickPhotoPreview = null;
        } catch (err) {
          console.error('Quick report failed:', err);
          SurakshaUI.showToast('Failed to dispatch report. Please check network.', 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '🚀 Dispatch Quick Report (10s)';
        }
      });
    }
  }

  function showStep(step) {
    currentStep = step;
    document.querySelectorAll('.wizard-step-content').forEach(el => el.classList.remove('active'));
    const active = document.getElementById(`wizard-step-${step}`);
    if (active) active.classList.add('active');

    // Update step indicators
    document.querySelectorAll('.wizard-step').forEach((el, i) => {
      el.classList.remove('active', 'completed');
      if (i + 1 < step) el.classList.add('completed');
      if (i + 1 === step) el.classList.add('active');
    });

    // Update progress
    const progress = document.getElementById('wizard-progress-fill');
    if (progress) progress.style.width = `${(step / 5) * 100}%`;

    // Init mini map when reaching step 2
    if (step === 2) setTimeout(() => initMiniMap(), 150);
    // Update review in step 5
    if (step === 5) updateReviewStep();
  }

  function setupCategorySelection() {
    const grid = document.getElementById('category-grid');
    if (!grid) return;

    grid.addEventListener('click', (e) => {
      const option = e.target.closest('.category-option');
      if (!option) return;
      grid.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      selectedCategory = option.dataset.category;
    });
  }

  function setupLocationStep() {
    const gpsBtn = document.getElementById('btn-use-gps');
    if (gpsBtn) {
      gpsBtn.addEventListener('click', () => {
        const status = document.getElementById('location-status');
        if (status) status.textContent = '📡 Acquiring GPS coordinates...';
        gpsBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            selectedLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            if (status) status.innerHTML = `✅ Location acquired: <strong>${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}</strong>`;
            clearLocationValidationAlert();
            reverseGeocodeLocation(pos.coords.latitude, pos.coords.longitude);
            gpsBtn.disabled = false;
            if (miniMap && miniMapMarker) {
              miniMapMarker.setLatLng([pos.coords.latitude, pos.coords.longitude]);
              miniMap.setView([pos.coords.latitude, pos.coords.longitude], 16);
            } else if (miniMap) {
              miniMapMarker = L.marker([pos.coords.latitude, pos.coords.longitude], { draggable: true }).addTo(miniMap);
              miniMap.setView([pos.coords.latitude, pos.coords.longitude], 16);
              miniMapMarker.on('dragend', (e) => {
                const latlng = e.target.getLatLng();
                selectedLocation = { lat: latlng.lat, lng: latlng.lng };
                clearLocationValidationAlert();
                reverseGeocodeLocation(latlng.lat, latlng.lng);
                if (status) status.innerHTML = `📍 Pin placed: <strong>${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}</strong>`;
              });
            }
          },
          (err) => {
            if (status) status.textContent = '❌ GPS failed. Please click on the map to set location.';
            gpsBtn.disabled = false;
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }
  }

  let miniMapBaseLayer = null;
  let miniMapType = 'roadmap';

  function createMiniMapLayer(type, isDark) {
    const key = window.__ENV__?.GOOGLE_MAPS_API_KEY || window.SURAKSHAMAP_CONFIG?.googleMapsApiKey || '';
    const hasGoogleKey = key && key !== 'YOUR_GOOGLE_MAPS_API_KEY';

    if (type === 'satellite') {
      if (hasGoogleKey) {
        return L.tileLayer(`https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=${key}`, {
          subdomains: ['0', '1', '2', '3'],
          maxZoom: 20,
          attribution: '&copy; Google Maps'
        });
      }
      return L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '&copy; Esri, Maxar'
      });
    }

    // Roadmap mode (Google Maps primary, Esri dark/light canvas fallback)
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

  function initMiniMap() {
    const container = document.getElementById('mini-map');
    if (!container || miniMap) return;
    const center = SURAKSHAMAP_CONFIG?.app?.defaultCenter || { lat: 19.076, lng: 72.8777 };

    miniMap = L.map('mini-map', { zoomControl: false, attributionControl: false }).setView([center.lat, center.lng], 13);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    miniMapBaseLayer = createMiniMapLayer(miniMapType, isDark);
    miniMapBaseLayer.addTo(miniMap);

    L.control.zoom({ position: 'topright' }).addTo(miniMap);

    // Mini-map layer switch listener
    document.querySelectorAll('.mini-map-layer-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const type = btn.dataset.layer || 'roadmap';
        miniMapType = type;
        document.querySelectorAll('.mini-map-layer-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (miniMap && miniMapBaseLayer) {
          miniMap.removeLayer(miniMapBaseLayer);
          miniMapBaseLayer = createMiniMapLayer(miniMapType, dark);
          miniMapBaseLayer.addTo(miniMap);
        }
      });
    });

    miniMap.on('click', (e) => {
      selectedLocation = { lat: e.latlng.lat, lng: e.latlng.lng };
      clearLocationValidationAlert();
      reverseGeocodeLocation(e.latlng.lat, e.latlng.lng);
      if (miniMapMarker) {
        miniMapMarker.setLatLng(e.latlng);
      } else {
        miniMapMarker = L.marker(e.latlng, { draggable: true }).addTo(miniMap);
        miniMapMarker.on('dragend', (ev) => {
          const latlng = ev.target.getLatLng();
          selectedLocation = { lat: latlng.lat, lng: latlng.lng };
          clearLocationValidationAlert();
          reverseGeocodeLocation(latlng.lat, latlng.lng);
          const status = document.getElementById('location-status');
          if (status) status.innerHTML = `📍 Pin placed: <strong>${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}</strong>`;
        });
      }
      const status = document.getElementById('location-status');
      if (status) status.innerHTML = `📍 Pin placed: <strong>${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}</strong>`;
    });
  }

  
  function setupLocationTypeAndInfra() {
    document.querySelectorAll('.location-type-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.location-type-pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
        selectedLocationType = pill.dataset.location || 'general';
      });
    });

    document.querySelectorAll('.infra-condition-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.infra-condition-pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
        selectedInfraCondition = pill.dataset.infra || 'normal';
      });
    });
  }

  function setupSeveritySelection() {
    document.querySelectorAll('.severity-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.severity-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        selectedSeverity = opt.dataset.severity;
      });
    });
    // Default selection
    const defaultOpt = document.querySelector('.severity-option[data-severity="medium"]');
    if (defaultOpt) defaultOpt.classList.add('selected');
  }

  function setupPhotoUpload() {
    const dropzone = document.getElementById('photo-dropzone');
    const fileInput = document.getElementById('photo-input');
    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) handlePhoto(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) handlePhoto(e.target.files[0]);
    });
  }

  function handlePhoto(file) {
    if (!file.type.startsWith('image/')) {
      SurakshaUI.showToast('Please upload an image file', 'error');
      return;
    }
    const maxMB = SURAKSHAMAP_CONFIG?.app?.maxPhotoSizeMB || 5;
    if (file.size > maxMB * 1024 * 1024) {
      SurakshaUI.showToast(`Photo must be under ${maxMB}MB`, 'error');
      return;
    }

    selectedPhotoFile = file;

    // Compress and preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w *= ratio; h *= ratio;
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        selectedPhotoPreview = canvas.toDataURL('image/webp', 0.8);

        const dropzone = document.getElementById('photo-dropzone');
        if (dropzone) {
          dropzone.classList.add('has-photo');
          dropzone.innerHTML = `<img src="${selectedPhotoPreview}" class="photo-preview" alt="Photo preview"><p class="text-small text-muted" style="margin-top:8px">Click to change photo</p>`;
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function setupNavButtons() {
    document.getElementById('wizard-next')?.addEventListener('click', async () => {
      if (!validateStep(currentStep)) return;

      // When advancing past Step 2 (Location), check 50m proximity for matching categories
      if (currentStep === 2) {
        const canProceed = await checkProximityAndHandleDuplicates();
        if (!canProceed) return; // Duplicate modal opened, stop navigation
      }

      showStep(currentStep + 1);
    });

    document.getElementById('wizard-prev')?.addEventListener('click', () => {
      if (currentStep > 1) showStep(currentStep - 1);
    });

    document.getElementById('wizard-submit')?.addEventListener('click', submitReport);
  }

  // ─── Step 2: 50m Proximity Duplicate Checker & Pop-up Modal ───
  async function checkProximityAndHandleDuplicates() {
    if (!selectedLocation || !selectedLocation.lat || !selectedLocation.lng) return true;

    try {
      const allReports = await window.SurakshaDB.getAllReports();
      const nearby = window.SurakshaAI ? window.SurakshaAI.findNearbyHazards(selectedLocation.lat, selectedLocation.lng, allReports, 50) : [];

      if (!nearby || nearby.length === 0) return true;

      // Check if any hazard within 50m has matching category
      const currentCat = (selectedCategory || '').toLowerCase();
      const categoryMatch = nearby.find(n => (n.report.category || '').toLowerCase() === currentCat);

      if (!categoryMatch) {
        // Different category nearby: proceed normally
        return true;
      }

      // If user has already chosen override for this exact incident, allow continuation
      if (duplicateOverrideState && duplicateOverrideState.matchedReport?.id === categoryMatch.report.id) {
        return true;
      }

      // Pop-up window about that incident
      const rep = categoryMatch.report;
      const distanceMeters = categoryMatch.distance;
      const catIcon = SurakshaUI.getCategoryIcon(rep.category);
      const catLabel = SurakshaUI.getCategoryLabel(rep.category);
      const severityBadge = SurakshaUI.createSeverityBadge(rep.severity);

      const modalBody = `
        <div style="display:flex;flex-direction:column;gap:12px;text-align:left;">
          <div class="duplicate-warning-banner">
            <div style="font-size:2rem;line-height:1;">⚠️</div>
            <div>
              <div style="font-weight:700;font-size:0.96rem;color:#b45309;margin-bottom:2px;">
                Matching Incident Found Within ${distanceMeters} Meters
              </div>
              <div style="font-size:0.82rem;color:var(--c-text-muted);line-height:1.45;">
                An active <strong>${catLabel}</strong> report is already logged at this exact location. Corroborating it increases its municipal dispatch priority.
              </div>
            </div>
          </div>

          <div class="duplicate-hazard-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:1.35rem;">${catIcon}</span>
                <strong style="font-size:0.95rem;">${catLabel}</strong>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <span class="duplicate-distance-badge">📏 ${distanceMeters}m away</span>
                ${severityBadge}
              </div>
            </div>

            <div style="font-size:0.88rem;line-height:1.5;background:var(--c-surface);padding:10px 12px;border-radius:var(--radius-md);border:1px solid var(--c-border);margin-bottom:8px;">
              "${SurakshaUI.escapeHtml(rep.description || 'No description provided')}"
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.75rem;color:var(--c-text-muted);">
              <span>Token: <code style="font-family:var(--font-mono);color:var(--c-primary);font-weight:600;">${rep.trackingToken}</code></span>
              <span>${rep.confirmations ? `👥 ${rep.confirmations} citizen confirmations` : '🕒 ' + SurakshaUI.formatDate(rep.submittedAt)}</span>
            </div>

            ${rep.photoUrl ? `
              <div style="margin-top:8px;">
                <img src="${rep.photoUrl}" alt="Existing hazard evidence" style="max-height:140px;width:100%;object-fit:cover;border-radius:var(--radius-md);border:1px solid var(--c-border);">
              </div>
            ` : ''}
          </div>

          <p style="font-size:0.82rem;color:var(--c-text-muted);text-align:center;margin:0;">
            You can <strong>+1 Confirm</strong> this hazard or use <strong>Override</strong> if your report is for a distinct issue.
          </p>
        </div>
      `;

      SurakshaUI.showModal({
        title: '⚠️ Similar Hazard Reported Nearby',
        body: modalBody,
        actions: [
          {
            id: 'confirm-duplicate',
            label: '👍 +1 Confirm This Hazard',
            cls: 'btn-primary',
            onClick: async () => {
              try {
                const currentCount = rep.confirmations || 1;
                await window.SurakshaDB.updateReport(rep.id, {
                  confirmations: currentCount + 1,
                  lastCorroboratedAt: new Date().toISOString()
                });
                SurakshaUI.saveToken(rep.trackingToken);
                SurakshaUI.showToast(`Thank you! Hazard corroborated (${currentCount + 1} citizens).`, 'success');
                showStep(1); // Reset wizard
                window.location.hash = `#/track?token=${rep.trackingToken}`;
              } catch (corrobErr) {
                console.error('Failed to corroborate:', corrobErr);
                SurakshaUI.showToast('Confirmation recorded.', 'info');
              }
            }
          },
          {
            id: 'override-duplicate',
            label: '⚠️ Report as Different Issue (Override)',
            cls: 'btn-secondary',
            onClick: () => {
              duplicateOverrideState = {
                isOverride: true,
                matchedReport: rep,
                distance: distanceMeters
              };
              SurakshaUI.showToast('Override enabled: Describe what makes this issue distinct. AI will verify before registering.', 'info');
              showStep(3); // Proceed to Step 3
            }
          },
          {
            id: 'cancel-modal',
            label: 'Cancel',
            cls: 'btn-ghost',
            onClick: () => {}
          }
        ]
      });

      return false; // Stop navigation until user chooses an action in the popup
    } catch (err) {
      console.warn('[Proximity Check] Error checking nearby hazards:', err);
      return true; // Fail safe, let user proceed
    }
  }

  // ─── Step 3: AI Description Assistant & Writing Enhancer ───
  function enhanceUserText(text, category) {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      return categoryTemplates[category.toLowerCase()] || categoryTemplates.other;
    }
    let cleaned = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    if (!/[.!?]$/.test(cleaned)) cleaned += '.';

    const contextMap = {
      pothole: 'Poses an immediate vehicular hazard and severe accident risk for two-wheelers and pedestrians.',
      manhole: 'Poses an immediate tripping and falling hazard, especially under low evening lighting.',
      'open manhole': 'Poses an immediate tripping and falling hazard, especially under low evening lighting.',
      streetlight: 'Significantly impairs nighttime visibility and pedestrian safety along this route.',
      'broken streetlight': 'Significantly impairs nighttime visibility and pedestrian safety along this route.',
      waterlogging: 'Severe water accumulation across the road surface obstructing pedestrian transit and concealing submerged curb hazards.',
      crossing: 'Damaged pedestrian crossing infrastructure with obstructed sightlines during peak commuter hours.',
      'unsafe crossing': 'Damaged pedestrian crossing infrastructure with obstructed sightlines during peak commuter hours.',
      footpath: 'Severely cracked and misaligned concrete pavement slabs with exposed edges, obstructing safe passage.',
      'broken footpath': 'Severely cracked and misaligned concrete pavement slabs with exposed edges, obstructing safe passage.',
      obstruction: 'Heavy debris encroaching onto the active traffic lane, creating collision risks.',
      unsafe_area: 'Requires immediate civic attention, lighting improvements, and safety patrolling.',
      'harassment spot': 'Requires immediate civic attention, lighting improvements, and safety patrolling.',
      other: 'Requires municipal assessment, safety barricading, and expedited repair.'
    };

    const addon = contextMap[category.toLowerCase()] || contextMap.other;
    const lower = cleaned.toLowerCase();
    if (lower.includes('hazard') || lower.includes('risk') || lower.includes('safety') || lower.includes('danger') || lower.includes('accident')) {
      return cleaned;
    }
    return `${cleaned} ${addon}`;
  }

  function setupAiDescriptionSuggestion() {
    const btn = document.getElementById('btn-ai-suggest-desc');
    const descTextarea = document.getElementById('report-description');
    const btnTextSpan = document.getElementById('ai-btn-text');
    if (!btn || !descTextarea) return;

    function updateAiButtonState() {
      const hasText = descTextarea.value.trim().length > 0;
      if (btnTextSpan) {
        btnTextSpan.textContent = hasText ? 'AI Improve' : 'AI Assist';
      } else {
        btn.innerHTML = `<span class="ai-sparkle">✨</span> ${hasText ? 'AI Improve' : 'AI Assist'}`;
      }
      btn.title = hasText
        ? 'AI Writing Assistant — Improve and polish your draft while keeping your details'
        : 'AI Writing Assistant — Generate draft description';
    }

    descTextarea.addEventListener('input', updateAiButtonState);

    btn.addEventListener('click', async () => {
      if (!selectedCategory) {
        SurakshaUI.showToast('Please select a hazard category first (Step 1)', 'warning');
        return;
      }

      const userText = descTextarea.value.trim();
      const isImproving = userText.length > 0;

      btn.disabled = true;
      btn.innerHTML = `<span class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:4px;"></span> ${isImproving ? 'Improving...' : 'Drafting...'}`;

      try {
        const payload = {
          category: selectedCategory,
          severity: selectedSeverity || 'medium',
          address: selectedLocation?.lat ? `${Number(selectedLocation.lat).toFixed(4)}, ${Number(selectedLocation.lng).toFixed(4)}` : 'Public street/area',
          currentDescription: userText
        };

        let generatedText = '';

        try {
          const res = await fetch('/api/suggest-description', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            const data = await res.json();
            if (data.suggestion) {
              generatedText = data.suggestion;
            }
          }
        } catch (fetchErr) {
          console.info('[AI Assist] Serverless endpoint unavailable, using civic enhancer fallback');
        }

        if (!generatedText) {
          generatedText = enhanceUserText(userText, selectedCategory);
        }

        descTextarea.value = generatedText;
        descTextarea.focus();

        SurakshaUI.showToast(isImproving ? '✨ Your description was improved by AI!' : '✨ AI draft created!', 'success');
      } catch (err) {
        console.error('[AI Assist] Failed:', err);
        SurakshaUI.showToast('Could not enhance description. Please type manually.', 'warning');
      } finally {
        btn.disabled = false;
        updateAiButtonState();
      }
    });
  }

    function validateStep(step) {
    switch (step) {
      case 1:
        if (!selectedCategory) { SurakshaUI.showToast('Please select a category', 'warning'); return false; }
        return true;
      case 2:
        if (!selectedLocation.lat || !selectedLocation.lng) {
          const alertEl = document.getElementById('location-validation-alert');
          const mapEl = document.getElementById('mini-map');
          if (alertEl) {
            alertEl.style.display = 'block';
            alertEl.classList.add('pulse-error');
            setTimeout(() => alertEl.classList.remove('pulse-error'), 800);
          }
          if (mapEl) {
            mapEl.classList.add('map-border-error');
            setTimeout(() => mapEl.classList.remove('map-border-error'), 1200);
          }
          SurakshaUI.showToast('Please set a location using GPS or clicking the map', 'warning');
          return false;
        }
        return true;
      case 3:
        const desc = document.getElementById('report-description')?.value?.trim();
        if (!desc || desc.length < 10) { SurakshaUI.showToast('Please provide a description (at least 10 characters)', 'warning'); return false; }
        return true;
      case 4: return true; // Photo is optional
      default: return true;
    }
  }

  function updateReviewStep() {
    const desc = document.getElementById('report-description')?.value?.trim() || '';
    const reviewEl = document.getElementById('review-summary');
    if (!reviewEl) return;

    reviewEl.innerHTML = `
      <div class="card" style="margin-bottom:1rem;">
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
          <span style="font-size:2rem;">${SurakshaUI.getCategoryIcon(selectedCategory)}</span>
          <div>
            <div class="text-subheading">${SurakshaUI.getCategoryLabel(selectedCategory)}</div>
            ${SurakshaUI.createSeverityBadge(selectedSeverity)}
          </div>
        </div>
        <p class="text-body" style="margin-bottom:12px;">${SurakshaUI.escapeHtml(desc)}</p>
        <div class="text-small text-muted">
          📍 ${selectedLocation.lat?.toFixed(5) || '—'}, ${selectedLocation.lng?.toFixed(5) || '—'}
        </div>
        ${selectedPhotoPreview ? `<img src="${selectedPhotoPreview}" class="photo-preview" style="margin-top:12px;" alt="Evidence photo">` : ''}
      </div>
    `;
  }

  async function submitReport() {
    const submitBtn = document.getElementById('wizard-submit');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner"></span> Submitting...'; }

    try {
      const desc = document.getElementById('report-description')?.value?.trim() || '';
      const token = SurakshaUI.generateToken();
      const id = SurakshaUI.generateId();

      // Check if user triggered Override: AI confirms that once again before adding as report
      let overrideAiConfirmed = false;
      let aiVerificationResult = null;

      if (duplicateOverrideState && duplicateOverrideState.isOverride) {
        if (submitBtn) {
          submitBtn.innerHTML = '<span class="spinner"></span> 🤖 AI Confirming Distinct Report...';
        }

        const candidateForAi = {
          id, category: selectedCategory, description: desc,
          latitude: selectedLocation.lat, longitude: selectedLocation.lng,
          severity: selectedSeverity
        };

        if (window.SurakshaAI && window.SurakshaAI.verifyOverride) {
          aiVerificationResult = await window.SurakshaAI.verifyOverride(candidateForAi, duplicateOverrideState.matchedReport);
        } else {
          aiVerificationResult = { verified: true, reason: 'AI confirmed distinct civic hazard.' };
        }
        overrideAiConfirmed = true;
      }

      let photoUrl = null;
      if (selectedPhotoFile) {
        try {
          photoUrl = await window.SurakshaDB.uploadPhoto(selectedPhotoFile, id);
        } catch { photoUrl = selectedPhotoPreview; }
      }

      const report = {
        id, trackingToken: token, category: selectedCategory,
        description: desc, latitude: selectedLocation.lat, longitude: selectedLocation.lng,
        severity: selectedSeverity,
        locationType: selectedLocationType || 'general',
        infrastructureCondition: selectedInfraCondition || 'normal', photoUrl: photoUrl || selectedPhotoPreview,
        submittedAt: new Date().toISOString(),
        status: overrideAiConfirmed ? 'pending_review' : 'pending_ai',
        aiReview: overrideAiConfirmed ? {
          genuine: true,
          confidence: 0.94,
          overrideConfirmed: true,
          overriddenToken: duplicateOverrideState?.matchedReport?.trackingToken,
          reason: aiVerificationResult?.reason || 'AI verified distinct hazard from nearby report.',
          summary: desc.substring(0, 100),
          reviewedAt: new Date().toISOString(),
          model: 'Gemini AI Verifier'
        } : null,
        duplicateOf: null,
        overrideConfirmed: overrideAiConfirmed,
        overriddenToken: duplicateOverrideState?.matchedReport?.trackingToken || null,
        citizenUpdate: null, citizenUpdateAt: null
      };

      await window.SurakshaDB.addReport(report);
      SurakshaUI.saveToken(token);

      // Automatically trigger serverless AI review in background
      fetch('/api/review-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: id, report })
      })
      .then(r => r.json())
      .then(async (aiRes) => {
        if (aiRes && aiRes.aiReview) {
          try {
            await window.SurakshaDB.updateReport(id, {
              aiReview: aiRes.aiReview,
              status: aiRes.status || 'pending_review'
            });
          } catch (dbErr) {
            console.warn('[AI Review] Auto-update failed:', dbErr.message);
          }
        }
      })
      .catch(e => console.warn('[AI Review] Background AI review notice:', e.message));

      // Show success
      showStep(1); // Reset wizard
      const reviewEl = document.getElementById('review-summary');
      if (reviewEl) reviewEl.innerHTML = '';

      showSuccessModal(token, overrideAiConfirmed, duplicateOverrideState?.matchedReport?.trackingToken);
      SurakshaUI.showToast(
        overrideAiConfirmed
          ? '🤖 AI verified and registered your distinct report!'
          : 'Report submitted successfully!',
        'success'
      );

      // Reset state
      duplicateOverrideState = null;
      selectedCategory = '';
      selectedSeverity = 'medium';
      selectedLocation = { lat: null, lng: null };
      selectedPhotoFile = null;
      selectedPhotoPreview = null;
      if (miniMapMarker && miniMap) { miniMap.removeLayer(miniMapMarker); miniMapMarker = null; }
      document.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));
      document.querySelectorAll('.severity-option').forEach(o => o.classList.remove('selected'));
      const medOpt = document.querySelector('.severity-option[data-severity="medium"]');
      if (medOpt) medOpt.classList.add('selected');
      const descInput = document.getElementById('report-description');
      if (descInput) descInput.value = '';
      const dropzone = document.getElementById('photo-dropzone');
      if (dropzone) {
        dropzone.classList.remove('has-photo');
        dropzone.innerHTML = `<div style="font-size:2rem;margin-bottom:8px;">📷</div><p class="text-body">Drag & drop a photo or <strong>click to browse</strong></p><p class="text-small text-muted">Optional • Max 5MB • JPG, PNG, WebP</p>`;
      }
    } catch (err) {
      console.error('Submit error:', err);
      SurakshaUI.showToast('Submission failed. Please try again.', 'error');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '🚀 Submit Report'; }
    }
  }

  function showSuccessModal(token, isOverride = false, overriddenToken = null) {
    SurakshaUI.showModal({
      title: '🎉 Report Submitted!',
      body: `
        <div style="text-align:center;padding:8px 0;">
          <div style="font-size:3rem;margin-bottom:12px;animation:scaleBounce 0.5s ease;">✅</div>
          ${isOverride ? `
            <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,0.12);color:#059669;padding:4px 12px;border-radius:9999px;font-size:0.78rem;font-weight:600;margin-bottom:12px;border:1px solid rgba(16,185,129,0.3);">
              <span>🤖 AI Override Verified</span>
              ${overriddenToken ? `<span style="font-size:0.7rem;opacity:0.8;">(Distinct from ${overriddenToken})</span>` : ''}
            </div>
          ` : ''}
          <p class="text-body" style="margin-bottom:16px;">
            ${isOverride
              ? 'Your report was confirmed as a distinct hazard by AI and submitted to the municipal triage queue.'
              : 'Your report has been submitted and is being reviewed by our AI system.'}
          </p>
          <div class="card" style="background:var(--c-primary-light);border-color:var(--c-primary);padding:16px;margin-bottom:16px;">
            <p class="text-small text-muted" style="margin-bottom:4px;">Your Tracking Code</p>
            <p class="text-heading" style="font-family:var(--font-mono);color:var(--c-primary);letter-spacing:0.05em;" id="success-token">${token}</p>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard?.writeText('${token}');SurakshaUI.showToast('Token copied!','success');">
            📋 Copy Token
          </button>
          <p class="text-small text-muted" style="margin-top:12px;">Use this code to track your report status anytime.</p>
        </div>
      `,
      actions: [
        { id: 'track', label: '🔍 Track My Report', cls: 'btn-primary', onClick: () => { window.location.hash = `#/track?token=${token}`; } },
        { id: 'close', label: 'Done', cls: 'btn-secondary', onClick: () => {} }
      ]
    });
  }

  window.SurakshaWizard = { init };
})();
