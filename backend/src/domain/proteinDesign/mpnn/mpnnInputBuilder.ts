// ProteinMPNN input (job definition) builder.
//
// Same pattern as the RFD3 input builder: emit a documented, normalized job
// definition that LOCAL/REMOTE runners can hydrate for the installed
// ProteinMPNN variant, and that can be snapshotted for reproducibility.

import { sanitizeName } from '../rfd3/executionModes.js';

export interface MpnnInputs {
  schema_version: 'mpnn-normalized/1';
  design_name: string;
  /** The backbone structure (PDB or mmCIF text) to design sequences for. */
  input_structure: string;
  num_sequences: number;
  temperature: number;
  seed: number;
  /** Chains/positions that must NOT be redesigned (kept as template). */
  fixed_positions: Array<{ chain: string; position: number }>;
  job_kind: 'sequence_design' | 'sequence_optimization';
  custom_parameters: Record<string, unknown>;
}

export interface MpnnDesignRequest {
  runId: string;
  structure: string;
  numSequences: number;
  temperature: number;
  seed: number;
  fixedPositions?: Array<{ chain: string; position: number }>;
  jobKind?: 'sequence_design' | 'sequence_optimization';
  customParameters?: Record<string, unknown>;
}

export function buildMpnnInputs(request: MpnnDesignRequest): MpnnInputs {
  return {
    schema_version: 'mpnn-normalized/1',
    design_name: sanitizeName(request.runId),
    input_structure: request.structure,
    num_sequences: request.numSequences,
    temperature: request.temperature,
    seed: request.seed,
    fixed_positions: request.fixedPositions ?? [],
    job_kind: request.jobKind ?? 'sequence_design',
    custom_parameters: request.customParameters ?? {},
  };
}