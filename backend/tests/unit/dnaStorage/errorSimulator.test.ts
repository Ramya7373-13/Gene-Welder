import { describe, it, expect } from '@jest/globals';
import { simulateChannelErrors, ZERO_ERROR_PROFILE } from '../../../src/domain/dnaStorage/errorSimulator.js';
import { encodeLearning, LEARNING_PROFILE } from '../../../src/domain/dnaStorage/learningCodec.js';
import type { DnaStrand, ErrorProfile } from '../../../src/domain/dnaStorage/types.js';

const FIXTURE_TEXT = 'Cheers to Humanity and Longevity.';

function makeStrands(): DnaStrand[] {
  return encodeLearning(Buffer.from(FIXTURE_TEXT, 'utf-8'), 'exp-1', LEARNING_PROFILE);
}

function profile(overrides: Partial<ErrorProfile>): ErrorProfile {
  return { ...ZERO_ERROR_PROFILE, id: 'test', label: 'test', seed: 42, ...overrides };
}

describe('deterministic error simulator', () => {
  it('returns strands unchanged for a zero-rate profile', () => {
    const strands = makeStrands();
    const { noisyStrands, stats } = simulateChannelErrors(strands, ZERO_ERROR_PROFILE);
    expect(noisyStrands.map((s) => s.sequence)).toEqual(strands.map((s) => s.sequence));
    expect(stats).toEqual({ dropped: 0, duplicated: 0, substituted: 0, inserted: 0, deleted: 0 });
  });

  it('is deterministic: identical seed produces identical noisy output across independent runs', () => {
    const strands = makeStrands();
    const p = profile({ substitutionRate: 0.1, deletionRate: 0.05, insertionRate: 0.05 });
    const runA = simulateChannelErrors(strands, p);
    const runB = simulateChannelErrors(strands, p);
    expect(runA.noisyStrands.map((s) => s.sequence)).toEqual(runB.noisyStrands.map((s) => s.sequence));
    expect(runA.stats).toEqual(runB.stats);
  });

  it('produces different output for a different seed', () => {
    const strands = makeStrands();
    const a = simulateChannelErrors(strands, profile({ substitutionRate: 0.5, seed: 1 }));
    const b = simulateChannelErrors(strands, profile({ substitutionRate: 0.5, seed: 2 }));
    expect(a.noisyStrands.map((s) => s.sequence)).not.toEqual(b.noisyStrands.map((s) => s.sequence));
  });

  it('substitutionRate 1 changes every base but preserves length', () => {
    const strands = makeStrands();
    const { noisyStrands, stats } = simulateChannelErrors(strands, profile({ substitutionRate: 1 }));
    expect(strands).toHaveLength(noisyStrands.length);
    let changed = 0;
    for (let i = 0; i < strands.length; i++) {
      expect(noisyStrands[i].sequence.length).toBe(strands[i].sequence.length);
      for (let j = 0; j < strands[i].sequence.length; j++) {
        if (noisyStrands[i].sequence[j] !== strands[i].sequence[j]) changed++;
      }
    }
    expect(changed).toBe(strands.reduce((n, s) => n + s.sequence.length, 0));
    expect(stats.substituted).toBe(changed);
    expect(stats.deleted).toBe(0);
    expect(stats.inserted).toBe(0);
  });

  it('small deletion and insertion rates change lengths and are counted', () => {
    const strands = makeStrands();
    const { noisyStrands, stats } = simulateChannelErrors(
      strands,
      profile({ deletionRate: 0.1, insertionRate: 0.1 })
    );
    expect(stats.deleted).toBeGreaterThan(0);
    expect(stats.inserted).toBeGreaterThan(0);
    const totalOriginal = strands.reduce((n, s) => n + s.sequence.length, 0);
    const totalNoisy = noisyStrands.reduce((n, s) => n + s.sequence.length, 0);
    expect(totalNoisy).not.toBe(totalOriginal);
  });

  it('strandDropoutRate 1 drops all strands', () => {
    const strands = makeStrands();
    const { noisyStrands, stats } = simulateChannelErrors(strands, profile({ strandDropoutRate: 1 }));
    expect(noisyStrands).toEqual([]);
    expect(stats.dropped).toBe(strands.length);
  });

  it('strandDropoutRate 0.5 drops roughly half the strands', () => {
    const strands = makeStrands();
    const many: DnaStrand[] = [];
    for (let i = 0; i < 20; i++) {
      many.push(...encodeLearning(Buffer.from(FIXTURE_TEXT + i, 'utf-8'), `exp-${i}`, LEARNING_PROFILE).map((s) => ({ ...s })));
    }
    const { stats } = simulateChannelErrors(many, profile({ strandDropoutRate: 0.5 }));
    expect(stats.dropped).toBeGreaterThan(0);
    expect(stats.dropped).toBeLessThan(many.length);
  });

  it('duplication produces extra strand copies with the same index', () => {
    const strands = makeStrands();
    const { noisyStrands, stats } = simulateChannelErrors(strands, profile({ duplicationRate: 1 }));
    expect(stats.duplicated).toBe(strands.length);
    expect(noisyStrands.length).toBe(strands.length * 2);
    const indexes = noisyStrands.map((s) => s.index).sort();
    expect(indexes).toEqual([...strands.map((s) => s.index), ...strands.map((s) => s.index)].sort());
  });

  it('coverageDepth 3 yields at least 3 reads per surviving strand', () => {
    const strands = makeStrands();
    const { noisyStrands } = simulateChannelErrors(strands, profile({ coverageDepth: 3 }));
    expect(noisyStrands.length).toBeGreaterThanOrEqual(strands.length * 3);
    const readsByIndex = new Map<number, number>();
    for (const s of noisyStrands) {
      readsByIndex.set(s.index, (readsByIndex.get(s.index) ?? 0) + 1);
    }
    for (const count of readsByIndex.values()) {
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });
});
