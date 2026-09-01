// Reproducible Markdown + JSON report generator for DNA Archive Lab experiments.
// Reports describe in-silico simulation results only.
import type { DnaStrand, DecodeResult, EncodingProfile, ErrorProfile } from './types.js';
import { PRNG_NAME, PRNG_VERSION } from './types.js';
import { encodingOverhead, effectivePayloadRate } from './analytics.js';

export interface ReportExperimentInput {
  id: string;
  title: string;
  description?: string | null;
  sourceFileName?: string | null;
  sourceFileSizeBytes?: number | null;
  sourceSha256?: string | null;
  randomSeed?: number | null;
  createdAt?: string | Date;
}

export interface ReportInput {
  experiment: ReportExperimentInput;
  encodingProfile: EncodingProfile;
  errorProfile: ErrorProfile;
  strands: DnaStrand[];
  decodeResult: DecodeResult;
}

export const APP_VERSION = 'MutationMechanic DNA Archive Lab v1 (Phase 1)';

export const NON_LAB_DISCLAIMER =
  'This report describes an in-silico data-storage simulation. It does not perform laboratory operations or provide wet-lab protocols.';

export function generateReport(input: ReportInput): { markdown: string; json: Record<string, unknown> } {
  const { experiment, encodingProfile, errorProfile, strands, decodeResult } = input;

  const totalBases = strands.reduce((n, s) => n + s.sequence.length, 0);
  const rawPayloadBases = strands.reduce((n, s) => n + s.payloadLength * 4, 0);
  const uniqueIndexes = new Set(strands.map((s) => s.index)).size;
  const passingConstraints = strands.filter((s) => s.passedConstraints).length;
  const recoveredBits = decodeResult.recoveredBytes !== undefined ? decodeResult.recoveredBytes * 8 : 0;

  const json: Record<string, unknown> = {
    applicationVersion: APP_VERSION,
    prng: { name: PRNG_NAME, version: PRNG_VERSION },
    experiment: {
      id: experiment.id,
      title: experiment.title,
      description: experiment.description ?? null,
      sourceFileName: experiment.sourceFileName ?? null,
      sourceFileSizeBytes: experiment.sourceFileSizeBytes ?? null,
      sourceSha256: experiment.sourceSha256 ?? decodeResult.expectedChecksum,
      randomSeed: experiment.randomSeed ?? errorProfile.seed,
      createdAt: experiment.createdAt instanceof Date ? experiment.createdAt.toISOString() : experiment.createdAt ?? null,
    },
    encodingProfile,
    errorProfile,
    constraintSummary: {
      totalStrands: uniqueIndexes,
      strandsPassingConstraints: passingConstraints,
      strandsFailingConstraints: uniqueIndexes - passingConstraints,
      maxHomopolymerLengthObserved: Math.max(0, ...strands.map((s) => s.maxHomopolymerRun)),
      gcPercentRange: strands.length
        ? {
            min: Math.min(...strands.map((s) => s.gcPercent)),
            max: Math.max(...strands.map((s) => s.gcPercent)),
          }
        : { min: 0, max: 0 },
    },
    strandSummary: {
      totalEncodedStrands: strands.length,
      uniqueStrandIndexes: uniqueIndexes,
      totalBases,
      rawPayloadBases,
      encodingOverhead: encodingOverhead(rawPayloadBases, totalBases),
      redundancyFactor: encodingProfile.redundancyFactor,
    },
    decodeOutcome: {
      success: decodeResult.success,
      expectedChecksum: decodeResult.expectedChecksum,
      recoveredChecksum: decodeResult.recoveredChecksum ?? null,
      recoveredBytes: decodeResult.recoveredBytes ?? 0,
      missingStrands: decodeResult.missingStrands,
      corruptedStrands: decodeResult.corruptedStrands,
      correctedStrands: decodeResult.correctedStrands,
      uncorrectableStrands: decodeResult.uncorrectableStrands,
      message: decodeResult.message,
      warnings: decodeResult.warnings,
      effectivePayloadRate: effectivePayloadRate(recoveredBits, totalBases),
    },
    limitations: [
      'This is a simplified teaching-grade simulation, not a research-grade codec evaluation.',
      'Theoretical storage-density figures derived from these results are simulation-derived only.',
      'Exported sequences are simulation artifacts and are not intended for any physical process.',
      'Not for clinical, biological, or laboratory decision-making.',
    ],
    disclaimer: NON_LAB_DISCLAIMER,
  };

  const md: string[] = [];
  md.push(`# DNA Archive Lab — Experiment Report`);
  md.push('');
  md.push(`**${experiment.title}**`);
  if (experiment.description) md.push(`\n${experiment.description}`);
  md.push('');
  md.push(`## Experiment metadata`);
  md.push(`- Experiment ID: \`${experiment.id}\``);
  md.push(`- Source file: ${experiment.sourceFileName ?? 'n/a'} (${experiment.sourceFileSizeBytes ?? 0} bytes)`);
  md.push(`- Source SHA-256: \`${experiment.sourceSha256 ?? decodeResult.expectedChecksum}\``);
  md.push(`- Random seed: \`${experiment.randomSeed ?? errorProfile.seed}\` (PRNG: ${PRNG_NAME} v${PRNG_VERSION})`);
  md.push('');
  md.push(`## Encoding profile`);
  md.push(`- Profile: ${encodingProfile.name} (\`${encodingProfile.mode}\`)`);
  md.push(`- Max payload bases per strand: ${encodingProfile.maxPayloadBases}`);
  md.push(`- Homopolymer limit: ${encodingProfile.maxHomopolymerLength}`);
  md.push(`- GC target range: ${encodingProfile.minGcPercent}%–${encodingProfile.maxGcPercent}%`);
  md.push(`- Redundancy factor: ${encodingProfile.redundancyFactor}`);
  md.push(`- Checksum algorithm: ${encodingProfile.checksumAlgorithm}`);
  md.push('');
  md.push(`## Constraint summary`);
  md.push(`- Strands passing constraints: ${passingConstraints} / ${uniqueIndexes}`);
  md.push(`- Longest homopolymer run observed: ${Math.max(0, ...strands.map((s) => s.maxHomopolymerRun))}`);
  md.push('');
  md.push(`## Strands and redundancy`);
  md.push(`- Unique strands: ${uniqueIndexes}; total encoded strands (incl. copies): ${strands.length}`);
  md.push(`- Total encoded bases: ${totalBases}; raw payload bases: ${rawPayloadBases}`);
  md.push(`- Encoding overhead: ${(encodingOverhead(rawPayloadBases, totalBases) * 100).toFixed(1)}%`);
  md.push('');
  md.push(`## Channel error configuration`);
  md.push(`- Substitution rate: ${errorProfile.substitutionRate}`);
  md.push(`- Insertion rate: ${errorProfile.insertionRate}`);
  md.push(`- Deletion rate: ${errorProfile.deletionRate}`);
  md.push(`- Strand dropout rate: ${errorProfile.strandDropoutRate}`);
  md.push(`- Strand duplication rate: ${errorProfile.duplicationRate}`);
  md.push(`- Coverage depth: ${errorProfile.coverageDepth}`);
  md.push(`- Seed: \`${errorProfile.seed}\``);
  md.push('');
  md.push(`## Decode outcome`);
  md.push(`- Success: **${decodeResult.success ? 'YES' : 'NO'}**`);
  md.push(`- Expected checksum: \`${decodeResult.expectedChecksum}\``);
  md.push(`- Recovered checksum: \`${decodeResult.recoveredChecksum ?? 'n/a'}\``);
  md.push(`- Recovered bytes: ${decodeResult.recoveredBytes ?? 0}`);
  md.push(`- Strands missing / corrupted / corrected / uncorrectable: ${decodeResult.missingStrands} / ${decodeResult.corruptedStrands} / ${decodeResult.correctedStrands} / ${decodeResult.uncorrectableStrands}`);
  md.push(`- Effective payload rate: ${effectivePayloadRate(recoveredBits, totalBases).toFixed(4)} bits/base (simulation-derived)`);
  md.push(`- Message: ${decodeResult.message}`);
  if (decodeResult.warnings.length) {
    md.push('');
    md.push(`Warnings:`);
    for (const w of decodeResult.warnings) md.push(`- ${w}`);
  }
  md.push('');
  md.push(`## Limitations and methodology`);
  md.push(`- Teaching-grade simulation; simplified research simulation only.`);
  md.push(`- Theoretical storage density derived from these results is simulation-derived, not deployed capacity.`);
  md.push(`- Exported sequences are simulation artifacts — not for synthesis or any physical process.`);
  md.push('');
  md.push(`## Not for clinical, biological, or laboratory decision-making`);
  md.push('');
  md.push(NON_LAB_DISCLAIMER);
  md.push('');
  md.push(`---`);
  md.push(`Generated by ${APP_VERSION}; codec: \`${encodingProfile.mode}\`; PRNG: ${PRNG_NAME} v${PRNG_VERSION}.`);

  return { markdown: md.join('\n'), json };
}
