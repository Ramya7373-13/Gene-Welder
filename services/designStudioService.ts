/**
 * Design Studio API client — full TypeScript typing for every /api/design route.
 *
 * Mirrors the backend contract in backend/src/domain/proteinDesign/service/dto.ts
 * and the JSON shapes returned by backend/src/routes/design.ts.
 */

const API_BASE = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:5000';

// --- Enums (duplicated from backend domain types, kept in sync manually) -------

export enum DesignMode {
  BINDER = 'BINDER',
  STABILIZER = 'STABILIZER',
  DNA_BINDER = 'DNA_BINDER',
  ENZYME_RESCUE = 'ENZYME_RESCUE',
  SCAFFOLD = 'SCAFFOLD',
  SYMMETRIC_ASSEMBLY = 'SYMMETRIC_ASSEMBLY',
  MOTIF_SCAFFOLD = 'MOTIF_SCAFFOLD',
  PROTEIN_SCAFFOLD = 'PROTEIN_SCAFFOLD',
}

export enum DesignRunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  VALIDATING = 'VALIDATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum ConstraintType {
  HOTSPOT = 'hotspot',
  BURY_DEPTH = 'burialDepth',
  HBOND = 'hbond',
  INTERFACE = 'interface',
  MOTIF = 'motif',
  CENTER_OF_MASS = 'centerOfMass',
}

// --- Shared building blocks -----------------------------------------------------

export interface ResiduePosition {
  chain: string;
  position: number;
  insertCode?: string;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Rfd3Parameters {
  numDesigns?: number;
  diffusionSteps?: number;
  noiseScale?: number;
  partialDiffusion?: boolean;
  temperature?: number;
  topP?: number;
  seed?: number;
  [key: string]: unknown;
}

// --- Entities as returned by the API (Prisma rows over JSON) --------------------

export interface DesignProject {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  targetGene: string | null;
  targetVariant: string | null;
  status: 'ACTIVE' | 'ARCHIVED' | 'COMPLETED';
  createdAt: string;
  updatedAt: string;
  runs?: DesignRun[];
  _count?: { runs: number };
}

export interface DesignRun {
  id: string;
  projectId: string;
  mode: DesignMode;
  designEngine: string;
  status: DesignRunStatus;
  parameters: Record<string, unknown>;
  constraintSpec: unknown;
  targetStructure: string | null;
  targetSequence: string | null;
  gpuId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failedReason: string | null;
  createdAt: string;
  updatedAt: string;
  candidates?: DesignCandidate[];
  constraints?: DesignConstraint[];
  ledgerEntries?: DesignLedgerEntry[];
}

export interface DesignCandidate {
  id: string;
  runId: string;
  structure: string | null;
  sequence: string | null;
  affinityScore: number | null;
  rankedPosition: number | null;
  designMetrics: Record<string, unknown> | null;
  createdAt: string;
  validationResults?: ValidationResult[];
  ledgerEntries?: DesignLedgerEntry[];
}

export interface DesignConstraint {
  id: string;
  runId: string;
  constraintType: string;
  spec: Record<string, unknown>;
  createdAt: string;
}

export interface ValidationResult {
  id: string;
  candidateId: string;
  pTM: number | null;
  ipTM: number | null;
  pLDDT: number | null;
  interfaceArea: number | null;
  constraintSatisfactionScore: number | null;
  diversityScore: number | null;
  overallScore: number | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface DesignLedgerEntry {
  id: string;
  candidateId: string;
  projectId: string | null;
  modelVersion: string;
  weightsHash: string;
  seed: number;
  inputConstraints: Record<string, unknown> | null;
  userId: string;
  timestamp: string;
  validationMetrics: Record<string, unknown> | null;
  runId: string | null;
}

export interface AnalyticsData {
  totalProjects: number;
  totalRuns: number;
  totalCandidates: number;
  averageValidationScore: number;
  runDurations: number[];
  topGenes: { gene: string; count: number }[];
  commonVariants: { variant: string; count: number }[];
  validationScoreDistribution: { score: number; count: number }[];
  successRate: number;
}

// --- Request DTOs (mirror backend Zod schemas) ----------------------------------

export interface CreateProjectRequest {
  name: string;
  description?: string;
  targetGene?: string;
  targetVariant?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: 'ACTIVE' | 'ARCHIVED' | 'COMPLETED';
}

export type DesignConstraintDto =
  | {
      type: ConstraintType.HOTSPOT;
      residues: ResiduePosition[];
      minInteractions?: number;
    }
  | {
      type: ConstraintType.BURY_DEPTH;
      residues: ResiduePosition[];
      minDepth: number;
      maxDepth?: number;
    }
  | {
      type: ConstraintType.HBOND;
      donorPosition: ResiduePosition;
      acceptorPosition: ResiduePosition;
      donorAtom?: string;
      acceptorAtom?: string;
    }
  | {
      type: ConstraintType.INTERFACE;
      chain: string;
      residues: number[];
      shapeComplementarity?: number;
    }
  | {
      type: ConstraintType.MOTIF;
      motifName: string;
      residues: ResiduePosition[];
      preserveOrientation: boolean;
    }
  | {
      type: ConstraintType.CENTER_OF_MASS;
      targetPosition: Vector3;
      radius: number;
    };

export interface CreateRunRequest {
  projectId: string;
  mode: DesignMode;
  parameters?: Rfd3Parameters;
  targetStructure?: string;
  targetSequence?: string;
  chainId?: string;
  /** HGVS protein notation, e.g. "p.G12D". */
  variant?: string;
  constraints?: DesignConstraintDto[];
}

export interface UpdateRunRequest {
  status?: DesignRunStatus;
  gpuId?: string;
  failedReason?: string;
}

/** Error typed like backendService so the UI can surface 401s distinctly. */
export class DesignApiError extends Error {
  readonly status: number;
  readonly issues?: unknown;
  constructor(message: string, status: number, issues?: unknown) {
    super(message);
    this.name = 'DesignApiError';
    this.status = status;
    this.issues = issues;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    throw new DesignApiError((body as any)?.error || 'Not authenticated', 401);
  }

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const payload = (json as any) ?? {};
    const message = typeof payload.error === 'string' ? payload.error : `Design request failed (${res.status})`;
    throw new DesignApiError(message, res.status, payload.issues ?? payload.details);
  }

  return json as T;
}

export const designStudioService = {
  // --- Projects ---------------------------------------------------------------
  async listProjects(): Promise<DesignProject[]> {
    const data = await request<{ projects: DesignProject[] }>('/api/design/projects');
    return data.projects;
  },

  async createProject(dto: CreateProjectRequest): Promise<DesignProject> {
    const data = await request<{ project: DesignProject }>('/api/design/projects', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    return data.project;
  },

  async getProject(projectId: string): Promise<DesignProject> {
    const data = await request<{ project: DesignProject }>(`/api/design/projects/${encodeURIComponent(projectId)}`);
    return data.project;
  },

  async updateProject(projectId: string, dto: UpdateProjectRequest): Promise<DesignProject> {
    const data = await request<{ project: DesignProject }>(`/api/design/projects/${encodeURIComponent(projectId)}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    });
    return data.project;
  },

  // --- Runs -------------------------------------------------------------------
  async listRuns(projectId?: string): Promise<DesignRun[]> {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    const data = await request<{ runs: DesignRun[] }>(`/api/design/runs${qs}`);
    return data.runs;
  },

  async createRun(dto: CreateRunRequest): Promise<DesignRun> {
    const data = await request<{ run: DesignRun }>('/api/design/runs', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    return data.run;
  },

  async getRun(runId: string): Promise<{ run: DesignRun; progress: { status: string; retryCount: number } | null }> {
    return request(`/api/design/runs/${encodeURIComponent(runId)}`);
  },

  async updateRunStatus(runId: string, dto: UpdateRunRequest): Promise<DesignRun> {
    const data = await request<{ run: DesignRun }>(`/api/design/runs/${encodeURIComponent(runId)}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    });
    return data.run;
  },

  async cancelRun(runId: string): Promise<{ cancelled: boolean }> {
    return request(`/api/design/runs/${encodeURIComponent(runId)}`, { method: 'DELETE' });
  },

  // --- Candidates -------------------------------------------------------------
  async listCandidates(runId: string): Promise<DesignCandidate[]> {
    const data = await request<{ candidates: DesignCandidate[] }>(
      `/api/design/candidates?runId=${encodeURIComponent(runId)}`,
    );
    return data.candidates;
  },

  async getCandidate(candidateId: string): Promise<DesignCandidate> {
    const data = await request<{ candidate: DesignCandidate }>(`/api/design/candidates/${encodeURIComponent(candidateId)}`);
    return data.candidate;
  },

  // --- Validation -------------------------------------------------------------
  async validateCandidate(candidateId: string): Promise<ValidationResult> {
    const data = await request<{ validation: ValidationResult }>('/api/design/validate', {
      method: 'POST',
      body: JSON.stringify({ candidateId }),
    });
    return data.validation;
  },

  // --- Analytics --------------------------------------------------------------
  async getAnalytics(): Promise<AnalyticsData> {
    const data = await request<{ analytics: AnalyticsData }>('/api/design/analytics');
    return data.analytics;
  },
};