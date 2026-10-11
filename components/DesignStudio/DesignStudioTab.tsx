import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Dna, FolderPlus, Link2, Wand2, Wind } from 'lucide-react';
import {
  DesignMode,
  DesignProject,
  DesignRun,
  DesignApiError,
  designStudioService,
} from '../../services/designStudioService';
import EmptyState from '../EmptyState';
import { BinderDesigner } from './BinderDesigner';
import { DnaBinderDesigner } from './DnaBinderDesigner';
import { EnzymeDesigner } from './EnzymeDesigner';
import { StabilizerDesigner } from './StabilizerDesigner';
import { DesignHistory } from './DesignHistory';
import { DesignResultsViewer } from './DesignResultsViewer';
import { DesignMetricsPanel } from './DesignMetricsPanel';
import { DesignAnalyticsPanel } from './DesignAnalyticsPanel';
import { MODE_LABELS, StudioSpinner } from './DesignStudioShared';

type StudioView = 'designer' | 'history' | 'analytics';

const MODE_ICONS: Record<DesignMode, React.ReactNode> = {
  [DesignMode.BINDER]: <Link2 size={14} />,
  [DesignMode.STABILIZER]: <Wind size={14} />,
  [DesignMode.DNA_BINDER]: <Dna size={14} />,
  [DesignMode.ENZYME_RESCUE]: <Activity size={14} />,
  [DesignMode.SCAFFOLD]: <Wand2 size={14} />,
  [DesignMode.SYMMETRIC_ASSEMBLY]: <Wand2 size={14} />,
  [DesignMode.MOTIF_SCAFFOLD]: <Wand2 size={14} />,
  [DesignMode.PROTEIN_SCAFFOLD]: <Wand2 size={14} />,
};

const ACTIVE_MODES = [
  DesignMode.BINDER,
  DesignMode.STABILIZER,
  DesignMode.DNA_BINDER,
  DesignMode.ENZYME_RESCUE,
];

/**
 * Design Studio — orchestrates projects, the four design modes, run history,
 * candidate results with validation metrics, and the analytics mini-dashboard.
 */
export default function DesignStudioTab() {
  const [projects, setProjects] = useState<DesignProject[] | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [view, setView] = useState<StudioView>('designer');
  const [mode, setMode] = useState<DesignMode>(DesignMode.BINDER);
  const [historyRefresh, setHistoryRefresh] = useState<string | null>(null);

  const [viewedRun, setViewedRun] = useState<DesignRun | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  // New project form
  const [showCreate, setShowCreate] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', targetGene: '', targetVariant: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setProjectError(null);
    try {
      setProjects(await designStudioService.listProjects());
    } catch (err) {
      setProjectError(err instanceof DesignApiError ? err.message : 'Failed to load projects.');
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (projects && projects.length > 0) {
      setSelectedProjectId(prevId => {
        if (prevId && projects.some(p => p.id === prevId)) return prevId;
        return projects[0].id;
      });
    }
  }, [projects]);

  const selectedProject = useMemo(
    () => projects?.find(p => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const refreshHistory = () => setHistoryRefresh(`r-${Date.now()}`);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!newProject.name.trim()) {
      setCreateError('Project name is required.');
      return;
    }
    setCreating(true);
    try {
      const project = await designStudioService.createProject({
        name: newProject.name.trim(),
        description: newProject.description.trim() || undefined,
        targetGene: newProject.targetGene.trim() || undefined,
        targetVariant: newProject.targetVariant.trim() || undefined,
      });
      await loadProjects();
      setSelectedProjectId(project.id);
      setShowCreate(false);
      setNewProject({ name: '', description: '', targetGene: '', targetVariant: '' });
    } catch (err) {
      setCreateError(err instanceof DesignApiError ? err.message : 'Failed to create project.');
    } finally {
      setCreating(false);
    }
  };

  const handleRunCreated = useCallback(() => {
    refreshHistory();
  }, []);

  const handleViewRun = (run: DesignRun) => {
    setViewedRun(run);
    setSelectedCandidateId(null);
    setView('history');
  };

  if (projects === null) return <StudioSpinner label="Loading design studio…" />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[--color-foreground]">Design Studio</h2>
          <p className="mt-1 text-sm text-[--color-foreground-secondary]">
            RFdiffusion3 conditioned on disease variants — binder, stabilizer, DNA-binder and enzyme-rescue design with full provenance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`ds-btn ${view === 'designer' ? 'ds-btn-primary' : 'ds-btn-ghost'}`}
            onClick={() => setView('designer')}
          >
            Designer
          </button>
          <button
            type="button"
            className={`ds-btn ${view === 'history' ? 'ds-btn-primary' : 'ds-btn-ghost'}`}
            onClick={() => setView('history')}
          >
            History
          </button>
          <button
            type="button"
            className={`ds-btn ${view === 'analytics' ? 'ds-btn-primary' : 'ds-btn-ghost'}`}
            onClick={() => setView('analytics')}
          >
            Analytics
          </button>
        </div>
      </header>

      {projectError && <p className="ds-status-banner border-[--color-destructive]/40 text-[--color-destructive]">{projectError}</p>}

      {/* Project selector */}
      <section aria-label="Project" className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-[--color-foreground-secondary]">
          <span className="text-xs uppercase tracking-widest">Project</span>
          <select
            className="ds-select"
            value={selectedProjectId}
            onChange={e => {
              setSelectedProjectId(e.target.value);
              setViewedRun(null);
              setSelectedCandidateId(null);
              setView('designer');
            }}
            disabled={!projects || projects.length === 0}
          >
            {projects && projects.length === 0 && <option value="">No projects</option>}
            {projects?.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.targetGene ? ` · ${p.targetGene}` : ''}
                {p.targetVariant ? ` ${p.targetVariant}` : ''}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="ds-btn ds-btn-secondary" onClick={() => setShowCreate(v => !v)}>
          <FolderPlus size={14} /> New project
        </button>

        {selectedProject && (
          <span className="ml-auto font-mono text-xs text-[--color-foreground-tertiary]">{selectedProject.id.slice(0, 10)}…</span>
        )}
      </section>

      {/* New project form */}
      {showCreate && (
        <form onSubmit={handleCreateProject} className="ds-card space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-widest text-[--color-foreground-secondary]">
                Name <span className="text-[--color-destructive]">*</span>
              </span>
              <input
                type="text"
                value={newProject.name}
                onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))}
                placeholder="SOD1 ALS stabilizer"
                className="w-full rounded-lg border border-[--color-border] bg-[#0A1124] px-3 py-2 text-sm text-[--color-foreground] placeholder:text-[--color-foreground-tertiary] focus:border-[--color-primary] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-widest text-[--color-foreground-secondary]">Target gene</span>
              <input
                type="text"
                value={newProject.targetGene}
                onChange={e => setNewProject(p => ({ ...p, targetGene: e.target.value }))}
                placeholder="SOD1"
                className="w-full rounded-lg border border-[--color-border] bg-[#0A1124] px-3 py-2 text-sm text-[--color-foreground] placeholder:text-[--color-foreground-tertiary] focus:border-[--color-primary] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-widest text-[--color-foreground-secondary]">
              Target variant (HGVS)
            </span>
            <input
              type="text"
              value={newProject.targetVariant}
              onChange={e => setNewProject(p => ({ ...p, targetVariant: e.target.value }))}
              placeholder="p.L144F"
              className="w-full rounded-lg border border-[--color-border] bg-[#0A1124] px-3 py-2 font-mono text-sm text-[--color-foreground] placeholder:text-[--color-foreground-tertiary] focus:border-[--color-primary] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-widest text-[--color-foreground-secondary]">Description</span>
            <textarea
              value={newProject.description}
              onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))}
              rows={2}
              placeholder="Optional context for this design campaign…"
              className="w-full rounded-lg border border-[--color-border] bg-[#0A1124] px-3 py-2 text-sm text-[--color-foreground] placeholder:text-[--color-foreground-tertiary] focus:border-[--color-primary] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20"
            />
          </label>
          {createError && <p className="ds-status-banner border-[--color-destructive]/40 text-[--color-destructive]">{createError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="ds-btn ds-btn-ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button type="submit" className="ds-btn ds-btn-primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      )}

      {!selectedProject && projects && projects.length === 0 && (
        <EmptyState
          icon={FolderPlus}
          headline="No design projects yet"
          subtext="Create a project to start designing binders, stabilizers, DNA binders, or enzyme rescues."
          action={{
            label: 'Create your first project',
            onClick: () => setShowCreate(true),
            icon: FolderPlus,
          }}
        />
      )}

      {selectedProject && view === 'designer' && (
        <section aria-label="Mode selector" className="flex flex-wrap gap-2">
          {ACTIVE_MODES.map(m => (
            <button
              key={m}
              type="button"
              className={`ds-chip ${mode === m ? 'border-[--color-primary] bg-[--color-primary-dim] text-[--color-primary]' : ''}`}
              onClick={() => setMode(m)}
            >
              {MODE_ICONS[m]}
              <span className="ml-1">{MODE_LABELS[m]}</span>
            </button>
          ))}
        </section>
      )}

      <main className="space-y-8">
        {!selectedProject ? null : view === 'designer' ? (
          <>
            {mode === DesignMode.BINDER && <BinderDesigner projectId={selectedProject.id} onRunCreated={handleRunCreated} />}
            {mode === DesignMode.STABILIZER && <StabilizerDesigner projectId={selectedProject.id} onRunCreated={handleRunCreated} />}
            {mode === DesignMode.DNA_BINDER && <DnaBinderDesigner projectId={selectedProject.id} onRunCreated={handleRunCreated} />}
            {mode === DesignMode.ENZYME_RESCUE && <EnzymeDesigner projectId={selectedProject.id} onRunCreated={handleRunCreated} />}

            <section aria-label="Running designs" className="ds-card p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-[--color-foreground]">Running designs</h4>
                <button
                  type="button"
                  className="ds-btn ds-btn-ghost text-xs"
                  onClick={() => {
                    refreshHistory();
                    setView('history');
                  }}
                >
                  View all history →
                </button>
              </div>
              <DesignHistory projectId={selectedProject.id} refreshKey={historyRefresh} onViewRun={handleViewRun} />
            </section>
          </>
        ) : view === 'history' ? (
          <section aria-label="Design history" className="ds-card p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-[--color-foreground]">Design history</h4>
              <button type="button" className="ds-btn ds-btn-ghost text-xs" onClick={refreshHistory}>
                Refresh
              </button>
            </div>

            {viewedRun ? (
              <div className="space-y-6">
                <DesignResultsViewer
                  run={viewedRun}
                  onBackToList={() => setViewedRun(null)}
                  onSelectCandidate={setSelectedCandidateId}
                />
              </div>
            ) : (
              <DesignHistory projectId={selectedProject.id} refreshKey={historyRefresh} onViewRun={handleViewRun} />
            )}
          </section>
        ) : (
          <section aria-label="Analytics" className="ds-card p-5">
            <h4 className="mb-4 text-sm font-bold text-[--color-foreground]">Design analytics</h4>
            <DesignAnalyticsPanel />
          </section>
        )}
      </main>
    </div>
  );
}