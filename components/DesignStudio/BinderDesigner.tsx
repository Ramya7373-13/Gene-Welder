import React, { useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';
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

interface BinderDesignerProps {
  projectId: string;
  onRunCreated: (run: DesignRun) => void;
}

/**
 * Binder Design — generate a protein that binds a target structure.
 * Optional variant selection fed to the VariantConditioningEngine derives hotspot
 * constraints automatically; explicit constraints are merged on top.
 */
export const BinderDesigner: React.FC<BinderDesignerProps> = ({ projectId, onRunCreated }) => {
  const [structure, setStructure] = useState('');
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

    if (structure.trim()) {
      const valid = structure.trim().startsWith('ATOM');
      if (!valid) {
        setError('Target structure must be PDB text (begins with "ATOM").');
        return;
      }
    }
    if (structure.trim() && !/^[A-H]$/.test(chainId)) {
      setError('Chain ID must be a single letter A–H.');
      return;
    }

    const payload: CreateRunRequest = {
      projectId,
      mode: DesignMode.BINDER,
      parameters: { ...parameters, numDesigns: parameters.numDesigns },
      targetStructure: structure.trim() || undefined,
      chainId: structure.trim() ? chainId : undefined,
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
      icon={<Link2 size={18} aria-hidden="true" />}
      title="Binder Design"
      description="Design a scaffold that binds a target structure. Optionally condition on a disease variant so hotspots are derived automatically."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="ds-label text-xs uppercase tracking-widest text-[--color-foreground-secondary]">
            Target structure (PDB) <span className="normal-case text-[--color-foreground-tertiary]">— required</span>
          </label>
          <textarea
            value={structure}
            onChange={e => setStructure(e.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={'ATOM      1  N   ALA A   1       1.234   5.678   9.012  1.00 20.00           N\n…'}
            className="w-full rounded-lg border border-[--color-border] bg-[#0A1124] p-3 font-mono text-xs text-[--color-foreground] placeholder:text-[--color-foreground-tertiary] focus:border-[--color-primary] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20"
          />
        </div>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-widest text-[--color-foreground-secondary]">Chain ID</span>
          <select className="ds-select text-sm" value={chainId} onChange={e => setChainId(e.target.value)}>
            {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

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

        <RunLauncherButton busy={busy} disabled={!structure.trim()} />
        {busy && <Loader2 className="animate-spin" size={14} aria-hidden="true" />}
      </form>
    </DesignerShell>
  );
};