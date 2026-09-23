// Phase F — DesignService artifact hooks.
// Runs the real execution path (createRun → executeDesignJob → applyQueueStatus)
// against a stubbed adapter, a spied prisma client, and a real ArtifactStore on
// a temp root, then asserts every artifact the contract requires actually lands
// on disk in the reproducible layout.

import { describe, expect, it, beforeAll, afterAll, jest } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prisma, shutdownPrisma } from '../../../src/prisma.js';
import { ArtifactStore } from '../../../src/domain/proteinDesign/artifacts/ArtifactStore.js';
import { DesignService } from '../../../src/domain/proteinDesign/service/DesignService.js';
import { DesignMode, DesignRunStatus, type DesignCandidate } from '../../../src/domain/proteinDesign/types/index.js';
import type { DesignAdapter } from '../../../src/domain/proteinDesign/adapters/DesignAdapter.js';
import type { DesignJob } from '../../../src/domain/proteinDesign/jobs/JobQueue.js';

const SMALL_PDB = [
  'ATOM      1  N   ALA A   1       1.000   1.000   1.000  1.00  0.00           N',
  'ATOM      2  CA  ALA A   1       2.000   2.000   2.000  1.00  0.00           C',
  'ATOM      3  C   ALA A   1       3.000   3.000   3.000  1.00  0.00           C',
  'ATOM      4  O   ALA A   1       4.000   4.000   4.000  1.00  0.00           O',
  'ATOM      5  N   ALA A   2       5.000   5.000   5.000  1.00  0.00           N',
  'ATOM      6  CA  ALA A   2       6.000   6.000   6.000  1.00  0.00           C',
  'ATOM      7  C   ALA A   2       7.000   7.000   7.000  1.00  0.00           C',
  'ATOM      8  O   ALA A   2       8.000   8.000   8.000  1.00  0.00           O',
].join('\n');

const jobConditioning = {
  hotspots: [],
  burialDepth: [],
  hydrogenBonds: [],
  interfaceRegions: [],
  targetStructure: SMALL_PDB,
  targetSequence: 'ACDEFGHIK',
  designMode: DesignMode.BINDER,
};

function stubAdapter(): DesignAdapter {
  const unused = () => {
    throw new Error('not used in this test');
  };
  return {
    getModelInfo: () => ({ version: 'rfd3-stub', weightsHash: 'stub-hash-0011' }),
    isAvailable: async () => true,
    generateBinder: async request => ({
      runId: request.runId,
      modelVersion: 'rfd3-stub',
      weightsHash: 'stub-hash-0011',
      seed: request.parameters.seed ?? 0,
      executionTimeMs: 5,
      candidates: [
        {
          id: `${request.runId}-g1`,
          runId: request.runId,
          structure: SMALL_PDB,
          sequence: 'ACDEFGHIKLPQR',
          affinityScore: 88,
          metrics: { pLDDT: 80 },
          createdAt: new Date(),
        } as DesignCandidate,
        {
          id: `${request.runId}-g2`,
          runId: request.runId,
          structure: SMALL_PDB,
          sequence: 'ACDEFGHIKPYWE',
          affinityScore: 84,
          metrics: { pLDDT: 77 },
          createdAt: new Date(),
        } as DesignCandidate,
      ],
    }),
    generateStabilizer: unused,
    generateDnaBinder: unused,
    generateScaffold: unused,
    generateSymmetricAssembly: unused,
    generateMotifScaffold: unused,
  };
}

const fakes = {
  runs: new Map<string, Record<string, unknown>>(),
  candidates: new Map<string, Record<string, unknown>>(),
  candidateSeq: 0,
};

let root: string;
let store: ArtifactStore;
let service: DesignService;

beforeAll(async () => {
  jest.spyOn(prisma.designProject, 'findFirst').mockImplementation(async () => ({
    id: 'project-1',
    userId: 'user-1',
  }));

  jest.spyOn(prisma.designRun, 'create').mockImplementation(async ({ data }: any) => {
    const row = {
      id: 'run-1',
      ...data,
      createdAt: new Date('2026-09-22T00:00:00.000Z'),
      updatedAt: new Date('2026-09-22T00:00:00.000Z'),
    };
    fakes.runs.set(row.id, row);
    return row;
  });
  jest.spyOn(prisma.designRun, 'findUnique').mockImplementation(async ({ where }: any) => {
    const row = fakes.runs.get(where.id);
    return row ? { ...row } : null;
  });
  jest.spyOn(prisma.designRun, 'findFirst').mockImplementation(async ({ where }: any) => {
    const row = fakes.runs.get(where.id);
    return row ? { ...row } : null;
  });
  jest.spyOn(prisma.designRun, 'update').mockImplementation(async ({ where, data }: any) => {
    const row = fakes.runs.get(where.id) ?? {};
    const next = { ...row, ...data, updatedAt: new Date('2026-09-22T00:00:00.000Z') };
    fakes.runs.set(where.id, next);
    return next;
  });

  jest.spyOn(prisma.designConstraint, 'createMany').mockImplementation(async () => ({ count: 0 }));

  jest.spyOn(prisma.designCandidate, 'create').mockImplementation(async ({ data }: any) => {
    fakes.candidateSeq += 1;
    const row = {
      id: `cand-${fakes.candidateSeq}`,
      ...data,
      createdAt: new Date('2026-09-22T00:00:00.000Z'),
      rankedPosition: null,
    };
    fakes.candidates.set(row.id, row);
    return row;
  });
  jest.spyOn(prisma.designCandidate, 'update').mockImplementation(
    async ({ where, data }: any) => {
      const row = fakes.candidates.get(where.id) ?? {};
      const next = { ...row, ...data };
      fakes.candidates.set(where.id, next);
      return next;
    },
  );
  jest.spyOn(prisma.designCandidate, 'findMany').mockImplementation(async ({ where }: any) => {
    const all = Array.from(fakes.candidates.values());
    if (where?.id?.in) return all.filter(r => where.id.in.includes(r.id as string));
    return all;
  });

  jest.spyOn(prisma.designLedger, 'create').mockImplementation(async ({ data }: any) => ({
    id: 'ledger-1',
    ...data,
    timestamp: new Date('2026-09-22T00:00:00.000Z'),
  }));
  jest.spyOn(prisma.designLedger, 'findFirst').mockImplementation(async () => null);

  jest.spyOn(prisma.validationResult, 'deleteMany').mockImplementation(async () => ({}));
  jest.spyOn(prisma.validationResult, 'create').mockImplementation(async ({ data }: any) => ({
    id: 'vr-1',
    ...data,
  }));

  root = fs.mkdtempSync(path.join(os.tmpdir(), 'design-hooks-'));
  store = new ArtifactStore(root);
  service = new DesignService({ adapter: stubAdapter(), artifacts: store });
});

afterAll(async () => {
  jest.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
  await shutdownPrisma().catch(() => {});
});

describe('DesignService artifact hooks', () => {
  it('writes the full reproducible layout through the real execution path', async () => {
    const run = await service.createRun('user-1', {
      projectId: 'project-1',
      mode: DesignMode.BINDER,
      parameters: { numDesigns: 2, seed: 42 },
      targetStructure: SMALL_PDB,
      targetSequence: 'ACDEFGHIK',
    });
    expect(run.id).toBe('run-1');

    const job = {
      runId: 'run-1',
      projectId: 'project-1',
      mode: DesignMode.BINDER,
      payload: {
        mode: DesignMode.BINDER,
        parameters: { numDesigns: 2, seed: 42 },
        conditioning: jobConditioning,
        targetSequence: 'ACDEFGHIK',
        userId: 'user-1',
      },
      status: DesignRunStatus.RUNNING,
      retries: 0,
      maxRetries: 3,
      createdAt: new Date(),
    } as unknown as DesignJob;

    const outcome = await service.executeDesignJob(job);
    expect(outcome.candidateIds).toHaveLength(2);

    await service.applyQueueStatus('run-1', DesignRunStatus.COMPLETED);

    // --- run history --------------------------------------------------------
    const runJson = store.readJson('run-1/run.json') as {
      history: { status: string }[];
    };
    expect(runJson.history.map(h => h.status)).toEqual(['QUEUED', 'RUNNING', 'COMPLETED']);

    // --- inputs + model -----------------------------------------------------
    const listing = store.listRunArtifacts('run-1');
    expect(listing.exists).toBe(true);
    expect(listing.inputs.sort()).toEqual([
      'run-1/inputs/mode=BINDER-conditioning.json',
      'run-1/inputs/parameters.json',
    ]);
    expect(listing.model).toEqual(['run-1/model/manifest.json']);

    const savedConditioning = store.readJson('run-1/inputs/mode=BINDER-conditioning.json');
    expect(savedConditioning).toEqual(jobConditioning);
    const savedParameters = store.readJson('run-1/inputs/parameters.json') as {
      seed: number;
      numDesigns: number;
    };
    expect(savedParameters.seed).toBe(42);
    expect(savedParameters.numDesigns).toBe(2);
    const manifest = store.readJson('run-1/model/manifest.json') as Record<string, unknown>;
    expect(manifest.modelVersion).toBe('rfd3-stub');
    expect(manifest.weightsHash).toBe('stub-hash-0011');

    // --- candidate artifacts -------------------------------------------------
    expect(Object.keys(listing.candidates).sort()).toEqual(['cand-1', 'cand-2']);
    expect(listing.candidates['cand-1']).toEqual(
      expect.arrayContaining([
        'run-1/candidates/cand-1/design_1.cif.gz',
        'run-1/candidates/cand-1/structure.txt',
        'run-1/candidates/cand-1/candidate.json',
        'run-1/candidates/cand-1/validation.json',
      ]),
    );
    expect(listing.candidates['cand-2']).toContain('run-1/candidates/cand-2/design_2.cif.gz');

    expect(store.readStructureGz('run-1', 'cand-1')).toBe(SMALL_PDB);

    const candidateJson = store.readJson('run-1/candidates/cand-1/candidate.json') as {
      structuredFile: string;
      rankedPosition: number;
      designMetrics: { pLDDT?: number };
    };
    expect(candidateJson.structuredFile).toBe('run-1/candidates/cand-1/design_1.cif.gz');
    expect(candidateJson.rankedPosition).toBe(
      fakes.candidates.get('cand-1')?.rankedPosition,
    );
    expect(candidateJson.designMetrics.pLDDT).toBeGreaterThan(0);

    const validationJson = store.readJson('run-1/candidates/cand-1/validation.json') as {
      rank: number;
      metrics: { candidateId: string };
    };
    expect(validationJson.rank).toBe(fakes.candidates.get('cand-1')?.rankedPosition);
    expect(validationJson.metrics.candidateId).toBe('cand-1');

    // --- ledger snapshots ----------------------------------------------------
    expect(listing.provenance).toEqual([
      'run-1/provenance/cand-1.ledger.json',
      'run-1/provenance/cand-2.ledger.json',
    ]);
    const ledger = store.readJson('run-1/provenance/cand-1.ledger.json') as {
      candidateId: string;
      modelVersion: string;
      seed: number;
      jobId?: string;
      gitCommitHash?: string;
      candidateHash?: string;
      validationHash?: string;
      ledgerHash?: string;
    };
    expect(ledger.candidateId).toBe('cand-1');
    expect(ledger.modelVersion).toBe('rfd3-stub');
    expect(ledger.seed).toBe(42);
    // Phase G hash chain: source revision, job id, content + validation
    // commits and a self hash are all recorded on the snapshot.
    expect(ledger.jobId).toBe('run-1');
    expect(ledger.gitCommitHash).toBeTruthy();
    expect(ledger.candidateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(ledger.validationHash).toMatch(/^[0-9a-f]{64}$/);
    expect(ledger.ledgerHash).toMatch(/^[0-9a-f]{64}$/);

    // --- rows carry the structuredFile pointer ------------------------------
    const candRow = fakes.candidates.get('cand-1');
    expect(candRow?.structuredFile).toBe('run-1/candidates/cand-1/design_1.cif.gz');
    // Mock validation draws pTM/ipTM from Math.random per candidate, so which
    // candidate lands on rank 1 is a coin flip across processes. From the
    // artifact-store contract what matters is that every candidate was ranked.
    expect(fakes.candidates.get('cand-1')?.rankedPosition).toBeGreaterThan(0);
    expect(fakes.candidates.get('cand-2')?.rankedPosition).toBeGreaterThan(0);
    expect(
      new Set([fakes.candidates.get('cand-1')?.rankedPosition, fakes.candidates.get('cand-2')?.rankedPosition]),
    ).toEqual(new Set([1, 2]));
  });
});