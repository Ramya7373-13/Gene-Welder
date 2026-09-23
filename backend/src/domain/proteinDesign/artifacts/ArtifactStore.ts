// ArtifactStore — durable, reproducible on-disk store for design artifacts.
//
// Phase F contract (docs/rfd3-execution-plan.md §8): every design run gets a
// stable, self-describing layout rooted at the store root (default
// `artifacts/design` next to the process cwd, overridable via
// `DESIGN_ARTIFACT_DIR`):
//
//   artifacts/<runId>/
//     inputs/mode=<mode>-conditioning.json   # conditioning payload
//     inputs/parameters.json                 # full parameter snapshot
//     model/manifest.json                    # pinned model version + weights hash
//     run.json                               # run history (status timeline)
//     candidates/<candidateId>/design_<n>.cif.gz   # compressed structure
//     candidates/<candidateId>/structure.txt       # decompressed display copy
//     candidates/<candidateId>/candidate.json      # candidate history / metadata
//     candidates/<candidateId>/validation.json     # validation + rank snapshot
//     provenance/<candidateId>.ledger.json         # immutable ledger snapshot
//
// Reproducibility rules:
//   - JSON metadata is written with `stableStringify` (recursively sorted keys)
//     so identical inputs always produce identical bytes.
//   - Structure files are gzipped deterministically (zlib.gzipSync, level 9)
//     straight from the candidate's structure string, so a candidate row can be
//     turned back into the exact same bytes on every run.
//   - Every write is atomic (temp file + rename) so a crash never leaves a
//     half-written artifact.
//
// All write methods are best-effort: they catch I/O failures, log them, and
// return null rather than risk failing the design run itself. Read methods are
// explicit and may throw.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { logger } from '../../../utils/logger.js';
import { stableStringify } from '../utils/stableJson.js';
import type {
  DesignLedgerEntry,
  DesignMode,
  Rfd3Conditioning,
  ValidationResult,
} from '../types/index.js';

export const DEFAULT_DESIGN_ARTIFACT_DIR = path.join(process.cwd(), 'artifacts', 'design');

export interface RunArtifactInputs {
  runId: string;
  mode: DesignMode;
  conditioning: Rfd3Conditioning;
  parameters: Record<string, unknown>;
  targetSequence?: string;
  model: { version: string; weightsHash: string };
  seed: number;
  userId?: string;
}

export interface CandidateArtifactInput {
  candidateId: string;
  runId: string;
  /** 1-based position of this candidate within the generated batch (file name n). */
  designIndex: number;
  structure?: string;
}

export interface CandidateMetaPatch {
  rankedPosition?: number;
  designMetrics?: Record<string, unknown>;
  mpnn?: Record<string, unknown>;
}

export interface RunArtifactListing {
  runId: string;
  exists: boolean;
  inputs: string[];
  model: string[];
  provenance: string[];
  candidates: Record<string, string[]>;
  runJson: string | null;
}

const LAYOUT_VERSION = 1;
const GENERATOR = 'mutationmechanic-backend';

// Re-export the canonical serializer for callers that reach for it via the
// artifact module; the implementation lives in ../utils/stableJson.js.
export { stableStringify } from '../utils/stableJson.js';

export class ArtifactStore {
  private readonly root: string;
  private readonly runStatusChains = new Map<string, Promise<string | null>>();

  constructor(root: string = process.env.DESIGN_ARTIFACT_DIR ?? DEFAULT_DESIGN_ARTIFACT_DIR) {
    this.root = root;
  }

  getRoot(): string {
    return this.root;
  }

  // --- Run-level snapshots -------------------------------------------------

  /**
   * Write the immutable input snapshot for a run: conditioning payload, full
   * parameter set, and the pinned model manifest. Returns resolved absolute
   * paths for the written files ([] if nothing could be written).
   */
  async writeRunSnapshot(inputs: RunArtifactInputs): Promise<string[]> {
    const runDir = this.ensureRunDirs(inputs.runId);
    const written: string[] = [];

    const conditioning = await this.writeFile(
      path.join(runDir, 'inputs', `mode=${inputs.mode}-conditioning.json`),
      Buffer.from(stableStringify(inputs.conditioning), 'utf-8'),
    );
    if (conditioning) written.push(conditioning);

    const parameters = await this.writeFile(
      path.join(runDir, 'inputs', 'parameters.json'),
      Buffer.from(stableStringify({ ...inputs.parameters, seed: inputs.seed }), 'utf-8'),
    );
    if (parameters) written.push(parameters);

    const manifest = await this.writeFile(
      path.join(runDir, 'model', 'manifest.json'),
      Buffer.from(
        stableStringify({
          layoutVersion: LAYOUT_VERSION,
          generator: GENERATOR,
          modelVersion: inputs.model.version,
          weightsHash: inputs.model.weightsHash,
          seed: inputs.seed,
          runId: inputs.runId,
        }),
        'utf-8',
      ),
    );
    if (manifest) written.push(manifest);

    return written;
  }

  /**
   * Append a run status transition to run.json (the run history). Creates the
   * file on first call. Best-effort.
   */
  async recordRunStatus(runId: string, status: string, message?: string): Promise<string | null> {
    // Per-run append chain: concurrent status notifies read-modify-write the
    // same history array; without serialization the slower writer drops entries.
    const prev = this.runStatusChains.get(runId) ?? Promise.resolve(null);
    const next = prev.then(
      () => this.recordRunStatusLocked(runId, status, message),
      () => this.recordRunStatusLocked(runId, status, message),
    );
    this.runStatusChains.set(runId, next.catch(() => null));
    return next;
  }

  private async recordRunStatusLocked(
    runId: string,
    status: string,
    message?: string,
  ): Promise<string | null> {
    const runDir = this.ensureRunDirs(runId);
    const runJsonPath = path.join(runDir, 'run.json');
    const existing = this.readJsonObject(runJsonPath);
    const today = new Date().toISOString();

    const history = Array.isArray(existing.history) ? (existing.history as unknown[]) : [];
    history.push(
      message ? { status, message, at: today } : { status, at: today },
    );

    return this.writeFile(
      runJsonPath,
      Buffer.from(
        stableStringify({
          layoutVersion: LAYOUT_VERSION,
          generator: GENERATOR,
          runId,
          createdAt: existing.createdAt ?? today,
          history,
        }),
        'utf-8',
      ),
    );
  }

  // --- Candidate artifacts --------------------------------------------------

  /**
   * Materialise one candidate: compressed structure (design_<n>.cif.gz), the
   * decompressed display copy (structure.txt), and the candidate history file.
   * Returns the relative structuredFile path (`candidates/<id>/design_<n>.cif.gz`)
   * when a structure was stored, or null.
   */
  async writeCandidate(input: CandidateArtifactInput): Promise<string | null> {
    const candidateDir = path.join(this.ensureRunDirs(input.runId), 'candidates', input.candidateId);
    fs.mkdirSync(candidateDir, { recursive: true });

    const relativeDir = path.relative(this.root, candidateDir).split(path.sep).join('/');
    let structuredFile: string | null = null;

    if (input.structure && input.structure.length > 0) {
      const gzName = `design_${input.designIndex}.cif.gz`;
      const gzPath = await this.writeFile(
        path.join(candidateDir, gzName),
        zlib.gzipSync(Buffer.from(input.structure, 'utf-8'), { level: 9 }),
      );
      if (gzPath) structuredFile = `${relativeDir}/${gzName}`;

      await this.writeFile(
        path.join(candidateDir, 'structure.txt'),
        Buffer.from(input.structure, 'utf-8'),
      );
    }

    const history = this.readJsonObject(path.join(candidateDir, 'candidate.json'));
    const entries = Array.isArray(history.history) ? (history.history as unknown[]) : [];
    entries.push({
      event: 'generated',
      structuredFile,
      at: new Date().toISOString(),
    });

    await this.writeFile(
      path.join(candidateDir, 'candidate.json'),
      Buffer.from(
        stableStringify({
          layoutVersion: LAYOUT_VERSION,
          generator: GENERATOR,
          candidateId: input.candidateId,
          runId: input.runId,
          designIndex: input.designIndex,
          structuredFile,
          history: entries,
        }),
        'utf-8',
      ),
    );

    return structuredFile;
  }

  /** Merge late binding metadata (rank, design metrics, MPNN result) into candidate.json. */
  async updateCandidateMeta(candidateId: string, runId: string, patch: CandidateMetaPatch): Promise<string | null> {
    const candidateDir = path.join(this.ensureRunDirs(runId), 'candidates', candidateId);
    const jsonPath = path.join(candidateDir, 'candidate.json');
    const current = this.readJsonObject(jsonPath);

    const next: Record<string, unknown> = {
      layoutVersion: LAYOUT_VERSION,
      generator: GENERATOR,
      candidateId,
      runId,
      designIndex: current.designIndex,
      structuredFile: current.structuredFile,
      history: current.history,
    };
    if (patch.rankedPosition !== undefined) next.rankedPosition = patch.rankedPosition;
    if (patch.designMetrics !== undefined) next.designMetrics = patch.designMetrics;
    if (patch.mpnn !== undefined) next.mpnn = patch.mpnn;

    return this.writeFile(jsonPath, Buffer.from(stableStringify(next), 'utf-8'));
  }

  /**
   * Write the validation result + rank snapshot for a candidate.
   * Replaces any previous file (a re-validation supersedes).
   */
  async writeValidation(
    candidateId: string,
    runId: string,
    validation: ValidationResult,
    rank?: number,
  ): Promise<string | null> {
    const runDir = this.ensureRunDirs(runId);
    const candidateDir = path.join(runDir, 'candidates', candidateId);
    fs.mkdirSync(candidateDir, { recursive: true });
    return this.writeFile(
      path.join(candidateDir, 'validation.json'),
      Buffer.from(
        stableStringify({
          layoutVersion: LAYOUT_VERSION,
          generator: GENERATOR,
          candidateId,
          runId,
          validatedAt: new Date().toISOString(),
          rank,
          metrics: validation,
        }),
        'utf-8',
      ),
    );
  }

  // --- Provenance -----------------------------------------------------------

  /** Immutable per-candidate ledger snapshot (Phase G extends the chain on top). */
  async writeLedgerSnapshot(entry: DesignLedgerEntry): Promise<string | null> {
    const runDir = this.ensureRunDirs(entry.runId ?? entry.candidateId);
    return this.writeFile(
      path.join(runDir, 'provenance', `${entry.candidateId}.ledger.json`),
      Buffer.from(
        stableStringify({
          layoutVersion: LAYOUT_VERSION,
          generator: GENERATOR,
          snapshotAt: new Date().toISOString(),
          ...entry,
        }),
        'utf-8',
      ),
    );
  }

  // --- Reads ----------------------------------------------------------------

  listRunArtifacts(runId: string): RunArtifactListing {
    const runDir = path.join(this.root, runId);
    if (!fs.existsSync(runDir)) {
      return { runId, exists: false, inputs: [], model: [], provenance: [], candidates: {}, runJson: null };
    }

    const candidates: Record<string, string[]> = {};
    const candidatesDir = path.join(runDir, 'candidates');
    if (fs.existsSync(candidatesDir)) {
      for (const child of fs.readdirSync(candidatesDir)) {
        const childPath = path.join(candidatesDir, child);
        if (fs.statSync(childPath).isDirectory()) {
          candidates[child] = this.relativeFiles(childPath);
        }
      }
    }

    return {
      runId,
      exists: true,
      inputs: this.relativeFiles(path.join(runDir, 'inputs')),
      model: this.relativeFiles(path.join(runDir, 'model')),
      provenance: this.relativeFiles(path.join(runDir, 'provenance')),
      candidates,
      runJson: fs.existsSync(path.join(runDir, 'run.json'))
        ? `run.json`
        : null,
    };
  }

  readJson(relativePath: string): unknown {
    return JSON.parse(fs.readFileSync(this.resolve(relativePath), 'utf-8')) as unknown;
  }

  resolve(relativePath: string): string {
    return path.join(this.root, ...relativePath.split('/'));
  }

  readStructureGz(runId: string, candidateId: string): string | null {
    const gzPath = path.join(this.root, runId, 'candidates', candidateId, 'design_1.cif.gz');
    if (!fs.existsSync(gzPath)) return null;
    const raw = fs.readFileSync(gzPath);
    if (raw.length < 2) return null;
    return zlib.gunzipSync(raw).toString('utf-8');
  }

  // --- Internals -------------------------------------------------------------

  private ensureRunDirs(runId: string): string {
    const runDir = path.join(this.root, runId);
    fs.mkdirSync(path.join(runDir, 'inputs'), { recursive: true });
    fs.mkdirSync(path.join(runDir, 'model'), { recursive: true });
    fs.mkdirSync(path.join(runDir, 'candidates'), { recursive: true });
    fs.mkdirSync(path.join(runDir, 'provenance'), { recursive: true });
    return runDir;
  }

  private readJsonObject(filePath: string): Record<string, unknown> {
    try {
      if (!fs.existsSync(filePath)) return {};
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
      return parsed !== null && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  private relativeFiles(dirPath: string): string[] {
    if (!fs.existsSync(dirPath)) return [];
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => path.join(path.relative(this.root, dirPath), entry.name).split(path.sep).join('/'))
      .sort();
  }

  private async writeFile(filePath: string, data: Buffer): Promise<string | null> {
    try {
      // Unique tmp per attempt: concurrent recordRunStatus calls share run.json
      // and a fixed .tmp name races (ENOENT on rename when the twin wins).
      const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
      await fs.promises.writeFile(tmpPath, data);
      await fs.promises.rename(tmpPath, filePath);
      return filePath;
    } catch (error) {
      logger.warn(`[artifacts] failed to write ${filePath}`, error);
      return null;
    }
  }
}