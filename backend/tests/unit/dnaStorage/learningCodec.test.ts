import { describe, it, expect } from '@jest/globals';
import {
  LEARNING_PROFILE,
  encodeLearning,
  decodeLearning,
  assertDnaSequence,
} from '../../../src/domain/dnaStorage/learningCodec.js';
import type { EncodingProfile } from '../../../src/domain/dnaStorage/types.js';
import { gcPercent, maxHomopolymerRun } from '../../../src/domain/dnaStorage/analytics.js';

const FIXTURE_TEXT = 'Cheers to Humanity and Longevity.';

describe('learning codec (2-bit mapping)', () => {
  it('round-trips the fixture exactly with zero errors', () => {
    const payload = Buffer.from(FIXTURE_TEXT, 'utf-8');
    const strands = encodeLearning(payload, 'exp-1', LEARNING_PROFILE);
    const { bytes, warnings } = decodeLearning(strands, LEARNING_PROFILE);
    expect(bytes.equals(payload)).toBe(true);
    expect(warnings).toEqual([]);
  });

  it('maps byte 0b00011011 to the base run ACGT (00→A, 01→C, 10→G, 11→T)', () => {
    const payload = Buffer.from([0b00011011]);
    const strands = encodeLearning(payload, 'exp-2', LEARNING_PROFILE);
    // The 4-byte index header occupies the first 16 bases; the payload section is ACGT.
    expect(strands[0].sequence.slice(16, 20)).toBe('ACGT');
  });

  it('rejects invalid bases via assertDnaSequence', () => {
    expect(() => assertDnaSequence('ACGX')).toThrow(/Invalid DNA base/);
    expect(() => assertDnaSequence('acgt')).toThrow(/Invalid DNA base/);
    expect(() => assertDnaSequence('ACGT')).not.toThrow();
    expect(() => assertDnaSequence('')).not.toThrow();
  });

  it('chunks a 1 KB payload into multiple strands with sequential indexes', () => {
    const profile: EncodingProfile = { ...LEARNING_PROFILE, maxPayloadBases: 100 };
    const payload = Buffer.alloc(1024, 7);
    const strands = encodeLearning(payload, 'exp-3', profile);
    expect(strands.length).toBeGreaterThan(1);
    expect(strands.map((s) => s.index)).toEqual(strands.map((_, i) => i));
    // Round-trip must still be exact across chunks.
    const { bytes } = decodeLearning(strands, profile);
    expect(bytes.equals(payload)).toBe(true);
  });

  it('is deterministic: same payload encodes to identical sequences', () => {
    const payload = Buffer.from(FIXTURE_TEXT, 'utf-8');
    const a = encodeLearning(payload, 'exp-4', LEARNING_PROFILE);
    const b = encodeLearning(payload, 'exp-4', LEARNING_PROFILE);
    expect(a.map((s) => s.sequence)).toEqual(b.map((s) => s.sequence));
  });

  it('fills strand constraint fields and reports them honestly (the visible header can violate the limit)', () => {
    const payload = Buffer.from(FIXTURE_TEXT, 'utf-8');
    const strands = encodeLearning(payload, 'exp-5', LEARNING_PROFILE);
    for (const strand of strands) {
      expect(strand.gcPercent).toBeGreaterThanOrEqual(0);
      expect(strand.gcPercent).toBeLessThanOrEqual(100);
      expect(strand.maxHomopolymerRun).toBe(maxHomopolymerRun(strand.sequence));
      expect(strand.originalChecksum).toMatch(/^[0-9a-f]{64}$/);
      // Learning mode uses a plain, visible 2-bit header: a zero strand index is
      // sixteen A's in a row, so the honest constraint verdict for strand 0 is
      // false. That visible violation is the teaching motivation for
      // constraint-aware mode.
      expect(strand.passedConstraints).toBe(
        maxHomopolymerRun(strand.sequence) <= LEARNING_PROFILE.maxHomopolymerLength &&
          strand.gcPercent >= LEARNING_PROFILE.minGcPercent &&
          strand.gcPercent <= LEARNING_PROFILE.maxGcPercent
      );
      expect(strands[0].passedConstraints).toBe(false);
    }
  });

  it('round-trips an empty payload without error', () => {
    const strands = encodeLearning(Buffer.alloc(0), 'exp-6', LEARNING_PROFILE);
    expect(strands).toHaveLength(1);
    const { bytes } = decodeLearning(strands, LEARNING_PROFILE);
    expect(bytes.length).toBe(0);
  });

  it('warns on missing and corrupted strands instead of throwing', () => {
    const payload = Buffer.from(FIXTURE_TEXT.repeat(3), 'utf-8');
    const profile: EncodingProfile = { ...LEARNING_PROFILE, maxPayloadBases: 100 };
    const strands = encodeLearning(payload, 'exp-7', profile);
    expect(strands.length).toBeGreaterThan(2);
    const damaged = strands
      .slice(0, strands.length - 1) // drop the last strand
      .map((s, i) =>
        i === 0
          ? { ...s, originalChecksum: '0'.repeat(64) } // corrupt checksum on first strand
          : s
      );
    const { warnings } = decodeLearning(damaged, profile);
    expect(warnings.some((w) => w.includes('checksum mismatch'))).toBe(true);
    expect(warnings.some((w) => w.includes('Missing strand'))).toBe(true);
  });
});
