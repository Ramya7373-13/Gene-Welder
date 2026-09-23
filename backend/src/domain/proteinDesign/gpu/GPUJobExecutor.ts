// GPUJobExecutor — runs a design job on an assigned GPU worker.
//
// While the handler is executing, the executor heartbeats the worker so the
// registry sees the device as alive. If the worker's heartbeat goes stale
// mid-run (device died, network blip), or the job exceeds its hard timeout,
// execution is aborted with a RetryableExecutionError so the queue can
// reassign the job rather than fail it outright.

import type { DesignJob } from '../jobs/JobQueue.js';
import type { JobHandler } from '../jobs/JobQueue.js';
import type { GPUWorkerInfo, GPUWorkerRegistry } from './GPUWorkerRegistry.js';

/** Process died / node went away while the job was running — safe to retry. */
export class RetryableExecutionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'RetryableExecutionError';
  }
}

/** Hard wall-clock limit exceeded — the job is stuck, not wedged. */
export class GpuJobTimeoutError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'GpuJobTimeoutError';
  }
}

export interface GPUJobExecutorContext {
  job: DesignJob;
  worker: GPUWorkerInfo;
  handler: JobHandler;
  registry: GPUWorkerRegistry;
  /** Set to abort the run (cancellation). */
  abort?: AbortSignal;
  onProgress?: (progress: number) => void;
  heartbeatIntervalMs?: number;
  staleWorkerAfterMs?: number;
  timeoutMs?: number;
  now?: () => Date;
}

/** Stub handle that aborts when a beat is missed (used in stall detection). */
export interface HeartbeatController {
  stop(): void;
  beat(now: Date): void;
}

export class GPUJobExecutor {
  /**
   * Execute `ctx.job` on `ctx.worker`, keeping the worker's heartbeat alive the
   * whole time. Resolves on success; throws RetryableExecutionError when the
   * worker dies mid-run or times out; throws nothing on cancellation (returns
   * 'cancelled') when the abort signal fires first.
   */
  async execute(
    ctx: GPUJobExecutorContext,
    controller?: HeartbeatController,
  ): Promise<'completed' | 'cancelled'> {
    const now = ctx.now ?? (() => new Date());
    const interval = ctx.heartbeatIntervalMs ?? 1000;
    const staleAfter = ctx.staleWorkerAfterMs ?? 5000;
    const timeoutMs = ctx.timeoutMs ?? 15 * 60 * 1000;
    const registry = ctx.registry;

    if (registry.isDead(ctx.worker.id)) {
      throw new RetryableExecutionError(`Worker ${ctx.worker.id} is not healthy`, undefined);
    }

    return new Promise<'completed' | 'cancelled'>((resolve, reject) => {
      const started = now().getTime();
      let finished = false;
      // `timeout` is assigned below, after the first synchronous beat(); finishWith
      // can only clear it once assigned, so `let` + TDZ-safe ordering is required.
      let timeout: ReturnType<typeof setTimeout> | undefined;

      const beat = (): void => {
        if (finished) return;
        if (controller) {
          // A controller owns device liveness (test stub or out-of-process beat
          // mirror); the executor does not refresh the registry itself.
          controller.beat(now());
        } else {
          registry.heartbeat(ctx.worker.id);
        }
        if (registry.isDead(ctx.worker.id)) {
          finishWith(new RetryableExecutionError(
            `Worker ${ctx.worker.id} stopped heart-beating while running ${ctx.job.runId}`,
            undefined,
          ));
        }
      };
      const timer = setInterval(beat, interval);
      beat();

      const onAbort = (): void => {
        finishWith('cancelled');
      };
      if (ctx.abort?.aborted) {
        onAbort();
      } else {
        ctx.abort?.addEventListener('abort', onAbort, { once: true });
      }

      ctx.onProgress?.(10);

      const runPromise = (async () => {
        await ctx.handler.execute(ctx.job);
        ctx.onProgress?.(90);
        return 'completed' as const;
      })();

      timeout = setTimeout(() => {
        finishWith(new GpuJobTimeoutError(
          `Job ${ctx.job.runId} exceeded ${timeoutMs}ms on worker ${ctx.worker.id}`,
          undefined,
        ));
      }, timeoutMs);

      function finishWith(result: 'completed' | 'cancelled' | Error): void {
        if (finished) return;
        finished = true;
        if (timeout) clearTimeout(timeout);
        clearInterval(timer);
        ctx.abort?.removeEventListener('abort', onAbort);
        if (result instanceof Error) reject(result);
        else resolve(result);
      }

      runPromise
        .catch((error: unknown) => {
          finishWith(new RetryableExecutionError(
            `Job ${ctx.job.runId} failed on worker ${ctx.worker.id}`,
            error,
          ));
        })
        .then((result) => {
          if (!finished && result === 'completed') {
            finishWith('completed');
          }
        });
    });
  }
}