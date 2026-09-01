// Constraint-aware codec (encoding profile B): quaternary (2-bit) payload
// conversion with strand indexes, homopolymer avoidance, GC monitoring,
// per-strand checksums, and configurable strand-copy redundancy.
// This is a simplified research simulation — part of an in-silico data-storage
// simulator with no laboratory or synthesis application.
import crypto from 'crypto';
import type { DnaStrand, EncodingProfile } from './types.js';
import { gcPercent, maxHomopolymerRun } from './analytics.js';
import { assertDnaSequence } from './learningCodec.js';

const VALUE_TO_BASE = ['A', 'C', 'G', 'T'] as const;
const BASE_TO_VALUE: Record<string, number> = { A: 0, C: 1, G: 2, T: 3 };

// Header: 5 bytes ([4-byte strand index][1-byte flags]) — ternary-escape encoded
// so the control fields never create homopolymer runs: 6 bases/byte = 30 bases.
// Trailer: 4-byte chunk byte length — ternary-escape encoded: 24 bases.
// Flags bit 0: ternary escape encoding used for this strand's payload.
// Payload is plain quaternary (2-bit) unless it (or a field boundary) would
// violate the homopolymer limit, in which case the payload is ternary-escaped.
const HEADER_BYTES = 5;
const HEADER_BASES = HEADER_BYTES * 6; // 30
const LENGTH_BASES = 4 * 6; // 24
const FLAG_TERNARY_ESCAPE = 0b0000_0001;

export const CONSTRAINT_AWARE_PROFILE: EncodingProfile = {
  id: 'constraint-aware',
  name: 'Constraint-aware mode',
  description:
    'Quaternary payload conversion with strand indexes, homopolymer avoidance (ternary escape re-encoding for violating chunks), GC monitoring, per-strand SHA-256 checksums, and configurable strand-copy redundancy. A simplified research simulation — not a claim of readiness for any physical process.',
  mode: 'constraint-aware',
  maxPayloadBases: 200,
  maxHomopolymerLength: 3,
  minGcPercent: 40,
  maxGcPercent: 60,
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

// Ternary escape encoding: every byte becomes 6 ternary digits, each emitted as a
// base that always differs from the previous base, so no two adjacent bases are
// equal (max homopolymer run = 1). The "previous base" for the first digit is
// conventionally A, so the first base is never A.
function bytesToTernaryBases(bytes: Uint8Array): string {
  let out = '';
  let prev = 0; // conventional starting "previous base" value (A)
  for (const byte of bytes) {
    // Byte -> 6 ternary digits, most significant first.
    const digits: number[] = [];
    let value = byte;
    for (let d = 0; d < 6; d++) {
      digits.unshift(value % 3);
      value = Math.floor(value / 3);
    }
    for (const digit of digits) {
      const current = (prev + digit + 1) % 4;
      out += VALUE_TO_BASE[current];
      prev = current;
    }
  }
  return out;
}

function ternaryBasesToBytes(bases: string): Uint8Array {
  const byteCount = Math.floor(bases.length / 6);
  const out = new Uint8Array(byteCount);
  let prev = 0;
  for (let b = 0; b < byteCount; b++) {
    let value = 0;
    for (let d = 0; d < 6; d++) {
      const current = BASE_TO_VALUE[bases[b * 6 + d]];
      const digit = (current - prev - 1 + 4) % 4;
      if (digit > 2) {
        throw new Error('Invalid ternary escape sequence: digit out of range');
      }
      value = value * 3 + digit;
      prev = current;
    }
    out[b] = value;
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

interface EncodedChunk {
  sequence: string;
  flags: number;
  chunk: Uint8Array;
}

function encodeChunk(chunk: Uint8Array, index: number, profile: EncodingProfile): EncodedChunk {
  // Control fields (index + flags header, chunk-length trailer) are always
  // ternary-escape encoded: no two adjacent bases inside them are equal, so the
  // control fields themselves can never violate the homopolymer limit.
  const assemble = (escaped: boolean): string => {
    const control = new Uint8Array(HEADER_BYTES);
    control.set(uint32ToBytes(index), 0);
    control[HEADER_BYTES - 1] = escaped ? FLAG_TERNARY_ESCAPE : 0;
    return (
      bytesToTernaryBases(control) +
      (escaped ? bytesToTernaryBases(chunk) : bytesToBases(chunk)) +
      bytesToTernaryBases(uint32ToBytes(chunk.length))
    );
  };

  // First attempt: plain quaternary (2-bit) payload. If the assembled strand
  // still violates the homopolymer limit (payload run, or a run created at a
  // field boundary), re-encode the payload with the ternary escape, which
  // guarantees no two adjacent payload bases are equal.
  let sequence = assemble(false);
  let flags = 0;
  if (maxHomopolymerRun(sequence) > profile.maxHomopolymerLength) {
    sequence = assemble(true);
    flags = FLAG_TERNARY_ESCAPE;
  }
  return { sequence, flags, chunk };
}

export function encodeConstraintAware(
  payload: Buffer,
  experimentId: string,
  profile: EncodingProfile
): DnaStrand[] {
  // The ternary escape needs maxHomopolymerLength >= 2: field boundaries can
  // still join two equal bases into a run of 2.
  if (profile.maxHomopolymerLength < 2) {
    throw new Error('maxHomopolymerLength must be at least 2 for the constraint-aware codec');
  }
  // Budget the chunk size on the ternary worst case (6 bases/byte): a chunk that
  // violates the homopolymer limit is re-encoded with the ternary escape, and
  // even the escaped strand must stay within maxPayloadBases.
  const ternaryBudget = Math.floor(
    (profile.maxPayloadBases - HEADER_BASES - LENGTH_BASES) / 6
  );
  if (ternaryBudget < 1) {
    throw new Error(`maxPayloadBases (${profile.maxPayloadBases}) too small for header + payload + length`);
  }
  const chunkBytes = ternaryBudget;

  const chunkCount = Math.max(1, Math.ceil(payload.length / chunkBytes));
  const base: DnaStrand[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const chunk = payload.subarray(i * chunkBytes, Math.min((i + 1) * chunkBytes, payload.length));
    const encoded = encodeChunk(chunk, i, profile);
    const sequence = encoded.sequence;
    assertDnaSequence(sequence);

    base.push({
      id: `${experimentId}-c${i}`,
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
      metadata: {
        chunkCount,
        chunkIndex: i,
        chunkByteLength: chunk.length,
        flags: encoded.flags,
        ternaryEscape: (encoded.flags & FLAG_TERNARY_ESCAPE) !== 0,
      },
    });
  }

  // Configurable redundancy: additional copies of every strand. Copies share the
  // index so the decoder can de-duplicate; each copy gets its own id.
  const copies = Math.max(1, Math.floor(profile.redundancyFactor));
  const strands: DnaStrand[] = [];
  for (let copy = 0; copy < copies; copy++) {
    for (const strand of base) {
      strands.push(
        copy === 0
          ? strand
          : {
              ...strand,
              id: `${strand.id}-r${copy}`,
              metadata: { ...strand.metadata, copyOf: strand.id, copyNumber: copy },
            }
      );
    }
  }
  return strands;
}

export function decodeConstraintAware(
  strands: DnaStrand[],
  _profile: EncodingProfile
): { bytes: Buffer; warnings: string[] } {
  const warnings: string[] = [];
  // Group every copy of an index (redundancy copies, duplicated strands, extra
  // coverage reads) so decode can use the best available copy rather than
  // blindly keeping the first one.
  const copiesByIndex = new Map<number, DnaStrand[]>();
  for (const strand of strands) {
    const list = copiesByIndex.get(strand.index);
    if (list) list.push(strand);
    else copiesByIndex.set(strand.index, [strand]);
  }

  const indexes = [...copiesByIndex.keys()].sort((a, b) => a - b);
  if (indexes.length === 0) {
    return { bytes: Buffer.alloc(0), warnings: [...warnings, 'No strands to decode.'] };
  }

  const totalChunks =
    (copiesByIndex.get(indexes[0])?.[0]?.metadata?.chunkCount as number) ?? indexes.length;
  for (let i = 0; i < totalChunks; i++) {
    if (!copiesByIndex.has(i)) warnings.push(`Missing strand with index ${i}.`);
  }

  const chunks: Buffer[] = [];
  let corrupted = 0;
  for (const index of indexes) {
    const copies = copiesByIndex.get(index)!;
    let fallback: Buffer | null = null;
    let verified = false;
    // Warnings from damaged copies are only surfaced when no pristine copy of
    // this index exists; otherwise the redundancy did its job silently.
    let copyWarnings: string[] = [];
    for (const copy of copies) {
      try {
        assertDnaSequence(copy.sequence);
        if (copy.sequence.length < HEADER_BASES + LENGTH_BASES) {
          copyWarnings.push(`Strand ${index} too short to contain header and length fields.`);
          continue;
        }
        const headerBytes = ternaryBasesToBytes(copy.sequence.slice(0, HEADER_BASES));
        const decodedIndex = bytesToUint32(headerBytes.subarray(0, 4));
        const flags = headerBytes[HEADER_BYTES - 1];
        if (decodedIndex !== index) {
          copyWarnings.push(`Strand ${index} header carries index ${decodedIndex}; mismatch.`);
          continue;
        }
        const body = copy.sequence.slice(HEADER_BASES, copy.sequence.length - LENGTH_BASES);
        const trailerBytes = ternaryBasesToBytes(
          copy.sequence.slice(copy.sequence.length - LENGTH_BASES)
        );
        const declaredLength = bytesToUint32(trailerBytes);

        const chunk =
          (flags & FLAG_TERNARY_ESCAPE) !== 0
            ? ternaryBasesToBytes(body)
            : basesToBytes(body);

        if (chunk.length !== declaredLength) {
          copyWarnings.push(`Strand ${index} declared length ${declaredLength} does not match payload.`);
          continue;
        }
        if (sha256Hex(chunk) === copy.originalChecksum) {
          // Pristine copy: use it and stop considering the remaining copies.
          chunks.push(Buffer.from(chunk));
          verified = true;
          break;
        }
        // Corrupted copy: keep as a fallback in case no pristine copy exists.
        if (fallback === null) {
          fallback = Buffer.from(chunk);
          copyWarnings.push(
            `Strand ${index} checksum mismatch (simulated channel corruption); no clean copy available.`
          );
        }
      } catch (err) {
        copyWarnings.push(`Strand ${index} could not be decoded: ${(err as Error).message}`);
      }
    }
    if (!verified) {
      if (fallback !== null) {
        corrupted++;
        chunks.push(fallback);
      } else {
        copyWarnings.push(`Strand ${index} could not be recovered from any copy.`);
      }
      warnings.push(...copyWarnings);
    }
  }

  if (corrupted > 0) {
    warnings.push(`${corrupted} strand(s) failed checksum verification.`);
  }
  return { bytes: Buffer.concat(chunks), warnings };
}
