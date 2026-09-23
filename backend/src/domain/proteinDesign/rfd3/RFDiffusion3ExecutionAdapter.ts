// RFDiffusion3ExecutionAdapter — the real execution engine for the RFD3 stage.
//
// Environment-driven (RFD3_API_MODE):
//   mock   — deterministic in-process generation (default; byte-identical to the
//            Phase-1 mock so nothing that depended on it changes).
//   local  — spawn the real `rfd3 design` CLI (rc-foundry), normalize `.cif.gz`
//            outputs, enforce subprocess timeout + max concurrency.
//   remote — POST job definitions to a GPU worker gateway and read normalized
//            artifacts back.
//
// All three modes return the same DesignGenerationResult shape, so the design
// lifecycle (persist → validate → rank → ledger) is engine-agnostic.

import type {
  DesignAdapter,
  DesignGenerationResult,
} from '../adapters/DesignAdapter.js';
import type { DesignCandidate, DesignRunRequest } from '../types/index.js';
import {
  loadExecutionConfig,
  type ExecutionConfig,
  type ExecutionMode,
} from './executionModes.js';
import { runMockGeneration } from './mockGeneration.js';
import { buildRfd3Inputs } from './rfd3InputBuilder.js';
import { createRunner, type Rfd3Runner } from './rfd3Runner.js';
import { createHash } from 'node:crypto';

const DEFAULT_CANDIDATES_PER_MODE: Record<string, number> = {
  BINDER: 8,
  STABILIZER: 6,
  DNA_BINDER: 6,
  SINGLE_CHAIN_SCAFFOLD: 10,
  BINDING_POCKET_SCAFFOLD: 10,
  LOOP_SCAFFOLD: 10,
  SYMMETRIC_ASSEMBLY: 4,
  MOTIF_SCAFFOLD: 8,
  ENZYME_RESCUE: 8,
};

export class RFDiffusion3ExecutionAdapter implements DesignAdapter {
  readonly mode: ExecutionMode;
  readonly config: ExecutionConfig;
  private readonly runner: Rfd3Runner | null;
  private readonly mockSeed: number;
  private pending: number;
  private readonly availabilityCache = new Map<ExecutionMode, boolean>();

  constructor(config?: Partial<ExecutionConfig> & { mockSeed?: number }) {
    this.config = { ...loadExecutionConfig(), ...pickConfig(config) };
    this.mode = this.config.mode;
    this.mockSeed = config?.mockSeed ?? 42;
    this.runner = this.mode === 'mock' ? null : createRunner(this.config);
    this.pending = 0;
  }

  async isAvailable(): Promise<boolean> {
    const cached = this.availabilityCache.get(this.mode);
    if (cached !== undefined) return cached;
    let available = false;
    if (this.mode === 'mock') {
      available = true;
    } else if (this.mode === 'local') {
      available = await commandOnPathOrAbsolute(this.config.localBin);
    } else {
      available = Boolean(this.config.remoteUrl);
    }
    this.availabilityCache.set(this.mode, available);
    return available;
  }

  getModelInfo(): { version: string; weightsHash: string } {
    if (this.mode === 'mock') {
      return { version: 'rfd3-mock-v1.0.0', weightsHash: mockWeightsHash() };
    }
    if (this.config.modelVersionOverride && this.config.weightsHashOverride) {
      return {
        version: this.config.modelVersionOverride,
        weightsHash: this.config.weightsHashOverride,
      };
    }
    // No verified weights were provided — surface an honest "unverified" marker
    // in provenance instead of pretending we know a real checkpoint hash.
    const tagHash = createHash('sha256')
      .update(`${this.mode}|${this.config.localBin}|${this.config.localCheckpointDir ?? ''}`)
      .digest('hex')
      .slice(0, 16);
    return { version: `rfd3-${this.mode}-unverified`, weightsHash: `unverified-${tagHash}` };
  }

  // --- Phase C named capabilities -------------------------------------------

  async generateBinder(request: DesignRunRequest): Promise<DesignGenerationResult> {
    return this.dispatch('BINDER', request);
  }

  async generateMotifScaffold(request: DesignRunRequest): Promise<DesignGenerationResult> {
    return this.dispatch('MOTIF_SCAFFOLD', request);
  }

  async generateDnaBinder(request: DesignRunRequest): Promise<DesignGenerationResult> {
    return this.dispatch('DNA_BINDER', request);
  }

  async generateSymmetricAssembly(request: DesignRunRequest): Promise<DesignGenerationResult> {
    return this.dispatch('SYMMETRIC_ASSEMBLY', request);
  }

  async generateProteinScaffold(request: DesignRunRequest): Promise<DesignGenerationResult> {
    return this.dispatch(request.mode, request);
  }

  // --- DesignAdapter interface bridge ----------------------------------------

  async generateStabilizer(request: DesignRunRequest): Promise<DesignGenerationResult> {
    return this.dispatch('STABILIZER', request);
  }

  async generateScaffold(request: DesignRunRequest): Promise<DesignGenerationResult> {
    return this.dispatch(request.mode, request);
  }

  // --- Core ------------------------------------------------------------------

  private async dispatch(mode: DesignModeKey, request: DesignRunRequest): Promise<DesignGenerationResult> {
    const count = request.parameters.numDesigns ?? DEFAULT_CANDIDATES_PER_MODE[mode] ?? 8;
    if (this.mode === 'mock') {
      return { ...runMockGeneration(request, count, this.mockSeed), runId: request.runId };
    }
    const seed = request.parameters.seed ?? deriveSeed(request.runId);
    const inputs = buildRfd3Inputs(mode, request);
    await this.acquireSlot();
    try {
      const summary = await this.runner!.run(request.runId, inputs, seed, this.config.artifactDir);
      const candidates = normalizeOutputs(request, summary.outputs, summary.seed, this.mode);
      const { version: modelVersion, weightsHash } = this.getModelInfo();
      return {
        runId: request.runId,
        candidates,
        modelVersion,
        weightsHash,
        seed: summary.seed,
        executionTimeMs: summary.executionTimeMs,
      };
    } finally {
      this.pending--;
    }
  }

  private async acquireSlot(): Promise<void> {
    while (this.pending >= this.config.maxConcurrency) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    this.pending++;
  }
}

// --- helpers ------------------------------------------------------------------

type DesignModeKey = string;

function pickConfig(config: Partial<ExecutionConfig> & { mockSeed?: number } | undefined) {
  if (!config) return {} as Partial<ExecutionConfig>;
  const { mockSeed: _drop, ...rest } = config;
  return rest;
}

function mockWeightsHash(): string {
  return 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';
}

export function deriveSeed(runId: string): number {
  let hash = 0;
  for (let i = 0; i < runId.length; i++) {
    hash = (hash * 31 + runId.charCodeAt(i)) >>> 0;
  }
  return hash % 2 ** 31;
}

function normalizeOutputs(
  request: DesignRunRequest,
  outputs: { path: string; sequence?: string; structureText: string; chains: string[]; residueCount: number }[],
  seed: number,
  mode: ExecutionMode,
): DesignCandidate[] {
  return outputs.map((out, i) => ({
    id: `cand_${request.runId}_${i}`,
    runId: request.runId,
    structure: out.structureText,
    sequence: out.sequence,
    rankedPosition: i + 1,
    metrics: {
      chains: out.chains,
      residueCount: out.residueCount,
      format: 'mmCIF',
      source: mode,
      artifactPath: out.path,
      seed,
      estimatorNote:
        'structural confidence (pLDDT/pTM/ipTM) is computed downstream by DesignValidationEngine; ' +
        'the adapter reports only what the RFD3 artifact literally contains.',
    },
    createdAt: new Date(),
  }));
}

async function commandOnPathOrAbsolute(bin: string): Promise<boolean> {
  if (bin.includes('/') || bin.includes('\\')) {
    // Absolute / relative path.
    const { access } = await import('node:fs/promises');
    try {
      await access(bin);
      return true;
    } catch {
      return false;
    }
  }
  const pathDirs = (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':');
  const exts = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
  const { access } = await import('node:fs/promises');
  for (const dir of pathDirs) {
    for (const ext of exts) {
      try {
        await access(`${dir}${bin}${ext}`);
        return true;
      } catch {
        /* keep looking */
      }
    }
  }
  return false;
}