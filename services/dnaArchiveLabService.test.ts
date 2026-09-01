import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dnaArchiveLabService } from './dnaArchiveLabService';

const API_BASE = 'http://localhost:5000';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response;
}

describe('dnaArchiveLabService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates an experiment via POST /api/dna-storage/experiments', async () => {
    const created = { id: 'exp-1', title: 'Demo', status: 'DRAFT' };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(created, 201));

    const result = await dnaArchiveLabService.createExperiment({ title: 'Demo', description: 'note' });

    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/api/dna-storage/experiments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Demo', description: 'note' }),
    });
    expect(result).toEqual(created);
  });

  it('uploads a file with FormData and no JSON content-type', async () => {
    const file = new File(['Cheers to Humanity and Longevity.'], 'humanity-longevity.txt', { type: 'text/plain' });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ fileId: 'f1', sourceSha256: 'abc' }));

    await dnaArchiveLabService.uploadFile('exp-1', file);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/dna-storage/experiments/exp-1/upload`);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);
    expect(init?.headers).toBeUndefined();
  });

  it('encodes with the encoding profile body', async () => {
    const profile = {
      id: 'learning',
      name: 'Learning mode',
      description: '2-bit mapping',
      mode: 'learning' as const,
      maxPayloadBases: 200,
      maxHomopolymerLength: 4,
      minGcPercent: 0,
      maxGcPercent: 100,
      redundancyFactor: 1,
      checksumAlgorithm: 'sha256' as const,
    };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ status: 'ENCODED', totalStrands: 2 }));

    const result = await dnaArchiveLabService.encodeExperiment('exp-1', profile);
    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/api/dna-storage/experiments/exp-1/encode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encodingProfile: profile }),
    });
    expect(result.status).toBe('ENCODED');
  });

  it('simulates channel errors with an error profile', async () => {
    const errorProfile = {
      id: 'zero',
      label: 'No simulated channel errors',
      substitutionRate: 0,
      insertionRate: 0,
      deletionRate: 0,
      strandDropoutRate: 0,
      duplicationRate: 0,
      coverageDepth: 1,
      seed: 7,
    };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ errorRunId: 'run-1', seed: 7 }));

    const result = await dnaArchiveLabService.simulateExperiment('exp-1', errorProfile);
    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/api/dna-storage/experiments/exp-1/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ errorProfile }),
    });
    expect(result.errorRunId).toBe('run-1');
  });

  it('decodes with an optional errorRunId', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ success: true, decodeRunId: 'd1' }));
    await dnaArchiveLabService.decodeExperiment('exp-1', 'run-1');
    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/api/dna-storage/experiments/exp-1/decode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ errorRunId: 'run-1' }),
    });
  });

  it('gets experiment details, strands, list, and report', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ id: 'exp-1' }))
      .mockResolvedValueOnce(jsonResponse({ page: 1, pageSize: 50, total: 0, strands: [] }))
      .mockResolvedValueOnce(jsonResponse([{ id: 'exp-1' }]))
      .mockResolvedValueOnce(jsonResponse({ experiment: { id: 'exp-1' } }))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => '# report',
      } as Response);

    await dnaArchiveLabService.getExperiment('exp-1');
    await dnaArchiveLabService.getStrands('exp-1', { page: 2, pageSize: 10, q: 'ACGT' });
    await dnaArchiveLabService.listExperiments();
    await dnaArchiveLabService.getReport('exp-1', 'json');
    const md = await dnaArchiveLabService.getReport('exp-1', 'markdown');

    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(`${API_BASE}/api/dna-storage/experiments/exp-1`);
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe(
      `${API_BASE}/api/dna-storage/experiments/exp-1/strands?page=2&pageSize=10&q=ACGT`
    );
    expect(vi.mocked(fetch).mock.calls[2][0]).toBe(`${API_BASE}/api/dna-storage/experiments`);
    expect(vi.mocked(fetch).mock.calls[3][0]).toBe(`${API_BASE}/api/dna-storage/experiments/exp-1/report?format=json`);
    expect(vi.mocked(fetch).mock.calls[4][0]).toBe(`${API_BASE}/api/dna-storage/experiments/exp-1/report?format=markdown`);
    expect(md).toBe('# report');
  });

  it('deletes an experiment', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ deleted: true, id: 'exp-1' }));
    const result = await dnaArchiveLabService.deleteExperiment('exp-1');
    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/api/dna-storage/experiments/exp-1`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(result.deleted).toBe(true);
  });

  it('throws on !res.ok using the backend error message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: 'Experiment not found' }, 404));
    await expect(dnaArchiveLabService.getExperiment('missing')).rejects.toThrow('Experiment not found');
  });
});
