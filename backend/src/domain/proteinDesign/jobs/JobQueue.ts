// Job Queue Service - Manages async design execution.
// Phase 1: In-memory queue with simulated async execution.
// Future: Replace with Redis/BullMQ for distributed GPU worker support.

import { DesignRunStatus, type JobStatusEvent } from '../types/index.js';

export interface JobQueueCallbacks {
  onStatusUpdate: (event: JobStatusEvent) => void;
  onComplete: (runId: string) => void;
  onFailed: (runId: string, error: Error) => void;
}

/**
 * Job definition for the queue.
 */
export interface DesignJob {
  runId: string;
  projectId: string;
  mode: string;
  payload: Record<string, unknown>;
  status: DesignRunStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedReason?: string;
  gpuId?: string;
  retries: number;
  retryCount?: number;
  maxRetries: number;
}

/**
 * Job handler interface for different design modes.
 */
export interface JobHandler {
  execute(job: DesignJob): Promise<unknown>;
  canHandle(mode: string): boolean;
}

/**
 * In-memory job queue for Phase 1.
 * Simulates async execution with delays to mimic GPU job processing.
 */
export class JobQueue {
  private jobs: Map<string, DesignJob> = new Map();
  private handlers: JobHandler[] = [];
  private subscribers: ((event: JobStatusEvent) => void)[] = [];
  private processing: Set<string> = new Set();

  subscribe(callback: (event: JobStatusEvent) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const idx = this.subscribers.indexOf(callback);
      if (idx > -1) this.subscribers.splice(idx, 1);
    };
  }

  private notify(event: JobStatusEvent): void {
    for (const sub of this.subscribers) {
      sub(event);
    }
  }

  addHandler(handler: JobHandler): void {
    this.handlers.push(handler);
  }

  private findHandler(mode: string): JobHandler | undefined {
    return this.handlers.find(h => h.canHandle(mode));
  }

  enqueue(job: Omit<DesignJob, 'status' | 'createdAt' | 'retries'>): DesignJob {
    const fullJob: DesignJob = {
      ...job,
      status: DesignRunStatus.QUEUED,
      createdAt: new Date(),
      retries: 0,
      maxRetries: 3,
    };

    this.jobs.set(fullJob.runId, fullJob);
    this.notify({ runId: fullJob.runId, status: DesignRunStatus.QUEUED });

    // Start processing on next tick
    setTimeout(() => this.processJob(fullJob.runId), 100);

    return fullJob;
  }

  private async processJob(runId: string): Promise<void> {
    if (this.processing.has(runId)) return;
    this.processing.add(runId);

    const job = this.jobs.get(runId);
    if (!job) return;

    // Update status to RUNNING
    job.status = DesignRunStatus.RUNNING;
    job.startedAt = new Date();
    this.notify({ runId, status: DesignRunStatus.RUNNING, progress: 0 });

    // Find appropriate handler
    const handler = this.findHandler(job.mode);
    if (!handler) {
      job.status = DesignRunStatus.FAILED;
      job.failedReason = `No handler found for mode: ${job.mode}`;
      this.processing.delete(runId);
      this.notify({ runId, status: DesignRunStatus.FAILED, message: job.failedReason });
      return;
    }

    try {
      // Simulate GPU processing delay
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
      this.notify({ runId, status: DesignRunStatus.RUNNING, progress: 50 });

      await handler.execute(job);

      // Move to VALIDATING
      job.status = DesignRunStatus.VALIDATING;
      this.notify({ runId, status: DesignRunStatus.VALIDATING, progress: 80 });

      // Simulate validation delay
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));

      job.status = DesignRunStatus.COMPLETED;
      job.completedAt = new Date();
      this.notify({ runId, status: DesignRunStatus.COMPLETED, progress: 100 });
    } catch (error) {
      job.retryCount = (job.retryCount ?? 0) + 1;

      if (job.retryCount < job.maxRetries) {
        this.notify({ runId, status: DesignRunStatus.QUEUED, message: 'Retrying...' });
        setTimeout(() => this.processJob(runId), 1000);
      } else {
        job.status = DesignRunStatus.FAILED;
        job.failedReason = (error as Error).message;
        this.notify({ runId, status: DesignRunStatus.FAILED, message: job.failedReason });
      }
    } finally {
      this.processing.delete(runId);
    }
  }

  getJob(runId: string): DesignJob | undefined {
    return this.jobs.get(runId);
  }

  getAllJobs(): DesignJob[] {
    return Array.from(this.jobs.values());
  }

  getJobsByStatus(status: DesignRunStatus): DesignJob[] {
    return Array.from(this.jobs.values()).filter(j => j.status === status);
  }

  cancelJob(runId: string): boolean {
    const job = this.jobs.get(runId);
    if (job && (job.status === DesignRunStatus.QUEUED || job.status === DesignRunStatus.RUNNING)) {
      job.status = DesignRunStatus.FAILED;
      job.failedReason = 'Cancelled by user';
      this.processing.delete(runId);
      this.notify({ runId, status: DesignRunStatus.FAILED, message: 'Cancelled' });
      return true;
    }
    return false;
  }

  shutdown(): void {
    for (const job of this.jobs.values()) {
      if (job.status === DesignRunStatus.QUEUED || job.status === DesignRunStatus.RUNNING) {
        job.status = DesignRunStatus.FAILED;
        job.failedReason = 'Queue shutdown';
      }
    }
  }
}

/**
 * Singleton instance for the application.
 */
let jobQueue: JobQueue | null = null;

export function getJobQueue(): JobQueue {
  if (!jobQueue) {
    jobQueue = new JobQueue();
  }
  return jobQueue;
}
