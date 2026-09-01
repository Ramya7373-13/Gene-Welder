import { describe, it, expect } from '@jest/globals';
import {
  gcPercent,
  maxHomopolymerRun,
  encodingOverhead,
  effectivePayloadRate,
} from '../../../src/domain/dnaStorage/analytics.js';

describe('analytics formulas', () => {
  it('GC% = ((G + C) / sequence length) × 100', () => {
    expect(gcPercent('GCAT')).toBe(50);
    expect(gcPercent('GGCC')).toBe(100);
    expect(gcPercent('AATT')).toBe(0);
    expect(gcPercent('')).toBe(0);
  });

  it('maxHomopolymerRun finds the longest repeated-base run', () => {
    expect(maxHomopolymerRun('AAAGGT')).toBe(3);
    expect(maxHomopolymerRun('ACGT')).toBe(1);
    expect(maxHomopolymerRun('TTTT')).toBe(4);
    expect(maxHomopolymerRun('')).toBe(0);
    expect(maxHomopolymerRun('GAAATTTC')).toBe(3);
  });

  it('encodingOverhead = (total encoded bases - raw payload bases) / raw payload bases', () => {
    expect(encodingOverhead(100, 150)).toBe(0.5);
    expect(encodingOverhead(100, 100)).toBe(0);
    expect(encodingOverhead(0, 50)).toBe(0); // guard: no divide-by-zero
  });

  it('effectivePayloadRate = recovered payload bits / total stored bases', () => {
    expect(effectivePayloadRate(200, 400)).toBe(0.5);
    expect(effectivePayloadRate(0, 400)).toBe(0);
    expect(effectivePayloadRate(100, 0)).toBe(0); // guard: no divide-by-zero
  });
});
