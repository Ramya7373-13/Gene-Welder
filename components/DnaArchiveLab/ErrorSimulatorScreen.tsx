import React, { useMemo, useState } from 'react';
import { Activity, Loader } from 'lucide-react';
import DisclaimerFooter from './DisclaimerFooter';
import { dnaArchiveLabService } from '../../services/dnaArchiveLabService';
import { ZERO_ERROR_PROFILE, type ErrorProfile, type SimulateResult } from '../../types/dnaStorage';

interface ErrorSimulatorScreenProps {
  experimentId: string | null;
  uniqueStrands: number;
  onSimulated?: (result: SimulateResult) => void;
}

const ErrorSimulatorScreen: React.FC<ErrorSimulatorScreenProps> = ({
  experimentId,
  uniqueStrands,
  onSimulated,
}) => {
  const [profile, setProfile] = useState<ErrorProfile>({ ...ZERO_ERROR_PROFILE, seed: 42 });
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [history, setHistory] = useState<SimulateResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewSequence] = useState('ACGTACGTACGTACGT');

  const estimated = useMemo(
    () => Math.min(uniqueStrands, Math.round(uniqueStrands * Math.min(1, profile.strandDropoutRate + profile.duplicationRate))),
    [uniqueStrands, profile.strandDropoutRate, profile.duplicationRate]
  );

  const illustrated = useMemo(() => {
    const bases = ['A', 'C', 'G', 'T'];
    return previewSequence
      .split('')
      .map((base, index) => {
        if ((index * 17) % 1000 < profile.substitutionRate * 1000) {
          return bases[(bases.indexOf(base) + 1) % 4];
        }
        return base;
      })
      .join('');
  }, [previewSequence, profile.substitutionRate]);

  const setRate = (key: keyof ErrorProfile, value: number) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const run = async () => {
    if (!experimentId) return;
    setBusy(true);
    setError(null);
    try {
      const simulated = await dnaArchiveLabService.simulateExperiment(experimentId, profile);
      setResult(simulated);
      setHistory((prev) => [simulated, ...prev].slice(0, 8));
      onSimulated?.(simulated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setBusy(false);
    }
  };

  const sliders: Array<{ key: keyof ErrorProfile; label: string; max: number; step: number }> = [
    { key: 'substitutionRate', label: 'Substitution rate', max: 1, step: 0.001 },
    { key: 'insertionRate', label: 'Insertion rate', max: 1, step: 0.001 },
    { key: 'deletionRate', label: 'Deletion rate', max: 1, step: 0.001 },
    { key: 'strandDropoutRate', label: 'Strand dropout rate', max: 1, step: 0.01 },
    { key: 'duplicationRate', label: 'Strand duplication rate', max: 1, step: 0.01 },
    { key: 'coverageDepth', label: 'Coverage depth', max: 20, step: 1 },
    { key: 'seed', label: 'Seed', max: 2147483647, step: 1 },
  ];

  return (
    <div className="space-y-6">
      <div className="mm-card-glowing mm-glow mm-glow--cyan p-6">
        <h2 className="text-white font-black text-sm uppercase tracking-wider mb-2">Error simulation</h2>
        <p className="text-sm text-slate-300 mb-4">
          Configure a <strong className="text-cyan-300">simulated channel error</strong> model. These are digital
          sequence perturbations in a channel-error model, not a biological forecast.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          {sliders.map((slider) => (
            <label key={slider.key} className="text-xs text-slate-400">
              {slider.label}: <span className="text-cyan-300 font-mono">{String(profile[slider.key])}</span>
              <input
                type="range"
                min={0}
                max={slider.max}
                step={slider.step}
                value={Number(profile[slider.key])}
                onChange={(e) => setRate(slider.key, Number(e.target.value))}
                className="w-full"
              />
            </label>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-300">
          Estimated affected strands before run: <span className="font-mono text-cyan-300">{estimated}</span>
        </p>
        {error ? <p className="text-rose-300 text-sm mt-2">{error}</p> : null}
        <button
          type="button"
          disabled={!experimentId || busy}
          onClick={run}
          className="mt-4 mm-btn-tactical px-4 py-2 text-xs inline-flex items-center gap-2"
        >
          {busy ? <Loader className="animate-spin h-3.5 w-3.5" /> : <Activity size={14} />}
          Run simulated channel error
        </button>
      </div>

      <div className="mm-card-glowing mm-glow mm-glow--cyan p-6">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3">Before / after illustration</h3>
        <p className="text-[11px] text-slate-500 mb-2">Preview of the selected channel-error model on a sample strand. Not the stored run.</p>
        <p className="font-mono text-xs text-slate-400">before {previewSequence}</p>
        <p className="font-mono text-xs text-cyan-300">after  {illustrated}</p>
      </div>

      {result ? (
        <div className="mm-card-glowing mm-glow mm-glow--cyan p-6">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3">Error distribution</h3>
          {Object.entries(result.stats).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3 text-xs text-slate-300 mb-1">
              <span className="w-28 capitalize">{key}</span>
              <div className="flex-1 h-2 bg-slate-900 rounded">
                <div className="h-2 bg-cyan-400 rounded" style={{ width: `${Math.min(100, Number(value) * 4)}%` }} />
              </div>
              <span className="font-mono w-10 text-right">{value}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mm-card-glowing mm-glow mm-glow--cyan p-6">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3">Run history</h3>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">No simulated channel error runs yet.</p>
        ) : (
          <ul className="space-y-2 text-xs font-mono text-slate-300">
            {history.map((item) => (
              <li key={item.errorRunId} className="border border-slate-800 rounded-lg p-2">
                seed={item.seed} dropped={item.stats.dropped} duplicated={item.stats.duplicated} sub={item.stats.substituted}
              </li>
            ))}
          </ul>
        )}
      </div>
      <DisclaimerFooter />
    </div>
  );
};

export default ErrorSimulatorScreen;
