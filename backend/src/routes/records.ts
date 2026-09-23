// User, analysis, and history endpoints.
// Mounted at /api by server.ts.
//
// SECURITY FIX (this session): POST /users and GET /users/:id previously had NO
// authentication check, and GET /users/:id returned any user's email address
// plus their full `analyses` and `userPreferences` relations to any caller.
// Both now require a session, and GET /users/:id is restricted to the caller's
// own record. No frontend code called either endpoint; the three integration
// tests that asserted unauthenticated 200/404/500 were updated accordingly.

import express from 'express';
import { prisma } from '../prisma.js';
import { logger } from '../utils/logger.js';
import { getSessionFromCookie } from '../lib/session.js';

const router = express.Router();

// User routes
router.post('/users', async (req, res) => {
  try {
    // Auth check — previously unauthenticated. Real signup goes through the
    // magic-link flow in routes/auth.ts, which creates users server-side.
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    const { email, name } = req.body;
    const user = await prisma.user.create({
      data: {
        email,
        name
      }
    });
    return res.json(user);
  } catch (error) {
    logger.error('Error creating user:', error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    // Auth check — previously unauthenticated, so anyone could read any user's
    // email address plus their full analyses and preferences.
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    const { id } = req.params;
    // Ownership: a user may only read their own record. Mirrors the
    // /analyses/:id convention — 404 (not 403) for both "missing" and "not
    // yours", so this cannot be used to enumerate valid user ids.
    if (id !== session.userId) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        analyses: true,
        userPreferences: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (error) {
    logger.error('Error fetching user:', error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Analysis routes
router.post('/analyses', async (req, res) => {
  try {
    const { gene, variant, ...analysisData } = req.body;

    // Auth check - use session userId
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    const analysis = await prisma.analysis.create({
      data: {
        userId: session.userId,
        gene,
        variant,
        ...analysisData
      }
    });
    return res.json(analysis);
  } catch (error) {
    logger.error('Error creating analysis:', error);
    return res.status(500).json({ error: 'Failed to create analysis' });
  }
});

router.get('/analyses', async (req, res) => {
  try {
    // Auth check - use session userId
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    const analyses = await prisma.analysis.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(analyses);
  } catch (error) {
    logger.error('Error fetching analyses:', error);
    return res.status(500).json({ error: 'Failed to fetch analyses' });
  }
});

router.get('/analyses/:id', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    const { id } = req.params;
    // findFirst: { id, userId } is not a unique constraint (no schema migration).
    // Null covers both missing and not-owned — do not distinguish (no 403).
    const analysis = await prisma.analysis.findFirst({
      where: { id, userId: session.userId },
      include: {
        historyRecords: true,
        splicingAnalysis: true
      }
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    return res.json(analysis);
  } catch (error) {
    logger.error('Error fetching analysis:', error);
    return res.status(500).json({ error: 'Failed to fetch analysis' });
  }
});

// History routes
router.post('/history', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    const { analysisId, gene, variant, ...historyData } = req.body;

    if (analysisId) {
      const analysis = await prisma.analysis.findUnique({ where: { id: analysisId } });
      if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
      if (analysis.userId !== session.userId) return res.status(403).json({ error: 'Forbidden' });
    }

    const history = await prisma.historyRecord.create({
      data: {
        userId: session.userId,
        analysisId,
        gene,
        variant,
        ...historyData
      }
    });
    return res.json(history);
  } catch (error) {
    logger.error('Error creating history record:', error);
    return res.status(500).json({ error: 'Failed to create history record' });
  }
});

router.get('/history/:userId', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    const history = await prisma.historyRecord.findMany({
      where: { userId: session.userId },
      orderBy: { timestamp: 'desc' },
      take: 50
    });
    return res.json(history);
  } catch (error) {
    logger.error('Error fetching history records:', error);
    return res.status(500).json({ error: 'Failed to fetch history records' });
  }
});

export { router as recordsRouter };
