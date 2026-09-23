// Splicing analysis, sharing, and comment endpoints.
// Mounted at /api by server.ts.
// Actor identity is always the session cookie — never body.userId.

import express from 'express';
import { prisma } from '../prisma.js';
import { logger } from '../utils/logger.js';
import { getSessionFromCookie, type DBSession } from '../lib/session.js';
import { reserveUsage } from '../lib/metering.js';
import { configuredFrontendUrl } from '../lib/config.js';

const router = express.Router();

async function requireCollabSession(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    res.locals.session = session as DBSession;
    next();
  } catch (error) {
    next(error);
  }
}

// Splicing analysis routes
router.post('/splicing', async (req, res) => {
  try {
    const { analysisId, gene, variant, ...splicingData } = req.body;

    // Auth check
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    // Usage metering - fail-closed (atomic reservation)
    const usageCheck = await reserveUsage(session.userId, 'splicing_decode');
    if (!usageCheck.allowed) {
      return res.status(402).json({
        error: 'Usage limit exceeded',
        code: 'PAYWALL',
        plan: session.plan,
        message: `Free plan limit reached. Upgrade to Pro for unlimited analyses.`,
        upgradeUrl: `${configuredFrontendUrl}/settings`
      });
    }

    const splicingAnalysis = await prisma.splicingAnalysis.create({
      data: {
        userId: session.userId,
        analysisId,
        gene,
        variant,
        ...splicingData
      }
    });

    // Slot already reserved via reserveUsage() at route entry
    return res.json(splicingAnalysis);
  } catch (error) {
    logger.error('Error creating splicing analysis:', error);
    return res.status(500).json({ error: 'Failed to create splicing analysis' });
  }
});

// Sharing routes
router.post('/share', requireCollabSession, async (req, res) => {
  try {
    const session = res.locals.session as DBSession;
    const { analysisId, sharedWithId, permissionType, isPublic } = req.body;
    const shareToken = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const sharedAccess = await prisma.sharedAccess.create({
      data: {
        analysisId,
        sharedById: session.userId,
        sharedWithId,
        shareToken,
        permissionType,
        isPublic
      }
    });

    return res.json(sharedAccess);
  } catch (error) {
    logger.error('Error creating shared access:', error);
    return res.status(500).json({ error: 'Failed to create shared access' });
  }
});

// Comments routes
router.post('/comments', requireCollabSession, async (req, res) => {
  try {
    const session = res.locals.session as DBSession;
    const { analysisId, content, parentId } = req.body;
    const comment = await prisma.comment.create({
      data: {
        analysisId,
        userId: session.userId,
        content,
        parentId
      }
    });
    return res.json(comment);
  } catch (error) {
    logger.error('Error creating comment:', error);
    return res.status(500).json({ error: 'Failed to create comment' });
  }
});

router.get('/comments/:analysisId', requireCollabSession, async (req, res) => {
  try {
    const { analysisId } = req.params;
    const comments = await prisma.comment.findMany({
      where: { analysisId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    return res.json(comments);
  } catch (error) {
    logger.error('Error fetching comments:', error);
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

export { router as collabRouter };
