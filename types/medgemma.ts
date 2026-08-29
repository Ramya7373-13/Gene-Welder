export type Pathogenicity = 'Benign' | 'Likely Benign' | 'Uncertain Significance' | 'Likely Pathogenic' | 'Pathogenic';
export type ConfidenceLevel = 'Low' | 'Medium' | 'High';

export interface TreatmentRecommendation {
  name: string;
  type: string; // e.g. "Small Molecule", "Gene Therapy"
  mechanism: string;
  evidenceLevel: string;
}

export interface PhenotypePrediction {
  onset: string;
  severity: string;
  affectedSystems: string[];
  lifeExpectancyImpact?: string;
}

export interface MedGemmaAnalysis {
  variantId: string;
  gene: string;
  timestamp: number;
  
  // Classification
  pathogenicity: Pathogenicity;
  confidence: ConfidenceLevel;
  confidenceScore: number; // 0-100
  
  // Clinical Context
  diseases: string[];
  inheritanceMode: string;
  populationFrequency?: string; // MAF
  
  // Analysis
  mechanism: string; // Detailed text
  clinicalSignificance: string; // Summary
  
  // Advanced Features
  treatments: TreatmentRecommendation[];
  phenotype: PhenotypePrediction;
  drugInteractions?: string[];
  
  // Metadata
  citations: string[];
    isCached?: boolean;
    source?: 'API' | 'CACHE' | 'SIMULATION';
}