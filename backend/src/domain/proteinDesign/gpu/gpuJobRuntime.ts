// GPU job runtime — one-time process-wide wiring for GPU orchestration.
//
// Mirrors the design job runtime: safe to call once per process (idempotent),
// registers the design job handler plus the single status subscriber, and the
// queue manager is a singleton shared by routes and any sweep loop.

import { GPUWorkerRegistry } from './GPUWorkerRegistry.js';
import { GPUQueueManager, PrismaGpuJobPersistence } from './index.js';
import { DesignJobHandler } from '../jobs/DesignJobHandler.js';
import { getDesignService, type DesignService } from '../service/DesignService.js';

let registry: GPUWorkerRegistry | null = null;
let manager: GPUQueueManager | null = null;
let started = false;
let mockHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
const MOCK_WORKER_ID = 'mock-rfd3-worker';
const MOCK_HEARTBEAT_INTERVAL_MS = 2000;

/**
 * Register the design handler + status subscriber on the GPU queue.
 * Idempotent. Persistence is best-effort (PrismaGpuJobPersistence swallows
 * writer failures) so the API works even before the schema is migrated.
 */
export function startGpuJobRuntime(service: DesignService = getDesignService()): GPUQueueManager {
  if (manager) return manager;

  registry = new GPUWorkerRegistry();

  // Phase I: no GPU worker is registered outside tests, so `runOnWorker` would
  // re-delay forever (registry.acquire returns null) and a run could never
  // reach COMPLETED. In mock/default API mode we publish a deterministic
  // in-process compute slot; the RFD3 engine itself defaults to mock, so no
  // real inference is ever invoked. In LOCAL/REMOTE modes there is nothing to
  // claim at boot: real workers are announced by the gateway, so none is
  // registered here.
  const apiMode = process.env.RFD3_API_MODE?.toLowerCase();
  if (apiMode !== 'local' && apiMode !== 'remote') {
    registry.register({
      id: MOCK_WORKER_ID,
      kind: 'any', // matches every DesignMode the design engine implements
      name: 'phase-i-deterministic-mock-engine',
      model: 'rfd3-mock-v1',
      vramMb: 0,
      slotLimit: 1,
    });
    if (mockHeartbeatTimer) clearInterval(mockHeartbeatTimer);
    mockHeartbeatTimer = setInterval(() => {
      registry?.heartbeat(MOCK_WORKER_ID);
    }, MOCK_HEARTBEAT_INTERVAL_MS);
    mockHeartbeatTimer.unref?.();
  }

  manager = new GPUQueueManager({
    registry,
    persistence: new PrismaGpuJobPersistence(),
  });

  manager.addHandler(new DesignJobHandler(service));
  manager.subscribe((event) => {
    void service
      .applyQueueStatus(event.runId, event.status, event.message)
      .catch(() => undefined);
  });
  started = true;
  return manager;
}

export function getGpuJobManager(): GPUQueueManager {
  if (!manager) throw new Error('startGpuJobRuntime() must be called before getGpuJobManager()');
  return manager;
}

export function getGpuWorkerRegistry(): GPUWorkerRegistry {
  if (!registry) throw new Error('startGpuJobRuntime() must be called before getGpuWorkerRegistry()');
  return registry;
}

export function gpuJobRuntimeStarted(): boolean {
  return started;
}

/** Test hook. */
export function resetGpuJobRuntimeForTests(): void {
  if (mockHeartbeatTimer) {
    clearInterval(mockHeartbeatTimer);
    mockHeartbeatTimer = null;
  }
  started = false;
  manager = null;
  registry = null;
}