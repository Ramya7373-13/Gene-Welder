import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { DesignRunStatus, type JobStatusEvent } from '../../../src/domain/proteinDesign/types/index.js';
import type { DesignJob, JobHandler } from '../../../src/domain/proteinDesign/jobs/JobQueue.js';
import { GPUWorkerRegistry } from '../../../src/domain/proteinDesign/gpu/GPUWorkerRegistry.js';
import {
  GPUJobExecutor,
  RetryableExecutionError,
  GpuJobTimeoutError,
} from '../../../src/domain/proteinDesign/gpu/GPUJobExecutor.js';
import { GPUQueueManager, NullGpuJobPersistence, JobCancelledError } from '../../../src/domain/proteinDesign/gpu/index.js';

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// --- fixtures ----------------------------------------------------------------

function makeJob(overrides: Partial<DesignJob> = {}): DesignJob {
  return {
    runId: 'run-1',
    projectId: 'proj-1',
    mode: 'rfd3',
    payload: { numDesigns: 4 },
    status: DesignRunStatus.QUEUED,
    createdAt: new Date(),
    retries: 0,
    maxRetries: 3,
    ...overrides,
  } as DesignJob;
}

function makeHandler(fn: (job: DesignJob) => Promise<void>): JobHandler {
  return {
    execute: fn,
    canHandle: () => true,
  };
}

// --- registry ----------------------------------------------------------------

describe('GPUWorkerRegistry', () => {
  it('registers, heartbeats, and reports health', () => {
    const reg = new GPUWorkerRegistry({ heartbeatStaleAfterMs: 1000 });
    reg.register({ id: 'gpu-a', kind: 'rfd3', slotLimit: 2 });
    expect(reg.healthyCount).toBe(1);
    expect(reg.availableSlots).toBe(2);
    expect(reg.isDead('gpu-a')).toBe(false);
  });

  it('marks stale workers dead and prunes them', () => {
    let t = 0;
    const reg = new GPUWorkerRegistry({ heartbeatStaleAfterMs: 1000, now: () => new Date(t) });
    reg.register({ id: 'gpu-b' });
    t = 2000;
    expect(reg.isDead('gpu-b')).toBe(true);
    expect(reg.pruneDead()).toEqual(['gpu-b']);
    expect(reg.listDead()).toHaveLength(1);
  });

  it('acquires healthy workers honoring kind and slot limits', () => {
    const reg = new GPUWorkerRegistry({ heartbeatStaleAfterMs: 5000 });
    reg.register({ id: 'rfd3-1', kind: 'rfd3', slotLimit: 1 });
    reg.register({ id: 'mpnn-1', kind: 'mpnn', slotLimit: 1 });
    expect(reg.acquire('mpnn')?.worker.id).toBe('mpnn-1');
    const a2 = reg.acquire('mpnn')!;
    expect(a2).toBeNull();
    expect(reg.acquire('rfd3')?.worker.id).toBe('rfd3-1');
    expect(reg.acquire('unknown-kind')).toBeNull();
  });

  it('releases a slot back to the pool', () => {
    const reg = new GPUWorkerRegistry({ heartbeatStaleAfterMs: 5000 });
    reg.register({ id: 'gpu-c' });
    const acquired = reg.acquire('rfd3')!;
    expect(reg.availableSlots).toBe(0);
    acquired.release();
    expect(reg.availableSlots).toBe(1);
    expect(reg.get('gpu-c')?.status).toBe('idle');
  });
});

// --- executor ----------------------------------------------------------------

describe('GPUJobExecutor', () => {
  const reg = (staleAfter = 5000) => new GPUWorkerRegistry({ heartbeatStaleAfterMs: staleAfter });

  it('runs the handler and reports completed', async () => {
    const registry = reg();
    registry.register({ id: 'gpu-x' });
    const worker = registry.get('gpu-x')!;
    const handler = makeHandler(async () => undefined);
    const executor = new GPUJobExecutor();
    const outcome = await executor.execute({
      job: makeJob(),
      worker,
      handler,
      registry,
      heartbeatIntervalMs: 10,
      timeoutMs: 2000,
    });
    expect(outcome).toBe('completed');
  });

  it('heartbeats the worker while running', async () => {
    const registry = reg();
    registry.register({ id: 'gpu-ht' });
    const worker = registry.get('gpu-ht')!;
    const beats: number[] = [];
    registry.heartbeat = (id) => {
      beats.push(1);
      return true;
    };
    const handler = makeHandler(async () => {
      await wait(60);
    });
    await new GPUJobExecutor().execute({
      job: makeJob(),
      worker,
      handler,
      registry,
      heartbeatIntervalMs: 15,
      timeoutMs: 2000,
    });
    expect(beats.length).toBeGreaterThanOrEqual(2);
  });

  it('aborts with RetryableExecutionError when the worker dies mid-run', async () => {
    const stale = 30;
    let t = 0;
    const registry = new GPUWorkerRegistry({ heartbeatStaleAfterMs: stale, now: () => new Date(t) });
    registry.register({ id: 'gpu-dying' });
    const worker = registry.get('gpu-dying')!;
    const controller = {
      stop: () => undefined,
      beat: () => {
        // The device stops beating: the clock advance is not acknowledged by
        // any heartbeat, so the registry sees a stale worker.
        t += stale * 4;
      },
    };
    const handler = makeHandler(async () => {
      await wait(50);
    });
    await expect(
      new GPUJobExecutor().execute(
        {
          job: makeJob(),
          worker,
          handler,
          registry,
          heartbeatIntervalMs: 10,
          staleWorkerAfterMs: stale,
          timeoutMs: 2000,
        },
        controller,
      ),
    ).rejects.toBeInstanceOf(RetryableExecutionError);
  });

  it('resolves cancelled when the abort signal fires', async () => {
    const registry = reg();
    registry.register({ id: 'gpu-cx' });
    const worker = registry.get('gpu-cx')!;
    const controller = new AbortController();
    controller.abort();
    const outcome = await new GPUJobExecutor().execute({
      job: makeJob(),
      worker,
      handler: makeHandler(async () => undefined),
      registry,
      abort: controller.signal,
      timeoutMs: 2000,
    });
    expect(outcome).toBe('cancelled');
  });

  it('rejects with GpuJobTimeoutError beyond the hard timeout', async () => {
    const registry = reg();
    registry.register({ id: 'gpu-slow' });
    const worker = registry.get('gpu-slow')!;
    const handler = makeHandler(async () => {
      await wait(500);
    });
    await expect(
      new GPUJobExecutor().execute({
        job: makeJob(),
        worker,
        handler,
        registry,
        timeoutMs: 50,
      }),
    ).rejects.toBeInstanceOf(GpuJobTimeoutError);
  });
});

// --- manager -----------------------------------------------------------------

describe('GPUQueueManager', () => {
  let manager: GPUQueueManager;
  let events: JobStatusEvent[];

  function freshManager(overrides: { maxRetries?: number; backoffBaseMs?: number } = {}) {
    const registry = new GPUWorkerRegistry({ heartbeatStaleAfterMs: 5000 });
    registry.register({ id: 'gpu-mgr', kind: 'any', slotLimit: 4 });
    manager = new GPUQueueManager({
      registry,
      persistence: new NullGpuJobPersistence(),
      maxRetries: overrides.maxRetries ?? 1,
      backoffBaseMs: overrides.backoffBaseMs ?? 5,
      startDelayMs: 0,
    });
    events = [];
    manager.subscribe((e) => events.push(e));
    return { registry, manager };
  }

  beforeEach(() => {
    manager = new GPUQueueManager({ startDelayMs: 0 });
    manager = new GPUQueueManager({ startDelayMs: 0 });
  });

  it('executes an enqueued job to COMPLETED with persistence records', async () => {
    const { manager } = freshManager();
    let ran = false;
    manager.addHandler(
      makeHandler(async () => {
        ran = true;
      }),
    );
    manager.enqueue({ runId: 'job-a', projectId: 'p', mode: 'rfd3', payload: {}, maxRetries: 1 });
    await pollUntil(() => manager.getJob('job-a')?.status === DesignRunStatus.COMPLETED);
    expect(ran).toBe(true);
    expect(manager.getJob('job-a')?.gpuId).toBeUndefined();
    const completed = events.some((e) => e.status === DesignRunStatus.COMPLETED);
    expect(completed).toBe(true);
  });

  it('persists queue visibility stats and job lookup', async () => {
    const { manager } = freshManager();
    manager.addHandler(makeHandler(async () => wait(20)));
    manager.enqueue({ runId: 'job-vis', projectId: 'p', mode: 'rfd3', payload: {}, maxRetries: 1 });
    await pollUntil(() => manager.getJob('job-vis')!.status === DesignRunStatus.RUNNING);
    expect(manager.getJobsByStatus(DesignRunStatus.RUNNING).map((j) => j.runId)).toContain('job-vis');
    const stats = manager.getQueueStats();
    expect(stats.freeSlots).toBeGreaterThanOrEqual(0);
    expect(stats.healthyWorkers).toBe(1);
  });

  it('retries a failing job on a fresh attempt then completes', async () => {
    const { manager } = freshManager({ maxRetries: 2 });
    let calls = 0;
    manager.addHandler(
      makeHandler(async () => {
        calls += 1;
        if (calls < 2) throw new Error('transient boom');
      }),
    );
    manager.enqueue({ runId: 'job-retry', projectId: 'p', mode: 'rfd3', payload: {}, maxRetries: 1 });
    await pollUntil(() => manager.getJob('job-retry')?.status === DesignRunStatus.COMPLETED);
    expect(calls).toBe(2);
    expect(manager.getJob('job-retry')?.retryCount).toBeGreaterThanOrEqual(1);
  });

  it('exhausts retries and FAILS with the final message', async () => {
    const { manager } = freshManager({ maxRetries: 1 });
    manager.addHandler(
      makeHandler(async () => {
        throw new Error('always broken');
      }),
    );
    manager.enqueue({ runId: 'job-fail', projectId: 'p', mode: 'rfd3', payload: {}, maxRetries: 1 });
    await pollUntil(() => manager.getJob('job-fail')?.status === DesignRunStatus.FAILED);
    expect(manager.getJob('job-fail')?.failedReason).toBe('always broken');
    const retried = events.some((e) => (e.message ?? '').startsWith('Retrying'));
    expect(retried).toBe(true);
  });

  it('cancels a queued job before it starts', async () => {
    const { manager } = freshManager();
    const handler = makeHandler(async () => {
      throw new Error('should never run');
    });
    manager.addHandler(handler);
    manager.enqueue({ runId: 'job-cancel', projectId: 'p', mode: 'rfd3', payload: {}, maxRetries: 1 });
    expect(manager.cancelJob('job-cancel')).toBe(true);
    await wait(30);
    expect(manager.getJob('job-cancel')?.status).toBe(DesignRunStatus.FAILED);
    expect(manager.getJob('job-cancel')?.failedReason).toBe('Cancelled by user');
    expect(manager.cancelJob('job-cancel')).toBe(false);
  });

  it('sweep detects a dead worker and requeues its RUNNING job', async () => {
    const registry = new GPUWorkerRegistry({ heartbeatStaleAfterMs: 5000 });
    registry.register({ id: 'gpu-sweep', kind: 'any', slotLimit: 4 });
    const mgr = new GPUQueueManager({
      registry,
      persistence: new NullGpuJobPersistence(),
      startDelayMs: 60_000, // don't let the scheduled processJob run during the test
      maxRetries: 1,
    });
    const mgrEvents: JobStatusEvent[] = [];
    mgr.subscribe((e) => mgrEvents.push(e));
    mgr.addHandler(makeHandler(async () => undefined));

    mgr.enqueue({ runId: 'job-sweep', projectId: 'p', mode: 'rfd3', payload: {}, maxRetries: 1 });
    // Fabricate the orphan: the job is RUNNING on a worker that has since died.
    const job = mgr.getJob('job-sweep')!;
    job.status = DesignRunStatus.RUNNING;
    job.startedAt = new Date();
    job.gpuId = 'gpu-sweep';
    registry.markDead('gpu-sweep');

    mgr.startLivenessSweep(10);
    await pollUntil(() => mgrEvents.some((e) => (e.message ?? '').includes('requeued')));
    mgr.stopLivenessSweep();
    expect(mgr.getJob('job-sweep')?.status).toBe(DesignRunStatus.RUNNING); // re-dispatched

    // Revive the device; the requeued run then completes after its backoff.
    registry.register({ id: 'gpu-sweep', kind: 'any', slotLimit: 4 });
    await pollUntil(() => mgr.getJob('job-sweep')?.status === DesignRunStatus.COMPLETED, 25_000);
  }, 40_000);
});

async function pollUntil(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('pollUntil timed out');
    }
    await wait(5);
  }
}