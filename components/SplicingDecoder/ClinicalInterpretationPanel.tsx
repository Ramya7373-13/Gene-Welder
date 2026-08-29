import React, { useState, useRef, useEffect } from 'react';
import { MedGemmaAnalysis } from '../../types/medgemma';
import { BrainCircuit, Activity, Pill, BookOpen, CheckCircle2, HelpCircle, AlertCircle, Clock, Link as LinkIcon, Thermometer, FlaskConical, Stethoscope, FileWarning, ClipboardList, Globe, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import DnaHelixBackdrop from '../DnaHelixBackdrop';

interface ClinicalInterpretationPanelProps {
  data: MedGemmaAnalysis | null;
  loading: boolean;
}

const ClinicalInterpretationPanel: React.FC<ClinicalInterpretationPanelProps> = ({ data, loading }) => {
  const [expanded, setExpanded] = useState(false);
  const treatmentBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (treatmentBtnRef.current) {
      treatmentBtnRef.current.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }
  }, [expanded]);

  // SECTION 3.2: Loading State
  if (loading) {
    return (
      <div className="mm-card-glowing mm-glow mm-glow--emerald p-6 h-full flex flex-col items-center justify-center space-y-4 animate-pulse">
         <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse"></div>
            <BrainCircuit size={48} className="text-emerald-400 relative z-10 animate-bounce" />
         </div>
         <div className="text-center">
            <h3 className="text-sm font-bold text-white mb-1">Gemini analyzing clinical significance...</h3>
            <p className="text-slate-400 text-xs mt-2 font-mono">~3-5 seconds</p>
         </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mm-card-glowing mm-glow mm-glow--emerald p-6 h-full flex flex-col items-center justify-center text-center">
         <AlertCircle size={32} className="text-slate-500 mb-2" />
         <p className="text-slate-400 text-xs">No clinical interpretation data available.</p>
      </div>
    );
  }

  const getPathogenicityColor = (p: string) => {
    if (p.includes('Pathogenic')) return 'text-rose-300 border-rose-500/50 bg-rose-950/40 shadow-[0_0_8px_rgba(244,63,94,0.3)]';
    if (p.includes('Benign')) return 'text-emerald-300 border-emerald-500/50 bg-emerald-950/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]';
    return 'text-amber-300 border-amber-500/50 bg-amber-950/40';
  };

  const getPathogenicityIcon = (p: string) => {
    if (p.includes('Pathogenic')) return <AlertCircle size={16} />;
    if (p.includes('Benign')) return <CheckCircle2 size={16} />;
    return <HelpCircle size={16} />;
  };

  const getWidthClass = (percent: number) => `w-p-${Math.round(Math.max(0, Math.min(100, percent)))}`;

  // Section 6.2: Hallucination Prevention / Low Confidence Handling
  const isLowConfidence = data.confidenceScore < 60;

  return (
    <div className="mm-card-glowing mm-glow mm-glow--emerald overflow-hidden shadow-xl animate-in fade-in slide-in-from-right-4 duration-500 h-full flex flex-col relative group">
      <DnaHelixBackdrop color="emerald" opacity={0.22} speed={0.8} motionVariant="rhythmic" seed="clinical-interp" />
      {/* Header */}
      <div className="bg-slate-950/90 border-b border-emerald-500/30 p-4 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-2">
           <BrainCircuit className="text-emerald-400" size={18} />
           <h3 className="font-bold text-white text-xs uppercase tracking-wider">Clinical Reasoning</h3>
           <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded border flex items-center gap-1 ${data.source === 'SIMULATION' ? 'text-amber-300 bg-amber-950/50 border-amber-500/40' : 'text-emerald-300 bg-emerald-950/50 border-emerald-500/40'}`}>
              <span className={`mm-status-dot ${data.source === 'SIMULATION' ? 'text-amber-400' : 'text-emerald-400'}`} />
              {data.source || 'SIMULATION'}
           </span>
        </div>
        <div className="flex items-center gap-2">
           <span className="text-[10px] bg-emerald-950/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/40 font-mono font-bold">
             Gemini 3 Flash
           </span>
        </div>
      </div>

      <div className="p-5 space-y-6 flex-1 overflow-y-auto custom-scrollbar relative">
        
        {/* SECTION 5.1: Specific Cached Message */}
        {data.isCached && (
           <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/50 px-3 py-2 rounded-lg border border-slate-700 w-full mb-2">
             <BookOpen size={14} className="text-slate-500 flex-shrink-0" />
             <span>📚 Using cached analysis (30 days old)</span>
           </div>
        )}

        {/* SECTION 6.2: Low Confidence Warning */}
        {isLowConfidence && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="text-amber-500 h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-200">
              <strong>Low Confidence ({data.confidenceScore}%):</strong> Prediction falls below the 60% reliability threshold. Clinical evidence may be sparse.
            </div>
          </div>
        )}

        {/* SECTION 3.1: Classification Panel */}
        <div className="flex items-start justify-between gap-4">
           <div className={`flex-1 p-3 rounded-lg border ${getPathogenicityColor(data.pathogenicity)}`}>
              <div className="text-xs uppercase font-bold tracking-wider opacity-80 mb-1 flex items-center gap-2">
                 {getPathogenicityIcon(data.pathogenicity)} Pathogenicity
              </div>
              <div className="text-lg font-bold">{data.pathogenicity}</div>
           </div>
           
           <div className="flex-1 p-3 rounded-lg bg-slate-900 border border-slate-700">
              <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Confidence</div>
              <div className="flex items-end gap-2">
                <span className={`text-lg font-bold ${data.confidenceScore > 80 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                   {data.confidence}
                </span>
                <span className="text-xs text-slate-500 mb-1">({data.confidenceScore}%)</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2">
                 <div className={`h-full rounded-full ${data.confidenceScore > 80 ? 'bg-emerald-500' : 'bg-yellow-500'} ${getWidthClass(data.confidenceScore)}`}></div>
              </div>
           </div>
        </div>

        {/* Clinical Context & Mechanism */}
        <div className="space-y-3">
           <div className="flex items-center justify-between border-b border-slate-700 pb-2">
             <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Stethoscope size={16} className="text-slate-400" /> Clinical Context
             </h4>
             <span className="text-xs text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                Inheritance: {data.inheritanceMode}
             </span>
           </div>
           
           <div className="flex flex-wrap gap-2">
              <span className="text-xs text-slate-500 uppercase font-bold">Associated Diseases:</span>
              {data.diseases.map((d, i) => (
                <span key={i} className="text-xs font-medium text-slate-200 bg-slate-700/50 px-2.5 py-0.5 rounded-full border border-slate-600">
                  {d}
                </span>
              ))}
           </div>
           
           <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 relative">
             <p className="text-sm text-slate-300 leading-relaxed italic">
               <span className="text-slate-500 font-bold block text-xs mb-1 uppercase not-italic">Mechanism</span>
               "{data.mechanism}"
             </p>
           </div>
        </div>

        {/* SECTION 4.3: Population Context */}
        {data.populationFrequency && (
          <div className="space-y-3">
             <h4 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-700 pb-2">
                <Globe size={16} className="text-slate-400" /> Population Context
             </h4>
             <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                <div>
                   <span className="text-[10px] text-slate-500 uppercase tracking-wide">Allele Frequency (MAF)</span>
                   <div className="font-mono text-white font-bold">{data.populationFrequency}</div>
                </div>
                <div className="text-right">
                   <span className="text-[10px] text-slate-500 uppercase tracking-wide">Prevalence</span>
                   <div className="text-xs text-slate-300">
                      {data.populationFrequency.includes('<') || data.populationFrequency.includes('0.00') ? 'Ultra-Rare' : 'Common/Polymorphic'}
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* SECTION 4.1: Predicted Phenotype */}
        {!isLowConfidence && (
          <div className="space-y-3">
             <h4 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-700 pb-2">
                <Thermometer size={16} className="text-slate-400" /> Phenotype Prediction
             </h4>
             <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex flex-col">
                   <span className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Onset</span>
                   <span className="text-white font-medium text-xs">{data.phenotype.onset}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex flex-col">
                   <span className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Severity</span>
                   <span className={`font-medium text-xs ${data.phenotype.severity.includes('Severe') ? 'text-red-300' : 'text-white'}`}>
                      {data.phenotype.severity}
                   </span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 col-span-2">
                   <span className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 block">Affected Systems</span>
                   <div className="flex flex-wrap gap-1.5">
                      {data.phenotype.affectedSystems.map((sys, i) => (
                          <span key={i} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                              {sys}
                          </span>
                      ))}
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* SECTION 4.2: Interactions (Expandable) */}
        <button
          ref={treatmentBtnRef}
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-white border-t border-slate-700 pt-3"
          aria-expanded="false"
          aria-controls="treatment-section"
        >
           <span className="flex items-center gap-2"><FlaskConical size={14}/> Drug Interactions & Treatments</span>
           {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {expanded && (
           <div id="treatment-section" className="space-y-4 animate-in fade-in slide-in-from-top-2">
              {data.treatments.length > 0 && (
                 <ul className="space-y-2">
                   {data.treatments.slice(0, 3).map((t, i) => (
                     <li key={i} className="bg-slate-900/30 p-2.5 rounded border border-slate-800">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-emerald-400 text-xs">{t.name}</span>
                          <span className="text-[9px] text-slate-500 border border-slate-700 px-1 rounded">{t.evidenceLevel}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">{t.mechanism}</div>
                     </li>
                   ))}
                 </ul>
              )}
              {data.drugInteractions && data.drugInteractions.length > 0 && (
                 <div className="bg-red-950/20 border border-red-900/30 rounded p-3 text-xs text-red-200/80">
                    <strong className="block mb-1 text-red-400">Contraindications:</strong>
                    <ul className="list-disc pl-4 space-y-1">
                       {data.drugInteractions.map((di, i) => <li key={i}>{di}</li>)}
                    </ul>
                 </div>
              )}
           </div>
        )}
        
        {/* Footer: Read Full & Citations (Section 3.3) */}
        <div className="pt-3 border-t border-slate-700/50">
           <div className="flex flex-wrap gap-2 mb-3">
             {data.citations.map((cite, i) => (
                <a key={i} href={`https://pubmed.ncbi.nlm.nih.gov/${cite.replace('PMID:', '').trim()}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-scientific-blue hover:underline bg-scientific-blue/10 px-2 py-0.5 rounded transition-colors hover:bg-scientific-blue/20">
                   Based on [{cite}]
                </a>
             ))}
           </div>
           
           <div className="flex gap-2">
              <button className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded transition-colors border border-slate-600 text-center">
                 Read Full Analysis
              </button>
              <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded transition-colors border border-slate-700 flex items-center gap-1">
                 <BookOpen size={12} /> Cite
              </button>
           </div>
           
           {/* SECTION 6.2: Hallucination Prevention Disclaimer (With Links) */}
           <div className="bg-slate-950/50 p-2 mt-4 rounded border border-slate-800/50 text-center">
             <p className="text-[9px] text-slate-500">
               ⚠️ <strong>AI-predicted. Verify with clinical literature.</strong> Not for diagnostic use. Cross-reference with <a href="https://www.ncbi.nlm.nih.gov/clinvar/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300 transition-colors">ClinVar</a> or <a href="https://clinicalgenome.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300 transition-colors">ClinGen</a>.
             </p>
           </div>
        </div>

      </div>
    </div>
  );
};

export default ClinicalInterpretationPanel;