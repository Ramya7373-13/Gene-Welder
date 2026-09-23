// Session issuing, signing, verification and lookup.
// Moved verbatim out of server.ts so routers can require auth without a cycle.

import crypto from 'crypto';
import express from 'express';
import { prisma } from '../prisma.js';
import { logger } from '../utils/logger.js';

export const SESSION_COOKIE_NAME = 'mm_session';

// Session secret: required in production, dev fallback only when not production
const SESSION_SECRET = process.env.SESSION_SECRET;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_LAST_SEEN_THROTTLE_MS = 60 * 1000; // 1 minute

// Session signing: HMAC-SHA256(sessionId, SESSION_SECRET)
export function signSession(sessionId: string): string {
  const secret = SESSION_SECRET || 'dev-only-secret-never-in-production';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(sessionId);
  return hmac.digest('hex');
}

export function verifySessionSignature(sessionId: string, signature: string): boolean {
  const secret = SESSION_SECRET || 'dev-only-secret-never-in-production';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(sessionId);
  const expected = hmac.digest('hex');
  if (signature.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// Verify with explicit secret (for testing)
export function verifySessionSignatureWithSecret(sessionId: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(sessionId);
  const expected = hmac.digest('hex');
  if (signature.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export interface DBSession {
  userId: string;
  email: string;
  plan: string;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}

// lastSeenAt throttle: track when we last updated per session
const lastSeenTracker = new Map<string, number>();

// Eviction: delete expired/revoked sessions older than grace period (lazy, on auth requests)
let lastEvictionTime = 0;
const EVICTION_GRACE_MS = 24 * 60 * 60 * 1000; // 24 hours

async function evictExpiredSessions(): Promise<void> {
  const now = Date.now();
  if (now - lastEvictionTime < EVICTION_GRACE_MS) return;
  lastEvictionTime = now;

  const graceAgo = new Date(now - EVICTION_GRACE_MS);
  try {
    await prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: graceAgo } },
          { revokedAt: { lt: graceAgo } }
        ]
      }
    });
  } catch (error) {
    logger.error('Session eviction error:', error);
  }
}

export async function getSessionFromCookie(req: express.Request): Promise<DBSession | null> {
  // Trigger lazy eviction occasionally
  evictExpiredSessions().catch(() => {});

  const cookieValue = req.cookies[SESSION_COOKIE_NAME];
  if (!cookieValue || typeof cookieValue !== 'string') return null;

  // Cookie value is "sessionId.signature"
  const parts = cookieValue.split('.');
  if (parts.length !== 2) return null;

  const [sessionId, signature] = parts;
  if (!sessionId || !signature) return null;

  // Verify HMAC signature
  if (!verifySessionSignature(sessionId, signature)) return null;

  // Hash sessionId for DB lookup (follows same convention as AuthToken)
  const sessionHash = crypto.createHash('sha256').update(sessionId).digest('hex');

  const dbSession = await prisma.session.findUnique({ where: { sessionHash } });
  if (!dbSession) return null;

  // Check revoked
  if (dbSession.revokedAt) return null;

  // Check expired
  if (dbSession.expiresAt < new Date()) return null;

  // Load user for email/plan
  const user = await prisma.user.findUnique({ where: { id: dbSession.userId } });
  if (!user) return null;

  // Throttled lastSeenAt update (not more than once per minute)
  const now = Date.now();
  const lastSeen = lastSeenTracker.get(sessionId) || 0;
  if (now - lastSeen > SESSION_LAST_SEEN_THROTTLE_MS) {
    lastSeenTracker.set(sessionId, now);
    prisma.session.update({
      where: { id: dbSession.id },
      data: { lastSeenAt: new Date() }
    }).catch(() => {});
  }

  return {
    userId: user.id,
    email: user.email,
    plan: user.plan,
    lastSeenAt: dbSession.lastSeenAt,
    revokedAt: dbSession.revokedAt,
    expiresAt: dbSession.expiresAt
  };
}
