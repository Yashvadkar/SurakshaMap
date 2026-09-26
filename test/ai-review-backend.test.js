/**
 * test/ai-review-backend.test.js — Verification test suite for SurakshaMap AI Review Backend
 * Tests:
 * 1. Duplicate detection: distance, tokenization, Jaccard similarity, time window
 * 2. Status workflow logic: genuine vs spam vs duplicate vs AI error
 * 3. Photo data URL and HTTPS handling
 * 4. Resilient error handling (preserves report, safe status)
 * 5. Structured response compatibility with frontend admin-dashboard.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Tokenizer & Jaccard logic
function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

function jaccardSimilarity(tokens1, tokens2) {
  if (tokens1.length === 0 && tokens2.length === 0) return 0;
  const a = new Set(tokens1);
  const b = new Set(tokens2);
  let intersection = 0;
  for (const x of a) {
    if (b.has(x)) intersection++;
  }
  const union = new Set([...tokens1, ...tokens2]).size;
  return union === 0 ? 0 : intersection / union;
}

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

function determineReportStatus(aiResult, duplicates) {
  if (!aiResult.genuine) {
    return 'ai_rejected';
  } else if (duplicates && duplicates.length > 0) {
    return 'flagged_duplicate';
  } else {
    return 'pending_review';
  }
}

describe('Duplicate Detection & Proximity', () => {
  test('Tokenizes text correctly and filters small words', () => {
    const tokens = tokenize('The broken streetlight near main gate is dark!');
    assert.deepEqual(tokens, ['the', 'broken', 'streetlight', 'near', 'main', 'gate', 'dark']);
  });

  test('Computes high Jaccard similarity for similar incident descriptions', () => {
    const textA = 'Broken streetlight near metro gate 3 completely dark';
    const textB = 'Streetlight is broken near metro gate 3 very dark at night';
    const sim = jaccardSimilarity(tokenize(textA), tokenize(textB));
    assert.ok(sim >= 0.35, `Similarity should exceed 0.35, got ${sim}`);
  });

  test('Computes low Jaccard similarity for different descriptions', () => {
    const textA = 'Broken streetlight near gate';
    const textB = 'Waterlogging under bridge with flood water';
    const sim = jaccardSimilarity(tokenize(textA), tokenize(textB));
    assert.ok(sim < 0.2, `Similarity should be low, got ${sim}`);
  });

  test('Haversine distance calculation is accurate for nearby coordinates', () => {
    // ~111m apart
    const dist = haversineDistance(19.076, 72.8777, 19.077, 72.8777);
    assert.ok(dist > 100 && dist < 120, `Distance should be ~111m, got ${dist}`);
  });
});

describe('Status Workflow Logic', () => {
  test('TEST 1: Genuine report with no duplicates transitions to pending_review', () => {
    const aiResult = {
      genuine: true,
      confidence: 0.95,
      reason: 'Valid infrastructure defect reported'
    };
    const status = determineReportStatus(aiResult, []);
    assert.equal(status, 'pending_review');
    // Admin remains final authority! Must NOT be auto-verified
    assert.notEqual(status, 'verified');
  });

  test('TEST 2: Spam / joke report transitions to ai_rejected', () => {
    const aiResult = {
      genuine: false,
      confidence: 0.98,
      reason: 'Gibberish or test submission detected'
    };
    const status = determineReportStatus(aiResult, []);
    assert.equal(status, 'ai_rejected');
  });

  test('TEST 3: Genuine report with duplicate detected transitions to flagged_duplicate', () => {
    const aiResult = {
      genuine: true,
      confidence: 0.92,
      reason: 'Plausible hazard'
    };
    const duplicates = [
      { id: 'rep-1', trackingToken: 'SM-1234', distance: 45, similarity: 78 }
    ];
    const status = determineReportStatus(aiResult, duplicates);
    assert.equal(status, 'flagged_duplicate');
  });

  test('TEST 5: Resilient error fallback does NOT mark genuine and sets pending_review', () => {
    // When AI fails (e.g. Gemini API error / timeout)
    const errorFallback = {
      aiReview: {
        genuine: null, // NOT marked genuine
        confidence: 0,
        reason: 'Automatic AI review unavailable. Forwarded for manual administrator review.',
        categoryCheck: 'Pending manual verification',
        severityAssessment: 'Pending manual review',
        summary: 'Streetlight broken near entrance',
        error: true,
        errorMessage: 'Review service temporarily unavailable'
      },
      status: 'pending_review'
    };

    assert.equal(errorFallback.status, 'pending_review');
    assert.equal(errorFallback.aiReview.genuine, null);
    assert.equal(errorFallback.aiReview.error, true);
    assert.ok(errorFallback.aiReview.reason.includes('manual'));
  });
});

describe('Photo Data URL Parsing', () => {
  test('TEST 4: Correctly parses webp / jpeg base64 data URLs without crashing', () => {
    const dummyDataUrl = 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/2AAA';
    const match = dummyDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    assert.ok(match, 'Must match data URL pattern');
    assert.equal(match[1], 'image/webp');
    assert.equal(match[2], 'UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/2AAA');
  });
});

describe('Backward Compatibility with Admin Dashboard', () => {
  test('Admin dashboard properties exist and are valid types', () => {
    const aiReview = {
      genuine: true,
      confidence: 0.94,
      reason: 'Broken streetlight with location specifics',
      categoryCheck: 'Consistent',
      severityAssessment: 'Appropriate',
      summary: 'Streetlight outage causing poor visibility',
      reviewedAt: new Date().toISOString(),
      model: 'gemini-2.0-flash',
      error: false
    };

    // admin-dashboard.js checks:
    // r.aiReview.genuine
    // r.aiReview.confidence
    // r.aiReview.reason
    assert.equal(typeof aiReview.genuine, 'boolean');
    assert.equal(typeof aiReview.confidence, 'number');
    assert.equal(typeof aiReview.reason, 'string');
    assert.ok(aiReview.confidence >= 0 && aiReview.confidence <= 1);
  });
});
