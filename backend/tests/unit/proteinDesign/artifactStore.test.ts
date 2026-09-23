// Phase F — ArtifactStore unit tests.
// Covers the reproducible layout contract from docs/rfd3-execution-plan.md §8:
// inputs/, model/, run.json, candidates/, provenance/ and atomic, deterministic
// writes. Pure filesystem tests — no prisma involved.

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {
  ArtifactStore,
  stableStringify,
} from '../../../src/domain/proteinDesign/artifacts/ArtifactStore.js';
import { DesignMode, type DesignLedgerEntry, type ValidationResult } from '../../../src/domain/proteinDesign/types/index.js';

const MMCIF = `data_test
#
_entry.id test
_atom_site.group_PDB ATOM
_atom_site.id 1
_atom_site.label_atom_id CA
`;

let root: string;
let store: ArtifactStore;

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'design-artifacts-'));
  store = new ArtifactStore(root);
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const conditioning = {
  hotspots: [],
  burialDepth: [],
  hydrogenBonds: [],
  interfaceRegions: [],
  targetStructure: '# TARGET\nATOM      1  N   ALA A   1',
  targetSequence: 'ACDEFGHIK',
  designMode: DesignMode.BINDER,
};

const params = { numDesigns: 2, temperature: 0.1, seed: 42 };

function runId(name: string): string {
  return `run-${name}`;
}

describe('writeRunSnapshot', () => {
  it('writes conditioning, parameters and pinned-model manifest', async () => {
    await store.writeRunSnapshot({
      runId: runId('A'),
      mode: DesignMode.BINDER,
      conditioning,
      parameters: params,
      model: { version: 'rfd3-test', weightsHash: 'aabbccddeeff0011' },
      seed: 42,
      userId: 'user-1',
    });

    const listing = store.listRunArtifacts(runId('A'));
    expect(listing.exists).toBe(true);
    expect(listing.inputs.sort()).toEqual([
      'run-A/inputs/mode=BINDER-conditioning.json',
      'run-A/inputs/parameters.json',
    ]);
    expect(listing.model).toEqual(['run-A/model/manifest.json']);

    const savedConditioning = JSON.parse(
      fs.readFileSync(store.resolve('run-A/inputs/mode=BINDER-conditioning.json'), 'utf-8'),
    ) as Record<string, unknown>;
    expect(savedConditioning).toEqual(conditioning);

    const savedParams = JSON.parse(
      fs.readFileSync(store.resolve('run-A/inputs/parameters.json'), 'utf-8'),
    ) as Record<string, unknown>;
    expect(savedParams).toEqual(params);

    const manifest = store.readJson('run-A/model/manifest.json') as Record<string, unknown>;
    expect(manifest.modelVersion).toBe('rfd3-test');
    expect(manifest.weightsHash).toBe('aabbccddeeff0011');
    expect(manifest.seed).toBe(42);
    expect(manifest.runId).toBe(runId('A'));
  });

  it('writes identical bytes for identical inputs (reproducible layout)', async () => {
    const first = await store.writeRunSnapshot({
      runId: runId('B'),
      mode: DesignMode.BINDER,
      conditioning,
      parameters: params,
      model: { version: 'rfd3-test', weightsHash: 'aabbccddeeff0011' },
      seed: 42,
    });
    const second = await store.writeRunSnapshot({
      runId: runId('B'),
      mode: DesignMode.BINDER,
      conditioning,
      parameters: params,
      model: { version: 'rfd3-test', weightsHash: 'aabbccddeeff0011' },
      seed: 42,
    });

    expect(first).toHaveLength(3);
    expect(first).toEqual(second);
    for (const file of first) {
      const relative = path.relative(root, file).split(path.sep).join('/');
      expect(fs.readFileSync(file)).toEqual(fs.readFileSync(store.resolve(relative)));
    }
  });

  it('recursively sorts JSON keys (stable serialization)', () => {
    expect(stableStringify({ b: 1, a: { d: 4, c: 3 }, e: undefined })).toBe(
      '{\n  "a": {\n    "c": 3,\n    "d": 4\n  },\n  "b": 1\n}\n',
    );
    expect(stableStringify([{ y: 2, x: 1 }, 3])).toBe('[\n  {\n    "x": 1,\n    "y": 2\n  },\n  3\n]\n');
  });
});

describe('run.json history', () => {
  it('appends status transitions in order', async () => {
    await store.recordRunStatus(runId('C'), 'QUEUED');
    await store.recordRunStatus(runId('C'), 'RUNNING');
    await store.recordRunStatus(runId('C'), 'FAILED', 'boom');

    const runJson = store.readJson('run-C/run.json') as {
      runId: string;
      history: { status: string; at: string; message?: string }[];
    };
    expect(runJson.runId).toBe(runId('C'));
    expect(runJson.history.map(h => h.status)).toEqual(['QUEUED', 'RUNNING', 'FAILED']);
    expect(runJson.history[2].message).toBe('boom');
    expect(store.listRunArtifacts(runId('C')).runJson).toBe('run.json');
  });
});

describe('candidate artifacts', () => {
  it('writes deterministic gz structure, display copy and history', async () => {
    await store.writeRunSnapshot({
      runId: runId('D'),
      mode: DesignMode.BINDER,
      conditioning,
      parameters: params,
      model: { version: 'rfd3-test', weightsHash: 'aabbccddeeff0011' },
      seed: 42,
    });

    const gzPath = await store.writeCandidate({
      candidateId: 'cand-1',
      runId: runId('D'),
      designIndex: 1,
      structure: MMCIF,
    });
    expect(gzPath).toBe('run-D/candidates/cand-1/design_1.cif.gz');

    // Round trip: gunzip returns the exact original structure.
    expect(store.readStructureGz(runId('D'), 'cand-1')).toBe(MMCIF);
    expect(
      fs.readFileSync(store.resolve('run-D/candidates/cand-1/structure.txt'), 'utf-8'),
    ).toBe(MMCIF);

    const candidateJson = store.readJson('run-D/candidates/cand-1/candidate.json') as {
      candidateId: string;
      designIndex: number;
      structuredFile: string;
    };
    expect(candidateJson.candidateId).toBe('cand-1');
    expect(candidateJson.designIndex).toBe(1);
    expect(candidateJson.structuredFile).toBe('run-D/candidates/cand-1/design_1.cif.gz');

    // Second candidate in the same run gets its own <n>.
    const gzPath2 = await store.writeCandidate({
      candidateId: 'cand-2',
      runId: runId('D'),
      designIndex: 2,
      structure: MMCIF,
    });
    expect(gzPath2).toBe('run-D/candidates/cand-2/design_2.cif.gz');
    const listing = store.listRunArtifacts(runId('D'));
    expect(Object.keys(listing.candidates).sort()).toEqual(['cand-1', 'cand-2']);
    expect(listing.candidates['cand-2']).toContain('run-D/candidates/cand-2/design_2.cif.gz');
  });

  it('produces byte-identical gz for the same structure (reproducibility)', async () => {
    await store.writeRunSnapshot({
      runId: runId('E'),
      mode: DesignMode.BINDER,
      conditioning,
      parameters: params,
      model: { version: 'rfd3-test', weightsHash: 'aabbccddeeff0011' },
      seed: 42,
    });
    await store.writeCandidate({
      candidateId: 'cand-1',
      runId: runId('E'),
      designIndex: 1,
      structure: MMCIF,
    });
    const firstBytes = fs.readFileSync(store.resolve('run-E/candidates/cand-1/design_1.cif.gz'));

    await store.writeCandidate({
      candidateId: 'cand-1',
      runId: runId('E'),
      designIndex: 1,
      structure: MMCIF,
    });
    const secondBytes = fs.readFileSync(store.resolve('run-E/candidates/cand-1/design_1.cif.gz'));

    expect(secondBytes).toEqual(firstBytes);
    expect(zlib.gunzipSync(secondBytes).toString('utf-8')).toBe(MMCIF);
  });

  it('returns null structuredFile when a candidate has no structure', async () => {
    await store.writeRunSnapshot({
      runId: runId('F'),
      mode: DesignMode.BINDER,
      conditioning,
      parameters: params,
      model: { version: 'rfd3-test', weightsHash: 'aabbccddeeff0011' },
      seed: 42,
    });
    const gzPath = await store.writeCandidate({
      candidateId: 'cand-e',
      runId: runId('F'),
      designIndex: 1,
    });
    expect(gzPath).toBeNull();
    expect(store.readStructureGz(runId('F'), 'cand-e')).toBeNull();
  });
});

describe('updateCandidateMeta', () => {
  it('merges rank and metrics without clobbering the structuredFile', async () => {
    await store.writeRunSnapshot({
      runId: runId('G'),
      mode: DesignMode.BINDER,
      conditioning,
      parameters: params,
      model: { version: 'rfd3-test', weightsHash: 'aabbccddeeff0011' },
      seed: 42,
    });
    await store.writeCandidate({
      candidateId: 'cand-1',
      runId: runId('G'),
      designIndex: 1,
      structure: MMCIF,
    });
    await store.updateCandidateMeta('cand-1', runId('G'), {
      rankedPosition: 1,
      designMetrics: { pLDDT: 82.5 },
    });

    const json = store.readJson('run-G/candidates/cand-1/candidate.json') as {
      rankedPosition: number;
      designMetrics: { pLDDT: number };
      structuredFile: string;
    };
    expect(json.rankedPosition).toBe(1);
    expect(json.designMetrics.pLDDT).toBe(82.5);
    expect(json.structuredFile).toBe('run-G/candidates/cand-1/design_1.cif.gz');
  });
});

describe('writeValidation and ledger snapshots', () => {
  const validation: ValidationResult = {
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

  it('writes validation.json with rank and replacement semantics', async () => {
    await store.writeRunSnapshot({
      runId: runId('H'),
      mode: DesignMode.BINDER,
      conditioning,
      parameters: params,
      model: { version: 'rfd3-test', weightsHash: 'aabbccddeeff0011' },
      seed: 42,
    });
    await store.writeValidation('cand-1', runId('H'), validation, 1);

    const saved = store.readJson('run-H/candidates/cand-1/validation.json') as {
      rank: number;
      metrics: ValidationResult;
    };
    expect(saved.rank).toBe(1);
    expect(saved.metrics).toEqual(JSON.parse(JSON.stringify(validation)));

    // Replacement: a second validation leaves exactly one file.
    await store.writeValidation('cand-1', runId('H'), validation, 2);
    const listing = store.listRunArtifacts(runId('H'));
    const validationFiles = listing.candidates['cand-1'].filter(f =>
      f.endsWith('validation.json'),
    );
    expect(validationFiles).toHaveLength(1);
  });

  it('writes an immutable ledger snapshot per candidate', async () => {
    const entry: DesignLedgerEntry = {
      candidateId: 'cand-1',
      projectId: 'project-1',
      runId: runId('I'),
      modelVersion: 'rfd3-test',
      weightsHash: 'aabbccddeeff0011',
      seed: 42,
      inputConstraints: { hotspots: [] },
      userId: 'user-1',
      timestamp: new Date('2026-09-22T00:00:00.000Z'),
    };
    await store.writeLedgerSnapshot(entry);

    const saved = store.readJson('run-I/provenance/cand-1.ledger.json') as DesignLedgerEntry;
    expect(saved.candidateId).toBe('cand-1');
    expect(saved.modelVersion).toBe('rfd3-test');
    expect(saved.seed).toBe(42);
    expect(saved.inputConstraints).toEqual({ hotspots: [] });
    const listing = store.listRunArtifacts(runId('I'));
    expect(listing.provenance).toEqual(['run-I/provenance/cand-1.ledger.json']);
  });
});

describe('reads', () => {
  it('reports non-existent runs without throwing', () => {
    const listing = store.listRunArtifacts('run-unknown');
    expect(listing.exists).toBe(false);
    expect(listing.inputs).toEqual([]);
    expect(listing.candidates).toEqual({});
  });
});