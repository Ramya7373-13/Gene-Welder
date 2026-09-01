import { describe, it, expect } from '@jest/globals';
import { decodeExperiment, buildArtifacts } from '../../../src/domain/dnaStorage/decoder.js';
import { encodeLearning, LEARNING_PROFILE } from '../../../src/domain/dnaStorage/learningCodec.js';
import { encodeConstraintAware, CONSTRAINT_AWARE_PROFILE } from '../../../src/domain/dnaStorage/constraintAwareCodec.js';
import { ZERO_ERROR_PROFILE } from '../../../src/domain/dnaStorage/errorSimulator.js';
import type { ErrorProfile, EncodingProfile } from '../../../src/domain/dnaStorage/types.js';
import crypto from 'crypto';

const FIXTURE_TEXT = 'Cheers to Humanity and Longevity.';

function profile(overrides: Partial<ErrorProfile>): ErrorProfile {
  return { ...ZERO_ERROR_PROFILE, id: 'test', label: 'test', seed: 42, ...overrides };
}

describe('decode orchestration', () => {
  it('zero errors: recovers exact bytes and matching checksum (DoD #3)', () => {
    const payload = Buffer.from(FIXTURE_TEXT, 'utf-8');
    const strands = encodeLearning(payload, 'exp-1', LEARNING_PROFILE);
    const { result } = decodeExperiment(buildArtifacts(payload, strands), LEARNING_PROFILE);
    expect(result.success).toBe(true);
    expect(result.recoveredChecksum).toBe(crypto.createHash('sha256').update(payload).digest('hex'));
    expect(result.recoveredBytes).toBe(payload.length);
    expect(result.missingStrands).toBe(0);
  });

  it('low errors with redundancy 2: at least one seeded case recovers fully (DoD #4)', () => {
    const payload = Buffer.from(FIXTURE_TEXT.repeat(4), 'utf-8');
    const caProfile: EncodingProfile = { ...CONSTRAINT_AWARE_PROFILE, redundancyFactor: 2 };
    const strands = encodeConstraintAware(payload, 'exp-2', caProfile);
    // Recovery math (checksum-only error detection, no ECC in Phase 1): a copy
    // is usable when it survives dropout (0.8) and takes no substitution across
    // its ~150 bases (0.999^150 ≈ 0.86), so ~0.69 per copy; with 2 copies an
    // index is recoverable ~90% of the time; across the 6 chunks one seed
    // recovers ~54% of the time — over 20 seeds at least one recovery is
    // essentially certain, which is what DoD #4 asserts.
    let recovered = false;
    for (let seed = 1; seed <= 20 && !recovered; seed++) {
      const { result } = decodeExperiment(
        buildArtifacts(payload, strands),
        caProfile,
        profile({ substitutionRate: 0.001, strandDropoutRate: 0.2, seed })
      );
      recovered = result.success;
    }
    expect(recovered).toBe(true);
  });

  it('total dropout: fails gracefully with an explanatory warning (DoD #5)', () => {
    const payload = Buffer.from(FIXTURE_TEXT, 'utf-8');
    const strands = encodeLearning(payload, 'exp-3', LEARNING_PROFILE);
    const { result } = decodeExperiment(
      buildArtifacts(payload, strands),
      LEARNING_PROFILE,
      profile({ strandDropoutRate: 1 })
    );
    expect(result.success).toBe(false);
    expect(result.missingStrands).toBe(strands.length);
    expect(result.warnings.some((w) => w.includes('dropout'))).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('dropout exceeding redundancy fails gracefully and names the cause (spec: expected failure when dropout exceeds redundancy)', () => {
    const payload = Buffer.from(FIXTURE_TEXT.repeat(4), 'utf-8');
    const caProfile: EncodingProfile = { ...CONSTRAINT_AWARE_PROFILE, redundancyFactor: 2, maxPayloadBases: 100 };
    const strands = encodeConstraintAware(payload, 'exp-dropout', caProfile);
    // Dropout above the redundancy factor: with 2 copies per strand, a 0.9
    // dropout rate loses nearly every copy of nearly every strand.
    const { result } = decodeExperiment(
      buildArtifacts(payload, strands),
      caProfile,
      profile({ strandDropoutRate: 0.9, seed: 11 })
    );
    expect(result.success).toBe(false);
    expect(result.missingStrands).toBeGreaterThan(0);
    expect(result.warnings.some((w) => /dropout|redundancy/i.test(w))).toBe(true);
  });

  it('counts corrupted strands when the channel damages sequences', () => {
    const payload = Buffer.from(FIXTURE_TEXT, 'utf-8');
    const strands = encodeLearning(payload, 'exp-4', LEARNING_PROFILE);
    const { result } = decodeExperiment(
      buildArtifacts(payload, strands),
      LEARNING_PROFILE,
      profile({ substitutionRate: 0.2 })
    );
    expect(result.corruptedStrands + result.uncorrectableStrands).toBeGreaterThan(0);
    expect(result.success).toBe(false);
  });

  it('empty payload with zero errors succeeds', () => {
    const payload = Buffer.alloc(0);
    const strands = encodeLearning(payload, 'exp-5', LEARNING_PROFILE);
    const { result } = decodeExperiment(buildArtifacts(payload, strands), LEARNING_PROFILE);
    expect(result.success).toBe(true);
    expect(result.recoveredBytes).toBe(0);
  });
});
