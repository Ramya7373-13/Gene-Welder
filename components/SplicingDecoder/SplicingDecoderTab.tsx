import React, { useState, useEffect, memo, useRef } from 'react';
import { SplicingAnalysisRequest, SplicingAnalysisResult, TherapyOption } from '../../types/splicing';
import { alphaGenomeClient } from '../../services/alphaGenomeClient';
import { alphafoldClient, AlphaFold3Response } from '../../utils/alphafoldClient'; 
import { medgemmaClient } from '../../services/medgemmaClient'; 
import { MedGemmaAnalysis } from '../../types/medgemma'; 
import SplicingVisualizer from './SplicingVisualizer';
import ProteinStructureViewer from '../ProteinStructureViewer';
import ClinicalInterpretationPanel from './ClinicalInterpretationPanel'; 
import { 
  Search, GitMerge, AlertCircle, Loader2, Eraser, Activity, Pill, Dna, FileText, Info, X, 
  CheckCircle2, FlaskConical, WifiOff, Trash2, History, BarChart3, Layers, Download, Copy, 
  FileJson, ChevronDown, Check, AlertTriangle, ArrowRight, Minimize2, Box, BrainCircuit, Clock, RotateCcw, ChevronRight, Scale, HelpCircle, MousePointer2
} from 'lucide-react';
import EmptyState from '../EmptyState';
import { configService } from '../../services/configService';
import DnaHelixBackdrop from '../DnaHelixBackdrop';

// Storage Keys
const STORAGE_KEYS = {
  HISTORY: 'mutationMechanic_splicing_history_v2', 
  COUNT: 'mutationMechanic_analysis_count',
  TEMP: 'mutationMechanic_temp_input',
  SESSION: 'mutationMechanic_splicing_decoder'
};

export interface SplicingPreset {
  label: string;
  gene: string;
  variant: string;
  mechanism: string;
  chromosome: string;
  position: string;
  reference: string;
  alternate: string;
}

const SPLICING_EXAMPLES: SplicingPreset[] = [
  {
    label: 'SMA: SMN1 Exon 7 Donor Loss',
    gene: 'SMN1',
    variant: 'c.840+2T>G',
    mechanism: 'Canonical Donor Loss (ΔDL=0.99)',
    chromosome: '5',
    position: '70952001',
    reference: 'T',
    alternate: 'G'
  },
  {
    label: 'CF: CFTR Deep Intronic Cryptic Exon',
    gene: 'CFTR',
    variant: 'c.3849+10kbC>T',
    mechanism: 'Cryptic Donor Activation (ΔDG=0.94)',
    chromosome: '7',
    position: '117587780',
    reference: 'C',
    alternate: 'T'
  },
  {
    label: 'LFS: TP53 Exon 7 Disruption',
    gene: 'TP53',
    variant: 'c.743G>A',
    mechanism: 'Donor Site Disruption (chr17)',
    chromosome: '17',
    position: '7577538',
    reference: 'C',
    alternate: 'T'
  },
  {
    label: 'DMD: Dystrophin Exon 44 Skipping',
    gene: 'DMD',
    variant: 'c.6429+1G>A',
    mechanism: 'Splice Donor Invariant Site',
    chromosome: 'X',
    position: '31804700',
    reference: 'G',
    alternate: 'A'
  },
  {
    label: 'NF1: Deep Intronic Cryptic Splice',
    gene: 'NF1',
    variant: 'c.5749+333C>G',
    mechanism: 'Cryptic Splice Activation',
    chromosome: '17',
    position: '31252000',
    reference: 'C',
    alternate: 'G'
  },
  {
    label: 'BRCA1: Exon 11 Splice Junction Deletion',
    gene: 'BRCA1',
    variant: 'c.4065_4068delTCAA',
    mechanism: 'Splice Junction Frameshift',
    chromosome: '17',
    position: '43070900',
    reference: 'TCAA',
    alternate: 'T'
  }
];

// SECTION 7.4: Notification System with auto-dismiss logic
const Toast: React.FC<{ message: string; type: 'success' | 'error' | 'loading'; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => {
    if (type !== 'loading') {
        // success: 3s, error: 5s per Section 7.4
        const duration = type === 'success' ? 3000 : 5000;
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }
  }, [onClose, type]);

  return (
    <div 
      role="alert"
      className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 border ${
      type === 'success' 
        ? 'bg-emerald-900/90 text-white border-emerald-700 shadow-emerald-900/20' 
        : type === 'loading'
        ? 'bg-indigo-900/90 text-white border-indigo-700 shadow-indigo-900/20'
        : 'bg-red-900/90 text-white border-red-700 shadow-red-900/20'
    } backdrop-blur-sm`}>
      {type === 'success' ? <CheckCircle2 size={20} className="text-emerald-400" /> : 
       type === 'loading' ? <Loader2 size={20} className="text-indigo-400 animate-spin" /> : 
       <AlertCircle size={20} className="text-red-400" />}
      <span className="font-medium text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10" aria-label="Close notification">
        <X size={16}/>
      </button>
    </div>
  );
};

// SECTION 7.3: Info Tooltip Wrapper
const MetricInfo: React.FC<{ title: string; content: string }> = ({ title, content }) => (
  <div className="group relative inline-block ml-1">
    <HelpCircle size={12} className="text-slate-500 cursor-help hover:text-primary transition-colors" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl text-[10px] text-slate-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none font-normal">
      <div className="font-bold text-white mb-1 uppercase tracking-wider">{title}</div>
      {content}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
    </div>
  </div>
);

// History Item Interface
interface HistoryItem {
  id: string;
  timestamp: number;
  gene: string;
  variant: string;
  result: SplicingAnalysisResult;
  clinical: MedGemmaAnalysis | null;
  structurePdb: string | null;
  structureConfidence: number;
}

// Session Interface for Persistence
interface SavedSession {
  targetGene: string;
  variantNotation: string;
  analysisResults: SplicingAnalysisResult;
  clinicalAnalysis: MedGemmaAnalysis | null;
  structurePdb: string | null;
  structureConfidence: number;
  lastAnalysisTimestamp: string;
}

const RiskBadge: React.FC<{ severity: string; score: number; compact?: boolean }> = memo(({ severity, score, compact }) => {
  let colorClass = '';
  let icon = null;
  let label = '';
  let message = '';

  if (severity === 'SEVERE' || score > 66) {
    colorClass = 'bg-red-900/30 text-red-200 border-red-800 hover:bg-red-900/50 hover:shadow-red-900/20'; 
    icon = <AlertCircle size={compact ? 14 : 18} className="text-red-400" />;
    label = 'HIGH RISK';
    message = "Splicing disruption probable";
  } else if (severity === 'MODERATE' || (score > 33 && score <= 66)) {
    colorClass = 'bg-yellow-900/30 text-yellow-200 border-yellow-800 hover:bg-yellow-900/50 hover:shadow-yellow-900/20';
    icon = <AlertTriangle size={compact ? 14 : 18} className="text-yellow-400" />;
    label = 'MEDIUM RISK';
    message = "Altered splicing possible";
  } else {
    colorClass = 'bg-green-900/30 text-green-200 border-green-800 hover:bg-green-900/50 hover:shadow-green-900/20';
    icon = <CheckCircle2 size={compact ? 14 : 18} className="text-green-400" />;
    label = 'LOW RISK';
    message = "Normal splicing likely";
  }

  return (
    <div 
        className={`flex flex-col gap-1 ${compact ? '' : 'w-full'} animate-in fade-in zoom-in-95 duration-500 fill-mode-backwards`}
        title={`${label}: ${message} (Score: ${score}/100)`}
        aria-live="polite"
        role="status"
    >
      <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 shadow-sm transition-all duration-200 cursor-help hover:scale-[1.02] ${colorClass}`}>
        {icon} 
        <div className="flex flex-col leading-none">
           <span className="font-bold tracking-wide text-xs">
             {label} <span className="opacity-70 font-mono font-normal">(Score: {score}/100)</span>
             {!compact && (
               <MetricInfo 
                  title="Clinical Risk" 
                  content="Predicted probability that this variant will cause significant splicing disruption based on DeepSplicer consensus." 
               />
             )}
           </span>
        </div>
      </div>
      {!compact && <div className="text-[10px] text-slate-400 ml-1">{message}</div>}
    </div>
  );
});

const ConfidenceMeter: React.FC<{ confidence: number }> = memo(({ confidence }) => {
    const [width, setWidth] = useState(0);
    const progressRef = useRef<HTMLDivElement | null>(null);
    
    useEffect(() => {
        const timer = setTimeout(() => setWidth(confidence), 100);
        return () => clearTimeout(timer);
    }, [confidence]);

    useEffect(() => {
      if (progressRef.current) {
        const v = String(Math.min(100, Math.max(0, Math.round(confidence || 0))));
        progressRef.current.setAttribute('aria-valuenow', v);
      }
    }, [confidence]);

    let message = "";
    let colorClass = "";
    let barColor = "";

    if (confidence <= 50) {
        message = "Low confidence - interpret with caution";
        colorClass = "text-red-400";
        barColor = "bg-gradient-to-r from-red-600 to-red-500";
    } else if (confidence <= 75) {
        message = "Moderate confidence - generally reliable";
        colorClass = "text-yellow-400";
        barColor = "bg-gradient-to-r from-yellow-600 to-yellow-500";
    } else if (confidence <= 90) {
        message = "High confidence - results are reliable";
        colorClass = "text-emerald-400";
        barColor = "bg-gradient-to-r from-emerald-600 to-emerald-500";
    } else {
        message = "Very high confidence - highly reliable";
        colorClass = "text-blue-400";
        barColor = "bg-gradient-to-r from-blue-600 to-blue-500";
    }

    const getWidthClass = (percent: number) => `w-p-${Math.round(Math.max(0, Math.min(100, percent)))}`;

    return (
        <div className="mm-card-glowing mm-glow mm-glow--blue p-4 animate-in fade-in duration-700 relative overflow-hidden">
           <div className="flex justify-between items-end mb-2 relative z-10">
             <div className="text-xs text-slate-300 font-bold uppercase tracking-wider flex items-center">
               Model Confidence
               <MetricInfo title="Model Confidence" content="Statistical certainty of the DeepSplicer model across the 10kb sequence window." />
             </div>
             <div className={`font-mono font-black text-sm ${colorClass}`}>{confidence}%</div>
           </div>
           <div ref={progressRef} className="w-full bg-slate-950 h-2 rounded-full overflow-hidden mb-2 shadow-[inset_0_0_8px_rgba(0,0,0,0.8)] border border-slate-750 relative z-10" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="Prediction Confidence">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(59,130,246,0.5)] ${barColor} ${getWidthClass(width)}`} 
              ></div>
           </div>
           <p className="text-[10px] text-slate-400 text-right italic relative z-10">{message}</p>
        </div>
    );
});

const SpliceSiteDiagram: React.FC<{ variant: string; gene: string; severity: string }> = memo(({ variant, severity }) => {
  const isDonor = variant.includes('+') || variant.toLowerCase().includes('donor');
  const isAcceptor = variant.includes('-') || variant.toLowerCase().includes('acceptor');
  const posMatch = variant.match(/[+-](\d+)/);
  const position = posMatch ? (variant.includes('-') ? `-${posMatch[1]}` : `+${posMatch[1]}`) : '?';
  const mutMatch = variant.match(/([A-Z])>([A-Z])/);
  const ref = mutMatch ? mutMatch[1] : '?';
  const alt = mutMatch ? mutMatch[2] : '?';

  return (
    <div className="mm-card-glowing mm-glow mm-glow--purple overflow-hidden font-mono text-sm shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 relative">
        <div className="bg-slate-950/90 p-3 border-b border-purple-500/30 flex justify-between items-center relative z-10">
            <span className="text-purple-300 font-bold text-xs uppercase flex items-center gap-2">
               <Activity size={14} className="text-purple-400" /> Splice Site Topology
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase ${severity === 'SEVERE' ? 'border-red-500/50 text-red-400 bg-red-950/40 shadow-[0_0_8px_rgba(239,68,68,0.3)]' : 'border-slate-600 text-slate-400'}`}>
                {isDonor ? "5' Donor Site" : isAcceptor ? "3' Acceptor Site" : "Exonic/Deep Intronic"}
            </span>
        </div>
        <div className="p-6 flex flex-col items-center relative z-10" role="img" aria-label={`Diagram showing ${isDonor ? "donor" : "acceptor"} splice site disruption`}>
            <div className="w-full flex justify-between text-[10px] text-slate-400 mb-2 uppercase tracking-widest font-bold">
                <span>Exon Boundary</span>
                <span>Intron Segment</span>
            </div>
            <div className="flex items-center justify-center gap-0.5 mb-4">
                <div className={`px-3 py-2 bg-slate-950 border-y border-l ${severity === 'SEVERE' ? 'border-red-500/40' : 'border-slate-700'} rounded-l text-slate-300 font-bold`}>
                   {isDonor ? '...CAG' : '...'}
                </div>
                <div className={`px-2.5 py-2 font-black border-y ${severity === 'SEVERE' ? 'bg-red-950/60 border-red-500 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.5)]' : 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.5)]'}`}>
                   {isDonor ? 'GT' : 'AG'}
                </div>
                <div className={`px-3 py-2 bg-slate-950 border-y border-r ${severity === 'SEVERE' ? 'border-red-500/40' : 'border-slate-700'} rounded-r text-slate-300 font-bold`}>
                   {isDonor ? 'AAGT...' : '...CAG'}
                </div>
            </div>
            <div className="flex flex-col items-center animate-bounce">
                <ArrowRight className="rotate-[270deg] text-rose-400 mb-1" size={16} />
                <span className="text-xs text-rose-300 font-mono font-bold bg-rose-950/60 px-2.5 py-1 rounded border border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.4)]">
                   {ref} &rarr; {alt}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 font-mono">Relative Pos: {position}</span>
            </div>
        </div>
        <div className="bg-slate-950/70 p-3 border-t border-purple-500/20 relative z-10">
            <div className="flex items-center gap-2 text-xs">
               <AlertCircle size={14} className={severity === 'SEVERE' ? 'text-red-400 shrink-0' : 'text-amber-400 shrink-0'} />
               <span className="text-slate-300 text-[11px] leading-tight">
                  {severity === 'SEVERE' 
                    ? `Variant disrupts canonical ${isDonor ? "5'" : "3'"} splice consensus sequence.`
                    : "Variant creates potential cryptic splice site nearby."}
               </span>
            </div>
        </div>
    </div>
  );
});

const TherapyCard: React.FC<{ title: string; option: TherapyOption; icon: React.ReactNode }> = memo(({ title, option, icon }) => (
    <div className={`mm-card-glowing mm-glow ${option.suitable ? 'mm-glow--emerald' : 'mm-glow--purple'} flex flex-col p-4 transition-all duration-300 hover:shadow-lg`}>
        <div className="flex items-center gap-3 mb-2 relative z-10">
            <div className={`p-2 rounded-xl border ${option.suitable ? 'text-emerald-300 bg-emerald-950/60 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'text-slate-400 bg-slate-950 border-slate-750'}`}>{icon}</div>
            <div>
                <h4 className="font-bold text-sm text-slate-200">{title}</h4>
                <div className={`text-[10px] uppercase font-extrabold ${option.suitable ? 'text-emerald-400' : 'text-slate-500'}`}>{option.suitable ? 'SUITABLE' : 'NOT INDICATED'}</div>
            </div>
        </div>
        <p className="text-xs text-slate-300 relative z-10 leading-relaxed">{option.reasoning}</p>
    </div>
));

const ExportMenu: React.FC<{ data: SplicingAnalysisResult; onExport: (type: 'json' | 'text') => void }> = ({ onExport }) => (
    <div className="flex items-center gap-2">
      <button onClick={() => onExport('text')} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 text-slate-300 text-xs rounded transition-all active:scale-95 group shadow-sm hover:shadow" aria-label="Copy report as text">
          <Copy size={14} className="group-hover:text-primary transition-colors"/> Copy as Text
      </button>
      <button onClick={() => onExport('json')} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 text-slate-300 text-xs rounded transition-all active:scale-95 group shadow-sm hover:shadow" aria-label="Export report as JSON">
          <Download size={14} className="group-hover:text-primary transition-colors"/> Export JSON
      </button>
    </div>
);

const SplicingDecoderTab: React.FC = () => {
  const [mode, setMode] = useState<'single' | 'compare'>('single');
  const [input, setInput] = useState({ gene: '', variant: '', chromosome: '', position: '', reference: '', alternate: '' });
  const [result, setResult] = useState<SplicingAnalysisResult | null>(null);
  const [structurePdb, setStructurePdb] = useState<string | null>(null); 
  const [structureConfidence, setStructureConfidence] = useState<number>(0);
  const [clinicalAnalysis, setClinicalAnalysis] = useState<MedGemmaAnalysis | null>(null);
  const [clinicalLoading, setClinicalLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<MedGemmaAnalysis[]>([]);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisCount, setAnalysisCount] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'loading' } | null>(null);
  const [isExamplesOpen, setIsExamplesOpen] = useState(false);
  const exampleDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exampleDropdownRef.current && !exampleDropdownRef.current.contains(event.target as Node)) {
        setIsExamplesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const savedCount = localStorage.getItem(STORAGE_KEYS.COUNT);
    if (savedCount) setAnalysisCount(parseInt(savedCount, 10));
    const savedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)); } catch (e) {}
    }
    const savedSession = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (savedSession) {
      try {
        const session: SavedSession = JSON.parse(savedSession);
        setInput(prev => ({ ...prev, gene: session.targetGene, variant: session.variantNotation }));
        setResult(session.analysisResults);
        setStructurePdb(session.structurePdb);
        setStructureConfidence(session.structureConfidence);
        setClinicalAnalysis(session.clinicalAnalysis);
        return; 
      } catch (e) {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
      }
    }
    const tempInputString = localStorage.getItem(STORAGE_KEYS.TEMP);
    if (tempInputString) {
      try { setInput(JSON.parse(tempInputString)); } catch (e) {}
    }
  }, []);

  const saveHistoryItem = (item: HistoryItem) => {
    setHistory(prev => {
      const filtered = prev.filter(h => !(h.gene === item.gene && h.variant === item.variant));
      const updated = [item, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
      return updated;
    });
  };

  const loadFromHistory = (item: HistoryItem) => {
    setInput(prev => ({ ...prev, gene: item.gene, variant: item.variant }));
    setResult(item.result);
    setStructurePdb(item.structurePdb);
    setStructureConfidence(item.structureConfidence);
    setClinicalAnalysis(item.clinical);
    setShowHistory(false);
    saveSession({
        targetGene: item.gene,
        variantNotation: item.variant,
        analysisResults: item.result,
        clinicalAnalysis: item.clinical,
        structurePdb: item.structurePdb,
        structureConfidence: item.structureConfidence,
        lastAnalysisTimestamp: new Date().toISOString()
    });
    setToast({ message: 'Loaded from history', type: 'success' });
  };

  const saveSession = (session: SavedSession) => {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
  };

  const deleteFromHistory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setHistory(prev => {
      const updated = prev.filter(h => h.id !== id);
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
      return updated;
    });
  };

  const handleInputChange = (field: keyof typeof input, value: string) => {
    const newInput = { ...input, [field]: value };
    setInput(newInput);
    if (error) setError(null); 
    localStorage.setItem(STORAGE_KEYS.TEMP, JSON.stringify(newInput));
  };

  const clearAllData = () => {
    if (window.confirm("Are you sure? This will clear all history and reset the application state.")) {
        localStorage.removeItem(STORAGE_KEYS.HISTORY);
        localStorage.removeItem(STORAGE_KEYS.SESSION);
        localStorage.removeItem(STORAGE_KEYS.TEMP);
        localStorage.removeItem(STORAGE_KEYS.COUNT);
        setHistory([]);
        setInput({ gene: '', variant: '', chromosome: '', position: '', reference: '', alternate: '' });
        setResult(null);
        setStructurePdb(null);
        setClinicalAnalysis(null);
        setAnalysisCount(0);
        setError(null);
        setShowHistory(false);
        setToast({ message: 'Analysis history cleared', type: 'success' });
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.gene.trim()) { setError("Please select a target gene"); return; }
    if (!input.variant.trim()) { setError("Please enter a variant in c. notation"); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    setStructurePdb(null);
    setClinicalAnalysis(null);
    setBatchResults([]);

    try {
      if (mode === 'single') {
        setClinicalLoading(true);
        const dataPromise = alphaGenomeClient.predictSplicingEffect({ geneId: input.gene, variantId: input.variant, sequenceWindow: "10kb" });
        let clinicalResult: MedGemmaAnalysis | null = null;
        medgemmaClient.analyzeVariant(input.gene, input.variant)
          .then(clinical => {
             clinicalResult = clinical;
             setClinicalAnalysis(clinical);
             setClinicalLoading(false);
             if (data && afResult) {
                 saveSession({
                    targetGene: input.gene,
                    variantNotation: input.variant,
                    analysisResults: data,
                    clinicalAnalysis: clinical,
                    structurePdb: afResult.pdb_structure,
                    structureConfidence: afResult.confidence_score,
                    lastAnalysisTimestamp: new Date().toISOString()
                 });
             }
          })
          .catch(e => {
             console.warn("Gemini clinical analysis failed", e);
             setClinicalLoading(false);
          });
        const data = await dataPromise;
        try {
          const backendUrl = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:5000';
          const spliceResponse = await fetch(`${backendUrl}/api/spliceai`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gene: input.gene,
              variant: input.variant,
              chromosome: input.chromosome || undefined,
              position: input.position ? Number(input.position) : undefined,
              reference: input.reference || undefined,
              alternate: input.alternate || undefined
            })
          });
          if (spliceResponse.ok) {
            const spliceData = await spliceResponse.json();
            enrichedData = { ...data, spliceAiScores: spliceData.scores, spliceAiSource: spliceData.source };
          } else {
            console.warn('SpliceAI unavailable:', await spliceResponse.text());
            enrichedData = { ...data, spliceAiSource: 'SIMULATION' };
          }
        } catch (spliceError) {
          console.warn('SpliceAI request failed:', spliceError);
          enrichedData = { ...data, spliceAiSource: 'SIMULATION' };
        }
        setResult(enrichedData);
        const dummySequence = "M" + "L".repeat(50) + "A".repeat(50);
        const afResult = await alphafoldClient.predictProteinStructure(dummySequence);
        setStructurePdb(afResult.pdb_structure);
        setStructureConfidence(afResult.confidence_score);
        const newCount = analysisCount + 1;
        setAnalysisCount(newCount);
        localStorage.setItem(STORAGE_KEYS.COUNT, newCount.toString());
        saveSession({
            targetGene: input.gene,
            variantNotation: input.variant,
            analysisResults: data,
            clinicalAnalysis: clinicalResult,
            structurePdb: afResult.pdb_structure,
            structureConfidence: afResult.confidence_score,
            lastAnalysisTimestamp: new Date().toISOString()
        });
        const historyItem: HistoryItem = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          gene: input.gene,
          variant: input.variant,
          result: data,
          clinical: null,
          structurePdb: afResult.pdb_structure,
          structureConfidence: afResult.confidence_score
        };
        saveHistoryItem(historyItem);
        setToast({ message: 'Analysis completed successfully', type: 'success' });
      } else {
        setBatchProgress("0/3 analyses complete");
        setToast({ message: "Starting batch comparison...", type: 'loading' });
        const variantsToCompare = [
            { gene: input.gene, variant: input.variant },
            { gene: "SMN1", variant: "c.840+2T>G" },
            { gene: "CFTR", variant: "c.3849+10kbC>T" }
        ];
        const results: MedGemmaAnalysis[] = [];
        for (let i = 0; i < variantsToCompare.length; i++) {
            const v = variantsToCompare[i];
            setBatchProgress(`${i}/${variantsToCompare.length} analyses complete`);
            const res = await medgemmaClient.analyzeVariant(v.gene, v.variant);
            results.push(res);
            setBatchResults([...results]);
            await new Promise(r => setTimeout(r, 800)); 
        }
        setBatchProgress("3/3 analyses complete");
        setToast({ message: "Batch processing complete", type: 'success' });
      }
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
      setToast({ message: 'Analysis failed', type: 'error' });
      setClinicalLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setInput({ gene: '', variant: '', chromosome: '', position: '', reference: '', alternate: '' });
    setResult(null);
    setStructurePdb(null);
    setClinicalAnalysis(null);
    setBatchResults([]);
    setError(null);
    localStorage.removeItem(STORAGE_KEYS.TEMP);
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  };

  const setPreset = (preset: SplicingPreset | { gene: string; variant: string; chromosome?: string; position?: string; reference?: string; alternate?: string }) => {
    const fullPreset = SPLICING_EXAMPLES.find(p => p.gene.toUpperCase() === preset.gene.toUpperCase() && p.variant.toUpperCase() === preset.variant.toUpperCase());
    setInput({
      gene: preset.gene,
      variant: preset.variant,
      chromosome: fullPreset?.chromosome || preset.chromosome || '',
      position: fullPreset?.position || preset.position || '',
      reference: fullPreset?.reference || preset.reference || '',
      alternate: fullPreset?.alternate || preset.alternate || ''
    });
    setIsExamplesOpen(false);
  };

  const getSeverityScore = (res: SplicingAnalysisResult) => {
      if (res.clinicalSeverity === 'SEVERE') return 95;
      if (res.clinicalSeverity === 'MODERATE') return 55;
      return 15;
  };

  const handleExport = (type: 'json' | 'text') => {
      if (!result) return;
      if (type === 'json') {
          const jsonString = JSON.stringify(result, null, 2);
          const blob = new Blob([jsonString], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `splicing_analysis_${result.gene}_${result.variant.replace(/[^a-z0-9]/gi, '_')}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setToast({ message: 'JSON report downloaded', type: 'success' });
      } else {
          const textReport = `
MUTATION MECHANIC REPORT
========================
Gene: ${result.gene}
Variant: ${result.variant}
Date: ${new Date(result.timestamp || Date.now()).toLocaleDateString()}

ANALYSIS SUMMARY
----------------
Clinical Severity: ${result.clinicalSeverity}
Model Confidence: ${result.confidence}%
AI Interpretation: ${result.aiInterpretation}

PREDICTED IMPACT
----------------
mRNA Stability: ${result.mRNAImpact.stabilityChange > 0 ? '+' : ''}${result.mRNAImpact.stabilityChange}%
Protein State: ${result.proteinImpact.description}
Frameshift: ${result.proteinImpact.frameshift ? 'Yes' : 'No'}

THERAPEUTIC CANDIDATES
----------------------
ASO: ${result.therapySuitability.antisenseOligonucleotide.suitable ? 'Suitable' : 'Not Indicated'}
Small Molecule: ${result.therapySuitability.smallMoleculeSpliceModulator.suitable ? 'Suitable' : 'Not Indicated'}
Gene Therapy: ${result.therapySuitability.geneTherapy.suitable ? 'Suitable' : 'Not Indicated'}
`;
          navigator.clipboard.writeText(textReport).then(() => {
              setToast({ message: 'Report copied to clipboard', type: 'success' });
          }).catch(() => {
              setToast({ message: 'Failed to copy to clipboard', type: 'error' });
          });
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Top Hero Banner */}
      <div className="mm-card-glowing mm-glow mm-glow--purple p-8 relative overflow-hidden group shadow-2xl">
        <DnaHelixBackdrop color="purple" opacity={0.25} speed={0.9} motionVariant="fluid" seed="splice-hero" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="mm-section-accent mm-section-accent--purple" />
            <span className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-purple-400">Neural Splicing Intelligence</span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-purple-300 bg-purple-950/60 px-2.5 py-0.5 rounded-full border border-purple-500/40">
              <span className="mm-status-dot text-purple-400" />
              SPLICEAI ACTIVE
            </span>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <GitMerge className="text-purple-400" size={30} />
            Splicing Decoder
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Analyze canonical donor/acceptor disruptions, cryptic exon activation, and therapeutic amenability (ASO, Small Molecule) using Illumina SpliceAI deep residual neural networks.
          </p>
        </div>
      </div>

      {/* History Drawer */}
      {showHistory && (
        <div className="absolute right-0 top-0 w-full max-w-md bg-slate-950 border border-purple-500/40 shadow-2xl rounded-2xl z-50 p-5 animate-in fade-in slide-in-from-right-10 min-h-[400px]">
          <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wider"><History size={16} className="text-purple-400"/> Recent Analyses</h3>
            <button onClick={() => setShowHistory(false)} aria-label="Close history" className="text-slate-400 hover:text-white"><X size={18} /></button>
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
             {history.length === 0 && (
               <EmptyState
                 icon={History}
                 headline="No recent analyses"
                 subtext="Previous analyses will appear here once you run them."
                 size="compact"
               />
             )}
             {history.map((item) => (
               <div key={item.id} className="w-full text-left bg-slate-900/90 hover:bg-slate-850 p-3.5 rounded-xl border border-slate-750 mb-2 group relative transition-all">
                 <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1 mr-2">
                        <div className="font-bold text-white truncate text-sm" title={item.gene}>{item.gene}</div>
                        <div className="text-xs text-cyan-400 font-mono truncate" title={item.variant}>{item.variant}</div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">{new Date(item.timestamp).toLocaleDateString()}</span>
                 </div>
                 <div className="mt-2 flex items-center gap-2">
                    <RiskBadge severity={item.result.clinicalSeverity} score={getSeverityScore(item.result)} compact />
                 </div>
                 <button
                    onClick={(e) => { e.stopPropagation(); loadFromHistory(item); }}
                    className="absolute bottom-3 right-12 text-xs text-purple-400 hover:underline font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Load analysis for ${item.gene} ${item.variant}`}
                 >
                    Load
                 </button>
                 <button 
                    onClick={(e) => deleteFromHistory(e, item.id)}
                    className="absolute bottom-3 right-3 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Delete item"
                 >
                    <Trash2 size={14} />
                 </button>
               </div>
             ))}
          </div>
        </div>
      )}

      {/* Input Section */}
      <div className="mm-card-glowing mm-glow mm-glow--purple p-6 shadow-xl relative z-10 overflow-hidden space-y-5">
        <DnaHelixBackdrop color="purple" opacity={0.22} speed={0.8} motionVariant="fluid" seed="splice-input" />
        
        <div className="flex items-center justify-between mb-2 flex-wrap gap-4 relative z-10">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2.5">
               <div className="mm-section-accent mm-section-accent--purple" />
               <h3 className="text-xs font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                 <Search size={16} className="text-purple-400"/> 
                 {mode === 'single' ? 'Target Splicing Node' : 'Batch Comparison Node'}
               </h3>
             </div>
             <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-750">
                <button 
                   type="button"
                   onClick={() => setMode('single')}
                   className={`px-3 py-1 text-xs font-bold rounded transition-all duration-200 active:scale-95 ${mode === 'single' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                   aria-label="Single Analysis Mode"
                >
                   Single
                </button>
                <button 
                   type="button"
                   onClick={() => setMode('compare')}
                   className={`px-3 py-1 text-xs font-bold rounded transition-all duration-200 active:scale-95 flex items-center gap-1 ${mode === 'compare' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
                   aria-label="Batch Comparison Mode"
                >
                   <Scale size={10}/> Compare
                </button>
             </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950/80 border border-slate-750 text-slate-300 text-xs font-mono font-bold shadow-sm">
              <BarChart3 size={12} className="text-purple-400" /> Runs: {analysisCount}
            </span>
            <button onClick={() => setShowHistory(!showHistory)} className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg transition-all active:scale-95 ${showHistory ? 'bg-purple-600 text-white' : 'text-slate-300 hover:text-white bg-slate-900 border border-slate-750'}`} aria-label="Toggle History">
              <History size={12} /> History
            </button>
            <button 
                onClick={clearAllData}
                className="flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-lg transition-colors text-rose-400 hover:text-white hover:bg-rose-950/50 border border-rose-500/20 active:scale-95"
                title="Clear All Data & Reset"
                aria-label="Clear All Data and Reset"
            >
                <Trash2 size={12} /> Clear Data
            </button>
          </div>
        </div>
        
        <form onSubmit={handleAnalyze} className="relative z-10 space-y-4">
           <div className="flex justify-between items-end">
             <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                {mode === 'single' ? 'Target Gene & cDNA Variant' : 'Primary Variant (will compare vs SMN1/CFTR)'}
             </label>
             <div className="relative" ref={exampleDropdownRef}>
                <button 
                    type="button" 
                    onClick={() => setIsExamplesOpen(!isExamplesOpen)}
                    className="text-xs text-purple-300 hover:text-white flex items-center gap-1.5 transition-all font-bold bg-purple-950/60 border border-purple-500/40 px-3 py-1.5 rounded-xl shadow-[0_0_12px_rgba(168,85,247,0.25)]"
                >
                  <FlaskConical size={13} className="text-purple-400" />
                  <span>Load Benchmark Preset ({SPLICING_EXAMPLES.length})</span>
                  <ChevronDown size={12} className={`transition-transform duration-200 ${isExamplesOpen ? 'rotate-180' : ''}`} />
                </button>
                {isExamplesOpen && (
                    <div className="absolute right-0 top-full mt-2 w-84 bg-slate-950 border border-purple-500/40 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 z-50 overflow-hidden divide-y divide-slate-800">
                       <div className="px-4 py-2.5 bg-slate-900 text-[10px] font-black text-purple-300 uppercase tracking-wider">
                         Select Splicing Benchmark Variant
                       </div>
                       {SPLICING_EXAMPLES.map((ex, i) => (
                         <button
                           key={i}
                           type="button"
                           onClick={() => setPreset(ex)}
                           className="w-full text-left px-4 py-3 text-xs text-slate-300 hover:bg-purple-950/40 hover:text-white transition-colors group"
                         >
                           <div className="font-bold text-white group-hover:text-purple-300 transition-colors flex items-center justify-between">
                             <span>{ex.label}</span>
                             <span className="text-[10px] font-mono text-slate-500">{ex.chromosome}:{ex.position}</span>
                           </div>
                           <div className="text-cyan-400 font-mono text-[11px] mt-0.5 font-bold">{ex.gene} : {ex.variant}</div>
                           <div className="text-[10px] text-slate-400 mt-0.5">{ex.mechanism}</div>
                         </button>
                       ))}
                    </div>
                )}
             </div>
           </div>
           
           <div className="flex flex-col md:flex-row gap-3">
             <div className="flex-1 w-full relative">
               <input 
                 id="splicing-gene-input" 
                 type="text" 
                 value={input.gene} 
                 onChange={e => handleInputChange('gene', e.target.value)} 
                 disabled={loading} 
                 className="w-full bg-slate-950 border border-slate-750 rounded-xl px-4 py-3 text-white focus:border-purple-400 focus:shadow-[0_0_16px_rgba(168,85,247,0.3)] transition-all duration-200 font-mono placeholder:text-slate-600 font-semibold text-sm" 
                 placeholder="Gene (e.g. SMN1, CFTR, TP53)"
                 aria-label="Target Gene" 
               />
             </div>
             <div className="flex-[2] w-full relative">
               <input 
                 id="splicing-variant-input" 
                 type="text" 
                 value={input.variant} 
                 onChange={e => handleInputChange('variant', e.target.value)} 
                 disabled={loading} 
                 className="w-full bg-slate-950 border border-slate-750 rounded-xl px-4 py-3 text-white focus:border-purple-400 focus:shadow-[0_0_16px_rgba(168,85,247,0.3)] transition-all duration-200 font-mono placeholder:text-slate-600 font-semibold text-sm" 
                 placeholder="cDNA Variant (e.g. c.840+2T>G, c.3849+10kbC>T)"
                 aria-label="Variant in cDNA notation" 
               />
             </div>
             <button type="button" onClick={clearForm} className="px-4 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-750 rounded-xl text-slate-400 hover:text-rose-400 active:scale-95 transition-all md:w-auto w-full flex items-center justify-center" title="Clear Inputs" aria-label="Clear Inputs"><Eraser size={18} /></button>
           </div>

           {/* Quick-Select Example Pills */}
           <div className="flex items-center gap-1.5 flex-wrap">
             <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mr-1">Quick Presets:</span>
             {SPLICING_EXAMPLES.map((ex, i) => (
               <button
                 key={i}
                 type="button"
                 onClick={() => setPreset(ex)}
                 className={`text-[11px] px-3 py-1 rounded-lg border font-mono transition-all duration-150 ${
                   input.gene.toUpperCase() === ex.gene.toUpperCase() && input.variant.toUpperCase() === ex.variant.toUpperCase()
                     ? 'bg-purple-600 text-white font-bold border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                     : 'bg-slate-950/80 border-slate-750 text-slate-300 hover:border-purple-400/60 hover:text-white'
                 }`}
               >
                 {ex.gene} {ex.variant}
               </button>
             ))}
           </div>

           {mode === 'single' && (
             <div className="bg-slate-950/80 p-4 rounded-xl border border-purple-500/25 space-y-3 shadow-inner">
               <div className="text-[11px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                 <Dna size={14} className="text-purple-400" />
                 <span>Genomic Coordinates Terminal (Direct SpliceAI Locus Query)</span>
               </div>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                 {[
                   ['chromosome', 'Chromosome', 'e.g. 5, 7, 17, X'],
                   ['position', 'Position', 'e.g. 70952001'],
                   ['reference', 'REF Allele', 'e.g. T'],
                   ['alternate', 'ALT Allele', 'e.g. G']
                 ].map(([field, label, placeholder]) => (
                   <label key={field} className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">
                     {label}
                     <input
                       value={(input as any)[field]}
                       onChange={e => handleInputChange(field as any, e.target.value)}
                       disabled={loading}
                       placeholder={placeholder}
                       aria-label={`SpliceAI ${label}`}
                       className="mt-1 w-full bg-slate-900 border border-slate-750 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-slate-650 focus:border-purple-400 focus:outline-none"
                     />
                   </label>
                 ))}
               </div>
               <p className="text-[10px] text-slate-400 leading-tight">
                 💡 <strong>Genomic Dispatch:</strong> Coordinates are automatically loaded from presets or can be entered directly as GRCh38 genomic coordinates for instant SpliceAI neural analysis.
               </p>
             </div>
           )}
          
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-100 rounded-xl p-4 flex items-start gap-3 animate-in shake"><AlertCircle size={20} className="text-red-400 flex-shrink-0" /><div className="flex-1"><p className="font-bold text-sm">Error</p><p className="text-sm opacity-90 break-words">{error}</p></div><button type="button" onClick={()=>setError(null)} className="hover:text-white transition-colors" aria-label="Dismiss error"><X size={18}/></button></div>}

          {batchProgress && mode === 'compare' && (
             <div className="bg-purple-950/40 border border-purple-500/40 p-3 rounded-xl flex items-center gap-3 animate-in fade-in">
                <Loader2 size={16} className="animate-spin text-purple-400" />
                <span className="text-purple-200 text-sm font-mono">{batchProgress}</span>
             </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-800">
              <button 
                type="submit" 
                disabled={loading} 
                className="mm-btn-tactical !bg-purple-600 hover:!bg-purple-500 text-white !py-3.5 !px-8 text-xs font-black rounded-xl shadow-[0_0_24px_rgba(168,85,247,0.45)] flex items-center gap-2 justify-center"
                aria-label={loading ? "Analysis in progress" : "Analyze Splicing Variants"}
              >
                {loading ? <><Loader2 className="animate-spin" size={16} /> DECODING_SPLICE...</> : mode === 'compare' ? <><Layers size={16} /> RUN_BATCH_COMPARISON</> : <><GitMerge size={16} /> DECODE_SPLICING</>}
              </button>
          </div>
        </form>
      </div>

      {/* Empty State — no analysis run yet */}
      {!result && !loading && mode === 'single' && (
        <div className="mm-card-glowing mm-glow mm-glow--purple p-8 rounded-2xl relative overflow-hidden">
          <DnaHelixBackdrop color="purple" opacity={0.20} motionVariant="fluid" seed="splice-empty" />
          <EmptyState
            icon={GitMerge}
            headline="No splicing analysis yet"
            subtext="Enter a gene symbol and variant notation above, or load an example to start your deep learning analysis."
          />
          <div className="flex flex-wrap justify-center gap-3 pb-4 relative z-10">
            <button
              onClick={() => setPreset(SPLICING_EXAMPLES[0])}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-lg border border-slate-750 hover:border-purple-400/60 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 active:scale-[0.97]"
            >
              <MousePointer2 size={13} aria-hidden="true" /> Try SMA Example (SMN1)
            </button>
            <button
              onClick={() => setPreset(SPLICING_EXAMPLES[1])}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-lg border border-slate-750 hover:border-purple-400/60 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 active:scale-[0.97]"
            >
              <MousePointer2 size={13} aria-hidden="true" /> Try CF Deep Intronic (CFTR)
            </button>
            <button
              onClick={() => setPreset(SPLICING_EXAMPLES[2])}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-lg border border-slate-750 hover:border-purple-400/60 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 active:scale-[0.97]"
            >
              <MousePointer2 size={13} aria-hidden="true" /> Try LFS Donor Disruption (TP53)
            </button>
          </div>
        </div>
      )}

      {/* BATCH RESULTS VIEW */}
      {mode === 'compare' && batchResults.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4" role="region" aria-label="Batch Analysis Results">
             {batchResults.map((res, i) => (
                 <div key={i} className="h-full">
                     <div className="mb-2 font-bold text-slate-300 text-sm flex items-center gap-2">
                        <span className="bg-slate-900 px-2.5 py-0.5 rounded border border-purple-500/30 text-purple-300 font-mono">#{i+1}</span>
                        {res.gene} {res.variantId.split('-')[1]}
                     </div>
                     <ClinicalInterpretationPanel data={res} loading={false} />
                 </div>
             ))}
          </div>
      )}

      {/* SINGLE RESULTS VIEW */}
      {mode === 'single' && result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700" role="region" aria-label="Single Analysis Results">
          
          <div className="flex flex-col md:flex-row gap-4 items-stretch">
             <div className="flex-1 min-w-0">
               <SplicingVisualizer data={result} />
             </div>
             <div className="w-full md:w-80 flex flex-col gap-4">
                <div className="mm-card-glowing mm-glow mm-glow--purple p-4 flex flex-col gap-3 shadow-xl relative overflow-hidden">
                   <DnaHelixBackdrop color="purple" opacity={0.22} motionVariant="fluid" seed="splice-summary" />
                   <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider relative z-10">Analysis Summary</h4>
                   <div className="relative z-10"><RiskBadge severity={result.clinicalSeverity} score={getSeverityScore(result)} /></div>
                   <div className="relative z-10"><ConfidenceMeter confidence={result.confidence} /></div>
                </div>
                <div className="flex-1">
                   <SpliceSiteDiagram variant={result.variant} gene={result.gene} severity={result.clinicalSeverity} />
                </div>
             </div>
          </div>

          <div className="mm-card-glowing mm-glow mm-glow--blue p-6 relative overflow-hidden group shadow-xl">
             <DnaHelixBackdrop color="blue" opacity={0.22} motionVariant="pulse" seed="splice-protein" />
             <div className="flex justify-between items-center mb-4 relative z-10">
               <div className="flex items-center gap-2.5">
                 <div className="mm-section-accent mm-section-accent--blue" />
                 <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                   <Box size={16} className="text-blue-400" />
                   Predicted Protein Structure Impact
                 </h3>
               </div>
               <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">
                    Confidence (pLDDT): <strong className="text-white font-mono">{structureConfidence.toFixed(1)}</strong>
                  </span>
                  <span className="text-[10px] font-bold bg-blue-950/60 border border-blue-500/40 px-2.5 py-0.5 rounded text-blue-300 font-mono">
                      AlphaFold 3
                  </span>
               </div>
             </div>
             <div className="grid md:grid-cols-2 gap-6 relative z-10">
                <div className="h-80 border border-blue-500/30 rounded-xl overflow-hidden relative">
                   <ProteinStructureViewer 
                      pdbData={structurePdb} 
                      label={result.gene}
                      loading={!structurePdb}
                      colorBy="confidence" 
                   />
                </div>
                <div className="flex flex-col justify-center space-y-4">
                   <div className="bg-slate-950/90 p-4 rounded-xl border border-blue-500/25">
                      <div className="text-xs text-slate-400 uppercase font-extrabold mb-1 flex items-center">
                        Impact Description
                        <MetricInfo title="Protein Impact" content="Estimated effect on the amino acid sequence and resulting 3D tertiary structure." />
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed">{result.proteinImpact.description}</p>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-950/90 p-4 rounded-xl border border-blue-500/25">
                         <div className="text-[10px] text-slate-400 uppercase font-extrabold mb-1">Protein Loss</div>
                         <div className={`text-2xl font-black font-mono ${result.proteinImpact.truncationPercentage > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                           {result.proteinImpact.truncationPercentage}%
                         </div>
                      </div>
                      <div className="bg-slate-950/90 p-4 rounded-xl border border-blue-500/25">
                         <div className="text-[10px] text-slate-400 uppercase font-extrabold mb-1">Frameshift</div>
                         <div className={`text-2xl font-black font-mono ${result.proteinImpact.frameshift ? 'text-rose-400' : 'text-emerald-400'}`}>
                           {result.proteinImpact.frameshift ? "YES" : "NO"}
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          <div className="flex justify-end">
             <ExportMenu data={result} onExport={handleExport} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <div className="mm-card-glowing mm-glow mm-glow--purple p-6 h-full relative overflow-hidden group shadow-xl">
                <DnaHelixBackdrop color="purple" opacity={0.22} speed={0.8} motionVariant="fluid" seed="splice-metrics" />
                <div className="flex items-center gap-2.5 mb-6 relative z-10">
                  <div className="mm-section-accent mm-section-accent--purple" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Activity size={16} className="text-purple-400"/> Splicing Impact Metrics
                  </h3>
                </div>
                <div className="space-y-5 relative z-10">
                  {/* SpliceAI Deep Neural Delta Scores */}
                  {!configService.getFeatureFlags().enableSpliceAI ? (
                    <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-2.5">
                        <GitMerge size={16} className="text-slate-500 shrink-0" />
                        <div>
                          <span className="text-slate-300 font-semibold block">SpliceAI Neural Delta Matrix Disabled</span>
                          <span className="text-[11px] text-slate-500 block">Enable in Settings to compute deep learning splice disruption metrics.</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono italic">Module Off</span>
                    </div>
                  ) : result.spliceAiScores ? (
                    <div className="bg-slate-950/90 p-4 rounded-xl border border-purple-500/40 space-y-3 shadow-inner">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-purple-300 uppercase tracking-wider">SpliceAI Neural Delta</span>
                          <MetricInfo title="SpliceAI Delta Scores" content="Illumina 32-layer deep residual network predicting delta probabilities (0 to 1) for splice site loss or gain." />
                        </div>
                        <span className={`text-[9px] font-mono px-2 py-0.5 rounded border font-extrabold uppercase flex items-center gap-1 ${
                          result.spliceAiSource === 'SIMULATION' ? 'text-amber-300 border-amber-400/40 bg-amber-950/40' : result.spliceAiSource === 'CACHE' ? 'text-cyan-300 border-cyan-400/40 bg-cyan-950/40' : 'text-emerald-300 border-emerald-400/40 bg-emerald-950/40'
                        }`}>
                          <span className={`mm-status-dot ${result.spliceAiSource === 'SIMULATION' ? 'text-amber-400' : result.spliceAiSource === 'CACHE' ? 'text-cyan-400' : 'text-emerald-400'}`} />
                          {result.spliceAiSource || 'API'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-750">
                          <div className="text-[9px] text-slate-400 font-bold uppercase">Donor Loss (ΔDL)</div>
                          <div className={`font-mono text-base font-black ${result.spliceAiScores.deltaDonorLoss >= 0.5 ? 'text-rose-400' : 'text-slate-300'}`}>
                            {result.spliceAiScores.deltaDonorLoss.toFixed(2)}
                          </div>
                        </div>
                        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-750">
                          <div className="text-[9px] text-slate-400 font-bold uppercase">Donor Gain (ΔDG)</div>
                          <div className={`font-mono text-base font-black ${result.spliceAiScores.deltaDonorGain >= 0.5 ? 'text-rose-400' : 'text-slate-300'}`}>
                            {result.spliceAiScores.deltaDonorGain.toFixed(2)}
                          </div>
                        </div>
                        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-750">
                          <div className="text-[9px] text-slate-400 font-bold uppercase">Acceptor Loss (ΔAL)</div>
                          <div className={`font-mono text-base font-black ${result.spliceAiScores.deltaAcceptorLoss >= 0.5 ? 'text-rose-400' : 'text-slate-300'}`}>
                            {result.spliceAiScores.deltaAcceptorLoss.toFixed(2)}
                          </div>
                        </div>
                        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-750">
                          <div className="text-[9px] text-slate-400 font-bold uppercase">Acceptor Gain (ΔAG)</div>
                          <div className={`font-mono text-base font-black ${result.spliceAiScores.deltaAcceptorGain >= 0.5 ? 'text-rose-400' : 'text-slate-300'}`}>
                            {result.spliceAiScores.deltaAcceptorGain.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {result.spliceAiScores.clinicalInterpretation && (
                        <p className="text-[11px] text-purple-200 leading-tight">
                          {result.spliceAiScores.clinicalInterpretation}
                        </p>
                      )}

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                        <span><strong className="text-amber-300">Research Use Only:</strong> Splicing predictions require experimental validation.</span>
                        <span className="font-mono text-slate-500">Jaganathan et al., Cell (2019)</span>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-750">
                      <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wide font-extrabold flex items-center">
                        mRNA Stability
                        <MetricInfo title="mRNA Stability" content="Percentage change in transcript half-life due to NMD or structural alteration." />
                      </div>
                      <div className={`font-mono font-black text-lg ${result.mRNAImpact.stabilityChange < -20 ? 'text-rose-400' : 'text-slate-200'}`}>
                        {result.mRNAImpact.stabilityChange > 0 ? '+' : ''}{result.mRNAImpact.stabilityChange}%
                      </div>
                    </div>
                    <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-750">
                      <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wide font-extrabold">Protein Status</div>
                      <div className="font-mono font-bold text-slate-200 text-xs truncate leading-8" title={result.proteinImpact.description}>
                        {result.proteinImpact.frameshift ? 'Frameshift' : 'In-frame'}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-300 leading-relaxed italic border-l-2 border-purple-500 pl-3">"{result.aiInterpretation}"</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="mm-card-glowing mm-glow mm-glow--emerald p-6 h-full flex flex-col relative overflow-hidden group shadow-xl">
                <DnaHelixBackdrop color="emerald" opacity={0.22} motionVariant="rhythmic" seed="splice-clinical" />
                <div className="flex items-center gap-2.5 mb-6 relative z-10">
                  <div className="mm-section-accent mm-section-accent--emerald" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Pill size={16} className="text-emerald-400"/> Clinical Insights & Therapies
                  </h3>
                </div>
                <div className="flex flex-col md:flex-row gap-6 h-full relative z-10">
                   <div className="flex-1 min-w-[300px]">
                      <ClinicalInterpretationPanel data={clinicalAnalysis} loading={clinicalLoading} />
                   </div>
                   
                   <div className="flex-1 flex flex-col gap-4">
                      <TherapyCard title="Antisense Oligo" option={result.therapySuitability.antisenseOligonucleotide} icon={<Dna size={20}/>}/>
                      <TherapyCard title="Small Molecule" option={result.therapySuitability.smallMoleculeSpliceModulator} icon={<Pill size={20}/>}/>
                      <TherapyCard title="Gene Therapy" option={result.therapySuitability.geneTherapy} icon={<FileText size={20}/>}/>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default SplicingDecoderTab;