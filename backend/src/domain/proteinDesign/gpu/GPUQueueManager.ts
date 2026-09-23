// GPUQueueManager — persistent, GPU-aware design job queue.
//
// Supersedes the Phase-1 in-memory JobQueue for the running app. Every state
// transition is written to a GPUJob database row (job persistence), execution
// is scheduled onto healthy GPU workers (acquire/release), retries use
// exponential backoff (retry logic), and both jobs and workers are queryable
// (queue visibility). Cancellation requests trip the job's abort signal.

import { DesignRunStatus, type JobStatusEvent } from '../types/index.js';
import type { DesignJob, JobHandler } from '../jobs/JobQueue.js';
import { GPUWorkerRegistry } from './GPUWorkerRegistry.js';
import { GPUJobExecutor, type GPUJobExecutorContext } from './GPUJobExecutor.js';

/** Thrown internally when a job was cancelled mid-execution. */
export class JobCancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'JobCancelledError';
  }
}

export type GPUJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface GpuJobRecord {
  id: string;
  runId: string;
  projectId: string;
  mode: string;
  payload: Record<string, unknown>;
  status: GPUJobStatus;
  attempts: number;
  maxAttempts: number;
  workerId?: string;
  lastHeartbeatAt?: Date;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

/**
 * Best-effort durable store for GPUJob rows. Implementations must not throw
 * hard-fatal errors synchronously; the queue treats persistence as optional
 * durability layered over execution, and survives a dead writer.
 */
export interface GpuJobPersistence {
  create(record: GpuJobRecord): Promise<void>;
  update(
    id: string,
    patch: Partial<Omit<GpuJobRecord, 'id'>>,
  ): Promise<void>;
  listByStatus(status: GPUJobStatus): Promise<GpuJobRecord[]>;
}

/** No-op storage (tests / no DB) — queue still runs in-memory. */
export class NullGpuJobPersistence implements GpuJobPersistence {
  private rows = new Map<string, GpuJobRecord>();

  async create(record: GpuJobRecord): Promise<void> {
    this.rows.set(record.id, clone(record));
  }
  async update(id: string, patch: Partial<Omit<GpuJobRecord, 'id'>>): Promise<void> {
    const row = this.rows.get(id);
    if (row) {
      this.rows.set(id, { ...row, ...clone(patch) });
    }
  }
  async listByStatus(status: GPUJobStatus): Promise<GpuJobRecord[]> {
    return Array.from(this.rows.values()).filter((r) => r.status === status);
  }
}

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

export interface GPUQueueManagerOptions {
  registry?: GPUWorkerRegistry;
  persistence?: GpuJobPersistence;
  executor?: GPUJobExecutor;
  /** Base delay for exponential retry backoff. */
  backoffBaseMs?: number;
  /** Delay before the initial processing pass after enqueue. */
  startDelayMs?: number;
  maxRetries?: number;
  now?: () => Date;
}

export class GPUQueueManager {
  private readonly registry: GPUWorkerRegistry;
  private readonly persistence: GpuJobPersistence;
  private readonly executor: GPUJobExecutor;
  private readonly jobs = new Map<string, DesignJob>();
  private readonly handlers: JobHandler[] = [];
  private readonly subscribers: ((event: JobStatusEvent) => void)[] = [];
  private readonly processing = new Set<string>();
  private readonly aborts = new Map<string, AbortController>();
  private readonly backoffBaseMs: number;
  private readonly startDelayMs: number;
  private readonly defaultMaxRetries: number;
  private readonly now: () => Date;
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(options: GPUQueueManagerOptions = {}) {
    this.registry = options.registry ?? new GPUWorkerRegistry();
    this.persistence = options.persistence ?? new NullGpuJobPersistence();
    this.executor = options.executor ?? new GPUJobExecutor();
    this.backoffBaseMs = options.backoffBaseMs ?? 500;
    this.startDelayMs = options.startDelayMs ?? 100;
    this.defaultMaxRetries = options.maxRetries ?? 3;
    this.now = options.now ?? (() => new Date());
  }

  // --- wiring ---------------------------------------------------------------

  subscribe(callback: (event: JobStatusEvent) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const idx = this.subscribers.indexOf(callback);
      if (idx > -1) this.subscribers.splice(idx, 1);
    };
  }

  addHandler(handler: JobHandler): void {
    this.handlers.push(handler);
  }

  private notify(event: JobStatusEvent): void {
    for (const sub of this.subscribers) {
      try {
        sub(event);
      } catch {
        // subscriber failures never affect the queue
      }
    }
  }

  private findHandler(mode: string): JobHandler | undefined {
    return this.handlers.find((h) => h.canHandle(mode));
  }

  // --- public API -----------------------------------------------------------

  enqueue(job: Omit<DesignJob, 'status' | 'createdAt' | 'retries'>): DesignJob {
    const fullJob: DesignJob = {
      ...job,
      status: DesignRunStatus.QUEUED,
      createdAt: this.now(),
      retries: 0,
      maxRetries: job.maxRetries ?? this.defaultMaxRetries,
    };
    this.jobs.set(fullJob.runId, fullJob);
    this.aborts.set(fullJob.runId, new AbortController());

    const record: GpuJobRecord = {
      id: `gpu_${fullJob.runId}`,
      runId: fullJob.runId,
      projectId: fullJob.projectId,
      mode: fullJob.mode,
      payload: fullJob.payload ?? {},
      status: 'QUEUED',
      attempts: 0,
      maxAttempts: fullJob.maxRetries,
      createdAt: fullJob.createdAt,
    };
    void this.persistence.create(record).catch(() => undefined);
    this.notify({ runId: fullJob.runId, status: DesignRunStatus.QUEUED });

    const delayed = setTimeout(() => {
      void this.processJob(fullJob.runId);
    }, this.startDelayMs);
    delayed.unref?.();

    return fullJob;
  }

  getJob(runId: string): DesignJob | undefined {
    return this.jobs.get(runId);
  }

  getAllJobs(): DesignJob[] {
    return Array.from(this.jobs.values());
  }

  getJobsByStatus(status: DesignRunStatus): DesignJob[] {
    return this.jobsValues().filter((j) => j.status === status);
  }

  cancelJob(runId: string): boolean {
    const job = this.jobs.get(runId);
    if (!job) return false;
    if (job.status !== DesignRunStatus.QUEUED && job.status !== DesignRunStatus.RUNNING) {
      return false;
    }
    this.aborts.get(runId)?.abort();
    job.status = DesignRunStatus.FAILED;
    job.failedReason = 'Cancelled by user';
    job.completedAt = this.now();
    this.processing.delete(runId);
    void this.persistence.update(recordId(runId), { status: 'CANCELLED', completedAt: job.completedAt }).catch(() => undefined);
    this.notify({ runId, status: DesignRunStatus.FAILED, message: 'Cancelled' });
    return true;
  }

  // --- visibility -----------------------------------------------------------

  listJobRecords(): Promise<GpuJobRecord[]> {
    return this.persistence.listByStatus('QUEUED').then(() => this.allRecords());
  }

  private async allRecords(): Promise<GpuJobRecord[]> {
    return Array.from(this.jobs.entries()).map(([runId, job]) => ({
      id: recordId(runId),
      runId,
      projectId: job.projectId,
      mode: job.mode,
      payload: (job.payload ?? {}) as Record<string, unknown>,
      status: gpuStatusFor(job.status),
      attempts: job.retryCount ?? job.retries,
      maxAttempts: job.maxRetries,
      workerId: job.gpuId,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      errorMessage: job.failedReason,
    }));
  }

  getQueueStats(): {
    queued: number;
    running: number;
    completed: number;
    failed: number;
    deadWorkers: number;
    healthyWorkers: number;
    freeSlots: number;
  } {
    const jobs = this.jobsValues();
    return {
      queued: jobs.filter((j) => j.status === DesignRunStatus.QUEUED).length,
      running: jobs.filter((j) => j.status === DesignRunStatus.RUNNING).length,
      completed: jobs.filter((j) => j.status === DesignRunStatus.COMPLETED).length,
      failed: jobs.filter((j) => j.status === DesignRunStatus.FAILED).length,
      deadWorkers: this.registry.listDead().length,
      healthyWorkers: this.registry.healthyCount,
      freeSlots: this.registry.availableSlots,
    };
  }

  // --- processing -----------------------------------------------------------

  private async processJob(runId: string, isRetry = false): Promise<void> {
    if (this.processing.has(runId)) return;
    this.processing.add(runId);

    const job = this.jobs.get(runId);
    if (!job) return;

    const abort = this.aborts.get(runId)?.signal;
    if (abort?.aborted) {
      this.processing.delete(runId);
      return;
    }

    job.status = DesignRunStatus.RUNNING;
    job.startedAt = this.now();
    job.retryCount = (job.retryCount ?? 0) + (isRetry ? 1 : 0);
    this.notify({ runId, status: DesignRunStatus.RUNNING, progress: 0 });
    void this.persistence.update(recordId(runId), {
      status: 'RUNNING',
      attempts: job.retryCount,
      startedAt: job.startedAt,
    }).catch(() => undefined);

    const handler = this.findHandler(job.mode);
    if (!handler) {
      job.status = DesignRunStatus.FAILED;
      job.failedReason = `No handler found for mode: ${job.mode}`;
      job.completedAt = this.now();
      void this.persistence.update(recordId(runId), { status: 'FAILED', errorMessage: job.failedReason, completedAt: job.completedAt }).catch(() => undefined);
      this.processing.delete(runId);
      this.notify({ runId, status: DesignRunStatus.FAILED, message: job.failedReason });
      return;
    }

    try {
      await this.runOnWorker(job, handler, abort);
      // executeDesignJob already ran validation+ranking before returning;
      // only the terminal transition is notified so concurrent
      // applyQueueStatus calls cannot race VALIDATING against COMPLETED.
      job.status = DesignRunStatus.COMPLETED;
      job.completedAt = this.now();
      void this.persistence.update(recordId(runId), { status: 'COMPLETED', completedAt: job.completedAt }).catch(() => undefined);
      this.notify({ runId, status: DesignRunStatus.COMPLETED, progress: 100 });
    } catch (error) {
      if (error instanceof JobCancelledError) {
        // cancelJob already marked the job FAILED('Cancelled'); nothing to do.
        return;
      }
      job.retryCount = (job.retryCount ?? 0) + 1;
      const retryable = (job.retryCount ?? 0) <= job.maxRetries;

      if (retryable) {
        const delay = Math.min(this.backoffBaseMs * 2 ** (job.retryCount - 1), 30_000);
        void this.persistence.update(recordId(runId), {
          status: 'QUEUED',
          attempts: job.retryCount,
          errorMessage: undefined,
        }).catch(() => undefined);
        this.notify({ runId, status: DesignRunStatus.QUEUED, message: `Retrying (attempt ${job.retryCount})` });
        setTimeout(() => {
          this.processing.delete(runId);
          void this.processJob(runId, true);
        }, delay);
        return;
      }

      job.status = DesignRunStatus.FAILED;
      job.failedReason = underlyingMessage(error);
      job.completedAt = this.now();
      void this.persistence.update(recordId(runId), {
        status: 'FAILED',
        attempts: job.retryCount,
        errorMessage: job.failedReason,
        completedAt: job.completedAt,
      }).catch(() => undefined);
      this.notify({ runId, status: DesignRunStatus.FAILED, message: job.failedReason });
    } finally {
      this.processing.delete(runId);
    }
  }

  private async runOnWorker(
    job: DesignJob,
    handler: JobHandler,
    abort: AbortSignal | undefined,
  ): Promise<void> {
    const acquired = this.registry.acquire(job.mode);
    if (!acquired) {
      // No free GPU slot — wait and reassign, preserving ordering loosely.
      await delay(Math.min(this.startDelayMs * 5, 2000));
      this.processing.delete(job.runId);
      await this.processJob(job.runId, false);
      return;
    }
    const { worker, release } = acquired;
    job.gpuId = worker.id;
    this.registry.assignJob(worker.id, job.runId);
    void this.persistence.update(recordId(job.runId), { workerId: worker.id }).catch(() => undefined);

    const ctx: GPUJobExecutorContext = {
      job,
      worker,
      handler,
      registry: this.registry,
      abort,
      onProgress: (progress) => this.notify({ runId: job.runId, status: DesignRunStatus.RUNNING, progress }),
    };
    try {
      const outcome = await this.executor.execute(ctx);
      if (outcome === 'cancelled') {
        throw new JobCancelledError();
      }
    } finally {
      release();
      job.gpuId = undefined;
    }
  }

  /** Liveness sweep: dead workers' running jobs get requeued. */
  startLivenessSweep(intervalMs = 3000): void {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => {
      const dead = this.registry.pruneDead();
      for (const workerId of dead) {
        for (const job of this.jobsValues()) {
          if (job.status === DesignRunStatus.RUNNING && job.gpuId === workerId) {
            job.status = DesignRunStatus.QUEUED;
            job.failedReason = undefined;
            this.notify({ runId: job.runId, status: DesignRunStatus.QUEUED, message: 'Worker lost — requeued' });
            void this.processJob(job.runId, true);
          }
        }
      }
    }, intervalMs);
    this.sweepTimer.unref?.();
  }

  stopLivenessSweep(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  shutdown(): void {
    this.stopLivenessSweep();
    for (const job of this.jobsValues()) {
      if (job.status === DesignRunStatus.QUEUED || job.status === DesignRunStatus.RUNNING) {
        this.aborts.get(job.runId)?.abort();
        job.status = DesignRunStatus.FAILED;
        job.failedReason = 'Queue shutdown';
        void this.persistence.update(recordId(job.runId), { status: 'FAILED', errorMessage: 'Queue shutdown' }).catch(() => undefined);
      }
    }
  }

  private jobsValues(): DesignJob[] {
    return Array.from(this.jobs.values());
  }

  /** Test hook: reset everything. */
  reset(): void {
    this.stopLivenessSweep();
    this.jobs.clear();
    this.handlers.length = 0;
    this.subscribers.length = 0;
    this.processing.clear();
    this.aborts.clear();
    this.registry.clear();
    if (this.persistence instanceof NullGpuJobPersistence) {
      void this.persistence.listByStatus('QUEUED').then((rows) => {
        for (const row of rows) (this.persistence as NullGpuJobPersistence).update(row.id, {});
      });
    }
  }
}

function recordId(runId: string): string {
  return `gpu_${runId}`;
}

/** The executor wraps handler errors; surface the real cause to users. */
function underlyingMessage(error: unknown): string {
  const cause = (error as { cause?: unknown } | undefined)?.cause;
  if (cause instanceof Error && cause.message) return cause.message;
  const message = (error as Error | undefined)?.message;
  return message ?? String(error);
}

function gpuStatusFor(status: DesignRunStatus): GPUJobStatus {
  switch (status) {
    case DesignRunStatus.RUNNING:
      return 'RUNNING';
    case DesignRunStatus.VALIDATING:
      return 'RUNNING';
    case DesignRunStatus.COMPLETED:
      return 'COMPLETED';
    case DesignRunStatus.FAILED:
      return 'FAILED';
    default:
      return 'QUEUED';
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}