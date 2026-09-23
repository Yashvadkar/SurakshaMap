/**
 * risk-engine.js — Explainable Risk Scoring & Hotspot Clustering
 */

(function () {
  'use strict';

  const cfg = window.SURAKSHAMAP_CONFIG?.app || {};
  const DEFAULTS = {
    hotspotRadiusMeters: cfg.hotspotRadiusMeters || 200,
    hotspotMinReports: cfg.hotspotMinReports || 2,
    recentDays: cfg.recentDays || 30,
    timeZone: 'Asia/Kolkata'
  };

  const CATEGORY_SCORES = {
    'broken streetlight': 6, 'open manhole': 9, 'waterlogging': 7,
    'unsafe crossing': 8, 'broken footpath': 5, 'obstruction': 4,
    'harassment spot': 10, 'other': 4
  };
  const SEVERITY_MULTIPLIERS = { low: 1, medium: 2, high: 3, critical: 4 };

  function calculateReportScore(report, opts = {}) {
    const settings = { ...DEFAULTS, ...opts };
    const cat = (report.category || 'other').toLowerCase();
    const sev = (report.severity || 'medium').toLowerCase();

    let base = (CATEGORY_SCORES[cat] || 4) * (SEVERITY_MULTIPLIERS[sev] || 2);

    // Nighttime penalty
    const d = new Date(report.submittedAt);
    if (!isNaN(d.getTime())) {
      const h = d.getHours();
      if (h >= 19 || h < 6) base *= 1.5;
    }

    // Recency bonus
    const now = settings.now ? new Date(settings.now) : new Date();
    const daysSince = (now - d) / 86400000;
    if (daysSince <= 3) base *= 1.3;
    else if (daysSince <= 7) base *= 1.1;
    else if (daysSince > 30) base *= 0.7;

    return Math.round(base * 10) / 10;
  }

  function classifyRisk(score) {
    if (score >= 30) return 'critical';
    if (score >= 20) return 'high';
    if (score >= 10) return 'moderate';
    return 'low';
  }

  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function hasValidLocation(r) {
    const lat = Number(r.latitude), lon = Number(r.longitude);
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  function groupIntoHotspots(reports, opts = {}) {
    const settings = { ...DEFAULTS, ...opts };
    const valid = reports.filter(hasValidLocation);
    const used = new Set();
    const hotspots = [];

    for (const r of valid) {
      if (used.has(r.id)) continue;
      const nearby = valid.filter(o => {
        if (o.id === r.id || used.has(o.id)) return false;
        return haversineDistance(r.latitude, r.longitude, o.latitude, o.longitude) <= settings.hotspotRadiusMeters;
      });

      if (nearby.length + 1 >= settings.hotspotMinReports) {
        const cluster = [r, ...nearby];
        cluster.forEach(c => used.add(c.id));

        const center = {
          latitude: cluster.reduce((s, c) => s + Number(c.latitude), 0) / cluster.length,
          longitude: cluster.reduce((s, c) => s + Number(c.longitude), 0) / cluster.length
        };

        const totalScore = cluster.reduce((s, c) => s + calculateReportScore(c, settings), 0);
        const avgScore = totalScore / cluster.length;
        const cats = {};
        cluster.forEach(c => { const k = c.category || 'other'; cats[k] = (cats[k] || 0) + 1; });
        const dominantCategory = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';

        hotspots.push({
          center, reports: cluster, score: Math.round(totalScore),
          avgScore: Math.round(avgScore * 10) / 10,
          riskLevel: classifyRisk(avgScore),
          dominantCategory,
          explanation: buildExplanation(cluster, dominantCategory, settings)
        });
      }
    }

    return hotspots.sort((a, b) => b.score - a.score);
  }

  function buildExplanation(reports, category, settings) {
    const parts = [`${reports.length} reports of "${SurakshaUI.getCategoryLabel(category)}" within ${settings.hotspotRadiusMeters}m`];
    const nightCount = reports.filter(r => {
      const h = new Date(r.submittedAt).getHours();
      return h >= 19 || h < 6;
    }).length;
    if (nightCount > 0) parts.push(`${nightCount} reported at night (higher risk)`);
    const criticalCount = reports.filter(r => r.severity === 'critical' || r.severity === 'high').length;
    if (criticalCount > 0) parts.push(`${criticalCount} marked as high/critical severity`);
    return parts.join('. ') + '.';
  }

  function getRecommendation(category, riskLevel) {
    const recs = {
      'broken streetlight': 'Install/repair street lighting in this stretch. Consider solar-powered backup lights.',
      'open manhole': 'Immediate: secure/cover manhole. Long-term: install tamper-proof covers with locks.',
      'waterlogging': 'Clear drainage channels. Consider pump installation for chronic flooding zones.',
      'unsafe crossing': 'Install pedestrian signals, speed bumps, or a zebra crossing with reflective paint.',
      'broken footpath': 'Repair tiles/surface. Ensure ADA-accessible pathways.',
      'obstruction': 'Clear debris/encroachment. Enforce no-parking/no-dumping zone.',
      'harassment spot': 'Increase police patrols and CCTV coverage. Improve street lighting.',
      'other': 'Investigate and address reported hazard based on specifics.'
    };
    return recs[(category || '').toLowerCase()] || recs.other;
  }

  window.SurakshaRisk = {
    calculateReportScore, classifyRisk, groupIntoHotspots,
    haversineDistance, hasValidLocation, getRecommendation
  };
})();
