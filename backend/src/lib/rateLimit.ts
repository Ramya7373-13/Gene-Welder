// In-memory rate limiting for /api/auth/request-link.
// Per-email: max 3 requests per 15 minutes
// Per-IP: max 10 requests per 15 minutes
//
// Note: in-memory, so per-instance. Behind multiple replicas these counters do
// not share state — swap for Redis if the API is ever horizontally scaled.

export interface RateLimitEntry { count: number; resetAt: number; }

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const EMAIL_RATE_LIMIT = 3;
export const IP_RATE_LIMIT = 10;
export const emailRateLimits = new Map<string, RateLimitEntry>();
export const ipRateLimits = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  rateLimits: Map<string, RateLimitEntry>,
  key: string,
  limit: number
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true };
}
