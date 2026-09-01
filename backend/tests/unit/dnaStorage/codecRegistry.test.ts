import { describe, it, expect } from '@jest/globals';
import { getCodec } from '../../../src/domain/dnaStorage/codecRegistry.js';
import { LEARNING_PROFILE } from '../../../src/domain/dnaStorage/learningCodec.js';
import { CONSTRAINT_AWARE_PROFILE } from '../../../src/domain/dnaStorage/constraintAwareCodec.js';

const FIXTURE_TEXT = 'Cheers to Humanity and Longevity.';

describe('codec registry', () => {
  it('resolves the learning codec as enabled and round-trips through it', () => {
    const codec = getCodec('learning');
    expect(codec.id).toBe('learning');
    expect(codec.enabled).toBe(true);
    const payload = Buffer.from(FIXTURE_TEXT, 'utf-8');
    const strands = codec.encode(payload, 'exp-1', LEARNING_PROFILE);
    const { bytes } = codec.decode(strands, LEARNING_PROFILE);
    expect(bytes.equals(payload)).toBe(true);
  });

  it('resolves the constraint-aware codec as enabled and round-trips through it', () => {
    const codec = getCodec('constraint-aware');
    expect(codec.id).toBe('constraint-aware');
    expect(codec.enabled).toBe(true);
    const payload = Buffer.from(FIXTURE_TEXT, 'utf-8');
    const strands = codec.encode(payload, 'exp-2', CONSTRAINT_AWARE_PROFILE);
    const { bytes } = codec.decode(strands, CONSTRAINT_AWARE_PROFILE);
    expect(bytes.equals(payload)).toBe(true);
  });

  it('returns a disabled placeholder for the advanced codec that refuses to run', () => {
    const codec = getCodec('advanced');
    expect(codec.id).toBe('advanced');
    expect(codec.enabled).toBe(false);
    expect(() => codec.encode(Buffer.from('x'), 'exp-3', { ...LEARNING_PROFILE, mode: 'advanced' }))
      .toThrow('Advanced codec adapter is not enabled in this version');
    expect(() => codec.decode([], { ...LEARNING_PROFILE, mode: 'advanced' }))
      .toThrow('Advanced codec adapter is not enabled in this version');
  });
});
