// Learning-mode codec (encoding profile A): deterministic 2-bit mapping with a
// visible index header and per-strand checksum. For teaching and transparency
// only — this module is part of an in-silico data-storage simulator.
import crypto from 'crypto';
import type { DnaStrand, EncodingProfile } from './types.js';
import { gcPercent, maxHomopolymerRun } from './analytics.js';

// 2-bit mapping: 00→A, 01→C, 10→G, 11→T
const VALUE_TO_BASE = ['A', 'C', 'G', 'T'] as const;
const BASE_TO_VALUE: Record<string, number> = { A: 0, C: 1, G: 2, T: 3 };

// Strand layout: [16-base header: 4-byte strand index][payload bases][16-base trailer: 4-byte chunk byte length]
// Every 4-byte field is 16 bases at 4 bases per byte in the 2-bit mapping.
const HEADER_BASES = 16;
const LENGTH_BASES = 16;

export function assertDnaSequence(sequence: string): void {
  if (!/^[ACGT]*$/.test(sequence)) {
    throw new Error(`Invalid DNA base in sequence (first 20 chars shown): ${sequence.slice(0, 20)}`);
  }
}

export const LEARNING_PROFILE: EncodingProfile = {
  id: 'learning',
  name: 'Learning mode',
  description:
    'Deterministic 2-bit mapping (00→A, 01→C, 10→G, 11→T) with a visible strand index header and per-strand SHA-256 checksum. Built for teaching and transparency — not a claim of readiness for any physical process.',
  mode: 'learning',
  maxPayloadBases: 200,
  maxHomopolymerLength: 4,
  minGcPercent: 0,
  maxGcPercent: 100,
  redundancyFactor: 1,
  checksumAlgorithm: 'sha256',
};

function bytesToBases(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) {
    out += VALUE_TO_BASE[(byte >> 6) & 3];
    out += VALUE_TO_BASE[(byte >> 4) & 3];
    out += VALUE_TO_BASE[(byte >> 2) & 3];
    out += VALUE_TO_BASE[byte & 3];
  }
  return out;
}

function basesToBytes(bases: string): Uint8Array {
  if (bases.length % 4 !== 0) {
    throw new Error(`Base sequence length must be a multiple of 4, got ${bases.length}`);
  }
  const out = new Uint8Array(bases.length / 4);
  for (let i = 0; i < out.length; i++) {
    out[i] =
      (BASE_TO_VALUE[bases[i * 4]] << 6) |
      (BASE_TO_VALUE[bases[i * 4 + 1]] << 4) |
      (BASE_TO_VALUE[bases[i * 4 + 2]] << 2) |
      BASE_TO_VALUE[bases[i * 4 + 3]];
  }
  return out;
}

function uint32ToBytes(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  bytes[0] = (value >>> 24) & 0xff;
  bytes[1] = (value >>> 16) & 0xff;
  bytes[2] = (value >>> 8) & 0xff;
  bytes[3] = value & 0xff;
  return bytes;
}

function bytesToUint32(bytes: Uint8Array): number {
  return ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
}

function sha256Hex(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function encodeLearning(payload: Buffer, experimentId: string, profile: EncodingProfile): DnaStrand[] {
  const payloadBasesBudget = profile.maxPayloadBases - HEADER_BASES - LENGTH_BASES;
  if (payloadBasesBudget < 4) {
    throw new Error(`maxPayloadBases (${profile.maxPayloadBases}) too small for header + payload + length`);
  }
  const chunkBytes = Math.floor(payloadBasesBudget / 4);
  const strands: DnaStrand[] = [];

  const chunkCount = Math.max(1, Math.ceil(payload.length / chunkBytes));
  for (let i = 0; i < chunkCount; i++) {
    const chunk = payload.subarray(i * chunkBytes, Math.min((i + 1) * chunkBytes, payload.length));
    const sequence =
      bytesToBases(uint32ToBytes(i)) +
      bytesToBases(chunk) +
      bytesToBases(uint32ToBytes(chunk.length));
    assertDnaSequence(sequence);

    strands.push({
      id: `${experimentId}-s${i}`,
      experimentId,
      index: i,
      sequence,
      payloadLength: chunk.length,
      originalChecksum: sha256Hex(chunk),
      gcPercent: gcPercent(sequence),
      maxHomopolymerRun: maxHomopolymerRun(sequence),
      passedConstraints:
        maxHomopolymerRun(sequence) <= profile.maxHomopolymerLength &&
        gcPercent(sequence) >= profile.minGcPercent &&
        gcPercent(sequence) <= profile.maxGcPercent,
      metadata: { chunkCount, chunkIndex: i, chunkByteLength: chunk.length },
    });
  }
  return strands;
}

export function decodeLearning(
  strands: DnaStrand[],
  _profile: EncodingProfile
): { bytes: Buffer; warnings: string[] } {
  const warnings: string[] = [];
  const byIndex = new Map<number, DnaStrand>();
  for (const strand of strands) {
    if (byIndex.has(strand.index)) {
      warnings.push(`Duplicate strand index ${strand.index}; keeping first copy.`);
      continue;
    }
    byIndex.set(strand.index, strand);
  }

  const sorted = [...byIndex.values()].sort((a, b) => a.index - b.index);
  if (sorted.length === 0) {
    return { bytes: Buffer.alloc(0), warnings: [...warnings, 'No strands to decode.'] };
  }

  const totalChunks = (sorted[0].metadata?.chunkCount as number) ?? sorted.length;
  for (let i = 0; i < totalChunks; i++) {
    if (!byIndex.has(i)) warnings.push(`Missing strand with index ${i}.`);
  }

  const chunks: Buffer[] = [];
  for (const strand of sorted) {
    try {
      assertDnaSequence(strand.sequence);
      if (strand.sequence.length < HEADER_BASES + LENGTH_BASES) {
        warnings.push(`Strand ${strand.index} too short to contain header and length fields.`);
        continue;
      }
      const headerBytes = basesToBytes(strand.sequence.slice(0, HEADER_BASES));
      const decodedIndex = bytesToUint32(headerBytes);
      if (decodedIndex !== strand.index) {
        warnings.push(`Strand ${strand.index} header carries index ${decodedIndex}; mismatch.`);
        continue;
      }
      const body = strand.sequence.slice(HEADER_BASES, strand.sequence.length - LENGTH_BASES);
      const trailerBytes = basesToBytes(strand.sequence.slice(strand.sequence.length - LENGTH_BASES));
      const declaredLength = bytesToUint32(trailerBytes);
      if (body.length % 4 !== 0 || body.length / 4 !== declaredLength) {
        warnings.push(`Strand ${strand.index} declared length ${declaredLength} does not match payload.`);
        continue;
      }
      const chunk = Buffer.from(basesToBytes(body));
      if (sha256Hex(chunk) !== strand.originalChecksum) {
        warnings.push(`Strand ${strand.index} checksum mismatch (simulated channel corruption).`);
        // Keep the corrupted chunk: whole-payload verification at the caller will
        // catch the mismatch, and this preserves bit-error visibility.
      }
      chunks.push(chunk);
    } catch (err) {
      warnings.push(`Strand ${strand.index} could not be decoded: ${(err as Error).message}`);
    }
  }

  return { bytes: Buffer.concat(chunks), warnings };
}
