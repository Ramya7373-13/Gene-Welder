import React, { useState } from 'react';
import { CheckCircle2, Download, Loader, XCircle } from 'lucide-react';
import DisclaimerFooter from './DisclaimerFooter';
import { dnaArchiveLabService } from '../../services/dnaArchiveLabService';
import type { DecodeApiResult } from '../../types/dnaStorage';

interface DecodeVerifyScreenProps {
  experimentId: string | null;
  errorRunId?: string;
}

const DecodeVerifyScreen: React.FC<DecodeVerifyScreenProps> = ({ experimentId, errorRunId }) => {
  const [result, setResult] = useState<DecodeApiResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDecode = async () => {
    if (!experimentId) return;
    setBusy(true);
    setError(null);
    try {
      const decoded = await dnaArchiveLabService.decodeExperiment(experimentId, errorRunId);
      setResult(decoded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decode failed');
    } finally {
      setBusy(false);
    }
  };

  const downloadReport = async (format: 'json' | 'markdown') => {
    if (!experimentId) return;
    const report = await dnaArchiveLabService.getReport(experimentId, format);
    const blob = new Blob(
      [typeof report === 'string' ? report : JSON.stringify(report, null, 2)],
      { type: format === 'markdown' ? 'text/markdown' : 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${experimentId}-report.${format === 'markdown' ? 'md' : 'json'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="mm-card-glowing mm-glow mm-glow--cyan p-6">
        <h2 className="text-white font-black text-sm uppercase tracking-wider mb-3">Decode and verify</h2>
        <p className="text-sm text-slate-400 mb-4">
          Reconstruct the payload from encoded strands and compare recovered SHA-256 to the source checksum.
        </p>
        {error ? <p className="text-rose-300 text-sm mb-3">{error}</p> : null}
        <button
          type="button"
          disabled={!experimentId || busy}
          onClick={runDecode}
          className="mm-btn-tactical px-4 py-2 text-xs inline-flex items-center gap-2"
        >
          {busy ? <Loader className="animate-spin h-3.5 w-3.5" /> : null}
          {busy ? 'Decoding…' : 'Run decode'}
        </button>
      </div>

      {result ? (
        <div className="mm-card-glowing mm-glow mm-glow--cyan p-6 space-y-3">
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle2 className="text-emerald-400" size={18} />
            ) : (
              <XCircle className="text-rose-400" size={18} />
            )}
            <span className={result.success ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>
              {result.success ? 'Recovery succeeded' : 'Recovery failed'}
            </span>
          </div>
          <p className="text-xs font-mono text-slate-400 break-all">Expected: {result.expectedChecksum}</p>
          <p className="text-xs font-mono text-slate-400 break-all">Recovered: {result.recoveredChecksum ?? 'n/a'}</p>
          <p className="text-sm text-slate-300">
            Missing {result.missingStrands} · corrupted {result.corruptedStrands} · reconstructed {result.correctedStrands} · uncorrectable {result.uncorrectableStrands}
          </p>
          <p className="text-sm text-slate-200">{result.message}</p>
          {result.warnings.length > 0 ? (
            <div className="border border-amber-500/30 bg-amber-950/30 rounded-lg p-3 text-xs text-amber-200 space-y-1">
              {result.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
          {!result.success ? (
            <p className="text-sm text-slate-400">
              Recovery failed because redundancy, indexing, or the configured error rate was insufficient for reconstruction.
            </p>
          ) : (
            <p className="text-sm text-slate-400">
              Recovered payload matches the source SHA-256. File bytes are not returned by the API; download the verification report.
            </p>
          )}
          {result.reportAvailable ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => downloadReport('json')} className="text-xs px-3 py-2 rounded-lg border border-slate-600 inline-flex items-center gap-1">
                <Download size={12} /> JSON report
              </button>
              <button type="button" onClick={() => downloadReport('markdown')} className="text-xs px-3 py-2 rounded-lg border border-slate-600 inline-flex items-center gap-1">
                <Download size={12} /> Markdown report
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <DisclaimerFooter />
    </div>
  );
};

export default DecodeVerifyScreen;
