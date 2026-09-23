# Phase I Completion Report - Protein Design Workflow E2E

Source of truth: `docs/Instructions_3.md` Phase I + `docs/Instructions_4.md`
(Option 1). Status: **COMPLETE - all gates green.**

Scope: additive, deterministic Playwright E2E covering the complete
protein-design workflow on the **seeded local stack**, mocked RFD3/MPNN path
(never real inference), zero new random behaviour in assertions, existing
backend tests kept green (218/218).

---

## 1. Files created / modified (Phase I surface)

### Created

| File | Role |
|---|---|
| `playwright.config.ts` | Root Playwright config (`testDir ./e2e`, channel msedge, workers 1, globalSetup) |
| `e2e/proteinDesignWorkflow.spec.ts` | 5-stage E2E suite (real `/api/design`, session storage state) |
| `e2e/helpers/seed.ts` | Deterministic display suffix + run params (`seed: 42`) |
| `e2e/helpers/api.ts` | API helpers (`postProject/postRun/getRun/listCandidates/getAnalytics/getLedger/...`) |
| `e2e/global-setup.ts` | Mints session cookie via backend fixture -> Playwright storage state |
| `backend/scripts/seed-e2e-session.ts` | Documented session fixture (user upsert + signed cookie to stdout) |
| `backend/tests/unit/proteinDesign/ledgerRoute.test.ts` | Ledger route contract tests (200/401/404/422) |
| `eslint.config.js` | Flat ESLint config (ESLint 10 + TypeScript parser) - required for lint gate |

### Modified (runtime fixes required for a green HTTP E2E)

| File | Change |
|---|---|
| `backend/src/domain/proteinDesign/gpu/gpuJobRuntime.ts` | Mock worker registration + unref'd heartbeat interval (`MOCK_WORKER_ID`, `mockHeartbeatTimer`); cleared in `resetGpuJobRuntimeForTests` |
| `backend/src/domain/proteinDesign/gpu/GPUQueueManager.ts` | After `runOnWorker` succeeds, notify **COMPLETED only** (no racing `VALIDATING` notify) |
| `backend/src/domain/proteinDesign/service/DesignService.ts` | Per-runId `queueStatusChains` serialization + `applyQueueStatusLocked` with atomic terminal-status guard (`updateMany`); `getCandidateLedger` + `ledgerRowToEntry` (write-shape projection: drop `id`, null->undefined); `writeLedger` sets `validationMetrics` on record **before** `toLedgerEntry` and persists `timestamp: linked.timestamp` |
| `backend/src/domain/proteinDesign/artifacts/ArtifactStore.ts` | Unique tmp name per `writeFile` attempt (pid+time+rand) to stop ENOENT rename races; `runStatusChains` serializes concurrent `recordRunStatus` append-modify-write on `run.json` |
| `backend/src/domain/proteinDesign/service/dto.ts` | + `ledgerQueryDto` |
| `backend/src/routes/design.ts` | + `GET /candidates/:candidateId/ledger` |
| `e2e/proteinDesignWorkflow.spec.ts` | UTF-8 BOM stripped (0 non-ASCII); unused `API_BASE` import removed for lint |
| `package.json` (root) | + devDeps: `eslint`, `@eslint/js`, `typescript-eslint` (lint gate tooling) |

Authoritative code references (line numbers at completion time):

- Status serialization: `DesignService.ts:153` (`queueStatusChains`), `:305-343`
  (`applyQueueStatus` / `applyQueueStatusLocked`)
- Ledger read projection: `DesignService.ts:389-487` (`getCandidateLedger`, `ledgerRowToEntry`)
- Ledger write shape: `DesignService.ts:947` (validationMetrics before hash), `:977-978`
  (persist hashed `timestamp` + `validationMetrics`)
- run.json races: `ArtifactStore.ts:90` (`runStatusChains`), `:146-186`,
  `:395-407` (unique tmp `writeFile`)
- Mock heartbeat: `gpuJobRuntime.ts:15-50`, `:84-87`
- Terminal notify: `GPUQueueManager.ts:291-299`
- Ledger route: `routes/design.ts:236-242`
- Ledger schema: `prisma/schema.prisma:789-819` (`DesignLedger`)

---

## 2. Acceptance-criteria mapping

| Phase I / Instructions_3 requirement | Delivered |
|---|---|
| Project creation | Stage 1 - `POST /api/design/projects` -> 201, id read back |
| Run creation | Stage 2 - `POST /api/design/runs` -> 201, `status === 'QUEUED'` |
| Run reaches completion | Stage 2b - bounded poll (60 x 500 ms) until `COMPLETED` |
| Candidate generation | Stage 3 - `GET /candidates?runId=` -> >=1 ranked, top rank 1, distinct ranks |
| Analytics validation | Stage 4 - `GET /analytics` totals >= 1 |
| Ledger/provenance validation | Stage 5 - `GET .../ledger` -> 200, `chain.valid === true`, `brokenAt === -1`, hashes present, seed matches, modelVersion `rfd3-mock*` |
| Seeded local stack + mock RFD3/MPNN | `RFD3_API_MODE` default `mock`; session fixture requires live stack; real inference never called |
| Preserve currently green tests | Backend Jest **28 suites / 218 tests passed** (no regressions) |
| Deterministic, no new `Math.random` in tests | Display suffix is pid+counter; identities read from server; no `Math.random` in fixture/spec logic |
| Document fixtures / seed assumptions | `phase-i-plan.md` section 2-3; this report section 5 |
| Gates reported with exact outputs | section 3 below |

---

## 3. Gates - exact commands, outputs, exit codes (this completion run)

| # | Gate | Command | Exit | Result (summary of full output) |
|---|---|---|---|---|
| 1 | Backend TypeScript | `cd backend && npx tsc --noEmit` | **0** | no diagnostics |
| 2 | Backend build | `cd backend && npm run build` (`tsc`) | **0** | emit OK |
| 3 | Root TypeScript (incl. e2e) | `npx tsc --noEmit` (repo root) | **0** | no diagnostics |
| 4 | Lint (Phase I changed files, `--max-warnings 0`) | see exact file list below | **0** | 0 errors, 0 warnings |
| 5 | New Playwright suite | `npx playwright test --reporter=list` | **0** | Completion run: `1 passed (14.9s)`; close-out re-run: `1 passed (14.5s)` - `ok 1 [chromium] - e2e\proteinDesignWorkflow.spec.ts:45:1 - complete protein-design workflow: project - run - candidates - analytics - ledger/provenance` |
| 6 | Full backend Jest suite | `cd backend && npm test` -> `node --experimental-vm-modules node_modules/jest/bin/jest.js` | **0** | Completion run: `Test Suites: 28 passed`, `Tests: 218 passed`, `Time: 15.34 s`; close-out re-run: `28/28`, `218/218`, `Time: 12.434 s` |

Close-out re-verification (per `docs/Instructions_5.md` §2, this session): gates 1–4 re-ran exit **0**; gate 5 exit **0** (`1 passed`); gate 6 exit **0** (`218 passed`). Health during run **200**. Exact exit codes above are the recorded values for the completion report.

### Gate 4 - exact lint file list (root workdir)

```
npx eslint --max-warnings 0 \
  backend/src/domain/proteinDesign/service/DesignService.ts \
  backend/src/domain/proteinDesign/service/dto.ts \
  backend/src/domain/proteinDesign/artifacts/ArtifactStore.ts \
  backend/src/domain/proteinDesign/provenance/ProvenanceService.ts \
  backend/src/domain/proteinDesign/gpu/gpuJobRuntime.ts \
  backend/src/domain/proteinDesign/gpu/GPUQueueManager.ts \
  backend/src/domain/proteinDesign/utils/stableJson.ts \
  backend/src/routes/design.ts \
  backend/scripts/seed-e2e-session.ts \
  e2e/proteinDesignWorkflow.spec.ts \
  e2e/helpers/seed.ts \
  e2e/helpers/api.ts \
  e2e/global-setup.ts \
  playwright.config.ts \
  eslint.config.js
```

-> `eslint_exit=0`

### Stack health during gates

- `GET http://localhost:5000/api/health` -> **200**
- Backend process: booted via `tsx` preflight loader with stdout redirected to
  `backend/backend-restart.log`; log deleted after gates + backend stop
  (Instructions_5 hygiene).
- Postgres `:5432` up; schema present (`prisma db push` from earlier sessions)

---

## 3b. Rationale - mock worker registration

`GPUQueueManager.runOnWorker` requires a registered worker slot. The Phase I
stack runs in-process mock mode with no external GPU worker process, so jobs
sat in `QUEUED`/`RUNNING` with zero candidates until a worker existed.
`gpuJobRuntime.ts` registers `MOCK_WORKER_ID` (`mock-rfd3-worker`) at runtime
startup and starts an `unref()`'d 2s heartbeat so the registry does not prune
the slot mid-job. The timer is cleared in `resetGpuJobRuntimeForTests` to keep
Jest handles clean. This is the mock-path equivalent of a real worker
registering and heartbeating - not a bypass of queue/status logic. Real remote
workers would still need `startLivenessSweep` wired at boot (see risks).

---

## 4. Contract / design notes (justified, not weakened assertions)

- Ledger body is **not** raw Prisma rows: `getCandidateLedger` projects through
  `ledgerRowToEntry` so the hashed entry shape matches write-time
  `ProvenanceService.linkEntry` / `stableStringify` (drop auto `id`, omit nulls).
  Without this, `chain.valid` was false despite intact DB rows - documented as
  a **write/read shape parity fix**, not an assertion relaxation.
- `writeLedger` must attach `validationMetrics` to the record **before**
  `toLedgerEntry`, because validation was computed separately and would
  otherwise be omitted from the hash while still stored on the row.
- `timestamp` is persisted as `linked.timestamp` (the hashed value), not a
  fresh DB `@default(now())`.
- Concurrent status writers (`applyQueueStatus` vs `recordRunStatus`) are
  serialized per `runId` via promise chains; terminal status is written with
  an atomic `updateMany` guard so `VALIDATING` cannot clobber `COMPLETED`.
- `ArtifactStore.writeFile` uses a unique temp filename per attempt so parallel
  `run.json` writers cannot ENOENT on rename.
- Mock GPU worker heartbeat keeps the registry slot alive during the job;
  timer is `unref()`'d and cleared on test reset.
- After a successful `runOnWorker`, the queue notifies **only** `COMPLETED`
  (validation+ranking already ran inside `executeDesignJob`).

---

## 5. Fixtures / seed assumptions / test utilities

1. **Session fixture** - `backend/scripts/seed-e2e-session.ts`
   - Upserts `e2e-phase-i@mutationmechanic.dev` (passwordless; Session row only).
   - Session TTL 30 days; cookie value HMAC-signed exactly as `lib/session.ts`.
   - Writes cookie value to stdout only (no secrets in repo files).
   - Side effect: user + session row persist across runs (deterministic upsert).

2. **Global setup** - `e2e/global-setup.ts`
   - Invokes fixture through `tsx` with backend cwd so `backend/.env` loads.
   - Fails fast with a clear message if backend/Postgres not ready.

3. **Deterministic identities**
   - Display names: pid + monotonic counter suffix (display-only).
   - Run seed: `42` (from `seed.ts` `RUN_PARAMS`).
   - All asserted ids read back from HTTP responses.

4. **Mock engine**
   - `RFD3_API_MODE` default `mock` (no external inference).
   - Model version tag asserted prefix `rfd3-mock`.

5. **ESLint gate modernization**
   - Root had only `.eslintrc.json` and no `eslint` package; ESLint 9+/v10
     rejects eslintrc (`couldn't find eslint.config.*`), so `npx eslint` could
     not run the declared gate at all.
   - Added devDeps `eslint@10.11.0`, `@eslint/js`, `typescript-eslint` and flat
     `eslint.config.js` (recommended + TS parser + node/browser globals;
     `no-undef` off for TS). Gate = `npx eslint --max-warnings 0` over the
     Phase I changed-file list only; full-repo lint remains out of scope.

---

## 6. Risks / remaining gaps

| Risk | Severity | Notes |
|---|---|---|
| Full-repo `npx eslint .` still ~812 errors in legacy frontend/services | Low for Phase I | Out of gate file list; pre-existing; optional cleanup |
| `GPUQueueManager.startLivenessSweep` still never called | Low (mock path) | In-process mock worker + heartbeat covers Phase I; real remote workers would need the sweep wired at boot |
| Worker process open-handle warning in Jest | Info | `A worker process has failed to exit gracefully... force exited` - suites still exit 0; pre-existing pattern |
| `npm audit` reports 1 high severity (root) | Out of scope | Not introduced as a Phase I dependency decision beyond eslint tooling; triage separately |
| Parallel Playwright invocations can race auth storage | Operational | Run suite once, sequentially (`workers: 1`, `fullyParallel: false`) |
| Stale artifact runs in `backend/artifacts/` | Cosmetic | Harmless historical runs |
| Untracked Phase I sources | Process | Close-out commit stages explicit Phase I paths only (no `git add -A`) |

---

## 7. Determinism / ASCII check (E2E deliverables)

| File | Bytes | Non-ASCII |
|---|---:|---:|
| `playwright.config.ts` | 1895 | 0 |
| `e2e/proteinDesignWorkflow.spec.ts` | 5756 | 0 (BOM stripped) |
| `e2e/helpers/seed.ts` | 1444 | 0 |
| `e2e/helpers/api.ts` | 3815 | 0 |
| `e2e/global-setup.ts` | 2500 | 0 |
| `backend/scripts/seed-e2e-session.ts` | 2540 | 0 |
| `eslint.config.js` | 3037 | 0 |

---

## 8. Verdict

| Gate | Status | Exit |
|---|---|---|
| Backend tsc | **PASS** | **0** |
| Backend build | **PASS** | **0** |
| Root tsc | **PASS** | **0** |
| ESLint (changed files, max-warnings 0) | **PASS** | **0** |
| Playwright E2E | **PASS (1/1)** | **0** |
| Backend Jest (full) | **PASS (28/28, 218/218)** | **0** |
| Health endpoint during run | **PASS** | HTTP **200** |

**Phase I is complete per `Instructions_3.md` + `Instructions_4.md`.**
Close-out checklist per `Instructions_5.md`: hygiene done (probes/logs/recon
scratch removed; backend stopped before `backend-restart.log` delete); docs
validated; commit staged with explicit paths only.

---

## 9. Lessons learned (preserved per Instructions_5 §3)

| Obs | Lesson |
|---|---|
| **0024** | Runtime traced healthy end-to-end; earlier diagnosis was a **payload-shape mismatch**, not a worker deadlock. |
| **0026** | Ledger **write/read shape parity** is required for hash verification (`ledgerRowToEntry` must match write-time `stableStringify`). |
| **0027** | Repo lint gate can fail solely because **ESLint flat-config / version pinning** lags the installed major (eslintrc vs ESLint 9+/10). |
| **0028** | On mixed working trees, **stage explicit paths only** (no `git add -A`); commit scope is a phase boundary, not a worktree boundary. |
