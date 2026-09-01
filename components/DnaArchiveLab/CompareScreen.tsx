import React, { useEffect, useState } from 'react';
import DisclaimerFooter from './DisclaimerFooter';
import { dnaArchiveLabService } from '../../services/dnaArchiveLabService';
import type { DnaStorageExperiment } from '../../types/dnaStorage';

interface CompareMetrics {
  encodingOverhead: string;
  totalBases: string;
  estimatedStorageDensity: string;
  numberOfStrands: string;
  dropoutTolerance: string;
  recoverySuccess: string;
  recoveredChecksumMatch: string;
  effectivePayloadRate: string;
}

const EMPTY: CompareMetrics = {
  encodingOverhead: '—',
  totalBases: '—',
  estimatedStorageDensity: '—',
  numberOfStrands: '—',
  dropoutTolerance: '—',
  recoverySuccess: '—',
  recoveredChecksumMatch: '—',
  effectivePayloadRate: '—',
};

const ROWS: Array<{ key: keyof CompareMetrics; label: string; note?: string }> = [
  { key: 'encodingOverhead', label: 'Encoding overhead' },
  { key: 'totalBases', label: 'Total bases' },
  { key: 'estimatedStorageDensity', label: 'Estimated storage density', note: 'theoretical/simulation-derived' },
  { key: 'numberOfStrands', label: 'Number of strands' },
  { key: 'dropoutTolerance', label: 'Dropout tolerance' },
  { key: 'recoverySuccess', label: 'Recovery success' },
  { key: 'recoveredChecksumMatch', label: 'Recovered checksum match' },
  { key: 'effectivePayloadRate', label: 'Effective payload rate' },
];

function metricsFromReport(report: unknown, experiment: DnaStorageExperiment): CompareMetrics {
  const json = (report ?? {}) as Record<string, any>;
  const strand = json.strandSummary ?? {};
  const decode = json.decodeOutcome ?? {};
  const profile = json.encodingProfile ?? experiment.encodingProfileJson ?? {};
  const expected = decode.expectedChecksum;
  const recovered = decode.recoveredChecksum;
  return {
    encodingOverhead: strand.encodingOverhead != null ? Number(strand.encodingOverhead).toFixed(3) : '—',
    totalBases: strand.totalBases != null ? String(strand.totalBases) : '—',
    estimatedStorageDensity:
      decode.effectivePayloadRate != null
        ? `${Number(decode.effectivePayloadRate).toFixed(4)} bits/base`
        : '—',
    numberOfStrands: strand.uniqueStrandIndexes != null ? String(strand.uniqueStrandIndexes) : String(experiment._count?.strands ?? '—'),
    dropoutTolerance: profile.redundancyFactor != null ? `${Math.max(0, profile.redundancyFactor - 1)} copy(ies)` : '—',
    recoverySuccess: typeof decode.success === 'boolean' ? (decode.success ? 'yes' : 'no') : '—',
    recoveredChecksumMatch:
      expected && recovered ? (expected === recovered ? 'match' : 'mismatch') : '—',
    effectivePayloadRate:
      decode.effectivePayloadRate != null ? Number(decode.effectivePayloadRate).toFixed(4) : '—',
  };
}

const CompareScreen: React.FC = () => {
  const [experiments, setExperiments] = useState<DnaStorageExperiment[]>([]);
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [left, setLeft] = useState<CompareMetrics>(EMPTY);
  const [right, setRight] = useState<CompareMetrics>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dnaArchiveLabService
      .listExperiments()
      .then(setExperiments)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to list experiments'));
  }, []);

  useEffect(() => {
    const loadSide = async (id: string, setter: (m: CompareMetrics) => void) => {
      if (!id) {
        setter(EMPTY);
        return;
      }
      try {
        const experiment = await dnaArchiveLabService.getExperiment(id);
        try {
          const report = await dnaArchiveLabService.getReport(id, 'json');
          setter(metricsFromReport(report, experiment));
        } catch {
          setter(metricsFromReport(null, experiment));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load comparison');
      }
    };
    void loadSide(leftId, setLeft);
    void loadSide(rightId, setRight);
  }, [leftId, rightId]);

  return (
    <div className="space-y-6">
      <div className="mm-card-glowing mm-glow mm-glow--cyan p-6">
        <h2 className="text-white font-black text-sm uppercase tracking-wider mb-3">Compare</h2>
        <p className="text-sm text-slate-400 mb-4">
          Compare two experiments or two completed runs. Side-by-side metrics only — no batch trials, plots, or codec comparison.
        </p>
        {error ? <p className="text-rose-300 text-sm mb-3">{error}</p> : null}
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <label className="text-xs text-slate-400">
            Experiment / run A
            <select value={leftId} onChange={(e) => setLeftId(e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white">
              <option value="">Select…</option>
              {experiments.map((item) => (
                <option key={item.id} value={item.id}>{item.title} ({item.status})</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Experiment / run B
            <select value={rightId} onChange={(e) => setRightId(e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white">
              <option value="">Select…</option>
              {experiments.map((item) => (
                <option key={item.id} value={item.id}>{item.title} ({item.status})</option>
              ))}
            </select>
          </label>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 text-xs uppercase tracking-wider">
              <th className="py-2">Metric</th>
              <th>A</th>
              <th>B</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key} className="border-t border-slate-800">
                <td className="py-2 text-slate-300">
                  {row.label}
                  {row.note ? <div className="text-[10px] text-amber-300">{row.note}</div> : null}
                </td>
                <td className="font-mono text-cyan-300">{left[row.key]}</td>
                <td className="font-mono text-cyan-300">{right[row.key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DisclaimerFooter />
    </div>
  );
};

export default CompareScreen;
