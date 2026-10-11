import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BinderDesigner } from './BinderDesigner';
import { DesignMode, DesignRunStatus, designStudioService } from '../../services/designStudioService';

vi.mock('../../services/designStudioService', async () => {
  const actual = await vi.importActual<typeof import('../../services/designStudioService')>('../../services/designStudioService');
  return {
    ...actual,
    designStudioService: {
      ...actual.designStudioService,
      createRun: vi.fn(),
    },
  };
});

const PDB = ['ATOM      1  N   ALA A   1       1.234   5.678   9.012  1.00 20.00           N', 'ATOM      2  CA  ALA A   1       2.345   6.789   0.123  1.00 20.00           C'].join('\n');

const STRUCTURE_INPUT = () => screen.getByPlaceholderText(/^ATOM/);
const VARIANT_SEARCH = () => screen.getByPlaceholderText('Search gene, variant, or disease…');

function makeRun() {
  return {
    id: 'run-abc12345',
    projectId: 'proj-1',
    mode: DesignMode.BINDER,
    designEngine: 'rfd3',
    status: DesignRunStatus.QUEUED,
    parameters: { numDesigns: 8, diffusionSteps: 50 },
    constraintSpec: null,
    targetStructure: PDB,
    targetSequence: null,
    gpuId: null,
    startedAt: null,
    completedAt: null,
    failedReason: null,
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
  };
}

describe('BinderDesigner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables the launch button until a target structure is provided', () => {
    render(<BinderDesigner projectId="proj-1" onRunCreated={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Launch RFD3 Run/i })).toBeDisabled();
  });

  it(
    'builds a BINDER run payload with structure, chain, variant and parameters',
    async () => {
      const user = userEvent.setup();
      const onRunCreated = vi.fn();
      vi.mocked(designStudioService.createRun).mockResolvedValue(makeRun());

      render(<BinderDesigner projectId="proj-1" onRunCreated={onRunCreated} />);

      await user.type(STRUCTURE_INPUT(), PDB);
      await user.type(VARIANT_SEARCH(), 'KRAS');
      await user.click(screen.getByRole('button', { name: /KRAS/i }));

      await user.clear(screen.getByLabelText('Num designs'));
      await user.type(screen.getByLabelText('Num designs'), '8');

      await user.click(screen.getByRole('button', { name: /Launch RFD3 Run/i }));

      expect(designStudioService.createRun).toHaveBeenCalledWith({
        projectId: 'proj-1',
        mode: DesignMode.BINDER,
        parameters: expect.objectContaining({ numDesigns: 8, diffusionSteps: 50 }),
        targetStructure: PDB,
        chainId: 'A',
        variant: 'p.G12D',
        constraints: [],
      });
      expect(
        onRunCreated,
      ).toHaveBeenCalledWith(expect.objectContaining({ id: 'run-abc12345', status: DesignRunStatus.QUEUED }));
      expect(await screen.findByText(/enqueued/, {}, { timeout: 5000 })).toBeInTheDocument();
    },
    15000,
  );

  it('surfaces a validation error for non-PDB structure text', async () => {
    const user = userEvent.setup();
    render(<BinderDesigner projectId="proj-1" onRunCreated={vi.fn()} />);

    await user.type(STRUCTURE_INPUT(), 'not a pdb');
    await user.click(screen.getByRole('button', { name: /Launch RFD3 Run/i }));

    expect(screen.getByText('Target structure must be PDB text (begins with "ATOM").')).toBeInTheDocument();
    expect(designStudioService.createRun).not.toHaveBeenCalled();
  });

  it(
    'shows the service error message when the run fails',
    async () => {
      const user = userEvent.setup();
      vi.mocked(designStudioService.createRun).mockRejectedValue(
        new Error('Design request failed (500)'),
      );
      render(<BinderDesigner projectId="proj-1" onRunCreated={vi.fn()} />);

      await user.type(STRUCTURE_INPUT(), PDB);
      await user.click(screen.getByRole('button', { name: /Launch RFD3 Run/i }));

      expect(
        await screen.findByText('Failed to launch design run.', {}, { timeout: 5000 }),
      ).toBeInTheDocument();
    },
    15000,
  );
});