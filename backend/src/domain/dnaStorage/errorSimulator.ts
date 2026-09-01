// Deterministic channel-error simulator for the DNA Archive Lab.
// These are DIGITAL, sequence-level "channel-error models" for an in-silico
// data-storage simulation — substitutions, insertions, deletions, strand
// dropout, strand duplication, and coverage depth. They are not predictions
// about biology and not laboratory procedures of any kind.
import type { DnaStrand, ErrorProfile } from './types.js';
import { createSeededRandom } from './prng.js';

const BASES = ['A', 'C', 'G', 'T'] as const;

export interface SimulationStats {
  dropped: number;
  duplicated: number;
  substituted: number;
  inserted: number;
  deleted: number;
}

export interface SimulationOutput {
  noisyStrands: DnaStrand[];
  stats: SimulationStats;
}

/** Zero-rate profile helper: no simulated errors of any kind. */
export const ZERO_ERROR_PROFILE: ErrorProfile = {
  id: 'zero',
  label: 'No simulated channel errors',
  substitutionRate: 0,
  insertionRate: 0,
  deletionRate: 0,
  strandDropoutRate: 0,
  duplicationRate: 0,
  coverageDepth: 1,
  seed: 0,
};

function applyBaseErrors(sequence: string, profile: ErrorProfile, rng: ReturnType<typeof createSeededRandom>, stats: SimulationStats): string {
  // Pass 1: deletions — decide per base, then remove.
  const kept: string[] = [];
  for (const base of sequence) {
    if (rng.next() < profile.deletionRate) {
      stats.deleted++;
    } else {
      kept.push(base);
    }
  }
  // Pass 2: substitutions and insertions, walking the surviving bases.
  let out = '';
  for (const base of kept) {
    if (rng.next() < profile.substitutionRate) {
      // Substitute with one of the other three bases.
      const alternatives = BASES.filter((b) => b !== base);
      out += rng.pick(alternatives);
      stats.substituted++;
    } else {
      out += base;
    }
    if (rng.next() < profile.insertionRate) {
      out += rng.pick(BASES);
      stats.inserted++;
    }
  }
  return out;
}

export function simulateChannelErrors(strands: DnaStrand[], profile: ErrorProfile): SimulationOutput {
  // Every random draw comes from this single seeded generator, so the same
  // strands + profile + seed always produce identical output.
  const rng = createSeededRandom(profile.seed);
  const stats: SimulationStats = { dropped: 0, duplicated: 0, substituted: 0, inserted: 0, deleted: 0 };
  const noisyStrands: DnaStrand[] = [];

  for (const strand of strands) {
    // Strand dropout: the whole strand is unavailable at decode time.
    if (rng.next() < profile.strandDropoutRate) {
      stats.dropped++;
      continue;
    }

    // Coverage depth: generate multiple noisy reads of the strand. Phase 1
    // decoding consumes the first read; additional reads are recorded so a
    // future consensus decoder can use them without changing this interface.
    const readCount = Math.max(1, Math.floor(profile.coverageDepth));
    for (let read = 0; read < readCount; read++) {
      const noisySequence = applyBaseErrors(strand.sequence, profile, rng, stats);
      noisyStrands.push({
        ...strand,
        id: read === 0 ? strand.id : `${strand.id}-read${read}`,
        sequence: noisySequence,
        payloadLength: strand.payloadLength,
        metadata: {
          ...strand.metadata,
          simulatedRead: read,
          totalReads: readCount,
          originalLength: strand.sequence.length,
        },
      });
    }

    // Strand duplication: the strand appears an extra time at decode time.
    if (rng.next() < profile.duplicationRate) {
      noisyStrands.push({
        ...strand,
        id: `${strand.id}-dup`,
        metadata: { ...strand.metadata, duplicatedCopy: true },
      });
      stats.duplicated++;
    }
  }

  return { noisyStrands, stats };
}
