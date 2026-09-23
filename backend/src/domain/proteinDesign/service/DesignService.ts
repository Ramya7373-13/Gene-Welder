// DesignService — the single owner of Design Studio persistence and execution.
//
// Routes never touch Prisma for design data; they resolve the acting user from
// the session and delegate here. Everything the design domain needs to read or
// write lives behind this boundary, which is what keeps the Design Studio models
// isolated from the clinical models they sit beside.

import { prisma } from '../../../prisma.js';
import {
  ConstraintType,
  DesignMode,
  DesignRunStatus,
  type AnalyticsData,
  type CandidateMetrics,
  type DesignCandidate,
  type DesignConstraintSpec,
  type DesignLedgerEntry,
  type DesignRunRequest,
  type Rfd3Conditioning,
  type ValidationResult,
} from '../types/index.js';
import type { DesignAdapter, DesignGenerationResult } from '../adapters/DesignAdapter.js';
import { RFDiffusion3Adapter } from '../rfd3/RFDiffusion3Adapter.js';
import { ProteinMPNNExecutionAdapter } from '../mpnn/ProteinMPNNExecutionAdapter.js';
import type { ProteinMpnnAdapter } from '../mpnn/ProteinMpnnAdapter.js';
import { VariantConditioningEngine, parseHgvsProtein } from '../conditioning/VariantConditioningEngine.js';
import { DesignValidationEngine } from '../validation/DesignValidationEngine.js';
import { ProvenanceService } from '../provenance/ProvenanceService.js';
import { ArtifactStore } from '../artifacts/ArtifactStore.js';
import { getGitCommitHash } from '../utils/gitHash.js';
import type { DesignJob } from '../jobs/JobQueue.js';
import {
  conditioningDto,
  designJobPayloadDto,
  type CreateProjectDto,
  type CreateRunDto,
  type UpdateProjectDto,
  type UpdateRunDto,
} from './dto.js';

/** Raised when a caller asks for a resource they do not own, or one that is gone. */
export class DesignNotFoundError extends Error {
  constructor(message = 'Design resource not found') {
    super(message);
    this.name = 'DesignNotFoundError';
  }
}

/** Raised when a request is well-formed but cannot be carried out. */
export class DesignValidationError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message);
    this.name = 'DesignValidationError';
  }
}

/**
 * Shape of a DesignRun row as it comes back from Prisma (client is untyped
 * repo-wide, so this documents the contract the service relies on).
 */
interface DesignRunRow {
  id: string;
  projectId: string;
  mode: DesignMode;
  designEngine: string;
  status: DesignRunStatus;
  parameters: unknown;
  constraintSpec: unknown;
  targetStructure: string | null;
  targetSequence: string | null;
  gpuId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DesignCandidateRow {
  id: string;
  runId: string;
  structure: string | null;
  sequence: string | null;
  affinityScore: number | null;
  rankedPosition: number | null;
  designMetrics: unknown;
  structuredFile: string | null;
  createdAt: Date;
}

interface DesignProjectRow {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  targetGene: string | null;
  targetVariant: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Exhaustive mapping from design mode to the adapter entry point that serves it.
 *
 * Enzyme rescue reuses motif-scaffold generation: the catalytic motif is the
 * thing being held fixed while the surrounding scaffold is redesigned, which is
 * exactly what `generateMotifScaffold` expresses. Keeping the mapping in one
 * exhaustive switch means adding a DesignMode is a compile error here rather
 * than a silent fall-through to binder design at runtime.
 */
export function dispatchToAdapter(
  adapter: DesignAdapter,
  request: DesignRunRequest,
): Promise<DesignGenerationResult> {
  switch (request.mode) {
    case DesignMode.BINDER:
      return adapter.generateBinder(request);
    case DesignMode.STABILIZER:
      return adapter.generateStabilizer(request);
    case DesignMode.DNA_BINDER:
      return adapter.generateDnaBinder(request);
    case DesignMode.ENZYME_RESCUE:
    case DesignMode.MOTIF_SCAFFOLD:
      return adapter.generateMotifScaffold(request);
    case DesignMode.SCAFFOLD:
    case DesignMode.PROTEIN_SCAFFOLD:
      return adapter.generateScaffold(request);
    case DesignMode.SYMMETRIC_ASSEMBLY:
      return adapter.generateSymmetricAssembly(request);
    default: {
      const unreachable: never = request.mode;
      return Promise.reject(
        new DesignValidationError(`Unsupported design mode: ${String(unreachable)}`),
      );
    }
  }
}

/**
 * The Design Studio domain service.
 *
 * One instance per process is enough: it is stateless apart from its injected
 * collaborators, all of which are safe to share.
 */
export class DesignService {
  private readonly conditioningEngine: VariantConditioningEngine;
  private readonly validationEngine: DesignValidationEngine;
  private readonly provenance: ProvenanceService;
  private readonly adapter: DesignAdapter;
  private readonly mpnn: ProteinMpnnAdapter;
  private readonly artifacts: ArtifactStore;
  private readonly queueStatusChains = new Map<string, Promise<void>>();

  constructor(deps?: {
    adapter?: DesignAdapter;
    conditioningEngine?: VariantConditioningEngine;
    validationEngine?: DesignValidationEngine;
    provenance?: ProvenanceService;
    mpnn?: ProteinMpnnAdapter;
    artifacts?: ArtifactStore;
  }) {
    this.adapter = deps?.adapter ?? new RFDiffusion3Adapter();
    this.conditioningEngine = deps?.conditioningEngine ?? new VariantConditioningEngine();
    this.validationEngine = deps?.validationEngine ?? new DesignValidationEngine();
    this.provenance = deps?.provenance ?? new ProvenanceService();
    this.mpnn = deps?.mpnn ?? new ProteinMPNNExecutionAdapter();
    this.artifacts = deps?.artifacts ?? new ArtifactStore();
  }

  // --- Projects -------------------------------------------------------------

  async listProjects(userId: string): Promise<DesignProjectRow[]> {
    return prisma.designProject.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { runs: true } } },
    });
  }

  async createProject(userId: string, dto: CreateProjectDto): Promise<DesignProjectRow> {
    return prisma.designProject.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        targetGene: dto.targetGene ?? null,
        targetVariant: dto.targetVariant ?? null,
        userId,
      },
    });
  }

  async getProject(userId: string, projectId: string): Promise<DesignProjectRow> {
    const project = await prisma.designProject.findFirst({
      where: { id: projectId, userId },
      include: { runs: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!project) throw new DesignNotFoundError('Design project not found');
    return project;
  }

  async updateProject(
    userId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<DesignProjectRow> {
    await this.assertProjectOwned(userId, projectId);
    return prisma.designProject.update({ where: { id: projectId }, data: dto });
  }

  // --- Runs -----------------------------------------------------------------

  async listRuns(userId: string, projectId?: string): Promise<DesignRunRow[]> {
    return prisma.designRun.findMany({
      where: {
        project: { userId },
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async createRun(userId: string, dto: CreateRunDto): Promise<DesignRunRow> {
    await this.assertProjectOwned(userId, dto.projectId);

    const conditioning = await this.buildConditioning(dto);

    const run = await prisma.designRun.create({
      data: {
        projectId: dto.projectId,
        mode: dto.mode,
        designEngine: 'rfd3',
        status: DesignRunStatus.QUEUED,
        parameters: dto.parameters ?? {},
        constraintSpec: conditioning,
        targetStructure: dto.targetStructure ?? conditioning.targetStructure ?? null,
        targetSequence: dto.targetSequence ?? conditioning.targetSequence ?? null,
      },
    });

    await this.persistConstraints(run.id, conditioning);

    // Start the run history in the artifact store (best-effort; the queue will
    // append every later transition via applyQueueStatus / updateRunStatus).
    await this.artifacts.recordRunStatus(run.id, DesignRunStatus.QUEUED);

    return run;
  }

  async getRun(userId: string, runId: string): Promise<DesignRunRow> {
    const run = await prisma.designRun.findFirst({
      where: { id: runId, project: { userId } },
      include: {
        candidates: { orderBy: [{ rankedPosition: 'asc' }, { createdAt: 'asc' }] },
        constraints: true,
        ledgerEntries: { orderBy: { timestamp: 'desc' }, take: 1 },
      },
    });
    if (!run) throw new DesignNotFoundError('Design run not found');
    return run;
  }

  async updateRunStatus(
    userId: string,
    runId: string,
    dto: UpdateRunDto,
  ): Promise<DesignRunRow> {
    await this.getRun(userId, runId);

    const data: Record<string, unknown> = {};
    if (dto.status) {
      data.status = dto.status;
      if (dto.status === DesignRunStatus.RUNNING) data.startedAt = new Date();
      if (
        dto.status === DesignRunStatus.COMPLETED ||
        dto.status === DesignRunStatus.FAILED
      ) {
        data.completedAt = new Date();
      }
    }
    if (dto.gpuId !== undefined) data.gpuId = dto.gpuId;
    if (dto.failedReason !== undefined) data.failedReason = dto.failedReason;

    if (dto.status) {
      await this.artifacts.recordRunStatus(runId, dto.status, dto.failedReason);
    }

    return prisma.designRun.update({ where: { id: runId }, data });
  }

  /**
   * Record a queue status transition against the run row.
   *
   * The queue emits QUEUED on enqueue, which would otherwise clobber a run that
   * has already advanced, so QUEUED is ignored for runs that are past it.
   */
  async applyQueueStatus(
    runId: string,
    status: DesignRunStatus,
    message?: string,
  ): Promise<void> {
    // Serialize per-run: queue notifies are fire-and-forget, so a slow
    // RUNNING write must not land after a faster COMPLETED write.
    const prev = this.queueStatusChains.get(runId) ?? Promise.resolve();
    const next = prev.then(
      () => this.applyQueueStatusLocked(runId, status, message),
      () => this.applyQueueStatusLocked(runId, status, message),
    );
    this.queueStatusChains.set(
      runId,
      next.catch(() => undefined),
    );
    return next;
  }

  private async applyQueueStatusLocked(
    runId: string,
    status: DesignRunStatus,
    message?: string,
  ): Promise<void> {
    const run = await prisma.designRun.findUnique({ where: { id: runId } });
    if (!run) return;
    if (status === DesignRunStatus.QUEUED && run.status !== DesignRunStatus.QUEUED) return;
    if (
      (run.status === DesignRunStatus.COMPLETED || run.status === DesignRunStatus.FAILED) &&
      status !== run.status
    ) {
      return;
    }

    const data: Record<string, unknown> = { status };
    if (status === DesignRunStatus.RUNNING && !run.startedAt) data.startedAt = new Date();
    if (status === DesignRunStatus.COMPLETED || status === DesignRunStatus.FAILED) {
      data.completedAt = new Date();
    }
    if (status === DesignRunStatus.FAILED && message) data.failedReason = message;

    await this.artifacts.recordRunStatus(runId, status, message);

    // Atomic guard: never let a non-terminal status overwrite COMPLETED/FAILED.
    await prisma.designRun.updateMany({
      where: {
        id: runId,
        OR: [
          { status: { notIn: [DesignRunStatus.COMPLETED, DesignRunStatus.FAILED] } },
          { status },
        ],
      },
      data,
    });
  }

  // --- Candidates -----------------------------------------------------------

  async listCandidates(userId: string, runId: string): Promise<DesignCandidateRow[]> {
    await this.assertRunOwned(userId, runId);
    return prisma.designCandidate.findMany({
      where: { runId },
      orderBy: [{ rankedPosition: 'asc' }, { createdAt: 'asc' }],
      include: {
        validationResults: { orderBy: { createdAt: 'desc' }, take: 1 },
        ledgerEntries: { orderBy: { timestamp: 'desc' }, take: 1 },
      },
    });
  }

  async getCandidate(userId: string, candidateId: string): Promise<DesignCandidateRow> {
    const candidate = await prisma.designCandidate.findFirst({
      where: { id: candidateId, run: { project: { userId } } },
      include: {
        validationResults: { orderBy: { createdAt: 'desc' } },
        ledgerEntries: { orderBy: { timestamp: 'desc' } },
      },
    });
    if (!candidate) throw new DesignNotFoundError('Design candidate not found');
    return candidate;
  }

  /**
   * Read-only ledger + tamper-evidence chain for one owned candidate.
   *
   * Entries are the candidate's DesignLedger rows in append order (oldest
   * first). `chain` re-verifies the cryptographic linkage between them (see
   * ProvenanceService.verifyChain): each entry's hash must commit to the
   * previous ledger hash, so tampering with any entry is detectable. Nothing
   * is re-generated here.
   */
  async getCandidateLedger(
    userId: string,
    candidateId: string,
  ): Promise<{
    ledger: DesignLedgerEntry[];
    chain: { valid: boolean; brokenAt: number; reasons: string[] };
  }> {
    await this.getCandidate(userId, candidateId);

    const rows = await prisma.designLedger.findMany({
      where: { candidateId },
      orderBy: { timestamp: 'asc' },
    });

    // Project rows back to the hashed DesignLedgerEntry shape: drop `id`
    // (assigned by the DB after the hash was computed) and normalize null
    // optionals to undefined so stableStringify omits them the same way
    // linkEntry did at write time.
    const ledger = (rows ?? []).map((row: {
      candidateId: string;
      projectId: string | null;
      modelVersion: string;
      weightsHash: string;
      seed: number;
      inputConstraints: unknown;
      userId: string;
      timestamp: Date;
      validationMetrics: unknown;
      runId: string | null;
      gitCommitHash: string | null;
      jobId: string | null;
      candidateHash: string | null;
      validationHash: string | null;
      previousLedgerHash: string | null;
      ledgerHash: string | null;
    }) =>
      this.ledgerRowToEntry({
        candidateId: row.candidateId,
        projectId: row.projectId,
        modelVersion: row.modelVersion,
        weightsHash: row.weightsHash,
        seed: row.seed,
        inputConstraints: row.inputConstraints,
        userId: row.userId,
        timestamp: row.timestamp,
        validationMetrics: row.validationMetrics,
        runId: row.runId,
        gitCommitHash: row.gitCommitHash,
        jobId: row.jobId,
        candidateHash: row.candidateHash,
        validationHash: row.validationHash,
        previousLedgerHash: row.previousLedgerHash,
        ledgerHash: row.ledgerHash,
      }),
    );
    const chain = this.provenance.verifyChain(ledger);
    return { ledger, chain };
  }

  private ledgerRowToEntry(row: {
    candidateId: string;
    projectId: string | null;
    modelVersion: string;
    weightsHash: string;
    seed: number;
    inputConstraints: unknown;
    userId: string;
    timestamp: Date;
    validationMetrics: unknown;
    runId: string | null;
    gitCommitHash: string | null;
    jobId: string | null;
    candidateHash: string | null;
    validationHash: string | null;
    previousLedgerHash: string | null;
    ledgerHash: string | null;
  }): DesignLedgerEntry {
    const entry: DesignLedgerEntry = {
      candidateId: row.candidateId,
      modelVersion: row.modelVersion,
      weightsHash: row.weightsHash,
      seed: row.seed,
      inputConstraints: (row.inputConstraints ?? {}) as Record<string, unknown>,
      userId: row.userId,
      timestamp: row.timestamp,
    };
    if (row.projectId != null) entry.projectId = row.projectId;
    if (row.runId != null) entry.runId = row.runId;
    if (row.validationMetrics != null) {
      entry.validationMetrics = row.validationMetrics as ValidationResult;
    }
    if (row.gitCommitHash != null) entry.gitCommitHash = row.gitCommitHash;
    if (row.jobId != null) entry.jobId = row.jobId;
    if (row.candidateHash != null) entry.candidateHash = row.candidateHash;
    if (row.validationHash != null) entry.validationHash = row.validationHash;
    if (row.previousLedgerHash != null) entry.previousLedgerHash = row.previousLedgerHash;
    if (row.ledgerHash != null) entry.ledgerHash = row.ledgerHash;
    return entry;
  }

  /**
   * Validate one stored candidate and persist the result.
   *
   * Ranking is recomputed for the whole run because a candidate's diversity
   * score is a function of its siblings — validating one candidate in isolation
   * would otherwise leave stale ranks behind.
   */
  async validateCandidate(userId: string, candidateId: string): Promise<ValidationResult> {
    const candidate = await this.getCandidate(userId, candidateId);
    const conditioning = await this.reconstructConditioning(candidate.runId);

    const siblings: DesignCandidate[] = (
      await prisma.designCandidate.findMany({ where: { runId: candidate.runId } })
    ).map(toDomainCandidate);

    const results = await this.validationEngine.validateCandidates(
      siblings.length > 0 ? siblings : [toDomainCandidate(candidate)],
      conditioning,
    );

    const ranked = this.validationEngine.rankCandidates(results);

    await this.persistValidationResults(ranked.map(r => r.validationMetrics));
    await this.persistRanks(ranked.map(r => ({ candidateId: r.candidateId, rank: r.rank })));

    for (const rankedResult of ranked) {
      await this.artifacts.writeValidation(
        rankedResult.candidateId,
        candidate.runId,
        rankedResult.validationMetrics,
        rankedResult.rank,
      );
    }

    const own = results.find(r => r.candidateId === candidate.id);
    if (!own) throw new DesignNotFoundError('Candidate was not part of the validation batch');
    return own;
  }

  /**
   * Persist a batch of validation results, replacing any previous result for the
   * same candidate so the newest assessment is the only one on the run row.
   */
  private async persistValidationResults(results: ValidationResult[]): Promise<void> {
    for (const result of results) {
      await prisma.validationResult.deleteMany({ where: { candidateId: result.candidateId } });
      await prisma.validationResult.create({
        data: {
          candidateId: result.candidateId,
          pTM: result.pTM ?? null,
          ipTM: result.ipTM ?? null,
          pLDDT: result.pLDDT ?? null,
          interfaceArea: result.interfaceArea ?? null,
          constraintSatisfactionScore: result.constraintSatisfactionScore ?? null,
          diversityScore: result.diversityScore ?? null,
          overallScore: result.overallScore ?? null,
          details: (result.details ?? {}) as object,
        },
      });
    }
  }

  // --- Conditioning ---------------------------------------------------------

  /**
   * Build the RFD3 conditioning payload for a run.
   *
   * When an HGVS variant is supplied the VariantConditioningEngine derives
   * constraints from it (this is the strategic-IP path). Explicit constraints
   * from the request are merged on top, because a user who names a hotspot means
   * it literally — the derived constraints are a starting point, not a veto.
   */
  async buildConditioning(dto: CreateRunDto): Promise<Rfd3Conditioning> {
    const explicit = dto.constraints ?? [];

    if (dto.variant) {
      if (!parseHgvsProtein(dto.variant)) {
        throw new DesignValidationError(
          `Unable to parse HGVS variant: ${dto.variant}. Expected protein notation such as p.G12D.`,
        );
      }

      const derived = await this.conditioningEngine.condition({
        variant: { hgvs: dto.variant },
        structure: {
          pdbContent: dto.targetStructure,
          chainId: dto.chainId,
        },
      });

      return mergeConditioning(
        { ...derived, designMode: dto.mode },
        explicit,
        dto.targetStructure,
        dto.targetSequence,
      );
    }

    // No variant: build a mode-appropriate payload from the target and any
    // constraints the caller supplied directly.
    return mergeConditioning(
      {
        hotspots: [],
        burialDepth: [],
        hydrogenBonds: [],
        interfaceRegions: [],
        targetStructure: dto.targetStructure ?? '',
        targetSequence: dto.targetSequence,
        designMode: dto.mode,
      },
      explicit,
      dto.targetStructure,
      dto.targetSequence,
    );
  }

  /**
   * Read a run's conditioning back out of its stored snapshot.
   *
   * This is what makes a run reproducible: the exact payload that drove the
   * design is on the row, and re-parsing it through the same schema means a
   * stored run can never be replayed with a shape the engine cannot handle.
   */
  async reconstructConditioning(runId: string): Promise<Rfd3Conditioning> {
    const run = await prisma.designRun.findUnique({ where: { id: runId } });
    if (!run) throw new DesignNotFoundError('Design run not found');

    const parsed = conditioningDto.safeParse(run.constraintSpec);
    if (parsed.success) return parsed.data as Rfd3Conditioning;

    throw new DesignValidationError(
      `Stored conditioning for run ${runId} is not readable; the run cannot be replayed`,
      parsed.error.issues,
    );
  }

  /**
   * Materialise the conditioning payload as DesignConstraint rows.
   *
   * The rows are the queryable projection of the payload — the payload itself is
   * the source of truth and is what gets stored on DesignRun.constraintSpec.
   */
  private async persistConstraints(runId: string, conditioning: Rfd3Conditioning): Promise<void> {
    const specs = this.conditioningEngine.conditioningToConstraints(conditioning);
    if (specs.length === 0) return;

    await prisma.designConstraint.createMany({
      data: specs.map((spec: DesignConstraintSpec) => ({
        runId,
        constraintType: spec.type,
        spec: spec as unknown as object,
      })),
    });
  }

  // --- Analytics ------------------------------------------------------------

  async getAnalytics(userId: string): Promise<AnalyticsData> {
    const runs = await prisma.designRun.findMany({
      where: { project: { userId } },
      select: {
        id: true,
        status: true,
        mode: true,
        createdAt: true,
        completedAt: true,
        project: { select: { targetGene: true, targetVariant: true } },
        candidates: {
          select: {
            id: true,
            validationResults: { select: { overallScore: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    const projects = await prisma.designProject.count({ where: { userId } });

    const completedRuns = runs.filter((r: { status: string }) => r.status === DesignRunStatus.COMPLETED);
    const finishedRuns = runs.filter(
      (r: { status: string }) =>
        r.status === DesignRunStatus.COMPLETED || r.status === DesignRunStatus.FAILED,
    );

    const scores: number[] = [];
    for (const run of runs) {
      for (const candidate of run.candidates ?? []) {
        const latest = candidate.validationResults?.[0];
        if (latest?.overallScore != null) scores.push(latest.overallScore);
      }
    }

    const totalCandidates = runs.reduce(
      (sum: number, r: { candidates?: unknown[] }) => sum + (r.candidates?.length ?? 0),
      0,
    );

    const geneCounts = new Map<string, number>();
    const variantCounts = new Map<string, number>();

    for (const run of runs) {
      const gene = run.project?.targetGene;
      if (gene) geneCounts.set(gene, (geneCounts.get(gene) ?? 0) + 1);
      const variant = run.project?.targetVariant;
      if (variant) variantCounts.set(variant, (variantCounts.get(variant) ?? 0) + 1);
    }

    return {
      totalProjects: projects,
      totalRuns: runs.length,
      totalCandidates,
      averageValidationScore: scores.length > 0 ? average(scores) : 0,
      runDurations: completedRuns.map(
        (r: { completedAt: Date | null; createdAt: Date }) =>
          r.completedAt ? r.completedAt.getTime() - r.createdAt.getTime() : 0,
      ),
      topGenes: topEntries(geneCounts).map(e => ({ gene: e.key, count: e.count })),
      commonVariants: topEntries(variantCounts).map(e => ({ variant: e.key, count: e.count })),
      validationScoreDistribution: histogram(scores, 10),
      successRate: finishedRuns.length > 0 ? completedRuns.length / finishedRuns.length : 0,
    };
  }

  // --- Execution ------------------------------------------------------------

  /**
   * Execute a queued design job end to end.
   *
   * Order matters and is the reproducibility contract: generate, persist the
   * candidates with their database ids, write the ledger entry for each (the
   * ledger is the immutable record and must exist even if validation later
   * fails), then validate and rank.
   */
  async executeDesignJob(job: DesignJob): Promise<{ candidateIds: string[] }> {
    const parsedPayload = designJobPayloadDto.safeParse(job.payload);
    if (!parsedPayload.success) {
      throw new DesignValidationError(
        `Design job ${job.runId} has an unreadable payload`,
        parsedPayload.error.issues,
      );
    }
    const payload = parsedPayload.data;

    const modelInfo = this.adapter.getModelInfo();
    const seed = payload.parameters.seed ?? this.provenance.generateSeed();

    const request: DesignRunRequest = {
      runId: job.runId,
      projectId: job.projectId,
      mode: payload.mode,
      parameters: { ...payload.parameters, seed },
      conditioning: payload.conditioning as Rfd3Conditioning,
      targetSequence: payload.targetSequence,
    };

    const generated = await dispatchToAdapter(this.adapter, request);

    // Materialise the immutable run snapshot (conditioning, parameters, pinned
    // model) before any candidate is persisted, so the run is reproducible from
    // the artifact store alone.
    await this.artifacts.recordRunStatus(job.runId, DesignRunStatus.RUNNING);
    await this.artifacts.writeRunSnapshot({
      runId: job.runId,
      mode: payload.mode,
      conditioning: request.conditioning,
      parameters: request.parameters,
      targetSequence: payload.targetSequence,
      model: modelInfo,
      seed,
      userId: payload.userId,
    });

    const candidateIds = await this.persistCandidates(job.runId, generated);

    const domainCandidates: DesignCandidate[] = (
      await prisma.designCandidate.findMany({ where: { id: { in: candidateIds } } })
    ).map(toDomainCandidate);

    const results = await this.validationEngine.validateCandidates(
      domainCandidates,
      request.conditioning,
    );
    const ranked = this.validationEngine.rankCandidates(results);

    await this.persistValidationResults(ranked.map(r => r.validationMetrics));
    await this.persistRanks(ranked.map(r => ({ candidateId: r.candidateId, rank: r.rank })));

    // Snapshot validation + rank into the artifact store per candidate.
    for (const rankedResult of ranked) {
      await this.artifacts.writeValidation(
        rankedResult.candidateId,
        job.runId,
        rankedResult.validationMetrics,
        rankedResult.rank,
      );
    }

    if (payload.parameters.applyProteinMPNN === true) {
      await this.runMpnnPass(job.runId, payload.userId, candidateIds, seed, request);
    }

    // Candidate history: refresh each candidate.json with the final rank and
    // design metrics (which include MPNN results when the pass ran).
    const finalRows = await prisma.designCandidate.findMany({ where: { id: { in: candidateIds } } });
    for (const row of finalRows) {
      await this.artifacts.updateCandidateMeta(row.id, job.runId, {
        rankedPosition: row.rankedPosition ?? undefined,
        designMetrics: (row.designMetrics ?? undefined) as Record<string, unknown> | undefined,
      });
    }

    // Phase G: write the ledger only once validation is complete so each entry
    // can commit to the candidate content and the validation snapshot, and link
    // into the candidate's hash chain.
    const validationById = new Map(ranked.map(r => [r.candidateId, r.validationMetrics]));
    await this.writeLedger({
      candidateIds,
      runId: job.runId,
      projectId: job.projectId,
      userId: payload.userId,
      conditioning: request.conditioning,
      modelInfo,
      seed,
      parameters: request.parameters,
      jobId: job.runId,
      validationById,
    });

    return { candidateIds };
  }

  /**
   * Phase D lifecycle hook: when a run opts in via `parameters.applyProteinMPNN`,
   * run ProteinMPNN sequence design over the generated backbones and record the
   * refined sequences + scores on each candidate (without clobbering the RFD3
   * design; the primary artifacts stay authoritative and the MPNN result lives
   * in `designMetrics.mpnn`).
   */
  private async runMpnnPass(
    runId: string,
    userId: string,
    candidateIds: string[],
    seed: number,
    request: DesignRunRequest,
  ): Promise<void> {
    const candidates = await prisma.designCandidate.findMany({
      where: { id: { in: candidateIds } },
    });
    const mpnnInfo = this.mpnn.getModelInfo();

    for (const candidate of candidates) {
      if (!candidate.structure) continue;
      const perCandidateSeed = (seed ^ hashString(candidate.id)) >>> 0;
      const results = await this.mpnn.sequenceDesign(candidate.structure, {
        seed: perCandidateSeed,
        fixedPositions: fixedPositionsFrom(request),
      });
      if (!results.length) continue;
      const best = results.reduce((a, b) => (b.score > a.score ? b : a), results[0]);
      const existing = (candidate.designMetrics ?? {}) as Record<string, unknown>;
      const updated: Record<string, unknown> = {
        ...existing,
        mpnn: {
          applied: true,
          bestSequence: best.sequence,
          bestScore: best.score,
          numSequences: results.length,
          seed: perCandidateSeed,
          engine: mpnnInfo.version,
          weightsHash: mpnnInfo.weightsHash,
          ranBy: userId,
        },
      };
      await prisma.designCandidate.update({
        where: { id: candidate.id },
        data: { designMetrics: updated },
      });
    }
  }

  private async persistCandidates(
    runId: string,
    generated: DesignGenerationResult,
  ): Promise<string[]> {
    const ids: string[] = [];

    for (const [index, candidate] of generated.candidates.entries()) {
      const created = await prisma.designCandidate.create({
        data: {
          runId,
          structure: candidate.structure ?? null,
          sequence: candidate.sequence ?? null,
          affinityScore: candidate.affinityScore ?? null,
          designMetrics: (candidate.metrics ?? {}) as object,
        },
      });
      ids.push(created.id);

      // Materialise the candidate's on-disk artifacts and point the row at them.
      const structuredFile = await this.artifacts.writeCandidate({
        candidateId: created.id,
        runId,
        designIndex: index + 1,
        structure: candidate.structure ?? undefined,
      });
      if (structuredFile) {
        await prisma.designCandidate.update({
          where: { id: created.id },
          data: { structuredFile },
        });
      }
    }

    return ids;
  }

  private async writeLedger(input: {
    candidateIds: string[];
    runId: string;
    projectId: string;
    userId: string;
    conditioning: Rfd3Conditioning;
    modelInfo: { version: string; weightsHash: string };
    seed: number;
    parameters: Record<string, unknown>;
    jobId?: string;
    validationById?: Map<string, ValidationResult>;
  }): Promise<void> {
    const gitCommitHash = getGitCommitHash();
    const rows = await prisma.designCandidate.findMany({
      where: { id: { in: input.candidateIds } },
    });
    const candidatesById = new Map<string, any>(
      rows.map((row: { id: string }) => [row.id, row]),
    );

    for (const candidateId of input.candidateIds) {
      const row = candidatesById.get(candidateId);
      const candidateHash = this.provenance.computeCandidateHash({
        structure: row?.structure ?? null,
        sequence: row?.sequence ?? null,
        metrics: (row?.designMetrics ?? null) as Record<string, unknown> | null,
      });
      const validation = input.validationById?.get(candidateId);
      const validationHash = validation
        ? this.provenance.computeValidationHash(validation)
        : undefined;

      const record = this.provenance.createRecord(
        input.conditioning,
        input.modelInfo,
        input.seed,
        input.userId,
        { parameters: input.parameters, designEngine: 'rfd3' },
      );
      // Must land on the entry before linkEntry: the DB row stores this
      // snapshot, and chain verify recomputes the hash from the stored row.
      if (validation) {
        record.validationMetrics = validation as unknown as Record<string, unknown>;
      }

      const entry = this.provenance.toLedgerEntry(
        record,
        candidateId,
        input.runId,
        input.projectId,
        { jobId: input.jobId, gitCommitHash, candidateHash, validationHash },
      );

      // Chain link: this candidate's most recent entry, if any.
      const prior = await prisma.designLedger.findFirst({
        where: { candidateId },
        orderBy: { timestamp: 'desc' },
        select: { ledgerHash: true },
      });
      const linked = this.provenance.linkEntry(entry, prior?.ledgerHash ?? undefined);

      await prisma.designLedger.create({
        data: {
          candidateId,
          projectId: input.projectId,
          runId: input.runId,
          modelVersion: linked.modelVersion,
          weightsHash: linked.weightsHash,
          seed: linked.seed,
          inputConstraints: linked.inputConstraints as object,
          userId: input.userId,
          // Persist the exact snapshot that was hashed (not a fresh DB default).
          timestamp: linked.timestamp,
          validationMetrics: (linked.validationMetrics as object | undefined) ?? null,
          gitCommitHash: linked.gitCommitHash,
          jobId: linked.jobId,
          candidateHash: linked.candidateHash,
          validationHash: linked.validationHash,
          previousLedgerHash: linked.previousLedgerHash,
          ledgerHash: linked.ledgerHash,
        },
      });

      // Immutable ledger snapshot per candidate in the artifact store.
      await this.artifacts.writeLedgerSnapshot(linked);
    }
  }

  private async persistRanks(ranks: { candidateId: string; rank: number }[]): Promise<void> {
    for (const { candidateId, rank } of ranks) {
      await prisma.designCandidate.update({
        where: { id: candidateId },
        data: { rankedPosition: rank },
      });
    }
  }

  // --- Ownership guards -----------------------------------------------------

  private async assertProjectOwned(userId: string, projectId: string): Promise<void> {
    const project = await prisma.designProject.findFirst({
      where: { id: projectId, userId },
      select: { id: true },
    });
    if (!project) throw new DesignNotFoundError('Design project not found');
  }

  private async assertRunOwned(userId: string, runId: string): Promise<void> {
    const run = await prisma.designRun.findFirst({
      where: { id: runId, project: { userId } },
      select: { id: true },
    });
    if (!run) throw new DesignNotFoundError('Design run not found');
  }
}

// --- Helpers ----------------------------------------------------------------

/**
 * Overlay explicit constraints onto derived conditioning.
 *
 * Explicit entries are appended rather than replacing derived ones so a caller
 * can add a hotspot without discarding the variant-derived set.
 */
function mergeConditioning(
  base: Rfd3Conditioning,
  explicit: DesignConstraintSpec[],
  targetStructure: string | undefined,
  targetSequence: string | undefined,
): Rfd3Conditioning {
  const merged: Rfd3Conditioning = {
    ...base,
    hotspots: [...base.hotspots],
    burialDepth: [...base.burialDepth],
    hydrogenBonds: [...base.hydrogenBonds],
    interfaceRegions: [...base.interfaceRegions],
    targetStructure: targetStructure ?? base.targetStructure,
    targetSequence: targetSequence ?? base.targetSequence,
  };

  for (const spec of explicit) {
    switch (spec.type) {
      case ConstraintType.HOTSPOT:
        merged.hotspots = [...merged.hotspots, ...spec.residues];
        break;
      case ConstraintType.BURY_DEPTH:
        merged.burialDepth = [...merged.burialDepth, spec];
        break;
      case ConstraintType.HBOND:
        merged.hydrogenBonds = [...merged.hydrogenBonds, spec];
        break;
      case ConstraintType.INTERFACE:
        merged.interfaceRegions = [...merged.interfaceRegions, spec];
        break;
      case ConstraintType.MOTIF:
        merged.motifSpec = spec;
        break;
      case ConstraintType.CENTER_OF_MASS:
        merged.centerOfMass = spec;
        break;
      default: {
        const unreachable: never = spec;
        throw new DesignValidationError(
          `Unsupported constraint type: ${String((unreachable as { type?: string }).type)}`,
        );
      }
    }
  }

  return merged;
}

/** Project a stored candidate row into the domain shape the engines consume. */
function toDomainCandidate(row: DesignCandidateRow): DesignCandidate {
  return {
    id: row.id,
    runId: row.runId,
    structure: row.structure ?? undefined,
    sequence: row.sequence ?? undefined,
    affinityScore: row.affinityScore ?? undefined,
    rankedPosition: row.rankedPosition ?? undefined,
    metrics: (row.designMetrics ?? undefined) as CandidateMetrics | undefined,
    structuredFile: row.structuredFile ?? undefined,
    createdAt: row.createdAt,
  };
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function topEntries(counts: Map<string, number>, limit = 5): { key: string; count: number }[] {
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Bucket scores into `buckets` equal-width bins across 0..1, keyed by bin floor. */
function histogram(values: number[], buckets: number): { score: number; count: number }[] {
  const bins = Array.from({ length: buckets }, (_, i) => ({
    score: i / buckets,
    count: 0,
  }));

  for (const value of values) {
    const index = Math.min(buckets - 1, Math.max(0, Math.floor(value * buckets)));
    bins[index].count += 1;
  }

  return bins;
}

/** Shared singleton so routes and the job runtime act on the same instance. */
let designService: DesignService | null = null;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * MPNN fixed-position mask from run conditioning. Honorable defaults are used
 * when the user has not pinned anything: no positions are frozen unless
 * `customConstraints.fixedPositions` says otherwise.
 */
function fixedPositionsFrom(
  request: DesignRunRequest,
): Array<{ chain: string; position: number }> | undefined {
  const raw = request.conditioning.customConstraints?.fixedPositions;
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter(
      (p): p is { chain: string; position: number } =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as { chain?: unknown }).chain === 'string' &&
        typeof (p as { position?: unknown }).position === 'number',
    )
    .map((p) => ({ chain: p.chain, position: p.position }));
}

export function getDesignService(): DesignService {
  if (!designService) {
    designService = new DesignService();
  }
  return designService;
}
