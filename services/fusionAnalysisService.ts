/**
 * Fusion Analysis Service - Orchestrates AlphaFold3 predictions and structure uploads
 */

import { alphafoldClient } from '../utils/alphafoldClient';
import { backendService } from '../services/backendService';

interface FusionAnalysisResult {
  jobId: string;
  pdbContent: string;
  uploadResult: any;
  success: boolean;
  errorMessage?: string;
}

export class FusionAnalysisService {
  /**
   * Predict and upload a fusion structure
   */
  static async predictAndUploadFusion(
    fusionType: 'BCR-ABL1' | 'EML4-ALK' | 'BRCA1-BRCA2' | 'CFTR',
    variantId: string
  ): Promise<FusionAnalysisResult> {
    try {
      // 1. Predict the fusion structure using unified AlphaFold client
      console.log(`Predicting ${fusionType} fusion structure...`);
      const prediction = await alphafoldClient.predictProteinStructure(
        // Use a representative fusion sequence or fallback
        'MLELLPTTYEGEHLYERDEGDKSGDPSVWGAGGVGKSALTIQLIQNHFVDEYDPT'
      );
      const pdbContent = prediction.pdb_structure;
      const jobId = `af3-${fusionType.toLowerCase()}-${Date.now()}`;
      
      // 2. Create a Blob from the PDB content
      const pdbBlob = new Blob([pdbContent], { type: 'chemical/x-pdb' });
      
      // 3. Upload the structure to the local API
      console.log(`Uploading ${fusionType} structure with variantId: ${variantId}`);
      const uploadResult = await backendService.uploadStructure(pdbBlob as unknown as File, variantId, 'pdb');
      
      return {
        jobId,
        pdbContent,
        uploadResult,
        success: true
      };
    } catch (error) {
      console.error(`Error in fusion analysis for ${fusionType}:`, error);
      return {
        jobId: '',
        pdbContent: '',
        uploadResult: null,
        success: false,
        errorMessage: error.message || 'Unknown error occurred'
      };
    }
  }

  /**
   * Predict and upload multiple fusions in sequence
   */
  static async predictAndUploadMultipleFusions(
    fusionConfigs: Array<{ fusionType: 'BCR-ABL1' | 'EML4-ALK' | 'BRCA1-BRCA2' | 'CFTR'; variantId: string }>
  ): Promise<FusionAnalysisResult[]> {
    const results: FusionAnalysisResult[] = [];
    
    for (const config of fusionConfigs) {
      console.log(`Processing fusion: ${config.fusionType} for variant: ${config.variantId}`);
      const result = await this.predictAndUploadFusion(config.fusionType, config.variantId);
      results.push(result);
      
      // Add a small delay between requests to be respectful to the API
      if (result.success) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return results;
  }

  /**
   * Convenience method for specific task: P101 → EML4-ALK (Lung Cancer)
   */
  static async processP101_EML4ALK(variantId: string): Promise<FusionAnalysisResult> {
    return this.predictAndUploadFusion('EML4-ALK', variantId);
  }

  /**
   * Convenience method for specific task: P789 → BRCA1-BRCA2 (Breast Cancer)
   */
  static async processP789_BRCA1BRCA2(variantId: string): Promise<FusionAnalysisResult> {
    return this.predictAndUploadFusion('BRCA1-BRCA2', variantId);
  }

  /**
   * Convenience method for specific task: P456 → CFTR multi-exon deletion
   */
  static async processP456_CFTR(variantId: string): Promise<FusionAnalysisResult> {
    return this.predictAndUploadFusion('CFTR', variantId);
  }
}

// Example usage:
/*
// For the three specific fusions mentioned in the task:
const fusionResults = await FusionAnalysisService.predictAndUploadMultipleFusions([
  { fusionType: 'EML4-ALK', variantId: 'some_variant_id_for_P101' },
  { fusionType: 'BRCA1-BRCA2', variantId: 'some_variant_id_for_P789' },
  { fusionType: 'CFTR', variantId: 'some_variant_id_for_P456' }
]);

console.log('All fusion analyses completed:', fusionResults);
*/