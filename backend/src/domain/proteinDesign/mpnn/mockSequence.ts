// Deterministic mock ProteinMPNN sequence design/optimization/ranking.
// Provides PLAUSIBLE sequence results with a stable LCG so mock behaviour is
// reproducible across processes (same seed -> same sequences and scores).

import { lcg } from './executionModes.js';

const AMINO_ACIDS = 'ACDEFGHIKLMNPQRSTVWY';

/** Extract a model length hint from a PDB/mmCIF text blob (best-effort). */
export function inferStructureLength(structure: string): number | undefined {
  if (!structure) return undefined;
const atoms = structure.match(/^(ATOM|HETATM)\s+\d+\s+CA\s+\S+\s+\S+\s+(\d+)/gm);
  if (atoms && atoms.length) {
    const seqIds = atoms
      .map((a) => a.trim().split(/\s+/)[5])
      .map(Number)
      .filter(Number.isFinite);
    if (seqIds.length) {
      return Math.max(...seqIds) - Math.min(...seqIds) + 1;
    }
  }
  const endCount = (structure.match(/^END\s*$/gm) ?? []).length;
  if (endCount) {
    const lines = structure.split(/\r?\n/);
    const endAt = lines.findIndex((l) => l.trim() === 'END');
    if (endAt > 0) {
      const atomRows = lines.slice(0, endAt).filter((l) => /^ATOM\s/.test(l));
      return Math.max(atomRows.length, 10);
    }
  }
  return undefined;
}

export interface MockMpnnSequence {
  sequence: string;
  score: number;
  confidence: number;
  positionScores: number[];
}

/** Sample `num` deterministic sequences for a backbone of `length` residues. */
export function designMockSequences(
  length: number,
  num: number,
  seed: number,
  temperature: number,
): MockMpnnSequence[] {
  const rand = lcg(seed);
  const results: MockMpnnSequence[] = [];
  for (let n = 0; n < num; n++) {
    const positionScores: number[] = [];
    let sequence = '';
    for (let i = 0; i < length; i++) {
      const posScore = clamp(0.6 + rand() * 0.4 * (1 - temperature), 0.05, 0.99);
      positionScores.push(posScore);
      sequence += AMINO_ACIDS[Math.floor(rand() * AMINO_ACIDS.length)];
    }
    const sequenceHash = stableHash(sequence);
    results.push({
      sequence,
      score: clamp(0.6 + (sequenceHash % 1000) / 2000, 0.05, 0.99),
      confidence: clamp(0.75 + (sequenceHash % 500) / 2500, 0.05, 0.99),
      positionScores,
    });
  }
  return results;
}

/** Optimization = repeated sampling, keep the best-scoring sequence. */
export function optimizeMockSequence(
  length: number,
  seed: number,
  temperature: number,
): MockMpnnSequence {
  const candidates = designMockSequences(length, 5, seed, temperature);
  return candidates.reduce((best, c) => (c.score > best.score ? c : best), candidates[0]);
}

/** Deterministic ranking of candidate sequences against the same correlation. */
export function rankMockSequences(sequences: string[]): { sequence: string; rank: number; score: number }[] {
  const ranked = sequences
    .map((sequence) => {
      const score = clamp(0.6 + (stableHash(sequence) % 1000) / 2000, 0.05, 0.99);
      return { sequence, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  return ranked;
}

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}