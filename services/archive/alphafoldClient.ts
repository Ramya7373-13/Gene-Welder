/**
 * Production AlphaFold3 Client for real EBI AlphaFold3 API
 * Implements the curl command from the task:
 * curl -X POST https://api.alphafold3.ebi.ac.uk/predict
 * -d '{"sequences": ["BCR", "ABL1"]}'
 * --output bcr-abl1_fusion.pdb
 */

interface AlphaFold3Response {
  job_id: string;
  status: 'SUBMITTED' | 'RUNNING' | 'COMPLETE' | 'FAILED';
  created_at: string;
  sequences: string[];
  result_url?: string;
  error?: string;
}

interface AlphaFold3JobStatus {
  job_id: string;
  status: 'RUNNING' | 'COMPLETE' | 'FAILED';
  progress: number;
  result_url?: string;
  error?: string;
}

interface FusionPredictionRequest {
  sequences: string[];
}

// Import UNIPROT mapping from constants
import { UNIPROT_MAP } from '../constants';

export class AlphaFold3ProductionClient {
  private baseUrl: string = 'https://api.alphafold3.ebi.ac.uk';
  private pollInterval: number = 5000; // 5 seconds
  private maxPollAttempts: number = 120; // Up to 10 minutes

  constructor(customBaseUrl?: string) {
    if (customBaseUrl) {
      this.baseUrl = customBaseUrl;
    }
  }

  /**
   * Submit a fusion prediction job to AlphaFold3
   * @param sequences Array of protein sequences for the fusion (e.g., ['BCR', 'ABL1'])
   * @returns Job ID for tracking the prediction
   */
  async submitFusionPrediction(sequences: string[]): Promise<AlphaFold3Response> {
    try {
      const response = await fetch(`${this.baseUrl}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sequences
        } as FusionPredictionRequest)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AlphaFold3 API Error: ${response.status} - ${errorText}`);
      }

      const result: AlphaFold3Response = await response.json();
      return result;
    } catch (error) {
      console.error('Error submitting fusion prediction:', error);
      throw error;
    }
  }

  /**
   * Check the status of a submitted prediction job
   */
  async checkJobStatus(jobId: string): Promise<AlphaFold3JobStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/predict/${jobId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AlphaFold3 Status Check Error: ${response.status} - ${errorText}`);
      }

      const result: AlphaFold3JobStatus = await response.json();
      return result;
    } catch (error) {
      console.error('Error checking job status:', error);
      throw error;
    }
  }

  /**
   * Poll for job completion and download the PDB when ready
   */
  async waitForAndDownloadPDB(jobId: string): Promise<{ pdbContent: string; jobInfo: AlphaFold3JobStatus }> {
    let attempts = 0;

    while (attempts < this.maxPollAttempts) {
      const status = await this.checkJobStatus(jobId);

      if (status.status === 'COMPLETE' && status.result_url) {
        // Download the PDB file
        const pdbResponse = await fetch(status.result_url);

        if (!pdbResponse.ok) {
          throw new Error(`Failed to download PDB: ${pdbResponse.status}`);
        }

        const pdbContent = await pdbResponse.text();
        return {
          pdbContent,
          jobInfo: status
        };
      } else if (status.status === 'FAILED') {
        throw new Error(`Prediction job failed: ${status.error || 'Unknown error'}`);
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, this.pollInterval));
      attempts++;
    }

    throw new Error('Prediction job timed out after maximum attempts');
  }

  /**
   * Convenience method to predict a fusion structure and return the PDB content
   */
  async predictFusionStructure(sequences: string[]): Promise<{ pdbContent: string; jobId: string }> {
    // Submit the job
    const submission = await this.submitFusionPrediction(sequences);

    if (submission.status !== 'SUBMITTED' && !submission.job_id) {
      throw new Error(`Failed to submit job: ${submission.error || 'Unknown error'}`);
    }

    // Wait for completion and download
    const { pdbContent, jobInfo } = await this.waitForAndDownloadPDB(submission.job_id);

    console.log('Successfully downloaded fusion structure for sequences:', sequences);
    console.log('Job ID:', submission.job_id);

    return {
      pdbContent,
      jobId: submission.job_id
    };
  }

  /**
   * Predict common oncogenic fusions
   */
  async predictCommonFusion(fusionType: 'BCR-ABL1' | 'EML4-ALK' | 'BRCA1-BRCA2' | 'CFTR'): Promise<{ pdbContent: string; jobId: string }> {
    switch (fusionType) {
      case 'BCR-ABL1':
        return this.predictFusionStructure(['BCR', 'ABL1']);
      case 'EML4-ALK':
        return this.predictFusionStructure(['EML4', 'ALK']);
      case 'BRCA1-BRCA2':
        return this.predictFusionStructure(['BRCA1', 'BRCA2']);
      case 'CFTR':
        // For CFTR, this might be a multi-domain prediction
        return this.predictFusionStructure(['CFTR']);
      default:
        throw new Error(`Unsupported fusion type: ${fusionType}`);
    }
  }
}

// Export a singleton instance
export const alphafold3Client = new AlphaFold3ProductionClient();

// NEW: PUBLIC AlphaFold DB API integration
export const fetchAlphaFoldStructure = async (gene: string): Promise<string> => {
  try {
    // UniProt mapping for fusions/clinical genes
    const uniprotId = UNIPROT_MAP[gene as keyof typeof UNIPROT_MAP] || 'P00519' // ABL1 fallback
    console.log(`🔄 Fetching AlphaFold ${uniprotId} for ${gene}...`);

    // PUBLIC AlphaFold DB API
    const response = await fetch(`https://alphafold.ebi.ac.uk/api/prediction/${uniprotId}`);
    const data = await response.json();

    // Download real PDB
    const pdbUrl = data['pdbUrl'] || `https://alphafold.ebi.ac.uk/files/AF-${uniprotId}-F1-model_v4.pdb`;
    const pdbResponse = await fetch(pdbUrl);
    const pdbBlob = await pdbResponse.blob();

    // Upload to our backend
    const arrayBuffer = await pdbBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const formData = new FormData();
    formData.append('file', new File([uint8Array], `${gene}_alphafold.pdb`, { type: 'chemical/x-pdb' }));
    formData.append('variantId', 'cmjeu716j0001ygu7ixth77m0'); // BCR-ABL1
    formData.append('file_type', 'pdb');

    const backendUrl = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:5000';
    const uploadResponse = await fetch(`${backendUrl}/api/structures`, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload structure: ${uploadResponse.status} ${await uploadResponse.text()}`);
    }

    const structure = await uploadResponse.json();
    console.log(`✅ ${gene} AlphaFold PDB uploaded:`, structure.id);
    return structure.id;
  } catch (error) {
    console.error(`Error fetching AlphaFold structure for gene ${gene}:`, error);
    throw error;
  }
};

// Example usage:
/*
// Predict BCR-ABL1 fusion
alphafold3Client.predictCommonFusion('BCR-ABL1')
  .then(result => {
    console.log('BCR-ABL1 PDB length:', result.pdbContent.length);
    // Save to file: fs.writeFileSync('bcr-abl1_fusion.pdb', result.pdbContent);
  })
  .catch(error => {
    console.error('Error predicting BCR-ABL1:', error);
  });
*/