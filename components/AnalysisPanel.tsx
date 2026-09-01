import React, { useState } from 'react';
import { AnalysisResponse } from '../types';
import { VariantAnalysis } from '../services/geminiService';
import { GenomicContext } from '../types/genomics';
import { Sparkles, ArrowRight, BrainCircuit, Activity, Info, X, CheckCircle2, GitCompare } from 'lucide-react';
import ChatWidget from './ChatWidget';
import { configService } from '../services/configService';
import DnaHelixBackdrop from './DnaHelixBackdrop';
import ClinicalSummaryCard from './ClinicalSummaryCard';
import GrokConsensusCard from './GrokConsensusCard';

interface AnalysisPanelProps {
  data?: AnalysisResponse | VariantAnalysis | null;
  genomicData?: GenomicContext | null;
  loading: boolean;
  isStreaming?: boolean;
}

const formatScore = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toFixed(3);
};

const formatRmsd = (value?: number | null): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2)} Å`;
};

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ data, genomicData, loading, isStreaming }) => {
  const [selectedMutationInfo, setSelectedMutationInfo] = useState<number | null>(null);

  const isVariantAnalysis = (d: any): d is VariantAnalysis => {
    return Boolean(d?.variant?.protein && d?.variant?.hgvs);
  };

  const alphaMissenseScore = isVariantAnalysis(data)
    ? data.alphaMissense?.pathogenicityScore ?? null
    : (data as AnalysisResponse)?.alphaMissense?.pathogenicityScore ?? null;

  const alphaMissenseClassification = isVariantAnalysis(data)
    ? data.alphaMissense?.classification ?? null
    : (data as AnalysisResponse)?.alphaMissense?.classification ?? null;

  const rmsdValue = isVariantAnalysis(data)
    ? data.predictions?.delta?.rmsd ?? null
    : (data as AnalysisResponse)?.predictions?.delta?.rmsd ?? null;

  const alphaMissenseSource = isVariantAnalysis(data)
    ? data.alphaMissense?.source ?? null
    : (data as AnalysisResponse)?.alphaMissense?.source ?? null;

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Mechanism Skeleton */}
        <div className="mm-card-glowing mm-glow mm-glow--cyan p-6 h-48 flex flex-col animate-pulse">
          <div className="h-5 w-40 bg-slate-800 rounded mb-6"></div>
          <div className="space-y-3">
            <div className="h-3 bg-slate-800 rounded w-full"></div>
            <div className="h-3 bg-slate-800 rounded w-full"></div>
            <div className="h-3 bg-slate-800 rounded w-3/4"></div>
          </div>
        </div>

        {/* RMSD Skeleton */}
        <div className="mm-card-glowing mm-glow mm-glow--rose p-4 h-16 animate-pulse">
           <div className="h-full w-full bg-slate-800/50 rounded"></div>
        </div>

        {/* Mutations Skeleton */}
        <div className="mm-card-glowing mm-glow mm-glow--purple p-6 animate-pulse">
          <div className="h-5 w-56 bg-slate-800 rounded mb-6"></div>
          <div className="space-y-4">
            <div className="h-28 bg-slate-900 rounded-lg border border-slate-800"></div>
            <div className="h-28 bg-slate-900 rounded-lg border border-slate-800"></div>
          </div>
        </div>

        {/* ChatWidget disabled/placeholder during loading */}
        <ChatWidget analysisData={null} genomicData={null} />
      </div>
    );
  }

  const analysis = (data as AnalysisResponse)?.aiAnalysis || (data as VariantAnalysis)?.analysis;
  if (!analysis || !data) return null;
  const source = (data as AnalysisResponse | VariantAnalysis).source || 'SIMULATION';

  const isAnalysisReady = !isStreaming;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Mechanism Analysis */}
      <div 
        className="mm-card-glowing mm-glow mm-glow--cyan p-6 relative overflow-hidden group shadow-xl"
      >
        <DnaHelixBackdrop color="cyan" opacity={0.20} motionVariant="fluid" seed="analysis-mechanistic" />
        
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none">
          <BrainCircuit size={100} />
        </div>
        
        <h3 className="text-white font-black text-sm uppercase tracking-wider mb-4 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2.5">
             <div className="mm-section-accent" />
             <Sparkles className={`h-4 w-4 text-cyan-400 ${isStreaming ? 'animate-[pulse_1s_ease-in-out_infinite]' : ''}`} />
             <span>Mechanistic Reasoning</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
              source === 'SIMULATION' 
                ? 'text-amber-300 bg-amber-950/50 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]' 
                : 'text-emerald-300 bg-emerald-950/50 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
            }`}>
              <span className={`mm-status-dot ${source === 'SIMULATION' ? 'text-amber-400' : 'text-emerald-400'}`} />
              {source}
            </span>
            {isAnalysisReady && <CheckCircle2 className="h-4 w-4 text-emerald-400 animate-in zoom-in spin-in-90 duration-300" />}
          </div>
        </h3>
        <div className="prose prose-invert max-w-none relative z-10">
          <p className={`text-slate-200 leading-relaxed text-sm md:text-base font-normal ${isStreaming ? 'after:content-["▋"] after:ml-1 after:animate-pulse after:text-cyan-400' : ''}`}>
            {analysis.summary}
          </p>
        </div>
      </div>

      {/* Dual-Engine AI Consensus Validation — Gemini clinical note + Grok structural consensus */}
      {isVariantAnalysis(data) && data.variant?.protein && data.variant?.hgvs && (
        <section className="space-y-3" aria-label="Dual-Engine AI Consensus Validation">
          <h3 className="text-white font-black text-sm uppercase tracking-wider flex items-center gap-2.5">
            <div className="mm-section-accent" />
            <GitCompare className="h-4 w-4 text-cyan-400" />
            <span>Dual-Engine AI Consensus Validation</span>
          </h3>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ClinicalSummaryCard gene={data.variant.protein} variant={data.variant.hgvs} />
            <GrokConsensusCard gene={data.variant.protein} variant={data.variant.hgvs} />
          </div>
        </section>
      )}

      {/* AlphaMissense & Structural Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-left-2 duration-500 delay-150">
        {/* AlphaMissense Tile */}
        {!configService.getFeatureFlags().enableAlphaMissense ? (
          <div className="mm-card-glowing mm-glow mm-glow--amber p-4 flex items-center justify-between opacity-80">
            <div className="flex items-center gap-3">
              <Sparkles className="text-slate-500 h-5 w-5" />
              <div>
                <span className="text-slate-400 text-sm font-semibold block">AlphaMissense</span>
                <span className="text-[10px] text-slate-500 block">Disabled in Settings</span>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-mono italic">Module Off</span>
          </div>
        ) : (
          <div className="mm-card-glowing mm-glow mm-glow--emerald p-4 flex flex-col gap-3 relative overflow-hidden group">
            <div className="flex items-center gap-3 relative z-10">
              <Sparkles className="text-emerald-400 h-5 w-5 shrink-0" />
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-200 text-sm font-bold">AlphaMissense</span>
                  {alphaMissenseSource && (
                    <span className={`text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded border flex items-center gap-1 whitespace-nowrap ${alphaMissenseSource === 'SIMULATION' ? 'text-amber-300 border-amber-400/40 bg-amber-950/40' : 'text-emerald-300 border-emerald-400/40 bg-emerald-950/40'}`}>
                      <span className={`mm-status-dot ${alphaMissenseSource === 'SIMULATION' ? 'text-amber-400' : 'text-emerald-400'}`} />
                      {alphaMissenseSource}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">DeepMind Pathogenicity</span>
              </div>
            </div>
            <div className="flex items-center gap-3 relative z-10">
              <span className="text-2xl font-mono font-black text-white whitespace-nowrap">
                {loading ? '—' : formatScore(alphaMissenseScore)}
              </span>
              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded whitespace-nowrap ${
                (alphaMissenseClassification ?? 'likely_pathogenic') === 'likely_pathogenic'
                  ? 'bg-red-500/25 text-red-300 border border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                  : (alphaMissenseClassification) === 'likely_benign'
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                  : 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
              }`}>
                {(alphaMissenseClassification ?? 'likely_pathogenic').replace('_', ' ')}
              </span>
            </div>
          </div>
        )}

        {/* RMSD Alert */}
        <div className="mm-card-glowing mm-glow mm-glow--rose p-4 flex items-center justify-between relative overflow-hidden group">
          <div className="flex items-center gap-3 relative z-10">
            <Activity className="text-rose-400 h-5 w-5" />
            <div>
              <span className="text-slate-200 text-sm font-bold block">Structural Deviation</span>
              <span className="text-[10px] text-slate-400 block font-medium">Backbone RMSD vs WT</span>
            </div>
          </div>
          <span className="text-2xl font-mono font-black text-white relative z-10">
            {loading ? '—' : formatRmsd(rmsdValue)}
          </span>
        </div>
      </div>

      {/* Research Disclaimer & Citation Footnote */}
      <div className="mm-card-glowing mm-glow mm-glow--amber p-3.5 flex items-start gap-3 text-[11px] text-slate-300 relative overflow-hidden">
        <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed flex-1">
          <strong className="text-amber-300 font-bold uppercase tracking-wide">Research Use Only:</strong> AlphaMissense pathogenicity scores and Gemini mechanism summaries are computational predictions. Citation: <em>Cheng et al., Science 381 (2023)</em>, CC BY 4.0.
        </div>
      </div>

      {/* Compensatory Mutations */}
      <div 
        className="mm-card-glowing mm-glow mm-glow--purple p-6 relative overflow-hidden group shadow-xl"
      >
        <DnaHelixBackdrop color="purple" opacity={0.20} motionVariant="fluid" seed="analysis-compensatory" />
        
        <h3 className="text-white font-black text-sm uppercase tracking-wider mb-4 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2.5">
             <div className="mm-section-accent mm-section-accent--purple" />
             <span>Suggested Compensatory Mutations</span>
          </div>
          {isAnalysisReady && analysis.compensatory_mutations.length > 0 && (
             <span className="text-[10px] font-extrabold uppercase bg-purple-950/60 border border-purple-500/40 text-purple-300 px-2.5 py-0.5 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.3)]">
               AI Optimized
             </span>
          )}
        </h3>
        
        <div className="space-y-4 relative z-10">
          {analysis.compensatory_mutations.length === 0 && isStreaming && (
            <div className="flex items-center gap-3 text-slate-400 text-sm italic animate-pulse p-2">
              <div className="h-2 w-2 bg-purple-400 rounded-full animate-bounce"></div>
              <div className="h-2 w-2 bg-purple-400 rounded-full animate-bounce delay-75"></div>
              <div className="h-2 w-2 bg-purple-400 rounded-full animate-bounce delay-150"></div>
              Generating candidate rescues...
            </div>
          )}
          
          {analysis.compensatory_mutations.map((mut, idx) => (
            <div 
              key={idx} 
              className="group/card bg-slate-950/80 hover:bg-slate-900 border border-purple-500/25 hover:border-purple-500/60 transition-all duration-200 rounded-xl p-4 relative overflow-hidden shadow-sm"
            >
              <div className="flex justify-between items-start mb-2 relative z-10">
                <span className="text-base font-mono font-black text-purple-300 bg-purple-950/60 border border-purple-500/30 px-2.5 py-0.5 rounded-md">
                  {mut.mutation}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                    mut.confidence > 0.8 ? 'text-emerald-300 bg-emerald-950/60 border border-emerald-500/40' : 'text-amber-300 bg-amber-950/60 border border-amber-500/40'
                  }`}>
                    {(mut.confidence * 100).toFixed(0)}% Confidence
                  </span>
                  <button 
                    onClick={() => setSelectedMutationInfo(idx)}
                    className="text-slate-400 hover:text-white transition-colors p-1"
                    title="View detailed reasoning"
                    aria-label={`View reasoning for ${mut.mutation}`}
                  >
                    <Info size={16} />
                  </button>
                </div>
              </div>
              
              <p className="text-slate-300 text-xs mb-3 line-clamp-2 leading-relaxed">
                {mut.reasoning}
              </p>
              
              <button className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-all duration-200" aria-label={`Simulate variant ${mut.mutation}`}>
                Simulate this variant <ArrowRight size={12} />
              </button>

              {/* Inline Overlay Modal */}
              {selectedMutationInfo === idx && (
                <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md z-20 p-5 animate-in fade-in flex flex-col justify-between border border-purple-500/40 rounded-xl shadow-2xl">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <h5 className="font-bold text-white text-sm flex items-center gap-2">
                        <Info size={14} className="text-purple-400"/> AI Mechanistic Rationale
                      </h5>
                      <button 
                        onClick={() => setSelectedMutationInfo(null)}
                        className="text-slate-400 hover:text-white transition-colors"
                        aria-label="Close details"
                        title="Close details"
                      >
                        <X size={16}/>
                      </button>
                    </div>
                    <p className="text-slate-200 text-xs leading-relaxed">
                      {mut.reasoning}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                     <button 
                       onClick={() => setSelectedMutationInfo(null)} 
                       className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded hover:bg-slate-800 transition-colors"
                     >
                       Close
                     </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Integrated Chat Widget - Section 9.1 */}
      <ChatWidget analysisData={data} genomicData={genomicData} />
    </div>
  );
};

export default AnalysisPanel;