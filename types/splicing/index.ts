export interface SplicingModelConfig {
  modelId: string; // e.g., "alpha-genome-v2"
  confidenceThreshold: number;
}

export interface ExonInfo {
  exonNumber: number;
  included: boolean;
  reason: string;
  coordinates: { start: number; end: number };
  type: 'CONSTITUTIVE' | 'ALTERNATIVE';
  scores?: {
    acceptor: number; // MaxEntScan score (approx -20 to +16)
    donor: number;    // MaxEntScan score (approx -20 to +16)
  };
}

export interface TherapyOption {
  suitable: boolean;
  reasoning: string;
  candidates?: string[];
}

export interface SplicingAnalysisRequest {
  variantId: string;
  geneId: string;
  sequenceWindow: string;
  config?: SplicingModelConfig;
}

export interface SplicingAnalysisResult {
  analysisId: string;
  timestamp: string;

  // Context
  gene: string;
  variant: string;

  // Source indicator
  source?: 'API' | 'CACHE' | 'SIMULATION' | 'BENCHMARK';

  // Structural Results
  exonsAffected: ExonInfo[];
  
  // Quantitative Impacts
  mRNAImpact: {
    stabilityChange: number; // -100 to +100 %
    totalMRNALevel: number; // 0 to 100 %
  };
  
  proteinImpact: {
    frameshift: boolean;
    truncationPosition?: number; // amino acid index
    truncationPercentage: number; // 0-100% of protein lost
    description: string;
  };

  // Clinical Interpretation
  clinicalSeverity: 'BENIGN' | 'UNCERTAIN' | 'MODERATE' | 'SEVERE';
  confidence: number; // 0-100
  aiInterpretation: string;
  spliceAiScores?: {
    allele: string;
    symbol: string;
    deltaAcceptorGain: number;
    deltaAcceptorLoss: number;
    deltaDonorGain: number;
    deltaDonorLoss: number;
    positionAcceptorGain: number;
    positionAcceptorLoss: number;
    positionDonorGain: number;
    positionDonorLoss: number;
  };
  spliceAiSource?: 'API' | 'CACHE' | 'SIMULATION';

  // Therapeutics
  therapySuitability: {
    antisenseOligonucleotide: TherapyOption;
    smallMoleculeSpliceModulator: TherapyOption;
    geneTherapy: TherapyOption;
  };
}