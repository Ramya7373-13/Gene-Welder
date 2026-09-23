import { describe, it, expect } from '@jest/globals';
import { buildRfd3Inputs, taskForMode, seedFor } from '../../../src/domain/proteinDesign/rfd3/rfd3InputBuilder.js';
import type { DesignRunRequest } from '../../../src/domain/proteinDesign/types/index.js';

function makeRequest(overrides: Partial<DesignRunRequest> = {}): DesignRunRequest {
  return {
    runId: 'run_abc123',
    projectId: 'proj_1',
    mode: 'BINDER' as DesignRunRequest['mode'],
    parameters: {},
    conditioning: {
      hotspots: [],
      burialDepth: [],
      hydrogenBonds: [],
      interfaceRegions: [],
      targetStructure: '',
      designMode: 'BINDER' as DesignRunRequest['conditioning']['designMode'],
    },
    ...overrides,
  };
}

describe('buildRfd3Inputs', () => {
  it('emits a normalized v1 job definition with expected schema', () => {
    const inputs = buildRfd3Inputs('BINDER', makeRequest());
    expect(inputs.schema_version).toBe('rfd3-normalized/1');
    expect(inputs.design_name).toMatch(/^[A-Za-z0-9_.-]+$/);
    expect(inputs.task.name).toBe('binder');
    expect(inputs.task.n_batches).toBe(1);
    expect(inputs.conditioning).toHaveProperty('designMode', 'BINDER');
  });

  it('maps scaffold-family modes to protein_scaffold task', () => {
    for (const mode of ['SINGLE_CHAIN_SCAFFOLD', 'BINDING_POCKET_SCAFFOLD', 'LOOP_SCAFFOLD']) {
      expect(taskForMode(mode)).toBe('protein_scaffold');
    }
    expect(taskForMode('DNA_BINDER')).toBe('dna_binder');
    expect(taskForMode('SYMMETRIC_ASSEMBLY')).toBe('symmetric_assembly');
    expect(taskForMode('ENZYME_RESCUE')).toBe('enzyme_rescue');
    expect(taskForMode('STABILIZER')).toBe('stabilizer');
  });

  it('carries target structure and sequence when present (from conditioning)', () => {
    const inputs = buildRfd3Inputs('BINDER', makeRequest({
      targetSequence: 'ACDEFG',
      conditioning: {
        hotspots: [],
        burialDepth: [],
        hydrogenBonds: [],
        interfaceRegions: [],
        targetStructure: 'ATOM  ...',
        designMode: 'BINDER' as DesignRunRequest['conditioning']['designMode'],
      },
    }));
    expect(inputs.target_structure).toBe('ATOM  ...');
    expect(inputs.target_sequence).toBe('ACDEFG');
  });

  it('is deterministic for the same run id', () => {
    const a = buildRfd3Inputs('BINDER', makeRequest());
    const b = buildRfd3Inputs('BINDER', makeRequest());
    expect(a).toEqual(b);
  });
});

describe('seedFor', () => {
  it('prefers an explicit seed', () => {
    const request = makeRequest({ parameters: { seed: 7 } });
    expect(seedFor(request)).toBe(7);
  });

  it('derives a deterministic seed from the run id otherwise', () => {
    const a = seedFor(makeRequest({ runId: 'run_abc' }));
    const b = seedFor(makeRequest({ runId: 'run_abc' }));
    const c = seedFor(makeRequest({ runId: 'run_abd' }));
    expect(a).toBe(b);
    expect(c).not.toBe(a);
    expect(Number.isInteger(a) && a >= 0).toBe(true);
  });
});