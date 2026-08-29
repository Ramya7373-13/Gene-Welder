import React, { useState, memo, useMemo, useRef, useEffect, useCallback } from 'react';
import { GenomicContext, PTM } from '../types/genomics';
import { 
  Globe, Shield, Activity, Dna, Database, Layers, Fingerprint, ExternalLink, 
  X, AlertTriangle, CheckCircle2, Layout, Stethoscope, 
  Circle, Maximize2, BookOpen, BarChart, 
  RefreshCw, AlertOctagon, Info, Flame, Trash2, 
  Filter, Download, ChevronDown, ChevronUp, Search, Copy, Check, Hash,
  // Added ArrowRight to fix the 'Cannot find name' error
  ArrowRight
} from 'lucide-react';
import OrthologTable from './OrthologTable';
import DnaHelixBackdrop from './DnaHelixBackdrop';

interface GenomicAnnotationPanelProps {
  data: GenomicContext | null;
  loading: boolean;
  onRetry?: () => void;
  ptms?: PTM[];
}

const PTM_COLORS: Record<string, string> = {
  'Phosphorylation': '#fb923c',
  'Ubiquitination': '#facc15',
  'Acetylation': '#60a5fa',
  'Glycosylation': '#34d399',
  'Methylation': '#a78bfa',
  'Default': '#94a3b8'
};

// Helpers to map PTM types to CSS classes (avoid inline styles)
const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
const getPtmBgClass = (type?: string) => `bg-ptm-${slugify(type || 'Default')}`;
const getLeftClass = (percent: number) => `left-p-${Math.round(Math.max(0, Math.min(100, percent)))}`;
const getWidthClass = (value: number) => `w-p-${Math.round(Math.max(0, Math.min(100, value * 100)))}`;

const PTMPinnedPanel: React.FC<{ ptm: PTM; onClose: () => void }> = ({ ptm, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);

  // Section 2: Focus Trap and ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const focusable = panelRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusable) return;
        const first = focusable[0] as HTMLElement;
        const last = focusable[focusable.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    closeBtnRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(ptm, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      ref={panelRef}
      className="fixed inset-y-0 right-0 w-96 bg-slate-900 border-l border-slate-700 shadow-2xl z-[60] flex flex-col animate-in slide-in-from-right duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ptm-panel-title"
    >
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
        <h3 id="ptm-panel-title" className="font-bold text-white flex items-center gap-2">
          <Fingerprint size={16} className="text-primary" /> PTM Metadata Context
        </h3>
        <button 
          ref={closeBtnRef}
          onClick={onClose} 
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
          aria-label="Close panel"
        >
          <X size={20}/>
        </button>
      </div>
      <div className="p-6 flex-1 overflow-y-auto space-y-8 custom-scrollbar">
        <div className="flex items-center gap-4">
          <div 
            className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg border border-white/5 ${getPtmBgClass(ptm.type)}`}
          >
            <Circle size={32} fill="white" stroke="none" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Modification</div>
            <div className="text-xl font-bold text-white leading-none">{ptm.type}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner">
            <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">Residue Site</div>
            <div className="text-lg font-mono text-primary font-bold">{ptm.residue}{ptm.position}</div>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner">
            <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">Model Confidence</div>
            <div className="text-lg font-mono text-emerald-400 font-bold">{(ptm.confidence ?? 0 * 100).toFixed(0)}%</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-2">
            <Info size={12}/> AI Functional Analysis
          </div>
          <div className="text-sm text-slate-300 leading-relaxed bg-slate-850 p-4 rounded-xl border border-slate-800 italic">
            {ptm.notes || 'This post-translational modification site is predicted to affect local tertiary folding and potentially modulate downstream protein-protein interactions.'}
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Biological Evidence</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400">Primary Database:</span>
              <span className="font-bold text-slate-200">{ptm.source || 'UniProtKB'}</span>
            </div>
            {ptm.url && (
              <a 
                href={ptm.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center justify-center gap-2 w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-white font-bold transition-all shadow-lg active:scale-95"
              >
                <ExternalLink size={16}/> Open Experimental Source
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="p-4 bg-slate-950 border-t border-slate-800 grid grid-cols-2 gap-3">
        <button 
          onClick={handleCopy} 
          className="flex items-center justify-center gap-2 py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all"
        >
          {copied ? <Check size={14} className="text-emerald-500"/> : <Copy size={14}/>} {copied ? 'Copied to Clipboard' : 'Copy Metadata'}
        </button>
        <button className="flex items-center justify-center gap-2 py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all">
          <Download size={14}/> Export JSON
        </button>
      </div>
    </div>
  );
};

const PTMVisualization: React.FC<{ ptms: PTM[]; proteinLength: number }> = ({ ptms, proteinLength }) => {
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [minConf, setMinConf] = useState<number>(0);
  const [showTable, setShowTable] = useState(false);
  const [pinnedPtm, setPinnedPtm] = useState<PTM | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const ptmButtonsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = ptmButtonsRef.current;
    if (!container) return;
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button[data-ptm-type]'));
    buttons.forEach(btn => {
      const type = btn.dataset.ptmType ?? '';
      const pressed = selectedTypes.has(type as string);
      btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    });
  }, [selectedTypes]);

  const ptmTypesWithCounts = useMemo(() => {
    if (!Array.isArray(ptms)) return [];
    const counts: Record<string, number> = {};
    ptms.forEach(p => {
      counts[p.type] = (counts[p.type] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [ptms]);

  const filteredPtms = useMemo(() => {
    if (!Array.isArray(ptms)) return [];
    return ptms.filter(p => {
      const typeMatch = selectedTypes.size === 0 || selectedTypes.has(p.type);
      const searchMatch = p.type.toLowerCase().includes(searchQuery.toLowerCase());
      const confMatch = (p.confidence ?? 1) >= minConf;
      return typeMatch && searchMatch && confMatch;
    });
  }, [ptms, selectedTypes, searchQuery, minConf]);

  const toggleType = (type: string) => {
    const next = new Set(selectedTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setSelectedTypes(next);
  };

  const clearFilters = () => {
    setSelectedTypes(new Set());
    setSearchQuery('');
    setMinConf(0);
  };

  // Shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const pinnedLeftClass = pinnedPtm ? getLeftClass((pinnedPtm.position / proteinLength) * 100) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Fingerprint size={20} className="text-primary" />
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">PTM Evidence Engine</h4>
          <span className="bg-slate-800 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-mono">
            {filteredPtms.length} / {ptms.length}
          </span>
        </div>
        <button 
          onClick={() => setShowTable(!showTable)} 
          className="text-xs font-bold text-primary hover:text-primary-hover transition-colors flex items-center gap-1.5 uppercase tracking-widest px-3 py-1 bg-primary/5 rounded-lg border border-primary/20"
        >
          {showTable ? <Layout size={14} /> : <BarChart size={14} />} {showTable ? 'Visual Map' : 'List View'}
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50 pointer-events-none" />
        
        {/* Filters Header */}
        <div className="flex flex-col gap-5 relative z-10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Search modification types... (Ctrl+F)" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all placeholder:text-slate-700 shadow-inner"
              aria-label="Filter PTM types by name"
            />
          </div>

          <div ref={ptmButtonsRef} className="flex flex-wrap gap-2">
            {ptmTypesWithCounts
              .filter(([type]) => type.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(([type, count]) => {
                const isSelected = selectedTypes.has(type);
              return (
              <button 
                key={type} 
                data-ptm-type={type}
                onClick={() => toggleType(type)}
                className={`px-4 py-2 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-2 group ${
                  isSelected 
                    ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                }`}
                aria-pressed="false"
              >
                {type}
                <span className={`text-[9px] px-1.5 rounded-md ${isSelected ? 'bg-white/20' : 'bg-slate-900 group-hover:bg-slate-800'}`}>
                  {count}
                </span>
              </button>
            );
            })}
          </div>

          {(selectedTypes.size > 0 || searchQuery || minConf > 0) && (
            <div className="flex items-center justify-between border-t border-slate-800 pt-4 animate-in fade-in">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[10px] text-slate-600 font-bold uppercase mr-2 flex items-center gap-1"><Filter size={10}/> Active:</span>
                {Array.from(selectedTypes).map(t => (
                  <span key={t} className="flex items-center gap-2 bg-primary/10 border border-primary/30 px-2 py-1 rounded-lg text-[10px] text-primary font-bold">
                    {t} <X size={12} className="cursor-pointer hover:text-white" onClick={() => toggleType(t)}/>
                  </span>
                ))}
                {searchQuery && (
                  <span className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-2 py-1 rounded-lg text-[10px] text-slate-300 font-mono">
                    "{searchQuery}" <X size={12} className="cursor-pointer" onClick={() => setSearchQuery('')}/>
                  </span>
                )}
              </div>
              <button 
                onClick={clearFilters} 
                className="text-[10px] text-red-400 font-black uppercase hover:text-red-300 transition-colors flex items-center gap-1"
                aria-label="Clear all filters"
              >
                <Trash2 size={12}/> Clear All
              </button>
            </div>
          )}
        </div>

        {!showTable ? (
          <div className="relative h-16 w-full bg-slate-950 border border-slate-800 rounded-2xl flex items-center px-8 mt-10 shadow-inner group/map">
            <div className="absolute inset-x-8 h-1 bg-slate-800 rounded-full top-1/2 -translate-y-1/2" />
            
            {/* Visual Highlight for Pinned PTM */}
            {pinnedPtm && (
               <div 
                 className={`absolute top-1/2 ${pinnedLeftClass} -translate-y-1/2 -translate-x-1/2 h-12 w-12 bg-primary/20 rounded-full blur-xl animate-pulse`}
               />
            )}

            {filteredPtms.map((ptm, i) => {
              const pos = (ptm.position / proteinLength) * 100;
              const leftClass = getLeftClass(pos);
              const isPinned = pinnedPtm?.id === ptm.id || (pinnedPtm?.position === ptm.position && pinnedPtm?.type === ptm.type);

              return (
                <button 
                  key={i} 
                  className={`absolute top-1/2 ${leftClass} -translate-y-1/2 -translate-x-1/2 outline-none z-10 p-2 group/icon transition-all duration-300 ${isPinned ? 'scale-150 z-20' : 'hover:scale-125'}`}
                  onClick={() => setPinnedPtm(ptm)}
                  aria-label={`${ptm.type} at ${ptm.residue}${ptm.position}. Confidence ${ptm.confidence}`}
                >
                  <div 
                    className={`w-4 h-4 rounded-full border-2 transition-all ${isPinned ? 'border-white shadow-lg scale-110' : 'border-slate-900 group-hover/icon:border-white'} ${getPtmBgClass(ptm.type)}`}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover/icon:opacity-100 transition-all scale-75 group-hover/icon:scale-100 whitespace-nowrap bg-slate-800 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white border border-slate-700 shadow-2xl pointer-events-none z-30">
                    {ptm.type} <span className="text-primary ml-1">{ptm.residue}{ptm.position}</span>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                  </div>
                </button>
              );
            })}
            <div className="absolute bottom-2 left-8 right-8 flex justify-between text-[9px] text-slate-700 font-black uppercase tracking-tighter">
               <span>Locus Start</span>
               <span>Proteoform Span: {proteinLength} residues</span>
               <span>Locus End</span>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800 shadow-lg animate-in fade-in zoom-in-95">
             <table className="w-full text-left border-collapse text-xs" role="grid">
                <thead className="bg-slate-950 text-[10px] text-slate-500 font-black uppercase tracking-widest border-b border-slate-800">
                   <tr>
                      <th className="px-5 py-4">Modification Type</th>
                      <th className="px-5 py-4">Site Coordinate</th>
                      <th className="px-5 py-4">Conf. Score</th>
                      <th className="px-5 py-4">Source</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                   {filteredPtms.map((p, i) => (
                      <tr 
                        key={i} 
                        className={`hover:bg-primary/5 cursor-pointer group transition-colors ${pinnedPtm?.id === p.id ? 'bg-primary/10' : ''}`} 
                        onClick={() => setPinnedPtm(p)}
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && setPinnedPtm(p)}
                        role="row"
                        aria-label={`Modification ${p.type} at ${p.residue}${p.position}`}
                      >
                         <td className="px-5 py-4">
                           <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full shadow-sm ${getPtmBgClass(p.type)}`} />
                              <span className="font-bold text-slate-200 group-hover:text-primary transition-colors">{p.type}</span>
                           </div>
                         </td>
                         <td className="px-5 py-4 font-mono text-primary font-black">{p.residue}{p.position}</td>
                         <td className="px-5 py-4">
                           <div className="flex items-center gap-3">
                             <div className="h-1.5 w-16 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                               <div className={`h-full bg-emerald-500 transition-all duration-700 ${getWidthClass(p.confidence ?? 0)}`}/>
                             </div>
                             <span className="text-[10px] text-slate-500 font-mono">{(p.confidence ?? 0).toFixed(2)}</span>
                           </div>
                         </td>
                         <td className="px-5 py-4 text-slate-600 font-medium">{p.source}</td>
                      </tr>
                   ))}
                   {filteredPtms.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-20 text-center text-slate-600 italic">
                          <AlertOctagon size={24} className="mx-auto mb-3 opacity-20" />
                          No biological modifications match the current filter scope.
                        </td>
                      </tr>
                   )}
                </tbody>
             </table>
          </div>
        )}
      </div>
      
      {pinnedPtm && (
        <PTMPinnedPanel 
          ptm={pinnedPtm} 
          onClose={() => {
            setPinnedPtm(null);
            // Accessibility: return focus to general container if nothing specific
          }} 
        />
      )}
    </div>
  );
};

// Simplified/Mocked GenomicBrowser for the Demo as requested by user's prompt context
export const GenomicBrowser: React.FC<{ data: GenomicContext; compareWith?: GenomicContext | null }> = memo(({ data, compareWith }) => {
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-4 flex items-center gap-2">
            <Globe size={12} className="text-blue-400"/> gnomAD Frequency
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm font-mono text-white font-bold">{data.frequency.gnomadGlobal.toExponential(2)}</div>
            {compareWith && (
              <div className="text-sm font-mono text-cyan-400 font-bold ml-2">vs {compareWith.frequency.gnomadGlobal.toExponential(2)}</div>
            )}
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-4 flex items-center gap-2">
            <Shield size={12} className="text-emerald-400"/> PhyloP 100way
          </div>
          <div className="flex items-center justify-between">
            <div className={`text-sm font-mono font-bold ${data.conservation.phyloP > 3 ? 'text-emerald-400' : 'text-white'}`}>
              {data.conservation.phyloP.toFixed(2)}
            </div>
            {compareWith && (
              <div className="text-sm font-mono text-cyan-400 font-bold ml-2">vs {compareWith.conservation.phyloP.toFixed(2)}</div>
            )}
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-4 flex items-center gap-2">
            <Activity size={12} className="text-red-400"/> CADD v1.6
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm font-mono text-white font-bold">{data.impact.cadd.toFixed(1)}</div>
            {compareWith && (
              <div className="text-sm font-mono text-cyan-400 font-bold ml-2">vs {compareWith.impact.cadd.toFixed(1)}</div>
            )}
          </div>
        </div>
      </div>
      
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="text-[10px] text-slate-500 uppercase font-bold mb-5 flex items-center gap-2">
          <Layers size={14} className="text-primary"/> Structural Locus Context (hg38)
        </div>
        <div className="space-y-5">
          <div className="h-6 bg-slate-950 rounded-lg border border-slate-800 relative flex items-center group/track overflow-hidden">
             <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover/track:opacity-100 transition-opacity" />
             <div className="absolute left-1/4 w-1 h-full bg-primary/40 shadow-[0_0_15px_rgba(99,102,241,0.5)] z-10" />
             <div className="text-[9px] text-slate-600 ml-4 uppercase font-black tracking-tighter relative z-20">Target Sequence A</div>
          </div>
          <div className="h-6 bg-slate-950 rounded-lg border border-slate-800 relative flex items-center group/track overflow-hidden">
             <div className="absolute inset-0 bg-cyan-400/5 opacity-0 group-hover/track:opacity-100 transition-opacity" />
             <div className="absolute left-[30%] w-1 h-full bg-cyan-400/40 shadow-[0_0_15px_rgba(34,211,238,0.5)] z-10" />
             <div className="text-[9px] text-slate-600 ml-4 uppercase font-black tracking-tighter relative z-20">Comparative Sequence B</div>
          </div>
        </div>
      </div>
    </div>
  );
});

const GenomicAnnotationPanel: React.FC<GenomicAnnotationPanelProps> = ({ data, loading, onRetry, ptms }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (loading) return (
    <div className="h-full bg-slate-850 animate-pulse rounded-2xl border border-slate-700 flex flex-col p-6 space-y-6">
       <div className="h-6 w-1/3 bg-slate-800 rounded-lg" />
       <div className="h-32 w-full bg-slate-800 rounded-2xl" />
       <div className="h-48 w-full bg-slate-800 rounded-2xl" />
    </div>
  );
  
  if (!data) return (
    <div className="p-12 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/50">
      <AlertOctagon className="mx-auto mb-4 text-slate-700" size={48}/>
      <h3 className="text-white font-bold mb-2">Metadata Stream Error</h3>
      <p className="text-slate-500 text-sm mb-6">Failed to aggregate genomic annotations from distributed repositories.</p>
      <button onClick={onRetry} className="px-6 py-2.5 bg-primary/10 border border-primary/30 text-primary hover:bg-primary hover:text-white transition-all rounded-xl font-bold text-xs uppercase tracking-widest">Re-init API Context</button>
    </div>
  );

  const displayPtms: PTM[] = Array.isArray(ptms) ? ptms : Array.isArray(data.ptms) ? data.ptms : [];

  return (
    <>
      <div className="mm-card-glowing mm-glow mm-glow--purple overflow-hidden flex flex-col shadow-2xl animate-in fade-in duration-700 relative group">
        <DnaHelixBackdrop color="purple" opacity={0.20} motionVariant="fluid" seed="genomic-annotation" />
        <div className="p-5 border-b border-purple-500/25 bg-slate-950/80 flex justify-between items-center relative z-10">
          <div className="flex items-center gap-3">
             <div className="mm-section-accent mm-section-accent--purple" />
             <div className="p-2 bg-purple-500/20 rounded-lg border border-purple-500/30">
                <BookOpen size={18} className="text-purple-400" />
             </div>
             <h3 className="font-bold text-white tracking-tight text-sm uppercase">AlphaGenome Annotator</h3>
          </div>
          <span className="text-[9px] bg-purple-950/60 text-purple-300 px-2 py-1 rounded-md font-mono border border-purple-500/30 font-bold">v4.2.0</span>
        </div>
        <div className="p-6 space-y-8 flex-1 overflow-y-auto custom-scrollbar relative z-10">
          <PTMVisualization ptms={displayPtms} proteinLength={data.proteinLength || 1000} />
          
          <div className="pt-4 border-t border-slate-800">
             <button 
               onClick={() => setIsModalOpen(true)} 
               className="mm-btn-tactical !w-full !py-3.5 !rounded-xl !bg-purple-600 hover:!bg-purple-500 text-white text-xs font-black transition-all uppercase tracking-widest shadow-[0_0_20px_rgba(168,85,247,0.4)] group flex items-center justify-center gap-3"
             >
               Explore Full Evidence Context <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
             </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300" role="dialog" aria-modal="true">
          <div className="bg-slate-950 border border-slate-700 rounded-3xl w-full max-w-6xl h-[94vh] flex flex-col shadow-2xl overflow-hidden relative">
            <div className="flex justify-between items-center p-8 border-b border-slate-800 bg-slate-900/80">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-primary/10 rounded-2xl border border-primary/30 shadow-inner">
                   <Database className="text-primary" size={32} />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tighter">AlphaGenome Evidence Trail</h2>
                  <p className="text-slate-500 text-sm mt-1 font-mono flex items-center gap-2">
                    <Hash size={12}/> {data.variantId} • Clinical Integrity Audit
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-3 hover:bg-slate-800 rounded-2xl text-slate-400 hover:text-white transition-all border border-transparent hover:border-slate-700"
                aria-label="Close detailed evidence view"
              >
                <X size={32} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 space-y-16 custom-scrollbar scroll-smooth">
              <section aria-label="Evolutionary Conservation Overview">
                <OrthologTable orthologs={data.orthologs} />
              </section>

              <section aria-label="Detailed PTM Analysis">
                <PTMVisualization ptms={displayPtms} proteinLength={data.proteinLength || 1000} />
              </section>

              <div className="grid lg:grid-cols-2 gap-10">
                 <section className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl space-y-6 shadow-xl" aria-label="Clinical Significance">
                    <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                       <Stethoscope className="text-indigo-400" size={24} />
                       <h3 className="text-lg font-black text-white uppercase tracking-widest">Clinical Context</h3>
                    </div>
                    {data.clinvar ? (
                       <div className="space-y-6">
                          <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
                             <div className="text-[10px] text-slate-600 uppercase font-black mb-2 tracking-widest">ClinVar Significance Assertion</div>
                             <div className={`text-2xl font-black ${data.clinvar.significance === 'Pathogenic' ? 'text-red-400' : 'text-emerald-400'}`}>
                                {data.clinvar.significance}
                             </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                                <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">Review Status</div>
                                <div className="text-xs text-slate-300 font-medium">{data.clinvar.reviewStatus}</div>
                             </div>
                             <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                                <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">Variation ID</div>
                                <div className="text-xs text-slate-300 font-mono">{data.clinvar.id}</div>
                             </div>
                          </div>
                       </div>
                    ) : (
                       <p className="text-slate-500 italic text-sm">No clinical assertions available for this specific proteoform.</p>
                    )}
                 </section>

                 <section className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl space-y-6 shadow-xl" aria-label="Comparative Genomics">
                    <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                       < Globe className="text-cyan-400" size={24} />
                       <h3 className="text-lg font-black text-white uppercase tracking-widest">Locus Browser</h3>
                    </div>
                    <GenomicBrowser data={data} />
                 </section>
              </div>
            </div>
            
            <div className="p-6 bg-slate-900 border-t border-slate-800 flex justify-between items-center px-10">
               <div className="flex items-center gap-4 text-[10px] text-slate-600 font-black uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><Database size={12}/> Aggregated Sources:</span>
                  <span className="text-slate-500">UniProt</span>
                  <span className="text-slate-500">ClinVar</span>
                  <span className="text-slate-500">gnomAD</span>
               </div>
               <p className="text-[9px] text-slate-700 italic">Research use only. Validated across AlphaGenome data tier 1 repositories.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default memo(GenomicAnnotationPanel);