import React from 'react';
import { BookLock, Fingerprint, RefreshCw } from 'lucide-react';
import { DesignLedgerEntry } from '../../services/designStudioService';
import EmptyState from '../EmptyState';

interface DesignLedgerViewerProps {
  entries: DesignLedgerEntry[];
  loading?: boolean;
  onReproduce?: (entry: DesignLedgerEntry) => void;
}

/**
 * Design Ledger Viewer — read-only, per-entry view of the immutable provenance
 * record. Each entry corresponds to one DesignCandidate and carries everything
 * needed for exact reproduction: model version, weights hash, seed, user, time,
 * input constraints, validation metrics and reproducibility metadata.
 */
export const DesignLedgerViewer: React.FC<DesignLedgerViewerProps> = ({ entries, loading, onReproduce }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10" role="status" aria-live="polite">
        <span className="sr-only">Loading ledger…</span>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[--color-border] border-t-[--color-primary]" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={BookLock}
        headline="No ledger entries yet"
        subtext="Every generated candidate writes an immutable DesignLedger record for reproducibility."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[--color-border-subtle]">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[--color-border-subtle] bg-[--color-muted-deep] text-[10px] uppercase tracking-widest text-[--color-foreground-secondary]">
              <th className="px-3 py-2">Model</th>
              <th className="px-3 py-2">Weights hash</th>
              <th className="px-3 py-2">Seed</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Recorded</th>
              <th className="px-3 py-2">Validation</th>
              <th aria-hidden="true" className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => (
              <LedgerRow key={entry.id} entry={entry} onReproduce={onReproduce} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function LedgerRow({
  entry,
  onReproduce,
}: {
  entry: DesignLedgerEntry;
  onReproduce?: (entry: DesignLedgerEntry) => void;
}) {
  const vm = entry.validationMetrics as Record<string, unknown> | null | undefined;
  const hasMetrics = vm && Object.keys(vm).length > 0;

  return (
    <tr className="border-b border-[--color-border-subtle] last:border-b-0 hover:bg-[--color-muted-deep]/50">
      <td className="px-3 py-2 font-mono text-[--color-foreground]">{entry.modelVersion}</td>
      <td className="px-3 py-2">
        <span
          className="inline-block max-w-[11rem] truncate align-middle font-mono text-[--color-foreground-secondary]"
          title={entry.weightsHash}
        >
          {entry.weightsHash}
        </span>
      </td>
      <td className="px-3 py-2 font-mono text-[--color-foreground]">{entry.seed}</td>
      <td className="px-3 py-2">
        <span className="inline-block max-w-[7rem] truncate align-middle font-mono text-[--color-foreground-secondary]" title={entry.userId}>
          {entry.userId}
        </span>
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-[--color-foreground-secondary]">
        {new Date(entry.timestamp).toLocaleString()}
      </td>
      <td className="px-3 py-2">
        {hasMetrics ? (
          <span className="font-mono text-[--color-success]">recorded</span>
        ) : (
          <span className="text-[--color-foreground-tertiary]">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {onReproduce && hasMetrics && (
          <button
            type="button"
            className="ds-btn ds-btn-ghost px-2 py-1 text-[10px]"
            onClick={() => onReproduce(entry)}
            title="Reproduce from ledger"
          >
            <RefreshCw size={11} /> Reproduce
          </button>
        )}
      </td>
    </tr>
  );
}

/**
 * Reproducibility metadata panel — the exact parameters and constraint payload
 * frozen into a ledger record at generation time.
 */
export const LedgerReproducibilityDetails: React.FC<{ entry: DesignLedgerEntry }> = ({ entry }) => {
  const vm = entry.validationMetrics as Record<string, unknown> | null | undefined;
  return (
    <div className="rounded-lg border border-[--color-border-subtle] bg-[--color-muted-deep] p-4">
      <h5 className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-widest text-[--color-foreground-secondary]">
        <Fingerprint size={12} /> Reproducibility metadata
      </h5>
      <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
        <div className="flex justify-between gap-3">
          <dt className="text-[--color-foreground-tertiary]">Model version</dt>
          <dd className="font-mono text-[--color-foreground]">{entry.modelVersion}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[--color-foreground-tertiary]">Seed</dt>
          <dd className="font-mono text-[--color-foreground]">{entry.seed}</dd>
        </div>
        <div className="flex justify-between gap-3 sm:col-span-2">
          <dt className="text-[--color-foreground-tertiary]">Weights hash</dt>
          <dd className="break-all pl-4 font-mono text-[--color-foreground-secondary]" dir="ltr">
            {entry.weightsHash}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[--color-foreground-tertiary]">User</dt>
          <dd className="truncate font-mono text-[--color-foreground-secondary]">{entry.userId}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[--color-foreground-tertiary]">Recorded</dt>
          <dd className="font-mono text-[--color-foreground-secondary]">{new Date(entry.timestamp).toISOString()}</dd>
        </div>
      </dl>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs uppercase tracking-widest text-[--color-foreground-secondary]">
          Input constraints
        </summary>
        <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded bg-[#0A1124] p-2 font-mono text-[11px] text-[--color-foreground-secondary]">
          {entry.inputConstraints ? JSON.stringify(entry.inputConstraints, null, 2) : '{}'}
        </pre>
      </details>

      {vm && hasOwn(vm) && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs uppercase tracking-widest text-[--color-foreground-secondary]">
            Validation metrics
          </summary>
          <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded bg-[#0A1124] p-2 font-mono text-[11px] text-[--color-foreground-secondary]">
            {JSON.stringify(vm, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};

function hasOwn(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length > 0;
}