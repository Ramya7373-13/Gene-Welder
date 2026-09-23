// Free-tier usage metering.
// Moved verbatim out of server.ts so routers can meter AI calls without a cycle.

import { prisma } from '../prisma.js';

export const FREE_USAGE_LIMIT = 2;
export const METRIFIED_FEATURES = ['variant_analysis', 'splicing_decode', 'ai_chat', 'clinical_summary'] as const;
export type MeteredFeature = typeof METRIFIED_FEATURES[number];

// Atomic reservation function - prevents TOCTOU race condition
// Uses PostgreSQL advisory lock to serialize check+insert per (userId, feature)
export async function reserveUsage(userId: string, feature: MeteredFeature): Promise<{ allowed: boolean; remaining: number; plan: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { allowed: false, remaining: 0, plan: 'free' };
  }

  if (user.plan === 'pro') {
    return { allowed: true, remaining: -1, plan: 'pro' }; // -1 means unlimited
  }

  // Atomic transaction with advisory lock to prevent race conditions
  // pg_advisory_xact_lock releases automatically at transaction end
  const lockKey = `SELECT pg_advisory_xact_lock(hashtext('${userId}:${feature}'::text))`;

  const result = await prisma.$transaction(async (tx: typeof prisma) => {
    // Acquire advisory lock (serializes concurrent requests for same user+feature)
    await tx.$executeRawUnsafe(lockKey);

    // Re-count after acquiring lock (count may have changed)
    const count = await tx.usageEvent.count({
      where: { userId, feature }
    });

    if (count >= FREE_USAGE_LIMIT) {
      return { allowed: false, remaining: 0, plan: 'free' as const };
    }

    // Reserve the slot atomically by inserting the usage event
    await tx.usageEvent.create({
      data: { userId, feature }
    });

    return {
      allowed: true,
      remaining: FREE_USAGE_LIMIT - count - 1,
      plan: 'free' as const
    };
  });

  return result;
}

// Legacy checkUsage - only for read-only /api/usage endpoint
export async function checkUsage(userId: string, feature: MeteredFeature): Promise<{ allowed: boolean; remaining: number; plan: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { allowed: false, remaining: 0, plan: 'free' };
  }

  if (user.plan === 'pro') {
    return { allowed: true, remaining: -1, plan: 'pro' }; // -1 means unlimited
  }

  const count = await prisma.usageEvent.count({
    where: { userId, feature }
  });

  if (count >= FREE_USAGE_LIMIT) {
    return { allowed: false, remaining: 0, plan: 'free' };
  }

  return { allowed: true, remaining: FREE_USAGE_LIMIT - count - 1, plan: 'free' };
}
