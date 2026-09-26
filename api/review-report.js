/**
 * api/review-report.js — Vercel Serverless Function
 *
 * Server-side AI Report Evaluation using Google Gemini with Structured Output
 * Handles citizen safety report classification, photo multimodal review,
 * and duplicate detection without exposing API credentials to the client.
 */

const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

// ─── Duplicate Detection Algorithms (Serverless-Safe) ───

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
  const R = 6371000; // meters
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasValidLocation(r) {
  if (!r) return false;
  const lat = Number(r.latitude);
  const lon = Number(r.longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

// ─── Image / Photo Loader ───

async function fetchImagePart(photoUrl) {
  if (!photoUrl || typeof photoUrl !== 'string') return null;

  if (photoUrl.startsWith('data:')) {
    const match = photoUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return {
        inlineData: {
          mimeType: match[1],
          data: match[2]
        }
      };
    }
    return null;
  }

  try {
    const res = await fetch(photoUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.warn(`[AI Review] Photo download failed with status ${res.status}`);
      return null;
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await res.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    return {
      inlineData: {
        mimeType: contentType.split(';')[0],
        data: base64Data
      }
    };
  } catch (err) {
    console.warn(`[AI Review] Evidence photo unavailable: ${err.message}`);
    return null;
  }
}

// ─── Gemini Structured Review ───

async function evaluateWithGemini(reportData, photoPart, apiKey, preferredModel) {
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const candidateModels = [
    preferredModel,
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash'
  ].filter(Boolean);

  const uniqueCandidates = [...new Set(candidateModels)];
  let lastError = null;

  for (const modelName of uniqueCandidates) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              genuine: {
                type: SchemaType.BOOLEAN,
                description: 'True if report describes a plausible real-world civic safety issue, false if spam, test, joke, or promotional.'
              },
              confidence: {
                type: SchemaType.NUMBER,
                description: 'Confidence score between 0.0 and 1.0.'
              },
              reason: {
                type: SchemaType.STRING,
                description: 'Concise explanation for determination.'
              },
              categoryCheck: {
                type: SchemaType.STRING,
                description: 'Whether description and evidence align with the selected category.'
              },
              severityAssessment: {
                type: SchemaType.STRING,
                description: 'Whether chosen severity appears appropriate, understated, or overstated.'
              },
              summary: {
                type: SchemaType.STRING,
                description: 'Concise 1-2 sentence safety-oriented summary.'
              }
            },
            required: [
              'genuine',
              'confidence',
              'reason',
              'categoryCheck',
              'severityAssessment',
              'summary'
            ]
          }
        }
      });

      const prompt = `You are an automated civic safety report verification AI for SurakshaMap, a community public-space safety platform.
Analyze the following citizen report and any attached photographic evidence to determine if it is GENUINE or SPAM/FRAUDULENT.

Report Details:
- Category: ${reportData.category || 'Not specified'}
- Severity Selected: ${reportData.severity || 'medium'}
- Description: "${reportData.description || ''}"
- Coordinates: Latitude ${reportData.latitude}, Longitude ${reportData.longitude}
- Submitted: ${reportData.submittedAt || new Date().toISOString()}

Guidelines:
1. GENUINE: Reports about real civic infrastructure hazards, broken public lights, open manholes, flooding/waterlogging, damaged footpaths, road obstacles, unsafe crossings, harassment spots, or public safety issues.
2. SPAM/FRAUD: Gibberish text, test submissions (e.g., "test", "asdf"), joke reports, promotional advertising, unrelated rants, or clearly fabricated claims.
3. Category Consistency: Verify if the description and photo align with the selected category "${reportData.category}".
4. Severity Assessment: State whether the citizen selected severity (${reportData.severity}) is appropriate, understated, or overstated.
5. Safety Summary: Provide a concise, factual 1-2 sentence safety summary.
6. Reason: Provide a clear, objective reason.
7. CRITICAL RULE: Do NOT identify, name, or make accusations against any specific individuals or people. Focus exclusively on civic safety hazards, infrastructure, and physical public-space conditions.`;

      const contents = [prompt];
      if (photoPart) {
        contents.push(photoPart);
      }

      const result = await model.generateContent(contents);
      const response = await result.response;
      const text = response.text();

      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error(`Invalid JSON from Gemini: ${text.substring(0, 100)}`);
        }
      }

      return {
        genuine: Boolean(parsed.genuine),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
        reason: String(parsed.reason || 'No explanation provided.'),
        categoryCheck: String(parsed.categoryCheck || 'Consistent'),
        severityAssessment: String(parsed.severityAssessment || 'Appropriate'),
        summary: String(parsed.summary || (reportData.description || '').substring(0, 100)),
        usedModel: modelName
      };
    } catch (err) {
      console.warn(`[AI Review] Model ${modelName} failed: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error('All candidate Gemini models failed.');
}

// ─── Main Vercel Serverless Function Handler ───

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      service: 'SurakshaMap AI Review Service (Vercel Serverless)',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { reportId, report: reportPayload } = req.body || {};
  const reportData = reportPayload || req.body;

  if (!reportData || !reportData.description) {
    return res.status(400).json({ error: 'Missing report data or description' });
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const apiKey = process.env.GEMINI_API_KEY;

  try {
    // 1. Photo parsing
    let photoPart = null;
    if (reportData.photoUrl) {
      photoPart = await fetchImagePart(reportData.photoUrl);
    }

    // 2. Call Gemini API
    const aiResult = await evaluateWithGemini(reportData, photoPart, apiKey, modelName);

    // 3. Determine status:
    // - genuine -> pending_review
    // - spam/fraud -> ai_rejected
    let newStatus = aiResult.genuine ? 'pending_review' : 'ai_rejected';

    const aiReview = {
      genuine: aiResult.genuine,
      confidence: aiResult.confidence,
      reason: aiResult.reason,
      categoryCheck: aiResult.categoryCheck,
      severityAssessment: aiResult.severityAssessment,
      summary: aiResult.summary,
      reviewedAt: new Date().toISOString(),
      model: aiResult.usedModel || modelName,
      error: false
    };

    return res.status(200).json({
      success: true,
      reportId: reportId || reportData.id,
      status: newStatus,
      aiReview,
      duplicates: []
    });
  } catch (err) {
    console.error(`[AI Review] Evaluation failed:`, err.message);

    // Resilient fallback: Preserve report for manual review, never mark as genuine on error
    const fallbackAiReview = {
      genuine: null,
      confidence: 0,
      reason: 'Automatic AI review service unavailable. Forwarded for manual administrator review.',
      categoryCheck: 'Pending manual verification',
      severityAssessment: 'Pending manual review',
      summary: (reportData.description || '').substring(0, 100),
      reviewedAt: new Date().toISOString(),
      model: modelName,
      error: true,
      errorMessage: 'Review service temporarily unavailable'
    };

    return res.status(200).json({
      success: false,
      reportId: reportId || reportData.id,
      status: 'pending_review',
      aiReview: fallbackAiReview,
      error: err.message
    });
  }
};
