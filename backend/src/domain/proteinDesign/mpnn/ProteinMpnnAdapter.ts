// ProteinMPNN Adapter Interface - Sequence design for generated structures.
// Phase 1: Interface only, no real execution.

import type { DesignCandidate } from '../types/index.js';

export interface ProteinMpnnResult {
  sequence: string;
  score: number;
  confidence: number;
  positionScores: number[];
}

export interface ProteinMpnnAdapter {
  designSequence(structure: string, options?: SequenceDesignOptions): Promise<ProteinMpnnResult[]>;
  /** Phase D named capability; aliases designSequence on implementers. */
  sequenceDesign(structure: string, options?: SequenceDesignOptions): Promise<ProteinMpnnResult[]>;
  isAvailable(): Promise<boolean>;
  getModelInfo(): { version: string; weightsHash: string };
}

export interface SequenceDesignOptions {
  numSequences?: number;
  temperature?: number;
  fixedPositions?: { chain: string; position: number }[];
  seed?: number;
}

/**
 * Mock ProteinMPNN adapter - returns sequences designed for stability.
 */
export class MockProteinMpnnAdapter implements ProteinMpnnAdapter {
  private readonly mockVersion = 'proteinmpnn-mock-v1.0.0';
  private readonly mockWeightsHash = 'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';

  async designSequence(
    structure: string,
    options?: SequenceDesignOptions,
  ): Promise<ProteinMpnnResult[]> {
    return this.sequenceDesign(structure, options);
  }

  async sequenceDesign(
    structure: string,
    options?: SequenceDesignOptions,
  ): Promise<ProteinMpnnResult[]> {
    const numSeqs = options?.numSequences ?? 8;
    const results: ProteinMpnnResult[] = [];

    for (let i = 0; i < numSeqs; i++) {
      const length = 10 + Math.floor(Math.random() * 100);
      const sequence = Array.from({ length }, () =>
        'ACDEFGHIKLMNPQRSTVWY'[Math.floor(Math.random() * 20)],
      ).join('');

      results.push({
        sequence,
        score: 0.6 + Math.random() * 0.35,
        confidence: 0.75 + Math.random() * 0.2,
        positionScores: Array.from({ length }, () => 0.7 + Math.random() * 0.3),
      });
    }

    return results;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getModelInfo(): { version: string; weightsHash: string } {
    return {
      version: this.mockVersion,
      weightsHash: this.mockWeightsHash,
    };
  }
}
