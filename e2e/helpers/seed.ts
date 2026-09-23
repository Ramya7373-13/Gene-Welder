// Phase I E2E - shared, deterministic fixtures.
// Source of truth: docs/phase-i-plan.md.
//
// All identities in the suite are READ BACK from the seeded server - never
// generated as test logic (Phase I acceptance bullet). This module only owns
// constants and the API/auth coordinates the spec does not re-derive.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));

// The backend API base. Defaults to localhost (not 127.0.0.1) so the cookie
// domain in the storage state matches the origin the requests are sent to.
export const API_BASE = process.env.API_URL ?? 'http://localhost:5000';

// Storage state written by the globalSetup hook (e2e/global-setup.ts).
export const AUTH_STATE_PATH = path.join(THIS_DIR, '..', '.auth', 'e2e-user.json');

// Deterministic run parameters (mock RFD3 path only - no real inference).
export const RUN_MODE = 'BINDER' as const;
export const RUN_PARAMS = { numDesigns: 2, seed: 42 } as const;
// Realistic binder target; ASCII so every artifact stays byte-exact ASCII.
export const TARGET_SEQUENCE = 'MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSY' as const;

// Display-name suffix: pid+timestamp scoped, NOT a server identity. Match the
// seed.ts helper it replaces: deterministic per run, display-only.
let counter = 0;
export function displaySuffix(): string {
  return `${process.pid}-${Date.now()}-${counter++}`;
}