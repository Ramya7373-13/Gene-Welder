import React from 'react';
import { Fingerprint, Globe, Scale } from 'lucide-react';
import { DesignCandidate } from '../../services/designStudioService';
import EmptyState from '../EmptyState';
import { StudioSpinner } from './DesignStudioShared';

interface DesignMetricsPanelProps {
  candidate: DesignCandidate;
  loading?: boolean;
}

/**
 * Design Metrics — validation metrics for one candidate plus its provenance
 * (Design Ledger) record: model version, weights hash, seed, user, timestamp,
 * input constraints and validation metrics as recorded for reproducibility.
 */
export const DesignMetricsPanel: React.FC<DesignMetricsPanelProps> = ({ candidate, loading }) => {
  if (loading) return <StudioSpinner label="Loading validation metrics…" />;

  const validation = candidate.validationResults?.[0];
  const ledger = candidate.ledgerEntries?.[0];

  if (!validation && !ledger) {
    return (
      <EmptyState
        icon={Scale}
        headline="Not validated yet"
        subtext="Run validation on this candidate to see pTM/ipTM/pLDDT scores and the provenance record."
        size="compact"
      />
    );
  }

  const scoreBars: { label: string; value: number | null | undefined; max: number }[] = [
    { label: 'pTM', value: validation?.pTM, max: 1 },
    { label: 'ipTM', value: validation?.ipTM, max: 1 },
    { label: 'pLDDT', value: validation?.pLDDT, max: 100 },
    { label: 'Interface area (Å²)', value: validation?.interfaceArea, max: 5000 },
    { label: 'Constraint satisfaction', value: validation?.constraintSatisfactionScore, max: 1 },
    { label: 'Diversity', value: validation?.diversityScore, max: 1 },
    { label: 'Overall score', value: validation?.overallScore, max: 1 },
  ];

  return (
    <div className="space-y-5">
      <section aria-label="Validation metrics">
        <h5 className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-widest text-[--color-foreground-secondary]">
          <Scale size={12} /> Validation Metrics
        </h5>
        <div className="space-y-2.5">
          {scoreBars.map(({ label, value, max }) => {
            const pct = typeof value === 'number' ? Math.min(100, (value / max) * 100) : 0;
            return (
              <div key={label}>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="text-[--color-foreground-secondary]">{label}</span>
                  <span className="font-mono text-[--color-foreground]">{typeof value === 'number' ? value.toFixed(3) : '—'}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[--color-border-subtle]" role="presentation">
                  <div
                    className="h-full rounded-full bg-[--color-primary] transition-all"
                    style={{ width: `${pct}%`, opacity: typeof value === 'number' ? 1 : 0.2 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {ledger && (
        <section aria-label="Design ledger provenance">
          <h5 className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-widest text-[--color-foreground-secondary]">
            <Fingerprint size={12} /> Design Ledger — Provenance
          </h5>
          <dl className="grid gap-x-4 gap-y-2 rounded-lg border border-[--color-border-subtle] bg-[--color-muted-deep] p-3 text-xs sm:grid-cols-2">
            <div className="flex justify-between gap-2">
              <dt className="text-[--color-foreground-tertiary]">Model version</dt>
              <dd className="font-mono text-[--color-foreground]">{ledger.modelVersion}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[--color-foreground-tertiary]">Seed</dt>
              <dd className="font-mono text-[--color-foreground]">{ledger.seed}</dd>
            </div>
            <div className="flex justify-between gap-2 sm:col-span-2">
              <dt className="flex items-center gap-1 text-[--color-foreground-tertiary]">
                <Globe size={11} /> Weights hash
              </dt>
              <dd className="max-w-[70%] truncate font-mono text-[--color-foreground]" title={ledger.weightsHash}>
                {ledger.weightsHash}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[--color-foreground-tertiary]">User</dt>
              <dd className="truncate font-mono text-[--color-foreground]">{ledger.userId.slice(0, 12)}…</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[--color-foreground-tertiary]">Recorded</dt>
              <dd className="font-mono text-[--color-foreground]">{new Date(ledger.timestamp).toLocaleString()}</dd>
            </div>
          </dl>

          {ledger.inputConstraints && (
            <details className="mt-3 rounded-lg border border-[--color-border-subtle] bg-[--color-muted-deep] p-3">
              <summary className="cursor-pointer text-xs uppercase tracking-widest text-[--color-foreground-secondary]">
                Input constraints
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto overflow-x-auto whitespace-pre-wrap rounded bg-[#0A1124] p-2 font-mono text-[11px] text-[--color-foreground-secondary]">
                {JSON.stringify(ledger.inputConstraints, null, 2)}
              </pre>
            </details>
          )}
        </section>
      )}

      {candidate.designMetrics && Object.keys(candidate.designMetrics).length > 0 && (
        <section aria-label="Design metrics">
          <h5 className="mb-2 text-xs uppercase tracking-widest text-[--color-foreground-secondary]">Design metrics</h5>
          <pre className="max-h-40 overflow-auto overflow-x-auto whitespace-pre-wrap rounded-lg border border-[--color-border-subtle] bg-[#0A1124] p-3 font-mono text-[11px] text-[--color-foreground-secondary]">
            {JSON.stringify(candidate.designMetrics, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
};