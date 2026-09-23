// Audit log read endpoints.
// Mounted at /api by server.ts.
//
// NOTE (pre-existing): /audits/stats has an open "TODO: restrict to admin role
// when roles exist". It is session-authenticated but NOT role-restricted, so
// any logged-in user can read 24h aggregate audit stats across all entities.
// Copied verbatim from server.ts — do not silently change.

import express from 'express';
import { prisma } from '../prisma.js';
import { logger } from '../utils/logger.js';
import { getSessionFromCookie } from '../lib/session.js';
import { redactSensitive } from '../utils/redactor.js';

const router = express.Router();

// Audit routes
router.get('/audits', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    const limit = parseInt(req.query.limit as string) || 10;
    const audits = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return res.json(audits.map((r: any) => redactSensitive(r)));
  } catch (error) {
    logger.error('Error fetching audits:', error);
    return res.status(500).json({ error: 'Failed to fetch audits' });
  }
});

router.get('/audits/stats', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    // TODO: restrict to admin role when roles exist

    // Note: Prisma 7 $queryRaw requires specific treatment for PostgreSQL types if using strings
    const stats = await prisma.$queryRaw`
      SELECT 
        "entityType", 
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM "createdAt")::int) as avg_time
      FROM "audit_logs" 
      WHERE "createdAt" > NOW() - INTERVAL '24 hours'
      GROUP BY "entityType"
    `;

    // Convert BigInt to Number for JSON serialization if needed
    const serializedStats = JSON.parse(JSON.stringify(stats, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    return res.json(serializedStats);
  } catch (error) {
    logger.error('Error fetching audit stats:', error);
    return res.status(500).json({ error: 'Failed to fetch audit stats' });
  }
});

export { router as auditRouter };
