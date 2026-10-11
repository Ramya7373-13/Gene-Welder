import React, { useEffect, useState } from 'react';
import { Eye, RotateCcw, XCircle } from 'lucide-react';
import {
  DesignRun,
  DesignRunStatus,
  designStudioService,
  DesignApiError,
} from '../../services/designStudioService';
import EmptyState from '../EmptyState';
import { MODE_LABELS, RunStatusBadge, StudioSpinner } from './DesignStudioShared';

interface DesignHistoryProps {
  projectId: string;
  /** Set to a run id to force a refresh (e.g. after launch); cleared afterwards. */
  refreshKey: string | null;
  onViewRun: (run: DesignRun) => void;
}

/**
 * Design History — every run for the selected project with live status badges,
 * cancel for queued/running jobs, and a "view results" entry point for
 * completed runs.
 */
export const DesignHistory: React.FC<DesignHistoryProps> = ({ projectId, refreshKey, onViewRun }) => {
  const [runs, setRuns] = useState<DesignRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setRuns(await designStudioService.listRuns(projectId));
    } catch (err) {
      setError(err instanceof DesignApiError ? err.message : 'Failed to load design history.');
      setRuns([]);
    }
  };

  useEffect(() => {
    setRuns(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (refreshKey) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleCancel = async (run: DesignRun) => {
    if (!window.confirm(`Cancel run ${run.id.slice(0, 8)}?`)) return;
    try {
      await designStudioService.cancelRun(run.id);
      await load();
    } catch (err) {
      setError(err instanceof DesignApiError ? err.message : 'Failed to cancel run.');
    }
  };

  const handleRestart = async (run: DesignRun) => {
    try {
      await designStudioService.updateRunStatus(run.id, { status: DesignRunStatus.QUEUED });
      await load();
    } catch (err) {
      setError(err instanceof DesignApiError ? err.message : 'Failed to requeue run.');
    }
  };

  if (!runs) return <StudioSpinner label="Loading design history…" />;

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={RotateCcw}
        headline="No design runs yet"
        subtext="Launch a design from any mode and it will appear here with live status."
      />
    );
  }

  const active = runs.filter(r => [DesignRunStatus.QUEUED, DesignRunStatus.RUNNING, DesignRunStatus.VALIDATING].includes(r.status));
  const finished = runs.filter(r => !active.includes(r));

  return (
    <div className="space-y-6">
      {error && <p className="ds-status-banner border-[--color-destructive]/40 text-[--color-destructive]">{error}</p>}

      {active.length > 0 && (
        <section aria-label="Running designs">
          <h4 className="mb-2 text-xs uppercase tracking-widest text-[--color-foreground-secondary]">In progress</h4>
          <ul className="space-y-2">
            {active.map(run => (
              <li key={run.id} className="ds-card ds-card-interactive flex flex-wrap items-center gap-3 p-4">
                <RunStatusBadge status={run.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[--color-foreground]">{MODE_LABELS[run.mode]}</p>
                  <p className="text-xs text-[--color-foreground-secondary]">
                    <span className="font-mono">{run.id.slice(0, 8)}</span>
                    {' · '}
                    {new Date(run.createdAt).toLocaleString()}
                    {run.failedReason ? ` · ${run.failedReason}` : ''}
                  </p>
                </div>
                <button type="button" className="ds-btn ds-btn-secondary" onClick={() => handleCancel(run)}>
                  <XCircle size={14} /> Cancel
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {finished.length > 0 && (
        <section aria-label="Completed designs">
          <h4 className="mb-2 text-xs uppercase tracking-widest text-[--color-foreground-secondary]">Completed</h4>
          <ul className="space-y-2">
            {finished.map(run => (
              <li key={run.id} className="ds-card flex flex-wrap items-center gap-3 p-4">
                <RunStatusBadge status={run.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[--color-foreground]">{MODE_LABELS[run.mode]}</p>
                  <p className="text-xs text-[--color-foreground-secondary]">
                    <span className="font-mono">{run.id.slice(0, 8)}</span>
                    {' · '}
                    {new Date(run.createdAt).toLocaleString()}
                    {run.completedAt ? ` · ${new Date(run.completedAt).toLocaleString()}` : ''}
                  </p>
                </div>
                {run.status === DesignRunStatus.COMPLETED && (
                  <button type="button" className="ds-btn ds-btn-secondary" onClick={() => onViewRun(run)}>
                    <Eye size={14} /> View results
                  </button>
                )}
                {run.status === DesignRunStatus.FAILED && (
                  <button type="button" className="ds-btn ds-btn-ghost" onClick={() => handleRestart(run)}>
                    <RotateCcw size={14} /> Requeue
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};