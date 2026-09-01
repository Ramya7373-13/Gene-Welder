# DNA Archive Lab

An in-silico DNA data-storage simulator inside MutationMechanic. It takes a small
digital file, encodes it into synthetic DNA sequences, applies simulated
channel-error models, then reconstructs and verifies the original file — all in
software, deterministically, and reproducibly.

> **This module simulates computational DNA data-storage workflows. It does not
> perform laboratory operations or provide wet-lab protocols.**

---

## Purpose and scope

DNA is a candidate archival storage medium because of its extraordinary
information density and durability. The DNA Archive Lab exists to **teach and
explore the computational side of that idea**: how binary data maps to the
four-base alphabet, why real chemical and sequencing constraints (GC content,
homopolymer runs, strand loss, read errors) shape codec design, and how
redundancy and checksums make recovery possible.

Scope of Phase 1:

- Encode small files (≤ 1 MB, text/JSON/CSV) into DNA strands.
- Simulate digital channel errors (substitution, insertion, deletion, dropout,
  duplication, coverage depth).
- Decode and verify recovery against the original SHA-256.
- Generate reproducible Markdown and JSON reports.

Out of scope: anything physical. No sequences here are intended for synthesis,
and the module produces no laboratory instructions of any kind.

## Non-lab boundary

Everything in this module happens at the digital-sequence level:

- Errors are **channel-error models** — computational perturbations of base
  strings — not descriptions of laboratory processes.
- Exports are labelled **"simulation export — not for synthesis."**
- The module never produces guidance for preparing, handling, or sequencing
  actual DNA.

## Not for clinical, biological, or laboratory decision-making

The DNA Archive Lab is an educational/research simulation. It is **not for
clinical, biological, or laboratory decision-making**. Nothing it produces
(sequences, reports, analytics) should inform patient care, biological
experimentation, or laboratory operations. Sequences generated here are
encoding artifacts of user-uploaded data, not biological sequences with
function or meaning.

## Scientific background

- **2-bit mapping.** DNA's four bases (A, C, G, T) map naturally onto two bits
  (00→A, 01→C, 10→G, 11→T), giving the naive 4 bases/byte encoding used by the
  learning codec.
- **GC content.** The fraction of G and C bases affects sequence stability in
  real media. Codecs target a configurable GC range (default 40–60%).
- **Homopolymer runs.** Long runs of a single base are a known failure mode for
  sequencing technologies; codecs bound the maximum run length.
- **Channel errors.** Storage and readout in real systems corrupt data:
  base substitutions, insertions, deletions, lost strands, duplicated strands,
  and variable coverage depth. The simulator models these digitally.
- **Redundancy and checksums.** Strand copies plus per-strand SHA-256 checksums
  allow the decoder to pick a clean copy per strand index and detect corruption
  it cannot repair (Phase 1 has no error-correcting code).

## Architecture

```
backend/src/domain/dnaStorage/
├── types.ts              # Domain interfaces (EncodingProfile, DnaStrand, ErrorProfile, DecodeResult, jobs)
├── prng.ts               # createSeededRandom — deterministic mulberry32 (PRNG_NAME/VERSION)
├── learningCodec.ts      # Learning-mode 2-bit codec
├── constraintAwareCodec.ts  # Constraint-aware codec: ternary-escaped control fields + redundancy
├── codecRegistry.ts      # Pluggable codec lookup; "advanced" is a disabled placeholder
├── errorSimulator.ts     # Deterministic channel-error models
├── analytics.ts          # GC%, max homopolymer run, overhead, effective rate
├── decoder.ts            # decodeExperiment orchestration
├── reportGenerator.ts    # Markdown + JSON reports
└── jobRunner.ts          # SynchronousJobRunner behind a swappable queue interface
backend/src/routes/dnaStorage.ts   # Express router mounted at /api/dna-storage
```

API (Zod-validated, structured errors, audit logging of state transitions with
metadata only — never sequences):

```
POST   /api/dna-storage/experiments
POST   /api/dna-storage/experiments/:id/upload      (≤ 1 MB, text/JSON/CSV; 413/415)
POST   /api/dna-storage/experiments/:id/encode
POST   /api/dna-storage/experiments/:id/simulate
POST   /api/dna-storage/experiments/:id/decode
GET    /api/dna-storage/experiments/:id
GET    /api/dna-storage/experiments/:id/strands
GET    /api/dna-storage/experiments/:id/report
GET    /api/dna-storage/experiments
DELETE /api/dna-storage/experiments/:id
```

## Encoding profiles

### A. Learning mode

Deterministic 2-bit mapping (00→A, 01→C, 10→G, 11→T) with a visible plain
16-base index header (4 bytes × 4 bases/byte), a 16-base length trailer, and a
per-strand SHA-256 checksum. Fully transparent — every base is directly
explainable — which is the point. The plain header of strand index 0 is a run
of A's, and that honest `passedConstraints: false` is the teaching motivation
for constraint-aware mode.

### B. Constraint-aware mode

- Payload chunks are converted to quaternary (2-bit) bases.
- **Control fields are ternary-escaped:** each control byte becomes 6 ternary
  digits and the digit stream is mapped so no two adjacent bases can be equal
  (`current = (prev + digit + 1) % 4`, starting from a non-A state). Header
  (5 bytes → 30 bases: 4-byte index + 1-byte flags) and length trailer
  (4 bytes → 24 bases) therefore never violate the homopolymer limit.
- Payload uses the denser quaternary encoding, with a **boundary-aware ternary
  re-encode** of a chunk when its quaternary sequence (including the boundary
  against neighbouring fields) would exceed the homopolymer limit. A flag bit
  in the header records which encoding each strand uses.
- Redundancy: each strand is emitted `redundancyFactor` times.
- Simplified research simulation — labelled as such everywhere.

### C. Advanced codec adapter

`codecRegistry` resolves codecs by profile mode. The `advanced` mode is an
**enabled: false placeholder that throws "not enabled"** — no fountain-code or
Reed–Solomon capability is claimed or provided. See "Future integration
boundary" below.

## Error-simulation definitions

All models operate on base strings and draw randomness from a single
seeded PRNG:

| Model | Effect |
|---|---|
| Substitution | one base changes to another |
| Insertion | an extra base appears |
| Deletion | a base is removed |
| Strand dropout | an entire strand is unavailable at decode time |
| Strand duplication | a strand appears more than once |
| Coverage depth | multiple noisy reads of a strand are generated |

Decode uses **best-copy selection**: all copies of a strand index (redundancy
copies, duplicates, extra coverage reads) are grouped, and the first copy whose
decoded payload matches its stored SHA-256 wins. Corrupted copies are used only
as a fallback when no clean copy exists, and are reported as warnings.

Recovery math worth knowing (documented in the test files): with checksum-only
detection and no ECC, a copy survives only if it neither drops out nor takes
any substitution across its ~150 bases — at 0.5% substitution that is
(1−0.005)^150 ≈ 0.47 per copy, unrecoverable with 2× redundancy; at 0.1% it is
(1−0.001)^150 ≈ 0.86, which 2× redundancy recovers reliably.

## Reproducibility design

- Every random decision comes from one `createSeededRandom(seed)` (mulberry32)
  instance per simulation; `PRNG_NAME`/`PRNG_VERSION` are persisted on the
  experiment record.
- The same input file, encoding profile, error profile, and seed produce
  byte-identical results across runs.
- Re-simulation is deterministic from the stored profile JSON + seed; the
  decode stage re-runs the exact same error profile.
- Reports embed the seed, profiles, PRNG version, and checksums so any run can
  be independently re-executed.

## Privacy and data retention

- Uploaded source bytes are **purged from disk immediately after encoding**;
  only the SHA-256, size, and MIME type are retained.
- Strand sequences and experiment metadata are stored in PostgreSQL
  (`dna_storage_*` tables, `ON DELETE CASCADE` from the experiment).
- Audit logging records job-state transitions and metadata (ids, counts,
  checksums, seeds) — never file contents or sequences.
- Deleting an experiment cascades to all strands, error runs, decode runs,
  reports, and file records.

## Limitations

- **No error-correcting code.** Detection is checksum-only; corruption is
  handled by redundancy and best-copy selection, not repaired.
- **Auth model limitation.** MutationMechanic has no session/login system.
  `userId` is passed in the request body and stored on the experiment record
  with no server-side enforcement beyond record-id lookups ("ownership check" =
  404 on unknown experiment id), mirroring the rest of the backend. Do not
  treat userId as an access-control guarantee.
- Phase 1 is synchronous: the job runner executes encode/simulate/decode in
  the request path (behind a queue-swappable interface for later phases).
- Theoretical density figures are simulation outputs, not deployed capacity.

## Future integration boundary

The advanced codec adapter exists so that **independently validated**
implementations of fountain-code / Reed–Solomon / DNA-storage codecs can be
plugged in later. Nothing in this module claims to be DNA Fountain, and no
code was copied from any referenced project. Future lab-oriented phases
(lab-ready software — never lab control) must keep the same boundary: software
that prepares and verifies data, no laboratory operating instructions.

## References

Cited as background only — no code copied:

- DNA Fountain (Erlich & Zielinski, *Science*, 2017)
- DNA Storage Toolkit (Wang et al.)
- Chamaeleo (Ping et al.)
- DNA-Storalator (Sila et al.)

## Developer setup notes

- **Run tests with `npm test`** from `backend/` — it invokes Jest through
  `node --experimental-vm-modules`. Bare `npx jest` cannot parse the ESM test
  files.
- **Prisma CLI flags under this repo's `prisma.config.ts`:** `prisma db execute`
  rejects `--schema` — use `--config prisma.config.ts`. Similarly,
  `prisma migrate diff` uses `--from-config-datasource` (the older
  `--from-schema-datasource` flag was removed in Prisma 7).
- **Migration baselining for a db-push-built database:** the shared dev
  database was created with `db push`, so its migration history is empty and
  `migrate dev` demands a destructive reset. The non-destructive procedure used
  for `20260901000000_dna_archive_lab_phase1` (never reset a shared dev DB):
  1. `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`
     (review the SQL — it must only add `dna_storage_*` tables and touch
     nothing existing),
  2. save it as the migration folder's `migration.sql` (**clean UTF-8** — a
     PowerShell `>` redirect writes UTF-16 with a BOM and the SQL will fail),
  3. `npx prisma db execute --config prisma.config.ts --file <migration.sql>`,
  4. `npx prisma migrate resolve --applied 20260901000000_dna_archive_lab_phase1`,
  5. `npx prisma migrate status` → "Database schema is up to date!".
- **Jest worker exit:** the driver-adapter Prisma client (`PrismaPg` + `pg.Pool`)
  keeps a pool open; tests must call `shutdownPrisma()` in `afterAll`
  (`$disconnect` + `pool.end()`) or Jest warns about workers failing to exit.
- Worktrees don't carry gitignored or untracked files — copy `backend/.env`
  from the main tree rather than regenerating secrets.
