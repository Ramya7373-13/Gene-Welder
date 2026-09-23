// Phase I E2E - protein-design API accessors for the real /api/design surface.
// Source of truth: backend/src/routes/design.ts + DesignService (verified this
// session). Every accessor drives the seeded local stack only, never invents
// endpoints, and returns the parsed response plus the HTTP status for honest
// assertions.

import type { APIRequestContext } from '@playwright/test';
import { API_BASE } from './seed';

export interface ProjectRow {
  id: string;
  name: string;
}

export interface RunRow {
  id: string;
  projectId: string;
  mode: string;
  status: string;
  failedReason: string | null;
}

export interface CandidateRow {
  id: string;
  runId: string;
  sequence: string | null;
  affinityScore: number | null;
  rankedPosition: number | null;
}

export interface AnalyticsData {
  totalProjects: number;
  totalRuns: number;
  totalCandidates: number;
  successRate: number;
}

export interface LedgerEntry {
  candidateId: string;
  modelVersion: string;
  weightsHash: string;
  seed: number;
  timestamp: string;
  previousLedgerHash?: string;
  ledgerHash?: string;
}

export interface ChainVerification {
  valid: boolean;
  brokenAt: number;
  reasons: string[];
}

async function json<T>(res: { json: () => Promise<unknown> }): Promise<T> {
  return (await res.json()) as T;
}

export async function postProject(
  ctx: APIRequestContext,
  body: { name: string },
): Promise<{ status: number; project: ProjectRow }> {
  const res = await ctx.post(`${API_BASE}/api/design/projects`, { data: body });
  return { status: res.status(), project: (await json<{ project: ProjectRow }>(res)).project };
}

export async function postRun(
  ctx: APIRequestContext,
  body: {
    projectId: string;
    mode: string;
    parameters: { numDesigns: number; seed: number };
    targetSequence: string;
  },
): Promise<{ status: number; run: RunRow }> {
  const res = await ctx.post(`${API_BASE}/api/design/runs`, { data: body });
  return { status: res.status(), run: (await json<{ run: RunRow }>(res)).run };
}

export async function getRun(
  ctx: APIRequestContext,
  runId: string,
): Promise<{ status: number; run: RunRow; progress: { status: string } | null }> {
  const res = await ctx.get(`${API_BASE}/api/design/runs/${runId}`);
  const body = await json<{ run: RunRow; progress: { status: string } | null }>(res);
  return { status: res.status(), run: body.run, progress: body.progress };
}

export async function listCandidates(
  ctx: APIRequestContext,
  runId: string,
): Promise<{ status: number; candidates: CandidateRow[] }> {
  const res = await ctx.get(`${API_BASE}/api/design/candidates`, {
    params: { runId },
  });
  return { status: res.status(), candidates: (await json<{ candidates: CandidateRow[] }>(res)).candidates };
}

export async function getCandidate(
  ctx: APIRequestContext,
  candidateId: string,
): Promise<{ status: number; candidate: CandidateRow }> {
  const res = await ctx.get(`${API_BASE}/api/design/candidates/${candidateId}`);
  return { status: res.status(), candidate: (await json<{ candidate: CandidateRow }>(res)).candidate };
}

export async function getAnalytics(
  ctx: APIRequestContext,
): Promise<{ status: number; analytics: AnalyticsData }> {
  const res = await ctx.get(`${API_BASE}/api/design/analytics`);
  return { status: res.status(), analytics: (await json<{ analytics: AnalyticsData }>(res)).analytics };
}

export async function getLedger(
  ctx: APIRequestContext,
  candidateId: string,
): Promise<{ status: number; ledger: LedgerEntry[]; chain: ChainVerification }> {
  const res = await ctx.get(`${API_BASE}/api/design/candidates/${candidateId}/ledger`);
  const body = await json<{ ledger: LedgerEntry[]; chain: ChainVerification }>(res);
  return { status: res.status(), ledger: body.ledger, chain: body.chain };
}