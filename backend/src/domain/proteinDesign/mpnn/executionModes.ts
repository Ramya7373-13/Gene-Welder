// ProteinMPNN execution mode configuration.
//
// Mirrors the RFD3 adapter contract: `MPNN_API_MODE` picks the engine
// (mock | local | remote), every other variable tunes that mode, and the mode
// is fixed at construction so a process cannot silently flip execution mid-run.

import os from 'node:os';
import path from 'node:path';

export type MpnnExecutionMode = 'mock' | 'local' | 'remote';

export interface MpnnExecutionConfig {
  mode: MpnnExecutionMode;
  /** CLI invoked in LOCAL mode (e.g. `protein_mpnn` or an absolute path). */
  localBin: string;
  /** Optional prefix tokens for LOCAL execution (conda/WSL), split on whitespace. */
  localEnvPrefix: string[];
  remoteUrl?: string;
  remoteApiKey?: string;
  /** Hard kill after this long in LOCAL/REMOTE execution. */
  jobTimeoutMs: number;
  maxConcurrency: number;
  /** Default number of sequences per target. */
  numSequencesPerTarget: number;
  /** Default sampling temperature. */
  temperature: number;
  artifactDir: string;
  modelVersionOverride?: string;
  weightsHashOverride?: string;
}

export const DEFAULT_MPNN_MODEL_VERSION = 'proteinmpnn-mock-v1.0.0';
export const DEFAULT_MPNN_WEIGHTS_HASH =
  'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';

function splitPrefix(value: string | undefined): string[] {
  if (!value || value.trim() === '') return [];
  return value.trim().split(/\s+/);
}

function requireUrl(mode: MpnnExecutionMode, remoteUrl?: string): string {
  if (mode === 'remote' && !remoteUrl) {
    throw new Error(
      'MPNN_API_MODE=remote requires MPNN_REMOTE_URL (e.g. http://worker-gateway:8080/v1/mpnn)',
    );
  }
  return remoteUrl ?? '';
}

export function loadMpnnConfig(env: NodeJS.ProcessEnv = process.env): MpnnExecutionConfig {
  const rawMode = (env.MPNN_API_MODE ?? 'mock').toLowerCase();
  const mode: MpnnExecutionMode =
    rawMode === 'local' || rawMode === 'remote' ? rawMode : 'mock';

  return {
    mode,
    localBin: env.MPNN_LOCAL_BIN ?? 'protein_mpnn',
    localEnvPrefix: splitPrefix(
      env.MPNN_LOCAL_ENV ?? (mode === 'local' && os.platform() === 'win32' ? 'wsl -e bash -lc' : undefined),
    ),
    remoteUrl: requireUrl(mode, env.MPNN_REMOTE_URL),
    remoteApiKey: env.MPNN_REMOTE_API_KEY,
    jobTimeoutMs: parseInt(env.MPNN_JOB_TIMEOUT_MS ?? '900000', 10),
    maxConcurrency: clampInt(env.MPNN_MAX_CONCURRENCY, 1, 64, 1),
    numSequencesPerTarget: clampInt(env.MPNN_NUM_SEQUENCES, 1, 200, 8),
    temperature: clampFloat(env.MPNN_TEMPERATURE, 0, 10, 0.1),
    artifactDir: env.MPNN_ARTIFACT_DIR ?? path.join(process.cwd(), 'artifacts', 'mpnn'),
    modelVersionOverride: env.MPNN_MODEL_VERSION,
    weightsHashOverride: env.MPNN_WEIGHTS_HASH,
  };
}

function clampInt(raw: string | undefined, min: number, max: number, fallback: number): number {
  const parsed = parseInt(raw ?? '', 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function clampFloat(raw: string | undefined, min: number, max: number, fallback: number): number {
  const parsed = parseFloat(raw ?? '');
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** Deterministic PRNG for mock sequence sampling (LCG, matching RFD3 mock). */
export function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return (state >> 16) / 0x8000;
  };
}