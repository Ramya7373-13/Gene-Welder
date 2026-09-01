import { describe, it, expect } from '@jest/globals';
import { SynchronousJobRunner } from '../../../src/domain/dnaStorage/jobRunner.js';
import type { DnaStorageJob } from '../../../src/domain/dnaStorage/types.js';

describe('synchronous job runner', () => {
  it('runs an encode job to ENCODED synchronously', async () => {
    const runner = new SynchronousJobRunner();
    const job: DnaStorageJob = { kind: 'encode', experimentId: 'exp-1', input: { strands: 3 } };
    const result = await runner.run(job);
    expect(result.ok).toBe(true);
    expect(result.status).toBe('ENCODED');
    expect(result.output).toEqual({ strands: 3 });
  });

  it('maps a decode job to COMPLETED', async () => {
    const runner = new SynchronousJobRunner();
    const result = await runner.run({ kind: 'decode', experimentId: 'exp-1', input: { success: true } });
    expect(result.ok).toBe(true);
    expect(result.status).toBe('COMPLETED');
  });

  it('contains errors: a throwing job returns FAILED instead of rejecting', async () => {
    const runner = new SynchronousJobRunner();
    const result = await runner.run({ kind: 'bogus' as any, experimentId: 'exp-1', input: null });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('Unknown job kind');
  });
});
