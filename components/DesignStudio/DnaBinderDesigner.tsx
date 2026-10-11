import React, { useState } from 'react';
import { Dna } from 'lucide-react';
import {
  DesignMode,
  DesignRun,
  CreateRunRequest,
  designStudioService,
  DesignApiError,
  Rfd3Parameters,
} from '../../services/designStudioService';
import {
  ConstraintEditor,
  ConstraintEditorDraft,
  DesignerShell,
  ParameterControls,
  RunLauncherButton,
  RunStatusBadge,
  toConstraintDtos,
  VariantSelector,
  VariantSelection,
} from './DesignStudioShared';

interface DnaBinderDesignerProps {
  projectId: string;
  onRunCreated: (run: DesignRun) => void;
}

/**
 * DNA Binder Design — design a protein that recognizes a DNA target.
 * The target DNA sequence is encoded as a targetSequence input; interface
 * constraints specify the interacting surface.
 */
export const DnaBinderDesigner: React.FC<DnaBinderDesignerProps> = ({ projectId, onRunCreated }) => {
  const [dna, setDna] = useState('');
  const [chainId, setChainId] = useState('A');
  const [variant, setVariant] = useState<VariantSelection | null>(null);
  const [constraints, setConstraints] = useState<ConstraintEditorDraft[]>([]);
  const [parameters, setParameters] = useState<Rfd3Parameters>({ numDesigns: 4, diffusionSteps: 50, noiseScale: 1, temperature: 1.0, topP: 0.95 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launched, setLaunched] = useState<DesignRun | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLaunched(null);

    const seq = dna.replace(/\s+/g, '').toUpperCase();
    if (seq.length < 6) {
      setError('Target DNA must be at least 6 bp.');
      return;
    }
    if (!/^[ACGT]+$/.test(seq)) {
      setError('Target DNA may only contain A, C, G, T.');
      return;
    }

    const payload: CreateRunRequest = {
      projectId,
      mode: DesignMode.DNA_BINDER,
      parameters,
      targetSequence: seq,
      chainId,
      variant: variant?.variant,
      constraints: toConstraintDtos(constraints),
    };

    setBusy(true);
    try {
      const run = await designStudioService.createRun(payload);
      setLaunched(run);
      onRunCreated(run);
    } catch (err) {
      setError(err instanceof DesignApiError ? err.message : 'Failed to launch design run.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DesignerShell
      icon={<Dna size={18} aria-hidden="true" />}
      title="DNA Binder Design"
      description="Design a protein domain that recognizes a DNA target sequence — a natural companion for TF-binding site repair."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="ds-label text-xs uppercase tracking-widest text-[--color-foreground-secondary]">
            Target DNA <span className="normal-case text-[--color-foreground-tertiary]">— required</span>
          </label>
          <input
            type="text"
            value={dna}
            onChange={e => setDna(e.target.value)}
            placeholder="GGATCCCGAG..."
            spellCheck={false}
            className="w-full rounded-lg border border-[--color-border] bg-[#0A1124] px-3 py-2 font-mono text-sm text-[--color-foreground] placeholder:text-[--color-foreground-tertiary] focus:border-[--color-primary] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20"
          />
        </div>

        <VariantSelector value={variant} onChange={setVariant} />

        <ConstraintEditor constraints={constraints} onChange={setConstraints} />

        <ParameterControls parameters={parameters} onChange={setParameters} />

        {error && <p className="ds-status-banner border-[--color-destructive]/40 text-[--color-destructive]">{error}</p>}
        {launched && (
          <div className="ds-status-banner mt-4 border-[--color-success]/40 text-[--color-foreground]">
            Run <span className="font-mono">{launched.id.slice(0, 8)}</span> enqueued —{' '}
            <RunStatusBadge status={launched.status} />
          </div>
        )}

        <RunLauncherButton busy={busy} disabled={!dna.trim()} />
      </form>
    </DesignerShell>
  );
};