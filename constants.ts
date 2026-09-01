import { VariantInfo, AnalysisResponse } from './types';

// Matching the backend constants
export const DISEASE_VARIANTS: VariantInfo[] = [
  {
    id: "SOD1-L144F",
    protein: "SOD1",
    uniprot_id: "P04179",
    variant: "p.L144F",
    disease: "ALS (Amyotrophic Lateral Sclerosis)",
    mechanism_summary: "Loss of zinc coordination in active site",
    sequence: "MTEYLLPTTYEGEHLYERDEGDKSGDPSVWGA..." 
  },
  {
    id: "TP53-R248Q",
    protein: "TP53",
    uniprot_id: "P04637",
    variant: "p.R248Q",
    disease: "Colorectal Cancer",
    mechanism_summary: "Loss of DNA-binding domain stability",
    sequence: "MEEPQSDPSVEPPLSQETFSDLWKLLPENNVL..."
  },
  {
    id: "FVIII-A1689V",
    protein: "FVIII",
    uniprot_id: "P00451",
    variant: "p.A1689V",
    disease: "Hemophilia A",
    mechanism_summary: "Protein misfolding and structural instability",
    sequence: "MQPQLFLLLLAVTFSSAYSQKKKQFNKVVKL..."
  },
  {
    id: "CFTR-F508del",
    protein: "CFTR",
    uniprot_id: "P13569",
    variant: "p.F508del",
    disease: "Cystic Fibrosis",
    mechanism_summary: "Deletion causes NBD1 misfolding and proteasomal degradation",
    sequence: "TIKENIIFGVSYDEYRYRSVIKACQLEEDISKFA..."
  },
  {
    id: "BRCA1-C61G",
    protein: "BRCA1",
    uniprot_id: "P38398",
    variant: "p.C61G",
    disease: "Breast/Ovarian Cancer",
    mechanism_summary: "Disruption of RING domain zinc finger interface",
    sequence: "MDLSALRVEEVQNVINAMQKILECPICLELIKEPV..."
  },
  {
    id: "KRAS-G12D",
    protein: "KRAS",
    uniprot_id: "P01116",
    variant: "p.G12D",
    disease: "Pancreatic Ductal Adenocarcinoma",
    mechanism_summary: "Steric blockage of GAP binding, locking protein in active GTP-bound state",
    sequence: "MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPT..."
  },
  {
    id: "HBB-E6V",
    protein: "HBB",
    uniprot_id: "P68871",
    variant: "p.E6V",
    disease: "Sickle Cell Anemia",
    mechanism_summary: "Creates hydrophobic patch promoting polymerization under low O2",
    sequence: "MVHLTPEEKSAVTALWGKVNVDEVGGEALGRLL..."
  },
  {
    id: "BRAF-V600E",
    protein: "BRAF",
    uniprot_id: "P15056",
    variant: "p.V600E",
    disease: "Melanoma / Colorectal Cancer",
    mechanism_summary: "Phosphomimetic mutation activating kinase domain independently of RAS",
    sequence: "IGDFGLATVKSRWSGSHQFEQLSGSILWMAPEV..."
  },
  {
    id: "EGFR-L858R",
    protein: "EGFR",
    uniprot_id: "P00533",
    variant: "p.L858R",
    disease: "Non-Small Cell Lung Cancer",
    mechanism_summary: "Destabilizes auto-inhibited conformation, increasing kinase activity",
    sequence: "ITQLMPFGCLLDYVREHKDNIGSQYLLNWCVQA..."
  },
  {
    id: "PIK3CA-H1047R",
    protein: "PIK3CA",
    uniprot_id: "P42336",
    variant: "p.H1047R",
    disease: "Breast Cancer",
    mechanism_summary: "Enhances membrane lipid interaction, increasing basal kinase activity",
    sequence: "MPPRPSSGELWGIHLMPPRILVECLLPNGMIVTLE..."
  },
  {
    id: "IDH1-R132H",
    protein: "IDH1",
    uniprot_id: "O75874",
    variant: "p.R132H",
    disease: "Glioma / AML",
    mechanism_summary: "Neomorphic activity producing oncometabolite 2-HG",
    sequence: "MSKKISGGSVVEMQGDEMTRIIWELIKEKLIFPY..."
  },
  {
    id: "LRRK2-G2019S",
    protein: "LRRK2",
    uniprot_id: "Q5S007",
    variant: "p.G2019S",
    disease: "Parkinson's Disease",
    mechanism_summary: "Hyperactivation of kinase domain causing neuronal toxicity",
    sequence: "MASGSCQGCEEDEETLKKLIVRLNNVQEGKQIET..."
  },
  {
    id: "PAH-R408W",
    protein: "PAH",
    uniprot_id: "P00439",
    variant: "p.R408W",
    disease: "Phenylketonuria (PKU)",
    mechanism_summary: "Severe misfolding of tetramerization domain leading to degradation",
    sequence: "MSTAVLENPGLGRKLSDFGQETSYIEDNSNQFQ..."
  },
  {
    id: "GBA-N370S",
    protein: "GBA",
    uniprot_id: "P04062",
    variant: "p.N370S",
    disease: "Gaucher Disease",
    mechanism_summary: "ER retention due to misfolding, reducing lysosomal activity",
    sequence: "MEFSSPSREECPKPLSRVSIMAGSLTGLLLLQ..."
  },
  {
    id: "APC-R876X",
    protein: "APC",
    uniprot_id: "P25054",
    variant: "p.R876*",
    disease: "Familial Adenomatous Polyposis",
    mechanism_summary: "Nonsense mutation leading to truncated protein and loss of beta-catenin regulation",
    sequence: "MAAASRPSQKGGSNGGTRLGSVKPKGALKLPGV..."
  },
  {
    id: "VHL-R167Q",
    protein: "VHL",
    uniprot_id: "P40337",
    variant: "p.R167Q",
    disease: "Von Hippel-Lindau Syndrome",
    mechanism_summary: "Disrupts binding to Elongin C, preventing HIF-1alpha ubiquitination",
    sequence: "MPRRAENWDEAEVGAEEAGVEEYGPEEDGGEES..."
  },
  {
    id: "PTEN-R130G",
    protein: "PTEN",
    uniprot_id: "P60484",
    variant: "p.R130G",
    disease: "Cowden Syndrome",
    mechanism_summary: "Loss of phosphatase activity due to active site disruption",
    sequence: "MTAIIKEIVSRNKRRYQEDGFDLDLTYIYPNII..."
  },
  {
    id: "JAK2-V617F",
    protein: "JAK2",
    uniprot_id: "O60674",
    variant: "p.V617F",
    disease: "Polycythemia Vera",
    mechanism_summary: "Disrupts JH2 pseudokinase inhibition of JH1 kinase domain, causing constitutive activation",
    sequence: "MGMACLTMTEMEGTSTSSIYQNGDISGNANSMK..."
  },
  {
    id: "NOTCH1-L1575P",
    protein: "NOTCH1",
    uniprot_id: "P46531",
    variant: "p.L1575P",
    disease: "T-cell Acute Lymphoblastic Leukemia",
    mechanism_summary: "Destabilizes HD domain, leading to ligand-independent cleavage and activation",
    sequence: "MPPLLAPLLCLALLPALAARGPRCSQPGETCLN..."
  },
  {
    id: "LDLR-G544V",
    protein: "LDLR",
    uniprot_id: "P01130",
    variant: "p.G544V",
    disease: "Familial Hypercholesterolemia",
    mechanism_summary: "Disrupts beta-propeller domain folding, preventing LDL release in endosomes",
    sequence: "MGPWGWKLRWTVALLLAAAGTAVGDRCERNEF..."
  },
  {
    id: "MYH7-R403Q",
    protein: "MYH7",
    uniprot_id: "P12883",
    variant: "p.R403Q",
    disease: "Hypertrophic Cardiomyopathy",
    mechanism_summary: "Alters actin-myosin interface increasing ATPase activity and contractile force",
    sequence: "MGDSEMAVFGAAAPYLRKSEKERLEAQTRPF..."
  },
  {
    id: "FBN1-C1039Y",
    protein: "FBN1",
    uniprot_id: "P35555",
    variant: "p.C1039Y",
    disease: "Marfan Syndrome",
    mechanism_summary: "Cysteine substitution disrupts disulfide bond in EGF-like domain, affecting microfibril assembly",
    sequence: "MRGTAARLLPLLFALLLGLADAQAAQGQNIT..."
  },
  {
    id: "HFE-C282Y",
    protein: "HFE",
    uniprot_id: "Q30201",
    variant: "p.C282Y",
    disease: "Hemochromatosis",
    mechanism_summary: "Disrupts disulfide bridge in alpha-3 domain, preventing Beta-2 microglobulin association",
    sequence: "MGPRARPALLLLLLLLLGGPGPGGSHSLRYF..."
  },
  {
    id: "SERPINA1-E342K",
    protein: "SERPINA1",
    uniprot_id: "P01009",
    variant: "p.E342K",
    disease: "Alpha-1 Antitrypsin Deficiency",
    mechanism_summary: "Promotes polymerization (Z-antitrypsin) in the liver, reducing serum levels",
    sequence: "MPSSVSWGILLLAGLCCLVPVSLAEDPQGDA..."
  },
  {
    id: "RHO-P23H",
    protein: "RHO",
    uniprot_id: "P08100",
    variant: "p.P23H",
    disease: "Retinitis Pigmentosa",
    mechanism_summary: "Misfolding leading to ER retention and photoreceptor cell death",
    sequence: "MNGTEGPNFYVPFSNKTGVVRSPFEAPQYYLAEP..."
  },
  {
    id: "SOD1-A4V",
    protein: "SOD1",
    uniprot_id: "P04179",
    variant: "p.A4V",
    disease: "ALS (Amyotrophic Lateral Sclerosis)",
    mechanism_summary: "Severe destabilization of the dimer interface, promoting aggregation",
    sequence: "MTEYLLPTTYEGEHLYERDEGDKSGDPSVWGA..."
  },
  {
    id: "TTR-V30M",
    protein: "TTR",
    uniprot_id: "P02766",
    variant: "p.V30M",
    disease: "Transthyretin Amyloidosis",
    mechanism_summary: "Destabilizes tetramer leading to monomer dissociation and amyloid fibrils",
    sequence: "MASHRLLLLCLAGLVFVSEAGPTGTGESKCPL..."
  },
  {
    id: "LMNA-R482W",
    protein: "LMNA",
    uniprot_id: "P02545",
    variant: "p.R482W",
    disease: "Familial Partial Lipodystrophy",
    mechanism_summary: "Disrupts Ig-like fold structure and DNA/chromatin interaction",
    sequence: "METPSQRRATRSGAQASSTPLSPTRITRLQEK..."
  },
  {
    id: "RET-C634R",
    protein: "RET",
    uniprot_id: "P07949",
    variant: "p.C634R",
    disease: "Multiple Endocrine Neoplasia type 2A",
    mechanism_summary: "Extracellular cysteine mutation causing constitutive dimerization",
    sequence: "MAKATSGAAGLRLLLLLLLPLLGKVALGLYFSR..."
  },
  {
    id: "FGFR3-G380R",
    protein: "FGFR3",
    uniprot_id: "P22607",
    variant: "p.G380R",
    disease: "Achondroplasia",
    mechanism_summary: "Transmembrane domain mutation stabilizing the dimer, leading to constitutive activation and inhibition of bone growth",
    sequence: "MVFPRVPAAGLSVRAPGDEKCIEKRVTEAA..." 
  },
  {
    id: "CFTR-G551D",
    protein: "CFTR",
    uniprot_id: "P13569",
    variant: "p.G551D",
    disease: "Cystic Fibrosis",
    mechanism_summary: "Abolishes ATP-dependent channel gating without preventing surface expression (Gating mutant)",
    sequence: "TIKENIIFGVSYDEYRYRSVIKACQLEEDISKFA..."
  },
  {
    id: "HEXA-G269S",
    protein: "HEXA",
    uniprot_id: "P06865",
    variant: "p.G269S",
    disease: "Tay-Sachs Disease (Adult Onset)",
    mechanism_summary: "Destabilizes alpha-subunit folding, reducing enzyme activity but leaving residual function",
    sequence: "MTSSRLWFSLLLAAAFAGRATALWPWPQNFQ..."
  },
  {
    id: "SMAD4-R361H",
    protein: "SMAD4",
    uniprot_id: "Q13485",
    variant: "p.R361H",
    disease: "Juvenile Polyposis Syndrome",
    mechanism_summary: "Disrupts MH2 domain interface, preventing trimer formation with SMAD2/3",
    sequence: "MDNMSITNTPTSNDACLSIVHSLMCHRQGGE..."
  },
  {
    id: "MEN1-A242V",
    protein: "MEN1",
    uniprot_id: "O00255",
    variant: "p.A242V",
    disease: "Multiple Endocrine Neoplasia Type 1",
    mechanism_summary: "Disrupts interaction with JunD, impairing transcriptional regulation",
    sequence: "MGLKPSPWLWSVLLLLLLLLPPPAQLPPL..."
  },
  // New Additions from assignments
  {
    id: "MECP2-T158M",
    protein: "MECP2",
    uniprot_id: "P51608",
    variant: "p.T158M",
    disease: "Rett Syndrome",
    mechanism_summary: "Destabilizes the Methyl-CpG Binding Domain (MBD), reducing DNA binding affinity.",
    sequence: "ASASPKQRRSIIRDRGPMYDDPTLPEGWTRKLK..."
  },
  {
    id: "COL1A1-G904C",
    protein: "COL1A1",
    uniprot_id: "P02452",
    variant: "p.G904C",
    disease: "Osteogenesis Imperfecta",
    mechanism_summary: "Substitution of critical Glycine in Gly-X-Y repeat disrupts triple helix folding and stability.",
    sequence: "GPPGPQGPPGAPGPLGIAGITGARGLAGPPGMP..."
  },
  {
    id: "ALDH2-E487K",
    protein: "ALDH2",
    uniprot_id: "P05091",
    variant: "p.E487K",
    disease: "Alcohol Flush Reaction / Cancer Risk",
    mechanism_summary: "Dominant-negative disruption of tetramerization and loss of catalytic activity.",
    sequence: "RAAFQLGSPWRRMDASHRGRLLNRLADLIERDR..."
  },
  {
    id: "PSEN1-M146L",
    protein: "PSEN1",
    uniprot_id: "P49768",
    variant: "p.M146L",
    disease: "Early-onset Alzheimer's Disease",
    mechanism_summary: "Alters gamma-secretase cleavage specificity, increasing the Abeta42/Abeta40 ratio.",
    sequence: "MALVILGPLCLMQWWALLAPFILYLPE..."
  },
  {
    id: "ACTA2-R179H",
    protein: "ACTA2",
    uniprot_id: "P62736",
    variant: "p.R179H",
    disease: "Thoracic Aortic Aneurysm and Dissection",
    mechanism_summary: "Disrupts actin polymerization and contractile force generation in smooth muscle.",
    sequence: "IVLDSGDGVTHNVPIYEGYALPHAIMRLDLAGR..."
  }
];

// Fallback data if backend is not running
export const MOCK_ANALYSIS: Record<string, AnalysisResponse> = {
  "SOD1-L144F": {
    variantId: "SOD1-L144F",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 94.5, domains: ["Beta-barrel", "Active Site Loop"] },
      mutant: { plddt_avg: 82.1, rmsd_to_native: 1.8, domains_affected: ["Active Site Loop (Destabilized)"] },
      delta: { rmsd: 1.8, confidence_drop: 12.4, functional_impact: "Loss of metal binding affinity" }
    },
    aiAnalysis: {
      summary: "The L144F mutation introduces a bulky hydrophobic phenylalanine in place of leucine near the dimer interface and metal-binding site. This steric clash disrupts the electrostatic network required for Zn2+ coordination, leading to monomerization and aggregation prone intermediates.",
      compensatory_mutations: [
        { mutation: "G37A", reasoning: "Stabilizes the beta-barrel core to compensate for interface fluctuation.", confidence: 0.85 },
        { mutation: "V148I", reasoning: "Fills the hydrophobic void created by the shift in the F144 rotamer.", confidence: 0.72 }
      ]
    }
  },
  "TP53-R248Q": {
    variantId: "TP53-R248Q",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 96.0, domains: ["DNA Binding"] },
      mutant: { plddt_avg: 78.5, rmsd_to_native: 3.2, domains_affected: ["DNA Contact Helix"] },
      delta: { rmsd: 3.2, confidence_drop: 17.5, functional_impact: "Complete loss of DNA contact" }
    },
    aiAnalysis: {
      summary: "R248 is a critical DNA-contact residue. Mutation to Glutamine (Q) removes the positive charge required for phosphate backbone interaction. The helix destabilizes locally.",
      compensatory_mutations: [
        { mutation: "H168R", reasoning: "Re-introduces positive charge potential nearby.", confidence: 0.65 }
      ]
    }
  },
  "FVIII-A1689V": {
    variantId: "FVIII-A1689V",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 88.5, domains: ["A3 Domain"] },
      mutant: { plddt_avg: 72.0, rmsd_to_native: 2.1, domains_affected: ["Factor IXa binding site"] },
      delta: { rmsd: 2.1, confidence_drop: 16.5, functional_impact: "Reduced affinity for FIXa" }
    },
    aiAnalysis: {
      summary: "A1689 is buried in the hydrophobic core of the A3 domain. Substitution to Valine, while conservative, creates a packing defect that propagates to the surface, affecting the Factor IXa binding interface.",
      compensatory_mutations: [
        { mutation: "L1693F", reasoning: "Restores core packing density.", confidence: 0.78 }
      ]
    }
  },
  "CFTR-F508del": {
    variantId: "CFTR-F508del",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 89.0, domains: ["NBD1", "TMD Interface"] },
      mutant: { plddt_avg: 55.4, rmsd_to_native: 4.5, domains_affected: ["NBD1 Core", "NBD1-TMD Linker"] },
      delta: { rmsd: 4.5, confidence_drop: 33.6, functional_impact: "Severe misfolding & degradation" }
    },
    aiAnalysis: {
      summary: "Deletion of F508 removes a crucial aromatic side chain that docks NBD1 to the transmembrane domains (TMDs). Without this anchor, NBD1 has a lower melting temperature and fails to assemble with the rest of the channel, triggering quality control degradation.",
      compensatory_mutations: [
        { mutation: "I539T", reasoning: "Suppressor mutation that stabilizes the NBD1 beta-sheet core.", confidence: 0.92 },
        { mutation: "R553M", reasoning: "Improves solubility of the unassigned NBD1 loop.", confidence: 0.68 }
      ]
    }
  },
  "BRCA1-C61G": {
    variantId: "BRCA1-C61G",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 94.0, domains: ["RING Domain"] },
      mutant: { plddt_avg: 68.0, rmsd_to_native: 3.8, domains_affected: ["Zinc Finger 1"] },
      delta: { rmsd: 3.8, confidence_drop: 26.0, functional_impact: "Loss of E3 Ligase Activity" }
    },
    aiAnalysis: {
      summary: "C61 is a coordinating cysteine residue for the first Zn2+ ion in the RING domain. Mutation to Glycine abolishes zinc binding, causing the entire domain to unfold. This destroys the interaction surface required for BARD1 binding.",
      compensatory_mutations: [
        { mutation: "None", reasoning: "Zinc ligands are strictly conserved; difficult to compensate sterically.", confidence: 0.10 }
      ]
    }
  },
  "KRAS-G12D": {
    variantId: "KRAS-G12D",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 96.5, domains: ["GTPase Domain", "Switch I/II"] },
      mutant: { plddt_avg: 95.8, rmsd_to_native: 0.6, domains_affected: ["Active Site", "Switch Regions"] },
      delta: { rmsd: 0.6, confidence_drop: 0.7, functional_impact: "Constitutive activation (GTP locked)" }
    },
    aiAnalysis: {
      summary: "The G12D mutation introduces a charged aspartate side chain into the active site where a glycine normally resides. This steric bulk prevents the 'arginine finger' of GAP proteins from entering the active site to catalyze GTP hydrolysis. While the protein structure itself remains highly stable (low RMSD), the functional switch is permanently jammed in the 'ON' state.",
      compensatory_mutations: [
        { mutation: "None (Direct)", reasoning: "Active site geometry is extremely constrained.", confidence: 0.05 },
        { mutation: "Y32F", reasoning: "Allosteric modulation of Switch I may reduce GTP affinity slightly.", confidence: 0.45 }
      ]
    }
  },
  "HBB-E6V": {
    variantId: "HBB-E6V",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 97.0, domains: ["Globin Fold"] },
      mutant: { plddt_avg: 96.2, rmsd_to_native: 0.9, domains_affected: ["Surface Helix A"] },
      delta: { rmsd: 0.9, confidence_drop: 0.8, functional_impact: "Polymerization (Sickling)" }
    },
    aiAnalysis: {
      summary: "The E6V mutation replaces a charged surface Glutamate with a hydrophobic Valine. This creates a sticky 'hydrophobic patch' on the surface of the beta-globin chain. In the deoxygenated state, this patch binds to a complementary pocket on adjacent tetramers (Phe85/Leu88), driving the formation of long, rigid fibers that distort the red blood cell.",
      compensatory_mutations: [
        { mutation: "F85S", reasoning: "Disrupts the acceptor pocket on the adjacent chain, preventing fiber assembly.", confidence: 0.98 },
        { mutation: "T87Q", reasoning: "Gamma-globin mimetic that inhibits lateral contact formation.", confidence: 0.95 }
      ]
    }
  },
  "BRAF-V600E": {
    variantId: "BRAF-V600E",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 93.0, domains: ["Kinase Domain", "P-loop"] },
      mutant: { plddt_avg: 92.5, rmsd_to_native: 1.2, domains_affected: ["Activation Segment"] },
      delta: { rmsd: 1.2, confidence_drop: 0.5, functional_impact: "Constitutive kinase activity" }
    },
    aiAnalysis: {
      summary: "The V600E mutation mimics the electrostatic properties of a phosphorylated threonine at a critical position in the activation segment. This phosphomimetic effect locks the kinase domain in an active conformation, bypassing the need for upstream RAS signaling and leading to uncontrolled cell proliferation.",
      compensatory_mutations: [
        { mutation: "L505H", reasoning: "Sterically hinders the active conformation of the alpha-C helix.", confidence: 0.60 },
        { mutation: "F468A", reasoning: "Disrupts the R-spine assembly required for active state stability.", confidence: 0.82 }
      ]
    }
  },
  "EGFR-L858R": {
    variantId: "EGFR-L858R",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 91.0, domains: ["Tyrosine Kinase Domain"] },
      mutant: { plddt_avg: 89.5, rmsd_to_native: 1.42, domains_affected: ["Alpha-C Helix"] },
      delta: { rmsd: 1.42, confidence_drop: 1.5, functional_impact: "Hyperactivation & Drug Sensitivity" }
    },
    alphaMissense: {
      pathogenicityScore: 0.982,
      classification: "likely_pathogenic",
      source: "SIMULATION"
    },
    aiAnalysis: {
      summary: "L858 is located in the activation loop. Substitution with the charged Arginine (R) disrupts the auto-inhibitory helical turn found in the inactive state. This shifts the equilibrium heavily towards the active state. Interestingly, this conformational change also creates the specific binding pocket that makes this variant hypersensitive to TKI inhibitors like Gefitinib.",
      compensatory_mutations: [
        { mutation: "T790M", reasoning: "Common drug resistance mutation; restores ATP affinity and steric bulk.", confidence: 0.99 }
      ]
    }
  },
  "PIK3CA-H1047R": {
    variantId: "PIK3CA-H1047R",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 92.5, domains: ["Kinase Domain", "C-terminal Tail"] },
      mutant: { plddt_avg: 91.0, rmsd_to_native: 1.1, domains_affected: ["Membrane Binding Interface"] },
      delta: { rmsd: 1.1, confidence_drop: 1.5, functional_impact: "Constitutive activation via membrane recruitment" }
    },
    aiAnalysis: {
      summary: "H1047 is located in the C-terminal tail of the kinase domain. The H1047R mutation increases the positive charge of the surface, enhancing electrostatic interactions with anionic membrane lipids. This mimics the activation usually induced by RAS-binding, leading to high basal activity.",
      compensatory_mutations: [
        { mutation: "M1043L", reasoning: "Alters the flexibility of the activation loop to reduce basal catalytic rate.", confidence: 0.65 }
      ]
    }
  },
  "IDH1-R132H": {
    variantId: "IDH1-R132H",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 95.0, domains: ["Isocitrate Binding Site"] },
      mutant: { plddt_avg: 93.5, rmsd_to_native: 0.8, domains_affected: ["Active Site Homodimer Interface"] },
      delta: { rmsd: 0.8, confidence_drop: 1.5, functional_impact: "Gain of function (2-HG production)" }
    },
    aiAnalysis: {
      summary: "R132 is a key residue in the active site involved in binding isocitrate. The R132H mutation alters the substrate specificity, allowing the enzyme to reduce alpha-ketoglutarate to the oncometabolite 2-hydroxyglutarate (2-HG), while losing normal oxidative decarboxylation activity.",
      compensatory_mutations: [
        { mutation: "I103F", reasoning: "Steric bulk that interferes with NADPH binding required for the neomorphic reaction.", confidence: 0.55 }
      ]
    }
  },
  "LRRK2-G2019S": {
    variantId: "LRRK2-G2019S",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 90.0, domains: ["Kinase Domain", "DYG Motif"] },
      mutant: { plddt_avg: 89.2, rmsd_to_native: 0.5, domains_affected: ["Activation Loop"] },
      delta: { rmsd: 0.5, confidence_drop: 0.8, functional_impact: "Increased kinase activity" }
    },
    aiAnalysis: {
      summary: "G2019 is part of the conserved DFG motif (DYG in LRRK2) which controls kinase activation. The G2019S mutation stabilizes the active 'DYG-in' conformation through a new hydrogen bond, increasing kinase activity 2-3 fold and causing neurotoxicity.",
      compensatory_mutations: [
        { mutation: "A1950P", reasoning: "Rigidifies the hinge region to dampen ATP binding affinity.", confidence: 0.40 }
      ]
    }
  },
  "PAH-R408W": {
    variantId: "PAH-R408W",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 88.0, domains: ["Tetramerization Domain", "Catalytic Domain"] },
      mutant: { plddt_avg: 62.0, rmsd_to_native: 4.2, domains_affected: ["Tetramerization Interface"] },
      delta: { rmsd: 4.2, confidence_drop: 26.0, functional_impact: "Aggregation and degradation" }
    },
    aiAnalysis: {
      summary: "R408 is crucial for the interaction between the catalytic and tetramerization domains. The R408W mutation introduces a bulky tryptophan that creates severe steric clashes, preventing tetramer assembly and leading to the formation of aggregate-prone monomers that are rapidly degraded.",
      compensatory_mutations: [
        { mutation: "S411C", reasoning: "Potential for disulfide bond formation to restabilize the interface.", confidence: 0.35 }
      ]
    }
  },
  "GBA-N370S": {
    variantId: "GBA-N370S",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 91.5, domains: ["TIM Barrel", "Domain III"] },
      mutant: { plddt_avg: 86.0, rmsd_to_native: 1.4, domains_affected: ["Active Site Loop"] },
      delta: { rmsd: 1.4, confidence_drop: 5.5, functional_impact: "Trafficking defect (ER Retention)" }
    },
    aiAnalysis: {
      summary: "N370S does not destroy catalytic activity completely but alters the pH profile and stability of the enzyme. Crucially, it causes the protein to be recognized by ER quality control as misfolded, preventing its transport to the lysosome where it functions.",
      compensatory_mutations: [
        { mutation: "H255R", reasoning: "Stabilizing mutation remote from the active site that improves folding kinetics.", confidence: 0.68 }
      ]
    }
  },
  "APC-R876X": {
    variantId: "APC-R876X",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 85.0, domains: ["Armadillo repeat"] },
      mutant: { plddt_avg: 60.0, rmsd_to_native: 5.5, domains_affected: ["Beta-catenin binding"] },
      delta: { rmsd: 5.5, confidence_drop: 25.0, functional_impact: "Truncated protein / LOF" }
    },
    aiAnalysis: {
      summary: "The nonsense mutation R876* leads to a premature stop codon, resulting in a truncated APC protein that lacks the critical beta-catenin binding and regulation domains. This failure to degrade beta-catenin leads to constitutive Wnt signaling and polyp formation.",
      compensatory_mutations: [
        { mutation: "None", reasoning: "Nonsense mutations typically require read-through therapy (e.g. Ataluren) rather than compensatory mutations.", confidence: 0.10 }
      ]
    }
  },
  "VHL-R167Q": {
    variantId: "VHL-R167Q",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 92.0, domains: ["Beta Domain", "Alpha Domain"] },
      mutant: { plddt_avg: 75.0, rmsd_to_native: 2.3, domains_affected: ["Elongin C binding"] },
      delta: { rmsd: 2.3, confidence_drop: 17.0, functional_impact: "Loss of E3 ubiquitin ligase complex" }
    },
    aiAnalysis: {
      summary: "R167 is a critical contact residue for Elongin C. The R167Q mutation disrupts hydrogen bonding at the interface, destabilizing the VCB complex. This prevents the ubiquitination and degradation of HIF-1alpha, leading to a pseudo-hypoxic state and tumor angiogenesis.",
      compensatory_mutations: [
        { mutation: "L169R", reasoning: "Restores local charge balance at the interface.", confidence: 0.55 }
      ]
    }
  },
  "PTEN-R130G": {
    variantId: "PTEN-R130G",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 94.0, domains: ["Phosphatase Domain"] },
      mutant: { plddt_avg: 88.0, rmsd_to_native: 1.1, domains_affected: ["Active Site P-loop"] },
      delta: { rmsd: 1.1, confidence_drop: 6.0, functional_impact: "Catalytic dead" }
    },
    aiAnalysis: {
      summary: "R130 is strictly conserved in the phosphatase active site motif (HCXXGXXR). It binds the phosphate group of the lipid substrate PIP3. Mutation to Glycine (G) removes this critical charge interaction, rendering the enzyme catalytically dead despite maintaining overall fold stability.",
      compensatory_mutations: [
        { mutation: "K125R", reasoning: "Enhances electrostatic steering of the substrate to the active site.", confidence: 0.40 }
      ]
    }
  },
  "JAK2-V617F": {
    variantId: "JAK2-V617F",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 90.5, domains: ["Pseudokinase JH2", "Kinase JH1"] },
      mutant: { plddt_avg: 89.0, rmsd_to_native: 1.8, domains_affected: ["JH1-JH2 Interface"] },
      delta: { rmsd: 1.8, confidence_drop: 1.5, functional_impact: "Loss of autoinhibition" }
    },
    aiAnalysis: {
      summary: "V617 is located in the JH2 pseudokinase domain. The V617F mutation creates a rigid stacking interaction with F595 and F537, disrupting the inhibitory interaction between JH2 and the JH1 kinase domain. This releases the brake on the kinase, leading to constitutive activation.",
      compensatory_mutations: [
        { mutation: "F595A", reasoning: "Removes the stacking partner for F617, potentially restoring flexibility.", confidence: 0.75 }
      ]
    }
  },
  "NOTCH1-L1575P": {
    variantId: "NOTCH1-L1575P",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 88.0, domains: ["HD Domain"] },
      mutant: { plddt_avg: 72.0, rmsd_to_native: 3.5, domains_affected: ["Heterodimerization Domain"] },
      delta: { rmsd: 3.5, confidence_drop: 16.0, functional_impact: "Ligand-independent activation" }
    },
    aiAnalysis: {
      summary: "The L1575P mutation introduces a proline kink into a helix of the HD domain. This destabilizes the protective cap that normally shields the S2 cleavage site. Consequently, the receptor is cleaved and activated by metalloproteases even in the absence of a ligand.",
      compensatory_mutations: [
        { mutation: "V1577A", reasoning: "Alleviates steric strain caused by the proline insertion.", confidence: 0.60 }
      ]
    }
  },
  "LDLR-G544V": {
    variantId: "LDLR-G544V",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 91.0, domains: ["Beta-propeller"] },
      mutant: { plddt_avg: 70.0, rmsd_to_native: 2.8, domains_affected: ["EGF-precursor homology domain"] },
      delta: { rmsd: 2.8, confidence_drop: 21.0, functional_impact: "Failed LDL release" }
    },
    aiAnalysis: {
      summary: "G544 is part of a conserved 'YWTD' repeat in the beta-propeller. Mutation to Valine introduces steric clashes in the blade interior, preventing the conformational change required to release LDL at acidic endosomal pH. The receptor is then degraded rather than recycled.",
      compensatory_mutations: [
        { mutation: "A546G", reasoning: "Restores flexibility in the blade turn.", confidence: 0.62 }
      ]
    }
  },
  "MYH7-R403Q": {
    variantId: "MYH7-R403Q",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 95.5, domains: ["Myosin Head"] },
      mutant: { plddt_avg: 94.0, rmsd_to_native: 0.7, domains_affected: ["Actin binding interface"] },
      delta: { rmsd: 0.7, confidence_drop: 1.5, functional_impact: "Hyper-contractility" }
    },
    aiAnalysis: {
      summary: "R403 is located at the base of the loop contacting actin. The R403Q mutation weakens the electrostatic interaction with actin but alters the kinetics of the ATPase cycle, leading to a small increase in force generation that, over time, triggers compensatory cardiac hypertrophy.",
      compensatory_mutations: [
        { mutation: "K400E", reasoning: "Modulates the local charge environment to restore normal cycling kinetics.", confidence: 0.50 }
      ]
    }
  },
  "FBN1-C1039Y": {
    variantId: "FBN1-C1039Y",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 93.0, domains: ["cbEGF-like domain"] },
      mutant: { plddt_avg: 65.0, rmsd_to_native: 3.9, domains_affected: ["Calcium binding loop"] },
      delta: { rmsd: 3.9, confidence_drop: 28.0, functional_impact: "Secretory defect" }
    },
    aiAnalysis: {
      summary: "C1039 forms a critical disulfide bond (C1039-C1050) stabilizing the calcium-binding EGF-like domain. The C1039Y mutation leaves C1050 with a free sulfhydryl group, leading to aberrant intermolecular disulfide cross-linking and retention of fibrillin-1 in the ER.",
      compensatory_mutations: [
        { mutation: "C1050S", reasoning: "Removes the orphan cysteine to prevent toxic aggregation.", confidence: 0.70 }
      ]
    }
  },
  "HFE-C282Y": {
    variantId: "HFE-C282Y",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 92.0, domains: ["Alpha-3 domain"] },
      mutant: { plddt_avg: 58.0, rmsd_to_native: 4.5, domains_affected: ["Beta-2 microglobulin interface"] },
      delta: { rmsd: 4.5, confidence_drop: 34.0, functional_impact: "Failure to reach cell surface" }
    },
    aiAnalysis: {
      summary: "C282 forms a disulfide bond essential for the structure of the alpha-3 domain. The C282Y mutation prevents this bond, causing the alpha-3 domain to unfold. This abolishes the binding site for Beta-2 microglobulin, which is required for HFE transport to the cell surface.",
      compensatory_mutations: [
        { mutation: "V272L", reasoning: "Stabilizes the hydrophobic core of the alpha-3 domain in the absence of the disulfide.", confidence: 0.45 }
      ]
    }
  },
  "SERPINA1-E342K": {
    variantId: "SERPINA1-E342K",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 91.0, domains: ["Serpin Core"] },
      mutant: { plddt_avg: 84.0, rmsd_to_native: 1.5, domains_affected: ["Reactive Center Loop"] },
      delta: { rmsd: 1.5, confidence_drop: 7.0, functional_impact: "Polymerization" }
    },
    aiAnalysis: {
      summary: "E342 is located at the 'shutter' region of the serpin. The E342K mutation disrupts a salt bridge, destabilizing the beta-sheet A. This allows the Reactive Center Loop of one molecule to insert into the beta-sheet A of another, forming loop-sheet polymers that accumulate in the liver.",
      compensatory_mutations: [
        { mutation: "T114F", reasoning: "Fills a cavity in the shutter region to impede sheet opening.", confidence: 0.85 }
      ]
    }
  },
  "RHO-P23H": {
    variantId: "RHO-P23H",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 92.0, domains: ["N-terminal tail", "TM helices"] },
      mutant: { plddt_avg: 65.0, rmsd_to_native: 3.5, domains_affected: ["N-terminus", "Disulfide bond C110-C187"] },
      delta: { rmsd: 3.5, confidence_drop: 27.0, functional_impact: "Misfolding & ER Retention" }
    },
    aiAnalysis: {
      summary: "Proline 23 helps structure the N-terminal tail. The P23H mutation disrupts the N-terminal cap stability, interfering with the formation of the critical C110-C187 disulfide bond. This leads to misfolded rhodopsin being retained in the ER, causing proteostatic stress and photoreceptor apoptosis.",
      compensatory_mutations: [
        { mutation: "T17M", reasoning: "Stabilizes the N-terminal beta-strand to rescue folding.", confidence: 0.65 }
      ]
    }
  },
  "SOD1-A4V": {
    variantId: "SOD1-A4V",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 94.5, domains: ["Beta-barrel", "Dimer Interface"] },
      mutant: { plddt_avg: 80.0, rmsd_to_native: 1.2, domains_affected: ["Dimer Interface"] },
      delta: { rmsd: 1.2, confidence_drop: 14.5, functional_impact: "Dimer destabilization" }
    },
    aiAnalysis: {
      summary: "A4V is located at the dimer interface. The larger Valine side chain creates steric strain that pushes the two monomers apart. This drastically reduces the half-life of the holo-enzyme and promotes the formation of toxic oligomers.",
      compensatory_mutations: [
        { mutation: "G37A", reasoning: "Stabilizes the beta-barrel to counteract interface strain.", confidence: 0.75 },
        { mutation: "V148I", reasoning: "Optimizes hydrophobic packing at the interface.", confidence: 0.70 }
      ]
    }
  },
  "TTR-V30M": {
    variantId: "TTR-V30M",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 93.0, domains: ["Sandwich fold"] },
      mutant: { plddt_avg: 88.0, rmsd_to_native: 0.9, domains_affected: ["Dimer-Dimer Interface"] },
      delta: { rmsd: 0.9, confidence_drop: 5.0, functional_impact: "Tetramer dissociation" }
    },
    aiAnalysis: {
      summary: "V30M is located in the hydrophobic core of the monomer but affects the stability of the tetramer. The mutation shifts the equilibrium towards monomer dissociation, which is the rate-limiting step for amyloid fibril formation.",
      compensatory_mutations: [
        { mutation: "T119M", reasoning: "Inter-subunit mutation that kinetically stabilizes the tetramer (supra-stabilizer).", confidence: 0.99 }
      ]
    }
  },
  "LMNA-R482W": {
    variantId: "LMNA-R482W",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 89.0, domains: ["Ig-like fold"] },
      mutant: { plddt_avg: 75.0, rmsd_to_native: 2.1, domains_affected: ["Surface patch"] },
      delta: { rmsd: 2.1, confidence_drop: 14.0, functional_impact: "Altered chromatin binding" }
    },
    aiAnalysis: {
      summary: "R482 is on the surface of the Ig-like domain. Mutation to Tryptophan (W) creates a hydrophobic patch on the surface and alters the electrostatic potential. This disrupts interactions with DNA and other nuclear lamina partners, leading to nuclear envelope fragility.",
      compensatory_mutations: [
        { mutation: "None", reasoning: "Surface interaction sites are difficult to compensate without knowing the specific binding partner interface.", confidence: 0.20 }
      ]
    }
  },
  "RET-C634R": {
    variantId: "RET-C634R",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 90.0, domains: ["Cysteine-rich domain"] },
      mutant: { plddt_avg: 88.0, rmsd_to_native: 1.5, domains_affected: ["Dimer interface"] },
      delta: { rmsd: 1.5, confidence_drop: 2.0, functional_impact: "Constitutive dimerization" }
    },
    aiAnalysis: {
      summary: "C634 is normally involved in an intramolecular disulfide bond. The C634R mutation prevents this bond, leaving a partner cysteine unpaired. This unpaired cysteine then forms intermolecular disulfide bonds with other RET molecules, causing ligand-independent dimerization and constitutive activation.",
      compensatory_mutations: [
        { mutation: "C630A", reasoning: "Removes the potential partner cysteine to prevent intermolecular bonding.", confidence: 0.80 }
      ]
    }
  },
  "FGFR3-G380R": {
    variantId: "FGFR3-G380R",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 92.0, domains: ["Transmembrane Helix"] },
      mutant: { plddt_avg: 93.0, rmsd_to_native: 0.8, domains_affected: ["Dimer Interface"] },
      delta: { rmsd: 0.8, confidence_drop: -1.0, functional_impact: "Constitutive Dimerization" }
    },
    aiAnalysis: {
      summary: "The G380R mutation introduces a charged arginine into the hydrophobic transmembrane helix. To bury this charge, the helices associate more tightly, stabilizing the dimerized, active state of the receptor even in the absence of ligand. This constitutive signaling inhibits chondrocyte proliferation.",
      compensatory_mutations: [
        { mutation: "V381E", reasoning: "Introduces a charge repulsion to destabilize the aberrant dimer interface.", confidence: 0.60 }
      ]
    }
  },
  "CFTR-G551D": {
    variantId: "CFTR-G551D",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 88.0, domains: ["NBD1", "NBD2"] },
      mutant: { plddt_avg: 87.0, rmsd_to_native: 0.5, domains_affected: ["ATP Binding Site"] },
      delta: { rmsd: 0.5, confidence_drop: 1.0, functional_impact: "Channel Gating Failure" }
    },
    aiAnalysis: {
      summary: "G551 is critical for ATP binding and hydrolysis which drives channel opening. The G551D mutation introduces a negative charge that repels ATP, locking the channel in a closed state despite correct folding and trafficking to the cell membrane.",
      compensatory_mutations: [
        { mutation: "None (Potentiator)", reasoning: "Requires small molecule potentiator (Ivacaftor) rather than structural compensation.", confidence: 0.95 }
      ]
    }
  },
  "HEXA-G269S": {
    variantId: "HEXA-G269S",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 90.0, domains: ["Alpha Subunit"] },
      mutant: { plddt_avg: 82.0, rmsd_to_native: 1.8, domains_affected: ["Subunit Interface"] },
      delta: { rmsd: 1.8, confidence_drop: 8.0, functional_impact: "Reduced thermal stability" }
    },
    aiAnalysis: {
      summary: "The G269S mutation causes a subtle packing defect in the alpha subunit of Beta-Hexosaminidase A. This reduces the thermal stability of the enzyme and impairs its dimerization with the beta subunit, leading to a partial loss of activity characteristic of adult-onset Tay-Sachs.",
      compensatory_mutations: [
        { mutation: "E307K", reasoning: "Forms a stabilizing salt bridge to rescue the local fold.", confidence: 0.50 }
      ]
    }
  },
  "SMAD4-R361H": {
    variantId: "SMAD4-R361H",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 91.0, domains: ["MH2 Domain"] },
      mutant: { plddt_avg: 70.0, rmsd_to_native: 3.2, domains_affected: ["Trimer Interface"] },
      delta: { rmsd: 3.2, confidence_drop: 21.0, functional_impact: "Loss of TGF-beta signaling" }
    },
    aiAnalysis: {
      summary: "R361 is located in the L3 loop of the MH2 domain, critical for the formation of the heterotrimeric SMAD complex. The R361H mutation disrupts the electrostatic complementarity required for binding to phosphorylated SMAD2/3, thereby abolishing TGF-beta signal transduction.",
      compensatory_mutations: [
        { mutation: "D355K", reasoning: "Restores electrostatic balance at the interface.", confidence: 0.40 }
      ]
    }
  },
  "MEN1-A242V": {
    variantId: "MEN1-A242V",
    cached: true,
    timestamp: Date.now(),
    predictions: {
      native: { plddt_avg: 85.0, domains: ["JunD Binding Domain"] },
      mutant: { plddt_avg: 83.0, rmsd_to_native: 1.2, domains_affected: ["Binding Pocket"] },
      delta: { rmsd: 1.2, confidence_drop: 2.0, functional_impact: "Loss of transcriptional repression" }
    },
    aiAnalysis: {
      summary: "A242 is buried in the hydrophobic core of the pocket that binds the transcription factor JunD. The A242V mutation introduces a slightly larger side chain that creates steric conflict, weakening the affinity for JunD and leading to unregulated cell growth.",
      compensatory_mutations: [
        { mutation: "L245A", reasoning: "Creates space in the hydrophobic core to accommodate the valine.", confidence: 0.55 }
      ]
    }
  },
  "MECP2-T158M": {
    "variantId": "MECP2-T158M",
    "cached": true,
    "timestamp": Date.now(),
    "predictions": {
      "native": { "plddt_avg": 92.5, "domains": ["MBD Domain"] },
      "mutant": { "plddt_avg": 70.0, "rmsd_to_native": 2.8, "domains_affected": ["DNA Binding Interface"] },
      "delta": { "rmsd": 2.8, "confidence_drop": 22.5, "functional_impact": "Loss of DNA binding" }
    },
    "aiAnalysis": {
      "summary": "T158 is a critical residue in the Methyl-CpG Binding Domain (MBD) of MeCP2. The T158M mutation disrupts the hydrophobic core of the domain and hydrogen bonding networks, leading to structural destabilization and significantly reduced affinity for methylated DNA.",
      "compensatory_mutations": [
        { "mutation": "V156I", "reasoning": "Increases hydrophobic packing in the core to compensate for the methionine insertion.", "confidence": 0.60 }
      ]
    }
  },
  "COL1A1-G904C": {
    "variantId": "COL1A1-G904C",
    "cached": true,
    "timestamp": Date.now(),
    "predictions": {
      "native": { "plddt_avg": 95.0, "domains": ["Triple Helix"] },
      "mutant": { "plddt_avg": 80.0, "rmsd_to_native": 3.5, "domains_affected": ["Collagen Helix"] },
      "delta": { "rmsd": 3.5, "confidence_drop": 15.0, "functional_impact": "Disrupted triple helix assembly" }
    },
    "aiAnalysis": {
      "summary": "Glycine residues at every third position (Gly-X-Y) are essential for the tight packing of the collagen triple helix. The G904C substitution introduces a larger cysteine side chain, creating a local bulge that delays helix folding and promotes over-modification of the chains.",
      "compensatory_mutations": [
        { "mutation": "None", "reasoning": "Glycine positions in the triple helix are structurally invariant.", "confidence": 0.05 }
      ]
    }
  },
  "ALDH2-E487K": {
    "variantId": "ALDH2-E487K",
    "cached": true,
    "timestamp": Date.now(),
    "predictions": {
      "native": { "plddt_avg": 94.0, "domains": ["Oligomerization Domain"] },
      "mutant": { "plddt_avg": 85.0, "rmsd_to_native": 1.2, "domains_affected": ["Dimer Interface"] },
      "delta": { "rmsd": 1.2, "confidence_drop": 9.0, "functional_impact": "Tetramer destabilization" }
    },
    "aiAnalysis": {
      "summary": "E487 is located at the dimer interface essential for tetramerization. The E487K mutation disrupts a salt bridge with R264 (or R475 in some numberings), destabilizing the tetramer and drastically reducing catalytic efficiency (dominant negative effect).",
      "compensatory_mutations": [
        { "mutation": "R264E", "reasoning": "Restores the salt bridge by reversing the charge polarity (K-E interaction instead of E-R).", "confidence": 0.85 }
      ]
    }
  },
  "PSEN1-M146L": {
    "variantId": "PSEN1-M146L",
    "cached": true,
    "timestamp": Date.now(),
    "predictions": {
      "native": { "plddt_avg": 90.0, "domains": ["TM Helix 2"] },
      "mutant": { "plddt_avg": 89.0, "rmsd_to_native": 0.6, "domains_affected": ["Active Site Conformation"] },
      "delta": { "rmsd": 0.6, "confidence_drop": 1.0, "functional_impact": "Altered substrate cleavage" }
    },
    "aiAnalysis": {
      "summary": "M146 is located in transmembrane helix 2. The M146L mutation causes a subtle shift in the packing of the helix relative to the active site aspartates. This allosteric change alters the processivity of gamma-secretase, favoring the production of the longer, aggregation-prone Abeta42 peptide.",
      "compensatory_mutations": [
        { "mutation": "L150M", "reasoning": "Restores local volume constraints in the transmembrane helix.", "confidence": 0.45 }
      ]
    }
  },
  "ACTA2-R179H": {
    "variantId": "ACTA2-R179H",
    "cached": true,
    "timestamp": Date.now(),
    "predictions": {
      "native": { "plddt_avg": 96.0, "domains": ["Actin Fold"] },
      "mutant": { "plddt_avg": 92.0, "rmsd_to_native": 1.5, "domains_affected": ["Subdomain 3"] },
      "delta": { "rmsd": 1.5, "confidence_drop": 4.0, "functional_impact": "Polymerization defect" }
    },
    "aiAnalysis": {
      "summary": "R179 is a critical residue in the actin fold. The R179H mutation disrupts the stability of the flattened actin conformation required for polymerization into filaments. This leads to weak smooth muscle contraction and susceptibility to aortic dissection.",
      "compensatory_mutations": [
        { "mutation": "S155A", "reasoning": "Alleviates steric strain in the nucleotide binding cleft.", "confidence": 0.30 }
      ]
    }
  }
};

// UNIPROT mapping for fusions/clinical genes
export const UNIPROT_MAP = {
  'BCR-ABL1': 'P00519',
  'EML4-ALK': 'Q9UM73',
  'SMN1': 'Q16637',
  'CFTR': 'P13569',
  'BRCA1': 'P38398',
  'BRCA2': 'P51587',
  'ABL1': 'P00519',
  'ALK': 'Q9UM73',
  'BCR': 'P11274'
};