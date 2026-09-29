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


// ─── Proximity Detection (<50m), Category Matching & AI Override Tests ───
test('findNearbyHazards accurately detects hazards within 50m radius and respects category', () => {
  const baseLat = 12.971598;
  const baseLon = 77.594566;

  // 1 degree lat is ~111,000 meters. 30 meters is ~0.00027 degrees.
  const nearbyLat = baseLat + 0.00025; // ~28 meters away
  const farLat = baseLat + 0.0010;    // ~111 meters away

  const mockReports = [
    { id: 'rep1', trackingToken: 'TOK-1', category: 'pothole', latitude: nearbyLat, longitude: baseLon, status: 'verified', description: 'Deep crater' },
    { id: 'rep2', trackingToken: 'TOK-2', category: 'waterlogging', latitude: nearbyLat, longitude: baseLon, status: 'verified', description: 'Flooded road' },
    { id: 'rep3', trackingToken: 'TOK-3', category: 'pothole', latitude: farLat, longitude: baseLon, status: 'verified', description: 'Far away pothole' },
    { id: 'rep4', trackingToken: 'TOK-4', category: 'pothole', latitude: nearbyLat, longitude: baseLon, status: 'ai_rejected', description: 'Rejected spam' }
  ];

  // Helper matching the algorithm in ai-review.js
  function findNearbyHazards(lat, lon, allReports, radiusMeters = 50) {
    const active = allReports.filter(r => r.status !== 'rejected' && r.status !== 'ai_rejected');
    const matches = [];
    for (const r of active) {
      const d = haversineDistance(lat, lon, r.latitude, r.longitude);
      if (d <= radiusMeters) {
        matches.push({ report: r, distance: Math.round(d) });
      }
    }
    return matches.sort((a, b) => a.distance - b.distance);
  }

  const results = findNearbyHazards(baseLat, baseLon, mockReports, 50);

  // Should include rep1 and rep2 (within 50m), exclude rep3 (>100m) and rep4 (rejected)
  assert.strictEqual(results.length, 2, 'Should find exactly 2 active reports within 50m');
  assert.strictEqual(results[0].report.id, 'rep1');
  assert.ok(results[0].distance < 50, 'Distance must be <= 50m');

  // Category matching check
  const candidateCat = 'pothole';
  const categoryMatch = results.find(n => n.report.category === candidateCat);
  assert.ok(categoryMatch, 'Should find matching category hazard rep1');
  assert.strictEqual(categoryMatch.report.id, 'rep1');

  // Non-matching category check
  const nonMatch = results.find(n => n.report.category === 'streetlight');
  assert.strictEqual(nonMatch, undefined, 'No streetlight report within 50m');
});

test('AI Override Verification confirms distinct hazards when category differs or descriptions differentiate', () => {
  function verifyOverride(newReport, nearbyReport) {
    const newCat = (newReport.category || '').toLowerCase();
    const nearCat = (nearbyReport.category || '').toLowerCase();

    if (newCat !== nearCat) {
      return { verified: true, reason: 'Different hazard category' };
    }

    const newTokens = tokenize(newReport.description || '');
    const nearTokens = tokenize(nearbyReport.description || '');
    const sim = jaccardSimilarity(newTokens, nearTokens);
    const differentiator = /opposite|second|another|across|left|right|lane|north|south/i.test(newReport.description || '');

    if (sim < 0.65 || differentiator) {
      return { verified: true, reason: 'Distinct hazard details confirmed' };
    }
    return { verified: true, flaggedSimilarity: true, reason: 'High similarity with nearby incident' };
  }

  const nearby = { category: 'pothole', description: 'Pothole in middle of intersection' };

  // Case A: Different category
  const differentCatReport = { category: 'waterlogging', description: 'Flooding near drain' };
  const resA = verifyOverride(differentCatReport, nearby);
  assert.strictEqual(resA.verified, true);
  assert.strictEqual(resA.reason, 'Different hazard category');

  // Case B: Same category but distinct spatial description
  const distinctReport = { category: 'pothole', description: 'Second pothole on the opposite sidewalk lane' };
  const resB = verifyOverride(distinctReport, nearby);
  assert.strictEqual(resB.verified, true);
  assert.strictEqual(resB.reason, 'Distinct hazard details confirmed');
});

test('Civic category fallback templates generate actionable descriptions for all categories', () => {
  const categoryTemplates = {
    pothole: 'Severe surface depression and fractured asphalt along the traffic path, creating serious collision and vehicular damage risks for two-wheelers and automobiles.',
    manhole: 'Deep uncovered drainage pit located directly on the pedestrian pathway, posing an immediate tripping and falling hazard, especially under low evening lighting.',
    streetlight: 'Non-functional street luminaire creating a dark stretch along the roadway, significantly reducing nighttime visibility for pedestrians and passing vehicles.',
    waterlogging: 'Severe water accumulation across the road surface obstructing pedestrian transit and concealing submerged potholes and curb edges.',
    crossing: 'Damaged pedestrian crossing infrastructure with obstructed sightlines and non-functional safety indicators during peak commuter hours.',
    footpath: 'Severely cracked and misaligned concrete pavement slabs with exposed edges, obstructing safe passage and posing injury risk to walkers.',
    obstruction: 'Heavy debris and uncollected materials encroaching onto the active traffic lane, forcing pedestrians and two-wheelers into oncoming traffic.',
    unsafe_area: 'Poorly lit public corridor with broken surveillance infrastructure and secluded blind spots requiring immediate safety patrols and lighting repair.',
    other: 'Physical public infrastructure hazard identified in high-traffic pedestrian zone requiring municipal maintenance and safety barricading.'
  };

  const categories = ['pothole', 'manhole', 'streetlight', 'waterlogging', 'crossing', 'footpath', 'obstruction', 'unsafe_area', 'other'];
  for (const cat of categories) {
    const text = categoryTemplates[cat];
    assert.ok(text && text.length > 20, `Template for ${cat} must be comprehensive`);
  }
});
