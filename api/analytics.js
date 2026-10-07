/**
 * api/analytics.js — Vercel Serverless Function
 * Computes Real Hotspot Risk Scoring (0-100), Time-based Safety Distribution,
 * and Impact/Resolution Metrics directly from Vercel Postgres.
 */

const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    pool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

// Haversine distance in meters
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Cluster reports within 600m
function clusterReports(reports, maxRadiusMeters = 600) {
  const clusters = [];
  const visited = new Set();

  for (let i = 0; i < reports.length; i++) {
    if (visited.has(reports[i].id)) continue;
    const current = reports[i];
    visited.add(current.id);

    const clusterMembers = [current];
    for (let j = i + 1; j < reports.length; j++) {
      if (visited.has(reports[j].id)) continue;
      const other = reports[j];
      const dist = haversineDistance(current.latitude, current.longitude, other.latitude, other.longitude);
      if (dist <= maxRadiusMeters) {
        visited.add(other.id);
        clusterMembers.push(other);
      }
    }

    // Centroid
    const avgLat = clusterMembers.reduce((sum, r) => sum + r.latitude, 0) / clusterMembers.length;
    const avgLng = clusterMembers.reduce((sum, r) => sum + r.longitude, 0) / clusterMembers.length;

    // Severity weights
    const criticalCount = clusterMembers.filter(r => r.severity === 'critical').length;
    const highCount = clusterMembers.filter(r => r.severity === 'high').length;
    const mediumCount = clusterMembers.filter(r => r.severity === 'medium').length;
    const lowCount = clusterMembers.filter(r => r.severity === 'low').length;
    const resolvedCount = clusterMembers.filter(r => r.status === 'resolved').length;
    const activeMembers = clusterMembers.filter(r => r.status !== 'resolved');

    // Risk score computation (0 - 100)
    // Critical: 28 pts, High: 18 pts, Medium: 10 pts, Low: 4 pts
    let rawScore = (criticalCount * 28) + (highCount * 18) + (mediumCount * 10) + (lowCount * 4);
    
    // Mitigate score if issues have been resolved
    if (clusterMembers.length > 0) {
      const mitigationDiscount = (resolvedCount / clusterMembers.length) * 0.45;
      rawScore = rawScore * (1 - mitigationDiscount);
    }

    const riskScore = Math.min(100, Math.max(10, Math.round(rawScore)));
    let riskLevel = 'Low Risk';
    let riskColor = '#10B981';
    if (riskScore >= 75) { riskLevel = 'Critical Hazard'; riskColor = '#EF4444'; }
    else if (riskScore >= 50) { riskLevel = 'High Concern'; riskColor = '#F59E0B'; }
    else if (riskScore >= 30) { riskLevel = 'Moderate Caution'; riskColor = '#3B82F6'; }

    // Time-of-day distribution for this cluster
    const timeSlots = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    clusterMembers.forEach(r => {
      const hour = new Date(r.submitted_at || r.created_at).getHours();
      if (hour >= 6 && hour < 12) timeSlots.morning++;
      else if (hour >= 12 && hour < 17) timeSlots.afternoon++;
      else if (hour >= 17 && hour < 22) timeSlots.evening++;
      else timeSlots.night++;
    });

    let peakWindow = 'Evening (5 PM - 10 PM)';
    let maxSlotCount = timeSlots.evening;
    if (timeSlots.night > maxSlotCount) { peakWindow = 'Late Night (10 PM - 6 AM)'; maxSlotCount = timeSlots.night; }
    if (timeSlots.morning > maxSlotCount) { peakWindow = 'Morning Rush (6 AM - 12 PM)'; maxSlotCount = timeSlots.morning; }
    if (timeSlots.afternoon > maxSlotCount) { peakWindow = 'Afternoon (12 PM - 5 PM)'; maxSlotCount = timeSlots.afternoon; }

    // Dominant categories & infrastructure flaws
    const categories = {};
    const infraConditions = {};
    const locationTypes = {};
    clusterMembers.forEach(r => {
      categories[r.category] = (categories[r.category] || 0) + 1;
      infraConditions[r.infrastructure_condition] = (infraConditions[r.infrastructure_condition] || 0) + 1;
      locationTypes[r.location_type] = (locationTypes[r.location_type] || 0) + 1;
    });

    clusters.push({
      clusterId: 'cl-' + (clusters.length + 1),
      center: { latitude: avgLat, longitude: avgLng },
      radiusMeters: maxRadiusMeters,
      totalIncidents: clusterMembers.length,
      activeIncidents: activeMembers.length,
      resolvedIncidents: resolvedCount,
      riskScore,
      riskLevel,
      riskColor,
      timeAnalysis: {
        timeSlots,
        peakWindow
      },
      topCategory: Object.keys(categories).sort((a,b) => categories[b] - categories[a])[0] || 'general',
      topInfrastructureFlaw: Object.keys(infraConditions).sort((a,b) => infraConditions[b] - infraConditions[a])[0] || 'normal',
      primaryLocationType: Object.keys(locationTypes).sort((a,b) => locationTypes[b] - locationTypes[a])[0] || 'general',
      incidentIds: clusterMembers.map(r => r.id),
      sampleIncidents: clusterMembers.slice(0, 3).map(r => ({
        id: r.id,
        category: r.category,
        description: r.description,
        severity: r.severity,
        locationType: r.location_type,
        infrastructureCondition: r.infrastructure_condition,
        submittedAt: r.submitted_at
      }))
    });
  }

  return clusters.sort((a, b) => b.riskScore - a.riskScore);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const db = getPool();

  try {
    const reportsRes = await db.query(`
      SELECT id, tracking_token, category, description, latitude, longitude,
             severity, location_type, infrastructure_condition, status,
             submitted_at, created_at
      FROM reports
      ORDER BY submitted_at DESC;
    `);

    const allReports = reportsRes.rows;
    const totalReports = allReports.length;
    const resolvedReports = allReports.filter(r => r.status === 'resolved').length;
    const pendingReports = allReports.filter(r => r.status === 'pending_review').length;
    const verifiedReports = allReports.filter(r => r.status === 'verified').length;

    // Time-based breakdown overall
    const overallTimeAnalysis = {
      morningRush: 0,   // 6 AM - 12 PM
      afternoon: 0,     // 12 PM - 5 PM
      eveningPeak: 0,   // 5 PM - 10 PM
      lateNight: 0      // 10 PM - 6 AM
    };

    const categoryBreakdown = {};
    const infrastructureBreakdown = {};
    const locationTypeBreakdown = {};

    allReports.forEach(r => {
      const hour = new Date(r.submitted_at || r.created_at).getHours();
      if (hour >= 6 && hour < 12) overallTimeAnalysis.morningRush++;
      else if (hour >= 12 && hour < 17) overallTimeAnalysis.afternoon++;
      else if (hour >= 17 && hour < 22) overallTimeAnalysis.eveningPeak++;
      else overallTimeAnalysis.lateNight++;

      categoryBreakdown[r.category] = (categoryBreakdown[r.category] || 0) + 1;
      if (r.infrastructure_condition && r.infrastructure_condition !== 'normal') {
        infrastructureBreakdown[r.infrastructure_condition] = (infrastructureBreakdown[r.infrastructure_condition] || 0) + 1;
      }
      if (r.location_type && r.location_type !== 'general') {
        locationTypeBreakdown[r.location_type] = (locationTypeBreakdown[r.location_type] || 0) + 1;
      }
    });

    // Compute Hotspots
    const hotspots = clusterReports(allReports, 600);

    // Compute Resolution & Impact Metrics
    const resolutionRate = totalReports > 0 ? Math.round((resolvedReports / totalReports) * 100) : 0;
    const estimatedRiskMitigated = resolvedReports * 22; // points mitigated

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        totalReports,
        resolvedReports,
        pendingReports,
        verifiedReports,
        resolutionRate,
        estimatedRiskMitigated,
        hotspotCount: hotspots.length,
        criticalHotspots: hotspots.filter(h => h.riskScore >= 75).length
      },
      timeAnalysis: overallTimeAnalysis,
      categoryBreakdown,
      infrastructureBreakdown,
      locationTypeBreakdown,
      hotspots
    });
  } catch (err) {
    console.error('[API Analytics Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
