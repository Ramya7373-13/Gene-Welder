// DesignJobHandler — connects the in-memory job queue to the DesignService.
//
// Stateless: the queue owns job state, the service owns persistence. The handler
// exists only to translate a queued job into a design execution, which keeps the
// queue free of any knowledge about Prisma or the design engines.

import { DesignMode } from '../types/index.js';
import type { DesignJob, JobHandler } from './JobQueue.js';
import type { DesignService } from '../service/DesignService.js';

/** Every mode the design domain can execute, derived from the enum itself. */
const SUPPORTED_MODES: ReadonlySet<string> = new Set<string>(Object.values(DesignMode));

export class DesignJobHandler implements JobHandler {
  constructor(private readonly service: DesignService) {}

  /**
   * Claim a job only if its mode is one this domain actually implements.
   *
   * Returning true unconditionally would make this handler swallow every job in
   * the queue, including ones belonging to handlers registered later.
   */
  canHandle(mode: string): boolean {
    return SUPPORTED_MODES.has(mode);
  }

  async execute(job: DesignJob): Promise<{ candidateIds: string[] }> {
    return this.service.executeDesignJob(job);
  }
}
