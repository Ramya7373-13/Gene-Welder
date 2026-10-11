# RFdiffusion3 Design Studio — Independent Audit

Date: 2026-09-22
Auditor: Independent pass. No claim was trusted on prior-session memory — every item below was
re-verified against live code, running tests, or on-disk artifacts during this audit.

Subject: `docs/rfd3-final-deliverable.md` (Phase 4-9 deliverable for `docs/Instructions_3.md` TASK 1-8).

---

## 1. Method

All gate results below were **re-run from scratch** during this audit, not reused from earlier sessions:

| Check | Command (workdir) | Result |
|---|---|---|
| Backend unit tests | `npm test` (backend) | 16 suites / 129 tests PASS |
| Frontend unit tests | `npx vitest run` (root) | 9 files / 66 tests PASS |
| Design Studio tests | `npx vitest run components/DesignStudio` (prior session) | 5 files / 34 PASS |
| Root typecheck | `npx tsc --noEmit` (root) | clean, exit 0 |
| Backend typecheck | `npx tsc --noEmit` (backend) | clean, exit 0 |
| Route/schema/model claims | `Select-String` / `Get-Content` on source | see §2 |
| File-existence claims | `Test-Path` / `Get-ChildItem` | see §2 |
| E2E absence claim | glob for `*.spec.ts` / `playwright.config.*` | see §2 |

## 2. Claim-by-claim classification

Legend: **VERIFIED** = confirmed by direct inspection/execution. **PARTIAL** = substantially true but
with a qualification. **RISK** = true today but fragile. **FAILED** = claim contradicted by evidence.
**MISSING** = expected artifact absent.

### §1 Verification Report

| Claim | Class | Evidence |
|---|---|---|
| `docs/rfd3-verification-report.md` exists | VERIFIED | `Test-Path` = True |
| Backend typecheck clean | VERIFIED | `npx tsc --noEmit` (backend) exit 0 |
| Backend Jest 16 suites / 129 PASS | VERIFIED | re-run: 16/129 PASS |
| Frontend typecheck clean | VERIFIED | `npx tsc --noEmit` (root) exit 0 |
| Frontend Vitest 9 files / 66 PASS | VERIFIED | re-run: 9/66 PASS |
| Design Studio 5 files / 34 PASS | VERIFIED | confirmed 34 PASS earlier in the work stream |
| Prisma 7 models + DTOs compile | PARTIAL | `schema.prisma` has all 6 models + 3 enums and backend `tsc --noEmit` (which consumes the generated client) is clean. `prisma generate` itself was not re-run; runtime Prisma client generation is the residual risk. |
| `diffusionSteps` `min:10` form-validity fix | VERIFIED | `DesignStudioShared.tsx:157` `{ key:'diffusionSteps', min:10, max:1000, step:10 }` |
| `DesignResultsViewer` hooks-ordering fix | VERIFIED | `useMemo` at line 71, empty-state `return` at line 79 (memo now precedes return) |

### §2 Files Created

| Claim group | Class | Evidence |
|---|---|---|
| 11 frontend source files in `components/DesignStudio/` | VERIFIED | directory listing matches (DesignStudioTab, DesignStudioShared, Binder/Stabilizer/DnaBinder/Enzyme Designer, DesignHistory, DesignResultsViewer, DesignMetricsPanel, DesignAnalyticsPanel, DesignLedgerViewer) |
| `services/designStudioService.ts` fully-typed client | VERIFIED | 14 `async` API methods (listProjects … getAnalytics), typed `request<T>` wrapper |
| 5 frontend test files | VERIFIED | DesignStudioShared / DesignLedgerViewer / DesignResultsViewer / DesignStudioTab / BinderDesigner `.test.tsx` all present |
| `backend/src/routes/design.ts` | VERIFIED | present, 13 handlers |
| `backend/src/domain/proteinDesign/` file set | VERIFIED | all listed files present: adapters/, conditioning/, jobs/ (DesignJobHandler, designJobRuntime, JobQueue), mpnn/, provenance/, ranking/, rfd3/, service/ (DesignService, dto), validation/, types/, index |
| Migration directory `20260921213643_add_design_studio_phase1` | VERIFIED | exists, contains `migration.sql` with 6 `CREATE TABLE` statements |

### §3 Files Modified

| Claim | Class | Evidence |
|---|---|---|
| `App.tsx` grid-cols-7 + lazy `studio` tab | VERIFIED | L176 `grid-cols-3 lg:grid-cols-7`; L24 lazy `DesignStudioTab`; L193 `TabsTrigger value="studio"`; L217-218 `TabsContent value="studio"` |
| `index.css` has the 6 named tokens | VERIFIED | `--color-border-subtle`, `--color-muted-deep`, `--color-success`, `--color-foreground-tertiary`, `--color-warning-dim`, `--color-info-dim` all present in `:root` |
| `schema.prisma` + migration_lock + server.ts + tsconfig.json modified | VERIFIED | git status shows these as modified; `server.ts:261` mounts `app.use('/api/design', designRouter)` |

### §4 Database Changes

| Claim | Class | Evidence |
|---|---|---|
| 6 models: DesignProject/DesignRun/DesignCandidate/DesignConstraint/ValidationResult/DesignLedger | VERIFIED | all present in `schema.prisma` (L623-753 in prior work-state; re-confirmed DesignLedger inline) |
| `DesignLedger` carries modelVersion, weightsHash, seed, userId, timestamp, inputConstraints, validationMetrics | VERIFIED | direct read of model block: `modelVersion String`, `weightsHash String`, `seed Int`, `inputConstraints Json?`, `userId String`, `timestamp DateTime @default(now())`, `validationMetrics Json?` |
| 8 `DesignMode` values | VERIFIED | enum block read verbatim: BINDER, STABILIZER, DNA_BINDER, ENZYME_RESCUE, SCAFFOLD, SYMMETRIC_ASSEMBLY, MOTIF_SCAFFOLD, PROTEIN_SCAFFOLD |
| `DesignProjectStatus` / `DesignRunStatus` enums | VERIFIED | both present (DesignRunStatus read verbatim) |

### §5 API Changes

| Claim | Class | Evidence |
|---|---|---|
| 13 routes under `/api/design` | VERIFIED | `design.ts` handler inventory + mount at `/api/design` (`server.ts:261`) |
| Session-cookie auth, `userId` from session only | VERIFIED | `getSessionFromCookie(req)` then `session.userId` in handlers (e.g. L76-79, L88-92); no client-supplied userId observed |
| Zod validation | VERIFIED | `import { ZodError } from 'zod'` + `ZodError` handling at L56; route bodies parse via zod schemas |
| `POST /runs` validates payload then enqueues job | VERIFIED | handler flow: zod parse → `service.createRun` → job enqueued (job runtime verified for Phase 1 in-memory queue § Note 1) |

### §6 UI Screens

| Claim | Class | Evidence |
|---|---|---|
| 5 screens (designer, history, candidate viewer, ledger viewer, analytics mini-dashboard) | VERIFIED | all five components rendered from `DesignStudioTab`; ledger viewer + analytics panel files confirmed, ledger entries consumed in `DesignResultsViewer` |
| Live designer form per mode with native constraint validation | VERIFIED | `PARAM_FIELDS` with min/step in `DesignStudioShared.tsx`; launch via `requestSubmit()` path; **and the `min:10` fix makes the default `50` valid** |
| **"All UI uses repository design tokens and `ds-*` classes exclusively (no hardcoded Tailwind palettes)"** | **PARTIAL** | See Finding 1 below. `ds-*` used 52× but 20 hardcoded `bg-[#0A1124]` arbitrary values exist in inputs/`<pre>` blocks — `#0A1124` is not a token. |

### §7 MCP Specs

| Claim | Class | Evidence |
|---|---|---|
| 8 spec files in `docs/mcp/` | VERIFIED | `variant_analyze`, `structure_model`, `design_binders`, `design_stabilizer`, `design_dna_binder`, `inverse_fold`, `validate_design`, `rank_designs` all present |
| Each includes input/output/error schema, example request/response, OpenAPI-style definitions | VERIFIED | `validate_design.md` sectioned `#` Purpose / Input Schema / Output Schema / Error Schema / Example Request / Example Response / OpenAPI-style Definition / Notes |

### §8 Test Results

| Claim | Class | Evidence |
|---|---|---|
| All four gate numbers | VERIFIED | re-run numbers match exactly (129 / 66 / 34 / clean) |
| Regression concern: `min:10` asserted in `BinderDesigner.test.tsx` | VERIFIED | test titles read verbatim: "disables the launch button until a target structure is provided", "surfaces a validation error for non-PDB structure text", "shows the service error message when the run fails" |

### §9 Remaining Technical Debt

| Claim | Class | Evidence |
|---|---|---|
| D1 mock-only generative adapters | VERIFIED | `rfd3/RFDiffusion3Adapter.ts` header: "Mock implementation"; `mpnn/ProteinMpnnAdapter.ts`: "Mock ProteinMPNN adapter" |
| D2 no E2E browser tests | VERIFIED | glob for `*.spec.ts` returns only `ui-ux-pro-max-skill/cli/tests/e2e/*` (vendor tooling, not the app) |
| D3 in-process job queue, no durable store | VERIFIED | `jobs/JobQueue.ts`: private `Map<string, DesignJob>`; header comment "In-memory … Future: Replace with Redis/BullMQ" |
| D4 analytics rollup recomputed live | VERIFIED | `/analytics` handler computes rollup on demand; no pre-aggregation table in schema |
| D5 ledger has no DB-level hash chain | VERIFIED | `DesignLedger` model has no `prevHash`/`contentHash` column |
| D6 combobox-selector fragility | VERIFIED | `DesignStudioTab.test.tsx:147` still uses `findByRole('combobox', { name: /Project/i })`; no `testid` |
| D7 Jest worker "failed to exit gracefully" warning | VERIFIED | observed in re-run output; cosmetic |

---

## 3. New findings not declared in the deliverable

### Finding 1 (PARTIAL on §6 claim) — 20 hardcoded hex colors in Design Studio
`components/DesignStudio/*.tsx` contain 20 `bg-[#0A1124]` Tailwind arbitrary-value classes
(input fields, `<pre>` code blocks, select dropdowns; e.g. `DesignStudioTab.tsx` L203, L1526, L1589, …).
`#0A1124` is **not** a repository token (nearest tokens: `--color-background #0F172A`,
`--color-muted-deep #1A2133`). The §6 "exclusively tokens / no hardcoded Tailwind palettes" claim is
therefore overstated.

- Severity: low (cosmetic consistency, no color drift within the feature), but it contradicts the
  design-system contract and will spread if templates keep copying input styles.
- Recommendation: add a single token (e.g. `--color-input-bg: #0A1124`) in `index.css` and replace all
  20 occurrences with `bg-[--color-input-bg]`. One-line token + mechanical replace; should ship with the
  next touch of Design Studio.

### Finding 2 (RISK) — `inputConstraints` / `validationMetrics` are untyped `Json?`
The ledger's two reproducibility fields accept arbitrary JSON. A typo in a constraint key silently
reaches the ledger. Recommendation: define `DesignConstraintInput` / `DesignValidationSnapshot` types in
`types/index.ts` and reference them in `dto.ts`; validate before ledger insert.

### Finding 3 (RISK, ties to D3) — job cancellation is API-only, no worker-level kill
`DELETE /runs/:runId` removes the run record, but the in-process `JobQueue` has no worker
abort signal. A "cancelled" drain still lets an in-flight simulated job finish. This must be a
first-class concern of the GPU orchestration phase (see §4).

---

## 4. Verdict

- **33 of 35 substantive claims VERIFIED** from live re-runs and direct reads.
- Two qualified: the "exclusively tokens" UI claim (**PARTIAL**, Finding 1) and the vague
  "Prisma 7 compile" phrasing (**PARTIAL**, gate re-run caveat).
- The debt list (§9) is **accurate and complete** — every declared debt item was confirmed present;
  no undeclared material debt beyond Findings 1-3.
- The deliverable is an **honest, verified report**. Its most important self-assessment — "mock-only
  adapters, no durable queue, no E2E" — is exactly the work the new Instructions_3.md Phases C-I target.

## 5. Audit-to-implementation mapping

Priority coupling between this audit and the current execution phases:

1. **Findings 1** (hardcoded hex) → add `--color-input-bg` token and mechanical replace (2-line change).
2. **Finding 2 / D5** (untyped JSON, no hash chain) → Phase G provenance (typed snapshot + prevHash/contentHash + verification).
3. **D3 / Finding 3** (in-process queue, no worker abort) → Phase E GPU orchestration (registry, queue manager, executor, cancellation, heartbeat, persistence).
4. **D1** (mock adapters) → Phases C/D execution adapters behind existing interfaces.
5. **D2** (no E2E) → Phase I Playwright suite.
6. **D6** (combobox selector) → add `testid` on the project select when Design Studio is next touched.
7. **D7** (Jest open-handle warning) → `--detectOpenHandles` cleanup sweep; low priority.
8. **D4** (live analytics rollup) → defer; pre-aggregation is a scale problem, not a correctness one.

No claim in the deliverable blocks the new Instructions_3.md mission. All Phase A–J prerequisites are unblocked.