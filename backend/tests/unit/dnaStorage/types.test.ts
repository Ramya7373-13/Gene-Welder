import { describe, it, expect } from '@jest/globals';
import {
  PRNG_NAME,
  PRNG_VERSION,
  type EncodingProfile,
  type ErrorProfile,
  type DnaStrand,
  type DecodeResult,
  type DnaBase,
} from '../../../src/domain/dnaStorage/types.js';

describe('dnaStorage domain types', () => {
  it('exports the PRNG identity used for reproducibility records', () => {
    expect(PRNG_NAME).toBe('mulberry32');
    expect(PRNG_VERSION).toBe('1.0.0');
  });

  it('accepts a fully-populated EncodingProfile', () => {
    const profile: EncodingProfile = {
      id: 'learning',
      name: 'Learning mode',
      description: 'Deterministic 2-bit mapping for teaching',
      mode: 'learning',
      maxPayloadBases: 200,
      maxHomopolymerLength: 4,
      minGcPercent: 40,
      maxGcPercent: 60,
      redundancyFactor: 1,
      checksumAlgorithm: 'sha256',
    };
    expect(profile.mode).toBe('learning');
    expect(profile.checksumAlgorithm).toBe('sha256');
  });

  it('accepts a fully-populated ErrorProfile and DnaStrand', () => {
    const errorProfile: ErrorProfile = {
      id: 'low',
      label: 'Low channel error',
      substitutionRate: 0.001,
      insertionRate: 0,
      deletionRate: 0,
      strandDropoutRate: 0.01,
      duplicationRate: 0,
      coverageDepth: 1,
      seed: 42,
    };
    expect(errorProfile.seed).toBe(42);

    const strand: DnaStrand = {
      id: 'strand-1',
      experimentId: 'exp-1',
      index: 0,
      sequence: 'ACGT',
      payloadLength: 4,
      originalChecksum: 'abc123',
      gcPercent: 50,
      maxHomopolymerRun: 1,
      passedConstraints: true,
      metadata: { chunk: 0 },
    };
    expect(strand.sequence).toBe('ACGT');
  });

  it('accepts a fully-populated DecodeResult', () => {
    const result: DecodeResult = {
      success: true,
      recoveredChecksum: 'abc123',
      expectedChecksum: 'abc123',
      recoveredBytes: 33,
      missingStrands: 0,
      corruptedStrands: 0,
      correctedStrands: 0,
      uncorrectableStrands: 0,
      bitErrorRate: 0,
      message: 'Recovered',
      warnings: [],
    };
    expect(result.success).toBe(true);
  });

  it('DnaBase is restricted to A, C, G, T', () => {
    const bases: DnaBase[] = ['A', 'C', 'G', 'T'];
    expect(bases).toHaveLength(4);
  });
});
