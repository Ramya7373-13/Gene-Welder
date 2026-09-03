import request from 'supertest';
import { app, prisma } from '../../src/server.js';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

beforeEach(() => {
    jest.spyOn(prisma, '$executeRawUnsafe').mockImplementation(() => Promise.resolve(1) as any);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('GET /health - Lightweight health endpoint for monitoring', () => {
    it('returns status ok, uptime, and db up when DB is reachable', async () => {
        (prisma.$executeRawUnsafe as any).mockResolvedValue(1);

        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
        expect(response.body.db).toBe('up');
        expect(typeof response.body.uptime).toBe('number');
        expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('returns status degraded and db down when DB is unreachable', async () => {
        (prisma.$executeRawUnsafe as any).mockRejectedValue(new Error('DB Connection Failed'));

        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('degraded');
        expect(response.body.db).toBe('down');
        expect(typeof response.body.uptime).toBe('number');
    });

    it('returns status degraded when DB query times out (>2s)', async () => {
        jest.useRealTimers();

        let finishTimeout: () => void;
        const timeoutPromise = new Promise<'timeout'>((resolve) => {
            finishTimeout = () => resolve('timeout');
        });

        (prisma.$executeRawUnsafe as any).mockImplementation(
            () => new Promise(() => {})
        );

        const responsePromise = request(app).get('/health');

        // Wait for real 2.1s timeout to fire
        await new Promise((resolve) => setTimeout(resolve, 2100));

        const response = await responsePromise;

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('degraded');
        expect(response.body.db).toBe('down');
    });
});
