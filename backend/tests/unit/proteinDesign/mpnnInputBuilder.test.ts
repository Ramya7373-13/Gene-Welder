import { describe, it, expect } from '@jest/globals';
import {
  buildMpnnInputs,
  type MpnnDesignRequest,
} from '../../../src/domain/proteinDesign/mpnn/mpnnInputBuilder.js';

function makeRequest(overrides: Partial<MpnnDesignRequest> = {}): MpnnDesignRequest {
  return {
    runId: 'run_mpnn_1',
    structure: 'ATOM ... END',
    numSequences: 8,
    temperature: 0.1,
    seed: 42,
    ...overrides,
  };
}

describe('buildMpnnInputs', () => {
  it('emits a normalized job definition with sane defaults', () => {
    const inputs = buildMpnnInputs(makeRequest());
    expect(inputs.schema_version).toBe('mpnn-normalized/1');
    expect(inputs.design_name).toBe('run_mpnn_1');
    expect(inputs.input_structure).toBe('ATOM ... END');
    expect(inputs.num_sequences).toBe(8);
    expect(inputs.temperature).toBe(0.1);
    expect(inputs.seed).toBe(42);
    expect(inputs.job_kind).toBe('sequence_design');
    expect(inputs.fixed_positions).toEqual([]);
    expect(inputs.custom_parameters).toEqual({});
  });

  it('carries fixed positions and custom parameters through', () => {
    const inputs = buildMpnnInputs(
      makeRequest({
        fixedPositions: [
          { chain: 'A', position: 42 },
          { chain: 'B', position: 7 },
        ],
        jobKind: 'sequence_optimization',
        customParameters: { reduction: 2, tied_positions: [['A25', 'B25']] },
      }),
    );
    expect(inputs.job_kind).toBe('sequence_optimization');
    expect(inputs.fixed_positions).toEqual([
      { chain: 'A', position: 42 },
      { chain: 'B', position: 7 },
    ]);
    expect(inputs.custom_parameters).toEqual({ reduction: 2, tied_positions: [['A25', 'B25']] });
  });

  it('sanitizes hostile design names (path separators neutralized)', () => {
    const inputs = buildMpnnInputs(makeRequest({ runId: '../favicon.ico' }));
    expect(inputs.design_name).not.toContain('/');
    expect(inputs.design_name).not.toContain('\\');
    expect(inputs.design_name).toMatch(/^[A-Za-z0-9_.-]+$/);
    expect(inputs.design_name).toBe('.._favicon.ico');
  });
});