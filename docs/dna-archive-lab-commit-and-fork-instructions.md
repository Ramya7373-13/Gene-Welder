# DNA Archive Lab — Commit Sequence & Frontend Fork Instructions

**What this file is for:** executable instructions for the two mechanical steps
that remain at the current checkpoint of the DNA Archive Lab Phase 1 work:
(1) committing the completed, verified Tasks 0–11 task-by-task, and
(2) creating the second worktree for the frontend fork. Whoever runs these
(Grok or a human) should execute them exactly as written and change nothing else.

**Current state:**
- Branch: `feat/dna-archive-lab`
- Worktree: `.claude/worktrees/dna-archive-lab`
- Base commit: `9d559db` (nothing on top of it yet — **all DNA Archive Lab work is
  still uncommitted in the working tree**)
- Tasks 0–11 (worktree setup, domain layer, schema, migration, API router) are
  **complete and verified**: 65/65 dnaStorage tests green, `tsc --noEmit` clean,
  `api.test` still green (6/6), migration `20260901000000_dna_archive_lab_phase1`
  applied and baselined, `prisma migrate status` reports "Database schema is up
  to date!"
- `backend/.env` and `docs/humanity-longevity.txt` exist in this worktree (copied
  from the main tree; the fixture is committed in commit 10, `.env` is gitignored).

---

## Step 1 — Task-by-task commit sequence

Run every command from the **worktree root** (not the main checkout, not
`backend/`):

```bash
cd .claude/worktrees/dna-archive-lab
```

All 10 commits, in order. Each commit only depends on files from earlier
commits, so the tree stays green at every point — do not reorder them.

```bash
# 1. Tasks 1-2: domain types + PRNG
git add backend/src/domain/dnaStorage/types.ts backend/src/domain/dnaStorage/prng.ts backend/tests/unit/dnaStorage/types.test.ts backend/tests/unit/dnaStorage/prng.test.ts
git commit -m "feat(dna-storage): domain types and seeded mulberry32 PRNG (Tasks 1-2)" -m "Spec-verbatim domain interfaces (DnaBase, EncodingProfile, DnaStrand, ErrorProfile, DecodeResult, job types, PRNG_NAME/VERSION) and createSeededRandom — deterministic mulberry32 so identical seeds reproduce byte-identical output across independent calls." -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"

# 2. Task 3: analytics
git add backend/src/domain/dnaStorage/analytics.ts backend/tests/unit/dnaStorage/analytics.test.ts
git commit -m "feat(dna-storage): constraint analytics helpers (Task 3)" -m "gcPercent, maxHomopolymerRun, encodingOverhead, effectivePayloadRate with divide-by-zero guards; hand-computed test values." -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"

# 3. Task 4: learning codec
git add backend/src/domain/dnaStorage/learningCodec.ts backend/tests/unit/dnaStorage/learningCodec.test.ts
git commit -m "feat(dna-storage): learning-mode 2-bit codec (Task 4)" -m "Deterministic 00->A/01->C/10->G/11->T mapping with visible 16-base index header, 16-base length trailer, and per-strand SHA-256. Plain 2-bit header is kept transparent per spec (its zero-index A-run is the teaching motivation for constraint-aware mode), so passedConstraints reports honestly." -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"

# 4. Task 5: constraint-aware codec
git add backend/src/domain/dnaStorage/constraintAwareCodec.ts backend/tests/unit/dnaStorage/constraintAwareCodec.test.ts
git commit -m "feat(dna-storage): constraint-aware codec with ternary escape + redundancy (Task 5)" -m "Ternary-escape control fields (header/trailer) so they never violate the homopolymer limit; quaternary payload with boundary-aware ternary re-encode on violation; configurable strand-copy redundancy. Decode uses best-copy selection: the first checksum-verifying copy per index wins, corrupted copies are fallback only." -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"

# 5. Task 6: codec registry
git add backend/src/domain/dnaStorage/codecRegistry.ts backend/tests/unit/dnaStorage/codecRegistry.test.ts
git commit -m "feat(dna-storage): pluggable codec registry with disabled advanced placeholder (Task 6)" -m "getCodec(profileMode) resolves learning/constraint-aware; the advanced codec is an enabled:false placeholder that throws 'not enabled' so no unvalidated fountain/RS capability is claimed." -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"

# 6. Task 7: error simulator
git add backend/src/domain/dnaStorage/errorSimulator.ts backend/tests/unit/dnaStorage/errorSimulator.test.ts
git commit -m "feat(dna-storage): deterministic channel-error simulator (Task 7)" -m "Substitution, insertion, deletion, strand dropout, duplication, and coverage depth as digital channel-error models; all randomness from a single createSeededRandom(profile.seed) so runs are reproducible. ZERO_ERROR_PROFILE helper." -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"

# 7. Task 8: decode orchestration
git add backend/src/domain/dnaStorage/decoder.ts backend/tests/unit/dnaStorage/decoder.test.ts
git commit -m "feat(dna-storage): decode orchestration with graceful failure (Task 8)" -m "decodeExperiment composes simulator + codec decode + SHA-256 verification into a DecodeResult; failure paths explain dropout-exceeds-redundancy and corruption explicitly. Test calibration math documented inline: 0.1% substitution is the ceiling 2x redundancy can recover with checksum-only detection." -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"

# 8. Task 9: report generator
git add backend/src/domain/dnaStorage/reportGenerator.ts backend/tests/unit/dnaStorage/reportGenerator.test.ts
git commit -m "feat(dna-storage): markdown + JSON experiment reports (Task 9)" -m "Reproducible reports with metadata, SHA-256, profiles, constraint/strand summaries, decode outcome, PRNG version, limitations, and the not-for-clinical/biological/laboratory disclaimer." -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"

# 9. Task 10: job runner + Prisma models + migration
git add backend/src/domain/dnaStorage/jobRunner.ts backend/tests/unit/dnaStorage/jobRunner.test.ts backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(dna-storage): synchronous job runner, Prisma models, phase-1 migration (Task 10)" -m "SynchronousJobRunner behind the queue-swappable DnaStorageJobRunner interface (error containment: FAILED, never rejects). Six dna_storage_* models with cascade deletes; migration 20260901000000_dna_archive_lab_phase1 baselined non-destructively against the db-push-built dev database." -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"

# 10. Task 11: API routes + integration
git add backend/src/routes/dnaStorage.ts backend/src/server.ts backend/src/prisma.ts backend/tests/integration/dnaStorage.test.ts docs/humanity-longevity.txt backend/scripts/ backend/.gitignore
git commit -m "feat(dna-storage): DNA Archive Lab API router + integration tests (Task 11)" -m "express.Router mounted at /api/dna-storage (one line in server.ts): experiments CRUD, upload (<=1MB, text/json/csv only, 413/415 handling), encode (source bytes purged post-encode), simulate (deterministic re-simulation from stored profile+seed), decode + report. Zod-validated bodies; userId passed through without server-side auth per convention; auditAction receives metadata only, never sequences. shutdownPrisma() added so test workers exit cleanly; storage/ gitignored as runtime artifacts. Includes the humanity-longevity fixture and a codec round-trip debug script." -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

**Scoping decisions baked into the commands above — do not "fix" them:**
- `.superpowers/` (progress ledger) stays **untracked** — scratch, not committed.
- `backend/.env` stays **untracked** — gitignored, contains secrets.
- `backend/storage/` is **gitignored** (rule added in commit 10) — the
  `dna-archive/` files there are runtime upload artifacts from integration test
  runs, never committed.

---

## Step 1 verification

After all 10 commits, run:

```bash
cd .claude/worktrees/dna-archive-lab
git log --oneline -12
```

Confirm: **10 new commits on top of `9d559db`**, in order, with subjects
matching the sequence above (`feat(dna-storage): domain types...` through
`feat(dna-storage): DNA Archive Lab API router + integration tests (Task 11)`).
Also confirm `git status --short` shows only `.superpowers/` (and nothing else
beyond untracked scratch) as remaining.

---

## Step 2 — Create the frontend fork worktree

Run this from the **main checkout root** (`E:\MutationMechanic`), and only
**after Step 1's commits are confirmed** by the verification above:

```bash
git worktree add .claude/worktrees/dna-archive-lab-frontend feat/dna-archive-lab
```

**Ordering is critical:** this worktree branches from the current tip of
`feat/dna-archive-lab`. If it is created before Step 1's commits land, the new
worktree will NOT contain Tasks 1–11 (domain layer, schema, migration, API
routes) — the frontend agent would be building against a tree without the
backend it calls.

The new worktree shares the same branch `feat/dna-archive-lab` by default with
`git worktree add <path> <branch>`; the frontend agent should create its own
branch (e.g. `feat/dna-archive-lab-frontend`) immediately after entering the
worktree, so backend and frontend commits don't interleave on one branch:

```bash
cd .claude/worktrees/dna-archive-lab-frontend
git checkout -b feat/dna-archive-lab-frontend
```

---

## Closing note — stop after Step 2

Once both steps are confirmed done, **report back to the coordinating session**
with:
1. the `git log --oneline -12` output, and
2. the new worktree path.

**Do not proceed to any frontend work (Tasks 12–13) from this file.** Frontend
implementation is handed to a separate agent (Grok) working in the new worktree;
docs (Task 14) stay with the existing backend worktree. This file covers only
the mechanical commit + fork steps.
