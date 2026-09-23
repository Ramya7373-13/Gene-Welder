# Stage 3 — Next Phase Candidates (Recommended: ONE)

Evidence: `docs/repository-audit-report.md` (Stage 2), `docs/skill-inventory-report.md` (Stage 1), `docs/Instructions_6.md`.

## Candidate ranking

### 1. Auth Boundary Hardening (RECOMMENDED — implement next)

| Field | Value |
| --- | --- |
| **Objective** | Close unauthenticated and spoofable write/read surfaces that exist in production routers today (audit findings S1–S5), while keeping the existing green suite green. |
| **Evidence** | `clinical.ts` all routes no session; `collab.ts` `/share` + `/comments` trust body `userId`; `structures.ts` `GET /structures/file` arbitrary `fs.readFile` + unauth upload; `dnaStorage.ts` no session + body `userId`; `genomics.ts` unauth; `audit.ts` admin TODO (partial). |
| **Acceptance criteria** | 1) Unauth client → `401 { error: 'Not authenticated' }` on clinical, collab write/read (non-splicing already OK), structures write/file/test, dna-storage, genomics. 2) No route trusts body/query `userId` for actor identity (session only). 3) `GET /structures/file` rejects paths outside backend `storage/` (no LFI). 4) All existing Jest/Playwright/tsc/eslint gates still exit 0. 5) Frontend fetches that hit newly gated routes send `credentials: 'include'`. |
| **Deliverables** | Session middleware helper; hardened routers; path allowlist; dnaStorage test session mocks + cookies; Stage 3/4 docs; explicit-path commit. |
| **Risk** | Medium — dnaStorage integration suite has no session mocks today; must update tests in the same change. Frontend longevity dashboards omit credentials. |
| **Effort** | S–M (1 focused change + test harness updates). |
| **Expected value** | **Highest** — closes critical/high security findings on live API surfaces with minimal architecture churn; reuses proven `getSessionFromCookie` pattern from `design.ts`/`variants.ts`/`records.ts`. |

**Skill stack:** `codebase-memory` (locate call sites) + `gstack-cso`/`gsd-secure-phase` (threat framing) + `gstack-review` (diff) + `careful`/`guard` (no destructive staging) + Playwright/Jest gates.

**First concrete task:** Add `requireSession` middleware and apply it to `clinicalRouter`; update the two longevity dashboard `fetch` calls to `credentials: 'include'`.

---

### 2. Mock clinical risk → real data / labeled simulation

| Field | Value |
| --- | --- |
| **Objective** | Replace `clinical.ts` `calculateRisk` mock percentages and default interventions with ClinVar/gnomAD-backed scoring or explicit `source: 'SIMULATION'` contract. |
| **Acceptance** | Risk payload always carries `source` + disclaimer; no silent mock percentages. |
| **Risk** | Medium — external API keys/latency; product decision on simulation vs live. |
| **Effort** | M–L. |
| **Value** | High honesty/correctness, but **blocked on product choice** (live vs labeled mock); not a pure code fix. |

### 3. Dependency + lint debt cleanup

| Field | Value |
| --- | --- |
| **Objective** | `npm audit` high (multer ≤2.2.0 path traversal), full-repo eslint ~652–812 legacy errors, dual JobQueue export hygiene. |
| **Acceptance** | No high npm audit; full-repo lint clean or scoped baselined with documented debt. |
| **Risk** | Medium — dep bumps may touch lockfile widely; full lint is large. |
| **Effort** | M–L. |
| **Value** | High long-term hygiene; **lower urgency than live LFI/unauth routes**. |

### 4. E2E coverage expansion (Playwright)

| Field | Value |
| --- | --- |
| **Objective** | More request-only specs beyond current single happy-path; auth-denial + clinical + structure upload covered in CI. |
| **Acceptance** | ≥N new specs; CI job runs Playwright. |
| **Risk** | Medium — CI flake, fixture auth. |
| **Effort** | M. |
| **Value** | High reliability; better **after** auth boundaries exist so E2E can assert 401/200 matrix. |

### 5. Architecture consolidation (JobQueue, metering, observability)

| Field | Value |
| --- | --- |
| **Objective** | Remove deprecated `JobQueue` export path or document dual queues; structured request logging/metrics. |
| **Acceptance** | Single queue story or documented deprecation; request correlation IDs. |
| **Risk** | Low–Med. |
| **Effort** | M. |
| **Value** | Medium operational value; **not security-critical**. |

---

## Ranking rationale

| Rank | Candidate | Value/effort | Unblocks |
| --- | --- | --- | --- |
| **1** | **Auth Boundary Hardening** | Best | Safe E2E, safe dep review, correct clinical auth assumptions |
| 2 | Mock risk honesty | High value, product-gated | Clinical trust |
| 3 | Dep/lint debt | Good hygiene | CI confidence |
| 4 | E2E expansion | High after #1 | Regression safety |
| 5 | Queue/observability | Ops | Debuggability |

## Recommendation

**Recommend ONE: Auth Boundary Hardening (candidates #1).**

Reason: Stage 2 marked S1 (LFI) and S2/S3/S4/S5 (unauth/spoofable) as critical/high on **running routers**, with file:line evidence. The repo already has a battle-tested session pattern (`getSessionFromCookie`, `design.ts`, `variants.ts`); the phase is implementation of an established pattern, not greenfield design. Evidence justifies implementation (not a STOP). After gates + commit, recommended follow-on is candidate #4/#3 (E2E denial paths + dep audit).
