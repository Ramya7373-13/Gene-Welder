import { describe, it, expect, afterEach, beforeEach } from '@jest/globals';
import { ProteinMPNNExecutionAdapter } from '../../../src/domain/proteinDesign/mpnn/ProteinMPNNExecutionAdapter.js';

const ENV_KEYS = [
  'MPNN_API_MODE',
  'MPNN_REMOTE_URL',
  'MPNN_REMOTE_API_KEY',
  'MPNN_LOCAL_BIN',
  'MPNN_JOB_TIMEOUT_MS',
  'MPNN_MAX_CONCURRENCY',
  'MPNN_ARTIFACT_DIR',
];

const SAMPLE_PDB = [
  'ATOM      1  N   ALA A   1      11.104   13.207   10.000  1.00  0.00           N',
  'ATOM      2  CA  ALA A   1      12.403   13.746   10.440  1.00  0.00           C',
  'ATOM      3  C   ALA A   1      13.488   12.823    9.883  1.00  0.00           C',
  'ATOM      4  O   ALA A   1      13.232   12.197    8.854  1.00  0.00           O',
  'TER',
  'END',
].join('\n');

describe('ProteinMPNNExecutionAdapter', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  it('defaults to mock mode with no environment', () => {
    const adapter = new ProteinMPNNExecutionAdapter();
    expect(adapter.mode).toBe('mock');
    expect(adapter.getModelInfo().version).toBe('proteinmpnn-mock-v1.0.0');
    expect(adapter.getModelInfo().weightsHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('mock sequence design is deterministic for the same seed', async () => {
    const a = new ProteinMPNNExecutionAdapter({ mockSeed: 7 });
    const b = new ProteinMPNNExecutionAdapter({ mockSeed: 7 });
    const [ra, rb] = await Promise.all([
      a.sequenceDesign(SAMPLE_PDB, { numSequences: 4 }),
      b.sequenceDesign(SAMPLE_PDB, { numSequences: 4 }),
    ]);
    expect(ra).toEqual(rb);
    expect(ra).toHaveLength(4);
  });

  it('sequenceDesign infers the backbone length from the structure', async () => {
    const adapter = new ProteinMPNNExecutionAdapter({ mockSeed: 7 });
    const results = await adapter.sequenceDesign(SAMPLE_PDB, { numSequences: 3 });
    for (const r of results) {
      expect(r.sequence).toHaveLength(1);
      expect(r.positionScores).toHaveLength(1);
    }
  });

  it('owns the legacy ProteinMpnnAdapter entry point', async () => {
    const adapter = new ProteinMPNNExecutionAdapter({ mockSeed: 7 });
    const viaLegacy = await adapter.designSequence(SAMPLE_PDB, { numSequences: 2 });
    const viaNamed = await adapter.sequenceDesign(SAMPLE_PDB, { numSequences: 2 });
    expect(viaLegacy).toEqual(viaNamed);
    await expect(adapter.isAvailable()).resolves.toBe(true);
  });

  it('sequenceOptimization returns a single result that is the best of several', async () => {
    const adapter = new ProteinMPNNExecutionAdapter({ mockSeed: 3 });
    const optimized = await adapter.sequenceOptimization(SAMPLE_PDB, {
      numSequences: 5,
    });
    const candidates = await adapter.sequenceDesign(SAMPLE_PDB, { numSequences: 5, seed: 3 });
    const best = candidates.reduce((a, b) => (b.score > a.score ? b : a), candidates[0]);
    expect(optimized.score).toBeGreaterThanOrEqual(best.score - 1e-9);
    expect(optimized.sequence.length).toBe(optimized.positionScores.length);
  });

  it('sequenceRanking orders candidates best-first with 1-based ranks', async () => {
    const adapter = new ProteinMPNNExecutionAdapter({ mockSeed: 2 });
    const { designMockSequences } = await import(
      '../../../src/domain/proteinDesign/mpnn/mockSequence.js'
    );
    const pool = designMockSequences(20, 6, 2, 0.1).map((s) => s.sequence);
    const ranked = await adapter.sequenceRanking(SAMPLE_PDB, pool);
    expect(ranked).toHaveLength(pool.length);
    expect(new Set(ranked.map((r) => r.rank))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
    for (let i = 0; i < ranked.length - 1; i++) {
      expect(ranked[i].score).toBeGreaterThanOrEqual(ranked[i + 1].score);
    }
  });

  it('remote mode requires a remote URL and reports unverified provenance', () => {
    process.env.MPNN_API_MODE = 'remote';
    expect(() => new ProteinMPNNExecutionAdapter()).toThrow(/MPNN_REMOTE_URL/);
    process.env.MPNN_REMOTE_URL = 'http://worker-gateway:8080/v1/mpnn';
    const adapter = new ProteinMPNNExecutionAdapter();
    expect(adapter.mode).toBe('remote');
    const info = adapter.getModelInfo();
    expect(info.version).toContain('unverified');
    expect(info.weightsHash).toContain('unverified-');
  });

  it('local mode loads from configured env and reports unverified provenance', async () => {
    process.env.MPNN_API_MODE = 'local';
    process.env.MPNN_LOCAL_BIN = 'definitely-not-a-real-protein-mpnn-binary';
    const adapter = new ProteinMPNNExecutionAdapter();
    expect(adapter.mode).toBe('local');
    await expect(adapter.isAvailable()).resolves.toBe(false);
    const info = adapter.getModelInfo();
    expect(info.version).toContain('unverified');
  });

  it('real modes report explicit provenance when overrides are supplied', () => {
    process.env.MPNN_API_MODE = 'local';
    process.env.MPNN_LOCAL_BIN = 'definitely-not-a-real-protein-mpnn-binary';
    process.env.MPNN_MODEL_VERSION = 'proteinmpnn-v48-01302024';
    process.env.MPNN_WEIGHTS_HASH = 'abc123';
    const adapter = new ProteinMPNNExecutionAdapter();
    expect(adapter.getModelInfo()).toEqual({
      version: 'proteinmpnn-v48-01302024',
      weightsHash: 'abc123',
    });
  });
});