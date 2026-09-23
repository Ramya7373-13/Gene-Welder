// Deterministic mock RFD3 generation, shared by the execution adapter's MOCK
// mode. Logic is extracted verbatim from the Phase-1 RFDiffusion3Adapter so
// mock behavior (and anything that depended on it) is byte-for-byte stable.

import type { DesignCandidate, DesignRunRequest } from '../types/index.js';

export const MOCK_MODEL_VERSION = 'rfd3-mock-v1.0.0';
export const MOCK_WEIGHTS_HASH =
  'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

export function generateMockSequence(length: number, seed: number): string {
  const aminoAcids = 'ACDEFGHIKLMNPQRSTVWY';
  let seq = '';
  for (let i = 0; i < length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    seq += aminoAcids[(seed >> 16) % aminoAcids.length];
  }
  return seq;
}

function padNum(n: number, width: number): string {
  return n.toFixed(3).padStart(width);
}

export function generateMockPdb(sequence: string, seed: number): string {
  const residues = sequence.split('');
  let pdb = '';
  let atomCount = 1;
  let residueOffset = 0;

  for (let resIdx = 0; resIdx < residues.length; resIdx++) {
    const residueName = residues[resIdx];
    const x = (seed * (resIdx + 1) * 0.5236) % 10;
    const y = (seed * (resIdx + 1) * 0.9876) % 10;
    const z = (seed * (resIdx + 1) * 0.3321) % 10;

    pdb += `ATOM  ${String(atomCount).padStart(5)}  CA  ${residueName} A${String(residueOffset + 1).padStart(4)}    ${padNum(x, 8)}${padNum(y, 8)}${padNum(z, 8)}  1.00 50.00           C\n`;
    atomCount++;
    pdb += `ATOM  ${String(atomCount).padStart(5)}   N  ${residueName} A${String(residueOffset + 1).padStart(4)}    ${padNum(x + 1.3, 8)}${padNum(y - 0.5, 8)}${padNum(z, 8)}  1.00 50.00           N\n`;
    atomCount++;
    pdb += `ATOM  ${String(atomCount).padStart(5)}   C  ${residueName} A${String(residueOffset + 1).padStart(4)}    ${padNum(x - 1.3, 8)}${padNum(y, 8)}${padNum(z, 8)}  1.00 50.00           C\n`;
    atomCount++;
    residueOffset++;
  }

  pdb += 'END\n';
  return pdb;
}

export interface MockGeneration {
  candidates: DesignCandidate[];
  modelVersion: string;
  weightsHash: string;
  seed: number;
  executionTimeMs: number;
}

export function generateMockCandidates(
  request: DesignRunRequest,
  count: number,
  seed: number,
): DesignCandidate[] {
  const candidates: DesignCandidate[] = [];
  const seqLength = 80 + Math.floor(seed % 50);

  for (let i = 0; i < count; i++) {
    const candidateSeed = seed + i * 1000;
    const sequence = generateMockSequence(seqLength, candidateSeed);
    const pdb = generateMockPdb(sequence, candidateSeed);

    candidates.push({
      id: `cand_${request.runId}_${i}`,
      runId: request.runId,
      structure: pdb,
      sequence,
      affinityScore: 0.65 + Math.random() * 0.3,
      rankedPosition: i + 1,
      metrics: {
        pLDDT: 75 + Math.random() * 20,
        pTM: 0.7 + Math.random() * 0.2,
        ipTM: 0.6 + Math.random() * 0.25,
        interfaceArea: 400 + Math.random() * 600,
        designScore: 0.55 + Math.random() * 0.3,
      },
      createdAt: new Date(),
    });
  }

  return candidates;
}

/** Full mock generation, used by the execution adapter's MOCK mode. */
export function runMockGeneration(
  request: DesignRunRequest,
  count: number,
  seed: number,
): MockGeneration {
  const startTime = Date.now();
  const actualSeed = seed + request.runId.length;
  const candidates = generateMockCandidates(request, count, (seed + actualSeed) % 2 ** 31);
  return {
    candidates,
    modelVersion: MOCK_MODEL_VERSION,
    weightsHash: MOCK_WEIGHTS_HASH,
    seed: actualSeed,
    executionTimeMs: Date.now() - startTime,
  };
}