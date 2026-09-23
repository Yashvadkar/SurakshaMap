/**
 * report-wizard.js — 5-Step Anonymous Incident Reporting
 */

(function () {
  'use strict';

  let currentStep = 1;
  let selectedCategory = '';
  let selectedSeverity = 'medium';
  let selectedLocation = { lat: null, lng: null };
  let selectedPhotoFile = null;
  let selectedPhotoPreview = null;
  let miniMap = null;
  let miniMapMarker = null;

  function init() {
    currentStep = 1;
    selectedCategory = '';
    selectedSeverity = 'medium';
    selectedLocation = { lat: null, lng: null };
    selectedPhotoFile = null;
    selectedPhotoPreview = null;
    showStep(1);
    setupCategorySelection();
    setupLocationStep();
    setupSeveritySelection();
    setupPhotoUpload();
    setupNavButtons();
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

  function initMiniMap() {
    const container = document.getElementById('mini-map');
    if (!container || miniMap) return;
    const center = SURAKSHAMAP_CONFIG?.app?.defaultCenter || { lat: 19.076, lng: 72.8777 };

    miniMap = L.map('mini-map', { zoomControl: false, attributionControl: false }).setView([center.lat, center.lng], 13);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    L.tileLayer(isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png',
      { maxZoom: 19 }
    ).addTo(miniMap);

    L.control.zoom({ position: 'topright' }).addTo(miniMap);

    miniMap.on('click', (e) => {
      selectedLocation = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (miniMapMarker) {
        miniMapMarker.setLatLng(e.latlng);
      } else {
        miniMapMarker = L.marker(e.latlng, { draggable: true }).addTo(miniMap);
        miniMapMarker.on('dragend', (ev) => {
          const latlng = ev.target.getLatLng();
          selectedLocation = { lat: latlng.lat, lng: latlng.lng };
          const status = document.getElementById('location-status');
          if (status) status.innerHTML = `📍 Pin placed: <strong>${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}</strong>`;
        });
      }
      const status = document.getElementById('location-status');
      if (status) status.innerHTML = `📍 Pin placed: <strong>${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}</strong>`;
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
    document.getElementById('wizard-next')?.addEventListener('click', () => {
      if (validateStep(currentStep)) showStep(currentStep + 1);
    });
    document.getElementById('wizard-prev')?.addEventListener('click', () => {
      if (currentStep > 1) showStep(currentStep - 1);
    });
    document.getElementById('wizard-submit')?.addEventListener('click', submitReport);
  }

  function validateStep(step) {
    switch (step) {
      case 1:
        if (!selectedCategory) { SurakshaUI.showToast('Please select a category', 'warning'); return false; }
        return true;
      case 2:
        if (!selectedLocation.lat || !selectedLocation.lng) { SurakshaUI.showToast('Please set a location using GPS or clicking the map', 'warning'); return false; }
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

      let photoUrl = null;
      if (selectedPhotoFile) {
        try {
          photoUrl = await window.SurakshaDB.uploadPhoto(selectedPhotoFile, id);
        } catch { photoUrl = selectedPhotoPreview; }
      }

      const report = {
        id, trackingToken: token, category: selectedCategory,
        description: desc, latitude: selectedLocation.lat, longitude: selectedLocation.lng,
        severity: selectedSeverity, photoUrl: photoUrl || selectedPhotoPreview,
        submittedAt: new Date().toISOString(), status: 'pending_ai',
        aiReview: null, duplicateOf: null, citizenUpdate: null, citizenUpdateAt: null
      };

      await window.SurakshaDB.addReport(report);
      SurakshaUI.saveToken(token);

      // Show success
      showStep(1); // Reset wizard
      const reviewEl = document.getElementById('review-summary');
      if (reviewEl) reviewEl.innerHTML = '';

      showSuccessModal(token);
      SurakshaUI.showToast('Report submitted successfully!', 'success');

      // Reset state
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

  function showSuccessModal(token) {
    SurakshaUI.showModal({
      title: '🎉 Report Submitted!',
      body: `
        <div style="text-align:center;padding:8px 0;">
          <div style="font-size:3rem;margin-bottom:12px;animation:scaleBounce 0.5s ease;">✅</div>
          <p class="text-body" style="margin-bottom:16px;">Your report has been submitted and is being reviewed by our AI system.</p>
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
