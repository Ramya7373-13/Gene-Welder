// Phase I E2E - global setup hook.
// Source of truth: docs/phase-i-plan.md (session-fixture section).
//
// Mints the isolated Phase I E2E session by running the backend fixture script
// (backend/scripts/seed-e2e-session.ts) with the backend as the working
// directory so backend/.env resolves, then writes the Playwright storage state
// that every test's request context loads. Registered in playwright.config.ts
// as `globalSetup`.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// e2e/global-setup.ts -> repo root (ESM-safe via import.meta.url).
const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, '..');
const BACKEND_DIR = path.join(REPO_ROOT, 'backend');
const TSX_CLI = path.join(BACKEND_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const FIXTURE = path.join(BACKEND_DIR, 'scripts', 'seed-e2e-session.ts');
const AUTH_DIR = path.join(THIS_DIR, '.auth');
const AUTH_STATE = path.join(AUTH_DIR, 'e2e-user.json');

// Mirrors backend/src/lib/session.ts SESSION_COOKIE_NAME. Kept local so the
// e2e bundle never imports backend src (which would construct a PrismaClient).
const SESSION_COOKIE_NAME = 'mm_session';

export default function globalSetup(): void {
  if (!fs.existsSync(TSX_CLI)) {
    throw new Error(`tsx CLI not found at ${TSX_CLI} - run npm install in backend/ first`);
  }
  if (!fs.existsSync(FIXTURE)) {
    throw new Error(`Session fixture missing at ${FIXTURE}`);
  }

  const child = spawnSync(process.execPath, [TSX_CLI, FIXTURE], {
    cwd: BACKEND_DIR,
    encoding: 'utf-8',
    env: { ...process.env },
  });

  if (child.status !== 0) {
    throw new Error(
      `Session fixture failed (exit ${child.status ?? 'null'}):\n${child.stderr || child.stdout}`,
    );
  }

  const cookie = String(child.stdout ?? '').trim();
  if (!cookie.includes('.')) {
    throw new Error(`Session fixture produced no signed cookie (stdout: '${cookie}')`);
  }

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(
    AUTH_STATE,
    JSON.stringify(
      {
        cookies: [
          {
            name: SESSION_COOKIE_NAME,
            value: cookie,
            domain: 'localhost',
            path: '/',
            expires: -1,
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
          },
        ],
        origins: [],
      },
      null,
      2,
    ),
  );
}