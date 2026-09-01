import { describe, it, expect } from '@jest/globals';
import { createSeededRandom, PRNG_NAME } from '../../../src/domain/dnaStorage/prng.js';

describe('seeded PRNG', () => {
  it('produces identical sequences for identical seeds', () => {
    const a = createSeededRandom(42), b = createSeededRandom(42);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createSeededRandom(1), b = createSeededRandom(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('returns values in [0, 1)', () => {
    const r = createSeededRandom(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(maxExclusive) stays in range and pick returns a member', () => {
    const r = createSeededRandom(9);
    expect(r.int(5)).toBeLessThan(5);
    expect(r.int(5)).toBeGreaterThanOrEqual(0);
    expect([1, 2, 3]).toContain(r.pick([1, 2, 3]));
  });

  it('exports its algorithm name for reproducibility records', () => {
    expect(PRNG_NAME).toBe('mulberry32');
  });
});
