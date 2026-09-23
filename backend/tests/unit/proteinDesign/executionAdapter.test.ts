import { describe, it, expect, afterEach, beforeEach } from '@jest/globals';
import { RFDiffusion3ExecutionAdapter } from '../../../src/domain/proteinDesign/rfd3/RFDiffusion3ExecutionAdapter.js';
import { DesignMode, type DesignRunRequest } from '../../../src/domain/proteinDesign/types/index.js';

const ENV_KEYS = [
  'RFD3_API_MODE',
  'RFD3_REMOTE_URL',
  'RFD3_REMOTE_API_KEY',
  'RFD3_LOCAL_BIN',
  'RFD3_JOB_TIMEOUT_MS',
  'RFD3_MAX_CONCURRENCY',
  'RFD3_ARTIFACT_DIR',
];

function makeRequest(mode: DesignMode, overrides: Partial<DesignRunRequest> = {}): DesignRunRequest {
  return {
    runId: `run_${mode.toLowerCase()}_1`,
    projectId: 'proj_1',
    mode,
    parameters: {},
    conditioning: {
      hotspots: [],
      burialDepth: [],
      hydrogenBonds: [],
      interfaceRegions: [],
      targetStructure: '',
      designMode: mode,
    },
    ...overrides,
  };
}

describe('RFDiffusion3ExecutionAdapter', () => {
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
    const adapter = new RFDiffusion3ExecutionAdapter();
    expect(adapter.mode).toBe('mock');
    expect(adapter.getModelInfo().version).toBe('rfd3-mock-v1.0.0');
  });

  it('mock mode is deterministic across instances for the same seed', async () => {
    const a = new RFDiffusion3ExecutionAdapter({ mockSeed: 42 });
    const b = new RFDiffusion3ExecutionAdapter({ mockSeed: 42 });
    const ra = await a.generateBinder(makeRequest(DesignMode.BINDER));
    const rb = await b.generateBinder(makeRequest(DesignMode.BINDER));
    expect(ra.candidates[0].sequence).toBe(rb.candidates[0].sequence);
    expect(ra.candidates[0].structure).toBe(rb.candidates[0].structure);
  });

  it('mock mode produces the number of designs requested (defaults per mode)', async () => {
    const adapter = new RFDiffusion3ExecutionAdapter({ mockSeed: 42 });
    const binder = await adapter.generateBinder(makeRequest(DesignMode.BINDER));
    expect(binder.candidates).toHaveLength(8);
    const sym = await adapter.generateSymmetricAssembly(makeRequest(DesignMode.SYMMETRIC_ASSEMBLY));
    expect(sym.candidates).toHaveLength(4);
    const custom = await adapter.generateBinder(
      makeRequest(DesignMode.BINDER, { parameters: { numDesigns: 3 } }),
    );
    expect(custom.candidates).toHaveLength(3);
  });

  it('exposes all six DesignAdapter entry points', async () => {
    const adapter = new RFDiffusion3ExecutionAdapter({ mockSeed: 1 });
    const calls = [
      adapter.generateBinder(makeRequest(DesignMode.BINDER)),
      adapter.generateStabilizer(makeRequest(DesignMode.STABILIZER)),
      adapter.generateDnaBinder(makeRequest(DesignMode.DNA_BINDER)),
      adapter.generateScaffold(makeRequest(DesignMode.SCAFFOLD)),
      adapter.generateSymmetricAssembly(makeRequest(DesignMode.SYMMETRIC_ASSEMBLY)),
      adapter.generateMotifScaffold(makeRequest(DesignMode.MOTIF_SCAFFOLD)),
    ];
    const results = await Promise.all(calls);
    for (const r of results) {
      expect(r.runId).toBeTruthy();
      expect(r.candidates.length).toBeGreaterThan(0);
      expect(r.modelVersion).toBe('rfd3-mock-v1.0.0');
    }
  });

  it('has an isAvailable() = true in mock mode', async () => {
    await expect(new RFDiffusion3ExecutionAdapter().isAvailable()).resolves.toBe(true);
  });

  it('throws at construction when remote mode lacks a gateway URL', () => {
    process.env.RFD3_API_MODE = 'remote';
    expect(() => new RFDiffusion3ExecutionAdapter()).toThrow(/RFD3_REMOTE_URL/);
  });

  it('reports honest unverified provenance when no weights override is given', () => {
    process.env.RFD3_API_MODE = 'remote';
    process.env.RFD3_REMOTE_URL = 'http://gateway.test/v1/rfd3';
    const adapter = new RFDiffusion3ExecutionAdapter();
    expect(adapter.mode).toBe('remote');
    expect(adapter.getModelInfo().version).toBe('rfd3-remote-unverified');
    expect(adapter.getModelInfo().weightsHash).toMatch(/^unverified-/);
    expect(adapter.isAvailable()).resolves.toBe(true);
  });

  it('uses model version/hash overrides verbatim when provided', () => {
    process.env.RFD3_API_MODE = 'remote';
    process.env.RFD3_REMOTE_URL = 'http://gateway.test/v1/rfd3';
    process.env.RFD3_MODEL_VERSION = 'rfd3-0.6.1';
    process.env.RFD3_WEIGHTS_HASH = 'deadbeef';
    const adapter = new RFDiffusion3ExecutionAdapter();
    expect(adapter.getModelInfo()).toEqual({ version: 'rfd3-0.6.1', weightsHash: 'deadbeef' });
  });

  it('generateProteinScaffold dispatches the request mode', async () => {
    const adapter = new RFDiffusion3ExecutionAdapter({ mockSeed: 2 });
    const request = makeRequest(DesignMode.SCAFFOLD);
    const result = await adapter.generateProteinScaffold(request);
    expect(result.candidates.length).toBeGreaterThan(0);
  });
});