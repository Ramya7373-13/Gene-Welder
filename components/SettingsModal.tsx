import React, { useState, useEffect } from 'react';
import { Palette, Check, X, Wifi, WifiOff, Activity, ShieldCheck, Dna, Box, Sparkles, RefreshCw, Info } from 'lucide-react';
import { THEMES } from '../App';
import { configService, ServiceHealth, FeatureFlags } from '../services/configService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme?: string;
  onThemeChange?: (themeId: string) => void;
  onConfigChange?: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onThemeChange,
  onConfigChange
}) => {
  const [isForcedOffline, setIsForcedOffline] = useState(configService.isForcedOffline());
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(configService.getFeatureFlags());
  const [health, setHealth] = useState<ServiceHealth | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const fetchHealth = async (force = false) => {
    setIsCheckingHealth(true);
    try {
      const h = await configService.checkHealth(force);
      setHealth(h);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsForcedOffline(configService.isForcedOffline());
      setFeatureFlags(configService.getFeatureFlags());
      fetchHealth(false);
    }
  }, [isOpen]);

  const handleToggleOffline = (e: React.ChangeEvent<HTMLInputElement>) => {
    const offline = e.target.checked;
    setIsForcedOffline(offline);
    configService.setForcedOffline(offline);
    onConfigChange?.();
  };

  const handleToggleFlag = (flag: keyof FeatureFlags) => {
    const updated = configService.setFeatureFlag(flag, !featureFlags[flag]);
    setFeatureFlags(updated);
    onConfigChange?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
          <h3 className="text-white font-bold text-lg flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-primary" /> System Configuration & API Health
          </h3>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto">

          {/* Execution Mode Section */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <label className="text-white text-sm font-semibold flex items-center gap-2">
                  {isForcedOffline ? <WifiOff className="w-4 h-4 text-purple-400" /> : <Wifi className="w-4 h-4 text-emerald-400" />}
                  Runtime Execution Mode
                </label>
                <p className="text-xs text-slate-400 mt-0.5">
                  Control whether the application calls live APIs or forces benchmark simulation.
                </p>
              </div>
            </div>

            <div className={`p-4 rounded-xl border transition-all ${
              isForcedOffline
                ? 'bg-purple-950/30 border-purple-500/40'
                : 'bg-slate-850 border-slate-700'
            }`}>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <span className="font-semibold text-sm text-white flex items-center gap-2">
                    {isForcedOffline ? 'Forced Offline / Demo Mode' : 'Live API Preferred (Default)'}
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                      isForcedOffline
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {isForcedOffline ? 'DEMO ACTIVE' : 'ONLINE'}
                    </span>
                  </span>
                  <p className="text-xs text-slate-400">
                    {isForcedOffline
                      ? 'All analyses run locally in benchmark simulation mode. No external API quotas are consumed.'
                      : 'Queries live Gemini 3 Flash, DeepMind AlphaMissense, SpliceAI, and AlphaFold APIs with automatic fallbacks.'}
                  </p>
                </div>
                
                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    checked={isForcedOffline}
                    onChange={handleToggleOffline}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* API Health & Rate Limiting Monitor */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-white text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" /> Live Service Health & Quotas
              </label>
              <button
                type="button"
                onClick={() => fetchHealth(true)}
                disabled={isCheckingHealth}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 p-1 rounded hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} className={isCheckingHealth ? 'animate-spin' : ''} />
                <span>{isCheckingHealth ? 'Pinging...' : 'Refresh'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Gemini */}
              <div className="bg-slate-850 p-3 rounded-xl border border-slate-700 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-200">Gemini 3 Flash</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    health?.gemini?.status === 'ok' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {health?.gemini?.status || 'Active'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Google AI Studio API Key</p>
                {health?.overallLatencyMs ? (
                  <span className="text-[10px] font-mono text-slate-500">Latency: {health.overallLatencyMs}ms</span>
                ) : null}
              </div>

              {/* AlphaMissense */}
              <div className="bg-slate-850 p-3 rounded-xl border border-slate-700 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-200">AlphaMissense</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300">
                    Ready
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">DeepMind Catalog + REST</p>
                <span className="text-[10px] font-mono text-slate-500">CC BY 4.0 Licensed</span>
              </div>

              {/* SpliceAI */}
              <div className="bg-slate-850 p-3 rounded-xl border border-slate-700 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-200">SpliceAI Neural</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300">
                    Ready
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">BioThings / MyVariant.info</p>
                <span className="text-[10px] font-mono text-slate-500">Throttled: 4 req/sec</span>
              </div>

              {/* AlphaFold */}
              <div className="bg-slate-850 p-3 rounded-xl border border-slate-700 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-200">AlphaFold / ESMFold</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300">
                    Ready
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">EBI AlphaFold DB + Proxy</p>
                <span className="text-[10px] font-mono text-slate-500">3D Tertiary Predictor</span>
              </div>
            </div>
          </div>

          {/* Feature Flags */}
          <div className="space-y-3">
            <label className="text-white text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Active Module Features
            </label>

            <div className="space-y-2 bg-slate-850 p-4 rounded-xl border border-slate-700">
              {([
                ['enableAlphaMissense', 'AlphaMissense Pathogenicity Scoring', 'Show DeepMind 0-1 scores and classification badges', Dna],
                ['enableSpliceAI', 'SpliceAI Neural Delta Matrix', 'Compute donor/acceptor site disruption metrics', ShieldCheck],
                ['enableAlphaFold', 'AlphaFold 3D Structure Viewer', 'Render 3D protein structures and residue highlights', Box],
                ['enableRateLimiting', 'Rate-Limiting & Backoff Guard', 'Protect public endpoints from quota exhaustion', Activity],
                ['reduceAnimations', 'Reduce Background Animations', 'Pause non-essential UI animations for performance or accessibility', Sparkles]
              ] as const).map(([key, label, desc, Icon]) => (
                <label key={key} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Icon size={16} className="text-primary" />
                    <div>
                      <div className="text-xs font-semibold text-slate-200">{label}</div>
                      <div className="text-[11px] text-slate-400">{desc}</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={featureFlags[key]}
                    onChange={() => handleToggleFlag(key)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-700 bg-slate-900"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Theme Selection */}
          <div className="space-y-3">
            <label className="text-white text-sm font-semibold flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" /> Appearance Theme
            </label>
            <div className="grid grid-cols-5 sm:grid-cols-9 gap-2">
              {THEMES.map(theme => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onThemeChange?.(theme.id)}
                  className={`h-10 rounded-full border-2 transition-all flex items-center justify-center ${
                    currentTheme === theme.id 
                      ? 'border-white scale-110 shadow-lg' 
                      : 'border-transparent hover:scale-105'
                  } bg-theme-${theme.id}`}
                  title={theme.name}
                  aria-label={theme.name}
                >
                  {currentTheme === theme.id && <Check size={14} className="text-white drop-shadow-md" />}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button 
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-all shadow-md active:scale-95 text-sm"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;