import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  DesignLedgerViewer,
  LedgerReproducibilityDetails,
} from './DesignLedgerViewer';
import { DesignLedgerEntry } from '../../services/designStudioService';

function makeEntry(overrides: Partial<DesignLedgerEntry> = {}): DesignLedgerEntry {
  return {
    id: 'ledger-1',
    candidateId: 'cand-1',
    projectId: 'proj-1',
    runId: 'run-1',
    modelVersion: 'rfd3-mock-v1.0.0',
    weightsHash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
    seed: 42,
    userId: 'designer-user',
    timestamp: '2026-09-20T10:00:00.000Z',
    inputConstraints: { hotspot: [{ chain: 'A', position: 12 }] },
    validationMetrics: { pTM: 0.74, ipTM: 0.61 },
    ...overrides,
  };
}

describe('DesignLedgerViewer', () => {
  it('shows a loading state with a screen-reader status', () => {
    render(<DesignLedgerViewer entries={[]} loading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading ledger…')).toBeInTheDocument();
  });

  it('renders the empty state when there are no entries', () => {
    render(<DesignLedgerViewer entries={[]} />);
    expect(screen.getByText('No ledger entries yet')).toBeInTheDocument();
  });

  it('renders one row per ledger entry with model, seed and validation marker', () => {
    render(<DesignLedgerViewer entries={[makeEntry(), makeEntry({ id: 'ledger-2', seed: 7 })]} />);
    expect(screen.getAllByText('rfd3-mock-v1.0.0')).toHaveLength(2);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getAllByText('recorded')).toHaveLength(2);
  });

  it('shows "—" for entries without recorded validation metrics', () => {
    render(<DesignLedgerViewer entries={[makeEntry({ validationMetrics: {} })]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('invokes onReproduce with the clicked entry when metrics are recorded', async () => {
    const user = userEvent.setup();
    const onReproduce = vi.fn();
    const entry = makeEntry();
    render(<DesignLedgerViewer entries={[entry]} onReproduce={onReproduce} />);

    await user.click(screen.getByRole('button', { name: /Reproduce/i }));
    expect(onReproduce).toHaveBeenCalledWith(entry);
  });

  it('does not render a reproduce action for entries without metrics', () => {
    render(<DesignLedgerViewer entries={[makeEntry({ validationMetrics: {} })]} onReproduce={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Reproduce/i })).not.toBeInTheDocument();
  });
});

describe('LedgerReproducibilityDetails', () => {
  it('shows the frozen metadata fields', () => {
    render(<LedgerReproducibilityDetails entry={makeEntry()} />);
    expect(screen.getByText('Reproducibility metadata')).toBeInTheDocument();
    expect(screen.getByText('rfd3-mock-v1.0.0')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('designer-user')).toBeInTheDocument();
    expect(screen.getByText('Input constraints')).toBeInTheDocument();
    expect(screen.getByText('Validation metrics')).toBeInTheDocument();
  });

  it('omits the validation-metrics section when there are none', () => {
    render(<LedgerReproducibilityDetails entry={makeEntry({ validationMetrics: {} })} />);
    expect(screen.queryByText('Validation metrics')).not.toBeInTheDocument();
    expect(screen.getByText('Input constraints')).toBeInTheDocument();
  });
});