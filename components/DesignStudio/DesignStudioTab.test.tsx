import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DesignStudioTab from './DesignStudioTab';
import { DesignMode, designStudioService } from '../../services/designStudioService';

vi.mock('../../services/designStudioService', async () => {
  const actual = await vi.importActual<typeof import('../../services/designStudioService')>('../../services/designStudioService');
  return {
    ...actual,
    designStudioService: {
      ...actual.designStudioService,
      listProjects: vi.fn(),
      createProject: vi.fn(),
    },
  };
});

vi.mock('./BinderDesigner', () => ({
  BinderDesigner: ({ projectId }: { projectId: string }) => <div data-testid="binder-designer">Binder {projectId}</div>,
}));
vi.mock('./StabilizerDesigner', () => ({
  StabilizerDesigner: ({ projectId }: { projectId: string }) => <div data-testid="stabilizer-designer">Stabilizer {projectId}</div>,
}));
vi.mock('./DnaBinderDesigner', () => ({
  DnaBinderDesigner: ({ projectId }: { projectId: string }) => <div data-testid="dna-designer">DNA {projectId}</div>,
}));
vi.mock('./EnzymeDesigner', () => ({
  EnzymeDesigner: ({ projectId }: { projectId: string }) => <div data-testid="enzyme-designer">Enzyme {projectId}</div>,
}));
vi.mock('./DesignHistory', () => ({
  DesignHistory: () => <div data-testid="design-history">history</div>,
}));
vi.mock('./DesignResultsViewer', () => ({
  DesignResultsViewer: () => <div data-testid="design-results">results</div>,
}));
vi.mock('./DesignAnalyticsPanel', () => ({
  DesignAnalyticsPanel: () => <div data-testid="analytics">analytics</div>,
}));

function makeProjects() {
  return [
    {
      id: 'proj-1',
      name: 'ALS stabilizer',
      description: 'x',
      userId: 'u1',
      targetGene: 'SOD1',
      targetVariant: 'p.L144F',
      status: 'ACTIVE' as const,
      createdAt: '2026-09-20T10:00:00.000Z',
      updatedAt: '2026-09-20T10:00:00.000Z',
    },
    {
      id: 'proj-2',
      name: 'Oncogene binders',
      description: 'y',
      userId: 'u1',
      targetGene: 'KRAS',
      targetVariant: 'p.G12D',
      status: 'ACTIVE' as const,
      createdAt: '2026-09-20T10:00:00.000Z',
      updatedAt: '2026-09-20T10:00:00.000Z',
    },
  ];
}

describe('DesignStudioTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a spinner while projects load', () => {
    vi.mocked(designStudioService.listProjects).mockReturnValue(new Promise(() => {}));
    render(<DesignStudioTab />);
    expect(screen.getByText('Loading design studio…')).toBeInTheDocument();
  });

  it('auto-selects the first project and renders the binder designer', async () => {
    vi.mocked(designStudioService.listProjects).mockResolvedValue(makeProjects());
    render(<DesignStudioTab />);

    expect(await screen.findByTestId('binder-designer')).toHaveTextContent('Binder proj-1');
  });

  it('switches modes via chip buttons', async () => {
    const user = userEvent.setup();
    vi.mocked(designStudioService.listProjects).mockResolvedValue(makeProjects());
    render(<DesignStudioTab />);

    await screen.findByTestId('binder-designer');
    await user.click(screen.getByRole('button', { name: /Stabilizer Design/i }));
    expect(screen.getByTestId('stabilizer-designer')).toHaveTextContent('Stabilizer proj-1');
    await user.click(screen.getByRole('button', { name: /DNA Binder Design/i }));
    expect(screen.getByTestId('dna-designer')).toHaveTextContent('DNA proj-1');
    await user.click(screen.getByRole('button', { name: /Enzyme Rescue Design/i }));
    expect(screen.getByTestId('enzyme-designer')).toHaveTextContent('Enzyme proj-1');
  });

  it('switches between designer, history and analytics views', async () => {
    const user = userEvent.setup();
    vi.mocked(designStudioService.listProjects).mockResolvedValue(makeProjects());
    render(<DesignStudioTab />);

    await screen.findByTestId('binder-designer');
    await user.click(screen.getByRole('button', { name: 'History' }));
    expect(screen.getByTestId('design-history')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Analytics' }));
    expect(screen.getByTestId('analytics')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Designer' }));
    expect(screen.getByTestId('binder-designer')).toBeInTheDocument();
  });

  it('creates a project and selects it', async () => {
    const user = userEvent.setup();
    const newProject = {
      id: 'proj-3',
      name: 'CFTR rescue',
      description: null,
      userId: 'u1',
      targetGene: 'CFTR',
      targetVariant: 'p.F508del',
      status: 'ACTIVE' as const,
      createdAt: '2026-09-20T10:00:00.000Z',
      updatedAt: '2026-09-20T10:00:00.000Z',
    };
    vi.mocked(designStudioService.listProjects).mockResolvedValueOnce(makeProjects());
    vi.mocked(designStudioService.listProjects).mockResolvedValue([...makeProjects(), newProject]);
    vi.mocked(designStudioService.createProject).mockResolvedValue(newProject);
    render(<DesignStudioTab />);

    await screen.findByTestId('binder-designer');
    await user.click(screen.getByRole('button', { name: /New project/i }));

    await user.type(screen.getByLabelText(/Name/i), 'CFTR rescue');
    await user.type(screen.getByLabelText(/Target gene/i), 'CFTR');
    await user.type(screen.getByLabelText(/Target variant/i), 'p.F508del');
    await user.click(screen.getByRole('button', { name: /Create project/i }));

    expect(designStudioService.createProject).toHaveBeenCalledWith({
      name: 'CFTR rescue',
      description: undefined,
      targetGene: 'CFTR',
      targetVariant: 'p.F508del',
    });
    const select = (await screen.findByRole('combobox', { name: /Project/i })) as HTMLSelectElement;
    expect(select.value).toBe('proj-3');
    expect(screen.getByText('CFTR rescue · CFTR p.F508del')).toBeInTheDocument();
  });

  it('shows the empty state when no projects exist', async () => {
    const user = userEvent.setup();
    vi.mocked(designStudioService.listProjects).mockResolvedValue([]);
    render(<DesignStudioTab />);

    expect(await screen.findByText('No design projects yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Create your first project/i }));
    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
  });

  it('shows the load error banner when listing projects fails', async () => {
    vi.mocked(designStudioService.listProjects).mockRejectedValue(new Error('Design request failed (500)'));
    render(<DesignStudioTab />);

    expect(await screen.findByText('Failed to load projects.')).toBeInTheDocument();
  });
});