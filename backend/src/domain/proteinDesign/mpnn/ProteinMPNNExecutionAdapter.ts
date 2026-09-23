// ProteinMPNNExecutionAdapter — the real sequence-design engine for the MPNN
// stage. Environment-driven (MPNN_API_MODE: mock | local | remote), with all
// three avenues returning the same result shape.
//
// Capabilities (Phase D spec):
//   sequenceDesign()      — sample de novo sequences for a backbone
//   sequenceOptimization()— iteratively improve sequences for a backbone
//   sequenceRanking()     — score/rank a set of candidate sequences

import { createHash } from 'node:crypto';
import type { ProteinMpnnAdapter, ProteinMpnnResult, SequenceDesignOptions } from './ProteinMpnnAdapter.js';
import {
  DEFAULT_MPNN_MODEL_VERSION,
  DEFAULT_MPNN_WEIGHTS_HASH,
  loadMpnnConfig,
  type MpnnExecutionConfig,
  type MpnnExecutionMode,
} from './executionModes.js';
import {
  designMockSequences,
  inferStructureLength,
  optimizeMockSequence,
  rankMockSequences,
} from './mockSequence.js';
import { buildMpnnInputs } from './mpnnInputBuilder.js';
import { createMpnnRunner, type MpnnRunner } from './mpnnRunner.js';

export interface MpnnCandidate {
  sequence: string;
  score: number;
  rank: number;
}

export class ProteinMPNNExecutionAdapter implements ProteinMpnnAdapter {
  readonly mode: MpnnExecutionMode;
  readonly config: MpnnExecutionConfig;
  private readonly runner: MpnnRunner | null;
  private readonly mockSeed: number;
  private pending: number;

  constructor(config?: Partial<MpnnExecutionConfig> & { mockSeed?: number }) {
    this.config = { ...loadMpnnConfig(), ...pickMpnnConfig(config) };
    this.mode = this.config.mode;
    this.mockSeed = config?.mockSeed ?? 7;
    this.runner = this.mode === 'mock' ? null : createMpnnRunner(this.config);
    this.pending = 0;
  }

  // --- ProteinMpnnAdapter interface ------------------------------------------

  designSequence(structure: string, options?: SequenceDesignOptions): Promise<ProteinMpnnResult[]> {
    return this.sequenceDesign(structure, options);
  }

  async isAvailable(): Promise<boolean> {
    if (this.mode === 'mock') return true;
    if (this.mode === 'remote') return Boolean(this.config.remoteUrl);
    return commandOnPathOrAbsolute(this.config.localBin);
  }

  getModelInfo(): { version: string; weightsHash: string } {
    if (this.mode === 'mock') {
      return { version: DEFAULT_MPNN_MODEL_VERSION, weightsHash: DEFAULT_MPNN_WEIGHTS_HASH };
    }
    if (this.config.modelVersionOverride && this.config.weightsHashOverride) {
      return {
        version: this.config.modelVersionOverride,
        weightsHash: this.config.weightsHashOverride,
      };
    }
    const tagHash = createHash('sha256')
      .update(`${this.mode}|${this.config.localBin}`)
      .digest('hex')
      .slice(0, 16);
    return { version: `proteinmpnn-${this.mode}-unverified`, weightsHash: `unverified-${tagHash}` };
  }

  // --- Phase D named capabilities ---------------------------------------------

  /** Sample `numSequences` sequences for a backbone structure. */
  async sequenceDesign(structure: string, options?: SequenceDesignOptions): Promise<ProteinMpnnResult[]> {
    const numSequences = options?.numSequences ?? this.config.numSequencesPerTarget;
    const seed = options?.seed ?? this.mockSeed;
    const temperature = options?.temperature ?? this.config.temperature;

    if (this.mode === 'mock') {
      const length = inferStructureLength(structure) ?? 80;
      return designMockSequences(length, numSequences, seed, temperature);
    }

    const inputs = buildMpnnInputs({
      runId: `mpnn_design_${seed}`,
      structure,
      numSequences,
      temperature,
      seed,
      fixedPositions: options?.fixedPositions,
    });
    return this.execute(inputs, seed);
  }

  /** Iteratively improve sequences for a backbone (best-of-N sampling). */
  async sequenceOptimization(
    structure: string,
    options?: SequenceDesignOptions,
  ): Promise<ProteinMpnnResult> {
    const seed = options?.seed ?? this.mockSeed;
    const temperature = options?.temperature ?? this.config.temperature;
    if (this.mode === 'mock') {
      const length = inferStructureLength(structure) ?? 80;
      return optimizeMockSequence(length, seed, temperature);
    }
    const inputs = buildMpnnInputs({
      runId: `mpnn_optimize_${seed}`,
      structure,
      numSequences: 5,
      temperature,
      seed,
      fixedPositions: options?.fixedPositions,
      jobKind: 'sequence_optimization',
    });
    const results = await this.execute(inputs, seed);
    // Optimization returns the single best result.
    return results.reduce((best, r) => (r.score > best.score ? r : best), results[0] as ProteinMpnnResult);
  }

  /** Score/rank candidate sequences against a backbone. */
  async sequenceRanking(structure: string, sequences: string[]): Promise<MpnnCandidate[]> {
    if (this.mode === 'mock') {
      return rankMockSequences(sequences).map((r) => ({
        sequence: r.sequence,
        score: r.score,
        rank: r.rank,
      }));
    }
    const seed = this.mockSeed;
    const inputs = {
      schema_version: 'mpnn-normalized/1',
      design_name: `mpnn_rank_${seed}`,
      input_structure: structure,
      num_sequences: sequences.length,
      temperature: 0.1,
      seed,
      fixed_positions: [],
      job_kind: 'sequence_ranking',
      custom_parameters: { candidate_sequences: sequences },
    };
    const results = await this.execute(inputs, seed);
    return results
      .map((r, i) => ({ sequence: r.sequence, score: r.score, rank: i + 1 }))
      .sort((a, b) => b.score - a.score)
      .map((entry, i) => ({ ...entry, rank: i + 1 }));
  }

  // --- Core -------------------------------------------------------------------

  private async execute(inputs: unknown, seed: number): Promise<ProteinMpnnResult[]> {
    if (this.mode === 'mock') throw new Error('mock execution must be handled before execute()');
    await this.acquireSlot();
    try {
      const summary = await this.runner!.run(`mpnn_${seed}`, inputs, seed);
      return summary.outputs.map((o) => ({
        sequence: o.sequence,
        score: o.score,
        confidence: clampConfidence(o.score),
        positionScores: [],
      }));
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

function pickMpnnConfig(config: Partial<MpnnExecutionConfig> & { mockSeed?: number } | undefined) {
  if (!config) return {} as Partial<MpnnExecutionConfig>;
  const { mockSeed: _drop, ...rest } = config;
  return rest;
}

function clampConfidence(score: number): number {
  return Math.min(0.99, Math.max(0.05, 0.5 + score * 0.5));
}

async function commandOnPathOrAbsolute(bin: string): Promise<boolean> {
  const { access } = await import('node:fs/promises');
  if (bin.includes('/') || bin.includes('\\')) {
    try {
      await access(bin);
      return true;
    } catch {
      return false;
    }
  }
  const dirs = (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':');
  const exts = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
  for (const dir of dirs) {
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