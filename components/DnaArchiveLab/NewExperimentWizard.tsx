import React, { useState } from 'react';
import { Activity, Dna, Loader } from 'lucide-react';
import DisclaimerFooter from './DisclaimerFooter';
import { dnaArchiveLabService } from '../../services/dnaArchiveLabService';
import {
  ADVANCED_PROFILE,
  ENCODING_PROFILES,
  EncodingProfile,
  SAMPLE_PAYLOAD_FILENAME,
  SAMPLE_PAYLOAD_TEXT,
} from '../../types/dnaStorage';

interface NewExperimentWizardProps {
  onComplete?: (experimentId: string) => void;
}

const NewExperimentWizard: React.FC<NewExperimentWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<EncodingProfile>(ENCODING_PROFILES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useSamplePayload = () => {
    setFile(new File([SAMPLE_PAYLOAD_TEXT], SAMPLE_PAYLOAD_FILENAME, { type: 'text/plain' }));
  };

  const runEncode = async () => {
    if (!file || profile.mode === 'advanced') return;
    setBusy(true);
    setError(null);
    try {
      const experiment = await dnaArchiveLabService.createExperiment({
        title: title.trim(),
        description: description.trim() || undefined,
      });
      await dnaArchiveLabService.uploadFile(experiment.id, file);
      await dnaArchiveLabService.encodeExperiment(experiment.id, profile);
      onComplete?.(experiment.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Encode failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mm-card-glowing mm-glow mm-glow--cyan p-6">
        <h2 className="text-white font-black text-sm uppercase tracking-wider mb-4 flex items-center gap-2.5">
          <div className="mm-section-accent" />
          <Dna className="h-4 w-4 text-cyan-400" />
          New experiment
          <span className="ml-auto text-[10px] font-mono text-cyan-300">Step {step} / 5</span>
        </h2>

        {step === 1 && (
          <div className="space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Experiment name
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Short description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white"
              />
            </label>
            <button
              type="button"
              disabled={!title.trim()}
              onClick={() => setStep(2)}
              className="mm-btn-tactical px-4 py-2 text-xs"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">Upload a small non-sensitive text, JSON, or CSV file (1 MB cap).</p>
            <input
              type="file"
              accept=".txt,.json,.csv,text/plain,application/json,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button type="button" onClick={useSamplePayload} className="text-xs px-3 py-1.5 rounded-lg border border-cyan-500/40 text-cyan-300">
              Use sample payload
            </button>
            {file ? <p className="text-xs text-slate-400 font-mono">{file.name} ({file.size} bytes)</p> : null}
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(1)} className="text-xs text-slate-400">Back</button>
              <button type="button" disabled={!file} onClick={() => setStep(3)} className="mm-btn-tactical px-4 py-2 text-xs">Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Select encoding profile</p>
            {ENCODING_PROFILES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setProfile({ ...item })}
                className={`w-full text-left p-3 rounded-xl border ${
                  profile.id === item.id ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-700 bg-slate-950/60'
                }`}
              >
                <div className="text-sm font-bold text-white">{item.name}</div>
                <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                {item.mode === 'advanced' ? (
                  <span className="text-[10px] uppercase text-amber-300">Not enabled in this version</span>
                ) : null}
              </button>
            ))}
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(2)} className="text-xs text-slate-400">Back</button>
              <button type="button" onClick={() => setStep(4)} className="mm-btn-tactical px-4 py-2 text-xs">Continue</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-slate-400">
              Max payload bases
              <input type="number" min={20} max={10000} value={profile.maxPayloadBases} onChange={(e) => setProfile({ ...profile, maxPayloadBases: Number(e.target.value) })} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white" />
            </label>
            <label className="text-xs text-slate-400">
              Homopolymer limit
              <input type="number" min={1} max={10} value={profile.maxHomopolymerLength} onChange={(e) => setProfile({ ...profile, maxHomopolymerLength: Number(e.target.value) })} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white" />
            </label>
            <label className="text-xs text-slate-400">
              Min GC %
              <input type="number" min={0} max={100} value={profile.minGcPercent} onChange={(e) => setProfile({ ...profile, minGcPercent: Number(e.target.value) })} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white" />
            </label>
            <label className="text-xs text-slate-400">
              Max GC %
              <input type="number" min={0} max={100} value={profile.maxGcPercent} onChange={(e) => setProfile({ ...profile, maxGcPercent: Number(e.target.value) })} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white" />
            </label>
            <label className="text-xs text-slate-400">
              Redundancy factor
              <input type="number" min={1} max={10} value={profile.redundancyFactor} onChange={(e) => setProfile({ ...profile, redundancyFactor: Number(e.target.value) })} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white" />
            </label>
            <div className="sm:col-span-2 flex gap-2 mt-2">
              <button type="button" onClick={() => setStep(3)} className="text-xs text-slate-400">Back</button>
              <button type="button" onClick={() => setStep(5)} className="mm-btn-tactical px-4 py-2 text-xs">Continue</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3 text-sm text-slate-300">
            <p><span className="text-slate-500">Name:</span> {title}</p>
            <p><span className="text-slate-500">File:</span> {file?.name} ({file?.size} bytes)</p>
            <p><span className="text-slate-500">Profile:</span> {profile.name} ({profile.mode})</p>
            <p><span className="text-slate-500">Redundancy:</span> {profile.redundancyFactor}× copies</p>
            {profile.id === ADVANCED_PROFILE.id ? (
              <p className="text-amber-300">Advanced codec adapter is not enabled in this version.</p>
            ) : null}
            {error ? <p className="text-rose-300">{error}</p> : null}
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(4)} className="text-xs text-slate-400">Back</button>
              <button
                type="button"
                disabled={busy || profile.mode === 'advanced'}
                onClick={runEncode}
                className="mm-btn-tactical px-4 py-2 text-xs inline-flex items-center gap-2"
              >
                {busy ? <Loader className="animate-spin h-3.5 w-3.5" /> : <Activity size={14} />}
                Run encode
              </button>
            </div>
          </div>
        )}
      </div>
      <DisclaimerFooter />
    </div>
  );
};

export default NewExperimentWizard;
