
import { DISEASE_VARIANTS, MOCK_ANALYSIS } from '../constants';
import { PredictionData } from '../types';
import { configService } from './configService';

export interface HistoryItem {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface AlphaMissenseAnnotation {
  gene: string;
  variant: string;
  uniprotId?: string;
  pathogenicityScore: number;
  classification: 'likely_pathogenic' | 'likely_benign' | 'ambiguous';
  rankscore?: number;
  source: 'API' | 'CACHE' | 'SIMULATION';
  attribution?: {
    source: string;
    license: string;
    citation: string;
  };
}

export interface VariantAnalysis {
  source?: 'API' | 'CACHE' | 'SIMULATION';
  variant: {
    protein: string;
    hgvs: string;
    disease: string;
    id: string;
    uniprot: string;
    sequence: string;
    mutantSequence?: string; // New field
    mutationPositionInSnippet?: number; // New field for correct highlighting
  };
  mechanism: string;
  analysis: {
    summary: string;
    compensatory_mutations: Array<{
      mutation: string;
      reasoning: string;
      confidence: number;
    }>;
  };
  predictions: PredictionData;
  alphaMissense?: AlphaMissenseAnnotation | null;
  riskScore?: number;
  confidence?: number;
  proteinChange?: string;
  consequence?: string;
  pdbData?: {
    native: string;
    mutant?: string;
  };
}

export const generateVariantReport = async (gene: string, variant: string): Promise<VariantAnalysis> => {
  const query = `${gene} ${variant}`;
  if (!configService.isForcedOffline()) {
    try {
      const backendUrl = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/api/ai/variant-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gene, variant, mode: 'explainer' })
      });
      if (response.ok) return await response.json() as VariantAnalysis;
      console.warn(`Gemini backend returned ${response.status}; using benchmark fallback.`);
    } catch (error) {
      console.warn('Gemini backend unavailable; using benchmark fallback.', error);
    }
  }

  // Explicit benchmark fallback
  const knownVariant = DISEASE_VARIANTS.find(
    v => v.protein.toUpperCase() === gene.toUpperCase() && 
         (v.variant.toUpperCase() === variant.toUpperCase() || v.id.includes(variant))
  );

  if (knownVariant && MOCK_ANALYSIS[knownVariant.id]) {
    const mock = MOCK_ANALYSIS[knownVariant.id];
    const match = knownVariant.variant.match(/p\.([A-Z][a-z]{0,2})?(\d+)/);
    const pos = match ? parseInt(match[2], 10) : 1;
    const seq = knownVariant.sequence;
    
    return {
      variant: {
        protein: knownVariant.protein,
        hgvs: knownVariant.variant,
        disease: knownVariant.disease,
        id: knownVariant.id,
        uniprot: knownVariant.uniprot_id,
        sequence: knownVariant.sequence,
        mutantSequence: seq, 
        mutationPositionInSnippet: pos
      },
      mechanism: knownVariant.mechanism_summary,
      source: 'SIMULATION',
      analysis: mock.aiAnalysis || { summary: 'No analysis available', compensatory_mutations: [] },
      predictions: mock.predictions,
      riskScore: 90,
      confidence: 95,
      proteinChange: knownVariant.variant,
      consequence: "missense"
    };
  }

  let hash = 0;
  const str = query.toUpperCase();
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash);
  const plddtNative = 85 + (seed % 15);
  const rmsd = 0.5 + ((seed % 40) / 10);
  const plddtMutant = plddtNative - (rmsd * 5) - (seed % 10);
  const dummyWT = "M" + "L".repeat(30) + "A" + "L".repeat(30);
  const dummyMut = "M" + "L".repeat(30) + "P" + "L".repeat(30);

  return {
    variant: {
      protein: gene.toUpperCase(),
      hgvs: variant,
      disease: "Simulated Analysis Mode",
      id: `sim-${gene}-${variant}`,
      uniprot: "SIMULATED",
      sequence: dummyWT,
      mutantSequence: dummyMut,
      mutationPositionInSnippet: 32
    },
    source: 'SIMULATION',
    mechanism: "[SIMULATION] The system does not have cached data for this specific variant and no API key is provided. The analysis below is procedurally generated to demonstrate the UI capabilities.",
    analysis: {
      summary: `Simulation: The mutation in ${gene} is predicted to destabilize the local fold (RMSD ${rmsd.toFixed(2)}Å).`,
      compensatory_mutations: [
         { mutation: "Simulated-M1", reasoning: "Hypothetical stabilizer", confidence: 0.5 }
      ]
    },
    predictions: {
      native: { plddt_avg: plddtNative, domains: ["Simulated Domain"] },
      mutant: { plddt_avg: plddtMutant, rmsd_to_native: rmsd, domains_affected: ["Local Motif"] },
      delta: { rmsd: rmsd, confidence_drop: plddtNative - plddtMutant, functional_impact: "Predicted Instability" }
    },
    riskScore: 50 + (seed % 40),
    confidence: 60,
    proteinChange: variant,
    consequence: "missense"
  };
};

/**
 * Tier 2: fetch a plain-English clinical summary from the backend Gemini proxy.
 * Mirrors generateVariantReport's offline/error handling — never throws, always
 * resolves to a usable object (a deterministic simulated string when unavailable),
 * so the Gemini API key never needs to reach the browser bundle.
 */
export const getClinicalSummary = async (
  gene: string,
  variant: string
): Promise<{ summary: string; alphaMissense?: AlphaMissenseAnnotation | null; source: string }> => {
  const simulated = {
    summary: `[SIMULATION] Clinical note for ${gene} ${variant}: this is a computational prediction shown in offline/demo mode. No live AI summary is available. Interpret cautiously as decision support, not a diagnosis.`,
    alphaMissense: null,
    source: 'SIMULATION'
  };

  if (configService.isForcedOffline()) {
    return simulated;
  }

  try {
    const backendUrl = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:5000';
    const response = await fetch(`${backendUrl}/api/ai/clinical-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gene, variant })
    });
    if (response.ok) {
      return await response.json() as { summary: string; alphaMissense?: AlphaMissenseAnnotation | null; source: string };
    }
    console.warn(`Clinical summary backend returned ${response.status}; using simulated fallback.`);
  } catch (error) {
    console.warn('Clinical summary backend unavailable; using simulated fallback.', error);
  }

  return simulated;
};

export class ProteinChatSession {
  private history: HistoryItem[] = [];
  private contextData: string;

  constructor(contextData: string, history: HistoryItem[] = []) {
    this.history = history;
    this.contextData = contextData;
  }

  async *sendMessage(message: string): AsyncGenerator<string, void, unknown> {
    try {
      const backendUrl = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context: this.contextData, history: this.history })
      });
      if (!response.ok) throw new Error(`Gemini chat backend returned ${response.status}`);
      const data = await response.json() as { text: string };
      if (data.text) yield data.text;
      this.history.push({ role: 'user', parts: [{ text: message }] });
      this.history.push({ role: 'model', parts: [{ text: data.text }] });
    } catch (error: any) {
      yield `[SIMULATION] AI assistant unavailable: ${error.message}`;
    }
  }
}
