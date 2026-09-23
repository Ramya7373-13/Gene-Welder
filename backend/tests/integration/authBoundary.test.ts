// Auth-boundary hardening: unauthenticated callers must get 401 on gated
// surfaces; structure file path must reject paths outside storage/.

import request from 'supertest';
import { app, prisma } from '../../src/server.js';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import crypto from 'crypto';

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-secret-never-in-production';

function makeSignedCookie(sessionId: string): string {
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(sessionId).digest('hex');
  return `mm_session=${sessionId}.${sig}`;
}

function mockValidSession(sessionId = 'auth-boundary-session') {
  const userId = 'auth-boundary-user';
  const sessionHash = crypto.createHash('sha256').update(sessionId).digest('hex');
  jest.spyOn(prisma.session, 'findUnique').mockResolvedValue({
    id: 'session-row-id',
    userId,
    sessionHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    lastSeenAt: null,
    revokedAt: null,
    createdAt: new Date(),
  } as any);
  jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
    id: userId,
    email: 'auth@example.com',
    plan: 'free',
  } as any);
  return makeSignedCookie(sessionId);
}

beforeEach(() => {
  jest.spyOn(prisma, '$connect').mockImplementation(() => Promise.resolve() as any);
  // Guard: missing cookies never touch the DB; keep session lookups hermetic.
  jest.spyOn(prisma.session, 'findUnique').mockImplementation(() => Promise.resolve(null) as any);
  jest.spyOn(prisma.user, 'findUnique').mockImplementation(() => Promise.resolve(null) as any);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Auth boundary hardening', () => {
  describe('clinical routes', () => {
    it('GET /api/risk-assessments → 401 without session', async () => {
      const res = await request(app).get('/api/risk-assessments');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Not authenticated' });
    });

    it('POST /api/risk-assessments → 401 without session', async () => {
      const res = await request(app).post('/api/risk-assessments').send({});
      expect(res.status).toBe(401);
    });

    it('GET /api/interventions → 401 without session', async () => {
      const res = await request(app).get('/api/interventions');
      expect(res.status).toBe(401);
    });

    it('GET /api/polygenic-scores → 401 without session', async () => {
      const res = await request(app).get('/api/polygenic-scores');
      expect(res.status).toBe(401);
    });

    it('GET /api/family-risks → 401 without session', async () => {
      const res = await request(app).get('/api/family-risks');
      expect(res.status).toBe(401);
    });

    it('GET /api/risk-assessment/:patientId → 401 without session', async () => {
      const res = await request(app).get('/api/risk-assessment/p1');
      expect(res.status).toBe(401);
    });
  });

  describe('genomics routes', () => {
    it('POST /api/spliceai → 401 without session', async () => {
      const res = await request(app).post('/api/spliceai').send({ gene: 'BRCA1' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Not authenticated' });
    });

    it('GET /api/test-schema → 401 without session', async () => {
      const res = await request(app).get('/api/test-schema');
      expect(res.status).toBe(401);
    });
  });

  describe('collab routes', () => {
    it('POST /api/share → 401 without session', async () => {
      const res = await request(app).post('/api/share').send({ analysisId: 'a1', userId: 'spoof' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Not authenticated' });
    });

    it('POST /api/comments → 401 without session', async () => {
      const res = await request(app).post('/api/comments').send({ analysisId: 'a1', userId: 'spoof' });
      expect(res.status).toBe(401);
    });

    it('GET /api/comments/:analysisId → 401 without session', async () => {
      const res = await request(app).get('/api/comments/a1');
      expect(res.status).toBe(401);
    });

    it('POST /api/share uses session user, not body.userId', async () => {
      const cookie = mockValidSession();
      jest.spyOn(prisma.sharedAccess, 'create').mockResolvedValue({
        id: 'share-1',
        analysisId: 'a1',
        sharedById: 'auth-boundary-user',
        sharedWithId: 'u2',
        shareToken: 't',
        permissionType: 'read',
        isPublic: false,
      } as any);

      const res = await request(app)
        .post('/api/share')
        .set('Cookie', cookie)
        .send({
          analysisId: 'a1',
          sharedWithId: 'u2',
          permissionType: 'read',
          isPublic: false,
          userId: 'attacker-spoof',
        });
      expect(res.status).toBe(200);
      const createArg = (prisma.sharedAccess.create as any).mock.calls[0][0];
      expect(createArg.data.sharedById).toBe('auth-boundary-user');
    });
  });

  describe('structures routes', () => {
    it('POST /api/structures → 401 without session', async () => {
      const res = await request(app)
        .post('/api/structures')
        .attach('file', Buffer.from('ATOM'), 'x.pdb');
      expect(res.status).toBe(401);
    });

    it('GET /api/structures/file → 401 without session', async () => {
      const res = await request(app).get('/api/structures/file?path=storage/x.pdb');
      expect(res.status).toBe(401);
    });

    it('GET /api/structures/file rejects path outside storage with 403', async () => {
      const cookie = mockValidSession();
      const res = await request(app)
        .get('/api/structures/file')
        .set('Cookie', cookie)
        .query({ path: 'C:\\Windows\\win.ini' });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'File path not allowed' });
    });

    it('GET /api/structures/file rejects relative traversal outside storage with 403', async () => {
      const cookie = mockValidSession();
      const res = await request(app)
        .get('/api/structures/file')
        .set('Cookie', cookie)
        .query({ path: '../../etc/passwd' });
      expect(res.status).toBe(403);
    });

    it('GET /api/test-storage → 401 without session', async () => {
      const res = await request(app).get('/api/test-storage');
      expect(res.status).toBe(401);
    });
  });
});
