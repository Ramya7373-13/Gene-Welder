// Design job runtime — one-time wiring of the process-wide GPU-backed queue.
//
// The queue is a singleton and its handler list is append-only, so registration
// must happen exactly once per process. Doing this at module scope (guarded by a
// flag, in case the module is evaluated through two import paths) avoids the
// previous behaviour where every HTTP request appended another handler and
// another subscriber, which leaked memory and caused every run to execute
// through whichever handler happened to be registered first.
//
// The running app executes jobs on the GPU orchestration queue (registry +
// executor + retries); the Phase-1 in-memory JobQueue stays exported as the
// compatibility/simpler surface.

import { startGpuJobRuntime, resetGpuJobRuntimeForTests } from '../gpu/gpuJobRuntime.js';
import { getDesignService, type DesignService } from '../service/DesignService.js';

let started = false;

/**
 * Register the design job handler and the single status subscriber.
 *
 * Idempotent: safe to call from any number of module initialisers. Delegates
 * to the GPU queue manager, so the running app gets worker-aware dispatch.
 */
export function startDesignJobRuntime(service: DesignService = getDesignService()): void {
  if (started) return;
  started = true;
  startGpuJobRuntime(service);
}

/** Test hook: allows a fresh runtime to be wired against a fake service. */
export function resetDesignJobRuntimeForTests(): void {
  started = false;
  resetGpuJobRuntimeForTests();
}
