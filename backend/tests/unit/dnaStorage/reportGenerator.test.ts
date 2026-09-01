import { describe, it, expect } from '@jest/globals';
import { generateReport } from '../../../src/domain/dnaStorage/reportGenerator.js';
import { decodeExperiment, buildArtifacts } from '../../../src/domain/dnaStorage/decoder.js';
import { encodeLearning, LEARNING_PROFILE } from '../../../src/domain/dnaStorage/learningCodec.js';
import { ZERO_ERROR_PROFILE } from '../../../src/domain/dnaStorage/errorSimulator.js';

const FIXTURE_TEXT = 'Cheers to Humanity and Longevity.';

function makeReport() {
  const payload = Buffer.from(FIXTURE_TEXT, 'utf-8');
  const strands = encodeLearning(payload, 'exp-report', LEARNING_PROFILE);
  const { result } = decodeExperiment(buildArtifacts(payload, strands), LEARNING_PROFILE);
  return generateReport({
    experiment: {
      id: 'exp-report',
      title: 'Fixture round-trip',
      description: 'Zero-error verification of the teaching fixture.',
      sourceFileName: 'humanity-longevity.txt',
      sourceFileSizeBytes: payload.length,
      sourceSha256: result.expectedChecksum,
      randomSeed: 0,
      createdAt: '2026-09-01T00:00:00.000Z',
    },
    encodingProfile: LEARNING_PROFILE,
    errorProfile: { ...ZERO_ERROR_PROFILE, seed: 0 },
    strands,
    decodeResult: result,
  });
}

describe('report generator', () => {
  it('JSON contains every required section', () => {
    const { json } = makeReport();
    for (const key of [
      'applicationVersion',
      'prng',
      'experiment',
      'encodingProfile',
      'errorProfile',
      'constraintSummary',
      'strandSummary',
      'decodeOutcome',
      'limitations',
      'disclaimer',
    ]) {
      expect(json).toHaveProperty(key);
    }
    const experiment = json.experiment as Record<string, unknown>;
    expect(experiment.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(experiment.randomSeed).toBe(0);
    const prng = json.prng as Record<string, unknown>;
    expect(prng.name).toBe('mulberry32');
    expect(prng.version).toBe('1.0.0');
    const decode = json.decodeOutcome as Record<string, unknown>;
    expect(decode.success).toBe(true);
    expect(decode.expectedChecksum).toBe(decode.recoveredChecksum);
  });

  it('Markdown contains SHA-256, seed, disclaimer, and the not-for-clinical line', () => {
    const { markdown } = makeReport();
    expect(markdown).toMatch(/[0-9a-f]{64}/);
    expect(markdown).toContain('Random seed: `0`');
    expect(markdown).toContain('does not perform laboratory operations');
    expect(markdown).toContain('Not for clinical, biological, or laboratory decision-making');
    expect(markdown).toContain('mulberry32');
    expect(markdown).toContain('Encoding overhead');
  });
});
