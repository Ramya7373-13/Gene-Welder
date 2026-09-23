// Phase I - GET /api/design/candidates/:candidateId/ledger.
// Verify the read-only ledger surface: happy path with a verifiable hash chain,
// 401 unauthenticated, 404 on a candidate the user does not own, and the DTO
// rejection of a malformed candidate id (maps to 400 in the route).
//
// Session mocking mirrors tests/integration/api.test.ts; the ledger entries
// are produced by the real ProvenanceService so the chain is genuinely linked.

import request from 'supertest';
import { app, prisma } from '../../../src/server.js';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import crypto from 'crypto';
import { ProvenanceService } from '../../../src/domain/proteinDesign/provenance/ProvenanceService.js';
import {
  DesignMode,
  type DesignLedgerEntry,
  type Rfd3Conditioning,
} from '../../../src/domain/proteinDesign/types/index.js';
import { ledgerQueryDto } from '../../../src/domain/proteinDesign/service/dto.js';

const TEST_USER_ID = 'test-user-id';
const TEST_CANDIDATE_ID = 'candidate-phase-i-1';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-secret-never-in-production';

const provenance = new ProvenanceService();

const conditioning: Rfd3Conditioning = {
  hotspots: [],
  burialDepth: [],
  hydrogenBonds: [],
  interfaceRegions: [],
  targetStructure: 'AAABBB',
  targetSequence: 'MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSY',
  designMode: DesignMode.BINDER,
};

beforeEach(() => {
  jest.spyOn(prisma, '$executeRawUnsafe').mockImplementation(() => Promise.resolve(1) as any);
  jest.spyOn(prisma, '$connect').mockImplementation(() => Promise.resolve() as any);
});

afterEach(() => {
  jest.restoreAllMocks();
});

function makeSignedCookie(sessionId: string): string {
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(sessionId).digest('hex');
  return `${sessionId}.${sig}`;
}

function mockValidSession(): string {
  const sessionId = 'ledger-test-session-token';
  const sessionHash = crypto.createHash('sha256').update(sessionId).digest('hex');
  jest.spyOn(prisma.session, 'findUnique').mockResolvedValue({
    id: 'session-row-id',
    userId: TEST_USER_ID,
    sessionHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    lastSeenAt: null,
    revokedAt: null,
    createdAt: new Date(),
  } as any);
  jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
    id: TEST_USER_ID,
    email: 'test@example.com',
    plan: 'free',
  } as any);
  return `mm_session=${makeSignedCookie(sessionId)}`;
}

function mockOwnedCandidate(): void {
  jest.spyOn(prisma.designCandidate, 'findFirst').mockResolvedValue({
    id: TEST_CANDIDATE_ID,
    runId: 'run-1',
    structure: null,
    sequence: 'ACDEFGHIK',
    affinityScore: 0.8,
    rankedPosition: 1,
    designMetrics: {},
    structuredFile: null,
    createdAt: new Date(),
  } as any);
}

function linkedEntries(): DesignLedgerEntry[] {
  const recordOne = provenance.createRecord(
    conditioning,
    { version: 'rfd3-mock-v1.0.0', weightsHash: 'a1b2c3d4e5f6a7b8' },
    42,
    TEST_USER_ID,
    { parameters: { numDesigns: 2 }, designEngine: 'rfd3' },
  );
  recordOne.timestamp = new Date('2026-09-23T01:00:00.000Z');
  const linkedOne = provenance.linkEntry(
    provenance.toLedgerEntry(recordOne, TEST_CANDIDATE_ID, 'run-1', 'project-1', { jobId: 'job-1' }),
  );

  const recordTwo = provenance.createRecord(
    conditioning,
    { version: 'rfd3-mock-v1.0.0', weightsHash: 'a1b2c3d4e5f6a7b8' },
    42,
    TEST_USER_ID,
    { parameters: { numDesigns: 2 }, designEngine: 'rfd3' },
  );
  recordTwo.timestamp = new Date('2026-09-23T02:00:00.000Z');
  const linkedTwo = provenance.linkEntry({
    ...provenance.toLedgerEntry(recordTwo, TEST_CANDIDATE_ID, 'run-1', 'project-1', { jobId: 'job-2' }),
    previousLedgerHash: linkedOne.ledgerHash,
  });

  return [linkedOne, linkedTwo];
}

function mockLedgerRows(): void {
  jest.spyOn(prisma.designLedger, 'findMany').mockResolvedValue(linkedEntries() as any);
}

describe('GET /api/design/candidates/:candidateId/ledger', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get(`/api/design/candidates/${TEST_CANDIDATE_ID}/ledger`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Not authenticated' });
  });

  it('returns 404 when the candidate is not owned (or gone)', async () => {
    const cookie = mockValidSession();
    jest.spyOn(prisma.designCandidate, 'findFirst').mockResolvedValue(null as any);

    const res = await request(app)
      .get(`/api/design/candidates/${TEST_CANDIDATE_ID}/ledger`)
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Design candidate not found' });
  });

  it('returns the ledger with a verifiable hash chain on success', async () => {
    const cookie = mockValidSession();
    mockOwnedCandidate();
    mockLedgerRows();

    const res = await request(app)
      .get(`/api/design/candidates/${TEST_CANDIDATE_ID}/ledger`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.ledger).toHaveLength(2);
    expect(res.body.chain).toEqual({ valid: true, brokenAt: -1, reasons: [] });
    expect(res.body.ledger[0].candidateId).toBe(TEST_CANDIDATE_ID);
    expect(res.body.ledger[0].modelVersion).toBe('rfd3-mock-v1.0.0');
    expect(res.body.ledger[1].previousLedgerHash).toBe(res.body.ledger[0].ledgerHash);
    expect(res.body.ledger[0].ledgerHash).toBeTruthy();
    expect(res.body.ledger[1].ledgerHash).toBeTruthy();
  });

  it('rejects a malformed candidate id at the DTO boundary (route maps to 400)', () => {
    expect(() => ledgerQueryDto.parse({ candidateId: '' })).toThrow();
    expect(() => ledgerQueryDto.parse({})).toThrow();
    expect(() => ledgerQueryDto.parse({ candidateId: 'valid-id' })).not.toThrow();
  });
});