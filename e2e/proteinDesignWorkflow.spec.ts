// Phase I E2E - complete protein-design workflow on the real /api/design API.
// Source of truth: docs/phase-i-plan.md (5-stage coverage table) and
// backend/src/routes/design.ts + DesignService (verified this session).
//
// Additive + deterministic: every identity (project/run/candidate/ledger) is
// READ BACK from the server - never generated in the test. Only display names
// use a pid+timestamp suffix (display-only, not a server identity). No
// Math.random()/Date.now()-driven behaviour in assertions (Phase I acceptance
// bullet). Mock RFD3 path only - no real inference is ever invoked.
//
// The session cookie comes from the storage state written by the globalSetup
// hook (e2e/global-setup.ts), which mints it via the backend fixture
// (backend/scripts/seed-e2e-session.ts).

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { AUTH_STATE_PATH, RUN_MODE, RUN_PARAMS, TARGET_SEQUENCE, displaySuffix } from './helpers/seed';
import {
  getAnalytics,
  getCandidate,
  getLedger,
  getRun,
  listCandidates,
  postProject,
  postRun,
  type RunRow,
} from './helpers/api';

const TERMINAL_POLL_ATTEMPTS = 60;
const TERMINAL_POLL_INTERVAL_MS = 500;

// The `request` fixture is a fresh  per test that already
// honours the config baseURL; pin it to the minted session cookie so every
// call in this suite is authenticated.
test.use({ storageState: AUTH_STATE_PATH });

test.beforeAll(() => {
  if (!fs.existsSync(AUTH_STATE_PATH)) {
    throw new Error(
      `Auth state missing at ${AUTH_STATE_PATH}. Run via 'npx playwright test' so the globalSetup hook (e2e/global-setup.ts) mints the session cookie.`,
    );
  }
});

test('complete protein-design workflow: project - run - candidates - analytics - ledger/provenance', async ({ request }) => {
  const suffix = displaySuffix();

  // Stage 1: create the project; id read back from the server.
  const project = await postProject(request, {
    name: `Mutation Mechanic Phase I E2E - ${suffix}`,
  });
  expect(project.status, 'create project').toBe(201);
  expect(project.project.id, 'project id returned').toBeTruthy();

  // Stage 2: create the run under the project; id read back from the server.
  const run = await postRun(request, {
    projectId: project.project.id,
    mode: RUN_MODE,
    parameters: { ...RUN_PARAMS },
    targetSequence: TARGET_SEQUENCE,
  });
  expect(run.status, 'create run').toBe(201);
  expect(run.run.status, 'run is queued on creation').toBe('QUEUED');
  expect(run.run.id, 'run id returned').toBeTruthy();

  // Stage 2b: the run reaches a terminal state through the real GPU queue
  // (mock worker registered at boot in mock API mode - see
  // gpuJobRuntime.ts). Poll until COMPLETED or FAILED, then assert COMPLETED.
  let snap: RunRow | null = null;
  for (let attempt = 0; attempt < TERMINAL_POLL_ATTEMPTS; attempt++) {
    const current = await getRun(request, run.run.id);
    expect(current.status, 'poll run status').toBe(200);
    snap = current.run;
    if (snap.status === 'COMPLETED' || snap.status === 'FAILED') break;
    await new Promise((resolve) => setTimeout(resolve, TERMINAL_POLL_INTERVAL_MS));
  }
  expect(snap?.status, `run ${run.run.id} reaches a terminal state within the poll window`).toBe(
    'COMPLETED',
  );

  // Stage 3: candidates are persisted, ranked from 1, and read back.
  const candidates = await listCandidates(request, run.run.id);
  expect(candidates.status, 'list candidates').toBe(200);
  const ranked = candidates.candidates
    .filter((candidate) => candidate.rankedPosition != null)
    .sort((a, b) => (a.rankedPosition as number) - (b.rankedPosition as number));
  expect(ranked.length, 'at least one ranked candidate').toBeGreaterThanOrEqual(1);
  expect(ranked[0].rankedPosition, 'top candidate ranked 1').toBe(1);
  const distinctRanks = new Set(ranked.map((candidate) => candidate.rankedPosition));
  expect(distinctRanks.size, 'ranked positions are distinct').toBe(ranked.length);
  const topCandidateId = ranked[0].id;
  expect(topCandidateId, 'top candidate id').toBeTruthy();

  // Stage 4: candidate detail + analytics reflect this run.
  const detail = await getCandidate(request, topCandidateId);
  expect(detail.status, 'read candidate').toBe(200);
  expect(detail.candidate.id, 'candidate read back by id').toBe(topCandidateId);
  expect(detail.candidate.sequence, 'mock candidate has a sequence').toBeTruthy();

  const analytics = await getAnalytics(request);
  expect(analytics.status, 'read analytics').toBe(200);
  expect(analytics.analytics.totalProjects, 'analytics - project count').toBeGreaterThanOrEqual(1);
  expect(analytics.analytics.totalRuns, 'analytics - run count').toBeGreaterThanOrEqual(1);
  expect(analytics.analytics.totalCandidates, 'analytics - candidate count').toBeGreaterThanOrEqual(1);

  // Stage 5: the provenance ledger exists for the top candidate, hash chain intact.
  const ledger = await getLedger(request, topCandidateId);
  expect(ledger.status, 'read ledger').toBe(200);
  expect(ledger.ledger.length, 'ledger has at least one entry').toBeGreaterThanOrEqual(1);
  expect(ledger.chain.valid, 'chain verifies end-to-end').toBe(true);
  expect(ledger.chain.brokenAt, 'chain has no breaks').toBe(-1);
  for (const entry of ledger.ledger) {
    expect(entry.candidateId, 'entry belongs to the candidate').toBe(topCandidateId);
    expect(entry.modelVersion.startsWith('rfd3-mock'), 'mock model version recorded').toBe(true);
    expect(entry.seed, 'seed recorded matches the requested seed').toBe(RUN_PARAMS.seed);
    expect(entry.ledgerHash, 'entry carries a ledger hash').toBeTruthy();
  }
});
