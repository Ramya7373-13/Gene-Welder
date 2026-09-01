export type DnaBase = 'A' | 'C' | 'G' | 'T';

export type DnaStorageExperimentStatus =
  | 'DRAFT'
  | 'ENCODING'
  | 'ENCODED'
  | 'SIMULATING'
  | 'DECODING'
  | 'COMPLETED'
  | 'FAILED';

export interface EncodingProfile {
  id: string;
  name: string;
  description: string;
  mode: 'learning' | 'constraint-aware' | 'advanced';
  maxPayloadBases: number;
  maxHomopolymerLength: number;
  minGcPercent: number;
  maxGcPercent: number;
  redundancyFactor: number;
  checksumAlgorithm: 'sha256' | 'crc32';
}

export interface DnaStrand {
  id: string;
  experimentId: string;
  index: number;
  sequence: string;
  payloadLength: number;
  originalChecksum: string;
  gcPercent: number;
  maxHomopolymerRun: number;
  passedConstraints: boolean;
  metadata: Record<string, unknown>;
}

export interface ErrorProfile {
  id: string;
  label: string;
  substitutionRate: number;
  insertionRate: number;
  deletionRate: number;
  strandDropoutRate: number;
  duplicationRate: number;
  coverageDepth: number;
  seed: number;
}

export interface DecodeResult {
  success: boolean;
  recoveredChecksum?: string;
  expectedChecksum: string;
  recoveredBytes?: number;
  missingStrands: number;
  corruptedStrands: number;
  correctedStrands: number;
  uncorrectableStrands: number;
  bitErrorRate?: number;
  message: string;
  warnings: string[];
}

export interface DnaStorageExperiment {
  id: string;
  userId: string | null;
  status: DnaStorageExperimentStatus;
  title: string;
  description: string | null;
  sourceFileName: string | null;
  sourceMimeType: string | null;
  sourceFileSizeBytes: number | null;
  sourceSha256: string | null;
  randomSeed: number | null;
  encodingProfileJson: EncodingProfile | null;
  errorProfileJson: ErrorProfile | null;
  prngName?: string | null;
  prngVersion?: string | null;
  createdAt: string;
  updatedAt?: string;
  _count?: {
    strands: number;
    errorRuns?: number;
    decodeRuns: number;
    reports?: number;
  };
}

export interface UploadResult {
  sourceFileName: string | null;
  sourceMimeType: string | null;
  sourceFileSizeBytes: number | null;
  sourceSha256: string | null;
  fileId: string;
}

export interface EncodeResult {
  status: string;
  uniqueStrands: number;
  totalStrands: number;
  totalBases: number;
  rawPayloadBases: number;
  encodingOverhead: number;
  strandsPassingConstraints: number;
  prng: { name: string; version: string };
}

export interface SimulationStats {
  dropped: number;
  duplicated: number;
  substituted: number;
  inserted: number;
  deleted: number;
}

export interface SimulateResult {
  errorRunId: string;
  seed: number;
  stats: SimulationStats;
  uniqueStrands: number;
  estimatedAffectedStrands: number;
  reproducible: boolean;
  prng: { name: string; version: string };
}

export interface DecodeApiResult extends DecodeResult {
  decodeRunId: string;
  reportAvailable: boolean;
}

export interface StrandsPage {
  page: number;
  pageSize: number;
  total: number;
  strands: DnaStrand[];
}

export const SAMPLE_PAYLOAD_TEXT = 'Cheers to Humanity and Longevity.';
export const SAMPLE_PAYLOAD_FILENAME = 'humanity-longevity.txt';

export const DNA_ARCHIVE_DISCLAIMER =
  'This module simulates computational DNA data-storage workflows. It does not perform laboratory operations or provide wet-lab protocols.';

export const LEARNING_PROFILE: EncodingProfile = {
  id: 'learning',
  name: 'Learning mode',
  description:
    'Deterministic 2-bit mapping (00→A, 01→C, 10→G, 11→T) with a visible strand index header and per-strand checksum. Built for teaching and transparency.',
  mode: 'learning',
  maxPayloadBases: 200,
  maxHomopolymerLength: 4,
  minGcPercent: 0,
  maxGcPercent: 100,
  redundancyFactor: 1,
  checksumAlgorithm: 'sha256',
};

export const CONSTRAINT_AWARE_PROFILE: EncodingProfile = {
  id: 'constraint-aware',
  name: 'Constraint-aware mode',
  description:
    'Quaternary payload conversion with strand indexes, homopolymer limits, GC monitoring, per-strand checksums, and configurable strand-copy redundancy. A simplified research simulation.',
  mode: 'constraint-aware',
  maxPayloadBases: 200,
  maxHomopolymerLength: 3,
  minGcPercent: 40,
  maxGcPercent: 60,
  redundancyFactor: 2,
  checksumAlgorithm: 'sha256',
};

export const ADVANCED_PROFILE: EncodingProfile = {
  id: 'advanced',
  name: 'Advanced codec adapter',
  description:
    'Placeholder for independently validated codecs. Not enabled in this version.',
  mode: 'advanced',
  maxPayloadBases: 200,
  maxHomopolymerLength: 3,
  minGcPercent: 40,
  maxGcPercent: 60,
  redundancyFactor: 1,
  checksumAlgorithm: 'sha256',
};

export const ENCODING_PROFILES: EncodingProfile[] = [
  LEARNING_PROFILE,
  CONSTRAINT_AWARE_PROFILE,
  ADVANCED_PROFILE,
];

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
