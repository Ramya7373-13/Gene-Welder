// Domain types for the DNA Archive Lab in-silico DNA data-storage simulator.
// This module is software-only: it models computational encoding of digital data
// into DNA sequences and simulated channel errors. It contains no laboratory,
// synthesis, or biological-experimentation content.

export type DnaBase = "A" | "C" | "G" | "T";

export interface EncodingProfile {
  id: string;
  name: string;
  description: string;
  mode: "learning" | "constraint-aware" | "advanced";
  maxPayloadBases: number;
  maxHomopolymerLength: number;
  minGcPercent: number;
  maxGcPercent: number;
  redundancyFactor: number;
  checksumAlgorithm: "sha256" | "crc32";
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

// Job abstraction: interface now, synchronous implementation later; designed so a
// queue-backed runner could be swapped in without touching callers.
export type JobKind = "encode" | "simulate" | "decode";

export interface DnaStorageJob {
  kind: JobKind;
  experimentId: string;
  input: unknown;
}

export interface DnaStorageJobResult {
  ok: boolean;
  status: DnaStorageExperimentStatus;
  output?: unknown;
  error?: string;
}

export type DnaStorageExperimentStatus =
  | "DRAFT" | "ENCODING" | "ENCODED" | "SIMULATING" | "DECODING" | "COMPLETED" | "FAILED";

export interface DnaStorageJobRunner {
  run(job: DnaStorageJob): Promise<DnaStorageJobResult>;
}

export const PRNG_NAME = "mulberry32";
export const PRNG_VERSION = "1.0.0";

export interface SeededRandom {
  next(): number;          // uniform [0, 1)
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
}
