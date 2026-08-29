import { GenomicContext, DataSourceMetadata, OrthologInfo } from '../types/genomics';
import { tieredCache } from '../utils/cacheLayer';

const CACHE_KEY_PREFIX = 'alphagenome_cache_';
const REQUEST_TIMEOUT = 15000; // 15 Seconds (Section 1.3)

const DEFAULT_METADATA: DataSourceMetadata[] = [
    { name: "gnomAD", version: "v4.0.0", url: "https://gnomad.broadinstitute.org/" },
    { name: "ClinVar", version: "2024-01-07", url: "https://www.ncbi.nlm.nih.gov/clinvar/" },
    { name: "PhyloP", version: "hg38/100way", url: "http://hgdownload.cse.ucsc.edu/goldenpath/hg38/phyloP100way/" },
    { name: "UniProtKB", version: "2024_01", url: "https://www.uniprot.org/" }
];

// Helper to generate differences for mock data
const calculateDifferences = (refSnippet: string, altSnippet: string, startPos: number) => {
    const diffs: { pos: number; ref: string; alt: string }[] = [];
    if (!refSnippet || !altSnippet) return diffs;
    const len = Math.min(refSnippet.length, altSnippet.length);
    for (let i = 0; i < len; i++) {
        if (refSnippet[i] !== altSnippet[i]) {
            diffs.push({ pos: startPos + i, ref: refSnippet[i], alt: altSnippet[i] });
        }
    }
    return diffs;
};

// === FALLBACK 3: MOCK DATABASE ===
const MOCK_DB: Record<string, Partial<GenomicContext>> = {
  "SOD1-L144F": {
    position: "chr21:33039648",
    proteinLength: 154,
    domains: [
      { name: "Copper/Zinc Superoxide Dismutase", start: 1, end: 154, type: "Family" },
      { name: "Beta-barrel", start: 10, end: 80, type: "Structural" },
      { name: "Active Site Loop", start: 120, end: 145, type: "Functional" }
    ],
    ptms: [
        { type: 'Acetylation', position: 1, residue: 'M', source: 'UniProt', confidence: 0.9, notes: "N-terminal acetylation" },
        { type: 'Ubiquitination', position: 122, residue: 'K', source: 'PhosphoSitePlus', confidence: 0.8, notes: "Regulatory ubiquitination site" }
    ],
    frequency: {
      gnomadGlobal: 0.000004,
      populations: { afr: 0, amr: 0, eas: 0, nfe: 0.000008, sas: 0 },
      rarityLabel: "Very Rare"
    },
    conservation: {
      phyloP: 4.5, // Highly conserved
      phastCons: 0.98,
      gerp: 5.2
    },
    impact: {
      sift: { score: 0.01, prediction: "Deleterious" },
      polyphen: { score: 0.99, prediction: "Probably Damaging" },
      cadd: 26.4,
      mutationTaster: "Disease-causing",
      verdict: "HIGH IMPACT"
    },
    orthologs: [
      { species: "Homo sapiens", commonName: "Human", position: 144, aa: "L", conserved: true, sequenceSnippet: "MTEYLL", conservationScores: [0.9, 0.9, 0.8, 1.0, 1.0, 1.0], phylogeneticDistance: 0, start: 140, end: 145, differences: [] },
      { species: "Pan troglodytes", commonName: "Chimp", position: 144, aa: "L", conserved: true, sequenceSnippet: "MTEYLL", conservationScores: [0.9, 0.9, 0.8, 1.0, 1.0, 1.0], phylogeneticDistance: 0.01, start: 140, end: 145, differences: [] },
      { species: "Mus musculus", commonName: "Mouse", position: 142, aa: "L", conserved: true, sequenceSnippet: "MTEYLL", conservationScores: [0.9, 0.9, 0.8, 1.0, 1.0, 1.0], phylogeneticDistance: 0.08, start: 138, end: 143, differences: [] },
      { species: "Danio rerio", commonName: "Zebrafish", position: 140, aa: "L", conserved: true, sequenceSnippet: "VTEYLF", conservationScores: [0.6, 0.9, 0.8, 1.0, 1.0, 0.7], phylogeneticDistance: 0.45, start: 136, end: 141, differences: [{pos: 136, ref: 'M', alt: 'V'}, {pos: 141, ref: 'L', alt: 'F'}] },
      { species: "Drosophila melanogaster", commonName: "Fruit Fly", position: 138, aa: "L", conserved: true, sequenceSnippet: "ITEYLF", conservationScores: [0.5, 0.9, 0.8, 1.0, 1.0, 0.6], phylogeneticDistance: 0.80, start: 134, end: 139, differences: [{pos: 134, ref: 'M', alt: 'I'}, {pos: 139, ref: 'L', alt: 'F'}] }
    ],
    regulatory: [
      { type: 'Enhancer', name: 'GH21J033039', impactScore: 0.2, description: "Distal enhancer element, low variant impact predicted." }
    ],
    rna: {
      stabilityChange: -0.5,
      structureDisrupted: false,
      motif: "Standard Coding Sequence"
    },
    clinvar: {
      id: "VCV000010672",
      significance: "Pathogenic",
      reviewStatus: "criteria provided, multiple submitters, no conflicts",
      stars: 2,
      lastEvaluated: "2023-05-12",
      phenotypes: ["Amyotrophic lateral sclerosis type 1"]
    },
    omim: {
      id: "105400",
      title: "AMYOTROPHIC LATERAL SCLEROSIS 1; ALS1",
      inheritance: ["Autosomal Dominant"],
      phenotypes: ["Motor neuron degeneration", "Muscle weakness"],
      url: "https://www.omim.org/entry/105400"
    }
  },
  "TP53-R248Q": {
    position: "chr17:7577538",
    proteinLength: 393,
    domains: [
      { name: "TAD", start: 1, end: 42, type: "Transactivation" },
      { name: "DNA Binding", start: 102, end: 292, type: "Functional" },
      { name: "Tetramerization", start: 325, end: 356, type: "Oligomerization" }
    ],
    ptms: [
        { type: 'Phosphorylation', position: 15, residue: 'S', source: 'UniProt', confidence: 0.95, notes: "DNA damage response" },
        { type: 'Phosphorylation', position: 20, residue: 'S', source: 'UniProt', confidence: 0.95, notes: "CHK2 target" },
        { type: 'Acetylation', position: 382, residue: 'K', source: 'UniProt', confidence: 0.85, notes: "p300/CBP mediated" },
        { type: 'Ubiquitination', position: 291, residue: 'K', source: 'PhosphoSitePlus', confidence: 0.7 }
    ],
    frequency: {
      gnomadGlobal: 0.00002,
      populations: { afr: 0, amr: 0.00001, eas: 0, nfe: 0.00003, sas: 0.00001 },
      rarityLabel: "Very Rare"
    },
    conservation: {
      phyloP: 5.8,
      phastCons: 1.0,
      gerp: 6.1
    },
    impact: {
      sift: { score: 0.00, prediction: "Deleterious" },
      polyphen: { score: 1.00, prediction: "Probably Damaging" },
      cadd: 32.0,
      mutationTaster: "Disease-causing",
      verdict: "HIGH IMPACT"
    },
    orthologs: [
      { species: "Homo sapiens", commonName: "Human", position: 248, aa: "R", conserved: true, sequenceSnippet: "CMNYRL", conservationScores: [1,1,1,1,1,1], phylogeneticDistance: 0, start: 244, end: 249, differences: [] },
      { species: "Pan troglodytes", commonName: "Chimp", position: 248, aa: "R", conserved: true, sequenceSnippet: "CMNYRL", conservationScores: [1,1,1,1,1,1], phylogeneticDistance: 0.01, start: 244, end: 249, differences: [] },
      { species: "Mus musculus", commonName: "Mouse", position: 245, aa: "R", conserved: true, sequenceSnippet: "CMNYRL", conservationScores: [1,1,1,1,1,1], phylogeneticDistance: 0.08, start: 241, end: 246, differences: [] },
      { species: "Danio rerio", commonName: "Zebrafish", position: 230, aa: "R", conserved: true, sequenceSnippet: "CMNYRL", conservationScores: [1,1,1,1,1,1], phylogeneticDistance: 0.45, start: 226, end: 231, differences: [] }
    ],
    regulatory: [
      { type: 'TFBS', name: 'NF-κB, STAT1', impactScore: 0.85, description: "Disrupts binding motif for inflammatory regulators." },
      { type: 'Splice Site', name: 'Exon 7 Donor', impactScore: 0.12, description: "Weakens canonical donor site slightly (Low Impact)." }
    ],
    rna: {
      stabilityChange: -1.2,
      structureDisrupted: true,
      miRNA: "miR-125b binding site",
      motif: "Binding Site"
    },
    clinvar: {
      id: "VCV000012356",
      significance: "Pathogenic",
      reviewStatus: "practice guideline",
      stars: 4,
      lastEvaluated: "2024-01-15",
      phenotypes: ["Li-Fraumeni syndrome", "Hereditary cancer-predisposing syndrome"]
    },
    omim: {
      id: "191170",
      title: "TP53 GENE",
      inheritance: ["Autosomal Dominant"],
      phenotypes: ["Li-Fraumeni syndrome", "Multiple cancer types"],
      url: "https://www.omim.org/entry/191170"
    }
  },
  "CFTR-F508del": {
    position: "chr7:117199644",
    proteinLength: 1480,
    domains: [
      { name: "TMD1", start: 70, end: 388, type: "Transmembrane" },
      { name: "NBD1", start: 389, end: 678, type: "Nucleotide Binding" },
      { name: "R Domain", start: 679, end: 830, type: "Regulatory" },
      { name: "TMD2", start: 831, end: 1197, type: "Transmembrane" },
      { name: "NBD2", start: 1198, end: 1480, type: "Nucleotide Binding" }
    ],
    ptms: [
        { type: 'Phosphorylation', position: 660, residue: 'S', source: 'UniProt', confidence: 0.9, notes: "PKA site" },
        { type: 'Phosphorylation', position: 700, residue: 'S', source: 'UniProt', confidence: 0.9, notes: "PKC site" },
        { type: 'Phosphorylation', position: 737, residue: 'S', source: 'UniProt', confidence: 0.9 },
        { type: 'Glycosylation', position: 894, residue: 'N', source: 'UniProt', confidence: 0.95, notes: "N-linked" },
        { type: 'Glycosylation', position: 900, residue: 'N', source: 'UniProt', confidence: 0.95, notes: "N-linked" }
    ],
    frequency: {
      gnomadGlobal: 0.007,
      populations: { afr: 0.0003, amr: 0.004, eas: 0.0001, nfe: 0.015, sas: 0.002 },
      rarityLabel: "Common"
    },
    conservation: {
      phyloP: 3.2,
      phastCons: 0.99,
      gerp: 4.8
    },
    impact: {
      sift: { score: 0.00, prediction: "Deleterious" },
      polyphen: { score: 1.00, prediction: "Probably Damaging" },
      cadd: 24.5,
      mutationTaster: "Disease-causing",
      verdict: "PATHOGENIC"
    },
    orthologs: [
      { species: "Homo sapiens", commonName: "Human", position: 508, aa: "F", conserved: true, sequenceSnippet: "IKGFFG", conservationScores: [0.8, 0.9, 0.8, 1.0, 1.0, 0.8], phylogeneticDistance: 0, start: 505, end: 510, differences: [] },
      { species: "Pan troglodytes", commonName: "Chimp", position: 508, aa: "F", conserved: true, sequenceSnippet: "IKGFFG", conservationScores: [0.8, 0.9, 0.8, 1.0, 1.0, 0.8], phylogeneticDistance: 0.01, start: 505, end: 510, differences: [] },
      { species: "Mus musculus", commonName: "Mouse", position: 508, aa: "F", conserved: true, sequenceSnippet: "IKGFFG", conservationScores: [0.8, 0.9, 0.8, 1.0, 1.0, 0.8], phylogeneticDistance: 0.08, start: 505, end: 510, differences: [] }
    ],
    regulatory: [
       { type: 'CpG Island', name: 'Promoter-associated CpG', impactScore: 0.05, description: "Risk: Minimal effect on gene expression." }
    ],
    rna: {
      stabilityChange: 0.1,
      structureDisrupted: false,
      motif: "Exonic Sequence"
    },
    clinvar: {
      id: "VCV000007892",
      significance: "Pathogenic",
      reviewStatus: "reviewed by expert panel",
      stars: 3,
      lastEvaluated: "2023-11-01",
      phenotypes: ["Cystic fibrosis"]
    },
    omim: {
      id: "602421",
      title: "CYSTIC FIBROSIS; CF",
      inheritance: ["Autosomal Recessive"],
      phenotypes: ["Pulmonary disease", "Pancreatic insufficiency"],
      url: "https://www.omim.org/entry/602421"
    }
  }
};

export const genomicAnnotationService = {
  
  // PRIMARY: AlphaGenome API
  async fetchAlphaGenomeData(gene: string, variant: string): Promise<GenomicContext | null> {
    // AlphaGenome is intentionally simulation-only until its official gRPC
    // service is bridged through the backend.
    return null;
  },

  // FALLBACK 1: NCBI (Simulated for Demo)
  async fetchNCBIFallback(gene: string, variant: string): Promise<Partial<GenomicContext> | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        // Simulating a partial success for demonstration
        await new Promise(resolve => setTimeout(resolve, 300)); // Mock network delay
        if (Math.random() > 0.8) return null; // 20% failure chance
        
        return {
            source: "NCBI ClinVar (Fallback 1)",
            clinvar: {
                id: "VCV_NCBI_FALLBACK",
                significance: "Likely Pathogenic",
                reviewStatus: "criteria provided, single submitter",
                stars: 1,
                lastEvaluated: new Date().toISOString().split('T')[0],
                phenotypes: [`${gene}-related condition`]
            }
        };
    } catch (e) {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
  },

  // FALLBACK 2: Ensembl VEP (Simulated for Demo)
  async fetchEnsemblFallback(gene: string, variant: string): Promise<Partial<GenomicContext> | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        await new Promise(resolve => setTimeout(resolve, 300)); // Mock network delay
        return {
            source: "Ensembl VEP (Fallback 2)",
            position: "chr?:??????",
            impact: {
                sift: { score: 0.05, prediction: "Deleterious" },
                polyphen: { score: 0.85, prediction: "Possibly Damaging" },
                cadd: 22.0,
                mutationTaster: "Prediction Unavailable",
                verdict: "Predicted Pathogenic"
            }
        };
    } catch (e) {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
  },

  // FALLBACK 3: Procedural / Mock
  generateProceduralFallback(gene: string, variantId: string): GenomicContext {
      let hash = 0;
      for (let i = 0; i < variantId.length; i++) hash = ((hash << 5) - hash) + variantId.charCodeAt(i);
      hash = Math.abs(hash);
      const isConserved = (hash % 10) > 3;

      // Mock ortholog generator
      const generateOrthologs = (isConserved: boolean): OrthologInfo[] => {
          const humanSnippet = "KLQELA";
          const start = 97;
          return [
              { species: "Homo sapiens", commonName: "Human", position: 100, aa: "L", conserved: true, sequenceSnippet: humanSnippet, conservationScores: [0.8, 0.9, 1.0, 1.0, 0.7, 0.9], phylogeneticDistance: 0, start, end: start + 5, differences: [] },
              { species: "Pan troglodytes", commonName: "Chimp", position: 100, aa: "L", conserved: true, sequenceSnippet: humanSnippet, conservationScores: [0.8, 0.9, 1.0, 1.0, 0.7, 0.9], phylogeneticDistance: 0.01, start, end: start + 5, differences: [] },
              { 
                  species: "Mus musculus", commonName: "Mouse", position: 98, aa: "L", conserved: isConserved, 
                  sequenceSnippet: isConserved ? humanSnippet : "KLQERA", 
                  conservationScores: [0.8, 0.9, 1.0, 1.0, 0.6, 0.8], phylogeneticDistance: 0.08,
                  start: 95, end: 100,
                  differences: isConserved ? [] : [{ pos: 99, ref: 'L', alt: 'R' }]
              },
              { 
                  species: "Danio rerio", commonName: "Zebrafish", position: 95, aa: isConserved ? "L" : "I", conserved: isConserved, 
                  sequenceSnippet: isConserved ? humanSnippet : "KIQEIA", 
                  conservationScores: [0.7, 0.5, 0.9, 1.0, 0.4, 0.8], phylogeneticDistance: 0.45,
                  start: 92, end: 97,
                  differences: isConserved ? [] : [{ pos: 93, ref: 'L', alt: 'I'}, { pos: 96, ref: 'L', alt: 'I'}]
              }
          ];
      };

      return {
        variantId,
        gene,
        position: `chr${(hash % 22) + 1}:${1000000 + (hash % 1000000)}`,
        proteinLength: 400 + (hash % 200),
        domains: [{ name: "Predicted Domain", start: 50, end: 150, type: "Unknown" }],
        ptms: (hash % 3 === 0) ? [{ type: 'Phosphorylation', position: 55, residue: 'S', source: 'Simulated', confidence: 0.7, notes: "Predicted site" }] : [],
        source: "Simulation (Fallback 3)",
        timestamp: Date.now(),
        metadata: DEFAULT_METADATA,
        frequency: {
          gnomadGlobal: (hash % 100) / 100000,
          populations: {
            afr: (hash % 50) / 100000,
            amr: (hash % 60) / 100000,
            eas: (hash % 20) / 100000,
            nfe: (hash % 90) / 100000,
            sas: (hash % 40) / 100000
          },
          rarityLabel: (hash % 100) < 10 ? "Very Rare" : "Rare"
        },
        conservation: {
          phyloP: isConserved ? 2.0 + (hash % 40)/10 : -1.0 + (hash % 20)/10,
          phastCons: isConserved ? 0.8 + (hash % 20)/100 : 0.2 + (hash % 50)/100,
          gerp: isConserved ? 3.0 + (hash % 30)/10 : -2.0
        },
        impact: {
          sift: { score: isConserved ? 0.02 : 0.4, prediction: isConserved ? "Deleterious" : "Tolerated" },
          polyphen: { score: isConserved ? 0.9 : 0.2, prediction: isConserved ? "Probably Damaging" : "Benign" },
          cadd: isConserved ? 20 + (hash % 15) : 5 + (hash % 10),
          mutationTaster: isConserved ? "Disease-causing" : "Polymorphism",
          verdict: isConserved ? "HIGH IMPACT" : "LOW IMPACT"
        },
        orthologs: generateOrthologs(isConserved),
        regulatory: (hash % 5 === 0) ? [{ type: 'CpG Island', name: 'CpG:123', impactScore: 0.6, description: "Proximity to methylated region." }] : [],
        rna: {
          stabilityChange: (hash % 20) / 10 - 1.0,
          structureDisrupted: (hash % 3 === 0),
          motif: (hash % 3 === 0) ? "Predicted Hairpin Loop" : undefined
        },
        omim: {
            id: (100000 + hash % 100000).toString(),
            title: `${gene.toUpperCase()} RELATED DISORDER`,
            inheritance: ["Unknown"],
            phenotypes: ["Variable"],
            url: "#"
        }
      };
  },

  // ORCHESTRATOR
  async fetchAnnotations(gene: string, variant: string, variantId: string): Promise<GenomicContext> {
    const cacheKey = `${CACHE_KEY_PREFIX}${variantId}`;

    // 1. Check Multi-tier Cache (Section 7.1)
    const cached = await tieredCache.get(cacheKey);
    if (cached) return cached;

    // 0. Check Mock DB for demo consistency
    if (MOCK_DB[variantId]) {
       const baseline = this.generateProceduralFallback(gene, variantId);
       const result = { 
           ...baseline, 
           ...MOCK_DB[variantId], 
           variantId, 
           gene, 
           source: "Internal Database",
           metadata: DEFAULT_METADATA 
       };
       await tieredCache.set(cacheKey, result);
       return result;
    }

    // 2. Try Primary API
    const primary = await this.fetchAlphaGenomeData(gene, variant);
    if (primary) {
        const result = { ...primary, variantId };
        await tieredCache.set(cacheKey, result);
        return result;
    }

    // 3. Try Fallbacks (Section 8.1 / 8.2)
    const [ncbi, ensembl] = await Promise.all([
        this.fetchNCBIFallback(gene, variant),
        this.fetchEnsemblFallback(gene, variant)
    ]);

    let finalResult: GenomicContext;

    if (ncbi || ensembl) {
         const baseline = this.generateProceduralFallback(gene, variantId);
         finalResult = {
             ...baseline,
             ...ncbi,
             ...ensembl,
             source: "Aggregated Fallbacks (NCBI/Ensembl)",
             metadata: DEFAULT_METADATA
         };
    } else {
         // 4. Final Fallback to procedural
         finalResult = this.generateProceduralFallback(gene, variantId);
    }

    // Cache the result even if it's a fallback (optional, maybe lower TTL for fallbacks in real app)
    await tieredCache.set(cacheKey, finalResult);
    return finalResult;
  },

  async fetchBatchAnnotations(requests: { gene: string; variant: string; variantId: string }[]): Promise<(GenomicContext | null)[]> {
    return Promise.all(
        requests.map(req => this.fetchAnnotations(req.gene, req.variant, req.variantId))
    );
  }
};
