// Execution mode configuration for the RFD3 adapter.
//
// The adapter supports three modes, switched entirely by environment:
//   mock   - deterministic in-process generation (default; zero external deps)
//   local  - spawn the real `rfd3 design` CLI on this host (or WSL, see below)
//   remote - POST job definitions to a GPU worker pool
//
// Design decisions:
//   * The mode is read once at construction so a process cannot silently flip
//     execution semantics mid-run. Switching modes requires a restart.
//   * `RFD3_API_MODE` alone decides the mode; every other variable tunes the
//     chosen mode and is ignored otherwise.
//   * No new npm dependencies are required to run real inference: LOCAL spawns
//     a subprocess, REMOTE uses the global `fetch`, and both reuse the same
//     artifact-normalization path.

import os from 'node:os';
import path from 'node:path';

export type ExecutionMode = 'mock' | 'local' | 'remote';

export interface ExecutionConfig {
  mode: ExecutionMode;
  /** Binary invoked in LOCAL mode (e.g. `rfd3` or an absolute path). */
  localBin: string;
  /**
   * Optional prefix tokens for LOCAL execution, e.g. `conda run -n rfd3` or a
   * WSL shim (`wsl -e bash -lc`). Split on whitespace; empty means none.
   */
  localEnvPrefix: string[];
  /** Absolute path to checkpoints override; falls back to FOUNDRY_CHECKPOINT_DIRS. */
  localCheckpointDir?: string;
  /** Remote gateway (REMOTE mode). */
  remoteUrl?: string;
  /** Bearer token for the remote gateway. */
  remoteApiKey?: string;
  /** Hard kill after this long in LOCAL/REMOTE execution. */
  jobTimeoutMs: number;
  /** Maximum simultaneous runs per process (LOCAL honors this for concurrency). */
  maxConcurrency: number;
  /** RFD3 batched-inference batches per run (`n_batches`). */
  nBatchesPerRun: number;
  /** Base directory for design artifacts. */
  artifactDir: string;
  /** Overrides for real-model provenance when running local/remote. */
  modelVersionOverride?: string;
  weightsHashOverride?: string;
}

export const DEFAULT_MODEL_VERSION = 'rfd3-mock-v1.0.0';
export const DEFAULT_WEIGHTS_HASH =
  'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

function splitPrefix(value: string | undefined): string[] {
  if (!value || value.trim() === '') return [];
  return value.trim().split(/\s+/);
}

function requireUrl(mode: ExecutionMode, remoteUrl?: string): string {
  if (mode === 'remote' && !remoteUrl) {
    throw new Error(
      'RFD3_API_MODE=remote requires RFD3_REMOTE_URL (e.g. http://worker-gateway:8080/v1/rfd3)',
    );
  }
  return remoteUrl ?? '';
}

export function loadExecutionConfig(env: NodeJS.ProcessEnv = process.env): ExecutionConfig {
  const rawMode = (env.RFD3_API_MODE ?? 'mock').toLowerCase();
  const mode: ExecutionMode =
    rawMode === 'local' || rawMode === 'remote' ? rawMode : 'mock';

  const artifactDir =
    env.RFD3_ARTIFACT_DIR ?? path.join(process.cwd(), 'artifacts', 'rfd3');

  return {
    mode,
    localBin: env.RFD3_LOCAL_BIN ?? 'rfd3',
    localEnvPrefix: splitPrefix(
      env.RFD3_LOCAL_ENV ?? (mode === 'local' && isWindows() ? 'wsl -e bash -lc' : undefined),
    ),
    localCheckpointDir: env.RFD3_LOCAL_CHECKPOINT_DIR ?? env.FOUNDRY_CHECKPOINT_DIRS,
    remoteUrl: requireUrl(mode, env.RFD3_REMOTE_URL),
    remoteApiKey: env.RFD3_REMOTE_API_KEY,
    jobTimeoutMs: parseInt(env.RFD3_JOB_TIMEOUT_MS ?? '1800000', 10),
    maxConcurrency: clampInt(env.RFD3_MAX_CONCURRENCY, 1, 64, 1),
    nBatchesPerRun: clampInt(env.RFD3_N_BATCHES_PER_RUN, 1, 128, 1),
    artifactDir,
    modelVersionOverride: env.RFD3_MODEL_VERSION,
    weightsHashOverride: env.RFD3_WEIGHTS_HASH,
  };
}

function isWindows(): boolean {
  return os.platform() === 'win32';
}

function clampInt(raw: string | undefined, min: number, max: number, fallback: number): number {
  const parsed = parseInt(raw ?? '', 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** Normalize an identifier for use as a file/design name (rfd3 design_name). */
export function sanitizeName(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 120);
}