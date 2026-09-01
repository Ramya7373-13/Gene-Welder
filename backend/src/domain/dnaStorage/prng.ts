import { PRNG_NAME, PRNG_VERSION, type SeededRandom } from './types.js';

export { PRNG_NAME, PRNG_VERSION };

/**
 * Deterministic seeded PRNG (mulberry32, public-domain algorithm).
 * Reproducibility contract: the same seed produces the identical sequence of
 * values across runs. PRNG_NAME/PRNG_VERSION are persisted on experiment
 * records so simulations can be re-run bit-identically later.
 */
export function createSeededRandom(seed: number): SeededRandom {
  // Force seed to a signed 32-bit integer so string/float seeds normalize deterministically.
  let state = seed | 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(maxExclusive: number): number {
      return Math.floor(next() * maxExclusive);
    },
    pick<T>(items: readonly T[]): T {
      return items[Math.floor(next() * items.length)];
    },
  };
}
