/**
 * api/ai-insights.js — Vercel Serverless Function
 * AI "Why-this-hotspot" root cause synthesis & Actionable Municipal Interventions
 * Powered by Google Gemini with deterministic fallback heuristics.
 * Strictly focused on infrastructure, road safety, and civic interventions (no weather).
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

function generateHeuristicInsights(clusterData) {
  const topCat = (clusterData.topCategory || 'accident').replace('_', ' ');
  const topFlaw = (clusterData.topInfrastructureFlaw || 'infrastructure').replace('_', ' ');
  const locType = (clusterData.primaryLocationType || 'public space').replace('_', ' ');
  const peak = clusterData.timeAnalysis?.peakWindow || 'evening peak hours';
  const count = clusterData.totalIncidents || 3;
  const score = clusterData.riskScore || 70;

  const explanation = `This location has accumulated ${count} recorded safety incidents with an evaluated Risk Score of ${score}/100. The primary hazard driver is recurring ${topCat} incidents concentrated around a ${locType}. Root-cause factors indicate compromised safety during ${peak}, directly exacerbated by ${topFlaw}.`;

  const interventions = [
    {
      title: 'Targeted Infrastructure Rectification',
      urgency: score >= 75 ? 'Immediate (48h)' : 'Priority (7 days)',
      action: `Dispatch municipal engineering crews to rectify ${topFlaw} around this ${locType} corridor.`,
      estimatedImpact: 'Reduces incident probability by 35-45%'
    },
    {
      title: 'Visibility & Traffic Calming Deployment',
      urgency: 'Medium Term (14 days)',
      action: 'Install high-lumen solar LED luminaires and rumble strips 50 meters ahead of conflict points.',
      estimatedImpact: 'Improves nighttime commuter safety by 50%'
    },
    {
      title: 'Pedestrian Grade Separation & Signage',
      urgency: 'Long Term (30 days)',
      action: 'Demarcate high-visibility thermoplastic zebra crossings and erect active flashing hazard beacons.',
      estimatedImpact: 'Prevents pedestrian and two-wheeler crossover collisions'
    }
  ];

  return { explanation, interventions, usedFallback: true };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const cluster = req.body?.cluster;
  if (!cluster) {
    return res.status(400).json({ success: false, error: 'Cluster data is required.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    const fallback = generateHeuristicInsights(cluster);
    return res.status(200).json({
      success: true,
      explanation: fallback.explanation,
      interventions: fallback.interventions,
      model: 'Civic Safety Heuristic Engine'
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    const prompt = `
You are an expert urban traffic engineer and public safety analyst for Indian municipal smart cities.
Analyze the following hotspot data from a community safety platform:

- Hotspot Risk Score: ${cluster.riskScore} / 100 (${cluster.riskLevel})
- Total Incidents: ${cluster.totalIncidents} (Active: ${cluster.activeIncidents}, Resolved: ${cluster.resolvedIncidents})
- Primary Location Type: ${cluster.primaryLocationType}
- Top Hazard Category: ${cluster.topCategory}
- Primary Infrastructure Defect: ${cluster.topInfrastructureFlaw}
- Peak Danger Window: ${cluster.timeAnalysis?.peakWindow || 'N/A'}
- Sample Incident Reports:
${(cluster.sampleIncidents || []).map((s, i) => `  ${i+1}. [${s.severity.toUpperCase()}] ${s.category}: ${s.description} (Infra: ${s.infrastructureCondition})`).join('\n')}

CRITICAL INSTRUCTIONS:
1. Do NOT discuss or include weather or seasonal topics. Focus strictly on urban road geometry, traffic friction, infrastructure deficiencies, pedestrian safety, and civic maintenance.
2. Return ONLY a valid JSON object matching this schema:
{
  "explanation": "A concise 2-3 sentence root cause diagnosis explaining WHY this specific hotspot formed.",
  "interventions": [
    {
      "title": "Short title of intervention",
      "urgency": "Immediate (48h) | Priority (7 days) | Scheduled (30 days)",
      "action": "Concrete, actionable engineering or municipal measure",
      "estimatedImpact": "Expected reduction in incidents or risk"
    }
  ]
}
Return exactly 3 actionable interventions.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);

    return res.status(200).json({
      success: true,
      explanation: parsed.explanation,
      interventions: parsed.interventions,
      model: modelName
    });
  } catch (err) {
    console.warn('[AI Insights] Gemini call failed, using heuristic fallback:', err.message);
    const fallback = generateHeuristicInsights(cluster);
    return res.status(200).json({
      success: true,
      explanation: fallback.explanation,
      interventions: fallback.interventions,
      model: 'Civic Safety Heuristic Engine (Fallback)'
    });
  }
};
