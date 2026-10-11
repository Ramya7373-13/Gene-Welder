import React, { useState } from 'react';
import { Wind } from 'lucide-react';
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

interface StabilizerDesignerProps {
  projectId: string;
  onRunCreated: (run: DesignRun) => void;
}

/**
 * Stabilizer Design — engineer a stabilizing off-pathway mutation that rescues a
 * destabilizing variant. Targets burial-depth constraints at the residue carrying
 * the disease variant.
 */
export const StabilizerDesigner: React.FC<StabilizerDesignerProps> = ({ projectId, onRunCreated }) => {
  const [sequence, setSequence] = useState('');
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

    const seq = sequence.replace(/\s+/g, '');
    if (seq.length < 10) {
      setError('Target sequence must be at least 10 residues.');
      return;
    }
    if (!/^[ACDEFGHIKLMNPQRSTVWY]+$/i.test(seq)) {
      setError('Target sequence may only contain standard 1-letter amino acid codes.');
      return;
    }
    if (!variant) {
      setError('A disease variant is required to target the stabilization site.');
      return;
    }

    const payload: CreateRunRequest = {
      projectId,
      mode: DesignMode.STABILIZER,
      parameters,
      targetSequence: seq,
      chainId,
      variant: variant.variant,
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
      icon={<Wind size={18} aria-hidden="true" />}
      title="Stabilizer Design"
      description="Design a compensating stabilizing mutation for a destabilizing disease variant (e.g. p.L144F SOD1, p.V600E BRAF)."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="ds-label text-xs uppercase tracking-widest text-[--color-foreground-secondary]">
            Target sequence <span className="normal-case text-[--color-foreground-tertiary]">— required</span>
          </label>
          <textarea
            value={sequence}
            onChange={e => setSequence(e.target.value)}
            rows={3}
            spellCheck={false}
            placeholder="MTEYLLPTTYEGEHLYERDEGDKSGDPSVWGA..."
            className="w-full rounded-lg border border-[--color-border] bg-[#0A1124] p-3 font-mono text-xs text-[--color-foreground] placeholder:text-[--color-foreground-tertiary] focus:border-[--color-primary] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20"
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

        <RunLauncherButton busy={busy} disabled={!sequence.trim() || !variant} />
      </form>
    </DesignerShell>
  );
};