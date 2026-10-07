/**
 * api/reports.js — Vercel Serverless Function
 * Full CRUD & query engine for SurakshaMap safety reports backed by Vercel Postgres.
 * Fully replaces Firestore client dependencies with serverless Postgres.
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

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function cleanRow(r) {
  if (!r) return null;
  return {
    id: String(r.id),
    trackingToken: r.tracking_token || `SM-${String(r.id).slice(-6).toUpperCase()}`,
    category: (r.category || 'other').trim().toLowerCase(),
    description: (r.description || '').trim(),
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    severity: ['critical', 'high', 'medium', 'low'].includes(r.severity) ? r.severity : 'medium',
    locationType: r.location_type || 'general',
    infrastructureCondition: r.infrastructure_condition || 'normal',
    status: r.status === 'pending' ? 'pending_review' : (r.status || 'pending_review'),
    photoUrl: r.photo_url || null,
    aiReview: r.ai_review && typeof r.ai_review === 'object' ? r.ai_review : null,
    duplicateOf: r.duplicate_of || null,
    citizenUpdate: r.citizen_update || null,
    citizenUpdateAt: r.citizen_update_at ? new Date(r.citizen_update_at).toISOString() : null,
    submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : new Date().toISOString(),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const db = getPool();

  try {
    // ─── GET /api/reports ───
    if (req.method === 'GET') {
      const { status, category, token, id, limit = 500, includeTest } = req.query;

      if (token) {
        const query = 'SELECT * FROM reports WHERE tracking_token = $1 LIMIT 1;';
        const result = await db.query(query, [token.trim().toUpperCase()]);
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Report not found' });
        }
        return res.status(200).json({ success: true, report: cleanRow(result.rows[0]) });
      }

      if (id) {
        const query = 'SELECT * FROM reports WHERE id = $1 LIMIT 1;';
        const result = await db.query(query, [id.trim()]);
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Report not found' });
        }
        return res.status(200).json({ success: true, report: cleanRow(result.rows[0]) });
      }

      let query = 'SELECT * FROM reports';
      const params = [];
      const whereClauses = [];

      // Auto-filter out automated test records unless explicitly requested
      if (!includeTest) {
        whereClauses.push(`(description NOT ILIKE 'E2E Test:%' AND description NOT ILIKE '[TEST]%')`);
      }

      if (status) {
        const statusList = status.split(',').map(s => s.trim()).filter(Boolean);
        if (statusList.length > 0) {
          params.push(statusList);
          whereClauses.push(`status = ANY($${params.length})`);
        }
      }

      if (category) {
        params.push(category.trim().toLowerCase());
        whereClauses.push(`category = $${params.length}`);
      }

      if (whereClauses.length > 0) {
        query += ' WHERE ' + whereClauses.join(' AND ');
      }

      params.push(parseInt(limit, 10) || 500);
      query += ` ORDER BY submitted_at DESC LIMIT $${params.length};`;

      const result = await db.query(query, params);
      const reports = result.rows.map(cleanRow).filter(Boolean);

      return res.status(200).json({ success: true, count: reports.length, reports });
    }

    // ─── POST /api/reports ───
    if (req.method === 'POST') {
      const b = req.body || {};
      const lat = Number(b.latitude);
      const lng = Number(b.longitude);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ success: false, error: 'Valid latitude and longitude are required.' });
      }

      const id = b.id || ('rep-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6));
      const trackingToken = b.trackingToken || ('SM-' + id.slice(-6).toUpperCase());
      const category = (b.category || 'other').trim().toLowerCase();
      const description = (b.description || '').trim();
      const severity = ['critical', 'high', 'medium', 'low'].includes(b.severity) ? b.severity : 'medium';
      const locationType = (b.locationType || 'general').trim().toLowerCase();
      const infrastructureCondition = (b.infrastructureCondition || 'normal').trim().toLowerCase();
      let status = b.status || 'pending_review';
      const photoUrl = b.photoUrl || null;
      const aiReview = b.aiReview || null;
      let duplicateOf = b.duplicateOf || null;
      const submittedAt = b.submittedAt ? new Date(b.submittedAt).toISOString() : new Date().toISOString();

      // ─── Spatial & Temporal Deduplication (50m & 48h Window) ───
      if (!duplicateOf) {
        try {
          const recentSql = `
            SELECT id, tracking_token, latitude, longitude, category, status
            FROM reports
            WHERE category = $1
              AND status NOT IN ('rejected', 'ai_rejected')
              AND submitted_at >= NOW() - INTERVAL '48 hours'
            ORDER BY submitted_at DESC
            LIMIT 50;
          `;
          const recentRes = await db.query(recentSql, [category]);
          for (const cand of recentRes.rows) {
            const dist = haversineDistanceMeters(lat, lng, Number(cand.latitude), Number(cand.longitude));
            if (dist <= 50) {
              duplicateOf = cand.tracking_token || String(cand.id);
              status = 'flagged_duplicate';
              break;
            }
          }
        } catch (dedupeErr) {
          console.warn('[Deduplication Warning]:', dedupeErr.message);
        }
      }

      const insertSql = `
        INSERT INTO reports (
          id, tracking_token, category, description,
          latitude, longitude, severity, location_type, infrastructure_condition,
          status, photo_url, ai_review, duplicate_of,
          submitted_at, created_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, NOW()
        )
        RETURNING *;
      `;

      const result = await db.query(insertSql, [
        id, trackingToken, category, description,
        lat, lng, severity, locationType, infrastructureCondition,
        status, photoUrl, aiReview, duplicateOf,
        submittedAt
      ]);

      return res.status(201).json({
        success: true,
        reportId: id,
        trackingToken,
        duplicateOf,
        isDeduplicated: !!duplicateOf,
        report: cleanRow(result.rows[0])
      });
    }

    // ─── PATCH /api/reports ───
    if (req.method === 'PATCH') {
      const { id, status, citizenUpdate, duplicateOf } = req.body || {};
      if (!id) {
        return res.status(400).json({ success: false, error: 'Report ID is required.' });
      }

      const updates = [];
      const params = [id];

      if (status) {
        params.push(status);
        updates.push(`status = $${params.length}`);
      }
      if (citizenUpdate !== undefined) {
        params.push(citizenUpdate);
        updates.push(`citizen_update = $${params.length}`);
        updates.push(`citizen_update_at = NOW()`);
      }
      if (duplicateOf !== undefined) {
        params.push(duplicateOf);
        updates.push(`duplicate_of = $${params.length}`);
      }

      if (updates.length === 0) {
        return res.status(400).json({ success: false, error: 'No fields to update provided.' });
      }

      const updateSql = `
        UPDATE reports
        SET ${updates.join(', ')}
        WHERE id = $1
        RETURNING *;
      `;

      const result = await db.query(updateSql, params);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Report not found' });
      }

      return res.status(200).json({
        success: true,
        report: cleanRow(result.rows[0])
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('[API Reports Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
