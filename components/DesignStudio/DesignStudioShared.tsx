import React, { useMemo, useState } from 'react';
import { Search, X, SlidersHorizontal, Plus, Trash2, Sparkles } from 'lucide-react';
import { DISEASE_VARIANTS } from '../../constants';
import {
  ConstraintType,
  DesignConstraintDto,
  DesignMode,
  DesignRunStatus,
  Rfd3Parameters,
  ResiduePosition,
} from '../../services/designStudioService';

// --- Variant / gene search ------------------------------------------------------

export interface VariantSelection {
  gene: string;
  variant: string; // HGVS protein notation e.g. "p.G12D"
  uniprotId?: string;
}

interface VariantSelectorProps {
  value: VariantSelection | null;
  onChange: (v: VariantSelection | null) => void;
}

/**
 * Variant selector + gene search. Searches the built-in DISEASE_VARIANTS catalog
 * by gene name; selecting a variant supplies an HGVS protein notation like p.G12D
 * plus its gene, UniProt id, and disease context.
 */
export const VariantSelector: React.FC<VariantSelectorProps> = ({ value, onChange }) => {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DISEASE_VARIANTS;
    return DISEASE_VARIANTS.filter(
      v =>
        v.protein.toLowerCase().includes(q) ||
        v.variant.toLowerCase().includes(q) ||
        v.disease.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="space-y-2">
      <label className="ds-label text-xs uppercase tracking-widest text-[--color-foreground-secondary]">
        Variant / Gene
      </label>

      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[--color-primary]/30 bg-[--color-primary-dim] px-3 py-2">
          <div className="min-w-0">
            <span className="font-mono text-sm text-[--color-primary]">{value.gene} {value.variant}</span>
            <span className="ml-2 text-xs text-[--color-foreground-secondary]">{value.uniprotId}</span>
          </div>
          <button
            type="button"
            className="text-[--color-foreground-tertiary] hover:text-[--color-foreground]"
            onClick={() => onChange(null)}
            aria-label="Clear variant selection"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--color-foreground-tertiary]" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search gene, variant, or disease…"
            className="w-full rounded-lg border border-[--color-border] bg-[#0A1124] py-2 pl-8 pr-3 text-sm text-[--color-foreground] placeholder:text-[--color-foreground-tertiary] focus:border-[--color-primary] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20"
          />
          {query && (
            <div className="adbe-scroll mt-1 max-h-56 overflow-y-auto rounded-lg border border-[--color-border] bg-[#0A1124] py-1">
              {results.length === 0 && (
                <p className="px-3 py-2 text-xs text-[--color-foreground-secondary]">No variants match “{query}”.</p>
              )}
              {results.map(v => (
                <button
                  key={v.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[--color-muted]"
                  onClick={() => {
                    onChange({ gene: v.protein, variant: v.variant, uniprotId: v.uniprot_id });
                    setQuery('');
                  }}
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-[--color-foreground]">{v.protein}</span>
                    <span className="block text-xs text-[--color-foreground-secondary]">{v.disease}</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-[--color-primary]">{v.variant}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** Free-text gene input used when a variant is not required (e.g. protein scaffold). */
export const GeneSearch: React.FC<{
  value: string;
  onChange: (gene: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder = 'Target gene (e.g. TP53, BRCA2, CFTR)…' }) => {
  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    const matches: string[] = [];
    for (const v of DISEASE_VARIANTS) {
      if (v.protein.toLowerCase().includes(q) && !seen.has(v.protein)) {
        seen.add(v.protein);
        matches.push(v.protein);
      }
    }
    return matches.slice(0, 6);
  }, [value]);

  return (
    <div className="space-y-1">
      <label className="ds-label text-xs uppercase tracking-widest text-[--color-foreground-secondary]">
        Target Gene
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        list="studio-gene-suggestions"
        className="w-full rounded-lg border border-[--color-border] bg-[#0A1124] px-3 py-2 text-sm text-[--color-foreground] placeholder:text-[--color-foreground-tertiary] focus:border-[--color-primary] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20"
      />
      <datalist id="studio-gene-suggestions">
        {suggestions.map(g => (
          <option key={g} value={g} />
        ))}
      </datalist>
    </div>
  );
};

// --- RFD3 parameter editor ------------------------------------------------------

interface ParameterControlsProps {
  parameters: Rfd3Parameters;
  onChange: (p: Rfd3Parameters) => void;
}

const PARAM_FIELDS: { key: keyof Rfd3Parameters; label: string; min: number; max: number; step: number; hint?: string }[] = [
  { key: 'numDesigns', label: 'Num designs', min: 1, max: 200, step: 1, hint: 'Candidates to generate' },
  { key: 'diffusionSteps', label: 'Diffusion steps', min: 10, max: 1000, step: 10 },
  { key: 'noiseScale', label: 'Noise scale', min: 0, max: 1, step: 0.05 },
  { key: 'temperature', label: 'Temperature', min: 0, max: 10, step: 0.1 },
  { key: 'topP', label: 'Top-p', min: 0, max: 1, step: 0.05 },
  { key: 'seed', label: 'Seed', min: 0, max: 2147483647, step: 1, hint: 'Fix for reproducible designs' },
];

const isNumber = (v: unknown): v is number => typeof v === 'number';

export const ParameterControls: React.FC<ParameterControlsProps> = ({ parameters, onChange }) => {
  const set = (key: keyof Rfd3Parameters, raw: string) => {
    const num = raw === '' ? undefined : Number(raw);
    onChange({ ...parameters, [key]: num });
  };

  return (
    <fieldset className="rounded-lg border border-[--color-border] bg-[--color-muted-deep] p-3">
      <legend className="flex items-center gap-1.5 px-1 text-xs uppercase tracking-widest text-[--color-foreground-secondary]">
        <SlidersHorizontal size={12} /> RFD3 Parameters
      </legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PARAM_FIELDS.map(f => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-[11px] text-[--color-foreground-secondary]">{f.label}</span>
            <input
              type="number"
              min={f.min}
              max={f.max}
              step={f.step}
              value={isNumber(parameters[f.key]) ? (parameters[f.key] as number) : ''}
              onChange={e => set(f.key, e.target.value)}
              className="w-full rounded-md border border-[--color-border] bg-[#0A1124] px-2 py-1.5 text-sm font-mono text-[--color-foreground] focus:border-[--color-primary] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20"
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
};

// --- Constraint editor ----------------------------------------------------------

export interface ConstraintDraft {
  type: ConstraintType;
  key: string; // stable identity for React keys
}

export interface HotspotDraft extends ConstraintDraft {
  type: ConstraintType.HOTSPOT;
  chain: string;
  positions: string; // comma-separated
}

export interface InterfaceDraft extends ConstraintDraft {
  type: ConstraintType.INTERFACE;
  chain: string;
  residues: string; // comma-separated numbers
  shapeComplementarity?: number;
}

export interface BurialDepthDraft extends ConstraintDraft {
  type: ConstraintType.BURY_DEPTH;
  chain: string;
  positions: string;
  minDepth: number;
  maxDepth?: number;
}

export type ConstraintEditorDraft = HotspotDraft | InterfaceDraft | BurialDepthDraft;

const CHAIN_OPTIONS = ['A', 'B', 'C', 'D'];

export function parseResiduePositions(raw: string, chain: string): ResiduePosition[] {
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const n = parseInt(s, 10);
      return isNaN(n) ? null : { chain, position: n };
    })
    .filter((r): r is ResiduePosition => r !== null);
}

export function parseResidueNumbers(raw: string): number[] {
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter(n => !isNaN(n) && n > 0);
}

interface ConstraintEditorProps {
  constraints: ConstraintEditorDraft[];
  onChange: (constraints: ConstraintEditorDraft[]) => void;
}

/**
 * Constraint editor for hotspot, interface-region, and burial-depth constraints.
 * Output drafts are converted to the typed DesignConstraintDto in the designer that
 * owns them before submission.
 */
export const ConstraintEditor: React.FC<ConstraintEditorProps> = ({ constraints, onChange }) => {
  const [kind, setKind] = useState<ConstraintType>(ConstraintType.HOTSPOT);

  const add = () => {
    const base = { type: kind, key: `c-${Date.now()}` } as ConstraintEditorDraft;
    if (kind === ConstraintType.HOTSPOT) {
      onChange([...constraints, { ...(base as HotspotDraft), chain: 'A', positions: '' }]);
    } else if (kind === ConstraintType.INTERFACE) {
      onChange([...constraints, { ...(base as InterfaceDraft), chain: 'A', residues: '' }]);
    } else {
      onChange([...constraints, { ...(base as BurialDepthDraft), chain: 'A', positions: '', minDepth: 3 }]);
    }
  };

  const update = (key: string, patch: Partial<ConstraintEditorDraft>) => {
    onChange(constraints.map(c => (c.key === key ? ({ ...c, ...patch } as ConstraintEditorDraft) : c)));
  };

  const remove = (key: string) => onChange(constraints.filter(c => c.key !== key));

  return (
    <fieldset className="rounded-lg border border-[--color-border] bg-[--color-muted-deep] p-3">
      <legend className="flex items-center gap-1.5 px-1 text-xs uppercase tracking-widest text-[--color-foreground-secondary]">
        Constraints
      </legend>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="ds-select text-sm"
          value={kind}
          onChange={e => setKind(e.target.value as ConstraintType)}
          aria-label="Constraint type"
        >
          <option value={ConstraintType.HOTSPOT}>Hotspot residues</option>
          <option value={ConstraintType.INTERFACE}>Interface region</option>
          <option value={ConstraintType.BURY_DEPTH}>Burial depth</option>
        </select>
        <button type="button" className="ds-btn ds-btn-secondary" onClick={add}>
          <Plus size={14} /> Add
        </button>
      </div>

      {constraints.length === 0 ? (
        <p className="mt-3 text-xs text-[--color-foreground-tertiary]">
          No constraints. The variant conditioning engine will derive hotspots automatically when a variant is selected.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {constraints.map(c => (
            <li key={c.key} className="flex flex-wrap items-end gap-2 rounded-md border border-[--color-border-subtle] bg-[#0A1124] p-2">
              <span className="rounded bg-[--color-primary-dim] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[--color-primary]">
                {c.type}
              </span>
              <label className="block">
                <span className="mb-0.5 block text-[10px] text-[--color-foreground-tertiary]">Chain</span>
                <select
                  className="ds-select text-xs"
                  value={c.chain}
                  onChange={e => update(c.key, { chain: e.target.value } as Partial<ConstraintEditorDraft>)}
                >
                  {CHAIN_OPTIONS.map(ch => (
                    <option key={ch} value={ch}>{ch}</option>
                  ))}
                </select>
              </label>
              {c.type === ConstraintType.BURY_DEPTH ? (
                <>
                  <label className="block">
                    <span className="mb-0.5 block text-[10px] text-[--color-foreground-tertiary]">Positions</span>
                    <input
                      type="text"
                      value={c.positions}
                      onChange={e => update(c.key, { positions: e.target.value } as Partial<ConstraintEditorDraft>)}
                      placeholder="46, 48, 50"
                      className="w-28 rounded-md border border-[--color-border] bg-[#0A1124] px-2 py-1 text-xs font-mono text-[--color-foreground] focus:border-[--color-primary] focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-[10px] text-[--color-foreground-tertiary]">Min depth (Å)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={c.minDepth}
                      onChange={e => update(c.key, { minDepth: Number(e.target.value) } as Partial<ConstraintEditorDraft>)}
                      className="w-20 rounded-md border border-[--color-border] bg-[#0A1124] px-2 py-1 text-xs font-mono text-[--color-foreground] focus:border-[--color-primary] focus:outline-none"
                    />
                  </label>
                </>
              ) : (
                <label className="block">
                  <span className="mb-0.5 block text-[10px] text-[--color-foreground-tertiary]">
                    {c.type === ConstraintType.HOTSPOT ? 'Positions' : 'Residue numbers'}
                  </span>
                  <input
                    type="text"
                    value={c.type === ConstraintType.HOTSPOT ? c.positions : c.residues}
                    onChange={e =>
                      update(
                        c.key,
                        (c.type === ConstraintType.HOTSPOT
                          ? { positions: e.target.value }
                          : { residues: e.target.value }) as Partial<ConstraintEditorDraft>,
                      )
                    }
                    placeholder="46, 48, 50"
                    className="w-28 rounded-md border border-[--color-border] bg-[#0A1124] px-2 py-1 text-xs font-mono text-[--color-foreground] focus:border-[--color-primary] focus:outline-none"
                  />
                </label>
              )}
              <button
                type="button"
                className="ml-auto text-[--color-foreground-tertiary] hover:text-[--color-destructive]"
                onClick={() => remove(c.key)}
                aria-label={`Remove ${c.type} constraint`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
};

// --- Status display -------------------------------------------------------------

const STATUS_STYLES: Record<DesignRunStatus, string> = {
  [DesignRunStatus.QUEUED]: 'border-[--color-warning]/40 bg-[--color-warning-dim] text-[--color-warning]',
  [DesignRunStatus.RUNNING]: 'border-[--color-info]/40 bg-[--color-info-dim] text-[--color-info]',
  [DesignRunStatus.VALIDATING]: 'border-[--color-primary]/40 bg-[--color-primary-dim] text-[--color-primary]',
  [DesignRunStatus.COMPLETED]: 'border-[--color-success]/40 bg-[--color-accent-dim] text-[--color-success]',
  [DesignRunStatus.FAILED]: 'border-[--color-destructive]/40 bg-[--color-destructive-dim] text-[--color-destructive]',
};

export const RunStatusBadge: React.FC<{ status: DesignRunStatus }> = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status] ?? ''}`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
    {status}
  </span>
);

export const MODE_LABELS: Record<DesignMode, string> = {
  [DesignMode.BINDER]: 'Binder Design',
  [DesignMode.STABILIZER]: 'Stabilizer Design',
  [DesignMode.DNA_BINDER]: 'DNA Binder Design',
  [DesignMode.ENZYME_RESCUE]: 'Enzyme Rescue Design',
  [DesignMode.SCAFFOLD]: 'Scaffold',
  [DesignMode.SYMMETRIC_ASSEMBLY]: 'Symmetric Assembly',
  [DesignMode.MOTIF_SCAFFOLD]: 'Motif Scaffold',
  [DesignMode.PROTEIN_SCAFFOLD]: 'Protein Scaffold',
};

/** Centered spinner used by every Design Studio panel. */
export const StudioSpinner: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center gap-2 py-10" role="status" aria-live="polite">
    <span className="sr-only">{label}</span>
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[--color-border] border-t-[--color-primary]" />
  </div>
);

// --- Convert drafts -> DTO ------------------------------------------------------

export function toConstraintDtos(constraints: ConstraintEditorDraft[]): DesignConstraintDto[] {
  const dtos: DesignConstraintDto[] = [];
  for (const c of constraints) {
    if (c.type === ConstraintType.HOTSPOT) {
      const residues = parseResiduePositions(c.positions, c.chain);
      if (residues.length > 0) dtos.push({ type: ConstraintType.HOTSPOT, residues });
    } else if (c.type === ConstraintType.INTERFACE) {
      const residues = parseResidueNumbers(c.residues);
      if (residues.length > 0) {
        dtos.push({
          type: ConstraintType.INTERFACE,
          chain: c.chain,
          residues,
          ...(c.shapeComplementarity !== undefined ? { shapeComplementarity: c.shapeComplementarity } : {}),
        });
      }
    } else {
      const residues = parseResiduePositions(c.positions, c.chain);
      if (residues.length > 0 && c.minDepth > 0) {
        dtos.push({
          type: ConstraintType.BURY_DEPTH,
          residues,
          minDepth: c.minDepth,
          ...(c.maxDepth !== undefined ? { maxDepth: c.maxDepth } : {}),
        });
      }
    }
  }
  return dtos;
}

// --- Designer card shell ---------------------------------------------------------

interface DesignerShellProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const DesignerShell: React.FC<DesignerShellProps> = ({ icon, title, description, children, footer }) => (
  <div className="ds-card p-5">
    <div className="mb-4 flex items-start gap-3">
      {icon && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[--color-primary-dim] text-[--color-primary]">
          {icon}
        </div>
      )}
      <div>
        <h3 className="text-base font-bold text-[--color-foreground]">{title}</h3>
        <p className="mt-0.5 text-sm text-[--color-foreground-secondary]">{description}</p>
      </div>
    </div>
    <div className="space-y-4">{children}</div>
    {footer && <div className="mt-5 flex items-center justify-end gap-2 border-t border-[--color-border-subtle] pt-4">{footer}</div>}
  </div>
);

export const RunLauncherButton: React.FC<{ busy: boolean; disabled?: boolean }> = ({ busy, disabled }) => (
  <button type="submit" className="ds-btn ds-btn-primary" disabled={busy || disabled}>
    <Sparkles size={14} className={busy ? 'animate-pulse' : ''} aria-hidden="true" />
    {busy ? 'Launching…' : 'Launch RFD3 Run'}
  </button>
);