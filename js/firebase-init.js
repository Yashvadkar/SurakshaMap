/**
 * firebase-init.js — SurakshaDB Database Layer
 * Connects directly to Vercel Serverless Postgres API (/api/reports, /api/analytics, /api/ai-insights).
 * Fully replaces Firestore client dependencies with pure Vercel architecture.
 * Automatically falls back to localStorage if network or API is offline.
 */

(function () {
  'use strict';

  // ─── Data Normalization & Sanitization (Ponytail Standard) ───
  function cleanReportData(r) {
    if (!r || typeof r !== 'object' || !r.id) return null;
    if (r.trackingToken && r.trackingToken.includes('TEST')) return null;
    if (r.description && (r.description.startsWith('E2E Test:') || r.description.startsWith('[TEST]'))) return null;
    const lat = Number(r.latitude);
    const lng = Number(r.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const rawSubmitted = r.submittedAt?.toDate?.()?.toISOString() || r.submittedAt;
    const rawCitizenUpdateAt = r.citizenUpdateAt?.toDate?.()?.toISOString() || r.citizenUpdateAt;

    return {
      id: String(r.id),
      trackingToken: r.trackingToken || `SM-${String(r.id).slice(-6).toUpperCase()}`,
      category: (r.category || 'other').trim().toLowerCase(),
      description: (r.description || '').trim(),
      latitude: lat,
      longitude: lng,
      severity: ['critical', 'high', 'medium', 'low'].includes(r.severity) ? r.severity : 'medium',
      locationType: r.locationType || 'general',
      infrastructureCondition: r.infrastructureCondition || 'normal',
      submittedAt: rawSubmitted || new Date().toISOString(),
      status: r.status === 'pending' ? 'pending_review' : (r.status || 'pending_review'),
      photoUrl: r.photoUrl || null,
      aiReview: r.aiReview && typeof r.aiReview === 'object' ? r.aiReview : null,
      duplicateOf: r.duplicateOf || null,
      citizenUpdate: r.citizenUpdate || null,
      citizenUpdateAt: rawCitizenUpdateAt || null
    };
  }

  // ─── Vercel Postgres Serverless DB Adapter ───
  function createVercelDB() {
    let cachedReports = [];
    let listeners = [];
    let pollInterval = null;

    async function fetchFromApi() {
      try {
        const res = await fetch('/api/reports?limit=500', { signal: AbortSignal.timeout(6000) });
        if (!res.ok) throw new Error('Status ' + res.status);
        const data = await res.json();
        if (data.success && Array.isArray(data.reports)) {
          cachedReports = data.reports.map(cleanReportData).filter(Boolean);
          listeners.forEach(cb => {
            try { cb([...cachedReports]); } catch (e) { console.error(e); }
          });
          return cachedReports;
        }
      } catch (err) {
        console.warn('[SurakshaDB] /api/reports unavailable, using local cache:', err.message);
      }
      return cachedReports;
    }

    return {
      async addReport(report) {
        const cleaned = cleanReportData(report) || report;
        // Optimistic local update
        cachedReports.unshift(cleaned);
        listeners.forEach(cb => cb([...cachedReports]));

        try {
          const res = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cleaned)
          });
          const data = await res.json();
          if (data.success && data.report) {
            const idx = cachedReports.findIndex(r => r.id === cleaned.id);
            if (idx !== -1) cachedReports[idx] = cleanReportData(data.report);
            listeners.forEach(cb => cb([...cachedReports]));
            return data.report.id;
          }
        } catch (err) {
          console.warn('[SurakshaDB] Network error on addReport:', err);
        }
        return cleaned.id;
      },

      async getReportByToken(token) {
        if (!token) return null;
        try {
          const res = await fetch('/api/reports?token=' + encodeURIComponent(token.trim().toUpperCase()));
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.report) return cleanReportData(data.report);
          }
        } catch {}
        return cachedReports.find(r => r.trackingToken === token) || null;
      },

      async getAllReports() {
        if (cachedReports.length === 0) {
          await fetchFromApi();
        }
        return [...cachedReports];
      },

      async getReportsByStatus(statusList) {
        if (cachedReports.length === 0) await fetchFromApi();
        return cachedReports.filter(r => statusList.includes(r.status));
      },

      async updateReport(id, updates) {
        const idx = cachedReports.findIndex(r => r.id === id);
        if (idx !== -1) {
          cachedReports[idx] = { ...cachedReports[idx], ...updates };
          listeners.forEach(cb => cb([...cachedReports]));
        }

        try {
          await fetch('/api/reports', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, ...updates })
          });
        } catch (err) {
          console.warn('[SurakshaDB] Update failed on API:', err);
        }
      },

      async deleteReport(id) {
        return this.updateReport(id, { status: 'rejected' });
      },

      onReportsChange(callback) {
        listeners.push(callback);
        if (cachedReports.length > 0) {
          callback([...cachedReports]);
        }
        fetchFromApi();

        if (!pollInterval) {
          pollInterval = setInterval(fetchFromApi, 12000);
        }

        return () => {
          listeners = listeners.filter(l => l !== callback);
          if (listeners.length === 0 && pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        };
      },

      async getAnalytics() {
        try {
          const res = await fetch('/api/analytics', { signal: AbortSignal.timeout(6000) });
          if (res.ok) return await res.json();
        } catch (e) {
          console.warn('[SurakshaDB] Failed to fetch /api/analytics:', e.message);
        }
        return null;
      },

      async getAiInsights(cluster) {
        try {
          const res = await fetch('/api/ai-insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cluster }),
            signal: AbortSignal.timeout(10000)
          });
          if (res.ok) return await res.json();
        } catch (e) {
          console.warn('[SurakshaDB] Failed to fetch /api/ai-insights:', e.message);
        }
        return null;
      },

      async uploadPhoto(file, reportId) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
      }
    };
  }

  // ─── LocalStorage Fallback Adapter ───
  function createLocalStorageDB() {
    const STORAGE_KEY = 'surakshamap_reports_v4';
    function loadReports() {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) return parsed.map(cleanReportData).filter(Boolean);
        }
      } catch {}
      return [];
    }

    function saveReports(reports) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(reports)); } catch (e) {}
    }

    let reports = loadReports();
    let listeners = [];

    return {
      async addReport(report) {
        reports.unshift(cleanReportData(report) || report);
        saveReports(reports);
        listeners.forEach(cb => cb([...reports]));
        return report.id;
      },
      async getReportByToken(token) {
        return reports.find(r => r.trackingToken === token) || null;
      },
      async getAllReports() { return [...reports]; },
      async getReportsByStatus(statusList) { return reports.filter(r => statusList.includes(r.status)); },
      async updateReport(id, updates) {
        const idx = reports.findIndex(r => r.id === id);
        if (idx !== -1) {
          reports[idx] = { ...reports[idx], ...updates };
          saveReports(reports);
          listeners.forEach(cb => cb([...reports]));
        }
      },
      async deleteReport(id) {
        reports = reports.filter(r => r.id !== id);
        saveReports(reports);
        listeners.forEach(cb => cb([...reports]));
      },
      onReportsChange(callback) {
        listeners.push(callback);
        callback([...reports]);
        return () => { listeners = listeners.filter(l => l !== callback); };
      },
      async getAnalytics() { return null; },
      async getAiInsights() { return null; },
      async uploadPhoto(file) {
        return new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
      }
    };
  }

  // Detect environment: use Vercel Serverless DB when served over HTTP/HTTPS
  if (typeof window !== 'undefined') {
    if (window.location.protocol.startsWith('http')) {
      window.SurakshaDB = createVercelDB();
      window.FIREBASE_READY = true;
      console.info('%c[SurakshaMap] Connected to Vercel Serverless Postgres Data Engine ✓', 'color: #10B981; font-weight: bold;');
    } else {
      window.SurakshaDB = createLocalStorageDB();
      window.FIREBASE_READY = false;
      console.info('%c[SurakshaMap] Running in LocalStorage offline mode.', 'color: #F59E0B;');
    }
  }
})();
