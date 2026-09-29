/**
 * api/suggest-description.js — Vercel Serverless Function
 *
 * AI Writing Assistant for civic hazard reporting using Google Gemini.
 * Improves user's drafted text or generates structured civic descriptions,
 * retaining all user-provided landmarks, observations, and details.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Contextual fallback templates by category
const categoryTemplates = {
  pothole: 'Severe surface depression and fractured asphalt along the traffic path, creating serious collision and vehicular damage risks for two-wheelers and automobiles.',
  manhole: 'Deep uncovered drainage pit located directly on the pedestrian pathway, posing an immediate tripping and falling hazard, especially under low evening lighting.',
  'open manhole': 'Deep uncovered drainage pit located directly on the pedestrian pathway, posing an immediate tripping and falling hazard, especially under low evening lighting.',
  streetlight: 'Non-functional street luminaire creating a dark stretch along the roadway, significantly reducing nighttime visibility for pedestrians and passing vehicles.',
  'broken streetlight': 'Non-functional street luminaire creating a dark stretch along the roadway, significantly reducing nighttime visibility for pedestrians and passing vehicles.',
  waterlogging: 'Severe water accumulation across the road surface obstructing pedestrian transit and concealing submerged potholes and curb edges.',
  crossing: 'Damaged pedestrian crossing infrastructure with obstructed sightlines and non-functional safety indicators during peak commuter hours.',
  'unsafe crossing': 'Damaged pedestrian crossing infrastructure with obstructed sightlines and non-functional safety indicators during peak commuter hours.',
  footpath: 'Severely cracked and misaligned concrete pavement slabs with exposed edges, obstructing safe passage and posing injury risk to walkers.',
  'broken footpath': 'Severely cracked and misaligned concrete pavement slabs with exposed edges, obstructing safe passage and posing injury risk to walkers.',
  obstruction: 'Heavy debris and uncollected materials encroaching onto the active traffic lane, forcing pedestrians and two-wheelers into oncoming traffic.',
  unsafe_area: 'Poorly lit public corridor with broken surveillance infrastructure and secluded blind spots requiring immediate safety patrols and lighting repair.',
  'harassment spot': 'Poorly lit public corridor with broken surveillance infrastructure and secluded blind spots requiring immediate safety patrols and lighting repair.',
  other: 'Physical public infrastructure hazard identified in high-traffic pedestrian zone requiring municipal maintenance and safety barricading.'
};

function enhanceUserText(text, category) {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    return categoryTemplates[category] || categoryTemplates.other;
  }
  let cleaned = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  if (!/[.!?]$/.test(cleaned)) cleaned += '.';

  const contextMap = {
    pothole: 'Poses an immediate vehicular hazard and collision risk for commuters.',
    manhole: 'Poses an immediate tripping and falling hazard, especially under low evening lighting.',
    'open manhole': 'Poses an immediate tripping and falling hazard, especially under low evening lighting.',
    streetlight: 'Significantly impairs nighttime visibility and pedestrian safety along this route.',
    'broken streetlight': 'Significantly impairs nighttime visibility and pedestrian safety along this route.',
    waterlogging: 'Severe water accumulation across the road surface obstructing pedestrian transit.',
    crossing: 'Impairs safe pedestrian road crossing during peak traffic hours.',
    'unsafe crossing': 'Impairs safe pedestrian road crossing during peak traffic hours.',
    footpath: 'Severely damages pedestrian walkway and poses injury risk to walkers.',
    'broken footpath': 'Severely damages pedestrian walkway and poses injury risk to walkers.',
    obstruction: 'Forces pedestrians and vehicles into oncoming traffic lanes.',
    unsafe_area: 'Requires immediate civic attention, lighting improvements, and safety patrolling.',
    'harassment spot': 'Requires immediate civic attention, lighting improvements, and safety patrolling.',
    other: 'Requires municipal assessment, safety barricading, and expedited repair.'
  };

  const addon = contextMap[category] || contextMap.other;
  const lower = cleaned.toLowerCase();
  if (lower.includes('hazard') || lower.includes('risk') || lower.includes('safety') || lower.includes('danger')) {
    return cleaned;
  }
  return `${cleaned} ${addon}`;
}

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      service: 'SurakshaMap Description AI Writing Assistant',
      timestamp: new Date().toISOString()
    });
  }

  let requestedCategory = 'other';
  try {
    const { category, severity, address, title, currentDescription } = req.body || {};
    requestedCategory = (category || 'other').toLowerCase();
    const userText = (currentDescription || title || '').trim();
    const hasUserText = userText.length > 0;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[AI Suggest] GEMINI_API_KEY not configured. Using template fallback.');
      const fallback = civicFallbacks[requestedCategory] || civicFallbacks.other;
      return res.status(200).json({
        success: true,
        source: 'template_fallback',
        suggestion: fallback.description,
        appliedTokens: fallback.tags,
        category: requestedCategory,
        improved: false
      });
    }
    const candidateModels = [
      process.env.GEMINI_MODEL,
      'gemini-flash-lite-latest',
      'gemini-flash-latest',
      'gemini-1.5-flash',
      'gemini-2.0-flash'
    ].filter(Boolean);

    const prompt = `You are an AI Writing Assistant for civic hazard reporting on SurakshaMap.
Your goal is to help citizens submit clear, actionable public safety reports for municipal emergency response and city maintenance.

Report Context:
- Hazard Category: ${requestedCategory}
- Severity: ${severity || 'moderate'}
- Location: ${address || 'Public street/area'}
- Citizen's Input: "${userText}"

Task:
${hasUserText
  ? `The citizen has already provided their own notes/description above.
DO NOT IGNORE OR REPLACE THEIR INFORMATION. IMPROVE AND POLISH THEIR DRAFT:
1. Retain all specific details they wrote (landmarks, shop/building names, pole numbers, lane references, times, personal observations).
2. Fix any grammar, phrasing, or spelling errors.
3. Enhance the civic urgency and explain the physical safety hazard clearly for municipal dispatchers.
4. Keep the final result concise (2 to 3 sentences max).`
  : `Draft a concise, professional 2 to 3 sentence incident description:
1. State the specific physical safety hazard and immediate risks clearly.
2. Note the urgency and potential impact on pedestrians, commuters, or traffic.
3. Keep it factual, objective, and actionable for municipal dispatchers.`
}

Guidelines:
- Output ONLY the polished/drafted description text.
- Do NOT include quotes, markdown bold headers, preamble, or commentary.`;

    let suggestion = '';
    let usedModel = candidateModels[0];

    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      for (const modelName of candidateModels) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { temperature: 0.3, maxOutputTokens: 250 }
          });
          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text()?.trim();
          if (text) {
            suggestion = text;
            usedModel = modelName;
            break;
          }
        } catch (mErr) {
          continue;
        }
      }
    }

    if (!suggestion) {
      const fallback = enhanceUserText(userText, requestedCategory);
      return res.status(200).json({
        success: true,
        suggestion: fallback,
        isFallback: true,
        model: 'civic-assistant-fallback'
      });
    }

    return res.status(200).json({
      success: true,
      suggestion,
      model: usedModel
    });
  } catch (err) {
    const fallback = enhanceUserText(userText, requestedCategory);
    return res.status(200).json({
      success: true,
      suggestion: fallback,
      isFallback: true,
      error: err.message
    });
  }
};
