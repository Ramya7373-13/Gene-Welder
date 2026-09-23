// RFD3 input (job definition) builder.
//
// RFD3's CLI is hydra-style (`rfd3 design out_dir=... inputs=<json|yaml>`); the
// exact input schema is version-bound to the installed rc-foundry checkpoint,
// so this module emits a *documented, version-independent normalized job
// definition* that the LOCAL/REMOTE runners can hydrate into a concrete
// `inputs.json` on a configured host. The same object is snapshotted into the
// DesignRun conditioning, which keeps every run reproducible from its ledger.
//
// Everything here is a pure function of the request + mode: same input in,
// same JSON out (deterministic), which is what makes mock/local/remote runs
// comparable and re-runnable.

import type { DesignRunRequest } from '../types/index.js';
import { sanitizeName } from './executionModes.js';

export type Rfd3TaskName =
  | 'binder'
  | 'stabilizer'
  | 'dna_binder'
  | 'protein_scaffold'
  | 'symmetric_assembly'
  | 'motif_scaffold'
  | 'enzyme_rescue';

export interface Rfd3TaskDefinition {
  name: Rfd3TaskName;
  /** Number of RFD3 batches (each batch yields one design of a sampled length). */
  n_batches: number;
  diffusion_steps: number | undefined;
  temperature: number | undefined;
  top_p: number | undefined;
  seed: number | undefined;
  noise_scale: number | undefined;
}

export interface Rfd3Inputs {
  schema_version: 'rfd3-normalized/1';
  design_name: string;
  task: Rfd3TaskDefinition;
  /** Incoming structure content or reference. In mock mode this is omitted. */
  target_structure?: string;
  target_chain?: string;
  target_sequence?: string;
  /** Explicit user constraints, normalized. */
  conditioning: Record<string, unknown>;
  /** Engines can tag extra knobs that are passed straight through. */
  custom_parameters: Record<string, unknown>;
}

/** Map a DesignMode to the RFD3 task this adapter treats it as. */
export function taskForMode(mode: string): Rfd3TaskName {
  switch (mode) {
    case 'BINDER':
      return 'binder';
    case 'STABILIZER':
      return 'stabilizer';
    case 'DNA_BINDER':
      return 'dna_binder';
    case 'SINGLE_CHAIN_SCAFFOLD':
    case 'BINDING_POCKET_SCAFFOLD':
    case 'LOOP_SCAFFOLD':
      return 'protein_scaffold';
    case 'SYMMETRIC_ASSEMBLY':
      return 'symmetric_assembly';
    case 'MOTIF_SCAFFOLD':
      return 'motif_scaffold';
    case 'ENZYME_RESCUE':
      return 'enzyme_rescue';
    default:
      return 'protein_scaffold';
  }
}

/** Build the normalized RFD3 job definition for a mode-specific request. */
export function buildRfd3Inputs(
  mode: string,
  request: DesignRunRequest,
): Rfd3Inputs {
  const task = taskForMode(mode);
  const params = request.parameters ?? {};
  const conditioning = request.conditioning;

  const inputs: Rfd3Inputs = {
    schema_version: 'rfd3-normalized/1',
    design_name: sanitizeName(request.runId),
    task: {
      name: task,
      n_batches: 1,
      diffusion_steps: clampStep(params.diffusionSteps),
      temperature: numberOrUndefined(params.temperature),
      top_p: numberOrUndefined(params.topP),
      seed: seedFor(request),
      noise_scale: numberOrUndefined(params.noiseScale),
    },
    conditioning: { ...normalizeConditioning(conditioning), designMode: mode },
    custom_parameters: {},
  };

  if (typeof conditioning.targetStructure === 'string' && conditioning.targetStructure.length > 0) {
    inputs.target_structure = conditioning.targetStructure;
  }
  if (request.targetSequence) inputs.target_sequence = request.targetSequence;

  const custom = params.customParameters;
  if (custom && typeof custom === 'object') {
    Object.assign(inputs.custom_parameters, custom);
  }
  return inputs;
}

function normalizeConditioning(conditioning: DesignRunRequest['conditioning']): Record<string, unknown> {
  const out: Record<string, unknown> = {
    hotspots: conditioning.hotspots.map((h) => ({ ...h })),
  };
  if (conditioning.burialDepth?.length) out.burialDepth = conditioning.burialDepth;
  if (conditioning.hydrogenBonds?.length) out.hydrogenBonds = conditioning.hydrogenBonds;
  if (conditioning.interfaceRegions?.length) out.interfaceRegions = conditioning.interfaceRegions;
  if (conditioning.motifSpec) out.motifSpec = conditioning.motifSpec;
  if (conditioning.centerOfMass) out.centerOfMass = conditioning.centerOfMass;
  if (conditioning.customConstraints) out.customConstraints = conditioning.customConstraints;
  return out;
}

/** Deterministic seed: explicit seed wins, else derived from the run id. */
export function seedFor(request: DesignRunRequest): number {
  if (typeof request.parameters?.seed === 'number' && request.parameters.seed >= 0) {
    return Math.floor(request.parameters.seed);
  }
  let hash = 0;
  for (let i = 0; i < request.runId.length; i++) {
    hash = (hash * 31 + request.runId.charCodeAt(i)) >>> 0;
  }
  return hash % 2 ** 31;
}

export function clampStep(steps: number | undefined): number | undefined {
  if (steps === undefined || steps === null) return undefined;
  return Math.min(1000, Math.max(1, Math.floor(steps)));
}

function numberOrUndefined(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}