import React, { useEffect, useMemo, useState } from 'react';
import { BookLock, CheckCircle2, FlaskConical, Trophy } from 'lucide-react';
import {
  DesignCandidate,
  DesignLedgerEntry,
  DesignRun,
  designStudioService,
  DesignApiError,
} from '../../services/designStudioService';
import EmptyState from '../EmptyState';
import { DesignMetricsPanel } from './DesignMetricsPanel';
import { DesignLedgerViewer } from './DesignLedgerViewer';
import { StudioSpinner } from './DesignStudioShared';

interface DesignResultsViewerProps {
  run: DesignRun;
  onBackToList: () => void;
  onSelectCandidate?: (candidateId: string | null) => void;
}

/**
 * Design Results — the candidate list for one run, ranked by the validation
 * engine, with a per-candidate "Validate" action that runs the full scoring
 * round (pTM/ipTM/pLDDT, interface area, constraint satisfaction, diversity).
 */
export const DesignResultsViewer: React.FC<DesignResultsViewerProps> = ({ run, onBackToList, onSelectCandidate }) => {
  const [candidates, setCandidates] = useState<DesignCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showLedger, setShowLedger] = useState(false);

  const load = async () => {
    setError(null);
    try {
      setCandidates(await designStudioService.listCandidates(run.id));
    } catch (err) {
      setError(err instanceof DesignApiError ? err.message : 'Failed to load candidates.');
      setCandidates([]);
    }
  };

  useEffect(() => {
    setCandidates(null);
    setSelectedId(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id]);

  const handleSelect = (candidateId: string | null) => {
    setSelectedId(candidateId);
    onSelectCandidate?.(candidateId);
  };

  const handleValidate = async (candidateId: string) => {
    setValidatingId(candidateId);
    setMessage(null);
    setError(null);
    try {
      await designStudioService.validateCandidate(candidateId);
      await load();
      setMessage('Validation complete — metrics and ledger updated.');
    } catch (err) {
      setError(err instanceof DesignApiError ? err.message : 'Validation failed.');
    } finally {
      setValidatingId(null);
    }
  };

  const ledgerEntries = useMemo(
    () =>
      (candidates ?? [])
        .flatMap((c): DesignLedgerEntry[] => c.ledgerEntries ?? [])
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [candidates],
  );

  if (!candidates) return <StudioSpinner label="Loading candidates…" />;

  const selectedCandidate = candidates.find(c => c.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <button type="button" className="ds-btn ds-btn-ghost text-sm" onClick={onBackToList}>
        ← Back to history
      </button>
      <div>
        <h4 className="text-sm font-bold text-[--color-foreground]">
          {run.mode} · <span className="font-mono">{run.id.slice(0, 8)}</span>
        </h4>
        <p className="text-xs text-[--color-foreground-secondary]">
          {candidates.length} candidate{candidates.length === 1 ? '' : 's'} · ranked by validation score
        </p>
      </div>

      {error && <p className="ds-status-banner border-[--color-destructive]/40 text-[--color-destructive]">{error}</p>}
      {message && <p className="ds-status-banner border-[--color-success]/40 text-[--color-foreground]">{message}</p>}

      {candidates.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          headline="No candidates yet"
          subtext="A completed job writes its candidates here; re-run validation to score them."
        />
      ) : (
<ul className="grid gap-3 sm:grid-cols-2">
          {candidates.map(c => {
            const validation = c.validationResults?.[0];
            const score = validation?.overallScore ?? c.affinityScore;
            const isSelected = selectedId === c.id;
            return (
              <li
                key={c.id}
                className={`ds-card ds-card-interactive flex flex-col gap-3 p-4 ${isSelected ? 'border-[--color-primary] ring-1 ring-[--color-primary]/40' : ''}`}
              >
                <button
                  type="button"
                  className="flex items-center justify-between gap-2 text-left"
                  onClick={() => handleSelect(isSelected ? null : c.id)}
                >
                  <span className="flex items-center gap-1.5 font-mono text-xs text-[--color-foreground-secondary]">
                    <Trophy size={13} className="text-[--color-warning]" aria-hidden="true" />
                    #{c.rankedPosition ?? '-'}
                    <span>{c.id.slice(0, 8)}</span>
                  </span>
                  {typeof score === 'number' && (
                    <span className="rounded-md bg-[--color-primary-dim] px-2 py-0.5 font-mono text-xs text-[--color-primary]">
                      {score.toFixed(2)}
                    </span>
                  )}
                </button>

                {c.sequence && (
                  <p className="break-all font-mono text-[11px] leading-relaxed text-[--color-foreground-secondary]">
                    {c.sequence.length > 140 ? `${c.sequence.slice(0, 140)}…` : c.sequence}
                  </p>
                )}

                {validation && (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {[
                      ['pTM', validation.pTM],
                      ['ipTM', validation.ipTM],
                      ['pLDDT', validation.pLDDT],
                      ['Interface Å²', validation.interfaceArea],
                      ['Constraint', validation.constraintSatisfactionScore],
                      ['Diversity', validation.diversityScore],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="flex justify-between gap-2">
                        <dt className="text-[--color-foreground-tertiary]">{label}</dt>
                        <dd className="font-mono text-[--color-foreground]">
                          {typeof value === 'number' ? value.toFixed(3) : '—'}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                <div className="flex gap-2">
                  <button type="button" className="ds-btn ds-btn-secondary flex-1" onClick={() => handleValidate(c.id)} disabled={validatingId !== null}>
                    <CheckCircle2 size={14} />
                    {validatingId === c.id ? 'Validating…' : validation ? 'Re-validate' : 'Validate'}
                  </button>
                  <button type="button" className="ds-btn ds-btn-ghost flex-1" onClick={() => handleSelect(isSelected ? null : c.id)}>
                    {isSelected ? 'Hide metrics' : 'Metrics & ledger'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

        {selectedCandidate && (
          <section aria-label="Selected candidate metrics">
            <DesignMetricsPanel candidate={selectedCandidate} />
          </section>
        )}

        <section aria-label="Design ledger" className="ds-card p-4">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left"
            onClick={() => setShowLedger(v => !v)}
          >
            <span className="flex items-center gap-1.5 text-sm font-bold text-[--color-foreground]">
              <BookLock size={15} className="text-[--color-foreground-secondary]" aria-hidden="true" />
              Design ledger
            </span>
            <span className="ds-chip px-2 py-0.5 text-[10px]">{ledgerEntries.length} entries</span>
          </button>
          {showLedger && (
            <div className="mt-3">
              <DesignLedgerViewer entries={ledgerEntries} />
            </div>
          )}
        </section>
    </div>
  );
};