
import { MedGemmaAnalysis } from '../types/medgemma';

const CACHE_KEY_PREFIX = 'medgemma_cache_';
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 Days

// Mock Data for specific demo scenarios when API is unavailable
const MOCK_DATA: Record<string, Partial<MedGemmaAnalysis>> = {
  "SMN1-c.840+2T>G": {
    pathogenicity: "Pathogenic",
    confidence: "High",
    confidenceScore: 98,
    diseases: ["Spinal Muscular Atrophy (SMA)", "Type 1 SMA"],
    inheritanceMode: "Autosomal Recessive",
    mechanism: "Disruption of the canonical 5' splice site of Exon 7 leads to exon skipping. This results in an unstable truncated protein (SMNΔ7) which is rapidly degraded, causing motor neuron loss.",
    clinicalSignificance: "Classic severe splicing mutation. Prognosis depends on SMN2 copy number. Without treatment, leads to rapid motor neuron degeneration.",
    treatments: [
      { name: "Nusinersen (Spinraza)", type: "Antisense Oligonucleotide", mechanism: "Modifies SMN2 splicing to include Exon 7", evidenceLevel: "FDA Approved" },
      { name: "Onasemnogene abeparvovec (Zolgensma)", type: "Gene Therapy", mechanism: "SMN1 gene replacement", evidenceLevel: "FDA Approved" },
      { name: "Risdiplam (Evrysdi)", type: "Small Molecule", mechanism: "Splicing modifier targeting SMN2", evidenceLevel: "FDA Approved" }
    ],
    phenotype: {
      onset: "Infantile (<6 months)",
      severity: "Severe",
      affectedSystems: ["Neurological", "Musculoskeletal", "Respiratory"],
      lifeExpectancyImpact: "Reduced without treatment"
    },
    citations: ["PMID: 27932647", "PMID: 29117185"],
    populationFrequency: "<0.001%",
    drugInteractions: [] 
  },
  "CFTR-c.3849+10kbC>T": {
    pathogenicity: "Pathogenic",
    confidence: "High",
    confidenceScore: 95,
    diseases: ["Cystic Fibrosis", "Atypical CF"],
    inheritanceMode: "Autosomal Recessive",
    mechanism: "Deep intronic mutation creating a cryptic 5' splice site. This leads to the inclusion of a pseudo-exon containing a premature stop codon, triggering NMD.",
    clinicalSignificance: "Associated with a milder phenotype than F508del due to residual normal splicing. Pulmonary status is the primary prognostic factor.",
    treatments: [
      { name: "Ivacaftor", type: "CFTR Potentiator", mechanism: "Increases channel opening probability", evidenceLevel: "Clinical Trials (Variable)" },
      { name: "Eluforsen (QR-010)", type: "RNA Therapy", mechanism: "Stereoblocking ASO to skip pseudo-exon", evidenceLevel: "Investigational" }
    ],
    phenotype: {
      onset: "Childhood/Adolescence",
      severity: "Moderate",
      affectedSystems: ["Respiratory", "Gastrointestinal"],
      lifeExpectancyImpact: "Variable"
    },
    citations: ["PMID: 8062438", "PMID: 25349310"],
    populationFrequency: "0.1% (Ashkenazi Jewish)",
    drugInteractions: [
      "Ivacaftor: Sensitive to CYP3A inhibitors (e.g., Ketoconazole, Grapefruit juice).",
      "Monitor liver function tests (ALT/AST) during treatment."
    ]
  },
  "TP53-c.743G>A": {
    pathogenicity: "Pathogenic",
    confidence: "High",
    confidenceScore: 99,
    diseases: ["Li-Fraumeni Syndrome", "Early-onset Cancer"],
    inheritanceMode: "Autosomal Dominant",
    mechanism: "Donor site disruption affecting TP53 transcript stability. Results in haploinsufficiency or dominant-negative p53 protein forms depending on reading frame.",
    clinicalSignificance: "High lifetime risk of diverse malignancies including sarcomas, breast cancer, and brain tumors. Prognosis depends on early detection.",
    treatments: [
      { name: "Enhanced Surveillance", type: "Monitoring", mechanism: "Early detection via whole-body MRI", evidenceLevel: "Standard of Care" },
      { name: "APR-246", type: "Small Molecule", mechanism: "p53 reactivator (investigational)", evidenceLevel: "Phase II/III" }
    ],
    phenotype: {
      onset: "Variable (Early)",
      severity: "High Risk",
      affectedSystems: ["Multi-systemic"],
      lifeExpectancyImpact: "Significantly Reduced"
    },
    citations: ["PMID: 28212136"],
    populationFrequency: "Ultra-rare",
    drugInteractions: [
      "Avoid genotoxic chemotherapies if possible (may induce secondary malignancies).",
      "Radiation therapy requires careful risk/benefit analysis."
    ]
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const medgemmaClient = {
  
  async analyzeVariant(gene: string, variant: string): Promise<MedGemmaAnalysis> {
    const variantId = `${gene}-${variant}`;
    const cacheKey = `${CACHE_KEY_PREFIX}${variantId}`;

    // 1. Check Cache (Section 5.1)
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_TTL) {
          return { ...parsed, isCached: true, source: 'CACHE' };
        }
      } catch (e) {
        localStorage.removeItem(cacheKey);
      }
    }

    // Backend-routed Gemini clinical interpretation.
    try {
      const backendUrl = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/api/ai/clinical-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gene, variant })
      });
      if (response.ok) {
        const result = await response.json() as MedGemmaAnalysis;
        localStorage.setItem(cacheKey, JSON.stringify(result));
        return result;
      }
      console.warn(`Clinical Gemini backend returned ${response.status}; using benchmark fallback.`);
    } catch (error) {
      console.warn('Clinical Gemini backend unavailable; using benchmark fallback.', error);
    }

    // Explicit benchmark fallback (not a separate MedGemma model).
    await delay(1500); // Simulate thinking
    
    const mockMatch = MOCK_DATA[variantId];
    if (mockMatch) {
       return {
         ...mockMatch,
         variantId,
         gene,
          timestamp: Date.now(),
          source: 'SIMULATION'
       } as MedGemmaAnalysis;
    }

    // Procedural Fallback for unknowns
    return {
      variantId,
      gene,
      timestamp: Date.now(),
      pathogenicity: "Uncertain Significance",
      confidence: "Medium",
      confidenceScore: 65,
      diseases: [`${gene}-related Disorder`],
      inheritanceMode: "Unknown",
      mechanism: "The variant disrupts the coding sequence, but clinical evidence is limited. In silico tools predict potential structural impact.",
      clinicalSignificance: "Currently classified as VUS due to insufficient population and segregation data. Prognosis is uncertain.",
      treatments: [],
      phenotype: {
        onset: "Unknown",
        severity: "Variable",
        affectedSystems: ["Unknown"],
        lifeExpectancyImpact: "Unknown"
      },
      citations: [],
      populationFrequency: "Unknown",
      drugInteractions: []
      ,source: 'SIMULATION'
    };
  }
};
