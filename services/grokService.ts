import { configService } from './configService';

export interface GrokValidation {
  validationSummary: string;
  structuralImpact: string;
  consensusAssessment: string;
  domainContext?: string;
  confidence?: number;
  gene?: string;
  variant?: string;
  variantId?: string;
  engine?: string;
  model?: string;
  timestamp?: number;
  source: 'API' | 'CACHE' | 'FALLBACK' | 'SIMULATION';
}

const GROK_VALIDATION_PATH = '/api/ai/grok-validation';

/**
 * Deterministic offline payload. Stored as a JSON string so callers always
 * receive a parseable Grok-shaped response when the backend is unreachable.
 */
function simulatedGrokJson(gene: string, variant: string): string {
  return JSON.stringify({
    validationSummary: `[SIMULATION] Independent Grok consensus for ${gene} ${variant} is unavailable. This is a deterministic offline placeholder so the dual-engine panel still renders.`,
    structuralImpact: `[SIMULATION] Structural impact for ${gene} ${variant} could not be independently validated. Cross-check the Gemini clinical summary before acting on this note.`,
    consensusAssessment: `[SIMULATION] Consensus could not be established while the Grok validation engine is offline. Treat the primary engine output as unvalidated.`,
    domainContext: '[SIMULATION] Domain and motif context unavailable while offline.',
    confidence: 0,
    gene,
    variant,
    variantId: `${gene}-${variant}`,
    engine: 'grok',
    model: 'offline-simulation',
    timestamp: Date.now(),
    source: 'SIMULATION'
  });
}

function parseGrokPayload(raw: unknown, gene: string, variant: string): GrokValidation | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<GrokValidation>;
  if (
    typeof data.validationSummary !== 'string' ||
    typeof data.structuralImpact !== 'string' ||
    typeof data.consensusAssessment !== 'string'
  ) {
    return null;
  }
  return {
    validationSummary: data.validationSummary,
    structuralImpact: data.structuralImpact,
    consensusAssessment: data.consensusAssessment,
    domainContext: data.domainContext,
    confidence: data.confidence,
    gene: data.gene ?? gene,
    variant: data.variant ?? variant,
    variantId: data.variantId ?? `${gene}-${variant}`,
    engine: data.engine ?? 'grok',
    model: data.model,
    timestamp: data.timestamp,
    source: data.source ?? 'API'
  };
}

/**
 * Independent Grok consensus validation. Mirrors getClinicalSummary:
 * never throws, always resolves to a usable GrokValidation object, and
 * degrades to a simulated JSON fallback when offline or the backend errors.
 */
export const getGrokValidation = async (
  gene: string,
  variant: string
): Promise<GrokValidation> => {
  const simulated = JSON.parse(simulatedGrokJson(gene, variant)) as GrokValidation;

  if (configService.isForcedOffline()) {
    return simulated;
  }

  try {
    const backendUrl = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:5000';
    const response = await fetch(`${backendUrl}${GROK_VALIDATION_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gene, variant })
    });

    if (!response.ok) {
      console.warn(`Grok validation backend returned ${response.status}; using simulated JSON fallback.`);
      return simulated;
    }

    const parsed = parseGrokPayload(await response.json(), gene, variant);
    if (parsed) return parsed;

    console.warn('Grok validation payload missing required fields; using simulated JSON fallback.');
  } catch (error) {
    console.warn('Grok validation backend unavailable; using simulated JSON fallback.', error);
  }

  return simulated;
};
