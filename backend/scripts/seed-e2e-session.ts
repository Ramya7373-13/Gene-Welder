// seed-e2e-session - Phase I E2E session fixture.
//
// Upserts the isolated Phase I E2E user and mints one valid, signed session
// cookie. The script writes ONLY the cookie value to stdout (the Playwright
// global-setup hook captures it); diagnostics go to stderr so the cookie is
// the sole stdout byte stream.
//
// Signing rules mirror backend/src/lib/session.ts exactly: the cookie value is
// "<sessionId>.<hmac-sha256(sessionId)>" and the database stores only the
// sha256 of the sessionId (the sessionHash column). SESSION_SECRET comes from
// backend/.env via dotenv; when unset both this fixture and the backend fall
// back to the same non-production dev secret, so signatures still match.
//
// Run from backend/ so .env resolves (the global-setup hook does this):
//   node node_modules/tsx/dist/cli.mjs scripts/seed-e2e-session.ts

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import crypto from 'node:crypto';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const E2E_EMAIL = 'e2e-phase-i@mutationmechanic.dev';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-secret-never-in-production';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required (run from backend/ so backend/.env resolves)');
    process.exit(2);
  }

  const sessionId = crypto.randomBytes(32).toString('hex');

  const user = await prisma.user.upsert({
    where: { email: E2E_EMAIL },
    update: { name: 'Phase I E2E', plan: 'free' },
    create: {
      email: E2E_EMAIL,
      name: 'Phase I E2E',
      plan: 'free',
    },
  });

  // Fresh session per run: drop the fixture user's prior sessions so the minted
  // cookie is always the live one.
  await prisma.session.deleteMany({ where: { userId: user.id } });

  await prisma.session.create({
    data: {
      userId: user.id,
      sessionHash: crypto.createHash('sha256').update(sessionId).digest('hex'),
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });

  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(sessionId).digest('hex');
  process.stdout.write(`${sessionId}.${signature}\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });