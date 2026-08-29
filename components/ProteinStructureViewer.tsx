import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Maximize2, RotateCcw, ZoomIn, ZoomOut, Info, AlertTriangle, Box, Layers, Atom } from 'lucide-react';
import { configService } from '../services/configService';
import { backendService } from '../services/backendService';
import { UNIPROT_MAP } from '../constants';

export type RenderStyle = 'cartoon' | 'sphere' | 'stick';

export interface StructuralMetrics {
  plddt_avg?: number | null;
  rmsd_to_wildtype?: number | null;
  domains_affected?: string[] | null;
  wildtype_structure_path?: string | null;
  mutant_structure_path?: string | null;
  alphaFold_version?: string | null;
}

interface ProteinStructureViewerProps {
  pdbData?: string | null;
  structurePath?: string | null;
  gene?: string;
  highlightResidue?: number;
  loading?: boolean;
  label?: string;
  colorBy?: 'spectrum' | 'confidence' | 'conservation';
  customScores?: number[];
  onResidueHover?: (info: { residue: string; position: number; confidence: number } | null) => void;
  renderStyle?: RenderStyle;
  onRenderStyleChange?: (style: RenderStyle) => void;
  structuralMetrics?: StructuralMetrics | null;
}

declare global {
  interface Window {
    $3Dmol: any;
  }
}

function getStyleForRender(renderStyle: RenderStyle, colorBy: string, customScores: number[] | undefined, model: any): any {
  const baseStyle: any = {};
  
  const colorFunc = (atom: any) => {
    if (colorBy === 'confidence') {
      if (atom.b >= 90) return '#3b82f6';
      if (atom.b >= 70) return '#eab308';
      if (atom.b >= 50) return '#f97316';
      return '#ef4444';
    }
    return '#888888';
  };

  if (renderStyle === 'cartoon') {
    if (colorBy === 'confidence') {
      baseStyle.cartoon = { colorfunc: colorFunc };
    } else if (colorBy === 'conservation' && customScores) {
      const atoms = model.selectedAtoms({});
      for (let i = 0; i < atoms.length; i++) {
        const atom = atoms[i];
        if (atom.resi && atom.resi <= customScores.length) {
          atom.b = customScores[atom.resi - 1];
        }
      }
      baseStyle.cartoon = {
        colorscheme: { prop: 'b', gradient: 'whiteGreen', min: -2, max: 4 }
      };
    } else {
      baseStyle.cartoon = { color: 'spectrum' };
    }
  } else if (renderStyle === 'sphere') {
    if (colorBy === 'confidence') {
      baseStyle.sphere = { colorfunc: colorFunc, scale: 0.3 };
    } else {
      baseStyle.sphere = { color: 'spectrum', scale: 0.3 };
    }
  } else if (renderStyle === 'stick') {
    if (colorBy === 'confidence') {
      baseStyle.stick = { colorscheme: { prop: 'b', map: colorFunc } };
    } else {
      baseStyle.stick = { colorscheme: 'spectrum' };
    }
  }

  return baseStyle;
}

const ProteinStructureViewer: React.FC<ProteinStructureViewerProps> = ({ 
  pdbData: pdbDataProp,
  structurePath,
  gene,
  highlightResidue, 
  loading: loadingProp,
  label = "Protein Structure",
  colorBy = 'confidence',
  customScores,
  onResidueHover,
  renderStyle = 'cartoon',
  onRenderStyleChange,
  structuralMetrics
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ residue: string; position: number; confidence: number } | null>(null);
  const [libLoaded, setLibLoaded] = useState(false);
  const [pdbData, setPdbData] = useState<string | null>(pdbDataProp || null);
  const [loading, setLoading] = useState(loadingProp ?? false);

  // Fetch PDB content from local path or AlphaFold EBI
  useEffect(() => {
    const fetchPdb = async () => {
      // If we already have PDB data from props, use it
      if (pdbDataProp) {
        setPdbData(pdbDataProp);
        setLoading(false);
        return;
      }

      // Try to fetch from local path
      if (structurePath) {
        setLoading(true);
        try {
          const content = await backendService.fetchStructureFile(structurePath);
          if (content) {
            setPdbData(content);
            setError(null);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Failed to fetch from local path:', e);
        }
      }

      // Fallback to AlphaFold EBI if gene is provided
      if (gene) {
        setLoading(true);
        try {
          const uniprotId = UNIPROT_MAP[gene as keyof typeof UNIPROT_MAP];
          if (uniprotId) {
            const pdbUrl = `https://alphafold.ebi.ac.uk/files/AF-${uniprotId}-F1-model_v4.pdb`;
            const response = await fetch(pdbUrl);
            if (response.ok) {
              const text = await response.text();
              setPdbData(text);
              setError(null);
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn('Failed to fetch from AlphaFold EBI:', e);
        }
      }
      setLoading(false);
    };

    fetchPdb();
  }, [structurePath, gene, pdbDataProp]);

  // Check for 3Dmol library loading
  useEffect(() => {
    const checkLibrary = () => {
      if (typeof window !== 'undefined' && window.$3Dmol) {
        setLibLoaded(true);
        return true;
      }
      return false;
    };

    if (checkLibrary()) return;

    const interval = setInterval(() => {
      if (checkLibrary()) {
        clearInterval(interval);
      }
    }, 200);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (!window.$3Dmol) {
        setError("3D Visualization Library failed to load. Please check your connection.");
      }
    }, 15000); 

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!libLoaded || !containerRef.current || !pdbData) return;
    
    try {
      if (!viewerRef.current) {
        const config = { backgroundColor: '#0f172a' }; 
        viewerRef.current = window.$3Dmol.createViewer(containerRef.current, config);
      }

      const viewer = viewerRef.current;
      viewer.clear();
      
      const model = viewer.addModel(pdbData, "pdb");
      
      const style: any = getStyleForRender(renderStyle, colorBy, customScores, model);
      
      viewer.setStyle({}, style);

      if (highlightResidue) {
        const sel = { resi: highlightResidue };
        viewer.addStyle(sel, { stick: { colorscheme: 'redCarbon', radius: 0.2 } });
        viewer.addStyle(sel, { sphere: { color: '#ef4444', opacity: 0.6, scale: 0.8 } });
        
        viewer.addLabel(`Mut ${highlightResidue}`, { 
          position: sel, 
          backgroundColor: 'rgba(0,0,0,0.7)', 
          fontColor: 'white',
          fontSize: 12,
          borderRadius: 4,
          padding: 2,
          borderThickness: 1,
          borderColor: '#ef4444'
        });
      }

      viewer.setHoverable({}, true, (atom: any) => {
          if(!atom) {
              setHoverInfo(null);
              if (onResidueHover) onResidueHover(null);
              return;
          }
          const info = {
              residue: atom.resn,
              position: atom.resi,
              confidence: atom.b 
          };
          setHoverInfo(info);
          if (onResidueHover) onResidueHover(info);
      }, () => {
          setHoverInfo(null);
          if (onResidueHover) onResidueHover(null);
      });

      viewer.zoomTo();
      viewer.render();

    } catch (e: any) {
      console.error("3Dmol rendering error:", e);
      setError("Failed to render structure. Invalid PDB data.");
    }

  }, [pdbData, highlightResidue, colorBy, customScores, libLoaded, renderStyle]);

  useEffect(() => {
    if (viewerRef.current && pdbData) {
      viewerRef.current.render();
    }
  }, [renderStyle, pdbData]);

  const handleZoom = (direction: 'in' | 'out') => {
    if (viewerRef.current) {
      viewerRef.current.zoom(direction === 'in' ? 1.5 : 0.7, 500);
    }
  };

  const handleReset = () => {
    if (viewerRef.current) {
      viewerRef.current.zoomTo();
    }
  };

  const handleStyleChange = (style: RenderStyle) => {
    if (onRenderStyleChange) {
      onRenderStyleChange(style);
    }
    if (viewerRef.current && pdbData) {
      const viewer = viewerRef.current;
      const model = viewer.addModel(pdbData, "pdb");
      const newStyle = getStyleForRender(style, colorBy, customScores, model);
      viewer.setStyle({}, newStyle);
      viewer.render();
    }
  };

  const getConfidenceColor = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'text-slate-400';
    if (score >= 90) return 'text-blue-400';
    if (score >= 70) return 'text-yellow-400';
    if (score >= 50) return 'text-orange-400';
    return 'text-red-400';
  };

  const getConfidenceLabel = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'N/A';
    if (score >= 90) return 'Very High';
    if (score >= 70) return 'Confident';
    if (score >= 50) return 'Low';
    return 'Very Low';
  };

  if (loading) {
    return (
      <div className="w-full h-80 bg-slate-900 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
        <span className="text-sm font-medium animate-pulse">⏳ Rendering Structure...</span>
      </div>
    );
  }

  if (!configService.getFeatureFlags().enableAlphaFold) {
    return (
      <div className="w-full h-80 bg-slate-900/60 rounded-xl border border-slate-800 flex flex-col items-center justify-center p-6 text-center space-y-2">
        <Box size={28} className="text-slate-500 mb-1" />
        <p className="text-sm font-semibold text-slate-300">AlphaFold 3D Structure Viewer Disabled</p>
        <p className="text-xs text-slate-500 max-w-xs">
          3D interactive structure rendering is disabled in Settings feature flags.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-80 bg-slate-900 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-slate-500 p-4 text-center">
        <div className="bg-slate-800 p-4 rounded-full mb-3">
           <AlertTriangle size={24} className="text-amber-500" />
        </div>
        <p className="text-sm text-amber-200/80 mb-2 font-bold">Visualization Error</p>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  if (!pdbData) {
    return (
      <div className="w-full h-80 bg-slate-900 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-slate-500">
        <Maximize2 size={24} className="opacity-50 mb-2" />
        <p className="text-sm">No structure data loaded</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-80 group">
      <div 
        ref={containerRef} 
        className="w-full h-full bg-slate-950 rounded-xl border border-blue-500/30 shadow-[inset_0_0_24px_rgba(0,0,0,0.9)] overflow-hidden cursor-move relative z-0"
        role="application"
        aria-label="3D Protein Structure Viewer"
      ></div>
      
      <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-blue-500/40 text-xs text-white font-mono pointer-events-none flex items-center gap-2 z-10 shadow-[0_0_12px_rgba(59,130,246,0.3)]">
        <span className="mm-status-dot text-blue-400" />
        <span className="font-bold">{label}</span>
        {colorBy === 'confidence' && <span className="text-[10px] text-blue-400 font-sans font-bold uppercase">(pLDDT Mode)</span>}
        {colorBy === 'conservation' && <span className="text-[10px] text-emerald-400 font-sans font-bold uppercase">(Evolutionary)</span>}
      </div>

      {hoverInfo && (
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none bg-slate-900/95 border border-slate-600 p-3 rounded-lg shadow-2xl text-white text-xs z-20 backdrop-blur-md min-w-[120px]"
            role="tooltip"
            aria-live="polite"
          >
              <div className="font-bold text-lg mb-1 flex items-center gap-2 text-white">
                  <Info size={16} className="text-primary"/> {hoverInfo.residue}{hoverInfo.position}
              </div>
              <div className="space-y-1 text-slate-300">
                  <div className="flex justify-between gap-4">
                      <span>{colorBy === 'conservation' ? 'Conservation' : 'pLDDT'}:</span>
                      <span className={`font-mono font-bold ${hoverInfo.confidence > 70 ? 'text-blue-400' : hoverInfo.confidence < 50 ? 'text-red-400' : 'text-yellow-400'}`}>
                        {hoverInfo.confidence.toFixed(1)}
                      </span>
                  </div>
              </div>
          </div>
      )}

      <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-2 py-2 rounded-lg text-[10px] text-white flex flex-col gap-1.5 pointer-events-none border border-white/10 z-10 shadow-lg">
          {colorBy === 'confidence' && (
              <>
                <div className="flex items-center gap-2"><div className="w-3 h-1 bg-[#3b82f6]"></div> &gt;90 High</div>
                <div className="flex items-center gap-2"><div className="w-3 h-1 bg-[#eab308]"></div> 70-90 Good</div>
                <div className="flex items-center gap-2"><div className="w-3 h-1 bg-[#f97316]"></div> 50-70 Low</div>
                <div className="flex items-center gap-2"><div className="w-3 h-1 bg-[#ef4444]"></div> &lt;50 Poor</div>
              </>
          )}
          {colorBy === 'conservation' && (
              <>
                <div className="flex items-center gap-2"><div className="w-3 h-1 bg-green-700"></div> Conserved</div>
                <div className="flex items-center gap-2"><div className="w-3 h-1 bg-green-400"></div> Variable</div>
                <div className="flex items-center gap-2"><div className="w-3 h-1 bg-white"></div> Divergent</div>
              </>
          )}
      </div>

      {structuralMetrics && (
        <div className="absolute bottom-16 left-3 bg-slate-950/90 backdrop-blur-md border border-slate-700/60 rounded-lg p-2.5 text-[10px] text-white z-10 shadow-lg">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Atom size={12} className="text-primary" />
            <span className="font-extrabold uppercase tracking-wider text-slate-300">Structural Metrics</span>
          </div>
          <div className="space-y-1">
            {structuralMetrics.plddt_avg !== null && structuralMetrics.plddt_avg !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">pLDDT:</span>
                <span className={`font-mono font-bold ${getConfidenceColor(structuralMetrics.plddt_avg)}`}>
                  {structuralMetrics.plddt_avg.toFixed(1)}
                </span>
                <span className="text-slate-500 text-[9px]">({getConfidenceLabel(structuralMetrics.plddt_avg)})</span>
              </div>
            )}
            {structuralMetrics.rmsd_to_wildtype !== null && structuralMetrics.rmsd_to_wildtype !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">RMSD:</span>
                <span className="font-mono font-bold text-cyan-400">
                  {structuralMetrics.rmsd_to_wildtype.toFixed(2)}Å
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {structuralMetrics?.domains_affected && structuralMetrics.domains_affected.length > 0 && (
        <div className="absolute bottom-16 right-3 bg-slate-950/90 backdrop-blur-md border border-slate-700/60 rounded-lg p-2.5 text-[10px] text-white z-10 shadow-lg max-w-[160px]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Layers size={12} className="text-cyan-400" />
            <span className="font-extrabold uppercase tracking-wider text-slate-300">Domains</span>
          </div>
          <div className="space-y-0.5">
            {structuralMetrics.domains_affected.map((domain, idx) => (
              <div key={idx} className="text-cyan-300 font-medium truncate" title={domain}>
                {domain}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
        {(['cartoon', 'sphere', 'stick'] as RenderStyle[]).map((style) => (
          <button
            key={style}
            onClick={() => handleStyleChange(style)}
            className={[
              'px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border transition-all shadow-lg',
              renderStyle === style
                ? 'bg-primary/30 border-primary text-primary shadow-[0_0_8px_rgba(var(--mm-color-primary),0.4)]'
                : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
            ].join(' ')}
            title={`Switch to ${style} view`}
          >
            {style}
          </button>
        ))}
      </div>

      <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
        <button onClick={() => handleZoom('out')} className="p-2 bg-slate-800/90 text-white rounded-lg hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all shadow-lg" title="Zoom Out">
          <ZoomOut size={16} />
        </button>
        <button onClick={handleReset} className="p-2 bg-slate-800/90 text-white rounded-lg hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all shadow-lg" title="Reset View">
          <RotateCcw size={16} />
        </button>
        <button onClick={() => handleZoom('in')} className="p-2 bg-slate-800/90 text-white rounded-lg hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all shadow-lg" title="Zoom In">
          <ZoomIn size={16} />
        </button>
      </div>
    </div>
  );
};

export default ProteinStructureViewer;