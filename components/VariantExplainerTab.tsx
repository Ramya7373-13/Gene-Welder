import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Loader, BookOpen, Search, ArrowLeft, Printer, Activity, Scale, CheckSquare, Square, X, Plus, Database, History, Box, Dna, Globe, ChevronDown } from 'lucide-react';
import EmptyState from './EmptyState';
import MechanismExplainer from './MechanismExplainer';
import ProteinStructureViewer from './ProteinStructureViewer';
import ConfidenceHeatmap from './ConfidenceHeatmap';
import GenomicAnnotationPanel, { GenomicBrowser } from './GenomicAnnotationPanel';
import AnalysisPanel from './AnalysisPanel';
import ToastNotification, { ToastType } from './ToastNotification';
import DnaHelixBackdrop from './DnaHelixBackdrop';
import PrintableVariantReport from './PrintableVariantReport';
import { getVariantGlowTheme } from '../utils/themeUtils';
import { VariantInfo } from '../types';
import { GenomicContext } from '../types/genomics';
import { DISEASE_VARIANTS } from '../constants';
import { fetchUniProtInfo } from '../utils/uniprot';
import { generateVariantReport, VariantAnalysis } from '../services/geminiService';
import { alphafoldClient } from '../utils/alphafoldClient';
import { genomicAnnotationService } from '../services/genomicAnnotationService';
import { historyService, MutationType } from '../services/historyService';
import { backendService } from '../services/backendService';

const HISTORY_KEY = 'mutationMechanic_explainer_history';
const MAX_HISTORY = 10;

const fetchStructuralMetrics = async (gene: string): Promise<ExtendedAnalysis['structuralMetrics']> => {
  try {
    const response = await fetch(`${backendService.getBaseUrl()}/variants?gene=${encodeURIComponent(gene)}`);
    if (!response.ok) return undefined;
    const variants = await response.json();
    if (variants && variants.length > 0) {
      const variant = variants[0];
      return {
        plddt_avg: variant.plddt_avg,
        rmsd_to_wildtype: variant.rmsd_to_wildtype,
        domains_affected: variant.domains_affected,
        alphaFold_version: variant.alphaFold_version
      };
    }
  } catch (e) {
    console.warn('Could not fetch structural metrics:', e);
  }
  return undefined;
};

const fetchVariantExplanation = async (variantInput: string): Promise<ExtendedAnalysis> => {
  const trimmedInput = variantInput.trim();
  let gene = "";
  let variant = "";

  const known = DISEASE_VARIANTS.find(v => v.id === trimmedInput);
  if (known) {
    gene = known.protein;
    variant = known.variant;
  } else {
    const parts = trimmedInput.split(/\s+/);
    if (parts.length >= 2) {
      gene = parts[0];
      variant = parts[1];
    } else {
      gene = trimmedInput;
      variant = "Unknown";
    }
  }

  const report: ExtendedAnalysis = await generateVariantReport(gene, variant);
  const seqWT = report.variant.sequence;
  const seqMut = report.variant.mutantSequence;

  const hasUsableSequence = (sequence?: string) => Boolean(
    sequence && sequence.length > 10 && !sequence.includes('...') && /^[A-Za-z]+$/.test(sequence)
  );

  if (hasUsableSequence(seqWT)) {
    try {
      const promises = [alphafoldClient.predictStructure(seqWT, `${gene}-${variant}-WT`)];
      if (seqMut && seqMut !== seqWT) {
        promises.push(alphafoldClient.predictStructure(seqMut, `${gene}-${variant}-MUT`));
      }
      const results = await Promise.all(promises);
      report.pdbData = { native: results[0].pdb };
      report.structureSource = results[0].source;
      if (results[0].pdb) {
        const pdbLines = results[0].pdb.split('\n').filter(l => l.startsWith('ATOM') && l.includes('CA '));
        report.confidenceScores = pdbLines.map(l => {
          const b = parseFloat(l.substring(60, 66));
          return isNaN(b) ? 0 : b;
        });
      }
      if (results.length > 1) {
        report.pdbData.mutant = results[1].pdb;
      }
    } catch (e) {
      console.warn("Structure prediction failed", e);
    }
  }

  report.structuralMetrics = await fetchStructuralMetrics(gene);
  return report;
};

const SequenceViewer: React.FC<{ sequence: string; variant: string; highlightPosition?: number }> = ({ sequence, variant, highlightPosition }) => {
  let position = -1;
  if (highlightPosition !== undefined) {
    position = highlightPosition;
  } else {
    const match = variant.match(/p\.([A-Z][a-z]{0,2})?(\d+)(.+)?/);
    if (match) {
      position = parseInt(match[2], 10);
    } else {
      const numMatch = variant.match(/(\d+)/);
      if (numMatch) position = parseInt(numMatch[0], 10);
    }
  }
  const index = position - 1;
  if (!sequence || sequence.includes("UNAVAILABLE")) return <span className="text-slate-500 italic text-xs">Sequence data unavailable.</span>;
  if (index < 0 || index >= sequence.length) return <div className="font-mono text-xs text-slate-300 break-all p-3 bg-slate-950 rounded border border-slate-750">{sequence}</div>;
  const before = sequence.slice(0, index);
  const residue = sequence[index];
  const after = sequence.slice(index + 1);
  return (
    <div className="font-mono text-sm text-slate-200 break-all leading-relaxed relative bg-slate-950/80 p-3.5 rounded-xl border border-slate-750/80 shadow-[inset_0_0_12px_rgba(0,0,0,0.6)]">
      <span className="opacity-45 text-slate-400">{before}</span>
      <span className="bg-rose-500/20 text-rose-300 font-black px-1.5 py-0.5 rounded border border-rose-500/60 relative group cursor-help inline-block mx-0.5 shadow-[0_0_14px_rgba(244,63,94,0.45)] transition-all duration-300 hover:shadow-[0_0_20px_rgba(244,63,94,0.85)] hover:border-rose-400 hover:scale-110">
        {residue}
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-md border border-rose-500/40 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
          Pos {position} (Mutated Residue)
        </span>
      </span>
      <span className="opacity-45 text-slate-400">{after}</span>
    </div>
  );
};

interface HistoryItem {
  id: string;
  gene: string;
  variant: string;
  date: number;
  report: VariantAnalysis;
}

interface ExtendedAnalysis extends VariantAnalysis {
  structureSource?: string;
  confidenceScores?: number[];
  structuralMetrics?: {
    plddt_avg?: number | null;
    rmsd_to_wildtype?: number | null;
    domains_affected?: string[] | null;
    alphaFold_version?: string | null;
    wildtype_structure_path?: string | null;
  };
}

interface VariantExplainerTabProps {
  variants: VariantInfo[];
  externalVariantId?: string | null;
  onSourceChange?: (source: 'API' | 'CACHE' | 'SIMULATION') => void;
}

const VariantExplainerTab: React.FC<VariantExplainerTabProps> = ({ variants, externalVariantId, onSourceChange }) => {
  const [viewMode, setViewMode] = useState<'list' | 'report' | 'compare'>('list');
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ExtendedAnalysis | null>(null);
  const [genomicData, setGenomicData] = useState<GenomicContext | null>(null);
  const [isGenomicLoading, setIsGenomicLoading] = useState(false);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [showMutantStructure, setShowMutantStructure] = useState(false);
  const [comparisonReport, setComparisonReport] = useState<[VariantAnalysis, VariantAnalysis] | null>(null);
  const [comparisonGenomicData, setComparisonGenomicData] = useState<[GenomicContext | null, GenomicContext | null]>([null, null]);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [renderStyle, setRenderStyle] = useState<'cartoon' | 'sphere' | 'stick'>('cartoon');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [customGene, setCustomGene] = useState('');
  const [customVariant, setCustomVariant] = useState('');
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  const filteredVariants = useMemo(() => {
    if (!searchQuery.trim()) return variants;
    const q = searchQuery.toLowerCase();
    return variants.filter(v => 
      v.protein.toLowerCase().includes(q) ||
      v.variant.toLowerCase().includes(q) ||
      v.disease.toLowerCase().includes(q) ||
      v.uniprot_id?.toLowerCase().includes(q)
    );
  }, [variants, searchQuery]);
  useEffect(() => {
    if (externalVariantId) {
      handleExplain(externalVariantId);
    }
  }, [externalVariantId]);

  const handleExplain = async (variantId: string) => {
    setIsLoading(true);
    setSelectedVariantId(variantId);
    setError(null);
    setGenomicData(null);
    setShowMutantStructure(false);
    setToast({ message: "🔄 Analyzing Genomic Context...", type: 'loading' });
    try {
      const data = await fetchVariantExplanation(variantId);
      setReport(data);
      onSourceChange?.(data.source || 'SIMULATION');
      setIsGenomicLoading(true);
      const gData = await genomicAnnotationService.fetchAnnotations(data.variant.protein, data.variant.hgvs, variantId);
      setGenomicData(gData);

      // Extract position and type for analytics
      const posMatch = data.variant.hgvs.match(/(\d+)/);
      const numericPos = posMatch ? parseInt(posMatch[0], 10) : undefined;

      let mType: MutationType = 'MISSENSE';
      const notation = data.variant.hgvs.toLowerCase();
      if (notation.includes('fs') || notation.includes('del')) mType = 'FRAMESHIFT';
      else if (notation.includes('*') || notation.includes('ter')) mType = 'NONSENSE';
      else if (notation.includes('+') || notation.includes('-')) mType = 'SPLICE_SITE';

      // SECTION 1.1: Save to history service
      await historyService.addRecord({
        gene: data.variant.protein,
        variant: data.variant.hgvs,
        timestamp: Date.now(),
        riskLevel: gData.impact.cadd > 20 ? 'HIGH' : gData.impact.cadd > 10 ? 'MEDIUM' : 'LOW',
        pathogenicityScore: gData.impact.cadd,
        confidence: gData.conservation.phyloP > 3 ? 95 : 75,
        diseaseAssociations: gData.clinvar ? [gData.clinvar.phenotypes[0]] : [],
        therapies: [],
        type: 'EXPLAINER',
        variantType: mType,
        position: numericPos
      });

      setViewMode('report');
    } catch (err: any) {
      setError(err.message || 'Failed to load explanation');
    } finally {
      setIsLoading(false);
      setIsGenomicLoading(false);
      setTimeout(() => setToast(null), 500);
    }
  };

  const runComparison = async () => {
    if (compareSelection.length !== 2) return;
    setIsLoading(true);
    setError(null);
    try {
      const report1 = await fetchVariantExplanation(compareSelection[0]);
      const report2 = await fetchVariantExplanation(compareSelection[1]);
      setComparisonReport([report1, report2]);
      const genomicReqs = [
        { gene: report1.variant.protein, variant: report1.variant.hgvs, variantId: report1.variant.id },
        { gene: report2.variant.protein, variant: report2.variant.hgvs, variantId: report2.variant.id }
      ];
      const results = await genomicAnnotationService.fetchBatchAnnotations(genomicReqs);
      setComparisonGenomicData([results[0], results[1]]);
      setViewMode('compare');
    } catch (err: any) {
      setError(err.message || 'Failed to load comparison');
    } finally {
      setIsLoading(false);
    }
  };

  const clearView = () => { setViewMode('list'); setReport(null); setComparisonReport(null); setSelectedVariantId(null); };

  if (viewMode === 'list') {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 relative">
        {/* Top Hero Banner */}
        <div className="mm-card-glowing mm-glow mm-glow--cyan p-8 relative overflow-hidden group shadow-2xl">
          <DnaHelixBackdrop color="cyan" opacity={0.25} motionVariant="fluid" seed="explainer-hero" />
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="mm-section-accent" />
                <span className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-cyan-400">Genomic Intelligence Platform</span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <span className="mm-status-dot text-emerald-400" />
                  LIVE REASONING
                </span>
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                <BookOpen className="text-cyan-400" size={30} />
                Variant Explainer
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Deep structural and mechanistic reasoning across Missense, Splicing, and Truncation variants powered by Gemini 3 Flash and AlphaMissense.
              </p>
            </div>
            
            <button
              onClick={() => setIsCompareMode(!isCompareMode)}
              aria-pressed={isCompareMode}
              className={[
                'flex items-center gap-2 px-5 py-2.5 rounded-xl border text-xs font-extrabold tracking-wider uppercase transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70',
                'active:scale-[0.97]',
                isCompareMode
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.4)]'
                  : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:border-cyan-400/50 hover:text-white hover:shadow-[0_0_12px_rgba(34,211,238,0.2)]',
              ].join(' ')}
            >
              <Scale size={16} aria-hidden="true" />
              {isCompareMode ? 'Exit Compare' : 'Compare Mode'}
            </button>
          </div>
        </div>

        {/* Tactical Search & Preset Node Section */}
        <div className="mm-card-glowing mm-glow mm-glow--cyan p-6 relative overflow-hidden group space-y-5">
          <DnaHelixBackdrop color="cyan" opacity={0.20} motionVariant="fluid" seed="target-node" />
          
          <div className="flex items-center justify-between flex-wrap gap-2 relative z-10">
            <div className="flex items-center gap-3">
              <div className="mm-section-accent" />
              <h3 className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">Target Variant Node</h3>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
              <span className="mm-status-dot text-cyan-400" />
              <span>SYNC_READY</span>
            </div>
          </div>

          {/* Tactical Search Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) {
                const match = variants.find(v => 
                  v.protein.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  v.variant.toLowerCase().includes(searchQuery.toLowerCase())
                );
                if (match) handleExplain(match.id);
                else handleExplain(searchQuery.trim());
              }
            }}
            className="mm-input-tactical flex items-center relative z-10 overflow-hidden"
          >
            <div className="pl-4 text-cyan-400">
              <Search size={20} />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search or Enter Variant e.g. TP53 p.R248Q, BRCA1 p.C61G, BRAF p.V600E..."
              className="flex-1 bg-transparent py-3.5 px-4 text-sm font-semibold text-white placeholder:text-slate-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-2 text-slate-400 hover:text-white"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
            <button
              type="submit"
              disabled={!searchQuery.trim() || isLoading}
              className="mm-btn-tactical !rounded-none !px-6 !py-3.5 flex items-center gap-2"
            >
              {isLoading ? <Loader className="animate-spin h-3.5 w-3.5" /> : <Activity size={14} />}
              <span>EXPLAIN_NODE</span>
            </button>
          </form>

          {/* Quick-Select Benchmark Presets */}
          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mr-1">Validated Benchmarks:</span>
              {[
                { id: 'TP53-R248Q', label: 'TP53 p.R248Q' },
                { id: 'BRCA1-C61G', label: 'BRCA1 p.C61G' },
                { id: 'BRAF-V600E', label: 'BRAF p.V600E' },
                { id: 'KRAS-G12D', label: 'KRAS p.G12D' },
                { id: 'MTHFR-A222V', label: 'MTHFR p.Ala222Val' },
                { id: 'EGFR-L858R', label: 'EGFR p.L858R' },
                { id: 'SMN1-c840', label: 'SMN1 c.840+2T>G' },
                { id: 'CFTR-c3849', label: 'CFTR c.3849+10kbC>T' }
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    const match = variants.find(v => v.id.toUpperCase() === p.id.toUpperCase() || v.variant.includes(p.label.split(' ')[1]));
                    if (match) handleExplain(match.id);
                    else handleExplain(`${p.label.split(' ')[0]} ${p.label.split(' ')[1]}`);
                  }}
                  className="text-[11px] px-3 py-1 rounded-lg border font-mono bg-slate-900/90 border-slate-700 text-slate-300 hover:border-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 hover:shadow-[0_0_10px_rgba(34,211,238,0.3)] transition-all duration-150"
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsCustomOpen(!isCustomOpen)}
                className="text-[11px] px-3 py-1 rounded-lg border border-dashed border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400 transition-all duration-150 font-semibold flex items-center gap-1 ml-auto"
              >
                <Plus size={12} className={isCustomOpen ? 'rotate-45 transition-transform' : 'transition-transform'} />
                <span>{isCustomOpen ? 'Close Custom' : 'Custom Locus'}</span>
              </button>
            </div>
          </div>

          {/* Custom Variant Analyzer Accordion */}
          {isCustomOpen && (
            <div className="bg-slate-950/80 p-4 rounded-xl border border-cyan-500/30 animate-in fade-in slide-in-from-top-2 duration-200 space-y-3 relative z-10 shadow-[inset_0_0_16px_rgba(0,0,0,0.6)]">
              <div className="text-xs font-bold text-cyan-300 flex items-center gap-2 uppercase tracking-wider">
                <Dna size={14} className="text-cyan-400" /> Custom Locus Reasoning Terminal
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-750">
                  <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider block mb-1">Gene Symbol</span>
                  <input
                    type="text"
                    value={customGene}
                    onChange={e => setCustomGene(e.target.value)}
                    placeholder="e.g. PIK3CA, KRAS, EGFR"
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-750">
                  <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider block mb-1">HGVS Variant Notation</span>
                  <input
                    type="text"
                    value={customVariant}
                    onChange={e => setCustomVariant(e.target.value)}
                    placeholder="e.g. p.H1047R, p.G12D, c.743G>A"
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      if (customGene && customVariant) {
                        handleExplain(`${customGene.trim()} ${customVariant.trim()}`);
                      }
                    }}
                    disabled={!customGene || !customVariant || isLoading}
                    className="w-full mm-btn-tactical py-2.5 px-4 text-xs transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader className="animate-spin h-3.5 w-3.5" /> : <Activity size={14} />}
                    ANALYZE_CUSTOM
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Variant Grid */}
        <div>
          {isCompareMode && (
            <div className="flex justify-between items-center mb-4 bg-cyan-950/30 p-4 rounded-xl border border-cyan-500/40 shadow-[0_0_16px_rgba(34,211,238,0.15)]">
              <span className="text-cyan-300 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                <Scale size={16} aria-hidden="true" />
                Select 2 variants to compare shared genomic tracks
              </span>
              <button
                onClick={runComparison}
                disabled={compareSelection.length !== 2 || isLoading}
                className="mm-btn-tactical !py-2 !px-4 text-xs font-bold transition-all duration-150 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                aria-label={`Run comparison${compareSelection.length !== 2 ? ' (select 2 variants first)' : ''}`}
              >
                {isLoading ? <Loader className="animate-spin h-3.5 w-3.5" aria-hidden="true" /> : null}
                Run Comparison
                {compareSelection.length > 0 && (
                  <span className="ml-1 bg-slate-900/60 px-1.5 py-0.5 rounded text-[10px]">{compareSelection.length}/2</span>
                )}
              </button>
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVariants.length === 0 ? (
              <div className="col-span-full">
                <EmptyState
                  icon={Dna}
                  headline={searchQuery ? "No matching variants" : "No variants available"}
                  subtext={searchQuery ? `No results matching "${searchQuery}". Try a quick preset above or custom variant search.` : "Variants will appear here when loaded."}
                />
              </div>
            ) : filteredVariants.map(v => {
              const isSelected = compareSelection.includes(v.id);
              const isDisabled = isCompareMode && compareSelection.length >= 2 && !isSelected;
              const theme = getVariantGlowTheme(v);
              return (
                <button
                  key={v.id}
                  onClick={() => isCompareMode
                    ? setCompareSelection(prev => prev.includes(v.id) ? prev.filter(i => i !== v.id) : prev.length >= 2 ? prev : [...prev, v.id])
                    : handleExplain(v.id)
                  }
                  aria-pressed={isCompareMode ? isSelected : undefined}
                  aria-label={`${isCompareMode ? (isSelected ? 'Deselect' : 'Select') : 'Explain'} ${v.protein} ${v.variant}`}
                  disabled={isDisabled}
                  className={[
                    `mm-card-glowing mm-grid-card-optimized mm-glow ${theme.glowClass} group text-left rounded-xl p-5 relative overflow-hidden transition-all duration-300`,
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70',
                    'active:scale-[0.98]',
                    isDisabled ? 'opacity-35 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
                    isSelected
                      ? `mm-glow--active shadow-[0_0_20px_rgba(var(--mm-glow-rgb),0.35)]`
                      : 'hover:-translate-y-1',
                  ].join(' ')}
                >
                  <DnaHelixBackdrop color={theme.color} opacity={0.22} speed={0.9} motionVariant={theme.motionVariant} seed={v.protein || v.id} />
                  
                  {/* Card header: gene name + category badge or compare checkbox */}
                  <div className="flex justify-between items-start mb-2 relative z-10">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-black text-base tracking-tight transition-colors ${isSelected ? 'text-cyan-300' : 'text-slate-100 group-hover:text-white'}`}>
                        {v.protein}
                      </h4>
                      <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${theme.badgeClass}`}>
                        {theme.categoryLabel}
                      </span>
                    </div>

                    {isCompareMode ? (
                      <span aria-hidden="true" className={`shrink-0 transition-colors ${isSelected ? 'text-cyan-400' : 'text-slate-600'}`}>
                        {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] font-mono text-slate-400 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-750">
                        {v.uniprot_id}
                      </span>
                    )}
                  </div>

                  {/* HGVS mono */}
                  <p className="text-sm text-cyan-400 font-mono mb-1.5 font-bold relative z-10">{v.variant}</p>
                  
                  {/* Disease — muted */}
                  <p className="text-xs text-slate-400 line-clamp-1 relative z-10">{v.disease}</p>
                </button>
              );
            })}
          </div>
        </div>
        {toast && <ToastNotification message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  if (viewMode === 'report' && report) {
    const currentPdb = showMutantStructure ? (report.pdbData?.mutant || report.pdbData?.native) : report.pdbData?.native;
    const highlightIndex = report.variant.mutationPositionInSnippet || parseInt(report.variant.hgvs.match(/(\d+)/)?.[0] || '1', 10);
    const reportTheme = getVariantGlowTheme(report.variant);
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between gap-3 flex-wrap mm-no-print">
          <button
            onClick={clearView}
            className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-bold text-xs uppercase tracking-wider px-3 py-2 rounded-lg hover:bg-slate-800/60 w-fit transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 active:scale-[0.97]"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to Explainer
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 text-emerald-300 hover:text-emerald-200 font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/50 hover:border-emerald-400/70 w-fit transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 active:scale-[0.97] shadow-[0_0_12px_rgba(16,185,129,0.2)]"
            aria-label="Export printable clinical report"
          >
            <Printer className="w-4 h-4" aria-hidden="true" /> Export printable report
          </button>
        </div>

        {/* Report Hero Banner */}
        <div className={`mm-card-glowing mm-glow ${reportTheme.glowClass} p-8 relative overflow-hidden group shadow-2xl flex justify-between items-center flex-wrap gap-4`}>
          <DnaHelixBackdrop color={reportTheme.color} opacity={0.28} speed={0.9} motionVariant={reportTheme.motionVariant} seed={report.variant.protein || 'report'} />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className={reportTheme.accentClass} />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-cyan-400">Active Analysis Report</span>
              <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${reportTheme.badgeClass}`}>
                {reportTheme.categoryLabel}
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white flex items-center gap-3 truncate">
              {report.variant.protein} <span className="text-cyan-400 text-2xl font-mono">{report.variant.hgvs}</span>
            </h2>
            {report.variant.disease && (
              <p className="text-slate-300 text-sm mt-1">{report.variant.disease}</p>
            )}
          </div>

          {report.alphaMissense && (
            <div className="bg-slate-950/90 border border-cyan-500/40 px-5 py-3 rounded-2xl shadow-[0_0_20px_rgba(34,211,238,0.2)] flex flex-col gap-2 relative z-10 flex-shrink-0" style={{ width: 'fit-content' }}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">AlphaMissense</span>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded border font-bold uppercase flex items-center gap-1 ${
                  report.alphaMissense.source === 'SIMULATION'
                    ? 'text-amber-300 border-amber-400/40 bg-amber-400/10'
                    : 'text-emerald-300 border-emerald-400/40 bg-emerald-400/10'
                }`}>
                  <span className={`mm-status-dot ${report.alphaMissense.source === 'SIMULATION' ? 'text-amber-400' : 'text-emerald-400'}`} />
                  {report.alphaMissense.source}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-2xl font-black text-white whitespace-nowrap">
                  {report.alphaMissense.pathogenicityScore.toFixed(3)}
                </span>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-md font-extrabold uppercase tracking-wider whitespace-nowrap ${
                  report.alphaMissense.classification === 'likely_pathogenic'
                    ? 'bg-red-500/25 text-red-300 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                    : report.alphaMissense.classification === 'likely_benign'
                    ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                    : 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
                }`}>
                  {report.alphaMissense.classification.replace('_', ' ')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Report Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-6 space-y-6">
            {/* Sequence Context Card */}
            <div className="mm-card-glowing mm-glow mm-glow--cyan p-6 relative overflow-hidden group">
              <DnaHelixBackdrop color="cyan" opacity={0.20} motionVariant="fluid" seed="sequence-ctx" />
              <div className="flex items-center gap-2 mb-4 relative z-10">
                <div className="mm-section-accent" />
                <h4 className="text-xs font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Dna size={14} className="text-cyan-400" /> Sequence Context
                </h4>
              </div>
              <div className="relative z-10 space-y-4">
                <SequenceViewer sequence={report.variant.sequence} variant={report.variant.hgvs} highlightPosition={highlightIndex} />
                {report.confidenceScores && (
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <ConfidenceHeatmap scores={report.confidenceScores} sequence={report.variant.sequence} />
                  </div>
                )}
              </div>
            </div>

            <AnalysisPanel data={report} genomicData={genomicData} loading={false} />
            <MechanismExplainer mechanism={report.mechanism} summary={report.analysis?.summary} />
          </div>

          <div className="xl:col-span-6 space-y-6">
            {/* AlphaFold 3D Card */}
            <div className="mm-card-glowing mm-glow mm-glow--blue p-6 relative overflow-hidden group">
              <DnaHelixBackdrop color="blue" opacity={0.20} motionVariant="pulse" seed="alphafold-3d" />
              <div className="flex justify-between items-center mb-4 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="mm-section-accent mm-section-accent--blue" />
                  <h3 className="text-xs font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Box size={16} className="text-blue-400" /> AlphaFold 3 Structure
                  </h3>
                </div>
              </div>
              <div className="relative z-10">
                <ProteinStructureViewer 
                  pdbData={currentPdb || null}
                  structurePath={report.structuralMetrics?.wildtype_structure_path}
                  gene={report.variant.protein}
                  highlightResidue={highlightIndex} 
                  loading={false} 
                  label={showMutantStructure ? 'Mutant' : 'Wild-Type'} 
                  colorBy="confidence" 
                  renderStyle={renderStyle}
                  onRenderStyleChange={setRenderStyle}
                  structuralMetrics={report.structuralMetrics}
                />
              </div>
            </div>

            <GenomicAnnotationPanel data={genomicData} loading={isGenomicLoading} />
          </div>
        </div>

        {/* Off-screen printable clinical report (Tier 3) — portaled to <body>, revealed only by @media print */}
        <PrintableVariantReport report={report} genomicData={genomicData} />
      </div>
    );
  }

  if (viewMode === 'compare' && comparisonReport && comparisonGenomicData[0]) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <button onClick={clearView} className="text-cyan-400 hover:text-cyan-300 font-bold text-xs uppercase tracking-wider flex items-center px-4 py-2 rounded-lg hover:bg-slate-800 w-fit">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to List
        </button>

        <div className="mm-card-glowing mm-glow mm-glow--purple p-8 relative overflow-hidden group shadow-xl">
          <DnaHelixBackdrop color="purple" opacity={0.22} motionVariant="decay" seed="compare-locus" />
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="mm-section-accent mm-section-accent--purple" />
            <h2 className="text-xl font-black text-white uppercase tracking-wider">Shared Genomic Locus Comparison</h2>
          </div>
          <div className="relative z-10">
            <GenomicBrowser data={comparisonGenomicData[0]} compareWith={comparisonGenomicData[1]} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6 relative z-10">
            <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-xl shadow-[0_0_12px_rgba(244,63,94,0.2)]">
              <div className="text-[10px] text-rose-400 font-black uppercase mb-1">Variant A Needles</div>
              <div className="text-sm text-white font-mono font-bold">{comparisonReport[0].variant.protein} {comparisonReport[0].variant.hgvs}</div>
            </div>
            <div className="p-4 bg-cyan-950/40 border border-cyan-500/40 rounded-xl shadow-[0_0_12px_rgba(34,211,238,0.2)]">
              <div className="text-[10px] text-cyan-400 font-black uppercase mb-1">Variant B Needles</div>
              <div className="text-sm text-white font-mono font-bold">{comparisonReport[1].variant.protein} {comparisonReport[1].variant.hgvs}</div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {comparisonReport.map((rep, idx) => (
            <div key={idx} className="mm-card-glowing mm-glow mm-glow--cyan rounded-xl flex flex-col overflow-hidden h-[450px]">
              <div className="p-3.5 bg-slate-950/90 border-b border-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-white text-sm">{rep.variant.protein} {rep.variant.hgvs}</h3>
                <span className="text-xs bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-slate-300 font-mono">RMSD: {rep.predictions.delta.rmsd.toFixed(2)}Å</span>
              </div>
              <div className="flex-1 relative">
                <ProteinStructureViewer pdbData={rep.pdbData?.native || null} highlightResidue={parseInt(rep.variant.hgvs.match(/(\d+)/)?.[0] || '1', 10)} loading={!rep.pdbData?.native} label={`Variant ${idx === 0 ? 'A' : 'B'}`} colorBy="confidence" />
              </div>
              <div className="p-4 bg-slate-950/70 grid grid-cols-2 gap-4 border-t border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-extrabold tracking-wider">Frequency</span>
                  <span className="text-white font-mono text-xs font-bold">{comparisonGenomicData[idx]?.frequency.gnomadGlobal.toExponential(1) || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-extrabold tracking-wider">PhyloP Score</span>
                  <span className="text-emerald-400 font-mono font-bold text-xs">{comparisonGenomicData[idx]?.conservation.phyloP.toFixed(2) || '-'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default VariantExplainerTab;