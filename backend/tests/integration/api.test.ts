import request from 'supertest';
import { app, prisma } from '../../src/server.js';
import { jest, describe, it, expect } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// backend/tests/integration/api.test.ts -> backend/test.pdb
const PDB_FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../test.pdb');

// No need for jest.mock if we spy on exported instance
beforeEach(() => {
    jest.spyOn(prisma.user, 'findUnique').mockImplementation(() => Promise.resolve(null) as any);
    jest.spyOn(prisma.analysis, 'findUnique').mockImplementation(() => Promise.resolve(null) as any);
    jest.spyOn(prisma, '$executeRawUnsafe').mockImplementation(() => Promise.resolve(1) as any);
    jest.spyOn(prisma, '$connect').mockImplementation(() => Promise.resolve() as any);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('API Integration', () => {
    describe('GET /api/users/:id', () => {
        it('should return user object on success', async () => {
            const mockUser = { id: '1', name: 'Test' };
            (prisma.user.findUnique as any).mockResolvedValue(mockUser);

            const res = await request(app).get('/api/users/1');
            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockUser);
        });

        it('should return 404 error object when user not found', async () => {
            (prisma.user.findUnique as any).mockResolvedValue(null);

            const res = await request(app).get('/api/users/999');
            expect(res.status).toBe(404);
            expect(res.body).toEqual({ error: 'User not found' });
        });

        it('should return 500 error object on database error', async () => {
            (prisma.user.findUnique as any).mockRejectedValue(new Error('DB error'));

            const res = await request(app).get('/api/users/1');
            expect(res.status).toBe(500);
            expect(res.body).toEqual({ error: 'Failed to fetch user' });
        });
    });

    describe('GET /api/analyses/:id', () => {
        const TEST_USER_ID = 'test-user-id';
        // Match backend/src/server.ts signSession fallback (not auth.test.ts's different default).
        const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-secret-never-in-production';

        function makeSignedCookie(sessionId: string): string {
            const sig = crypto.createHmac('sha256', SESSION_SECRET).update(sessionId).digest('hex');
            return `${sessionId}.${sig}`;
        }

        function mockValidSession(sessionId = 'test-session-token'): string {
            const sessionHash = crypto.createHash('sha256').update(sessionId).digest('hex');
            jest.spyOn(prisma.session, 'findUnique').mockResolvedValue({
                id: 'session-row-id',
                userId: TEST_USER_ID,
                sessionHash,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                lastSeenAt: null,
                revokedAt: null,
                createdAt: new Date()
            } as any);
            jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
                id: TEST_USER_ID,
                email: 'test@example.com',
                plan: 'free'
            } as any);
            return `mm_session=${makeSignedCookie(sessionId)}`;
        }

        it('should return 401 when not authenticated', async () => {
            const res = await request(app).get('/api/analyses/a1');
            expect(res.status).toBe(401);
            expect(res.body).toEqual({ error: 'Not authenticated' });
        });

        it('should return analysis object on success', async () => {
            const mockAnalysis = { id: 'a1', gene: 'BRCA1', userId: TEST_USER_ID };
            jest.spyOn(prisma.analysis, 'findFirst').mockResolvedValue(mockAnalysis as any);

            const res = await request(app)
                .get('/api/analyses/a1')
                .set('Cookie', mockValidSession());
            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockAnalysis);
            expect(res.body.user).toBeUndefined();

            expect(prisma.analysis.findFirst).toHaveBeenCalled();
            const findArg = (prisma.analysis.findFirst as any).mock.calls[0][0];
            expect(findArg.where).toEqual({ id: 'a1', userId: TEST_USER_ID });
            expect(findArg.include).toEqual({ historyRecords: true, splicingAnalysis: true });
            expect(findArg.include.user).toBeUndefined();
        });

        it('should return 404 error object when analysis not found', async () => {
            jest.spyOn(prisma.analysis, 'findFirst').mockResolvedValue(null);

            const res = await request(app)
                .get('/api/analyses/unknown')
                .set('Cookie', mockValidSession());
            expect(res.status).toBe(404);
            expect(res.body).toEqual({ error: 'Analysis not found' });
        });

        it('should return 500 error object on database error', async () => {
            jest.spyOn(prisma.analysis, 'findFirst').mockRejectedValue(new Error('DB error'));

            const res = await request(app)
                .get('/api/analyses/a1')
                .set('Cookie', mockValidSession());
            expect(res.status).toBe(500);
            expect(res.body).toEqual({ error: 'Failed to fetch analysis' });
        });
    });

    describe('POST /api/variants/upload-pdb', () => {
        beforeEach(() => {
            jest.spyOn(prisma.variant, 'findUnique').mockImplementation(() => Promise.resolve(null) as any);
            jest.spyOn(prisma.variant, 'update').mockImplementation(() => Promise.resolve(null) as any);
            jest.spyOn(prisma.structureFile, 'create').mockImplementation(() => Promise.resolve(null) as any);
            jest.spyOn(prisma.auditLog, 'create').mockImplementation(() => Promise.resolve(null) as any);
        });

        it('uploads a .pdb, writes wildtype_structure_path, and creates a StructureFile', async () => {
            const mockVariant = { id: 'variant-cuid-1', gene: 'BRCA1', wildtype_structure_path: null };
            (prisma.variant.findUnique as any).mockResolvedValue(mockVariant);
            (prisma.variant.update as any).mockResolvedValue({ ...mockVariant, wildtype_structure_path: 'storage/x.pdb' });
            (prisma.structureFile.create as any).mockResolvedValue({ id: 'sf-1', variantId: 'variant-cuid-1', file_type: 'pdb' });

            const res = await request(app)
                .post('/api/variants/upload-pdb')
                .field('variantId', 'variant-cuid-1')
                .field('slot', 'wildtype')
                .attach('file', PDB_FIXTURE);

            expect(res.status).toBe(200);
            expect(res.body.variant).toBeDefined();
            expect(res.body.structureFile).toBeDefined();
            expect(res.body.path).toBeTruthy();

            const updateArg = (prisma.variant.update as any).mock.calls[0][0];
            expect(updateArg.where).toEqual({ id: 'variant-cuid-1' });
            expect(updateArg.data).toHaveProperty('wildtype_structure_path');

            // Clean up the real file multer wrote to ./storage/
            if (res.body.path) {
                await fs.unlink(res.body.path).catch(() => {});
            }
        });

        it('rejects a non-.pdb upload with 400 and never touches the DB', async () => {
            const res = await request(app)
                .post('/api/variants/upload-pdb')
                .field('variantId', 'variant-cuid-1')
                .field('slot', 'wildtype')
                .attach('file', Buffer.from('not a pdb'), 'notes.txt');

            expect(res.status).toBe(400);
            expect(prisma.variant.findUnique).not.toHaveBeenCalled();
        });

        it('returns 404 and scrubs the orphan file when the variant is unknown', async () => {
            (prisma.variant.findUnique as any).mockResolvedValue(null);
            const unlinkSpy = jest.spyOn(fs, 'unlink'); // observe + call through (real cleanup)

            const res = await request(app)
                .post('/api/variants/upload-pdb')
                .field('variantId', 'does-not-exist')
                .field('slot', 'mutant')
                .attach('file', PDB_FIXTURE);

            expect(res.status).toBe(404);
            expect(res.body).toEqual({ error: 'Variant not found' });
            expect(unlinkSpy).toHaveBeenCalledTimes(1);
        });

        it('returns 400 and scrubs the orphan when slot is missing', async () => {
            const unlinkSpy = jest.spyOn(fs, 'unlink'); // call through to delete the orphan

            const res = await request(app)
                .post('/api/variants/upload-pdb')
                .field('variantId', 'variant-cuid-1')
                .attach('file', PDB_FIXTURE);

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/slot/i);
            expect(unlinkSpy).toHaveBeenCalledTimes(1);
            expect(prisma.variant.findUnique).not.toHaveBeenCalled();
        });
    });
});
