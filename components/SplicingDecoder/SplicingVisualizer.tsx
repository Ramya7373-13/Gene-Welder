import React, { useMemo } from 'react';
import { SplicingAnalysisResult } from '../../types/splicing';
import { Check, AlertTriangle, Info, ArrowRight, AlertCircle, Dna } from 'lucide-react';
import DnaHelixBackdrop from '../DnaHelixBackdrop';

interface SplicingVisualizerProps {
  data: SplicingAnalysisResult;
}

const SplicingVisualizer: React.FC<SplicingVisualizerProps> = React.memo(({ data }) => {
  // Increased height to prevent tooltip clipping
  const height = 320; 
  const baselineY = 220; // Lower baseline to give room for tooltip above
  const padding = 80;
  
  // Safe access to exonsAffected array
  const exons = useMemo(() => data.exonsAffected || [], [data.exonsAffected]);
  
  // Dynamic scaling based on number of exons
  const exonCount = exons.length;
  
  // If no exons, render a placeholder or minimal view
  if (exonCount === 0) {
    return (
      <div className="w-full mm-card-glowing mm-glow mm-glow--purple p-6 shadow-inner flex flex-col items-center justify-center h-[320px] text-slate-500 animate-in fade-in duration-500">
        <AlertTriangle size={32} className="mb-2 opacity-50" />
        <p>No exon data available for visualization.</p>
      </div>
    );
  }
  
  // Dynamic width calculation: 
  // Ensure at least 160px per unit for readability
  const minUnitWidth = 160; 
  const calculatedWidth = Math.max(900, (exonCount * minUnitWidth) + (padding * 2));
  const width = calculatedWidth;

  // Proportional Scaling:
  // Exons take 60% of the unit width, Introns take 40%
  const totalGap = width - (2 * padding);
  const unitWidth = totalGap / exonCount;
  const exonWidth = unitWidth * 0.6;
  const intronWidth = unitWidth * 0.4;

  const getExonX = (index: number) => padding + (index * (exonWidth + intronWidth));

  const getStrengthLabel = (score: number) => {
    if (score >= 8.0) return 'Strong';
    if (score >= 4.0) return 'Moderate';
    if (score > -5.0) return 'Weak';
    return 'Silent';
  };

  const getWidthClass = (percent: number) => `w-p-${Math.round(Math.max(0, Math.min(100, percent)))}`;

  return (
    <div className="w-full mm-card-glowing mm-glow mm-glow--cyan p-6 shadow-xl flex flex-col relative overflow-hidden group">
      <DnaHelixBackdrop color="cyan" opacity={0.22} speed={0.8} motionVariant="fluid" seed="splice-visualizer" />
      {/* Header / Legend */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="mm-section-accent" />
          <h3 className="text-white font-black text-sm uppercase tracking-wider flex items-center gap-2" id="gene-model-title">
            <Dna size={16} className="text-cyan-400" />
            {data.gene} Gene Model <span className="text-slate-400 text-xs font-bold font-mono">({exonCount} Exons)</span>
          </h3>
          {(data as any).source && (
            <span className={`text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded border flex items-center gap-1 ${
              (data as any).source === 'BENCHMARK' || (data as any).source === 'SIMULATION'
                ? 'text-amber-300 bg-amber-950/50 border-amber-500/40'
                : 'text-emerald-300 bg-emerald-950/50 border-emerald-500/40'
            }`}>
              <span className={`mm-status-dot ${
                (data as any).source === 'BENCHMARK' || (data as any).source === 'SIMULATION'
                  ? 'text-amber-400' : 'text-emerald-400'
              }`} />
              {(data as any).source}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-xs bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-sm">
          <div className="flex items-center gap-1.5 px-2">
            <span className="w-3 h-3 bg-emerald-500 rounded-sm shadow-[0_0_5px_rgba(16,185,129,0.4)]"></span>
            <span className="text-slate-300">Included</span>
          </div>
          <div className="flex items-center gap-1.5 px-2">
            <span className="w-3 h-3 bg-red-500/20 border border-red-500 rounded-sm border-dashed"></span>
            <span className="text-slate-300">Skipped</span>
          </div>
          <div className="flex items-center gap-1.5 px-2">
            <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-slate-400"></span>
            <span className="text-slate-300">Splice Sites</span>
          </div>
        </div>
      </div>
      
      {/* Scrollable SVG Container */}
      <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 w-full">
        <svg 
            width={width} 
            height={height} 
            className="min-w-full font-sans overflow-visible"
            role="img"
            aria-labelledby="gene-model-title"
            aria-label={`Splicing diagram for ${data.gene}. Visualizes ${exonCount} exons and their inclusion status.`}
        >
          {/* Main Axis Line (Intronic regions baseline) */}
          <line 
            x1={padding} 
            y1={baselineY} 
            x2={width - padding} 
            y2={baselineY} 
            stroke="#475569" 
            strokeWidth="2" 
            strokeLinecap="round"
            className="opacity-50"
          />

          {exons.map((exon, idx) => {
            const x = getExonX(idx);
            const isLast = idx === exons.length - 1;
            
            // Visual Styles based on state
            const isIncluded = exon.included;
            const fillColor = isIncluded ? '#10b981' : 'url(#diagonalHatch)';
            const strokeColor = isIncluded ? '#059669' : '#ef4444';
            const opacity = isIncluded ? 1 : 0.75;
            const strokeDash = isIncluded ? 'none' : '4,4';
            
            // Splice site highlighting
            const spliceSiteColor = isIncluded ? "#94a3b8" : "#ef4444";
            
            // Score handling
            const accScore = exon.scores?.acceptor || (isIncluded ? 9.4 : 2.1);
            const donScore = exon.scores?.donor || (isIncluded ? 8.8 : 0.5);
            
            // Percentage for bar widths (Clamp between 5% and 100%)
            const accPercent = Math.min(100, Math.max(5, (accScore / 12) * 100));
            const donPercent = Math.min(100, Math.max(5, (donScore / 12) * 100));

            return (
              <g
                key={exon.exonNumber}
                className={`group animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards anim-delay-${idx * 100}ms`}
                aria-label={
                  exon.included
                    ? `Exon ${exon.exonNumber}: included`
                    : `Exon ${exon.exonNumber}: skipped, ${exon.reason}`
                }
              >
                {/* Connecting Intron Arc */}
                {!isLast && (
                  <path
                    d={`M ${x + exonWidth} ${baselineY} C ${x + exonWidth + intronWidth/3} ${baselineY - 25}, ${x + exonWidth + (2*intronWidth)/3} ${baselineY - 25}, ${x + exonWidth + intronWidth} ${baselineY}`}
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="1.5"
                    opacity="0.5"
                    className="group-hover:stroke-slate-400 transition-colors duration-300"
                  />
                )}

                {/* Splice Sites Indicators (3' Acceptor - Start, 5' Donor - End) */}
                <path 
                  d={`M ${x - 4} ${baselineY + 8} L ${x} ${baselineY} L ${x - 4} ${baselineY - 8}`} 
                  stroke={spliceSiteColor} strokeWidth="2" fill="none"
                  className="transition-all duration-300 opacity-60 group-hover:opacity-100 group-hover:stroke-slate-200"
                />
                 <path 
                  d={`M ${x + exonWidth + 4} ${baselineY + 8} L ${x + exonWidth} ${baselineY} L ${x + exonWidth + 4} ${baselineY - 8}`} 
                  stroke={spliceSiteColor} strokeWidth="2" fill="none"
                  className="transition-all duration-300 opacity-60 group-hover:opacity-100 group-hover:stroke-slate-200"
                />

                {/* Exon Body */}
                <rect 
                  x={x} 
                  y={baselineY - 30} 
                  width={exonWidth} 
                  height={60} 
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth="2"
                  strokeDasharray={strokeDash}
                  rx="6"
                  opacity={opacity}
                  className="transition-all duration-300 hover:filter hover:brightness-110 cursor-pointer shadow-lg hover:shadow-emerald-500/20"
                />

                {/* Exon Number Label */}
                <text 
                  x={x + exonWidth/2} 
                  y={baselineY + 5} 
                  fill={isIncluded ? "white" : "#ef4444"} 
                  fontSize="16" 
                  fontWeight="bold" 
                  textAnchor="middle"
                  pointerEvents="none"
                  className="text-shadow-sm"
                >
                  {exon.exonNumber}
                </text>

                {/* Status Icon Indicator below exon */}
                <g transform={`translate(${x + exonWidth/2}, ${baselineY + 55})`}>
                  <circle cx={0} cy={0} r="14" fill={isIncluded ? "#064e3b" : "#450a0a"} stroke={strokeColor} strokeWidth={1.5} className="shadow-sm" />
                  <text 
                    x={0} 
                    y={5} 
                    textAnchor="middle" 
                    fill={strokeColor}
                    fontSize="14"
                    fontWeight="bold"
                  >
                    {isIncluded ? "✓" : "✗"}
                  </text>
                </g>

                {/* Detailed Hover Card (ForeignObject) - Section 7.3: 200ms fade */}
                <foreignObject 
                  x={x - 20} 
                  y={10} 
                  width={exonWidth + 40} 
                  height={180} 
                  className="opacity-0 group-hover:opacity-100 transition-all duration-200 transform group-hover:-translate-y-1 pointer-events-none z-30 overflow-visible"
                >
                  <div className={`flex flex-col items-center p-3 rounded-lg shadow-2xl backdrop-blur-md border text-center ${
                    isIncluded 
                      ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-50 shadow-emerald-900/20' 
                      : 'bg-red-950/95 border-red-500/50 text-red-50 shadow-red-900/20'
                  }`}>
                    <div className="flex items-center justify-between w-full border-b border-white/10 pb-1.5 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Exon {exon.exonNumber}</span>
                      <Info size={12} className={isIncluded ? "text-emerald-400" : "text-red-400"} />
                    </div>
                    
                    <div className={`text-xs font-bold mb-1 ${isIncluded ? 'text-emerald-300' : 'text-red-300'}`}>
                      {isIncluded ? 'Included' : 'Skipped'}
                    </div>
                    
                    <div className="text-[10px] leading-tight mb-3 opacity-90 min-h-[2.5em] text-slate-200">
                      {exon.reason}
                    </div>

                    <div className="w-full bg-slate-900/60 rounded p-2 space-y-2 text-left shadow-inner border border-white/5">
                        <div className="flex justify-between items-center text-[9px] border-b border-white/10 pb-1 mb-1">
                            <span className="opacity-70 font-bold">Splice Site Strength</span>
                            <span className="font-mono opacity-50 text-[8px]">MAXENT</span>
                        </div>
                        
                        <div>
                            <div className="flex justify-between text-[9px] mb-0.5">
                                <span className="opacity-80">3' Acceptor</span>
                                <span className="flex items-center gap-1">
                                    <span className={accScore > 5 ? "text-emerald-400 font-mono" : "text-red-400 font-mono"}>
                                        {accScore.toFixed(1)}
                                    </span>
                                    <span className="text-[8px] opacity-60 uppercase">{getStrengthLabel(accScore)}</span>
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                 <div 
                                    className={`h-full rounded-full transition-all duration-500 ${accScore > 5 ? "bg-emerald-500" : "bg-red-500"} ${getWidthClass(accPercent)}`} 
                                 ></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-[9px] mb-0.5">
                                <span className="opacity-80">5' Donor</span>
                                <span className="flex items-center gap-1">
                                    <span className={donScore > 5 ? "text-emerald-400 font-mono" : "text-red-400 font-mono"}>
                                        {donScore.toFixed(1)}
                                    </span>
                                    <span className="text-[8px] opacity-60 uppercase">{getStrengthLabel(donScore)}</span>
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                 <div 
                                    className={`h-full rounded-full transition-all duration-500 ${donScore > 5 ? "bg-emerald-500" : "bg-red-500"} ${getWidthClass(donPercent)}`} 
                                 ></div>
                            </div>
                        </div>
                    </div>
                    
                    <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-r border-b ${
                       isIncluded ? 'bg-emerald-950 border-emerald-500/50' : 'bg-red-950 border-red-500/50'
                    }`}></div>
                  </div>
                </foreignObject>
                
                <line 
                  x1={x + exonWidth/2} y1={baselineY - 30}
                  x2={x + exonWidth/2} y2={190}
                  stroke={isIncluded ? "#10b981" : "#ef4444"}
                  strokeWidth="1"
                  strokeDasharray="2,2"
                  className="opacity-0 group-hover:opacity-40 transition-opacity"
                />

              </g>
            );
          })}
          
          <defs>
            <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="8" height="8">
              <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" 
                    stroke="#ef4444" strokeWidth={1.5} opacity={0.6} />
            </pattern>
          </defs>
        </svg>
      </div>

      {/* Footer Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 border-t border-slate-800 pt-5 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300">
         <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50 text-center hover:bg-slate-800 transition-colors">
            <div className="text-slate-400 text-[10px] uppercase mb-1 tracking-wider">Transcript Integrity</div>
            <div className="text-white font-mono font-bold flex items-center justify-center gap-2 text-sm">
               {exons.every(e => e.included) ? (
                 <><Check size={14} className="text-scientific-green"/> Full Length</>
               ) : (
                 <><AlertTriangle size={14} className="text-scientific-red"/> Truncated</>
               )}
            </div>
         </div>
         <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50 text-center hover:bg-slate-800 transition-colors">
            <div className="text-slate-400 text-[10px] uppercase mb-1 tracking-wider">Exon Count</div>
            <div className="text-white font-mono font-bold text-sm">{exonCount} Analyzed</div>
         </div>
         <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50 text-center hover:bg-slate-800 transition-colors">
            <div className="text-slate-400 text-[10px] uppercase mb-1 tracking-wider">Splice Window</div>
            <div className="text-white font-mono font-bold text-sm">+/- 5kb</div>
         </div>
         <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50 text-center hover:bg-slate-800 transition-colors">
            <div className="text-slate-400 text-[10px] uppercase mb-1 tracking-wider">Model</div>
            <div className="text-scientific-blue font-mono font-bold text-sm flex items-center justify-center gap-1">
               DeepSplicer <ArrowRight size={10}/>
            </div>
         </div>
      </div>
    </div>
  );
});

export default SplicingVisualizer;