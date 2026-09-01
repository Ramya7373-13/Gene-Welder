import type {
  DecodeApiResult,
  DnaStorageExperiment,
  EncodeResult,
  EncodingProfile,
  ErrorProfile,
  SimulateResult,
  StrandsPage,
  UploadResult,
} from '../types/dnaStorage';

const API_BASE = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:5000';

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === 'string' && body.error.length > 0) return body.error;
  } catch {
    /* ignore non-JSON error bodies */
  }
  return fallback;
}

export const dnaArchiveLabService = {
  async createExperiment(payload: {
    title: string;
    description?: string;
    userId?: string;
  }): Promise<DnaStorageExperiment> {
    const res = await fetch(`${API_BASE}/api/dna-storage/experiments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readError(res, 'Failed to create experiment'));
    return res.json();
  },

  async uploadFile(experimentId: string, file: File, userId?: string): Promise<UploadResult> {
    const form = new FormData();
    form.append('file', file);
    if (userId) form.append('userId', userId);
    const res = await fetch(`${API_BASE}/api/dna-storage/experiments/${experimentId}/upload`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) throw new Error(await readError(res, 'Failed to upload file'));
    return res.json();
  },

  async encodeExperiment(
    experimentId: string,
    encodingProfile: EncodingProfile,
    userId?: string
  ): Promise<EncodeResult> {
    const res = await fetch(`${API_BASE}/api/dna-storage/experiments/${experimentId}/encode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encodingProfile, userId }),
    });
    if (!res.ok) throw new Error(await readError(res, 'Failed to encode experiment'));
    return res.json();
  },

  async simulateExperiment(
    experimentId: string,
    errorProfile: ErrorProfile,
    userId?: string
  ): Promise<SimulateResult> {
    const res = await fetch(`${API_BASE}/api/dna-storage/experiments/${experimentId}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ errorProfile, userId }),
    });
    if (!res.ok) throw new Error(await readError(res, 'Failed to simulate channel errors'));
    return res.json();
  },

  async decodeExperiment(
    experimentId: string,
    errorRunId?: string,
    userId?: string
  ): Promise<DecodeApiResult> {
    const res = await fetch(`${API_BASE}/api/dna-storage/experiments/${experimentId}/decode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ errorRunId, userId }),
    });
    if (!res.ok) throw new Error(await readError(res, 'Failed to decode experiment'));
    return res.json();
  },

  async getExperiment(id: string): Promise<DnaStorageExperiment> {
    const res = await fetch(`${API_BASE}/api/dna-storage/experiments/${id}`);
    if (!res.ok) throw new Error(await readError(res, 'Failed to fetch experiment'));
    return res.json();
  },

  async getStrands(
    id: string,
    opts: { page?: number; pageSize?: number; q?: string } = {}
  ): Promise<StrandsPage> {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', String(opts.page));
    if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
    if (opts.q) params.set('q', opts.q);
    const qs = params.toString();
    const res = await fetch(
      `${API_BASE}/api/dna-storage/experiments/${id}/strands${qs ? `?${qs}` : ''}`
    );
    if (!res.ok) throw new Error(await readError(res, 'Failed to fetch strands'));
    return res.json();
  },

  async getReport(id: string, format: 'json' | 'markdown' = 'json'): Promise<unknown> {
    const res = await fetch(
      `${API_BASE}/api/dna-storage/experiments/${id}/report?format=${format}`
    );
    if (!res.ok) throw new Error(await readError(res, 'Failed to fetch report'));
    if (format === 'markdown') return res.text();
    return res.json();
  },

  async listExperiments(): Promise<DnaStorageExperiment[]> {
    const res = await fetch(`${API_BASE}/api/dna-storage/experiments`);
    if (!res.ok) throw new Error(await readError(res, 'Failed to list experiments'));
    return res.json();
  },

  async deleteExperiment(id: string, userId?: string): Promise<{ deleted: boolean; id: string }> {
    const res = await fetch(`${API_BASE}/api/dna-storage/experiments/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userId ? { userId } : {}),
    });
    if (!res.ok) throw new Error(await readError(res, 'Failed to delete experiment'));
    return res.json();
  },
};
