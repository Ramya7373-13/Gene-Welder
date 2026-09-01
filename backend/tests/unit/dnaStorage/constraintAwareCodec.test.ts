import { describe, it, expect } from '@jest/globals';
import {
  CONSTRAINT_AWARE_PROFILE,
  encodeConstraintAware,
  decodeConstraintAware,
} from '../../../src/domain/dnaStorage/constraintAwareCodec.js';
import { maxHomopolymerRun } from '../../../src/domain/dnaStorage/analytics.js';
import type { EncodingProfile } from '../../../src/domain/dnaStorage/types.js';

const FIXTURE_TEXT = 'Cheers to Humanity and Longevity.';

describe('constraint-aware codec', () => {
  it('round-trips the fixture exactly with zero errors and redundancy 1', () => {
    const payload = Buffer.from(FIXTURE_TEXT, 'utf-8');
    const strands = encodeConstraintAware(payload, 'exp-1', CONSTRAINT_AWARE_PROFILE);
    const { bytes, warnings } = decodeConstraintAware(strands, CONSTRAINT_AWARE_PROFILE);
    expect(bytes.equals(payload)).toBe(true);
    expect(warnings).toEqual([]);
  });

  it('round-trips with redundancyFactor 2', () => {
    const profile: EncodingProfile = { ...CONSTRAINT_AWARE_PROFILE, redundancyFactor: 2 };
    const payload = Buffer.from(FIXTURE_TEXT.repeat(2), 'utf-8');
    const strands = encodeConstraintAware(payload, 'exp-2', profile);
    const { bytes, warnings } = decodeConstraintAware(strands, profile);
    expect(bytes.equals(payload)).toBe(true);
    expect(warnings).toEqual([]);
  });

  it('avoids homopolymer runs longer than the limit even for constant bytes', () => {
    const profile: EncodingProfile = { ...CONSTRAINT_AWARE_PROFILE, maxPayloadBases: 120 };
    // 0x00 bytes encode to long A-runs in plain quaternary; the codec must escape.
    const payload = Buffer.alloc(64, 0x00);
    const strands = encodeConstraintAware(payload, 'exp-3', profile);
    expect(strands.length).toBeGreaterThan(0);
    for (const strand of strands) {
      const run = maxHomopolymerRun(strand.sequence);
      expect(run).toBeLessThanOrEqual(profile.maxHomopolymerLength);
      expect(strand.metadata.ternaryEscape).toBe(true);
      expect(strand.passedConstraints).toBe(true);
      // Even ternary-escaped strands must respect the per-strand base budget.
      expect(strand.sequence.length).toBeLessThanOrEqual(profile.maxPayloadBases);
    }
    // Round-trip still exact.
    const { bytes } = decodeConstraintAware(strands, profile);
    expect(bytes.equals(payload)).toBe(true);
  });

  it('fills gcPercent, maxHomopolymerRun, and passedConstraints on every strand', () => {
    const payload = Buffer.from(FIXTURE_TEXT, 'utf-8');
    const strands = encodeConstraintAware(payload, 'exp-4', CONSTRAINT_AWARE_PROFILE);
    for (const strand of strands) {
      expect(strand.gcPercent).toBeGreaterThanOrEqual(0);
      expect(strand.gcPercent).toBeLessThanOrEqual(100);
      expect(strand.maxHomopolymerRun).toBeGreaterThanOrEqual(1);
      expect(typeof strand.passedConstraints).toBe('boolean');
      expect(strand.originalChecksum).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('redundancy 2 duplicates the strand set and decode de-duplicates by index', () => {
    const profile: EncodingProfile = { ...CONSTRAINT_AWARE_PROFILE, redundancyFactor: 2 };
    const payload = Buffer.from(FIXTURE_TEXT, 'utf-8');
    const single = encodeConstraintAware(payload, 'exp-5', CONSTRAINT_AWARE_PROFILE);
    const doubled = encodeConstraintAware(payload, 'exp-5', profile);
    expect(doubled.length).toBe(single.length * 2);
    const uniqueIndexes = new Set(doubled.map((s) => s.index));
    expect(uniqueIndexes.size).toBe(single.length);
    const { bytes, warnings } = decodeConstraintAware(doubled, profile);
    expect(bytes.equals(payload)).toBe(true);
    expect(warnings).toEqual([]);
  });

  it('reports checksum mismatch when a strand is corrupted', () => {
    const payload = Buffer.from(FIXTURE_TEXT.repeat(3), 'utf-8');
    const profile: EncodingProfile = { ...CONSTRAINT_AWARE_PROFILE, maxPayloadBases: 100 };
    const strands = encodeConstraintAware(payload, 'exp-6', profile);
    expect(strands.length).toBeGreaterThan(2);
    const corrupted = strands.map((s, i) =>
      i === 0 ? { ...s, originalChecksum: '0'.repeat(64) } : s
    );
    const { warnings } = decodeConstraintAware(corrupted, profile);
    expect(warnings.some((w) => w.includes('checksum mismatch'))).toBe(true);
  });

  it('round-trips an empty payload', () => {
    const strands = encodeConstraintAware(Buffer.alloc(0), 'exp-7', CONSTRAINT_AWARE_PROFILE);
    expect(strands).toHaveLength(1);
    const { bytes } = decodeConstraintAware(strands, CONSTRAINT_AWARE_PROFILE);
    expect(bytes.length).toBe(0);
  });

  it('chunks a larger payload into sequential strands that round-trip', () => {
    const profile: EncodingProfile = { ...CONSTRAINT_AWARE_PROFILE, maxPayloadBases: 100 };
    const payload = Buffer.alloc(512, 0x5a);
    const strands = encodeConstraintAware(payload, 'exp-8', profile);
    expect(strands.length).toBeGreaterThan(1);
    expect(strands.map((s) => s.index)).toEqual(strands.map((_, i) => i));
    const { bytes } = decodeConstraintAware(strands, profile);
    expect(bytes.equals(payload)).toBe(true);
  });
});
