// Magic-link authentication: request-link, verify, logout, me.
// Mounted at /api by server.ts.
//
// Security properties preserved from the original inline routes:
//  - raw magic-link tokens are never stored (SHA-256 hash only)
//  - sessions are HMAC-signed and stored hashed
//  - user lookup happens before token issuance to prevent email enumeration
//  - rate limited per email and per IP

import express from 'express';
import crypto from 'crypto';
import { prisma } from '../prisma.js';
import { logger } from '../utils/logger.js';
import { getClientIp } from '../lib/request.js';
import { configuredFrontendUrl } from '../lib/config.js';
import { resendClient } from '../lib/clients.js';
import {
  EMAIL_RATE_LIMIT,
  IP_RATE_LIMIT,
  emailRateLimits,
  ipRateLimits,
  checkRateLimit,
} from '../lib/rateLimit.js';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  signSession,
  getSessionFromCookie,
} from '../lib/session.js';

const router = express.Router();

// POST /auth/request-link - Send magic link
router.post('/auth/request-link', async (req, res) => {
  const { email } = req.body as { email?: string };
  const clientIp = getClientIp(req);

  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  // Rate limit check - per email
  const emailLimit = checkRateLimit(emailRateLimits, email.toLowerCase(), EMAIL_RATE_LIMIT);
  if (!emailLimit.allowed) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  // Rate limit check - per IP
  const ipLimit = checkRateLimit(ipRateLimits, clientIp, IP_RATE_LIMIT);
  if (!ipLimit.allowed) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  if (!resendClient) {
    logger.error('Resend not configured');
    return res.status(503).json({ error: 'Email service not configured' });
  }

  try {
    // Find or create user - always do this to prevent email enumeration
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, plan: 'free' }
      });
    }

    // Generate token (15-min TTL)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Hash token for storage: SHA-256 only - raw token is NEVER stored
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await prisma.authToken.create({
      data: { userId: user.id, tokenHash, expiresAt }
    });

    const verifyUrl = `${configuredFrontendUrl}/auth/verify?token=${token}`;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    await resendClient.emails.send({
      from: 'MutationMechanic <noreply@mutationmechanic.com>',
      to: email,
      subject: 'Sign in to MutationMechanic',
      html: `
        <p>Click the link below to sign in to MutationMechanic:</p>
        <a href="${verifyUrl}">${verifyUrl}</a>
        <p>This link expires in 15 minutes.</p>
      `
    });

    return res.json({ message: 'Magic link sent' });
  } catch (error) {
    logger.error('Error sending magic link:', error);
    return res.status(500).json({ error: 'Failed to send magic link' });
  }
});

// GET /auth/verify - Verify magic link token
router.get('/auth/verify', async (req, res) => {
  const { token } = req.query as { token?: string };

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token is required' });
  }

  try {
    // Hash incoming token for lookup - token is 256-bit random, sha256 is adequate
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const authToken = await prisma.authToken.findUnique({ where: { tokenHash } });

    if (!authToken) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    // Lookup by tokenHash isolates the record - no need for additional comparison

    if (authToken.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Token expired' });
    }

    if (authToken.usedAt) {
      return res.status(400).json({ error: 'Token already used' });
    }

    // Mark token as used
    await prisma.authToken.update({
      where: { id: authToken.id },
      data: { usedAt: new Date() }
    });

    // Get user
    const user = await prisma.user.findUnique({ where: { id: authToken.userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create persistent session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await prisma.session.create({
      data: {
        userId: user.id,
        sessionHash,
        expiresAt
      }
    });

    // Sign sessionId with HMAC for tamper-proof cookie
    const signature = signSession(sessionToken);
    const cookieValue = `${sessionToken}.${signature}`;

    // Set session cookie
    res.cookie(SESSION_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_TTL_MS
    });

    return res.json({
      user: { id: user.id, email: user.email, plan: user.plan }
    });
  } catch (error) {
    logger.error('Error verifying token:', error);
    return res.status(500).json({ error: 'Failed to verify token' });
  }
});

// POST /auth/logout - Clear session
router.post('/auth/logout', async (req, res) => {
  const cookieValue = req.cookies[SESSION_COOKIE_NAME];
  if (cookieValue && typeof cookieValue === 'string') {
    const parts = cookieValue.split('.');
    if (parts.length === 2) {
      const [sessionId] = parts;
      const sessionHash = crypto.createHash('sha256').update(sessionId).digest('hex');
      // Mark as revoked instead of deleting immediately
      await prisma.session.updateMany({
        where: { sessionHash, revokedAt: null },
        data: { revokedAt: new Date() }
      }).catch(() => {});
    }
  }
  res.clearCookie(SESSION_COOKIE_NAME);
  return res.json({ message: 'Logged out' });
});

// GET /auth/me - Get current user
router.get('/auth/me', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.json({
      user: { id: session.userId, email: session.email, plan: session.plan }
    });
  } catch (error) {
    logger.error('auth/me error:', error);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }
});

export { router as authRouter };
