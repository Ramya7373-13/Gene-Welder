// Synchronous in-process job runner for DNA Archive Lab (V1).
// Constraint: no queue infrastructure (Redis/BullMQ) exists in this codebase and
// V1 does not add any. The DnaStorageJobRunner interface (types.ts) is the seam:
// a queue-backed implementation can be swapped in later without changing callers.
import type {
  DnaStorageJob,
  DnaStorageJobResult,
  DnaStorageJobRunner,
} from './types.js';

export class SynchronousJobRunner implements DnaStorageJobRunner {
  async run(job: DnaStorageJob): Promise<DnaStorageJobResult> {
    try {
      // The actual encode/simulate/decode work is orchestrated by the route
      // layer, which already holds the Prisma records; this runner provides the
      // execution seam (status mapping + error containment) around it.
      const output = await this.execute(job);
      return { ok: true, status: output.status, output: output.output };
    } catch (error) {
      return {
        ok: false,
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async execute(
    job: DnaStorageJob
  ): Promise<{ status: DnaStorageJobResult['status']; output?: unknown }> {
    switch (job.kind) {
      case 'encode':
        return { status: 'ENCODED', output: job.input };
      case 'simulate':
        return { status: 'SIMULATING', output: job.input };
      case 'decode':
        return { status: 'COMPLETED', output: job.input };
      default:
        throw new Error(`Unknown job kind: ${(job as DnaStorageJob).kind}`);
    }
  }
}
