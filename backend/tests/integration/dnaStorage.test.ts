import request from 'supertest';
import { app, prisma } from '../../src/server.js';
import { shutdownPrisma } from '../../src/prisma.js';
import { jest, describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const FIXTURE_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/humanity-longevity.txt');
const FIXTURE_CONTENT = 'Cheers to Humanity and Longevity.';

// Lightweight in-memory stand-in for the dnaStorage* Prisma models so the full
// HTTP workflow can run without a database, mirroring the api.test.ts convention
// of spying on the prisma client.
const store: {
  experiments: Map<string, any>;
  files: any[];
  strands: any[];
  errorRuns: any[];
  decodeRuns: any[];
  reports: any[];
} = {
  experiments: new Map(),
  files: [],
  strands: [],
  errorRuns: [],
  decodeRuns: [],
  reports: [],
};

let cuidCounter = 0;
const cuid = () => `test-${++cuidCounter}`;

beforeEach(() => {
  store.experiments = new Map();
  store.files = [];
  store.strands = [];
  store.errorRuns = [];
  store.decodeRuns = [];
  store.reports = [];

  jest.spyOn(prisma.dnaStorageExperiment, 'create').mockImplementation(({ data }: any) => {
    const record = { id: cuid(), createdAt: new Date(), updatedAt: new Date(), status: 'DRAFT', ...data };
    store.experiments.set(record.id, record);
    return Promise.resolve(record);
  });
  jest.spyOn(prisma.dnaStorageExperiment, 'findUnique').mockImplementation(({ where }: any) =>
    Promise.resolve(store.experiments.get(where.id) ?? null)
  );
  jest.spyOn(prisma.dnaStorageExperiment, 'update').mockImplementation(({ where, data }: any) => {
    const record = { ...store.experiments.get(where.id), ...data, updatedAt: new Date() };
    store.experiments.set(where.id, record);
    return Promise.resolve(record);
  });
  jest.spyOn(prisma.dnaStorageExperiment, 'findMany').mockImplementation(() =>
    Promise.resolve([...store.experiments.values()])
  );
  jest.spyOn(prisma.dnaStorageExperiment, 'delete').mockImplementation(({ where }: any) => {
    store.experiments.delete(where.id);
    return Promise.resolve({});
  });

  jest.spyOn(prisma.dnaStorageFile, 'create').mockImplementation(({ data }: any) => {
    const record = { id: cuid(), storedAt: new Date(), ...data };
    store.files.push(record);
    return Promise.resolve(record);
  });
  jest.spyOn(prisma.dnaStorageFile, 'findFirst').mockImplementation(({ where }: any) =>
    Promise.resolve(
      store.files.find((f) => f.experimentId === where.experimentId && (where.purgedAt === null ? !f.purgedAt : true)) ?? null
    )
  );
  jest.spyOn(prisma.dnaStorageFile, 'findMany').mockImplementation(({ where }: any) =>
    Promise.resolve(store.files.filter((f) => f.experimentId === where.experimentId))
  );
  jest.spyOn(prisma.dnaStorageFile, 'update').mockImplementation(({ where, data }: any) => {
    const file = store.files.find((f) => f.id === where.id);
    if (file) Object.assign(file, data);
    return Promise.resolve(file);
  });

  jest.spyOn(prisma.dnaStorageStrand, 'deleteMany').mockImplementation(({ where }: any) => {
    const before = store.strands.length;
    store.strands = store.strands.filter((s) => s.experimentId !== where.experimentId);
    return Promise.resolve({ count: before - store.strands.length });
  });
  jest.spyOn(prisma.dnaStorageStrand, 'createMany').mockImplementation(({ data }: any) => {
    for (const item of data) store.strands.push({ id: cuid(), ...item });
    return Promise.resolve({ count: data.length });
  });
  jest.spyOn(prisma.dnaStorageStrand, 'findMany').mockImplementation(({ where }: any) =>
    Promise.resolve(store.strands.filter((s) => s.experimentId === where.experimentId))
  );
  jest.spyOn(prisma.dnaStorageStrand, 'count').mockImplementation(({ where }: any) =>
    Promise.resolve(store.strands.filter((s) => s.experimentId === where.experimentId).length)
  );

  jest.spyOn(prisma.dnaStorageErrorRun, 'create').mockImplementation(({ data }: any) => {
    const record = { id: cuid(), createdAt: new Date(), ...data };
    store.errorRuns.push(record);
    return Promise.resolve(record);
  });
  jest.spyOn(prisma.dnaStorageErrorRun, 'findUnique').mockImplementation(({ where }: any) =>
    Promise.resolve(store.errorRuns.find((r) => r.id === where.id) ?? null)
  );

  jest.spyOn(prisma.dnaStorageDecodeRun, 'create').mockImplementation(({ data }: any) => {
    const record = { id: cuid(), createdAt: new Date(), ...data };
    store.decodeRuns.push(record);
    return Promise.resolve(record);
  });

  jest.spyOn(prisma.dnaStorageReport, 'create').mockImplementation(({ data }: any) => {
    const record = { id: cuid(), createdAt: new Date(), ...data };
    store.reports.push(record);
    return Promise.resolve(record);
  });
  jest.spyOn(prisma.dnaStorageReport, 'findFirst').mockImplementation(({ where }: any) =>
    Promise.resolve(
      [...store.reports].reverse().find((r) => r.experimentId === where.experimentId) ?? null
    )
  );

  jest.spyOn(prisma, '$connect').mockImplementation(() => Promise.resolve() as any);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Importing app constructs the pg pool behind the Prisma adapter; disconnect
// and end the pool so the jest worker can exit cleanly.
afterAll(async () => {
  await shutdownPrisma();
});

const LEARNING_PROFILE = {
  id: 'learning',
  name: 'Learning mode',
  description: 'Deterministic 2-bit mapping for teaching and transparency.',
  mode: 'learning',
  maxPayloadBases: 200,
  maxHomopolymerLength: 4,
  minGcPercent: 0,
  maxGcPercent: 100,
  redundancyFactor: 1,
  checksumAlgorithm: 'sha256',
};

const zeroErrorProfile = (seed = 0) => ({
  id: 'zero',
  label: 'No simulated channel errors',
  substitutionRate: 0,
  insertionRate: 0,
  deletionRate: 0,
  strandDropoutRate: 0,
  duplicationRate: 0,
  coverageDepth: 1,
  seed,
});

const lowErrorProfile = (seed = 7) => ({
  id: 'low',
  label: 'Low simulated channel errors',
  // 0.1% substitution: with checksum-only error detection (no ECC in Phase 1),
  // recovery needs one pristine surviving copy per strand index; 0.5% would
  // make 2x redundancy mathematically unable to recover ~150-base strands.
  substitutionRate: 0.001,
  insertionRate: 0,
  deletionRate: 0,
  strandDropoutRate: 0.2,
  duplicationRate: 0,
  coverageDepth: 1,
  seed,
});

async function createExperiment(title = 'Fixture round-trip') {
  const res = await request(app)
    .post('/api/dna-storage/experiments')
    .send({ title, description: 'integration test', userId: 'user-1' });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

async function uploadFixture(id: string) {
  const res = await request(app)
    .post(`/api/dna-storage/experiments/${id}/upload`)
    .field('userId', 'user-1')
    .attach('file', FIXTURE_PATH, { contentType: 'text/plain' });
  expect(res.status).toBe(200);
  return res.body;
}

describe('DNA Archive Lab API', () => {
  it('creates an experiment (DRAFT)', async () => {
    const res = await request(app)
      .post('/api/dna-storage/experiments')
      .send({ title: 'My experiment', description: 'desc' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.id).toBeDefined();
  });

  it('rejects an invalid create payload', async () => {
    const res = await request(app).post('/api/dna-storage/experiments').send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid experiment payload');
  });

  it('uploads the sample fixture and reports its SHA-256', async () => {
    const id = await createExperiment();
    const body = await uploadFixture(id);
    expect(body.sourceFileName).toContain('humanity-longevity.txt');
    expect(body.sourceFileSizeBytes).toBe(Buffer.byteLength(FIXTURE_CONTENT));
    expect(body.sourceSha256).toBe(
      crypto.createHash('sha256').update(FIXTURE_CONTENT).digest('hex')
    );
  });

  it('rejects an oversized file with 413', async () => {
    const id = await createExperiment();
    const big = Buffer.alloc(1024 * 1024 + 1, 65);
    const res = await request(app)
      .post(`/api/dna-storage/experiments/${id}/upload`)
      .field('userId', 'user-1')
      .attach('file', big, { filename: 'big.txt', contentType: 'text/plain' });
    expect(res.status).toBe(413);
    expect(res.body.error).toContain('1 MB');
  });

  it('rejects a disallowed MIME type with 415 specifically', async () => {
    const id = await createExperiment();
    const res = await request(app)
      .post(`/api/dna-storage/experiments/${id}/upload`)
      .field('userId', 'user-1')
      .attach('file', Buffer.from('binary-ish'), { filename: 'payload.exe', contentType: 'application/octet-stream' });
    expect(res.status).toBe(415);
    expect(res.body.error).toContain('text/plain');
  });

  it('full workflow: encode → simulate (zero errors) → decode verifies SHA-256 equality (DoD #3, #6)', async () => {
    const id = await createExperiment();
    await uploadFixture(id);

    const encodeRes = await request(app)
      .post(`/api/dna-storage/experiments/${id}/encode`)
      .send({ encodingProfile: LEARNING_PROFILE, userId: 'user-1' });
    expect(encodeRes.status).toBe(200);
    expect(encodeRes.body.status).toBe('ENCODED');
    expect(encodeRes.body.uniqueStrands).toBeGreaterThanOrEqual(1);
    expect(encodeRes.body.totalBases).toBeGreaterThan(0);

    const simRes = await request(app)
      .post(`/api/dna-storage/experiments/${id}/simulate`)
      .send({ errorProfile: zeroErrorProfile(0), userId: 'user-1' });
    expect(simRes.status).toBe(200);
    expect(simRes.body.stats).toEqual({ dropped: 0, duplicated: 0, substituted: 0, inserted: 0, deleted: 0 });
    const errorRunId = simRes.body.errorRunId;

    const decodeRes = await request(app)
      .post(`/api/dna-storage/experiments/${id}/decode`)
      .send({ errorRunId, userId: 'user-1' });
    expect(decodeRes.status).toBe(200);
    expect(decodeRes.body.success).toBe(true);
    expect(decodeRes.body.recoveredChecksum).toBe(
      crypto.createHash('sha256').update(FIXTURE_CONTENT).digest('hex')
    );

    // Reproducibility: decoding again with the same seed gives the same result.
    const decodeRes2 = await request(app)
      .post(`/api/dna-storage/experiments/${id}/decode`)
      .send({ errorRunId, userId: 'user-1' });
    expect(decodeRes2.body.success).toBe(true);
    expect(decodeRes2.body.recoveredChecksum).toBe(decodeRes.body.recoveredChecksum);

    // Report is available in both formats.
    const reportJson = await request(app).get(`/api/dna-storage/experiments/${id}/report?format=json`);
    expect(reportJson.status).toBe(200);
    expect(reportJson.body.decodeOutcome.success).toBe(true);
    const reportMd = await request(app).get(`/api/dna-storage/experiments/${id}/report?format=markdown`);
    expect(reportMd.status).toBe(200);
    expect(reportMd.text).toContain('Not for clinical, biological, or laboratory decision-making');
  });

  it('low error rates with redundancy recover the payload (DoD #4)', async () => {
    const id = await createExperiment('Low-error recovery');
    await uploadFixture(id);

    const encodeRes = await request(app)
      .post(`/api/dna-storage/experiments/${id}/encode`)
      .send({
        encodingProfile: { ...LEARNING_PROFILE, mode: 'constraint-aware', redundancyFactor: 2 },
        userId: 'user-1',
      });
    expect(encodeRes.status).toBe(200);

    // DoD #4 wording: "at least one seeded case recovers fully". Each seed has a
    // high but not certain chance of recovery, so try several seeds.
    let recovered = false;
    for (let seed = 1; seed <= 10 && !recovered; seed++) {
      const simRes = await request(app)
        .post(`/api/dna-storage/experiments/${id}/simulate`)
        .send({ errorProfile: lowErrorProfile(seed), userId: 'user-1' });
      expect(simRes.status).toBe(200);

      const decodeRes = await request(app)
        .post(`/api/dna-storage/experiments/${id}/decode`)
        .send({ errorRunId: simRes.body.errorRunId, userId: 'user-1' });
      expect(decodeRes.status).toBe(200);
      recovered = decodeRes.body.success === true;
    }
    expect(recovered).toBe(true);
  });

  it('extreme dropout fails gracefully with an explanatory warning (DoD #5)', async () => {
    const id = await createExperiment('Extreme dropout');
    await uploadFixture(id);
    await request(app)
      .post(`/api/dna-storage/experiments/${id}/encode`)
      .send({ encodingProfile: LEARNING_PROFILE, userId: 'user-1' });

    const simRes = await request(app)
      .post(`/api/dna-storage/experiments/${id}/simulate`)
      .send({
        errorProfile: { ...zeroErrorProfile(3), strandDropoutRate: 1 },
        userId: 'user-1',
      });
    expect(simRes.status).toBe(200);

    const decodeRes = await request(app)
      .post(`/api/dna-storage/experiments/${id}/decode`)
      .send({ errorRunId: simRes.body.errorRunId, userId: 'user-1' });
    expect(decodeRes.status).toBe(200);
    expect(decodeRes.body.success).toBe(false);
    expect(decodeRes.body.warnings.join(' ')).toMatch(/dropout|redundancy|missing/i);
  });

  it('returns 404 for an unknown experiment id (ownership guard per existing convention)', async () => {
    const res = await request(app)
      .post('/api/dna-storage/experiments/unknown-id/encode')
      .send({ encodingProfile: LEARNING_PROFILE });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Experiment not found' });
  });

  it('returns 404 when a userId does not match the experiment owner', async () => {
    const id = await createExperiment();
    await uploadFixture(id);
    const res = await request(app)
      .post(`/api/dna-storage/experiments/${id}/encode`)
      .send({ encodingProfile: LEARNING_PROFILE, userId: 'someone-else' });
    expect(res.status).toBe(404);
  });

  it('lists experiments and strands (paginated)', async () => {
    const id = await createExperiment('Listed');
    await uploadFixture(id);
    await request(app)
      .post(`/api/dna-storage/experiments/${id}/encode`)
      .send({ encodingProfile: LEARNING_PROFILE, userId: 'user-1' });

    const listRes = await request(app).get('/api/dna-storage/experiments');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);

    const strandsRes = await request(app).get(`/api/dna-storage/experiments/${id}/strands?page=1&pageSize=10`);
    expect(strandsRes.status).toBe(200);
    expect(strandsRes.body.total).toBeGreaterThanOrEqual(1);
    expect(strandsRes.body.strands[0].sequence).toMatch(/^[ACGT]+$/);
  });

  it('deletes an experiment', async () => {
    const id = await createExperiment('To delete');
    const res = await request(app).delete(`/api/dna-storage/experiments/${id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true, id });
  });
});
