import request from 'supertest';
import { app, prisma } from '../../src/server.js';
import { jest, describe, it, expect } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

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
        it('should return analysis object on success', async () => {
            const mockAnalysis = { id: 'a1', gene: 'BRCA1' };
            (prisma.analysis.findUnique as any).mockResolvedValue(mockAnalysis);

            const res = await request(app).get('/api/analyses/a1');
            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockAnalysis);
        });

        it('should return 404 error object when analysis not found', async () => {
            (prisma.analysis.findUnique as any).mockResolvedValue(null);

            const res = await request(app).get('/api/analyses/unknown');
            expect(res.status).toBe(404);
            expect(res.body).toEqual({ error: 'Analysis not found' });
        });

        it('should return 500 error object on database error', async () => {
            (prisma.analysis.findUnique as any).mockRejectedValue(new Error('DB error'));

            const res = await request(app).get('/api/analyses/a1');
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
