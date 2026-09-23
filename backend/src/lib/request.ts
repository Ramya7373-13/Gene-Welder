import express from 'express';

// Resolved client IP. Correctness depends on `trust proxy` being set accurately:
// with TRUST_PROXY_HOPS=0 (the default) this is the socket address and cannot be
// spoofed via X-Forwarded-For. Raising the hop count makes req.ip derive from
// XFF, so only do it when actually behind a proxy you control.
export function getClientIp(req: express.Request): string {
  return req.ip || 'unknown';
}
