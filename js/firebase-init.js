/**
 * firebase-init.js — Firebase SDK Initialization
 * Initializes Firestore, Auth, and Storage using compat SDK loaded via CDN.
 * Falls back to localStorage demo mode if Firebase is not configured.
 */

(function () {
  'use strict';

  const cfg = window.SURAKSHAMAP_CONFIG;

  // Check for placeholder config
  const isPlaceholder = !cfg || !cfg.firebase || cfg.firebase.apiKey === 'YOUR_FIREBASE_API_KEY';

  if (isPlaceholder || typeof firebase === 'undefined') {
    console.info(
      '%c[SurakshaMap] Running in DEMO mode — Firebase not configured.\n' +
      'Reports are saved to localStorage. To enable full features, edit js/config.js.',
      'color: #F59E0B; font-weight: bold; font-size: 13px;'
    );
    window.FIREBASE_READY = false;

    // Create a lightweight localStorage-based fallback API
    window.SurakshaDB = createLocalStorageDB();
    return;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(cfg.firebase);
    }

    window.db = firebase.firestore();
    window.auth = firebase.auth();
    window.storage = firebase.storage();

    window.db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('[Firestore] Multi-tab persistence unavailable.');
      } else if (err.code === 'unimplemented') {
        console.warn('[Firestore] Persistence not supported in this browser.');
      }
    });

    window.FIREBASE_READY = true;
    window.SurakshaDB = createFirestoreDB();
    console.info('%c[SurakshaMap] Firebase initialized ✓', 'color: #10B981; font-weight: bold;');
  } catch (error) {
    console.error('[SurakshaMap] Firebase init failed:', error);
    window.FIREBASE_READY = false;
    window.SurakshaDB = createLocalStorageDB();
  }

  // ─── Firestore Database Adapter ───
  function createFirestoreDB() {
    const reportsRef = () => window.db.collection('reports');

    return {
      async addReport(report) {
        const docRef = await reportsRef().add({
          ...report,
          submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return docRef.id;
      },

      async getReportByToken(token) {
        const snap = await reportsRef().where('trackingToken', '==', token).limit(1).get();
        if (snap.empty) return null;
        const doc = snap.docs[0];
        return { id: doc.id, ...doc.data(), submittedAt: doc.data().submittedAt?.toDate?.()?.toISOString() || doc.data().submittedAt };
      },

      async getAllReports() {
        const snap = await reportsRef().orderBy('submittedAt', 'desc').get();
        return snap.docs.map(doc => {
          const d = doc.data();
          return { id: doc.id, ...d, submittedAt: d.submittedAt?.toDate?.()?.toISOString() || d.submittedAt };
        });
      },

      async getReportsByStatus(statusList) {
        const snap = await reportsRef().where('status', 'in', statusList).orderBy('submittedAt', 'desc').get();
        return snap.docs.map(doc => {
          const d = doc.data();
          return { id: doc.id, ...d, submittedAt: d.submittedAt?.toDate?.()?.toISOString() || d.submittedAt };
        });
      },

      async updateReport(id, updates) {
        await reportsRef().doc(id).update(updates);
      },

      async deleteReport(id) {
        await reportsRef().doc(id).delete();
      },

      onReportsChange(callback) {
        return reportsRef().orderBy('submittedAt', 'desc').onSnapshot(snap => {
          const reports = snap.docs.map(doc => {
            const d = doc.data();
            return { id: doc.id, ...d, submittedAt: d.submittedAt?.toDate?.()?.toISOString() || d.submittedAt };
          });
          callback(reports);
        });
      },

      async uploadPhoto(file, reportId) {
        const ext = file.name.split('.').pop();
        const ref = window.storage.ref(`reports/${reportId}/photo.${ext}`);
        await ref.put(file);
        return await ref.getDownloadURL();
      }
    };
  }

  // ─── LocalStorage Fallback Adapter ───
  function createLocalStorageDB() {
    const STORAGE_KEY = 'surakshamap_reports_v4';

    const SEED_REPORTS = [
      {
        id: 'demo-1', trackingToken: 'SM-8F2A1C', category: 'broken streetlight',
        description: 'Entire 200m stretch near Metro Gate 3 is completely dark after 7 PM. High pedestrian density.',
        latitude: 19.1197, longitude: 72.9056, severity: 'high',
        submittedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
        status: 'pending_review', photoUrl: null, aiReview: { genuine: true, confidence: 0.94, reason: 'Specific location and infrastructure issue described.' },
        duplicateOf: null, citizenUpdate: null, citizenUpdateAt: null
      },
      {
        id: 'demo-2', trackingToken: 'SM-3D7B9E', category: 'open manhole',
        description: 'Uncovered manhole on main footpath outside Andheri station west exit. Very dangerous during rain.',
        latitude: 19.1190, longitude: 72.8463, severity: 'critical',
        submittedAt: new Date(Date.now() - 8 * 3600000).toISOString(),
        status: 'verified', photoUrl: null, aiReview: { genuine: true, confidence: 0.97, reason: 'Critical safety hazard clearly described.' },
        duplicateOf: null, citizenUpdate: null, citizenUpdateAt: null
      },
      {
        id: 'demo-3', trackingToken: 'SM-6K4P2W', category: 'waterlogging',
        description: 'Chronic waterlogging at S.V. Road underpass. Water rises to knee level during moderate rain.',
        latitude: 19.1070, longitude: 72.8370, severity: 'high',
        submittedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
        status: 'in_progress', photoUrl: null, aiReview: { genuine: true, confidence: 0.91, reason: 'Known waterlogging area described.' },
        duplicateOf: null, citizenUpdate: null, citizenUpdateAt: null
      },
      {
        id: 'demo-4', trackingToken: 'SM-9R1T5X', category: 'unsafe crossing',
        description: 'No pedestrian signal at busy junction near D.N. Nagar. Multiple near-miss incidents reported.',
        latitude: 19.1028, longitude: 72.8400, severity: 'high',
        submittedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
        status: 'pending_review', photoUrl: null, aiReview: null,
        duplicateOf: null, citizenUpdate: null, citizenUpdateAt: null
      },
      {
        id: 'demo-5', trackingToken: 'SM-2H8M4J', category: 'broken footpath',
        description: 'Broken tiles and exposed rebar on footpath near Juhu Beach entrance. Trip hazard for elderly.',
        latitude: 19.0989, longitude: 72.8265, severity: 'medium',
        submittedAt: new Date(Date.now() - 72 * 3600000).toISOString(),
        status: 'resolved', photoUrl: null, aiReview: { genuine: true, confidence: 0.88, reason: 'Specific location with clear hazard.' },
        duplicateOf: null, citizenUpdate: 'resolved', citizenUpdateAt: new Date(Date.now() - 12 * 3600000).toISOString()
      },
      {
        id: 'demo-6', trackingToken: 'SM-7V3Q1N', category: 'obstruction',
        description: 'Construction debris blocking half the road near Lokhandwala circle for over a week.',
        latitude: 19.1398, longitude: 72.8354, severity: 'medium',
        submittedAt: new Date(Date.now() - 96 * 3600000).toISOString(),
        status: 'verified', photoUrl: null, aiReview: { genuine: true, confidence: 0.85, reason: 'Road obstruction with timeframe.' },
        duplicateOf: null, citizenUpdate: 'issue_still_there', citizenUpdateAt: new Date(Date.now() - 24 * 3600000).toISOString()
      }
    ];

    function loadReports() {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) { saveReports(SEED_REPORTS); return [...SEED_REPORTS]; }
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...SEED_REPORTS];
      } catch { return [...SEED_REPORTS]; }
    }

    function saveReports(reports) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(reports)); } catch (e) { console.error('Save failed:', e); }
    }

    let reports = loadReports();
    let listeners = [];

    function notifyListeners() {
      listeners.forEach(cb => cb([...reports]));
    }

    return {
      async addReport(report) {
        reports.unshift(report);
        saveReports(reports);
        notifyListeners();
        return report.id;
      },

      async getReportByToken(token) {
        return reports.find(r => r.trackingToken === token) || null;
      },

      async getAllReports() {
        return [...reports];
      },

      async getReportsByStatus(statusList) {
        return reports.filter(r => statusList.includes(r.status));
      },

      async updateReport(id, updates) {
        const idx = reports.findIndex(r => r.id === id);
        if (idx !== -1) {
          reports[idx] = { ...reports[idx], ...updates };
          saveReports(reports);
          notifyListeners();
        }
      },

      async deleteReport(id) {
        reports = reports.filter(r => r.id !== id);
        saveReports(reports);
        notifyListeners();
      },

      onReportsChange(callback) {
        listeners.push(callback);
        callback([...reports]);
        return () => { listeners = listeners.filter(l => l !== callback); };
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
})();
