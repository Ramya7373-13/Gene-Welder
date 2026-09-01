import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import VariantSelector from './VariantSelector';
import StructureCharts from './StructureCharts';
import AnalysisPanel from './AnalysisPanel';
import ProteinStructureViewer from './ProteinStructureViewer';
import { AnalysisResponse } from '../types';
import { MOCK_ANALYSIS } from '../constants';
import { AlertCircle, RefreshCw, ServerCrash, Save, Book, ChevronRight, Play, Download, Upload, Trash2, Edit, Filter, ListFilter, X, Plus, FlaskConical } from 'lucide-react';
import EmptyState from './EmptyState';
import { presetStorage, PresetSchema } from '../utils/presetStorage';
import DnaHelixBackdrop, { DnaThemeColor, MotionVariant } from './DnaHelixBackdrop';

export interface BenchmarkPreset {
  id: string;
  title: string;
  hgvs: string;
  type: 'frameshift' | 'splice' | 'control' | 'folding' | 'custom';
  description?: string;
  expectedImpact?: string;
}

const DEFAULT_PRESETS: BenchmarkPreset[] = [
  { id: 'brca2-fs', title: 'BRCA2 Frameshift', hgvs: 'BRCA2 c.5946delT', type: 'frameshift', description: 'p.Ser1982ArgfsTer22', expectedImpact: 'Severe truncation' },
  { id: 'tp53-fs', title: 'TP53 Frameshift', hgvs: 'TP53 c.375_376insA', type: 'frameshift', description: 'p.Ser126fs', expectedImpact: 'Loss of DNA binding' },
  { id: 'dmd-splice', title: 'DMD Exon 44 Donor Loss', hgvs: 'DMD c.6429+1G>A', type: 'splice', description: 'Splice site disruption (Donor Loss)', expectedImpact: 'Exon skipping' },
  { id: 'cftr-folding', title: 'CFTR F508del', hgvs: 'CFTR c.1521_1523delCTT', type: 'folding', description: 'p.Phe508del', expectedImpact: 'Misfolding & degradation' }
];

interface CompensatoryDesignTabProps {
  onSourceChange?: (source: 'API' | 'CACHE' | 'SIMULATION') => void;
}

const CompensatoryDesignTab: React.FC<CompensatoryDesignTabProps> = ({ onSourceChange }) => {
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [analysisData, setAnalysisData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderStyle, setRenderStyle] = useState<'cartoon' | 'sphere' | 'stick'>('cartoon');

  const [customPresets, setCustomPresets] = useState<PresetSchema[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [presetForm, setPresetForm] = useState<Partial<PresetSchema>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dataCache = useRef<Record<string, AnalysisResponse>>({});
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCustomPresets(presetStorage.getPresets());
    
    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (selectedVariantId) setIsSaveModalOpen(true);
      }
      if (e.key === 'Escape') setIsSaveModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
    };
  }, [selectedVariantId]);

  const allPresets = useMemo(() => {
    return [...DEFAULT_PRESETS, ...customPresets];
  }, [customPresets]);

  const filteredPresets = useMemo(() => {
    if (categoryFilter === 'ALL') return allPresets;
    return allPresets.filter(p => p.type === categoryFilter);
  }, [allPresets, categoryFilter]);

  const handleSavePreset = () => {
    if (!presetForm.title) return;
    const updated = presetStorage.savePreset({
      id: presetForm.id || `custom-${Date.now()}`,
      title: presetForm.title,
      hgvs: selectedVariantId,
      type: 'custom',
      description: presetForm.description || '',
    });
    setCustomPresets(updated);
    setIsSaveModalOpen(false);
    setPresetForm({});
  };

  const handleDeletePreset = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Delete this preset?')) {
      setCustomPresets(presetStorage.deletePreset(id));
    }
  };

  const handleExport = () => {
    const data = presetStorage.exportPresets();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mutation_mechanic_presets.json';
    link.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = presetStorage.importPresets(evt.target?.result as string);
        setCustomPresets(imported);
      } catch (err) {
        alert((err as Error).message);
      }
    };
    reader.readAsText(file);
  };

  const simulateStreaming = useCallback((fullData: AnalysisResponse) => {
    setIsStreaming(true);
    setAnalysisData({ ...fullData, aiAnalysis: { summary: '', compensatory_mutations: [] } });
    const fullSummary = fullData.aiAnalysis?.summary || '';
    let charIndex = 0;
    const typeNextChunk = () => {
      if (charIndex < fullSummary.length) {
        charIndex = Math.min(charIndex + 2, fullSummary.length);
        setAnalysisData(prev => {
          if (!prev || !prev.aiAnalysis) return null;
          return { ...prev, aiAnalysis: { ...prev.aiAnalysis, summary: fullSummary.slice(0, charIndex) } };
        });
        streamTimeoutRef.current = setTimeout(typeNextChunk, 40);
      } else {
        setAnalysisData(prev => ({ ...prev!, aiAnalysis: fullData.aiAnalysis }));
        setIsStreaming(false);
      }
    };
    typeNextChunk();
  }, []);

  const loadVariantData = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setAnalysisData(null);
    try {
      let data: AnalysisResponse;
      if (dataCache.current[id]) {
        data = dataCache.current[id];
      } else {
        const backendUrl = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:5000';
        const response = await fetch(`${backendUrl}/api/ai/variant-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gene: id.split(/\s+/)[0], variant: id, mode: 'design' })
        });
        if (!response.ok) throw new Error(`Gemini backend returned ${response.status}`);
        data = await response.json() as AnalysisResponse;
        onSourceChange?.(data.source || 'API');
        dataCache.current[id] = data;
      }
      onSourceChange?.(data.source || 'SIMULATION');
      setLoading(false);
      simulateStreaming(data);
    } catch (err: any) {
      let mockKey = id;
      if (id.includes('F508del')) mockKey = 'CFTR-F508del';
      if (id.includes('TP53')) mockKey = 'TP53-R248Q';
      const fallback = MOCK_ANALYSIS[mockKey] || MOCK_ANALYSIS[Object.keys(MOCK_ANALYSIS)[0]];
      dataCache.current[id] = { ...fallback, source: 'SIMULATION' };
      onSourceChange?.('SIMULATION');
      setLoading(false);
      setError(`Gemini unavailable; showing benchmark fallback. ${err.message || ''}`.trim());
      simulateStreaming({ ...fallback, source: 'SIMULATION' });
    }
  }, [onSourceChange, simulateStreaming]);

  useEffect(() => {
    if (selectedVariantId) loadVariantData(selectedVariantId);
  }, [selectedVariantId, loadVariantData]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="mm-card-glowing mm-glow mm-glow--cyan p-6 shadow-xl group">
        <DnaHelixBackdrop color="cyan" opacity={0.20} motionVariant="fluid" seed="benchmark-repo" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex items-center gap-4">
            <h3 className="font-bold text-white flex items-center gap-2"><Book size={18} className="text-primary"/> Benchmark Repository</h3>
            <div className="flex flex-wrap gap-1.5 bg-slate-950/60 p-1 rounded-lg border border-slate-800">
               {(['ALL', 'frameshift', 'splice', 'folding', 'custom'] as const).map(cat => (
                 <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  aria-pressed={categoryFilter === cat}
                  className={[
                    'px-3 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md',
                    'transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70',
                    categoryFilter === cat
                      ? 'bg-cyan-400/15 border border-cyan-400/40 text-cyan-400'
                      : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800 border border-transparent',
                  ].join(' ')}
                 >
                   {cat}
                 </button>
               ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white" title="Import Presets"><Upload size={16}/></button>
            <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json"/>
            <button onClick={handleExport} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white" title="Export Presets"><Download size={16}/></button>
            <button 
              onClick={() => { setPresetForm({}); setIsSaveModalOpen(true); }}
              disabled={!selectedVariantId}
              className="ml-2 flex items-center gap-2 bg-primary hover:bg-primary-hover px-4 py-2 rounded-lg text-white text-xs font-bold transition-all disabled:opacity-50"
            >
              <Save size={14}/> Save Preset (Ctrl+S)
            </button>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
          {filteredPresets.map(preset => {
            const getTheme = (type: string): { color: DnaThemeColor; motionVariant: MotionVariant; glowClass: string } => {
              switch (type) {
                case 'frameshift': return { color: 'rose', motionVariant: 'chaotic', glowClass: 'mm-glow--rose' };
                case 'splice': return { color: 'cyan', motionVariant: 'fluid', glowClass: 'mm-glow--cyan' };
                case 'folding': return { color: 'emerald', motionVariant: 'pulse', glowClass: 'mm-glow--emerald' };
                case 'control': return { color: 'blue', motionVariant: 'rhythmic', glowClass: 'mm-glow--blue' };
                default: return { color: 'amber', motionVariant: 'angular', glowClass: 'mm-glow--amber' };
              }
            };
            const theme = getTheme(preset.type);
            const isSelected = selectedVariantId === preset.hgvs;
            return (
            <button
              key={preset.id}
              onClick={() => setSelectedVariantId(preset.hgvs)}
              aria-pressed={isSelected}
              className={[
                `mm-card-glowing mm-glow ${theme.glowClass} text-left p-3 rounded-xl border transition-all duration-200 relative group`,
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70',
                'active:scale-[0.98]',
                isSelected
                  ? `mm-glow--active shadow-[0_0_12px_rgba(var(--mm-glow-rgb),0.35)] border-${theme.color}-500/50 bg-${theme.color}-400/10`
                  : 'bg-slate-900 border-slate-800 hover:border-slate-600 hover:-translate-y-px hover:shadow-md',
              ].join(' ')}
            >
              <DnaHelixBackdrop color={theme.color} opacity={0.22} motionVariant={theme.motionVariant} seed={preset.id} />
              <div className="relative z-10">
                <div className={`font-bold text-xs mb-1 transition-colors ${isSelected ? `text-${theme.color}-300` : `text-slate-100 group-hover:text-${theme.color}-400`}`}>{preset.title}</div>
                <div className="font-mono text-[9px] text-slate-500 truncate mb-2">{preset.hgvs}</div>
                <div className="flex justify-between items-center">
                  <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold ${preset.type === 'custom' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25' : 'bg-slate-800 text-slate-400'}`}>{preset.type}</span>
                  {preset.type === 'custom' && (
                    <button
                      onClick={(e) => handleDeletePreset(e, preset.id)}
                      aria-label={`Delete preset ${preset.title}`}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-red-400 transition-all focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-red-400/50 rounded"
                    >
                      <Trash2 size={12} aria-hidden="true"/>
                    </button>
                  )}
                </div>
              </div>
            </button>
          )})}
          {filteredPresets.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon={Filter}
                headline="No presets in this category"
                subtext="Try switching to 'ALL' or add a custom preset."
                size="compact"
              />
            </div>
          )}
        </div>
      </div>

      <VariantSelector selectedId={selectedVariantId} onSelect={setSelectedVariantId} loading={loading || isStreaming}/>

      {(loading || analysisData) ? (
        <>
          {/* AlphaFold 3 Structure Panel */}
          {(loading || analysisData?.pdbData?.native) && (
            <div className="mm-card-glowing mm-glow mm-glow--cyan p-6 rounded-xl shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-4 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="mm-section-accent mm-section-accent--blue" />
                  <h3 className="text-xs font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline><polyline points="7.5 19.79 7.5 14.6 3 12"></polyline><polyline points="21 12 16.5 14.6 16.5 19.79"></polyline><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                    AlphaFold 3 Structure
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">M34-Type</span>
                  <div className="flex bg-slate-800 rounded-lg border border-slate-700 p-0.5">
                    {(['cartoon', 'sphere', 'stick'] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() => setRenderStyle(style)}
                        aria-pressed={renderStyle === style}
                        className={[
                          'px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all',
                          renderStyle === style
                            ? 'bg-primary/30 text-primary border border-primary/50 shadow-[0_0_8px_rgba(var(--mm-color-primary),0.3)]'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
                        ].join(' ')}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="relative z-10">
                <ProteinStructureViewer
                  pdbData={analysisData?.pdbData?.native || null}
                  gene={selectedVariantId?.split(/[\s:]/)[0] || ''}
                  highlightResidue={parseInt(selectedVariantId?.match(/(\d+)/)?.[1] || '1', 10)}
                  loading={loading}
                  label="AlphaFold 3D"
                  colorBy="confidence"
                  renderStyle={renderStyle}
                  onRenderStyleChange={setRenderStyle}
                  structuralMetrics={analysisData?.predictions?.native ? {
                    plddt_avg: analysisData.predictions.native.plddt_avg,
                    rmsd_to_wildtype: analysisData.predictions.delta.rmsd,
                    domains_affected: analysisData.predictions.native.domains_affected,
                    wildtype_structure_path: null,
                    mutant_structure_path: null,
                    alphaFold_version: null,
                  } : null}
                />
              </div>
            </div>
          )}

          {/* Charts and Analysis Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            <div className="xl:col-span-7"><StructureCharts data={analysisData?.predictions} loading={loading}/></div>
            <div className="xl:col-span-5"><AnalysisPanel data={analysisData} loading={loading} isStreaming={isStreaming}/></div>
          </div>
        </>
      ) : !loading && !selectedVariantId && (
        <div className="mm-card-glowing mm-glow mm-glow--cyan p-8 text-center group">
          <DnaHelixBackdrop color="cyan" opacity={0.20} motionVariant="fluid" seed="design-empty" />
          <EmptyState
            icon={FlaskConical}
            headline="Select a variant to begin"
            subtext="Choose from the benchmark repository above, or enter a custom HGVS notation in the selector."
          />
        </div>
      )}

      {/* Save Preset Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in" role="dialog" aria-modal="true">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2"><Save size={16} className="text-primary"/> Save Benchmark</h3>
              <button onClick={() => setIsSaveModalOpen(false)}><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Benchmark Title</label>
                <input 
                  type="text" 
                  value={presetForm.title || ''} 
                  onChange={e => setPresetForm({...presetForm, title: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. BRCA2 Stability Control"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Description</label>
                <textarea 
                  value={presetForm.description || ''} 
                  onChange={e => setPresetForm({...presetForm, description: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:ring-1 focus:ring-primary h-24 text-xs"
                  placeholder="Optional impact notes..."
                />
              </div>
              <div className="bg-slate-850 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                <div className="text-[10px] text-slate-500 uppercase font-bold">HGVS Variant</div>
                <div className="text-xs font-mono text-primary font-bold">{selectedVariantId}</div>
              </div>
            </div>
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2">
              <button onClick={() => setIsSaveModalOpen(false)} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold text-white">Cancel</button>
              <button onClick={handleSavePreset} className="flex-1 py-2 bg-primary hover:bg-primary-hover rounded text-xs font-bold text-white shadow-lg shadow-primary/20">Commit to Store</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompensatoryDesignTab;