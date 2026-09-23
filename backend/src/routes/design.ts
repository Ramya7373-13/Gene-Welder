// Design Studio API - /api/design
// Thin controller layer. Every route resolves the acting user from the session
// cookie (never from the request body or query), then delegates to
// DesignService. No Prisma access and no domain logic lives here.

import { Router } from 'express';
import { ZodError } from 'zod';
import { getSessionFromCookie } from '../lib/session.js';
import { getGpuJobManager } from '../domain/proteinDesign/gpu/gpuJobRuntime.js';
import { startDesignJobRuntime } from '../domain/proteinDesign/jobs/designJobRuntime.js';
import {
  DesignNotFoundError,
  DesignValidationError,
  getDesignService,
} from '../domain/proteinDesign/service/DesignService.js';
import {
  createCandidateDto,
  createProjectDto,
  createRunDto,
  designJobPayloadDto,
  ledgerQueryDto,
  updateProjectDto,
  updateRunDto,
  validateCandidateDto,
} from '../domain/proteinDesign/service/dto.js';

export const designRouter = Router();

// Wire the queue exactly once, before the first request can enqueue anything.
startDesignJobRuntime();

const service = getDesignService();

// --- Helpers ----------------------------------------------------------------

// Structurally typed so this stays independent of Zod's exported type names.
interface Parser<T> {
  parse: (input: unknown) => T;
}

function parseBody<T>(schema: Parser<T>, body: unknown): T {
  return schema.parse(body ?? {});
}

function parseQuery<T>(schema: Parser<T>, query: unknown): T {
  return schema.parse(query ?? {});
}

/**
 * Translate a thrown error into an HTTP response.
 *
 * Domain errors carry their own status; anything else is an unexpected fault and
 * is reported as a 500 without leaking internals to the client.
 */
function sendError(res: import('express').Response, error: unknown): void {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Invalid request', issues: error.issues });
    return;
  }
  if (error instanceof DesignValidationError) {
    res.status(400).json({ error: error.message, details: error.details });
    return;
  }
  if (error instanceof DesignNotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  res.status(500).json({ error: 'Design request failed', message });
}

// --- Projects ---------------------------------------------------------------

designRouter.get('/projects', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    const projects = await service.listProjects(session.userId);
    return res.json({ projects });
  } catch (error) {
    return sendError(res, error);
  }
});

designRouter.post('/projects', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    const dto = parseBody(createProjectDto, req.body);
    const project = await service.createProject(session.userId, dto);
    return res.status(201).json({ project });
  } catch (error) {
    return sendError(res, error);
  }
});

designRouter.get('/projects/:projectId', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    const project = await service.getProject(session.userId, req.params.projectId);
    return res.json({ project });
  } catch (error) {
    return sendError(res, error);
  }
});

designRouter.put('/projects/:projectId', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    const dto = parseBody(updateProjectDto, req.body);
    const project = await service.updateProject(session.userId, req.params.projectId, dto);
    return res.json({ project });
  } catch (error) {
    return sendError(res, error);
  }
});

// --- Runs -------------------------------------------------------------------

const listRunsQueryDto = createRunDto.pick({ projectId: true }).partial();

designRouter.get('/runs', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    const { projectId } = parseQuery(listRunsQueryDto, req.query);
    const runs = await service.listRuns(session.userId, projectId);
    return res.json({ runs });
  } catch (error) {
    return sendError(res, error);
  }
});

designRouter.post('/runs', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    const dto = parseBody(createRunDto, req.body);
    const run = await service.createRun(session.userId, dto);
    // The payload is self-contained so the job never re-reads mutable run state.
    const payload = designJobPayloadDto.parse({
      mode: dto.mode,
      parameters: dto.parameters ?? {},
      conditioning: run.constraintSpec,
      targetSequence: run.targetSequence ?? undefined,
      variant: dto.variant,
      userId: session.userId,
    });
    getGpuJobManager().enqueue({
      runId: run.id,
      projectId: run.projectId,
      mode: run.mode,
      payload: payload as unknown as Record<string, unknown>,
      maxRetries: 3,
    });
    return res.status(201).json({ run });
  } catch (error) {
    return sendError(res, error);
  }
});

designRouter.get('/runs/:runId', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    const run = await service.getRun(session.userId, req.params.runId);
    const job = getGpuJobManager().getJob(req.params.runId);
    return res.json({
      run,
      progress: job ? { status: job.status, retryCount: job.retryCount ?? 0 } : null,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

designRouter.put('/runs/:runId', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    const dto = parseBody(updateRunDto, req.body);
    if (dto.status === undefined && dto.gpuId === undefined && dto.failedReason === undefined) {
      return res.status(400).json({ error: 'No updatable fields supplied' });
    }
    const run = await service.updateRunStatus(session.userId, req.params.runId, dto);
    return res.json({ run });
  } catch (error) {
    return sendError(res, error);
  }
});

designRouter.delete('/runs/:runId', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    // Ownership is enforced by the service read before the queue is touched.
    await service.getRun(session.userId, req.params.runId);
    const cancelled = getGpuJobManager().cancelJob(req.params.runId);
    return res.json({ cancelled });
  } catch (error) {
    return sendError(res, error);
  }
});

// --- Candidates -------------------------------------------------------------

const listCandidatesQueryDto = createCandidateDto.pick({ runId: true });

designRouter.get('/candidates', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    const { runId } = parseQuery(listCandidatesQueryDto, req.query);
    const candidates = await service.listCandidates(session.userId, runId);
    return res.json({ candidates });
  } catch (error) {
    return sendError(res, error);
  }
});

designRouter.get('/candidates/:candidateId', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    const candidate = await service.getCandidate(session.userId, req.params.candidateId);
    return res.json({ candidate });
  } catch (error) {
    return sendError(res, error);
  }
});

// Phase I: read-only provenance ledger + tamper-evidence chain for one owned
// candidate (ownership enforced by the service's candidate read).
designRouter.get('/candidates/:candidateId/ledger', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    const { candidateId } = parseQuery(ledgerQueryDto, req.params);
    const { ledger, chain } = await service.getCandidateLedger(session.userId, candidateId);
    return res.json({ ledger, chain });
  } catch (error) {
    return sendError(res, error);
  }
});

// --- Validation -------------------------------------------------------------

designRouter.post('/validate', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    const dto = parseBody(validateCandidateDto, req.body);
    const result = await service.validateCandidate(session.userId, dto.candidateId);
    return res.json({ validation: result });
  } catch (error) {
    return sendError(res, error);
  }
});

// --- Analytics --------------------------------------------------------------

designRouter.get('/analytics', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    const analytics = await service.getAnalytics(session.userId);
    return res.json({ analytics });
  } catch (error) {
    return sendError(res, error);
  }
});