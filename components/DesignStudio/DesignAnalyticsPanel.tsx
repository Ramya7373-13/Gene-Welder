import React, { useEffect, useState } from 'react';
import { Activity, Boxes, CheckCircle2, Disc, FolderKanban, Play, TrendingUp } from 'lucide-react';
import { AnalyticsData, designStudioService, DesignApiError } from '../../services/designStudioService';
import EmptyState from '../EmptyState';
import { MODE_LABELS, StudioSpinner } from './DesignStudioShared';
import { DesignRunStatus } from '../../services/designStudioService';

interface DesignAnalyticsPanelProps {
  onError?: (message: string) => void;
}

const STAT_CARDS: { key: keyof Pick<AnalyticsData, 'totalProjects' | 'totalRuns' | 'totalCandidates'>; label: string; icon: React.ReactNode }[] = [
  { key: 'totalProjects', label: 'Projects', icon: <FolderKanban size={15} /> },
  { key: 'totalRuns', label: 'Runs', icon: <Play size={15} /> },
  { key: 'totalCandidates', label: 'Candidates', icon: <Boxes size={15} /> },
];

function fmtMs(ms: number): string {
  if (!isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = s / 60;
  if (m < 60) return `${m.toFixed(1)} min`;
  const h = m / 60;
  return `${h.toFixed(1)} h`;
}

/** Simple horizontal bar, width as a fraction of the max value in the bucket. */
function BarRow({ label, value, max, suffix }: { label: string; value: number; max: number; suffix?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="grid grid-cols-[1fr_2.5rem] items-center gap-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate text-[--color-foreground-secondary]">{label}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[--color-border-subtle]">
          <div className="h-full rounded-full bg-[--color-primary]" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-right font-mono text-[--color-foreground]">
        {value}
        {suffix ?? ''}
      </span>
    </div>
  );
}

/**
 * Design Studio Analytics mini-dashboard — aggregates the user's design activity:
 * project/run/candidate counts, validation score distribution, generation success
 * rate, runtime statistics, top genes and variants, and recent runs.
 */
export const DesignAnalyticsPanel: React.FC<DesignAnalyticsPanelProps> = ({ onError }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<{ id: string; mode: string; status: DesignRunStatus; createdAt: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const analytics = await designStudioService.getAnalytics();
        if (cancelled) return;
        setData(analytics);

        const all = await designStudioService.listRuns();
        if (cancelled) return;
        setRuns(
          all
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 8)
            .map(r => ({ id: r.id, mode: r.mode, status: r.status, createdAt: r.createdAt })),
        );
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof DesignApiError ? err.message : 'Failed to load analytics.';
        setError(message);
        onError?.(message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error && !data) {
    return (
      <EmptyState
        icon={TrendingUp}
        headline="Analytics unavailable"
        subtext={error}
      />
    );
  }

  if (!data) return <StudioSpinner label="Loading analytics…" />;

  const maxScoreBucket = Math.max(1, ...data.validationScoreDistribution.map(d => d.count));
  const maxGene = Math.max(1, ...data.topGenes.map(g => g.count));
  const maxVariant = Math.max(1, ...data.commonVariants.map(v => v.count));
  const avgDuration =
    data.runDurations.length > 0 ? data.runDurations.reduce((a, b) => a + b, 0) / data.runDurations.length : Number.NaN;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STAT_CARDS.map(card => (
          <div key={card.key} className="ds-card p-4">
            <div className="flex items-center justify-between text-[--color-foreground-secondary]">
              <span className="text-xs uppercase tracking-widest">{card.label}</span>
              {card.icon}
            </div>
            <p className="mt-2 text-2xl font-bold text-[--color-foreground]">{data[card.key]}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="ds-card p-4" aria-label="Validation scores">
          <h4 className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-widest text-[--color-foreground-secondary]">
            <TrendingUp size={12} /> Validation score distribution
          </h4>
          <div className="space-y-1.5">
            {data.validationScoreDistribution.length === 0 ? (
              <p className="text-xs text-[--color-foreground-tertiary]">No validated candidates yet.</p>
            ) : (
              data.validationScoreDistribution.map(d => (
                <BarRow key={d.score} label={`${Math.round(d.score * 10) * 10}%`} value={d.count} max={maxScoreBucket} />
              ))
            )}
          </div>
        </section>

        <section className="ds-card p-4" aria-label="Generation success">
          <h4 className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-widest text-[--color-foreground-secondary]">
            <CheckCircle2 size={12} /> Generation success rate
          </h4>
          <div className="flex items-center gap-4">
            <p className="text-3xl font-bold text-[--color-foreground]">{Math.round(data.successRate * 100)}%</p>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[--color-border-subtle]">
              <div
                className="h-full rounded-full bg-[--color-success]"
                style={{ width: `${Math.round(data.successRate * 100)}%` }}
              />
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md border border-[--color-border-subtle] p-2">
              <dt className="text-[--color-foreground-tertiary]">Avg validation score</dt>
              <dd className="mt-0.5 font-mono text-sm text-[--color-foreground]">
                {data.averageValidationScore > 0 ? data.averageValidationScore.toFixed(3) : '—'}
              </dd>
            </div>
            <div className="rounded-md border border-[--color-border-subtle] p-2">
              <dt className="text-[--color-foreground-tertiary]">Avg runtime</dt>
              <dd className="mt-0.5 font-mono text-sm text-[--color-foreground]">{fmtMs(avgDuration)}</dd>
            </div>
          </dl>
        </section>

        <section className="ds-card p-4" aria-label="Top genes and variants">
          <h4 className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-widest text-[--color-foreground-secondary]">
            <Activity size={12} /> Top genes
          </h4>
          <div className="space-y-1.5">
            {data.topGenes.length === 0 ? (
              <p className="text-xs text-[--color-foreground-tertiary]">No targets recorded yet.</p>
            ) : (
              data.topGenes.map(g => <BarRow key={g.gene} label={g.gene} value={g.count} max={maxGene} suffix="×" />)
            )}
          </div>
        </section>

        <section className="ds-card p-4" aria-label="Common variants">
          <h4 className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-widest text-[--color-foreground-secondary]">
            <Disc size={12} /> Common variants
          </h4>
          <div className="space-y-1.5">
            {data.commonVariants.length === 0 ? (
              <p className="text-xs text-[--color-foreground-tertiary]">No variants recorded yet.</p>
            ) : (
              data.commonVariants.map(v => <BarRow key={v.variant} label={v.variant} value={v.count} max={maxVariant} suffix="×" />)
            )}
          </div>
        </section>
      </div>

      {runs.length > 0 && (
        <section className="ds-card p-4" aria-label="Recent runs">
          <h4 className="mb-3 text-xs uppercase tracking-widest text-[--color-foreground-secondary]">Recent runs</h4>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {runs.map(r => (
              <li key={r.id} className="rounded-md border border-[--color-border-subtle] p-2 text-xs">
                <p className="truncate font-semibold text-[--color-foreground]">{MODE_LABELS[r.mode as keyof typeof MODE_LABELS] ?? r.mode}</p>
                <p className="mt-0.5 font-mono text-[10px] text-[--color-foreground-tertiary]">{r.id.slice(0, 8)}</p>
                <p className="mt-1 text-[10px] text-[--color-foreground-secondary]">{new Date(r.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};