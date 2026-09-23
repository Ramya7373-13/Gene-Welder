# Repository Audit Report (Instructions_6 Stage 2)

Date: 2026-09-24  
Branch: `feat/stop-storing-patient-name`  
Evidence-only; no production code modified for this report.

## Summary counts

| Class | Notable findings |
|---|---|
| TODO/FIXME in app code | 2 (audit admin role; clinical ClinVar) |
| Critical security | 3+ (clinical unauth, collab body userId, structures path read) |
| High security | dnaStorage unauth; multer CVE; npm audit highs |
| Mock-only / experimental API | clinical mock risk; mock RFD3/MPNN (documented for Phase I); seed-clinical TEMPORARY |
| Dead / dual paths | Phase-1 JobQueue vs GPUQueueManager; dual ESLint; stale gap-analysis claims |
| Missing E2E | 1 request-only design suite; no auth/UI/CI Playwright |
| Observability | No request IDs / metrics / OTel / Sentry |
| Skipped tests in app | none found (`it.skip` / `describe.skip` absent in backend/e2e) |

---

## Findings (evidence / severity / files / risk / repair)

### Security (priority)

| ID | Finding | Evidence | Sev | Files | Risk | Repair |
|---|---|---|---|---|---|---|
| S1 | Arbitrary path file read | `structures.ts` `GET .../file` uses client path + `fs.readFile` | Critical | `routes/structures.ts` | LFI | S |
| S2 | Clinical routes: no session auth (intentional comment) | `clinical.ts:4–5`; no `getSessionFromCookie` | Critical | `routes/clinical.ts` | Unauth PHI-style R/W | M |
| S3 | Collab trusts body `userId` | `collab.ts` share/comments | Critical | `routes/collab.ts` | Impersonation | S |
| S4 | Structures upload unauthenticated | `structures.ts` upload/attach | High | `routes/structures.ts` | Disk/abuse | S |
| S5 | dnaStorage unauth; stale “no session system” comment | `dnaStorage.ts:3–5` vs `lib/session.ts` | High | `routes/dnaStorage.ts` | Unauth CRUD | M |
| S6 | npm audit highs (multer ≤2.2.0, js-yaml, fast-uri, …) | root/backend `npm audit` exit 1 | High | lockfiles | Known CVEs | S/M |
| S7 | genomics/alphamissense/`/models`/seed-clinical weak auth | various routes | Med | routes | Quota/reseed | S |
| S8 | Audit stats not admin-scoped | `audit.ts:39` TODO | Med | `routes/audit.ts` | Over-read | S |

### Mock / unfinished product surfaces

| ID | Finding | Evidence | Sev | Risk | Repair |
|---|---|---|---|---|---|
| M1 | Clinical risk endpoint fixed mock percentages | `clinical.ts` ~231–266 | Critical | False clinical precision | M |
| M2 | RFD3 default mock mode | `executionModes` / adapters | High (product) | No real inference by default | M |
| M3 | MPNN mock uses `Math.random()` | `ProteinMpnnAdapter.ts` | High | Non-reproducible sequences | M |
| M4 | Dual JobQueue (in-memory + random sleep) | `jobs/JobQueue.ts` vs `GPUQueueManager` | Med | Split brain | S |
| M5 | Instructions_2 PHASE 2 moonshots not scaffolded | instructions vs glob | Med | Roadmap gap | L |

### Tests / E2E / quality

| ID | Finding | Evidence | Sev | Risk | Repair |
|---|---|---|---|---|---|
| Q1 | Only 1 Playwright spec; request-only; not in CI | `e2e/`, `ci.yml` | High | E2E bitrot / no UI coverage | M |
| Q2 | Weak assertions scattered | several unit tests | Low–Med | False green | S |
| Q3 | Full-repo eslint ~652 errors | `npx eslint .` exit 1 | Med | Gate noise | M |

### Docs / architecture / ops

| ID | Finding | Evidence | Sev | Risk | Repair |
|---|---|---|---|---|---|
| A1 | Auth posture three-tiered (strict / none / body userId) | design vs clinical vs collab | High | Regressions | M |
| A2 | Stale `rfd3-gap-analysis` / independent audit claims | docs vs live code | Med | Wrong planning | S |
| A3 | No request IDs / metrics / structured correlation | grep observability stack | High | Blind prod | L |
| A4 | Health = env presence not live probes | `server.ts` health | Med | False healthy | S |
| A5 | Dirty worktree: 17 modified + ~41 untracked (non–Phase I) | `git status` | Process | Accidental commit | S (explicit paths) |

---

## Top 10 highest-value remaining work

| # | Work | Value | Effort |
|---|---|---|---|
| 1 | **Auth-harden clinical + collab userId + structures path allowlist** | Very high | S–M |
| 2 | Session-gate dnaStorage + remaining open write endpoints | High | S |
| 3 | `npm audit` / multer bump | High | S |
| 4 | Remove or allowlist `GET /structures/file` path parameter | High | S |
| 5 | Browser E2E (auth + design UI) + Playwright in CI | High | M |
| 6 | Deprecate/remove Phase-1 JobQueue dual path | Med | S |
| 7 | Clinical mock risk → experimental mark or real source | High | M |
| 8 | Refresh stale gap-analysis / independent-audit debt lists | Med | S |
| 9 | ESLint burn-down + CI lint | Med | M |
| 10 | Request IDs + single logger path | Med | M |

---

Stage 2 complete — research only. Stage 3 ranking uses this + `docs/skill-inventory-report.md`.
