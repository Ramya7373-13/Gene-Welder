# Phase I Re-baseline: What Phase I Requires vs What the Repo Actually Exposes

Status: **OPTION 1 ACCEPTED - PHASE I COMPLETE.**
This document originally re-baselined Phase I during a stop-and-reconsider
window. The decision (per `docs/Instructions_4.md`) was **Option 1**: implement
the missing public ledger contract, seed a session fixture, and E2E against
the real `/api/design` surface. All four gates are green; see
`Phase I Completion Report.md` for exact outputs and exit codes.

Authoritative inputs: `docs/Instructions_3.md` (Phase I directive),
`docs/Instructions_4.md` (Option 1), `backend/src/server.ts`,
`backend/src/routes/design.ts`,
`backend/src/domain/proteinDesign/service/DesignService.ts`,
`backend/src/domain/proteinDesign/rfd3/*`, `backend/prisma/schema.prisma`,
and prior recon artifacts in `docs/`.

## 1. What Phase I actually asks (verbatim, from Instructions_3.md)

- A Playwright E2E suite covering the complete protein-design workflow:
  1. Project creation
  2. Run creation
  3. Candidate generation
  4. Analytics validation
  5. Ledger/provenance validation
- Uses the **existing seeded local stack** and the **mock RFD3/MPNN execution path**
  (do not unblock real inference).
- Preserve all currently green tests; do not weaken E2E assertions without a
  documented, justified contract change.
- Keep new tests deterministic; no additional `Math.random()`-dependent behaviour.
- Document new fixtures / seed assumptions / test utilities.
- Report gate results: `tsc --noEmit`, lint, the new Playwright suite, the full
  backend test suite, with exact outputs and exit codes.
- "Do not assume requirements; verify them from the source documents first."

## 2. What the repo actually exposed (verified at re-baseline)

### HTTP surface - `/api/design` (NOT `/api/protein-design`)

Mounted in `server.ts` (`app.use('/api/design', designRouter)`). Route class in
`routes/design.ts`. Every route first resolves the user from the **session
cookie** and 401s otherwise (`getSessionFromCookie`).

| Verb + Path | Status on success | Body shape |
|---|---|---|
| POST `/api/design/projects` | 201 | `{ project }` |
| GET `/api/design/projects` | 200 | `{ projects }` |
| GET `/api/design/projects/:projectId` | 200 | `{ project }` |
| PUT `/api/design/projects/:projectId` | 200 | `{ project }` |
| POST `/api/design/runs` | 201 | `{ run }` (also enqueues a GPU job) |
| GET `/api/design/runs` / `:runId` | 200 | `{ runs }` / `{ run, progress }` |
| PUT/DELETE `/api/design/runs/:runId` | 200 | `{ run }` / `{ cancelled }` |
| GET `/api/design/candidates?runId=` / `:candidateId` | 200 | `{ candidates }` / `{ candidate }` |
| POST `/api/design/validate` | 200 | `{ validation }` |
| GET `/api/design/analytics` | 200 | `{ analytics }` |
| **GET `/api/design/candidates/:candidateId/ledger`** | **200** | **`{ ledger, chain }` (added in Phase I Option 1)** |

### Inbound DTOs (`service/dto.ts`)

- `createProjectDto`: `name` (required), `description?`, `targetGene?`, `targetVariant?`.
- `createRunDto`: `projectId` (required), `mode` (required, one of `BINDER | STABILIZER |
  DNA_BINDER | ENZYME_RESCUE | SCAFFOLD | SYMMETRIC_ASSEMBLY | MOTIF_SCAFFOLD |
  PROTEIN_SCAFFOLD`), `parameters?` (incl. `seed`), `targetStructure?`, `targetSequence?`,
  `chainId?`, `variant?`, `constraints?`.
- **No `userId` in any inbound schema** - the session cookie is the only identity.
- `ledgerQueryDto`: `candidateId` (required, min 1).

### Ledger / provenance (Phase I stage 5)

- The **`DesignLedger` table exists** (`design_ledger`), and a **Phase G hash chain is
  implemented** (`DesignLedger.previousLedgerHash/ledgerHash/candidateHash/
  validationHash`, `provenance/ProvenanceService.ts`; entries written by
  `DesignService.writeLedger`).
- **Gap at re-baseline:** no HTTP endpoint returned it.
- **Resolved (Option 1):** `GET /api/design/candidates/:candidateId/ledger` now
  returns rows projected through `ledgerRowToEntry` (write-shape parity with
  `stableStringify` hashing) + `ProvenanceService.verifyChain`.

### Mock RFD3/MPNN path

- Adapter is environment-driven, **`mock` is the default** and requires zero
  external deps (`RFD3_API_MODE` defaults to `mock`, deterministic mock seed 42).
- `POST /design/runs` enqueues a GPU job; `gpuJobRuntime` registers an in-process
  mock worker (with heartbeat) so `runOnWorker` can acquire a slot; job runtime
  executes generate -> persist candidates -> validate -> rank -> write ledger.

### Seeded local stack / auth reality

- `backend/prisma/seed.ts` only seeds `ModelRegistry` (2 rows). No users/sessions
  in the stock seed.
- Sessions require a User row + magic-link flow (email verification) - unusable
  headlessly without Resend.
- **Resolved (Option 1):** documented fixture `backend/scripts/seed-e2e-session.ts`
  + `e2e/global-setup.ts` mints a deterministic user + session cookie for the suite.

### Frontend reality

- No Design Studio UI reaches `/api/design` for the full workflow. An **API-level
  Playwright suite** (request + cookie session) is the feasible in-scope E2E.

## 3. Gap analysis vs the first attempt (what was wrong; what shipped)

| Item | First-attempt suite | Reality / Phase I delivery |
|---|---|---|
| API prefix | `/api/protein-design/*` (fictional) | `/api/design/*` |
| Response shape | `{ status, projectId }` flat helpers | `{ project }`, `{ run }`, `{ candidates }`, `{ analytics }`, `{ ledger, chain }` |
| Auth | none | cookie session required on all `/api/design` routes |
| Stage 5 | `readLedger` -> `/.../ledger` missing | route implemented + chain asserted |
| Determinism | byte-pure ASCII, no `Math.random` in tests | kept (BOM stripped from spec; 0 non-ASCII) |
| tsc gate | `npx tsc --noEmit` exit 0 | still exit 0 (root + backend) |

## 4. Options for re-scoping Phase I (decision recorded)

1. **Implement the missing public contract, then E2E against it.** <- **CHOSEN**
2. API-level E2E with ledger asserted only via run projection (partial stage 5).
3. Stage 5 blocked pending product decision; ship stages 1-4 only.

**Decision:** Option 1, per `docs/Instructions_4.md` ("Proceed with the real
Phase I path... If the run completes, finish the remaining gates immediately").

## 5. Next actions - final status

- [x] Decide option 1/2/3 -> **Option 1**.
- [x] Write the Phase I plan covering ledger route, session fixture, helpers/spec
      to `/api/design`, and four-gate report -> `docs/phase-i-plan.md`.
- [x] Boot `:5000`, mint a session user, run the Playwright suite -> **1 passed**.
- [x] Update this doc with the decision + final results -> this entry.
- [x] Finish gates: backend build, eslint (changed files), Playwright, full
      backend Jest -> all exit 0 / green. Details: `Phase I Completion Report.md`.

Prepared from verified evidence; Option 1 closed the re-baseline gaps.
