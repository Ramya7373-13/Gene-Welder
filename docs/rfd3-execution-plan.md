# RFdiffusion3 (RFD3) Execution Plan

Prepared: 2026-09-22
Phase B of `docs/Instructions_3.md`. This is the operational design contract that Phases C–G
build against: what RFD3 needs to run, how this repo will execute it, and where each requirement
lands in the architecture.

Sources:
- `docs/MutationMechanic × RFdiffusion3.md` (innovation report; U+00D7 in filename — see §9).
- Rosetta Commons Foundry upstream docs (rosettacommons.github.io/foundry) + `RosettaCommons/foundry` production branch, fetched 2026-09-22.
- Foundry `LICENSE.md` (production branch) read verbatim, 2026-09-22.
- Live probe of this machine (2026-09-22): no `nvidia-smi` on PATH ⇒ no confirmed CUDA GPU; WSL2 distros present (`Ubuntu`, `docker-desktop`); host Python 3.14.7.

---

## 1. Execution modes (contract for Phase C)

| Mode | Trigger `D .env` / env var | Runtime path | Required present |
|---|---|---|---|
| `mock` | `RFD3_API_MODE=mock` (default) | Existing `RFDiffusion3Adapter` deterministic generators | nothing extra |
| `local` | `RFD3_API_MODE=local` | spawn `rfd3 design` CLI in a managed Python env (WSL2 on this machine) | Unix/WSL2, Python 3.9–3.12 env with `rc-foundry[rfd3]`, checkpoint (~3 GB) |
| `remote` | `RFD3_API_MODE=remote` | HTTP POST to a GPU worker pool (Phase E registry/queue/executor) | `RFD3_REMOTE_URL` + `RFD3_REMOTE_API_KEY`, worker online |

Modes are mutually exclusive per process; switching requires a restart. Every adapter result must
still return `DesignGenerationResult` (runId, candidates, modelVersion, weightsHash, seed,
executionTimeMs) so the rest of the backend is mode-agnostic — **the mock deletion risk is zero at
the seam if real outputs are normalized to the same shape** (Phase C §C.4 in Instructions).

Proposed env vars (used by `backend/src/domain/proteinDesign/rfd3/`):

```
RFD3_API_MODE            mock|local|remote       (default mock)
RFD3_LOCAL_BIN           rfd3 | /abs/path/rfd3    (default "rfd3")
RFD3_LOCAL_CHECKPOINT_DIR (default FOUNDRY_CHECKPOINT_DIRS if set)
RFD3_LOCAL_ENV                   e.g. "conda run -n rfd3" prefix or WSL wrapper
RFD3_REMOTE_URL                  http://<worker-gateway>/v1/rfd3
RFD3_REMOTE_API_KEY
RFD3_JOB_TIMEOUT_MS              default 30 min
RFD3_MAX_CONCURRENCY             default 1 (per host)
RFD3_N_BATCHES_PER_RUN           default 1
RFD3_ARTIFACT_DIR                default <repo>/artifacts/rfd3
```

## 2. What is required to run RFdiffusion3 locally

Upstream (rosettacommons.github.io/foundry, RFdiffusion3 installation tutorial, current):

1. **OS** — Unix (Linux or macOS). Windows is **not officially supported** except through WSL2.
   ⇒ On this machine LOCAL means inside the WSL2 `Ubuntu` distro.
2. **Python 3.9–3.12.** Host python is 3.14.7 ⇒ too new; LOCAL requires the WSL/conda env, not host python.
3. **Package** — `pip install "rc-foundry[rfd3]"` (the `[rfd3]` extra pulls model + torch deps).
4. **Model weights** — `foundry install rfd3` downloads the checkpoint (~3 GB) to `~/.foundry/checkpoints`
   by default. Custom location: `foundry install rfd3 --checkpoint-dir <dir>` which also registers
   `FOUNDRY_CHECKPOINT_DIRS` so later runs find it automatically.
5. **GPU (recommended)** — NVIDIA GPU with recent driver; "~3 GB" VRAM floor for meaningful workloads,
   ≥16 GB system RAM advised. CPU-only runs but is tens-of-minutes per design. On a fresh install,
   verify PyTorch sees the GPU (`torch.cuda.is_available()` True).
   - Very new architectures (Lovelace/Blackwell) may need a recent driver + CUDA runtime and a
     **nightly cu128 PyTorch** (`--index-url https://download.pytorch.org/whl/nightly/cu128`).
6. **RFD3 command shape** — hydra-style overrides on binary `rfd3`:
   ```
   rfd3 design out_dir=<out> inputs=<xxx>.json|yaml [ckpt_path=...] [n_batches=N] \
        [skip_existing=False] [dump_trajectories=True] [prevalidate_inputs=True]
   ```
   - `inputs` describes the design task + constraints (target PDB, chains, hotspots/bypass, hbond, etc.).
   - Outputs are named `<job>_model_N.cif.gz` → **gzipped mmCIF, not PDB.** Batches share one
     randomly-sampled length; different batches get different lengths.

### Local-run "definition of done" (this repo)
`rfd3-verify-local` checklist — must pass before LOCAL mode is considered configured:
- [ ] WSL2 `Ubuntu` reachable (`wsl -l` lists it)
- [ ] `wsl -e bash -lc "python3 --version"` → 3.9–3.12
- [ ] `wsl -e bash -lc "pip show rc-foundry"` present
- [ ] `wsl -e bash -lc "test -f ~/.foundry/checkpoints/rfd3_latest.ckpt"` (or FOUNDRY_CHECKPOINT_DIRS points at it)
- [ ] `wsl -e bash -lc "nvidia-smi"` lists a GPU (required for practical runtime)
- [ ] demo design run completes and emits at least one `*.cif.gz`

## 3. What is required to run via GPU workers

Reproduce the LOCAL setup, but **per worker host**, and let them be stateless:

1. **Worker host image/recipe** — Linux (not Windows), NVIDIA GPU + matching driver, CUDA toolkit,
   conda/uv/venv with Python 3.12, `rc-foundry[rfd3]`, checkpoint directory on the worker or a shared
   mount exported via `FOUNDRY_CHECKPOINT_DIRS`. A single A100-class GPU sustains meaningful design
   campaigns (report §6); a pooled minimum of 1× 24 GB GPU is the practical floor.
2. **Worker identity** — each worker reports GPU meta (name, VRAM, driver, cuda, free VRAM) from
   `nvidia-smi --query-gpu=...` at registration (Phase E `GPUWorkerRegistry`).
3. **Job contract** — a worker pulls a job `{runId, mode, inputsJson, parameters, nBatches, seed}`,
   stages an isolated `WORKDIR`, runs
   `rfd3 design out_dir=$WORKDIR/out inputs=$WORKDIR/inputs/design.json`, streams stdout→job log,
   uploads artifacts, posts provenance (Phases E/F/G).
4. **Resilience** — heartbeat (≤30 s), retry-with-backoff ≤3 attempts, timeout via
   `RFD3_JOB_TIMEOUT_MS`, cancellation signal → kill subprocess + clean orphaned GPU memory.
5. **Queue** — durable (Postgres-backed `GPUJob` records with status/attempts/heartbeat timestamps),
   not the Phase-1 in-memory `JobQueue`.

## 4. Dependencies

| Layer | Dependency | Version/scope |
|---|---|---|
| Upstream inference | `rc-foundry[rfd3]` (PyPI) | Python 3.9–3.12; pulls torch + model deps |
| Checkpoint | `foundry install rfd3` | ~3 GB; BSD-licensed code (see §5) |
| Sequence design | `rc-foundry` includes ProteinMPNN/LigandMPNN weights (`foundry install mpnn`) | Phase D adapter surface |
| Host exec | Python ≥3.9–3.12 + (optional) conda/uv; WSL2 for Windows LOCAL | present |
| Backend (this repo) | Node ≥18 `node:child_process` spawn, `node:zlib` (gunzip `.cif.gz`), `node:crypto` (hashes) | zero new npm deps |
| Worker ops | `nvidia-smi` (registry/health), optional `gzip` CLI | worker host only |
| Validation (report §7) | AlphaFold 3 / RosettaFold3 re-validate; NOT bundled — adapter does not depend on it | future stage |

No new npm packages are required for Phases C–E. Re-verify this at implementation time.

## 5. Licensing

- **Foundry code (incl. the `rfd3` CLI) — BSD 3-Clause** (verified verbatim from
  `RosettaCommons/foundry@production/LICENSE.md`, "Copyright (c) 2025, Institute for Protein Design,
  University of Washington"). Permissive: redistribution OK with notice, no endorsement use.
  This covers running `rfd3 design` in-house, including commercially.
- **Model weights** — distributed via `foundry install rfd3`. The innovation report (§5 caveat, §7)
  explicitly flags a legal read of the Rosetta Commons Foundry checkout/weights terms **before
  revenue-generating or redistributed use**. We treat weights as an internal, pinned, hashed artifact
  (weightsHash in the ledger is a first-class requirement — §7 of the plan) and flag a licensing
  confirmation as an open blocker for revenue use only. Internal R&D execution is not blocked.
- **Fine-tuning** — permitted by BSD code + open weights (report §6); not in this phase's scope.

## 6. MCP tools that should wrap RFD3

The 8 existing specs in `docs/mcp/` already span the pipeline. RFD3-specific mapping (Phase J implements):

| Tool (spec file) | RFD3 surface | Notes |
|---|---|---|
| `design_binders` | `generateBinder` | hotspot/interface binder runs |
| `design_stabilizer` | `generateStabilizer` | chaperone/stabilizer runs |
| `design_dna_binder` | `generateDnaBinder` | sequence-specific DNA binding (RFD3 flagship) |
| `inverse_fold` | ProteinMPNN `sequenceDesign` (Phase D) | Structure→sequence after RFD3 |
| `validate_design` | RFD3 constraint-satisfaction + validation engine | includes SS check |
| `rank_designs` | ranking service → ledger | post-validation triage |
| `variant_analyze` / `structure_model` | conditioning builder inputs | v→structure→run chain |

Two **new** spec files are needed to expose execution/ops explicitly (content defined in Phase J):
- `design_execute.md` — enqueue a design run, return jobId + status (wraps `POST /api/design/runs` + queue).
- `design_artifact.md` — fetch/store design artifacts (PDB/mmCIF/JSON) by runId/candidateId (Phase F store).

## 7. Command ↔ adapter contract (input/output shape, normalization)

- Adapter method mapping: `generateBinder/Stabilizer/DnaBinder/Scaffold/MotifScaffold/SymmetricAssembly`
  → mode-specific `inputs` JSON; existing `DesignAdapter` interface is unchanged (Phase C registers a new implementation class `RFDiffusion3ExecutionAdapter`, replaces the mock behind the same seam).
- **Inputs JSON** for a binder run (upstream shape) must at minimum carry: input PDB path or
  content, target chains/contigs, hotspot residues, and the parameter set from `DesignRun.parameters`
  (`numDesigns`→`n_batches`, diffusionSteps→`diffusion.schedule`, temperature/seed).
- **Outputs** are `.cif.gz` files. Phase F stores the gz bytes; the adapter decompresses with
  `node:zlib.gunzipSync`, converts eligible ones to a displayable structure string for
  `DesignCandidate.structure` (keeps the frontend contract; may be mmCIF text or PDB via a lightweight
  converter), and snapshots {structure, sequence, metrics} exactly once per candidate so later reads are
  reproducible.
- **Normalization rule**: every candidate produced from a real run gets the same `DesignCandidate`
  shape the mock emits today (id, runId, structure, sequence, affinityScore, rankedPosition, metrics,
  createdAt) — plus `structuredFile: <relative artifact path>` added to candidates (new optional field).

## 8. Backend integration points

| Phase | Where it lands | Consumes | Produces |
|---|---|---|---|
| C | `rfd3/RFDiffusion3ExecutionAdapter.ts` (+ `executionModes.ts`, `rfd3InputBuilder.ts`, `cifParser.ts`) | `DesignRunRequest`, env modes | `DesignGenerationResult` |
| D | `mpnn/ProteinMpnnExecutionAdapter.ts` | candidate structures | sequences + ranking |
| E | `gpu/GPUWorkerRegistry.ts`, `gpu/GPUQueueManager.ts`, `gpu/GPUJobExecutor.ts` (+ `prisma` GPUJob model) | run requests | durable job lifecycle |
| F | `artifacts/ArtifactStore.ts` | candidate + run id | `artifacts/` layout (below) |
| G | `provenance/ProvenanceService.ts` upgrade | ledger entries + hashes | hash-chain + verify endpoint |

**Artifact layout (Phase F contract):**
```
artifacts/<runId>/
  inputs/mode=<mode>-conditioning.json   # conditioning payload (DesignLedger.inputConstraints)
  inputs/parameters.json                 # full parameter snapshot
  model/{version,weightsHash}.json       # pinned model manifest
  candidates/<candidateId>/design_<n>.cif.gz
  candidates/<candidateId>/structure.txt # decompressed mmCIF/PDB display copy
  candidates/<candidateId>/validation.json
  provenance/<candidateId>.ledger.json   # ledger snapshot (Phase G)
```

## 9. Open items / risks

1. **No confirmed GPU on this machine** ⇒ LOCAL real inference is **blocked here** until a CUDA GPU
   exists (native or in WSL2 Ubuntu). `mock` is fully functional; `remote` is the path for real runs
   as soon as one worker exists. This is the single biggest Phase B finding.
2. **Filename mismatch:** instructions cite `docs/The MutationMechanic × RFdiffusion3.md`; on disk the
   file begins `MutationMechanic` and the multiply sign is U+00D7 (`×`). Tooling must glob, not assume.
3. **Windows host python 3.14** is outside the supported 3.9–3.12 window — any real run must go through
   WSL2 or the worker, never naked host python.
4. **Outputs are mmCIF (`cif.gz`), not PDB** — candidate storage/conversion must not assume PDB.
5. **Weights terms** for commercial redistribution — open item; internal R&D execution is covered by BSD.
6. **Batched length sampling** — designs within a batch share length; expectation-setting for users.
7. **Validation is the bottleneck, not generation** (report §6): GPU cost is a non-issue; plan around
   AF3/RosettaFold re-validation throughput, which stays out of scope for Phases C–G.
8. **Download size** (~3 GB checkpoint) and HPC guidance (install from a GPU/compute node, not a login
   node) matter for the remote recipe.