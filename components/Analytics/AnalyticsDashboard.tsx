import React, { useMemo, useState, memo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, Legend, AreaChart, Area,
  ComposedChart, Scatter, Rectangle, ZAxis
} from 'recharts';
import { HistoryRecord, RiskLevel, PathogenicityType } from '../../services/historyService';
import { 
  Activity, Shield, TrendingUp, AlertCircle, Clock, 
  BarChart3, PieChart as PieIcon, Download, Trash2, 
  Calendar, FileSpreadsheet, Info, ChevronRight, MousePointer2, Zap, Layout,
  Timer, History as HistoryIcon, UserCircle, ArrowUpRight, ArrowDownRight, Minus,
  RotateCcw, Check, Filter, Sliders, X, FileJson, FileText, CheckCircle2,
  AlertTriangle, Percent, Hash, Target, ChevronUp, ChevronDown, Dna
} from 'lucide-react';

interface AnalyticsDashboardProps {
  records: HistoryRecord[];
  onClear: () => void;
  onExport: (config: ExportConfig) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkArchive: (ids: string[], archive: boolean) => void;
}

export interface ExportConfig {
  format: 'CSV' | 'JSON' | 'PDF' | 'Excel';
  filename: string;
  includeStats: boolean;
  includeCharts: boolean;
  includeRecords: boolean;
  includeMetadata: boolean;
}

interface FiltersState {
  dateRange: 'ALL' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM';
  customDates: [string, string];
  risks: RiskLevel[];
  confidence: [number, number];
  genes: string[];
  pathogenicity: PathogenicityType;
}

// --- Statistical Helpers (Section 6) ---
const getMean = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const getMedian = (arr: number[]) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const getMode = (arr: number[]) => {
  if (!arr.length) return 0;
  const counts: Record<number, number> = {};
  arr.forEach(n => counts[n] = (counts[n] || 0) + 1);
  let max = 0;
  let mode = arr[0];
  for (const n in counts) {
    if (counts[n] > max) {
      max = counts[n];
      mode = Number(n);
    }
  }
  return mode;
};
const getStdDev = (arr: number[], mean: number) => {
  if (arr.length <= 1) return 0;
  const variance = arr.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
};
const getPearsonCorrelation = (x: number[], y: number[]) => {
  const n = x.length;
  if (n !== y.length || n === 0) return 0;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const sumY2 = y.reduce((a, b) => a + b * b, 0);
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  return denominator === 0 ? 0 : numerator / denominator;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Section 7.2 Chart Optimization
const PieCustomTooltip: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="risk-tooltip p-2 rounded text-sm">
      <div className="font-bold">{payload[0].name}</div>
      <div>{payload[0].value}</div>
    </div>
  );
};

const AreaCustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="risk-tooltip p-2 rounded text-sm">
      <div className="font-bold">{label}</div>
      <div>{payload[0].value}</div>
    </div>
  );
};

const MemoizedPieChart = memo(({ data }: { data: any[] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>
      <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={entry.color} />
        ))}
      </Pie>
      <Tooltip content={<PieCustomTooltip/>} />
    </PieChart>
  </ResponsiveContainer>
));

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ 
  records, onClear, onExport, onBulkDelete, onBulkArchive 
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'hotspots' | 'temporal' | 'stats'>('overview');
  const [showFilters, setShowFilters] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    format: 'CSV',
    filename: `mutation_history_${new Date().toISOString().split('T')[0]}`,
    includeStats: true,
    includeCharts: true,
    includeRecords: true,
    includeMetadata: true
  });

  const [filters, setFilters] = useState<FiltersState>({
    dateRange: 'ALL',
    customDates: ['', ''],
    risks: ['LOW', 'MEDIUM', 'HIGH'],
    confidence: [0, 100],
    genes: [],
    pathogenicity: 'ALL'
  });

  // Section 5.1: Apply Filters
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (!filters.risks.includes(r.riskLevel)) return false;
      if (r.confidence < filters.confidence[0] || r.confidence > filters.confidence[1]) return false;
      if (filters.pathogenicity !== 'ALL' && r.pathogenicityLabel !== filters.pathogenicity) return false;
      if (filters.genes.length > 0 && !filters.genes.includes(r.gene)) return false;
      
      const now = new Date();
      const recDate = new Date(r.timestamp);
      if (filters.dateRange === 'WEEK') {
        if (now.getTime() - r.timestamp > 7 * 24 * 60 * 60 * 1000) return false;
      } else if (filters.dateRange === 'MONTH') {
        if (now.getTime() - r.timestamp > 30 * 24 * 60 * 60 * 1000) return false;
      } else if (filters.dateRange === 'YEAR') {
        if (now.getFullYear() !== recDate.getFullYear()) return false;
      } else if (filters.dateRange === 'CUSTOM') {
        if (filters.customDates[0] && new Date(filters.customDates[0]) > recDate) return false;
        if (filters.customDates[1] && new Date(filters.customDates[1]) < recDate) return false;
      }
      return true;
    });
  }, [records, filters]);

  const uniqueGenes = useMemo(() => Array.from(new Set(records.map(r => r.gene))), [records]);

  // Section 6.1: Detailed Statistical Calculations
  const stats = useMemo(() => {
    if (filteredRecords.length === 0) return null;
    
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const twoWeeks = 14 * 24 * 60 * 60 * 1000;

    const riskScores = filteredRecords.map(r => r.pathogenicityScore);
    const confValues = filteredRecords.map(r => r.confidence);

    const meanRisk = getMean(riskScores);
    const meanConf = getMean(confValues);

    const geneCounts: Record<string, number> = {};
    filteredRecords.forEach(r => geneCounts[r.gene] = (geneCounts[r.gene] || 0) + 1);
    const sortedGenes = Object.entries(geneCounts).sort((a, b) => b[1] - a[1]);

    const firstTimestamp = Math.min(...filteredRecords.map(r => r.timestamp));
    const totalDays = Math.max(1, Math.ceil((now - firstTimestamp) / (24 * 60 * 60 * 1000)));

    const last7Days = filteredRecords.filter(r => now - r.timestamp <= oneWeek);
    const prev7Days = filteredRecords.filter(r => now - r.timestamp > oneWeek && now - r.timestamp <= twoWeeks);

    const getTrend = (current: number, previous: number): 'up' | 'stable' | 'down' => {
      if (previous === 0) return current > 0 ? 'up' : 'stable';
      const diff = ((current - previous) / previous);
      if (Math.abs(diff) < 0.05) return 'stable';
      return diff > 0 ? 'up' : 'down';
    };

    const trends = {
      confidence: getTrend(getMean(last7Days.map(r => r.confidence)), getMean(prev7Days.map(r => r.confidence))),
      frequency: getTrend(last7Days.length, prev7Days.length),
      risk: getTrend(getMean(last7Days.map(r => r.pathogenicityScore)), getMean(prev7Days.map(r => r.pathogenicityScore)))
    };

    const correlationConfRisk = getPearsonCorrelation(confValues, riskScores);

    return {
      overview: {
        total: filteredRecords.length,
        avgPerDay: filteredRecords.length / totalDays,
        stdDevDaily: getStdDev(filteredRecords.map(r => new Date(r.timestamp).getDay()), getMean(filteredRecords.map(r => new Date(r.timestamp).getDay())))
      },
      risk: {
        mean: meanRisk,
        median: getMedian(riskScores),
        mode: getMode(riskScores),
        stdDev: getStdDev(riskScores, meanRisk)
      },
      confidence: {
        mean: meanConf,
        median: getMedian(confValues),
        min: Math.min(...confValues),
        max: Math.max(...confValues),
        stdDev: getStdDev(confValues, meanConf)
      },
      genes: {
        unique: sortedGenes.length,
        mostAnalyzed: sortedGenes[0] || ['N/A', 0],
        leastAnalyzed: sortedGenes[sortedGenes.length - 1] || ['N/A', 0]
      },
      correlations: {
        confRisk: correlationConfRisk
      },
      trends
    };
  }, [filteredRecords]);

  const timeSeriesData = useMemo(() => {
    const dailyCounts: Record<string, number> = {};
    const last30Days = [...Array(30)].map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      const dateStr = date.toISOString().split('T')[0];
      dailyCounts[dateStr] = filteredRecords.filter(r => new Date(r.timestamp).toISOString().split('T')[0] === dateStr).length;
      return dateStr;
    });

    return last30Days.map((date, idx, arr) => {
      const count = dailyCounts[date];
      const prev7Days = arr.slice(Math.max(0, idx - 6), idx + 1);
      const avg = prev7Days.reduce((acc, d) => acc + dailyCounts[d], 0) / prev7Days.length;
      return { date: date.slice(5), count, movingAvg: parseFloat(avg.toFixed(2)) };
    });
  }, [filteredRecords]);

  const riskDistData = useMemo(() => {
    const low = filteredRecords.filter(r => r.riskLevel === 'LOW').length;
    const med = filteredRecords.filter(r => r.riskLevel === 'MEDIUM').length;
    const high = filteredRecords.filter(r => r.riskLevel === 'HIGH').length;
    return [
      { name: 'Low Risk', value: low, color: '#10b981' },
      { name: 'Medium Risk', value: med, color: '#f59e0b' },
      { name: 'High Risk', value: high, color: '#ef4444' }
    ].filter(d => d.value > 0);
  }, [filteredRecords]);

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    if (trend === 'up') return <div className="flex items-center text-emerald-400 gap-1 font-bold">📈 <ChevronUp size={14}/></div>;
    if (trend === 'down') return <div className="flex items-center text-red-400 gap-1 font-bold">📉 <ChevronDown size={14}/></div>;
    return <div className="flex items-center text-slate-500 gap-1 font-bold">➡️ <Minus size={14}/></div>;
  };

  const StatCard = ({ label, value, sub, icon: Icon, color, trend }: any) => (
    <div className="mm-card-glowing mm-glow mm-glow--emerald p-5 rounded-2xl group shadow-sm hover:border-emerald-700/50 transition-all overflow-hidden relative">
      <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-5 ${color} blur-2xl`}></div>
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`p-2 rounded-xl ${color} bg-opacity-10 ring-1 ring-inset ring-white/5`}>
          <Icon size={20} className={color.replace('bg-', 'text-')} />
        </div>
        {trend && <div className="text-[10px] uppercase font-bold tracking-widest"><TrendIcon trend={trend} /></div>}
      </div>
      <div className="text-3xl font-bold text-white mb-1 relative z-10">{value}</div>
      <div className="text-xs text-slate-500 font-bold uppercase tracking-wider relative z-10">{label}</div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {/* 4.0: Dashboard Header & Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
            {['overview', 'hotspots', 'temporal', 'stats'].map((t) => (
              <button 
                key={t}
                onClick={() => setActiveTab(t as any)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all capitalize ${activeTab === t ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg border transition-all ${showFilters ? 'bg-primary/20 border-primary text-primary' : 'mm-btn-tactical !bg-slate-900 !border-slate-800 text-slate-400'}`}
          >
            <Filter size={14} /> Filters {filteredRecords.length < records.length && `(${filteredRecords.length})`}
          </button>
        </div>
        <div className="flex items-center gap-3">
           <button onClick={() => setShowExportModal(true)} className="group flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg border border-slate-700 transition-all active:scale-95 shadow-sm">
             <Download size={14} /> Export Report
           </button>
           <button onClick={onClear} className="flex items-center gap-2 px-4 py-2 bg-red-950/20 hover:bg-red-900/40 text-red-400 text-xs font-bold rounded-lg border border-red-900/30 transition-all">
             <Trash2 size={14} /> Wipe History
           </button>
        </div>
      </div>

      {/* SECTION 5.1: Advanced Filters Panel */}
      {showFilters && (
        <div className="mm-card-glowing mm-glow mm-glow--emerald p-6 rounded-2xl animate-in slide-in-from-top-4 duration-300">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-widest mm-section-accent mm-section-accent--emerald"><Sliders size={16} className="text-primary"/> Analysis Filters</h3>
              <button onClick={() => setFilters({
                dateRange: 'ALL', customDates: ['', ''], risks: ['LOW', 'MEDIUM', 'HIGH'], confidence: [0, 100], genes: [], pathogenicity: 'ALL'
              })} className="text-[10px] text-primary hover:underline font-bold uppercase tracking-widest flex items-center gap-1">
                <RotateCcw size={10}/> Reset Defaults
              </button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Date Range */}
              <div className="space-y-3">
                 <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Time Period</label>
                 <div className="grid grid-cols-2 gap-2">
                    {['ALL', 'WEEK', 'MONTH', 'YEAR'].map(range => (
                      <button 
                        key={range}
                        onClick={() => setFilters(prev => ({ ...prev, dateRange: range as any }))}
                        className={`px-2 py-1.5 text-[10px] rounded font-bold border transition-all ${filters.dateRange === range ? 'bg-primary border-primary text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                      >
                        {range}
                      </button>
                    ))}
                 </div>
                 {filters.dateRange === 'CUSTOM' && (
                    <div className="flex gap-2 animate-in fade-in slide-in-from-top-2 pt-2">
                       <input aria-label="Custom start date" type="date" value={filters.customDates[0]} onChange={e => setFilters(prev => ({ ...prev, customDates: [e.target.value, prev.customDates[1]] }))} className="mm-input-tactical px-2 py-1 text-[10px] text-white w-full" />
                       <input aria-label="Custom end date" type="date" value={filters.customDates[1]} onChange={e => setFilters(prev => ({ ...prev, customDates: [prev.customDates[0], e.target.value] }))} className="mm-input-tactical px-2 py-1 text-[10px] text-white w-full" />
                    </div>
                 )}
              </div>

              {/* Risk Level */}
              <div className="space-y-3">
                 <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Risk Threshold</label>
                 <div className="space-y-2">
                    {(['LOW', 'MEDIUM', 'HIGH'] as RiskLevel[]).map(risk => (
                      <label key={risk} className="flex items-center gap-3 cursor-pointer group">
                         <input
                           type="checkbox"
                           checked={filters.risks.includes(risk)}
                           onChange={() => setFilters(prev => ({
                             ...prev,
                             risks: prev.risks.includes(risk) ? prev.risks.filter(r => r !== risk) : [...prev.risks, risk]
                           }))}
                           aria-label={`${risk} risk`}
                           className={`w-4 h-4 rounded border transition-all ${filters.risks.includes(risk) ? 'bg-primary border-primary' : 'bg-slate-950 border-slate-800 group-hover:border-slate-700'}`}
                         />
                         <span className="text-[11px] text-slate-300 font-medium">{risk} RISK</span>
                      </label>
                    ))}
                 </div>
              </div>

              {/* Confidence Slider */}
              <div className="space-y-3">
                 <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Confidence Min: {filters.confidence[0]}%</label>
                 <input 
                    aria-label="Minimum confidence"
                    type="range" 
                    min="0" max="100" 
                    value={filters.confidence[0]} 
                    onChange={e => setFilters(prev => ({ ...prev, confidence: [parseInt(e.target.value), 100] }))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                 />
                 <label htmlFor="pathogenicity" className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block pt-2">Pathogenicity Tier</label>
                 <select 
                   id="pathogenicity"
                   value={filters.pathogenicity}
                   onChange={e => setFilters(prev => ({ ...prev, pathogenicity: e.target.value as any }))}
                   className="w-full mm-input-tactical px-2 py-1.5 text-[11px] text-slate-300 outline-none"
                 >
                    <option value="ALL">All Pathogenicities</option>
                    <option value="BENIGN">Benign</option>
                    <option value="VUS">VUS</option>
                    <option value="PATHOGENIC">Pathogenic</option>
                 </select>
              </div>

              {/* Gene Selection */}
              <div className="space-y-3">
                 <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Target Gene(s)</label>
                 <div className="max-h-32 overflow-y-auto pr-2 space-y-1 custom-scrollbar">
                    {uniqueGenes.map(gene => (
                      <label key={gene} className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={filters.genes.includes(gene)}
                          onChange={() => setFilters(prev => ({
                            ...prev,
                            genes: prev.genes.includes(gene) ? prev.genes.filter(g => g !== gene) : [...prev.genes, gene]
                          }))}
                          className="w-3 h-3 rounded border-slate-800 bg-slate-950 text-primary focus:ring-0"
                        />
                        <span className="text-[11px] text-slate-400 font-mono">{gene}</span>
                      </label>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* SECTION 5.2: Export Dialog Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="mm-card-glowing mm-glow mm-glow--blue w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <div className="bg-primary/20 p-2 rounded-lg"><Download className="text-primary" size={20}/></div>
                    <div>
                       <h3 className="text-lg font-bold text-white">Export Variant History</h3>
                       <p className="text-xs text-slate-500">Configure your statistical audit report</p>
                    </div>
                 </div>
                 <button onClick={() => setShowExportModal(false)} className="text-slate-500 hover:text-white transition-colors" aria-label="Close export dialog" title="Close export dialog"><X size={20}/></button>
              </div>

              <div className="p-8 space-y-8">
                 <div className="space-y-4">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Select Output Format</label>
                    <div className="grid grid-cols-4 gap-3">
                       {(['CSV', 'JSON', 'PDF', 'Excel'] as const).map(fmt => (
                          <button 
                             key={fmt}
                             onClick={() => setExportConfig(prev => ({ ...prev, format: fmt }))}
                             className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${exportConfig.format === fmt ? 'bg-rose-500/10 border-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)] mm-glow--rose' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                             aria-pressed={exportConfig.format === fmt ? 'true' : 'false'}
                          >
                             {fmt === 'CSV' && <FileSpreadsheet size={20}/> }
                             {fmt === 'JSON' && <FileJson size={20}/>}
                             {fmt === 'PDF' && <FileText size={20}/>}
                             {fmt === 'Excel' && <Layout size={20}/>}
                             <span className="text-[10px] font-bold tracking-widest">{fmt}</span>
                          </button>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Include in Report</label>
                    <div className="grid grid-cols-2 gap-4">
                       {[
                         { id: 'includeStats', label: 'Summary Statistics', icon: <TrendingUp size={14}/> },
                         { id: 'includeCharts', label: 'Visualization Charts', icon: <PieIcon size={14}/> },
                         { id: 'includeRecords', label: 'Detailed Records', icon: <HistoryIcon size={14}/> },
                         { id: 'includeMetadata', label: 'AlphaGenome Metadata', icon: <Shield size={14}/> }
                       ].map(opt => (
                         <label key={opt.id} className="flex items-center gap-3 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              checked={(exportConfig as any)[opt.id]}
                              onChange={() => setExportConfig(prev => ({ ...prev, [opt.id]: !(prev as any)[opt.id] }))}
                              className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-primary focus:ring-0"
                            />
                            <span className="flex items-center gap-2 text-xs text-slate-300 font-medium group-hover:text-white transition-colors">
                               {opt.icon} {opt.label}
                            </span>
                         </label>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label htmlFor="export-filename" className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">File Name</label>
                    <input 
                      id="export-filename"
                      aria-label="Export filename"
                      placeholder="mutation_history_YYYY-MM-DD.csv"
                      type="text" 
                      value={exportConfig.filename}
                      onChange={e => setExportConfig(prev => ({ ...prev, filename: e.target.value }))}
                      className="mm-input-tactical py-3 px-4 text-sm text-white w-full outline-none font-mono transition-colors"
                    />
                 </div>
              </div>

              <div className="p-6 bg-slate-950/50 border-t border-slate-800 flex gap-3">
                 <button onClick={() => setShowExportModal(false)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-xs rounded-xl border border-slate-700 transition-all">Cancel</button>
                 <button onClick={() => { onExport(exportConfig); setShowExportModal(false); }} className="mm-btn-tactical !w-full py-3 text-white transition-all flex items-center justify-center gap-2">
                   <CheckCircle2 size={16}/> Confirm Export
                 </button>
              </div>
           </div>
        </div>
      )}

      {!stats ? (
        <div className="mm-card-glowing mm-glow mm-glow--emerald py-20 text-center border-dashed rounded-2xl group">
           <AlertTriangle size={48} className="text-slate-700 mx-auto mb-4" />
           <h3 className="text-lg font-bold text-slate-500">No matching records found</h3>
           <p className="text-slate-600 text-sm mt-2 max-w-xs mx-auto">Adjust your filters or perform more analyses to populate this dashboard.</p>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-500">
                <StatCard label="Analyses" value={stats.overview.total} sub="Count" icon={Hash} color="bg-primary" trend={stats.trends.frequency} />
                <StatCard label="Avg Confidence" value={`${stats.confidence.mean.toFixed(0)}%`} sub="Trust" icon={Shield} color="bg-emerald-500" trend={stats.trends.confidence} />
                <StatCard label="Mean Risk Score" value={stats.risk.mean.toFixed(1)} sub="Pathogenicity" icon={AlertCircle} color="bg-red-500" trend={stats.trends.risk} />
                <StatCard label="Unique Genes" value={stats.genes.unique} sub="Diversity" icon={Target} color="bg-violet-500" />
              </div>

                <div role="radiogroup" aria-label="Export format" className="grid grid-cols-4 gap-3">
                  {(['CSV', 'JSON', 'PDF', 'Excel'] as const).map(fmt => (
                    <button 
                      key={fmt}
                      role="radio"
                      aria-checked={exportConfig.format === fmt ? 'true' : 'false'}
                      onClick={() => setExportConfig(prev => ({ ...prev, format: fmt }))}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${exportConfig.format === fmt ? 'bg-rose-500/10 border-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)] mm-glow--rose' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                    >
                      {fmt === 'CSV' && <FileSpreadsheet size={20}/> }
                      {fmt === 'JSON' && <FileJson size={20}/>}
                      {fmt === 'PDF' && <FileText size={20}/>}
                      {fmt === 'Excel' && <Layout size={20}/>}
                      <span className="text-[10px] font-bold tracking-widest">{fmt}</span>
                    </button>
                  ))}
                </div>

                <div className="mm-card-glowing mm-glow mm-glow--emerald p-6 rounded-2xl">
                  <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2 mm-section-accent mm-section-accent--emerald">
                    <Activity size={16} className="text-primary" /> Analysis Frequency
                  </h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeSeriesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip content={<AreaCustomTooltip/>} />
                        <Area type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                        <Line type="monotone" dataKey="movingAvg" stroke="#22d3ee" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
            </>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
               {/* 6.1 Summary Stats Grid */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="mm-card-glowing mm-glow mm-glow--emerald p-6 rounded-2xl">
                     <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 mm-section-accent mm-section-accent--emerald"><Activity size={14} className="text-primary" /> Analyses Overview</h4>
                     <div className="space-y-4">
                        <div className="flex justify-between border-b border-slate-800 pb-2">
                           <span className="text-slate-400 text-xs">Total Analyses</span>
                           <span className="text-white font-bold">{stats.overview.total}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800 pb-2">
                           <span className="text-slate-400 text-xs">Avg / Day</span>
                           <span className="text-white font-bold">{stats.overview.avgPerDay.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                           <span className="text-slate-400 text-xs">Std Dev Daily</span>
                           <span className="text-white font-bold">{stats.overview.stdDevDaily.toFixed(2)}</span>
                        </div>
                     </div>
                  </div>

                  <div className="mm-card-glowing mm-glow mm-glow--emerald p-6 rounded-2xl">
                     <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 mm-section-accent mm-section-accent--emerald"><AlertCircle size={14} className="text-red-400" /> Risk Analysis</h4>
                     <div className="space-y-4">
                        <div className="flex justify-between border-b border-slate-800 pb-2">
                           <span className="text-slate-400 text-xs">Mean Risk</span>
                           <span className="text-white font-bold">{stats.risk.mean.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800 pb-2">
                           <span className="text-slate-400 text-xs">Median</span>
                           <span className="text-white font-bold">{stats.risk.median.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                           <span className="text-slate-400 text-xs">Mode</span>
                           <span className="text-white font-bold">{stats.risk.mode}</span>
                        </div>
                     </div>
                  </div>

                  <div className="mm-card-glowing mm-glow mm-glow--emerald p-6 rounded-2xl">
                     <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 mm-section-accent mm-section-accent--emerald"><Shield size={14} className="text-emerald-400" /> Confidence</h4>
                     <div className="space-y-4">
                        <div className="flex justify-between border-b border-slate-800 pb-2">
                           <span className="text-slate-400 text-xs">Mean</span>
                           <span className="text-white font-bold">{stats.confidence.mean.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800 pb-2">
                           <span className="text-slate-400 text-xs">Min / Max</span>
                           <span className="text-white font-bold">{stats.confidence.min}% - {stats.confidence.max}%</span>
                        </div>
                        <div className="flex justify-between">
                           <span className="text-slate-400 text-xs">Std Dev</span>
                           <span className="text-white font-bold">{stats.confidence.stdDev.toFixed(2)}</span>
                        </div>
                     </div>
                  </div>

                  <div className="mm-card-glowing mm-glow mm-glow--emerald p-6 rounded-2xl">
                     <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 mm-section-accent mm-section-accent--emerald"><Target size={14} className="text-violet-400" /> Gene Statistics</h4>
                     <div className="space-y-4">
                        <div className="flex justify-between border-b border-slate-800 pb-2">
                           <span className="text-slate-400 text-xs">Unique Genes</span>
                           <span className="text-white font-bold">{stats.genes.unique}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800 pb-2">
                           <span className="text-slate-400 text-xs">Most Analyzed</span>
                           <span className="text-white font-bold uppercase text-[10px]">{stats.genes.mostAnalyzed[0]} ({stats.genes.mostAnalyzed[1]})</span>
                        </div>
                        <div className="flex justify-between">
                           <span className="text-slate-400 text-xs">Least Analyzed</span>
                           <span className="text-white font-bold uppercase text-[10px]">{stats.genes.leastAnalyzed[0]} ({stats.genes.leastAnalyzed[1]})</span>
                        </div>
                     </div>
                  </div>
               </div>

               {/* 6.2 Correlation Analysis */}
               <div className="mm-card-glowing mm-glow mm-glow--emerald p-6 rounded-2xl">
                  <h4 className="text-sm font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2 mm-section-accent mm-section-accent--emerald"><Zap size={16} className="text-primary" /> Correlation Analysis</h4>
                  <div className="flex flex-col md:flex-row gap-8 items-center">
                    <div className="relative w-40 h-40 flex items-center justify-center">
                       <svg className="w-full h-full transform -rotate-90">
                          <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                          <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={440} strokeDashoffset={440 - (440 * Math.abs(stats.correlations.confRisk))} className={stats.correlations.confRisk > 0 ? "text-emerald-500" : "text-red-500"} />
                       </svg>
                       <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-2xl font-bold text-white">{stats.correlations.confRisk.toFixed(2)}</span>
                          <span className="text-[8px] text-slate-500 uppercase font-bold">Pearson coeff</span>
                       </div>
                    </div>
                    <div className="flex-1 p-4 bg-slate-950 rounded-xl border border-slate-800">
                       <div className="text-xs font-bold text-slate-300 mb-1">Model Confidence vs. Risk Score</div>
                       <p className="text-xs text-slate-500 leading-relaxed italic">
                         {stats.correlations.confRisk > 0.3 ? "Positive: Higher pathogenicity variants are identified with greater model confidence." : stats.correlations.confRisk < -0.3 ? "Negative: Predictive certainty decreases for high-risk loci." : "Weak correlation detected in current analysis window."}
                       </p>
                    </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'hotspots' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
              <div className="mm-card-glowing mm-glow mm-glow--emerald p-6 rounded-2xl">
                <h3 className="text-sm font-bold text-slate-400 uppercase mb-6 flex items-center gap-2 mm-section-accent mm-section-accent--emerald"><Layout size={16} className="text-primary" /> Gene-Level Hotspots</h3>
                <div className="space-y-4">
                  {uniqueGenes.slice(0, 5).map((gene, i) => (
                    <div key={i} className="bg-slate-950 border border-slate-800 p-4 rounded-xl group hover:border-primary/40 transition-colors flex justify-between items-center">
                       <span className="font-bold text-white text-lg">{gene}</span>
                       <div className="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full font-mono uppercase tracking-widest font-bold">
                         {records.filter(r => r.gene === gene).length} Analyses
                       </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mm-card-glowing mm-glow mm-glow--emerald p-6 rounded-2xl">
                 <h3 className="text-sm font-bold text-slate-400 uppercase mb-6 flex items-center gap-2 mm-section-accent mm-section-accent--emerald"><Zap size={16} className="text-primary" /> 7-Day Performance Trends</h3>
                 <div className="grid grid-cols-1 gap-3">
                    {[
                       { label: "Confidence", value: `${stats.confidence.mean.toFixed(1)}%`, trend: stats.trends.confidence, icon: <Shield size={16}/> },
                       { label: "Frequency", value: `${filteredRecords.length} units`, trend: stats.trends.frequency, icon: <Activity size={16}/> },
                       { label: "Risk Mean", value: stats.risk.mean.toFixed(1), trend: stats.trends.risk, icon: <AlertCircle size={16}/> }
                    ].map((t, i) => (
                       <div key={i} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                          <div className="flex items-center gap-4">
                             <div className="p-2 bg-slate-900 rounded-lg text-slate-400">{t.icon}</div>
                             <div className="text-xs font-bold text-white">{t.label}</div>
                          </div>
                          <div className="text-right">
                             <div className="text-sm font-bold text-white mb-1">{t.value}</div>
                             <TrendIcon trend={t.trend} />
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'temporal' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
               <div className="mm-card-glowing mm-glow mm-glow--emerald p-6 rounded-2xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <HistoryIcon size={120} className="text-primary" />
                </div>
                <h3 className="text-sm font-bold text-slate-400 uppercase mb-6 flex items-center gap-2 relative z-10">
                  <HistoryIcon size={16} className="text-primary" /> Recurrence Tracking
                </h3>
                <div className="relative z-10 overflow-x-auto text-slate-400 text-sm italic py-12 text-center bg-slate-950/50 rounded-xl border border-slate-800 border-dashed">
                  Temporal analysis logic active. Perform multiple analyses on specific loci to see stability trends.
                </div>
               </div>
            </div>
          )}
        </>
      )}

      {/* Footer Meta */}
      <div className="flex justify-center pt-4">
         <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 rounded-full border border-slate-800/50 text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">
            <Info size={12} className="text-primary" /> AlphaGenome Statistical Core v3.0 Optimized
         </div>
      </div>
    </div>
  );
};

export default memo(AnalyticsDashboard);






