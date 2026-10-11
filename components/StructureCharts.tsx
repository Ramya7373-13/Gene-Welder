import React, { useCallback, useRef, useState } from 'react';
import { PredictionData } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { Loader2 } from 'lucide-react';

interface StructureChartsProps {
  data?: PredictionData | null;
  loading: boolean;
}

const StructureCharts: React.FC<StructureChartsProps> = ({ data, loading }) => {
  const [orbitRotation, setOrbitRotation] = useState(0);
  const [orbitScale, setOrbitScale] = useState(1);
  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    lastX: number;
    lastY: number;
    lastAngle: number;
  }>({
    active: false,
    pointerId: -1,
    lastX: 0,
    lastY: 0,
    lastAngle: 0,
  });

  const chartWrapperRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const wrapper = chartWrapperRef.current;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastY: e.clientY,
      lastAngle: Math.atan2(e.clientY - centerY, e.clientX - centerX),
    };

    wrapper.setPointerCapture(e.pointerId);
    wrapper.style.cursor = 'grabbing';
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag.active || e.pointerId !== drag.pointerId) return;

    const wrapper = chartWrapperRef.current;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);

    let angleDelta = currentAngle - drag.lastAngle;
    if (angleDelta > Math.PI) angleDelta -= 2 * Math.PI;
    if (angleDelta < -Math.PI) angleDelta += 2 * Math.PI;

    setOrbitRotation(prev => prev + angleDelta + (e.clientX - drag.lastX) * 0.0025);

    const dy = e.clientY - drag.lastY;
    const scaleDelta = -dy * 0.005;
    setOrbitScale(prev => Math.max(0.72, Math.min(1.28, prev + scaleDelta)));

    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.lastAngle = currentAngle;
  }, []);

  const stopOrbitDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || dragRef.current.pointerId !== e.pointerId) {
      return;
    }

    dragRef.current.active = false;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    e.currentTarget.style.cursor = 'grab';
  }, []);

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    stopOrbitDrag(e);
  }, [stopOrbitDrag]);

  const resetOrbit = useCallback(() => {
    setOrbitRotation(0);
    setOrbitScale(1);
  }, []);

  // Theme colors
  const THEME = {
    background: '#1e293b', // slate-800
    text: '#94a3b8',       // slate-400
    grid: '#334155',       // slate-700
    tooltipBg: '#0f172a',  // slate-900
    tooltipBorder: '#334155',
    barNative: '#10b981',  // emerald-500
    barMutant: '#ef4444',  // red-500
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart Skeleton */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 h-80 flex flex-col relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-700/10 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite]"></div>
          
          <div className="flex justify-between items-center mb-6 relative z-10">
            <div className="h-6 w-48 bg-slate-700 rounded animate-pulse"></div>
            <div className="h-5 w-20 bg-slate-700 rounded animate-pulse"></div>
          </div>
          
          <div className="flex-1 flex flex-col justify-center space-y-6 px-2 relative z-10">
             {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-4">
                   <div className="w-12 h-4 bg-slate-700 rounded animate-pulse"></div>
                   <div className="flex-1 h-10 bg-slate-700/50 rounded-r-md overflow-hidden relative">
                      <div 
                        className={`h-full bg-slate-700 rounded-r-md animate-pulse ${i===0 ? 'w-[85%]' : 'w-[60%]'} ${(i===0 && 'delay-75') || (i===1 && 'delay-150') || ''}`}
                      ></div>
                   </div>
                </div>
             ))}
          </div>

          <div className="h-px bg-slate-700 mt-4 w-full mx-auto relative z-10"></div>
          
          <div className="absolute bottom-4 right-4 flex items-center gap-2 text-slate-500 text-xs">
             <Loader2 className="h-3 w-3 animate-spin" /> Calculating pLDDT...
          </div>
        </div>

        {/* Radar Chart Skeleton */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 h-80 flex flex-col relative overflow-hidden">
           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-700/10 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite] delay-150"></div>

          <div className="h-6 w-48 bg-slate-700 rounded mb-4 animate-pulse relative z-10"></div>
          <div className="flex-1 flex items-center justify-center relative z-10">
            <div className="relative">
              <div className="absolute inset-0 rounded-full border border-slate-700/40 animate-ping opacity-20"></div>
              <div className="h-48 w-48 rounded-full border border-slate-700/40 flex items-center justify-center">
                 <div className="h-32 w-32 rounded-full border border-slate-700/60 flex items-center justify-center">
                    <div className="h-16 w-16 rounded-full bg-slate-700/20 animate-pulse"></div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const confidenceData = [
    {
      name: 'Native',
      score: data.native.plddt_avg,
      fill: THEME.barNative,
    },
    {
      name: 'Mutant',
      score: data.mutant.plddt_avg,
      fill: THEME.barMutant,
    },
  ];

  const metricsData = [
    { subject: 'Core Packing', native: 90, mutant: 65, fullMark: 100 },
    { subject: 'Solvent Exp.', native: 85, mutant: 80, fullMark: 100 },
    { subject: 'H-Bonds', native: 95, mutant: 50, fullMark: 100 },
    { subject: 'Hydrophobicity', native: 70, mutant: 85, fullMark: 100 },
    { subject: 'Flexibility', native: 40, mutant: 90, fullMark: 100 },
  ];

  const mapHexToVariant = (hex?: string) => {
    const mapping: Record<string, string> = {
      '#ef4444': 'ef4444',
      '#f59e0b': 'f59e0b',
      '#8b5cf6': '8b5cf6',
      '#06b6d4': '06b6d4',
      '#6b7280': '6b7280',
      '#10b981': '10b981'
    };
    const key = (hex || '').toLowerCase();
    const normalized = mapping[key] || '6b7280';
    return {
      text: `text-variant-${normalized}`
    };
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-3 rounded shadow-xl chart-tooltip">
          <p className="text-slate-200 font-bold mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
             <p key={index} className={`text-xs font-mono ${mapHexToVariant(entry.color).text}`}>
               {entry.name}: {entry.value}
             </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const RadarCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-3 rounded shadow-xl chart-tooltip">
          <p className="text-slate-200 font-bold mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className={`text-xs font-mono ${mapHexToVariant(entry.color).text}`}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
      {/* Confidence Score Chart */}
      <div className="p-6 rounded-xl border border-slate-700 shadow-sm hover:border-slate-600 transition-colors bg-theme-background">
        <h3 className="text-white font-semibold mb-4 flex items-center justify-between">
          <span>Global pLDDT Confidence</span>
          <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded">Score (0-100)</span>
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={confidenceData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} stroke={THEME.text} tick={{ fill: THEME.text }} />
              <YAxis dataKey="name" type="category" stroke={THEME.text} width={60} tick={{ fill: THEME.text }} />
              <Tooltip 
                content={<CustomTooltip />} 
                cursor={{ fill: THEME.grid, opacity: 0.3 }}
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 text-xs text-slate-400">
           Δ Confidence: <span className="text-red-400 font-mono">-{data.delta.confidence_drop.toFixed(1)}</span>. 
           Values &lt; 70 indicate low confidence/disorder.
        </div>
      </div>

      {/* Structural Stability Radar */}
      <div className="p-6 rounded-xl border border-slate-700 shadow-sm hover:border-slate-600 transition-colors bg-theme-background">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Structural Integrity Profile</h3>
          <button
            type="button"
            onClick={resetOrbit}
            className="text-[10px] uppercase tracking-wide text-slate-500 hover:text-cyan-300 transition-colors"
            title="Reset radar view"
          >
            Reset view
          </button>
        </div>
        <div
          ref={chartWrapperRef}
          className="h-64 w-full select-none overflow-visible"
          style={{ touchAction: 'none', cursor: 'grab' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopOrbitDrag}
          onPointerCancel={stopOrbitDrag}
        >
          <div
            className="h-full w-full"
            style={{
              transform: `rotate(${orbitRotation}rad) scale(${orbitScale})`,
              transformOrigin: 'center center',
              transition: dragRef.current.active
                ? 'none'
                : 'transform 120ms ease-out',
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={metricsData}>
                <PolarGrid stroke={THEME.grid} />
                <PolarAngleAxis dataKey="subject" tick={{ fill: THEME.text, fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Native"
                  dataKey="native"
                  stroke={THEME.barNative}
                  strokeWidth={2}
                  fill={THEME.barNative}
                  fillOpacity={0.3}
                  isAnimationActive={false}
                />
                <Radar
                  name="Mutant"
                  dataKey="mutant"
                  stroke={THEME.barMutant}
                  strokeWidth={2}
                  fill={THEME.barMutant}
                  fillOpacity={0.3}
                  isAnimationActive={false}
                />
                <Legend wrapperStyle={{ fontSize: '12px', color: THEME.text }} />
                <Tooltip content={<RadarCustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-slate-500">
          Left-click and drag around the plot to orbit. Vertical drag changes scale.
        </p>
      </div>
    </div>
  );
};

export default StructureCharts;