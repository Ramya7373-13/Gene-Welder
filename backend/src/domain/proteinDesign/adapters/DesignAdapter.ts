// Abstract adapter interface for protein design inference engines.
// This follows the adapter pattern so we can swap RFD3, RFD2, or mock implementations.

import type {
  DesignRunRequest,
  DesignCandidate,
  DesignMode,
  Rfd3Conditioning,
  Rfd3Parameters,
  ResiduePosition,
} from '../types/index.js';

/**
 * Result from a design generation request.
 * Contains candidates and provenance metadata.
 */
export interface DesignGenerationResult {
  runId: string;
  candidates: DesignCandidate[];
  modelVersion: string;
  weightsHash: string;
  seed: number;
  executionTimeMs: number;
}

/**
 * Abstract adapter interface for inference engines.
 * Implementations: RFDiffusion3Adapter, MockDesignAdapter.
 */
export interface DesignAdapter {
  /**
   * Generate binder designs for a target structure.
   */
  generateBinder(request: DesignRunRequest): Promise<DesignGenerationResult>;

  /**
   * Generate stabilizers for a variant target.
   */
  generateStabilizer(request: DesignRunRequest): Promise<DesignGenerationResult>;

  /**
   * Generate DNA-binding proteins for sequence-specific targeting.
   */
  generateDnaBinder(request: DesignRunRequest): Promise<DesignGenerationResult>;

  /**
   * Generate de novo protein scaffolds.
   */
  generateScaffold(request: DesignRunRequest): Promise<DesignGenerationResult>;

  /**
   * Generate symmetric assemblies (cages, rings, filaments).
   */
  generateSymmetricAssembly(request: DesignRunRequest): Promise<DesignGenerationResult>;

  /**
   * Generate motif scaffolds preserving functional motifs.
   */
  generateMotifScaffold(request: DesignRunRequest): Promise<DesignGenerationResult>;

  /**
   * Check if the adapter is available (model weights loaded, GPU accessible).
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the model version and weights hash for provenance tracking.
   */
  getModelInfo(): { version: string; weightsHash: string };
}
