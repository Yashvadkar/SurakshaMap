/**
 * ai-review.js — Gemini AI Classification + Duplicate Detection
 * Uses Google Gemini API free tier for genuine/spam classification
 * Uses local Jaccard similarity + Haversine distance for duplicate detection
 */

(function () {
  'use strict';

  const cfg = window.SURAKSHAMAP_CONFIG || {};

  // ─── Gemini AI Classification ───
  async function classifyReport(report) {
    const apiKey = window.__ENV__?.GEMINI_API_KEY || window.SURAKSHAMAP_CONFIG?.geminiApiKey || cfg.geminiApiKey;
    const model = window.SURAKSHAMAP_CONFIG?.geminiModel || cfg.geminiModel || 'gemini-2.0-flash';

    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
      console.warn('[AI Review] No Gemini API key configured. Skipping AI classification.');
      return { genuine: true, confidence: 0, reason: 'AI review skipped — no API key configured.' };
    }

    const prompt = `You are a safety report classifier for a civic safety platform. Analyze the following citizen safety report and determine if it is GENUINE or SPAM/FRAUDULENT.

Report Details:
- Category: ${report.category}
- Severity: ${report.severity}
- Description: "${report.description}"
- Location: ${report.latitude}, ${report.longitude}
- Submitted: ${report.submittedAt}

Classification Rules:
1. GENUINE: Reports about real infrastructure issues, safety hazards, or public space problems.
2. SPAM/FRAUD: Gibberish text, test submissions, joke reports, advertisements, personal complaints unrelated to public safety, or clearly fabricated reports.

Respond ONLY with a valid JSON object in this exact format (no markdown, no explanation):
{"genuine": true/false, "confidence": 0.0-1.0, "reason": "brief explanation"}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
          })
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error('[AI Review] Gemini API error:', response.status, errText);
        return { genuine: true, confidence: 0, reason: 'AI review failed — API error. Report forwarded for manual review.' };
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Parse JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          genuine: !!result.genuine,
          confidence: Math.min(1, Math.max(0, Number(result.confidence) || 0.5)),
          reason: String(result.reason || 'No reason provided.')
        };
      }

      return { genuine: true, confidence: 0.5, reason: 'Could not parse AI response. Forwarding for manual review.' };
    } catch (err) {
      console.error('[AI Review] Classification failed:', err);
      return { genuine: true, confidence: 0, reason: 'AI review failed — network error. Report forwarded for manual review.' };
    }
  }

  // ─── Duplicate Detection (Free, Local Logic) ───
  function tokenize(text) {
    return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  }

  function jaccardSimilarity(set1, set2) {
    if (set1.length === 0 && set2.length === 0) return 0;
    const a = new Set(set1);
    const b = new Set(set2);
    const intersection = [...a].filter(x => b.has(x)).length;
    const union = new Set([...a, ...b]).size;
    return union === 0 ? 0 : intersection / union;
  }

  function findDuplicates(newReport, existingReports) {
    const duplicateRadius = cfg.app?.duplicateRadiusMeters || 200;
    const timeWindowDays = cfg.app?.duplicateTimeWindowDays || 30;
    const similarityThreshold = cfg.app?.duplicateSimilarityThreshold || 0.35;

    const newTokens = tokenize(newReport.description);
    const newCat = (newReport.category || '').toLowerCase();
    const now = new Date();

    const candidates = existingReports.filter(r => {
      // Skip self
      if (r.id === newReport.id) return false;
      // Skip already rejected
      if (r.status === 'ai_rejected' || r.status === 'rejected') return false;
      // Same or similar category
      if ((r.category || '').toLowerCase() !== newCat) return false;
      // Within time window
      const reportDate = new Date(r.submittedAt);
      if ((now - reportDate) / 86400000 > timeWindowDays) return false;
      // Within distance
      if (!SurakshaRisk.hasValidLocation(r) || !SurakshaRisk.hasValidLocation(newReport)) return false;
      const distance = SurakshaRisk.haversineDistance(
        newReport.latitude, newReport.longitude, r.latitude, r.longitude
      );
      if (distance > duplicateRadius) return false;
      // Text similarity
      const existingTokens = tokenize(r.description);
      const similarity = jaccardSimilarity(newTokens, existingTokens);
      return similarity >= similarityThreshold;
    });

    return candidates.map(r => ({
      report: r,
      distance: Math.round(SurakshaRisk.haversineDistance(
        newReport.latitude, newReport.longitude, r.latitude, r.longitude
      )),
      similarity: Math.round(jaccardSimilarity(newTokens, tokenize(r.description)) * 100)
    }));
  }

  // ─── Full AI Review Pipeline ───
  async function reviewReport(report) {
    // Step 1: Gemini classification
    const aiResult = await classifyReport(report);

    if (!aiResult.genuine) {
      // Auto-reject spam
      return { action: 'reject', aiReview: aiResult, duplicates: [] };
    }

    // Step 2: Duplicate detection
    const allReports = await window.SurakshaDB.getAllReports();
    const duplicates = findDuplicates(report, allReports);

    if (duplicates.length > 0) {
      return {
        action: 'flag_duplicate',
        aiReview: aiResult,
        duplicates: duplicates,
        duplicateOf: duplicates[0].report.trackingToken
      };
    }

    // Genuine and unique
    return { action: 'forward', aiReview: aiResult, duplicates: [] };
  }

  // ─── Process Report (called after submission or from admin) ───
  async function processReport(reportId) {
    try {
      const reports = await window.SurakshaDB.getAllReports();
      const report = reports.find(r => r.id === reportId);
      if (!report) return null;

      const result = await reviewReport(report);

      const updates = { aiReview: result.aiReview };

      switch (result.action) {
        case 'reject':
          updates.status = 'ai_rejected';
          break;
        case 'flag_duplicate':
          updates.status = 'flagged_duplicate';
          updates.duplicateOf = result.duplicateOf;
          break;
        case 'forward':
          updates.status = 'pending_review';
          break;
      }

      await window.SurakshaDB.updateReport(reportId, updates);
      return result;
    } catch (err) {
      console.error('[AI Review] Process failed:', err);
      // Fail safe — forward to manual review
      await window.SurakshaDB.updateReport(reportId, { status: 'pending_review' });
      return null;
    }
  }

  window.SurakshaAI = { classifyReport, findDuplicates, reviewReport, processReport };
})();
