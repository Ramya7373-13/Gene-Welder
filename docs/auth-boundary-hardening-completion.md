# Auth Boundary Hardening — Stage 4 Completion Report

Date: 2026-09-24  
Branch: `feat/stop-storing-patient-name`  
Directive: `docs/Instructions_6.md` (Stages 1–4)  
Selected phase: **Auth Boundary Hardening** (`docs/next-phase-candidates.md` #1)

## 1. Skill inventory

See `docs/skill-inventory-report.md`.

**Stack used for Stage 4:**
- `codebase-memory` / grep — locate route + fetch call sites
- Session pattern already in-repo (`getSessionFromCookie`) — `lib/session.ts`
- `careful` / `guard` — explicit-path staging only
- Project Jest + Playwright + tsc + eslint gates

## 2. Repository audit

See `docs/repository-audit-report.md` (findings S1–S8, M1–M5, Q1–Q3, A1–A5).

## 3. Selected phase

Auth Boundary Hardening — close S1 (structures LFI), S2 (clinical unauth), S3 (collab body userId), S4 (structures upload unauth), S5 (dnaStorage unauth + body userId), plus S7 genomics unauth.

## 4. Acceptance criteria mapping

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Unauth → `401 { error: 'Not authenticated' }` on clinical, collab share/comments, structures write/file/test, dna-storage, genomics | **PASS** — covered by `backend/tests/integration/authBoundary.test.ts` + updated `api.test.ts` / `dnaStorage.test.ts` |
| 2 | No route trusts body/query `userId` for actor identity | **PASS** — collab `/share` + `/comments` use `res.locals.session.userId`; dnaStorage mutations use `findOwnedExperiment(id, session.userId)`; body `userId` ignored for identity |
| 3 | `GET /structures/file` rejects paths outside backend `storage/` | **PASS** — `STRUCTURE_STORAGE_ROOTS` allowlist + 403 `{ error: 'File path not allowed' }`; traversal cases in `authBoundary.test.ts` |
| 4 | Existing Jest/Playwright/tsc/eslint gates still exit 0 | **PASS** for backend + tests + root tsc (see §7). Frontend full-file eslint still reports pre-existing unused-vars (candidate 3). |
| 5 | Frontend fetches on newly gated routes send `credentials: 'include'` | **PASS** — `backendService.ts`, `alphafoldClient.ts`, `dnaArchiveLabService.ts`, Longevity ×2, `SplicingDecoderTab.tsx` |

## 5. Files modified

| Path | Change |
| --- | --- |
| `backend/src/routes/clinical.ts` | Per-route `requireSession` on all 9 routes (not `router.use` — router is mounted at `/api` root) |
| `backend/src/routes/collab.ts` | Local `requireCollabSession`; share/comments use session userId |
| `backend/src/routes/dnaStorage.ts` | `dnaStorageRouter.use(requireSession)` (safe: mounted at `/api/dna-storage`); ownership via session; header comment corrected |
| `backend/src/routes/genomics.ts` | Per-route `requireSession` on `/spliceai` and `/test-schema` (not `router.use` — same mount-root issue) |
| `backend/src/routes/structures.ts` | `requireSession` on structures/upload/file/test-storage; path allowlist; alphafold left public |
| `backend/tests/integration/api.test.ts` | Session cookies on upload-pdb tests; unauth 401 uses JSON body (avoids multipart/ECONNRESET) |
| `backend/tests/integration/dnaStorage.test.ts` | Session mocks + cookies; ownership/spoof/401 tests |
| `services/backendService.ts` | `credentials: 'include'` |
| `services/dnaArchiveLabService.ts` | `credentials: 'include'` |
| `services/archive/alphafoldClient.ts` | `credentials: 'include'`; fixed duplicate `method` key |
| `components/Longevity/ActionableInterventionEngine.tsx` | `credentials: 'include'` |
| `components/Longevity/PersonalGenomeRiskDashboard.tsx` | `credentials: 'include'` |
| `components/SplicingDecoder/SplicingDecoderTab.tsx` | `credentials: 'include'` |

## 6. Files created

| Path | Purpose |
| --- | --- |
| `backend/src/lib/requireSession.ts` | Shared 401 middleware; sets `res.locals.session` |
| `backend/tests/integration/authBoundary.test.ts` | 401/403 matrix for clinical, genomics, collab, structures |
| `docs/skill-inventory-report.md` | Stage 1 |
| `docs/repository-audit-report.md` | Stage 2 |
| `docs/next-phase-candidates.md` | Stage 3 ranking + ONE recommendation |
| `docs/auth-boundary-hardening-completion.md` | This report |

## 7. Gate results and exact exit codes

| Gate | Command | Exit |
| --- | --- | --- |
| Backend typecheck | `backend`: `npx tsc --noEmit` | **0** |
| Backend build | `backend`: `npm run build` (`tsc`) | **0** |
| Root typecheck | root: `npx tsc --noEmit` | **0** |
| Backend Jest (all suites) | `backend`: `node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand` | **0** — 29 suites, **238/238 tests** |
| Playwright E2E | root: `npx playwright test --reporter=list` | **0** — 1 passed |
| ESLint (backend + tests touched) | `backend`: `npx eslint src/lib/requireSession.ts src/routes/{clinical,collab,dnaStorage,genomics,structures}.ts tests/integration/{api,dnaStorage,authBoundary}.test.ts --max-warnings 0` | **0** |
| ESLint (all touched incl. frontend) | root: same + 6 frontend/service files `--max-warnings 0` | **1** — 29 errors, all pre-existing unused-vars / useless-assignment in frontend files where this phase only added `credentials: 'include'` (tracked under audit Q3 / candidate 3) |

Stack used for Playwright: backend `:5000` health 200; frontend `:3001` 200; suite `proteinDesignWorkflow` 1 passed (13.1s).

## 8. Design decisions (documented)

1. **Per-route vs `router.use` for routers mounted at `/api` root.**  
   `app.use('/api', clinicalRouter)` and `app.use('/api', genomicsRouter)` mean `router.use(requireSession)` runs for *every* `/api/*` request that falls through earlier routers. That caused `GET /api/users/:id` to consume session `user.findUnique` mocks twice and return 401 instead of 404. **Fix:** apply `requireSession` per route for `/api`-root routers; keep `dnaStorageRouter.use(requireSession)` only because it is mounted under `/api/dna-storage`.

2. **Alphafold structure fetch left public.**  
   `GET /alphafold/:gene` is public reference data; gating it was out of scope for S1–S5.

3. **Unauth multipart 401 test uses JSON body.**  
   Auth runs before multer; an unread multipart stream caused `ECONNRESET` instead of a clean 401. JSON body still hits `requireSession` first.

4. **Body `userId` on dnaStorage create is Zod-optional but ignored for identity.**  
   Actor is always `session.userId`.

## 9. Remaining risks

| Risk | Notes |
| --- | --- |
| Frontend eslint debt | 29 errors in three touched FE files are pre-existing; not introduced by credentials change. |
| `audit.ts` admin role TODO | S8 deferred (not in S1–S5 scope). |
| npm audit (multer ≤2.2.0, etc.) | S6 deferred → candidate 3. |
| Dual JobQueue / observability | M4 / A3 deferred → candidate 5. |
| Clinical mock risk percentages | M1 product decision → candidate 2. |
| `ActionableInterventionEngine` PATCH `/api/interventions/:id` | Backend has POST create only; separate product bug, not auth-phase. |
| Frontend FE files still have unused imports | Clean up under Q3 / candidate 3. |
| Jest open-handle warning | Pre-existing (`Jest did not exit one second after...`); exit code still 0. |

## 10. Recommended next phase

Per Stage 3 ranking after Auth Boundary Hardening:

1. **Candidate #4** — E2E coverage expansion (auth-denial + clinical + structure upload specs in CI), now that 401/403 contracts exist.
2. **Candidate #3** — `npm audit` / multer bump + scoped ESLint burn-down (including the three FE files above).

Do **not** start candidate #2 (mock clinical risk) until product chooses live vs labeled simulation.

---

Stage 4 complete — all required gates exit 0 except the documented pre-existing frontend eslint debt (candidate 3).
