import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Download, Search } from 'lucide-react';
import DisclaimerFooter from './DisclaimerFooter';
import EmptyState from '../EmptyState';
import { dnaArchiveLabService } from '../../services/dnaArchiveLabService';
import type { DnaStorageExperiment, DnaStrand } from '../../types/dnaStorage';
import { Archive } from 'lucide-react';

interface EncodingVisualizerProps {
  experimentId: string | null;
}

const BIT_MAP = [
  { bits: '00', base: 'A' },
  { bits: '01', base: 'C' },
  { bits: '10', base: 'G' },
  { bits: '11', base: 'T' },
];

const EncodingVisualizer: React.FC<EncodingVisualizerProps> = ({ experimentId }) => {
  const [experiment, setExperiment] = useState<DnaStorageExperiment | null>(null);
  const [page, setPage] = useState({ page: 1, pageSize: 50, total: 0, strands: [] as DnaStrand[] });
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!experimentId) return;
    setError(null);
    try {
      const [exp, strands] = await Promise.all([
        dnaArchiveLabService.getExperiment(experimentId),
        dnaArchiveLabService.getStrands(experimentId, { page: page.page, pageSize: page.pageSize, q: query || undefined }),
      ]);
      setExperiment(exp);
      setPage(strands);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load strands');
    }
  }, [experimentId, page.page, page.pageSize, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const copySequence = async (sequence: string) => {
    await navigator.clipboard.writeText(sequence);
  };

  const exportArtifacts = async (kind: 'fasta' | 'json') => {
    if (!experimentId || !experiment) return;
    const all: DnaStrand[] = [];
    let current = 1;
    let total = 1;
    while ((current - 1) * 200 < total) {
      const batch = await dnaArchiveLabService.getStrands(experimentId, { page: current, pageSize: 200 });
      all.push(...batch.strands);
      total = batch.total;
      current += 1;
      if (batch.strands.length === 0) break;
    }
    const label = 'simulation export — not for synthesis';
    let blob: Blob;
    let filename: string;
    if (kind === 'fasta') {
      const fasta = [
        `; ${label}`,
        `; experiment ${experiment.id}`,
        ...all.map((s) => `>strand_${s.index} len=${s.sequence.length} gc=${s.gcPercent.toFixed(1)}\n${s.sequence}`),
      ].join('\n');
      blob = new Blob([fasta], { type: 'text/plain' });
      filename = `${experiment.id}-strands.fasta.txt`;
    } else {
      blob = new Blob([JSON.stringify({ label, experiment, strands: all }, null, 2)], { type: 'application/json' });
      filename = `${experiment.id}-strands.json`;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!experimentId) {
    return (
      <div>
        <EmptyState icon={Archive} headline="No encoded experiment selected" subtext="Run the new-experiment wizard to generate strands." />
        <DisclaimerFooter />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mm-card-glowing mm-glow mm-glow--cyan p-6">
        <h2 className="text-white font-black text-sm uppercase tracking-wider mb-4">Encoding visualizer</h2>
        {error ? <p className="text-rose-300 text-sm mb-3">{error}</p> : null}
        <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-300">
          <p>File: <span className="font-mono text-cyan-300">{experiment?.sourceFileName ?? '—'}</span></p>
          <p>Size: <span className="font-mono">{experiment?.sourceFileSizeBytes ?? '—'} bytes</span></p>
          <p className="sm:col-span-2">SHA-256: <span className="font-mono text-xs break-all">{experiment?.sourceSha256 ?? '—'}</span></p>
        </div>
      </div>

      <div className="mm-card-glowing mm-glow mm-glow--cyan p-6">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3">2-bit-to-base mapping</h3>
        <div className="flex flex-wrap gap-2">
          {BIT_MAP.map((row) => (
            <div key={row.bits} className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 font-mono text-sm">
              <span className="text-slate-500">{row.bits}</span>
              <span className="text-slate-600 mx-2">→</span>
              <span className="text-cyan-300 font-bold">{row.base}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mm-card-glowing mm-glow mm-glow--cyan p-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-[12rem] bg-slate-950 border border-slate-700 rounded-lg px-3 py-2">
            <Search size={14} className="text-cyan-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sequence"
              className="bg-transparent text-sm text-white w-full outline-none"
            />
          </div>
          <button type="button" onClick={() => exportArtifacts('fasta')} className="text-xs px-3 py-2 rounded-lg border border-slate-600 text-slate-200 inline-flex items-center gap-1">
            <Download size={12} /> FASTA-like export
          </button>
          <button type="button" onClick={() => exportArtifacts('json')} className="text-xs px-3 py-2 rounded-lg border border-slate-600 text-slate-200 inline-flex items-center gap-1">
            <Download size={12} /> JSON metadata
          </button>
        </div>
        <p className="text-[11px] text-amber-300 mb-3">simulation export — not for synthesis</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-2">Index</th>
                <th>Sequence preview</th>
                <th>Length</th>
                <th>GC %</th>
                <th>Max homopolymer</th>
                <th>Constraints</th>
                <th>Checksum</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {page.strands.map((strand) => (
                <tr key={strand.id} className="border-t border-slate-800 text-slate-200 font-mono">
                  <td className="py-2">{strand.index}</td>
                  <td className="max-w-[16rem] truncate">{strand.sequence.slice(0, 48)}</td>
                  <td>{strand.sequence.length}</td>
                  <td>{strand.gcPercent.toFixed(1)}</td>
                  <td>{strand.maxHomopolymerRun}</td>
                  <td className={strand.passedConstraints ? 'text-emerald-300' : 'text-rose-300'}>
                    {strand.passedConstraints ? 'pass' : 'fail'}
                  </td>
                  <td className="truncate max-w-[8rem]">{strand.originalChecksum.slice(0, 12)}…</td>
                  <td>
                    <button type="button" onClick={() => copySequence(strand.sequence)} aria-label="Copy sequence" className="text-cyan-400">
                      <Copy size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
          <button type="button" disabled={page.page <= 1} onClick={() => setPage((p) => ({ ...p, page: p.page - 1 }))}>Prev</button>
          <span>Page {page.page} · {page.total} strands</span>
          <button type="button" disabled={page.page * page.pageSize >= page.total} onClick={() => setPage((p) => ({ ...p, page: p.page + 1 }))}>Next</button>
        </div>
      </div>
      <DisclaimerFooter />
    </div>
  );
};

export default EncodingVisualizer;
