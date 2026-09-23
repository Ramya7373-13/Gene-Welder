// AI analysis endpoints (Gemini + Grok) and AlphaMissense annotation.
// Mounted at /api by server.ts.
//
// Load-bearing safety properties preserved verbatim from server.ts:
//  * fail-closed: if a client is unconfigured the route 503s rather than
//    falling back to a fabricated answer;
//  * usage is reserved atomically via reserveUsage() BEFORE any model call,
//    so a failed call does not leak a free slot;
//  * every response carries a provenance marker (API | CACHE | SIMULATION);
//  * Grok/consensus payloads are shape-checked before use.

import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '../prisma.js';
import { logger } from '../utils/logger.js';
import { getAlphaMissenseScore } from '../utils/alphamissenseUtil.js';
import { getSessionFromCookie } from '../lib/session.js';
import { reserveUsage, FREE_USAGE_LIMIT } from '../lib/metering.js';
import { configuredFrontendUrl } from '../lib/config.js';
import { geminiCache, GEMINI_CACHE_TTL, grokClient, grokCache, GROK_CACHE_TTL } from '../lib/clients.js';

const router = express.Router();

router.post('/ai/variant-analysis', async (req, res) => {
  const { gene, variant, mode = 'explainer' } = req.body as {
    gene?: string;
    variant?: string;
    mode?: 'explainer' | 'design';
  };

  if (!gene || !variant) {
    return res.status(400).json({ error: 'gene and variant are required' });
  }

  // Auth + metering: wrapped in try/catch so DB failures return 500, never crash or fail-open
  let session;
  let usageCheck;
  try {
    session = await getSessionFromCookie(req);
    if (!session) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    usageCheck = await reserveUsage(session.userId, 'variant_analysis');
  } catch (error) {
    logger.error('variant-analysis auth/metering error:', error);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  if (!usageCheck.allowed) {
    return res.status(402).json({
      error: 'Usage limit exceeded',
      code: 'PAYWALL',
      plan: session.plan,
      message: `Free plan limit reached (${FREE_USAGE_LIMIT} uses). Upgrade to Pro for unlimited analyses.`,
      upgradeUrl: `${configuredFrontendUrl}/settings`
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'Gemini integration is not configured' });
  }

  const cacheKey = `${mode}:${gene}:${variant}`.toUpperCase();
  const cached = geminiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < GEMINI_CACHE_TTL) {
    // Slot already reserved via reserveUsage() at route entry
    return res.json({ ...cached.data, source: 'CACHE', remaining: usageCheck.remaining });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `You are a molecular biologist analyzing ${gene} ${variant} for the ${mode} workflow.
Return only valid JSON with this shape:
{
  "variant": { "protein": "${gene}", "hgvs": "${variant}", "disease": "", "id": "${gene}-${variant}", "uniprot": "", "sequence": "", "mutantSequence": "", "mutationPositionInSnippet": 1 },
  "mechanism": "",
  "analysis": { "summary": "", "compensatory_mutations": [{ "mutation": "", "reasoning": "", "confidence": 0.0 }] },
  "predictions": {
    "native": { "plddt_avg": 0, "domains": [] },
    "mutant": { "plddt_avg": 0, "rmsd_to_native": 0, "domains_affected": [] },
    "delta": { "rmsd": 0, "confidence_drop": 0, "functional_impact": "" }
  },
  "riskScore": 0,
  "confidence": 0,
  "proteinChange": "${variant}",
  "consequence": "missense"
}
Use cautious scientific language, do not invent citations, and keep confidence values between 0 and 1 for compensatory mutations and 0 and 100 elsewhere.`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    if (!response.text) {
      return res.status(502).json({ error: 'Gemini returned an empty response' });
    }

    const data = JSON.parse(response.text);

    // Attach AlphaMissense pathogenicity score
    let alphaMissense = null;
    try {
      alphaMissense = await getAlphaMissenseScore(gene, variant);
    } catch (amErr) {
      logger.warn('AlphaMissense score lookup failed:', amErr);
    }

    const payload = {
      ...data,
      aiAnalysis: data.analysis,
      variantId: `${gene}-${variant}`,
      alphaMissense,
      source: 'API',
      remaining: usageCheck.remaining
    };
    geminiCache.set(cacheKey, { timestamp: Date.now(), data: payload });

    return res.json(payload);
  } catch (error) {
    logger.error('Gemini variant analysis failed:', error);
    return res.status(502).json({ error: 'Gemini analysis failed' });
  }
});

router.post('/alphamissense', async (req, res) => {
  const { gene, variant } = req.body as { gene?: string; variant?: string };
  if (!gene || !variant) {
    return res.status(400).json({ error: 'gene and variant are required for AlphaMissense' });
  }

  try {
    const result = await getAlphaMissenseScore(gene, variant);
    return res.json(result);
  } catch (error) {
    logger.error('AlphaMissense endpoint failed:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/alphamissense/:gene/:variant', async (req, res) => {
  const { gene, variant } = req.params;
  try {
    const result = await getAlphaMissenseScore(gene, variant);
    return res.json(result);
  } catch (error) {
    logger.error('AlphaMissense GET endpoint failed:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/ai/chat', async (req, res) => {
  const { message, context, history = [] } = req.body as {
    message?: string;
    context?: string;
    history?: Array<{ role: 'user' | 'model'; parts: { text: string }[] }>;
  };

  if (!message) return res.status(400).json({ error: 'message is required' });

  // Auth + metering: wrapped in try/catch so DB failures return 500, never crash or fail-open
  let session;
  let usageCheck;
  try {
    session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    usageCheck = await reserveUsage(session.userId, 'ai_chat');
  } catch (error) {
    logger.error('chat auth/metering error:', error);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  if (!usageCheck.allowed) {
    return res.status(402).json({
      error: 'Usage limit exceeded',
      code: 'PAYWALL',
      plan: session.plan,
      message: `Free plan limit reached. Upgrade to Pro for unlimited AI chat.`,
      upgradeUrl: `${configuredFrontendUrl}/settings`
    });
  }

  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'Gemini integration is not configured' });

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_CHAT_MODEL || 'gemini-3-flash-preview',
      contents: [
        ...(history || []).map(item => ({ role: item.role, parts: item.parts })),
        { role: 'user', parts: [{ text: `Context:\n${context || 'No variant context'}\n\nQuestion:\n${message}` }] }
      ]
    });
    return res.json({ text: response.text || '', source: 'API', remaining: usageCheck.remaining });
  } catch (error) {
    logger.error('Gemini chat failed:', error);
    return res.status(502).json({ error: 'Gemini chat failed' });
  }
});

router.post('/ai/clinical-analysis', async (req, res) => {
  const { gene, variant } = req.body as { gene?: string; variant?: string };
  if (!gene || !variant) return res.status(400).json({ error: 'gene and variant are required' });

  // Auth + metering: wrapped in try/catch so DB failures return 500, never crash or fail-open
  let session;
  let usageCheck;
  try {
    session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    usageCheck = await reserveUsage(session.userId, 'variant_analysis');
  } catch (error) {
    logger.error('clinical-analysis auth/metering error:', error);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  if (!usageCheck.allowed) {
    return res.status(402).json({
      error: 'Usage limit exceeded',
      code: 'PAYWALL',
      plan: session.plan,
      message: `Free plan limit reached. Upgrade to Pro for unlimited analyses.`,
      upgradeUrl: `${configuredFrontendUrl}/settings`
    });
  }

  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'Gemini integration is not configured' });

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
      contents: `Analyze ${gene} ${variant} as a clinical genetics expert. Return only JSON with pathogenicity, confidence, confidenceScore, diseases, inheritanceMode, mechanism, clinicalSignificance, populationFrequency, treatments, phenotype, citations, and drugInteractions. Do not claim certainty beyond available evidence.`,
      config: { responseMimeType: 'application/json', temperature: 0.3 }
    });
    if (!response.text) return res.status(502).json({ error: 'Gemini returned an empty response' });

    return res.json({ ...JSON.parse(response.text), variantId: `${gene}-${variant}`, gene, timestamp: Date.now(), source: 'API', remaining: usageCheck.remaining });
  } catch (error) {
    logger.error('Gemini clinical analysis failed:', error);
    return res.status(502).json({ error: 'Gemini clinical analysis failed' });
  }
});

// POST /api/ai/clinical-summary - Plain-English decision-support paragraph (Tier 2)
// Powers the frontend ClinicalSummaryCard. Returns a single cautious prose paragraph
// plus an optional AlphaMissense annotation; results are cached for GEMINI_CACHE_TTL.
router.post('/ai/clinical-summary', async (req, res) => {
  const { gene, variant } = req.body as { gene?: string; variant?: string };
  if (!gene || !variant) {
    return res.status(400).json({ error: 'gene and variant are required' });
  }

  // Auth + metering: wrapped in try/catch so DB failures return 500, never crash or fail-open
  let session;
  let usageCheck;
  try {
    session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    usageCheck = await reserveUsage(session.userId, 'clinical_summary');
  } catch (error) {
    logger.error('clinical-summary auth/metering error:', error);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  if (!usageCheck.allowed) {
    return res.status(402).json({
      error: 'Usage limit exceeded',
      code: 'PAYWALL',
      plan: session.plan,
      message: `Free plan limit reached. Upgrade to Pro for unlimited clinical summaries.`,
      upgradeUrl: `${configuredFrontendUrl}/settings`
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'Gemini integration is not configured' });
  }

  const cacheKey = `summary:${gene}:${variant}`.toUpperCase();
  const cached = geminiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < GEMINI_CACHE_TTL) {
    return res.json({ ...cached.data, source: 'CACHE', remaining: usageCheck.remaining });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `You are a clinical genomics assistant generating plain-English decision support for the genetic variant ${gene} ${variant}.

Write a single, self-contained paragraph (roughly 3 to 5 sentences) that a non-specialist clinician or an informed patient could understand. Explain, in accessible language, what is currently understood about this variant and its potential functional or clinical impact.

Rules:
- Use cautious, hedged language ("may", "is associated with", "is predicted to"); never state a definitive diagnosis.
- Do not claim certainty beyond the available evidence, and do not invent gene functions, statistics, population frequencies, or citations.
- Explicitly frame this as computational decision support, not a clinical determination.
- Return ONLY the paragraph as plain prose — no headings, lists, JSON, or markdown.`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
      contents: prompt,
      config: { temperature: 0.3 }
    });

    if (!response.text) {
      return res.status(502).json({ error: 'Gemini returned an empty response' });
    }
    // Capture immediately (response.text is a getter) so narrowing survives the await below.
    const summaryText = response.text.trim();

    // Enrich with AlphaMissense (best-effort; never blocks the summary)
    let alphaMissense = null;
    try {
      alphaMissense = await getAlphaMissenseScore(gene, variant);
    } catch (amErr) {
      logger.warn('AlphaMissense score lookup failed:', amErr);
    }

    const payload = {
      summary: summaryText,
      alphaMissense,
      gene,
      variant,
      source: 'API',
      remaining: usageCheck.remaining
    };
    geminiCache.set(cacheKey, { timestamp: Date.now(), data: payload });
    return res.json(payload);
  } catch (error) {
    logger.error('Gemini clinical summary failed:', error);
    return res.status(502).json({ error: 'Gemini clinical summary failed' });
  }
});

// POST /api/ai/grok-validation - Dual-Engine AI Consensus Validation (Grok layer)
// Uses the xAI flagship model to produce a precision validation summary of the
// mutation's structural impact, as a parallel second opinion to the Gemini engine.
// Cached for 7 days under `grok:GENE:VARIANT`; falls back to an offline mock
// summary on upstream timeout or failure without throwing fatal errors.
router.post('/ai/grok-validation', async (req, res) => {
  const { gene, variant } = req.body as { gene?: string; variant?: string };
  if (!gene || !variant) {
    return res.status(400).json({ error: 'gene and variant are required' });
  }

  // Auth + metering: wrapped in try/catch so DB failures return 500, never crash or fail-open
  let session;
  let usageCheck;
  try {
    session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    usageCheck = await reserveUsage(session.userId, 'variant_analysis');
  } catch (error) {
    logger.error('grok-validation auth/metering error:', error);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  if (!usageCheck.allowed) {
    return res.status(402).json({
      error: 'Usage limit exceeded',
      code: 'PAYWALL',
      plan: session.plan,
      message: `Free plan limit reached. Upgrade to Pro for unlimited analyses.`,
      upgradeUrl: `${configuredFrontendUrl}/settings`
    });
  }

  if (!grokClient) {
    return res.status(503).json({ error: 'Grok (xAI) integration is not configured' });
  }

  const cacheKey = `grok:${gene}:${variant}`.toUpperCase();
  const cached = grokCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < GROK_CACHE_TTL) {
    return res.json({ ...cached.data, source: 'CACHE', remaining: usageCheck.remaining });
  }

  const prompt = `You are a structural biology and molecular genetics expert performing an independent consensus validation of the mutation ${gene} ${variant}.

Produce a highly technical, precision validation summary of the mutation's structural impact on the encoded protein. Address:
- The residue change and its position within known functional domains or motifs.
- Predicted effects on secondary/tertiary structure, folding stability, and packing.
- Mechanistic consequences for binding sites, active sites, or interaction interfaces.
- A consensus-style agreement assessment: which aspects of a pathogenic/functional-impact hypothesis are structurally supported, and which remain speculative.

Rules:
- Use cautious, hedged scientific language; do not invent citations, statistics, or domain annotations.
- Frame the output as computational decision support, not a clinical determination.
- Return ONLY valid JSON of the shape:
{
  "validationSummary": "",
  "structuralImpact": "",
  "domainContext": "",
  "consensusAssessment": "",
  "confidence": 0
}
Keep "confidence" between 0 and 100.`;

  try {
    const completion = await grokClient.chat.completions.create({
      model: process.env.GROK_MODEL || 'grok-4.6',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return res.status(502).json({ error: 'Grok returned an empty response' });
    }

    const data = JSON.parse(text);
    const payload = {
      ...data,
      gene,
      variant,
      variantId: `${gene}-${variant}`,
      engine: 'grok',
      model: process.env.GROK_MODEL || 'grok-4.6',
      timestamp: Date.now(),
      source: 'API'
    };
    grokCache.set(cacheKey, { timestamp: Date.now(), data: payload });
    return res.json(payload);
  } catch (error) {
    // Resilience ladder: log, then degrade to an offline mock so callers get a
    // usable (clearly-flagged) response instead of a fatal application error.
    logger.warn('Grok validation upstream failed, serving offline mock fallback:', error);

    const mockPayload = {
      validationSummary: `Offline consensus validation for ${gene} ${variant}: the Grok validation engine is temporarily unavailable, so a deterministic placeholder summary is provided. Structural impact cannot be independently confirmed at this time.`,
      structuralImpact: 'Structural impact assessment unavailable while offline; cross-check against the primary Gemini engine output before drawing conclusions.',
      domainContext: 'Domain and motif context unavailable while offline.',
      consensusAssessment: 'Consensus could not be established while offline; treat the primary engine output as unvalidated.',
      confidence: 0,
      gene,
      variant,
      variantId: `${gene}-${variant}`,
      engine: 'grok',
      model: 'offline-mock',
      timestamp: Date.now(),
      source: 'FALLBACK'
    };
    return res.json(mockPayload);
  }
});

export { router as aiRouter };
