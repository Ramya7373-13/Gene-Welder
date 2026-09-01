export interface VariantInfo {
  id: string;
  protein: string;
  uniprot_id: string;
  variant: string;
  disease: string;
  mechanism_summary: string;
  sequence: string;
}

export interface DomainPrediction {
  plddt_avg: number;
  domains?: string[];
  rmsd_to_native?: number;
  domains_affected?: string[];
}

export interface DeltaMetrics {
  rmsd: number;
  confidence_drop: number;
  functional_impact: string;
}

export interface PredictionData {
  native: DomainPrediction;
  mutant: DomainPrediction;
  delta: DeltaMetrics;
}

export interface AnalysisResponse {
  variantId: string;
  predictions: PredictionData;
  cached: boolean;
  timestamp: number;
  source?: 'API' | 'CACHE' | 'SIMULATION';
  // PDB Structure Data
  pdbData?: {
    native: string; // PDB string
    mutant?: string; // PDB string
  };
  // AlphaMissense pathogenicity data
  alphaMissense?: {
    pathogenicityScore: number;
    classification: string;
    source: string;
  } | null;
  // Claude/Gemini generated analysis usually appended here in a real app
  aiAnalysis?: {
    summary: string;
    compensatory_mutations: Array<{
      mutation: string;
      reasoning: string;
      confidence: number;
    }>;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}