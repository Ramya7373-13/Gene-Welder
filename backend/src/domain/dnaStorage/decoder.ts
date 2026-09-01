// Decode orchestration: composes the channel-error simulator, the codec's
// decode step, and checksum verification into a single DecodeResult.
// In-silico simulation only — no laboratory application.
import crypto from 'crypto';
import type { DnaStrand, DecodeResult, EncodingProfile, ErrorProfile } from './types.js';
import { simulateChannelErrors, ZERO_ERROR_PROFILE } from './errorSimulator.js';
import { getCodec } from './codecRegistry.js';

export interface ExperimentArtifacts {
  originalPayload: Buffer;
  expectedChecksum: string; // SHA-256 of originalPayload
  strands: DnaStrand[];
}

export function decodeExperiment(
  artifacts: ExperimentArtifacts,
  profile: EncodingProfile,
  errorProfile: ErrorProfile = ZERO_ERROR_PROFILE
): { result: DecodeResult; noisyStrands: DnaStrand[] } {
  const codec = getCodec(profile.mode);
  const { noisyStrands, stats } = simulateChannelErrors(artifacts.strands, errorProfile);

  const { bytes, warnings } = codec.decode(noisyStrands, profile);
  const recoveredChecksum = bytes.length > 0 || artifacts.originalPayload.length === 0
    ? crypto.createHash('sha256').update(bytes).digest('hex')
    : undefined;

  // Strand accounting.
  const expectedIndexes = new Set(artifacts.strands.map((s) => s.index));
  const receivedIndexes = new Set(noisyStrands.map((s) => s.index));
  const missingStrands = [...expectedIndexes].filter((i) => !receivedIndexes.has(i)).length;

  // Checksum-damaged strands among those received (deduplicated by index).
  const byIndex = new Map<number, DnaStrand>();
  for (const s of noisyStrands) if (!byIndex.has(s.index)) byIndex.set(s.index, s);
  let corruptedStrands = 0;
  let correctedStrands = 0;
  const originals = new Map(artifacts.strands.map((s) => [s.index, s]));
  for (const [index, strand] of byIndex) {
    const original = originals.get(index);
    if (!original) continue;
    if (strand.sequence !== original.sequence) {
      if (original.originalChecksum === strand.originalChecksum) {
        corruptedStrands++;
      } else {
        correctedStrands++;
      }
    }
  }
  const uncorrectableStrands = warnings.filter((w) => w.includes('checksum mismatch')).length;

  const recoveredBytes = bytes.length;
  const success =
    recoveredChecksum !== undefined && recoveredChecksum === artifacts.expectedChecksum;

  const resultWarnings = [...warnings];
  let message: string;
  if (success) {
    message =
      errorProfile === ZERO_ERROR_PROFILE || Object.values(errorProfile).every((v) => typeof v !== 'number' || v === 0)
        ? 'Recovered the exact original payload with no simulated channel errors.'
        : 'Recovered the exact original payload despite simulated channel errors.';
  } else {
    message = 'Recovery failed: the recovered payload does not match the original checksum.';
    if (stats.dropped > 0) {
      resultWarnings.push(
        `${stats.dropped} strand(s) were lost to simulated dropout. ` +
          'If dropout exceeds the redundancy factor, missing strand indexes cannot be reconstructed.'
      );
    }
    if (corruptedStrands + uncorrectableStrands > 0) {
      resultWarnings.push(
        `${corruptedStrands + uncorrectableStrands} strand(s) arrived corrupted. ` +
          'Lower error rates, higher redundancy, or stronger per-strand error correction is needed.'
      );
    }
    if (missingStrands > 0 && stats.dropped === 0) {
      resultWarnings.push(
        `${missingStrands} expected strand(s) missing at decode time — check indexing and coverage settings.`
      );
    }
    if (resultWarnings.length === 0) {
      resultWarnings.push('Insufficient redundancy or error correction for the configured channel-error rates.');
    }
  }

  const result: DecodeResult = {
    success,
    recoveredChecksum,
    expectedChecksum: artifacts.expectedChecksum,
    recoveredBytes,
    missingStrands,
    corruptedStrands,
    correctedStrands,
    uncorrectableStrands,
    message,
    warnings: resultWarnings,
  };
  return { result, noisyStrands };
}

/** Convenience helper: build artifacts from an original payload and encoded strands. */
export function buildArtifacts(originalPayload: Buffer, strands: DnaStrand[]): ExperimentArtifacts {
  return {
    originalPayload,
    expectedChecksum: crypto.createHash('sha256').update(originalPayload).digest('hex'),
    strands,
  };
}
