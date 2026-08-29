import { SplicingAnalysisRequest, SplicingAnalysisResult, ExonInfo } from '../../types/splicing';

export class AlphaGenomeClient {
  
  /**
   * Simulates a prediction request to the AlphaGenome Splicing Model.
   */
  async predictSplicingEffect(request: SplicingAnalysisRequest): Promise<SplicingAnalysisResult> {
    // Simulate network latency for realism
    await new Promise(resolve => setTimeout(resolve, 1500));
    return this.getMockData(request.variantId, request.geneId);
  }

  private getMockData(variantId: string, geneId: string): SplicingAnalysisResult {
    const gene = geneId.toUpperCase();
    const variant = variantId;
    
    // Helper to generate realistic scores
    // Strong canonical sites: ~8.0 to 12.0
    // Weak/Skipped sites: -2.0 to 4.0
    const generateScores = (included: boolean) => {
      if (included) {
        return {
          acceptor: Number((8 + Math.random() * 4).toFixed(1)), // 8.0 - 12.0
          donor: Number((8 + Math.random() * 4).toFixed(1))     // 8.0 - 12.0
        };
      }
      return {
        acceptor: Number((Math.random() * 6 - 2).toFixed(1)), // -2.0 - 4.0
        donor: Number((Math.random() * 6 - 2).toFixed(1))     // -2.0 - 4.0
      };
    };

    // Default / Base values
    let exonsAffected: ExonInfo[] = [];
    // Generate 8 generic exons by default
    for (let i = 1; i <= 8; i++) {
        exonsAffected.push({
            exonNumber: i,
            included: true,
            reason: "Canonical splicing",
            coordinates: { start: i * 1000, end: i * 1000 + 150 },
            type: 'CONSTITUTIVE',
            scores: generateScores(true)
        });
    }

    let result: Partial<SplicingAnalysisResult> = {
        analysisId: `sp-${Date.now().toString(16)}`,
        timestamp: new Date().toISOString(),
        gene,
        variant,
        confidence: 85,
        clinicalSeverity: 'UNCERTAIN',
        mRNAImpact: { stabilityChange: 0, totalMRNALevel: 100 },
        proteinImpact: { frameshift: false, truncationPercentage: 0, description: "Full length protein produced" },
        aiInterpretation: `No major splicing anomalies detected for ${variant}.`,
        therapySuitability: {
            antisenseOligonucleotide: { suitable: false, reasoning: "No targetable splice defect found." },
            smallMoleculeSpliceModulator: { suitable: false, reasoning: "Spliceosome assembly appears normal." },
            geneTherapy: { suitable: false, reasoning: "Not indicated for benign variants." }
        }
    };

    // === TEST CASE 1: SMN1 (SMA) ===
    if (gene === 'SMN1' || variant.includes('840+2T>G')) {
        exonsAffected[6] = { // Exon 7 (0-indexed is 6)
            ...exonsAffected[6],
            included: false,
            reason: "Disrupted donor site leads to skipping",
            type: 'ALTERNATIVE',
            scores: { acceptor: 9.2, donor: -4.5 } // Specific bad donor score
        };
        
        result = {
            ...result,
            clinicalSeverity: 'SEVERE',
            confidence: 98,
            exonsAffected,
            mRNAImpact: { stabilityChange: -45, totalMRNALevel: 15 },
            proteinImpact: { 
                frameshift: true, 
                truncationPosition: 234, 
                truncationPercentage: 20, 
                description: "Exon 7 skipping causes unstable protein (SMNdelta7) which is rapidly degraded." 
            },
            aiInterpretation: "CRITICAL FINDING: The c.840+2T>G variant disrupts the canonical 5' splice site of Exon 7. DeepSplicer predicts 100% skipping of Exon 7, resulting in a truncated, unstable protein characteristic of Spinal Muscular Atrophy (SMA).",
            therapySuitability: {
                antisenseOligonucleotide: { 
                    suitable: true, 
                    reasoning: "ASOs (e.g., Nusinersen) can mask the ISS-N1 silencer to promote Exon 7 inclusion.", 
                    candidates: ["Nusinersen (Spinraza)"] 
                },
                smallMoleculeSpliceModulator: { 
                    suitable: true, 
                    reasoning: "Splice modifiers can stabilize the U1 snRNP complex at the weak 5' splice site.", 
                    candidates: ["Risdiplam (Evrysdi)", "Branaplam"] 
                },
                geneTherapy: { 
                    suitable: true, 
                    reasoning: "SMN1 gene replacement is highly effective for loss-of-function.", 
                    candidates: ["Onasemnogene abeparvovec (Zolgensma)"] 
                }
            }
        };
    }
    // === TEST CASE 2: CFTR (Cystic Fibrosis) ===
    else if (gene === 'CFTR') {
        // Case A: Splicing Mutation (c.3849+10kbC>T)
        if (variant.includes('3849+10kb') || variant.includes('Cryptic')) {
             // Create a cryptic exon scenario
             // Insert a pseudo-exon between existing ones
             const crypticExon: ExonInfo = {
                 exonNumber: 99, // Placeholder number for pseudo-exon
                 included: true,
                 reason: "Cryptic splice site activation (Pseudo-exon)",
                 coordinates: { start: 4500, end: 4584 },
                 type: 'ALTERNATIVE',
                 scores: { acceptor: 10.5, donor: 8.9 } // Strong cryptic scores
             };
             // Insert it in the middle array (e.g., between exon 4 and 5)
             const modifiedExons = [...exonsAffected];
             modifiedExons.splice(4, 0, crypticExon);
             
             result = {
                ...result,
                clinicalSeverity: 'SEVERE',
                confidence: 92,
                exonsAffected: modifiedExons,
                mRNAImpact: { stabilityChange: -60, totalMRNALevel: 30 },
                proteinImpact: {
                    frameshift: true,
                    truncationPercentage: 40,
                    description: "Inclusion of 84bp pseudo-exon introduces premature stop codon."
                },
                aiInterpretation: "The c.3849+10kbC>T mutation creates a strong de novo 5' splice site in Intron 19. This leads to the inclusion of a cryptic exon (pseudo-exon) containing a premature termination codon (PTC), triggering NMD.",
                therapySuitability: {
                    antisenseOligonucleotide: { 
                        suitable: true, 
                        reasoning: "ASOs can block the cryptic splice site to restore normal splicing (e.g. Eluforsen).", 
                        candidates: ["Eluforsen (QR-010)"] 
                    },
                    smallMoleculeSpliceModulator: { suitable: false, reasoning: "Standard potentiators do not correct the splicing defect." },
                    geneTherapy: { suitable: true, reasoning: "Full gene replacement restores chloride transport.", candidates: ["Lentiviral CFTR"] }
                }
             };
        }
        // Case B: Folding Mutation (F508del) - Control for splicing
        else if (variant.includes('1521_1523') || variant.includes('F508del')) {
             result = {
                ...result,
                clinicalSeverity: 'SEVERE',
                confidence: 99,
                exonsAffected, // Normal splicing
                mRNAImpact: { stabilityChange: -10, totalMRNALevel: 100 },
                proteinImpact: { 
                    frameshift: false, 
                    truncationPercentage: 0, 
                    description: "Full length but misfolded protein (Class II defect)." 
                },
                aiInterpretation: "Splicing analysis confirms canonical exon usage. The c.1521_1523delCTT (p.F508del) variant primarily affects protein folding and trafficking, not mRNA processing.",
                therapySuitability: {
                    antisenseOligonucleotide: { suitable: false, reasoning: "Defect is post-translational." },
                    smallMoleculeSpliceModulator: { suitable: false, reasoning: "Requires correctors/potentiators (e.g. Trikafta), not splice modulators." },
                    geneTherapy: { suitable: true, reasoning: "Restores functional CFTR expression." }
                }
             };
        }
    }
    // === TEST CASE 3: TP53 (Control) ===
    else if (gene === 'TP53') {
        result.aiInterpretation = "The p.R248Q variant is located in the DNA binding domain. Splicing analysis shows NO disruption of acceptor/donor sites or exonic splicing enhancers (ESEs). The mechanism is strictly missense (protein structure).";
        result.clinicalSeverity = 'BENIGN'; // Benign for *splicing*
        // Defaults apply
    }
    // === PROCEDURAL GENERATION ===
    else {
        // deterministic seed
        let hash = 0;
        const str = gene + variant;
        for (let i = 0; i < str.length; i++) {
             hash = ((hash << 5) - hash) + str.charCodeAt(i);
             hash |= 0;
        }
        const seed = Math.abs(hash);
        
        const isPathogenic = seed % 10 > 5; // 40% chance of splicing defect for unknown variants
        
        if (isPathogenic) {
            const affectedExonIdx = seed % 8;
            exonsAffected[affectedExonIdx].included = false;
            exonsAffected[affectedExonIdx].reason = "Weakened acceptor site score (-2.4)";
            exonsAffected[affectedExonIdx].scores = { acceptor: -2.4, donor: 9.1 }; // Weak acceptor
            
            result = {
                ...result,
                clinicalSeverity: 'MODERATE',
                confidence: 70 + (seed % 20),
                exonsAffected,
                mRNAImpact: { stabilityChange: -30, totalMRNALevel: 60 },
                proteinImpact: { 
                    frameshift: true, 
                    truncationPercentage: 100 - (affectedExonIdx * 12), 
                    description: `Skipping of Exon ${affectedExonIdx + 1} induces frameshift.` 
                },
                aiInterpretation: `Simulation: Variant predicted to reduce splicing efficiency of Exon ${affectedExonIdx + 1} by ~60% due to branch point displacement.`,
                therapySuitability: {
                    antisenseOligonucleotide: { suitable: true, reasoning: "Potential to block cryptic splice site.", candidates: ["Custom ASO"] },
                    smallMoleculeSpliceModulator: { suitable: false, reasoning: "Target too specific." },
                    geneTherapy: { suitable: false, reasoning: "Not first line." }
                }
            };
        } else {
             result.aiInterpretation = `Simulation: Variant ${variant} does not significantly alter splice site strength or local motif density. Predicted to be splice-neutral.`;
        }
    }

    return result as SplicingAnalysisResult;
  }
}

export const alphaGenomeClient = new AlphaGenomeClient();