// Phase G — provenance hash chain.
// The ledger entries must commit to candidate content + validation snapshots,
// link into a per-candidate chain, and make tampering detectable by recompute.

import { describe, expect, it } from '@jest/globals';
import { ProvenanceService } from '../../../src/domain/proteinDesign/provenance/ProvenanceService.js';
import { DesignMode, type DesignLedgerEntry, type ValidationResult } from '../../../src/domain/proteinDesign/types/index.js';

const service = new ProvenanceService();

const conditioning = {
  hotspots: [],
  burialDepth: [],
  hydrogenBonds: [],
  interfaceRegions: [],
  targetStructure: '# TARGET\nATOM  1  N   ALA A   1',
  targetSequence: 'ACDEFGHIK',
  designMode: DesignMode.BINDER,
};

const validationSamples: ValidationResult = {
  candidateId: 'cand-1',
  pTM: 0.72,
  ipTM: 0.61,
  pLDDT: 81,
  interfaceArea: 840,
  constraintSatisfactionScore: 0.9,
  diversityScore: 1,
  overallScore: 0.8,
  details: { checked: 3, passed: 3 },
  createdAt: new Date('2026-09-22T00:00:00.000Z'),
};

function baseEntry(over: Partial<DesignLedgerEntry> = {}): DesignLedgerEntry {
  const record = service.createRecord(
    conditioning,
    { version: 'rfd3-test', weightsHash: 'aabbccddeeff0011' },
    42,
    'user-1',
    { parameters: { numDesigns: 2 }, designEngine: 'rfd3' },
  );
  return service.toLedgerEntry(record, 'cand-1', 'run-1', 'project-1', {
    jobId: 'run-1',
    gitCommitHash: '650a85f',
    candidateHash: service.computeCandidateHash({
      structure: 'AAABBBCCC',
      sequence: 'ACDEFGHIK',
      metrics: { pLDDT: 80 },
    }),
    validationHash: service.computeValidationHash(validationSamples, 1),
    ...over,
  });
}

describe('content hashes', () => {
  it('are deterministic for identical content', () => {
    const a = service.computeCandidateHash({
      structure: 'AAABBB',
      sequence: 'ACDEFG',
      metrics: { pLDDT: 80 },
    });
    const b = service.computeCandidateHash({
      structure: 'AAABBB',
      sequence: 'ACDEFG',
      metrics: { pLDDT: 80 },
    });
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
  });

  it('change when candidate content changes', () => {
    const a = service.computeCandidateHash({ structure: 'AAABBB', sequence: 'ACDEFG' });
    const b = service.computeCandidateHash({ structure: 'AAABBB', sequence: 'ACDEXG' });
    expect(a).not.toBe(b);
  });

  it('commit to structure, sequence and metrics consistently', () => {
    // Key order must not matter (canonical serialization).
    const a = service.computeCandidateHash({ metrics: { pLDDT: 80 }, sequence: 'S', structure: 'P' });
    const b = service.computeCandidateHash({ structure: 'P', sequence: 'S', metrics: { pLDDT: 80 } });
    expect(a).toBe(b);
  });
});

describe('linking', () => {
  it('attaches a self hash without mutating the input entry', () => {
    const entry = baseEntry();
    const linked = service.linkEntry(entry, 'prevhash');
    expect(entry.ledgerHash).toBeUndefined();
    expect(linked.ledgerHash).toMatch(/^[0-9a-f]{64}$/);
    expect(linked.previousLedgerHash).toBe('prevhash');
    expect(service.computeEntryHash(linked)).toBe(linked.ledgerHash);
  });

  it('does not require a previous link for the first entry in a chain', () => {
    const linked = service.linkEntry(baseEntry());
    expect(linked.previousLedgerHash).toBeUndefined();
    expect(linked.ledgerHash).toBeDefined();
  });
});

describe('verification', () => {
  it('accepts an unmodified entry', () => {
    const linked = service.linkEntry(baseEntry());
    const result = service.verifyEntry(linked);
    expect(result.valid).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('rejects a tampered entry', () => {
    const linked = service.linkEntry(baseEntry());
    const tampered: DesignLedgerEntry = { ...linked, seed: 43 };
    const result = service.verifyEntry(tampered);
    expect(result.valid).toBe(false);
    expect(result.reasons.join(' ')).toContain('does not match');
  });

  it('verifies an intact chain and pinpoints a broken link', () => {
    const first = service.linkEntry(baseEntry({ candidateId: 'cand-1' }));
    const second = service.linkEntry(baseEntry({ candidateId: 'cand-1' }), first.ledgerHash);
    const third = service.linkEntry(baseEntry({ candidateId: 'cand-1' }), second.ledgerHash);

    expect(service.verifyChain([first, second, third]).valid).toBe(true);
    expect(service.verifyChain([first, third]).valid).toBe(false);

    // Break the middle link: second points at a hash that no longer is first's.
    const forged = service.linkEntry(baseEntry({ candidateId: 'cand-1' }), 'deadbeef');
    const broken = service.verifyChain([second, forged]);
    expect(broken.valid).toBe(false);
    expect(broken.brokenAt).toBe(1);
  });

  it('treats an empty chain as valid', () => {
    expect(service.verifyChain([]).valid).toBe(true);
  });
});

describe('toLedgerEntry', () => {
  it('carries the Phase G extras onto the entry', () => {
    const entry = service.toLedgerEntry(
      service.createRecord(conditioning, { version: 'v', weightsHash: 'wh' }, 7, 'u'),
      'cand-9',
      'run-9',
      'project-9',
      { jobId: 'job-9', gitCommitHash: 'abc1234', candidateHash: 'cand-hash', validationHash: 'val-hash' },
    );
    expect(entry.jobId).toBe('job-9');
    expect(entry.gitCommitHash).toBe('abc1234');
    expect(entry.candidateHash).toBe('cand-hash');
    expect(entry.validationHash).toBe('val-hash');
  });
});

describe('reproducibility helpers', () => {
  it('still verify and format keys', () => {
    const record = service.createRecord(
      conditioning,
      { version: 'rfd3-test', weightsHash: 'aabbccddeeff00116677' },
      42,
      'user-1',
    );
    const entry = service.toLedgerEntry(record, 'cand-1');
    expect(service.verifyReproducibility(entry, { version: 'rfd3-test', weightsHash: 'aabbccddeeff00116677' }, 42)).toBe(true);
    expect(service.verifyReproducibility(entry, { version: 'rfd3-test', weightsHash: 'aabbccddeeff00116677' }, 43)).toBe(false);
    expect(service.formatReproducibilityKey(entry)).toBe('RFD3-rfd3-test-hash:aabbccddeeff-seed:42');
  });
});