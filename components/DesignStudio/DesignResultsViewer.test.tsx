import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DesignResultsViewer } from './DesignResultsViewer';
import {
  DesignMode,
  DesignRunStatus,
  DesignCandidate,
  DesignRun,
  designStudioService,
} from '../../services/designStudioService';

vi.mock('../../services/designStudioService', async () => {
  const actual = await vi.importActual<typeof import('../../services/designStudioService')>('../../services/designStudioService');
  return {
    ...actual,
    designStudioService: {
      ...actual.designStudioService,
      listCandidates: vi.fn(),
      validateCandidate: vi.fn(),
    },
  };
});

function makeRun(): DesignRun {
  return {
    id: 'run-123456789',
    projectId: 'proj-1',
    mode: DesignMode.BINDER,
    designEngine: 'rfd3',
    status: DesignRunStatus.COMPLETED,
    parameters: { numDesigns: 4, diffusionSteps: 50 },
    constraintSpec: null,
    targetStructure: null,
    targetSequence: null,
    gpuId: null,
    startedAt: '2026-09-20T10:00:00.000Z',
    completedAt: '2026-09-20T10:05:00.000Z',
    failedReason: null,
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:05:00.000Z',
  };
}

function makeCandidate(overrides: Partial<DesignCandidate> = {}): DesignCandidate {
  return {
    id: 'cand-abc12345',
    runId: 'run-123456789',
    structure: null,
    sequence: 'MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYSAMRDQYMRTGEGFLCVFAINNTKSFEDIHHYREQIKRVKDSEDVPMVLVGNKCDLPSRTVDTKQAQDLARSYGIPYIETSAKTRQGVEDAFYTLVREIRQHKLRKLNPPDESGPGCMSCKCVIS',
    affinityScore: 0.82,
    rankedPosition: 1,
    designMetrics: { rfd3: { mock: true } },
    createdAt: '2026-09-20T10:05:00.000Z',
    validationResults: [],
    ledgerEntries: [],
    ...overrides,
  };
}

function makeLedgerEntry() {
  return {
    id: 'lid1',
    candidateId: 'cand-abc12345',
    projectId: 'proj-1',
    runId: 'run-123456789',
    modelVersion: 'rfd3-mock-v1.0.0',
    weightsHash: 'hash',
    seed: 42,
    userId: 'bu',
    timestamp: '2026-09-20T10:00:00.000Z',
    inputConstraints: null,
    validationMetrics: null,
  };
}

function makeValidation() {
  return {
    id: 'val-1',
    candidateId: 'cand-abc12345',
    pTM: 0.74,
    ipTM: 0.61,
    pLDDT: 68.2,
    interfaceArea: 420,
    constraintSatisfactionScore: 0.9,
    diversityScore: 0.5,
    overallScore: 0.71,
    details: null,
    createdAt: '2026-09-20T10:06:00.000Z',
  };
}

describe('DesignResultsViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and lists the run candidates with a ranked score', async () => {
    vi.mocked(designStudioService.listCandidates).mockResolvedValue([makeCandidate()]);
    render(<DesignResultsViewer run={makeRun()} onBackToList={vi.fn()} />);

    await screen.findByText('#1');
    expect(designStudioService.listCandidates).toHaveBeenCalledWith('run-123456789');
    expect(screen.getByText(/1 candidate · ranked by validation score/)).toBeInTheDocument();
  });

  it('surfaces the ledger entry count from candidates', async () => {
    vi.mocked(designStudioService.listCandidates).mockResolvedValue([
      makeCandidate({ ledgerEntries: [makeLedgerEntry()] }),
    ]);
    render(<DesignResultsViewer run={makeRun()} onBackToList={vi.fn()} />);

    expect(await screen.findByText('1 entries')).toBeInTheDocument();
  });

  it('expands the ledger viewer when the toggle is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(designStudioService.listCandidates).mockResolvedValue([makeCandidate()]);
    render(<DesignResultsViewer run={makeRun()} onBackToList={vi.fn()} />);

    await screen.findByText('0 entries');
    await user.click(screen.getByRole('button', { name: /Design ledger/i }));
    expect(screen.getByText('No ledger entries yet')).toBeInTheDocument();
  });

  it('runs validation and refreshes the candidate list', async () => {
    const user = userEvent.setup();
    const candidate = makeCandidate();
    vi.mocked(designStudioService.listCandidates)
      .mockResolvedValueOnce([candidate])
      .mockResolvedValueOnce([makeCandidate({ validationResults: [makeValidation()] })]);
    vi.mocked(designStudioService.validateCandidate).mockResolvedValue(makeValidation());

    render(<DesignResultsViewer run={makeRun()} onBackToList={vi.fn()} />);
    await screen.findByText('#1');

    await user.click(screen.getByRole('button', { name: /Validate/i }));
    expect(designStudioService.validateCandidate).toHaveBeenCalledWith(candidate.id);
    expect(await screen.findByText('Validation complete — metrics and ledger updated.')).toBeInTheDocument();
    expect(designStudioService.listCandidates).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getAllByText(/0\.74/).length).toBeGreaterThan(0));
  });

  it('shows an error banner when listing fails', async () => {
    vi.mocked(designStudioService.listCandidates).mockRejectedValue(new Error('gone'));
    render(<DesignResultsViewer run={makeRun()} onBackToList={vi.fn()} />);

    expect(await screen.findByText('Failed to load candidates.')).toBeInTheDocument();
    expect(screen.getByText('No candidates yet')).toBeInTheDocument();
  });

  it('calls onBackToList from the back button', async () => {
    const user = userEvent.setup();
    const onBackToList = vi.fn();
    vi.mocked(designStudioService.listCandidates).mockResolvedValue([]);
    render(<DesignResultsViewer run={makeRun()} onBackToList={onBackToList} />);

    await screen.findByText('No candidates yet');
    await user.click(screen.getByRole('button', { name: /Back to history/i }));
    expect(onBackToList).toHaveBeenCalled();
  });
});