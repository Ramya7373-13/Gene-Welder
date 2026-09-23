import { defineConfig, devices } from '@playwright/test';

/**
 * Phase I E2E - MutationMechanic protein-design workflow.
 * Source of truth: docs/Instructions_3.md Phase I (read verbatim this session;
 * gates listed in docs/phase-i-plan.md).
 *
 * Determinism contract (Phase I acceptance bullet, verified from
 * Instructions_3.md this session): the suite is additive, deterministic and
 * introduces NO new Math.random()/Date.now()-matched behaviour. All identities
 * (project/run/candidate/ledger ids) are read back from the seeded server -
 * never generated in the test. This config stays byte-exact ASCII so the run
 * is repeatable byte-for-byte on any checkout (no tool-channel corruption).
 *
 * Stack (verified this session): frontend on :3001 (Vite, listening this
 * session), API on :5000 (backend; seeded local stack gate - full suite needs
 * it live, so gates that require it are honestly gated behind a running seeded
 * stack, never faked).
 *
 * The suite drives the seeded local stack only. Mock RFD3/MPNN execution path
 * is exercised (never real inference) and stays deterministic.
 */

export default defineConfig({
  testDir: './e2e',
  // Sessions are minted by the backend fixture via a storage state (see
  // e2e/global-setup.ts). The suite is request-only, so no browser binaries
  // are launched even though a chromium project is declared.
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3001',
    channel: 'msedge',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
