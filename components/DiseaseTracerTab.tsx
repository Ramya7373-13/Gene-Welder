import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Loader, AlertTriangle, User, Activity, Target, Pill, Users, Clock,
  ChevronDown
} from 'lucide-react';
import { backendService } from '../services/backendService';
import EmptyState from './EmptyState';
import DnaHelixBackdrop from './DnaHelixBackdrop';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface RiskScore {
  cardiovascular: number;
  cancer: number;
  neurodegenerative: number;
  metabolic: number;
  biologicalAge: number;
  chronologicalAge: number;
  longevityScore: number;
  topInterventions: string[];
}

type SubTab = 'risk-details' | 'ancestral-timeline' | 'interventions' | 'population-comparison' | 'variant-browser';

const SUB_TABS: { id: SubTab; label: string; badge?: { text: string; color: string } }[] = [
  { id: 'risk-details',          label: 'Risk Details' },
  { id: 'ancestral-timeline',    label: 'Ancestral Timeline',     badge: { text: 'NEW',  color: 'bg-red-500' } },
  { id: 'interventions',         label: 'Interventions' },
  { id: 'population-comparison', label: 'Population Comparison',  badge: { text: 'NEW',  color: 'bg-red-500' } },
  { id: 'variant-browser',       label: 'Variant Browser',        badge: { text: 'BETA', color: 'bg-blue-500' } },
];

const DiseaseTracerTab: React.FC = () => {
  const [patientId, setPatientId]   = useState<string>('');
  const [patients, setPatients]     = useState<{ id: string; patientId: string; name?: string }[]>([]);
  const [riskData, setRiskData]     = useState<RiskScore | null>(null);
  const [loading, setLoading]       = useState<boolean>(false);
  const [activeTab, setActiveTab]   = useState<SubTab>('risk-details');
  const [error, setError]           = useState<string | null>(null);
  const tabListRef                  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    backendService.getPatients()
      .then(setPatients)
      .catch(() => setError('Failed to load patients from backend.'));
  }, []);

  const loadRiskProfile = async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:5000/api/risk-assessment/${patientId}`);
      if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
      setRiskData(await response.json());
    } catch (err: any) {
      setError(`Error loading risk profile: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Keyboard arrow nav for sub-tabs
  const handleTabKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const tabs = tabListRef.current?.querySelectorAll<HTMLButtonElement>('button[role="tab"]:not([disabled])');
    if (!tabs) return;
    const arr = Array.from(tabs);
    const idx = arr.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowRight') { e.preventDefault(); arr[(idx + 1) % arr.length]?.focus(); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); arr[(idx - 1 + arr.length) % arr.length]?.focus(); }
  }, []);

  const riskChartData = riskData ? [
    { name: 'Cardiovascular',  risk: riskData.cardiovascular },
    { name: 'Cancer',          risk: riskData.cancer },
    { name: 'Neurodegenerative', risk: riskData.neurodegenerative },
    { name: 'Metabolic',       risk: riskData.metabolic },
  ] : [];

  const clampPercent  = (p: number) => Math.max(0, Math.min(100, Math.round(p)));
  const getWidthClass = (p?: number) => `w-p-${clampPercent(p ?? 0)}`;
  const clampPx       = (v: number, max = 50) => Math.max(1, Math.min(max, Math.round(v)));
  const getHeightClass = (v?: number) => `h-px-${clampPx(v ?? 1, 50)}`;
  const mapHexToVariant = (hex?: string) => {
    const map: Record<string, string> = { '#ef4444':'ef4444','#f59e0b':'f59e0b','#8b5cf6':'8b5cf6','#06b6d4':'06b6d4','#6b7280':'6b7280','#10b981':'10b981' };
    const norm = map[(hex || '').toLowerCase()] || '6b7280';
    return { bg: `bg-variant-${norm}`, bgAlpha: `bg-variant-${norm}-20`, text: `text-variant-${norm}` };
  };
  const longevityBgClass = (s?: number) => (s ?? 0) > 80 ? 'bg-variant-10b981' : (s ?? 0) > 60 ? 'bg-variant-f59e0b' : 'bg-variant-ef4444';

  const CustomTooltip: React.FC<any> = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="risk-tooltip p-2 rounded text-sm">
        <div className="font-bold">{payload[0].name}</div>
        <div>{payload[0].value}%</div>
      </div>
    );
  };

  // Risk bar row helper
  const RiskBar: React.FC<{ label: string; value: number; colorClass: string }> = ({ label, value, colorClass }) => (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-300">{label}</span>
        <span className={`font-semibold ${value > 60 ? 'text-red-400' : value > 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
          {value > 0 ? `${value}%` : <span className="text-slate-600 font-normal italic text-xs">No data</span>}
        </span>
      </div>
      <div className="w-full bg-slate-700/60 rounded-full h-2">
        <div className={`${colorClass} h-2 rounded-full transition-all duration-500 ${getWidthClass(value)}`} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="mm-card-glowing mm-glow mm-glow--blue p-6 group">
        <DnaHelixBackdrop color="blue" opacity={0.10} motionVariant="fluid" seed="tracer-hero" />
        <div className="relative z-10">

        {/* Page header */}
        <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Activity className="text-cyan-400" size={28} aria-hidden="true" />
          Disease Tracer
        </h1>

        {/* Patient selector row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <div className="relative flex-1">
            <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" aria-hidden="true" />
            <select
              aria-label="Select research patient"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="ds-select w-full pl-9"
              disabled={patients.length === 0 && !error}
            >
              <option value="">{patients.length === 0 ? 'Loading patients…' : 'Select Cohort Patient (e.g. PT-001 - Sarah Chen)...'}</option>
              {patients.map(p => (
                <option key={p.id} value={p.patientId}>
                  {p.name ? `${p.name} (${p.patientId})` : p.patientId}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadRiskProfile}
            disabled={loading || !patientId}
            aria-label={loading ? 'Loading risk profile…' : 'Load risk profile for selected patient'}
            className={[
              'flex items-center justify-center gap-2 px-6 py-2 rounded-lg font-semibold text-sm transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70',
              'active:scale-[0.97]',
              loading || !patientId
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-cyan-400 text-slate-900 hover:bg-cyan-300',
            ].join(' ')}
          >
            {loading
              ? <><Loader className="animate-spin" size={16} aria-hidden="true" /> Loading…</>
              : <><Target size={16} aria-hidden="true" /> Load Risk Profile</>
            }
          </button>
        </div>

        {/* Quick Patient Presets */}
        <div className="flex items-center gap-1.5 flex-wrap mb-6">
          <span className="text-[11px] text-slate-500 font-medium mr-1">Cohort Presets:</span>
          {[
            { id: 'PT-001', name: 'PT-001 (Sarah Chen - BRCA1/TP53)' },
            { id: 'PT-002', name: 'PT-002 (David Miller - CFTR)' },
            { id: 'PT-003', name: 'PT-003 (Elena Rostova - SMN1)' },
            { id: 'PT-004', name: 'PT-004 (Marcus Vance - BRAF/KRAS)' }
          ].map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPatientId(p.id)}
              className={`text-[11px] px-2.5 py-1 rounded-md border font-mono transition-all duration-150 ${
                patientId === p.id
                  ? 'bg-cyan-400/20 border-cyan-400 text-cyan-300 font-bold shadow-sm'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-750 hover:border-slate-600 hover:text-white'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div role="alert" className="bg-red-500/8 border border-red-500/25 rounded-xl p-4 flex items-start gap-3 mb-6">
            <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} aria-hidden="true" />
            <div>
              <p className="text-red-300 font-semibold text-sm">Error</p>
              <p className="text-red-400 text-sm mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Zero-state: no patient selected */}
        {!patientId && !loading && !riskData && (
          <EmptyState
            icon={User}
            headline="No patient selected"
            subtext="Choose a research patient from the dropdown above to load their personalised risk profile."
          />
        )}

        {/* Zero-state: patient selected but profile not yet loaded */}
        {patientId && !loading && !riskData && !error && (
          <EmptyState
            icon={Activity}
            headline="Profile not loaded"
            subtext={`Click "Load Risk Profile" to fetch data for ${patientId}.`}
          />
        )}

        {/* Main risk dashboard */}
        {riskData && (
          <div className="space-y-6">

            {/* 4-card summary row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

              {/* Card A: Risk Overview */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                  <Activity size={16} className="text-cyan-400" aria-hidden="true" /> Risk Overview
                </h3>
                <RiskBar label="Cardiovascular"   value={riskData.cardiovascular}   colorClass="bg-red-500" />
                <RiskBar label="Cancer"            value={riskData.cancer}            colorClass="bg-orange-500" />
                <RiskBar label="Neurodegenerative" value={riskData.neurodegenerative} colorClass="bg-purple-500" />
                <RiskBar label="Metabolic"         value={riskData.metabolic}         colorClass="bg-amber-400" />
              </div>

              {/* Card B: Biological Age */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 flex flex-col items-center justify-center text-center">
                <h3 className="font-semibold text-white text-sm flex items-center gap-2 mb-3">
                  <Clock size={16} className="text-cyan-400" aria-hidden="true" /> Biological Age
                </h3>
                <p className={`text-4xl font-bold ${riskData.biologicalAge > riskData.chronologicalAge ? 'text-red-400' : 'text-emerald-400'}`}>
                  {riskData.biologicalAge}<span className="text-lg font-normal text-slate-400">y</span>
                </p>
                <p className="text-slate-400 text-xs mt-1">Chronological: {riskData.chronologicalAge}y</p>
                <p className={`mt-2 text-sm font-semibold ${riskData.biologicalAge > riskData.chronologicalAge ? 'text-red-400' : riskData.biologicalAge < riskData.chronologicalAge ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {riskData.biologicalAge > riskData.chronologicalAge ? '+' : ''}{riskData.biologicalAge - riskData.chronologicalAge} years
                </p>
              </div>

              {/* Card C: Longevity Score */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 flex flex-col items-center justify-center text-center">
                <h3 className="font-semibold text-white text-sm flex items-center gap-2 mb-3">
                  <Target size={16} className="text-cyan-400" aria-hidden="true" /> Longevity Score
                </h3>
                <div className="relative inline-block">
                  <svg className="w-24 h-24" viewBox="0 0 100 100" aria-label={`Longevity score: ${riskData.longevityScore} out of 100`} role="img">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#334155" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="45" fill="none"
                      stroke={riskData.longevityScore > 70 ? '#10b981' : riskData.longevityScore > 40 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray="283"
                      strokeDashoffset={283 - (283 * riskData.longevityScore) / 100}
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <span className="text-xl font-bold text-white">{riskData.longevityScore}</span>
                  </div>
                </div>
                <p className="text-slate-500 text-xs mt-2">Out of 100</p>
              </div>

              {/* Card D: Top Interventions */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <h3 className="font-semibold text-white text-sm flex items-center gap-2 mb-3">
                  <Pill size={16} className="text-cyan-400" aria-hidden="true" /> Top Interventions
                </h3>
                {riskData.topInterventions.length > 0 ? (
                  <ul className="space-y-1.5">
                    {riskData.topInterventions.map((iv, i) => (
                      <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                        <span className="text-cyan-400 mt-0.5 shrink-0">•</span>
                        <span>{iv}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-600 text-sm italic">No interventions available.</p>
                )}
              </div>
            </div>

            {/* Sub-tab navigation */}
            <div
              ref={tabListRef}
              role="tablist"
              aria-label="Risk analysis views"
              onKeyDown={handleTabKeyDown}
              className="flex flex-wrap gap-1.5 bg-slate-950/50 rounded-xl p-1 border border-slate-800"
            >
              {SUB_TABS.map(tab => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    'relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70',
                    activeTab === tab.id
                      ? 'bg-cyan-400/12 border border-cyan-400/30 text-cyan-400'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-transparent',
                  ].join(' ')}
                >
                  {tab.label}
                  {tab.badge && (
                    <span className={`absolute -top-1.5 -right-1.5 ${tab.badge.color} text-white text-[8px] font-bold rounded-full px-1.5 py-0.5 leading-none`}>
                      {tab.badge.text}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content panel */}
            <div role="tabpanel" className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6 animate-in fade-in duration-200">

              {activeTab === 'risk-details' && (
                <div>
                  <h3 className="text-lg font-bold text-white mb-4">Risk Details</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={riskChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="risk" name="Risk %" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {activeTab === 'ancestral-timeline' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-white">Ancestral Timeline</h3>
                  <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 overflow-x-auto">
                    <div className="relative min-w-[480px]">
                      <div className="absolute left-0 right-0 top-7 h-0.5 bg-gradient-to-r from-purple-600 via-cyan-500 to-emerald-500" aria-hidden="true" />
                      <div className="flex justify-between relative z-10 pb-6">
                        {[52000, 10000, 500, 1600, 1989, 2025].map((year, i) => {
                          const colors = ['border-purple-500 bg-purple-500/20','border-cyan-500 bg-cyan-500/20','border-blue-500 bg-blue-500/20','border-yellow-500 bg-yellow-500/20','border-orange-500 bg-orange-500/20','border-emerald-500 bg-emerald-500/20'];
                          const labels = ['Original Mutation','Neolithic Expansion','Medieval Spread','Colonial Distribution','Discovery','Present Day'];
                          return (
                            <div key={i} className="flex flex-col items-center gap-2">
                              <div className={`w-4 h-4 rounded-full border-4 ${colors[i]}`} />
                              <div className="text-center">
                                <div className="text-xs font-bold text-white">{year > 0 ? year : `${Math.abs(year)} BCE`}</div>
                                <div className="text-[10px] text-slate-400 max-w-[72px] leading-tight">{labels[i]}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { year:'52,000 BCE', event:'Original Mutation', location:'Northern Europe / Caucasus', desc:'ΔF508 deletion emerged in CFTR gene', freq:'<0.1%' },
                      { year:'10,000 BCE', event:'Neolithic Expansion', location:'Western Europe', desc:'Migration with agricultural populations', freq:'~2%' },
                      { year:'500 CE', event:'Medieval Spread', location:'Europe (widespread)', desc:'Possible heterozygote advantage against cholera/typhoid', freq:'~4%' },
                      { year:'1500–1900 CE', event:'Colonial Distribution', location:'Americas, Australia', desc:'European colonisation spreads variant globally', freq:'Varies' },
                    ].map((item, i) => (
                      <div key={i} className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 text-sm">
                        <div className="font-bold text-white mb-0.5">{item.year} — {item.event}</div>
                        <div className="text-slate-400 text-xs">{item.location}</div>
                        <div className="text-slate-300 text-xs mt-1">{item.desc}</div>
                        <div className="text-xs mt-1.5"><span className="text-slate-500">Frequency:</span> <span className="text-white">{item.freq}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'interventions' && (
                <div>
                  <h3 className="text-lg font-bold text-white mb-4">Recommended Interventions</h3>
                  {riskData.topInterventions.length > 0 ? (
                    <div className="space-y-3">
                      {riskData.topInterventions.map((iv, i) => (
                        <div key={i} className="p-3 bg-slate-900/60 rounded-lg border border-slate-700">
                          <p className="text-white text-sm">{iv}</p>
                          <div className="flex gap-4 mt-2 text-xs text-slate-400">
                            <span>Evidence: <span className="text-amber-400 font-bold">B</span></span>
                            <span>Risk reduction: <span className="text-emerald-400 font-bold">~15%</span></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={Pill} headline="No interventions" subtext="No intervention data is available for this patient profile." size="compact" />
                  )}
                </div>
              )}

              {activeTab === 'population-comparison' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-white">Population Comparison</h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { population:'Northern European', region:'Scandinavia, British Isles, Germany', carrierFreq:'4.0%', dF508Freq:'88%', longevity:68, risk:'HIGH', color:'#ef4444' },
                      { population:'Southern European', region:'Mediterranean (Italy, Spain, Greece)', carrierFreq:'2.1%', dF508Freq:'52%', longevity:72, risk:'MODERATE', color:'#f59e0b' },
                      { population:'Ashkenazi Jewish', region:'Eastern Europe origin', carrierFreq:'4.0%', dF508Freq:'85%', longevity:67, risk:'HIGH', color:'#ef4444' },
                      { population:'East Asian', region:'China, Japan, Korea', carrierFreq:'0.04%', dF508Freq:'15%', longevity:85, risk:'LOW', color:'#10b981' },
                      { population:'African', region:'Sub-Saharan Africa', carrierFreq:'0.2%', dF508Freq:'28%', longevity:78, risk:'LOW', color:'#10b981' },
                      { population:'Hispanic / Latino', region:'Americas (mixed ancestry)', carrierFreq:'1.4%', dF508Freq:'46%', longevity:74, risk:'MODERATE', color:'#f59e0b' },
                    ].map((pop, i) => (
                      <div key={i} className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-white text-sm">{pop.population}</h4>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${mapHexToVariant(pop.color).text} ${mapHexToVariant(pop.color).bgAlpha}`}>{pop.risk}</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-3">{pop.region}</p>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between"><span className="text-slate-400">Carrier freq</span><span className="text-white">{pop.carrierFreq}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">ΔF508 freq</span><span className="text-white">{pop.dF508Freq}</span></div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Longevity</span>
                            <div className="flex items-center gap-2">
                              <span className="text-white">{pop.longevity}</span>
                              <div className="w-12 h-1.5 bg-slate-700 rounded-full"><div className={`${longevityBgClass(pop.longevity)} h-1.5 rounded-full ${getWidthClass(pop.longevity)}`} /></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'variant-browser' && (
                <div>
                  <h3 className="text-lg font-bold text-white mb-4">Variant Browser</h3>
                  <div className="bg-slate-900/60 border border-slate-700 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left" aria-label="Patient variants">
                        <thead className="bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-800">
                          <tr>
                            <th className="px-5 py-3">Gene</th>
                            <th className="px-5 py-3">HGVS (c)</th>
                            <th className="px-5 py-3">HGVS (p)</th>
                            <th className="px-5 py-3">Allele Freq</th>
                            <th className="px-5 py-3">Clinical Sig</th>
                            <th className="px-5 py-3">ACMG</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          <tr className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-5 py-3 font-bold text-white text-sm">CFTR</td>
                            <td className="px-5 py-3 font-mono text-xs text-cyan-400">c.1521_1523delCTT</td>
                            <td className="px-5 py-3 font-mono text-xs text-slate-300">p.Phe508del (ΔF508)</td>
                            <td className="px-5 py-3 text-xs text-slate-400">0.004</td>
                            <td className="px-5 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/12 text-red-400 border border-red-500/20">Pathogenic</span></td>
                            <td className="px-5 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-300 border border-red-500/15">PVS1+PM2</span></td>
                          </tr>
                          <tr className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-5 py-3 font-bold text-white text-sm">CFTR</td>
                            <td className="px-5 py-3 font-mono text-xs text-cyan-400">{'c.1657C>T'}</td>
                            <td className="px-5 py-3 font-mono text-xs text-slate-300">p.Arg553Ter</td>
                            <td className="px-5 py-3 text-xs text-slate-400">0.002</td>
                            <td className="px-5 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/12 text-red-400 border border-red-500/20">Pathogenic</span></td>
                            <td className="px-5 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-300 border border-orange-500/15">PM1</span></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Data Sources footer */}
        <div className="mt-8 pt-5 border-t border-slate-800 text-xs text-slate-500">
          <p className="text-center mb-1 font-semibold text-slate-400">Scientific Data Sources</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1">
            <a href="https://www.internationalgenome.org/" target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:text-cyan-400 focus-visible:outline-none focus-visible:underline">1000 Genomes</a>
            <a href="https://gnomad.broadinstitute.org/" target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:text-cyan-400 focus-visible:outline-none focus-visible:underline">gnomAD</a>
            <a href="https://www.ncbi.nlm.nih.gov/clinvar/" target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:text-cyan-400 focus-visible:outline-none focus-visible:underline">ClinVar</a>
          </div>
          <p className="text-center mt-2 text-slate-600">For research purposes only. Not for clinical diagnosis.</p>
        </div>
        </div>
      </div>
    </div>
  );
};

export default DiseaseTracerTab;
