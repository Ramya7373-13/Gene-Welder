import React, { useState, useEffect } from 'react';
import { Dna, Github, Settings, Wifi, WifiOff, Activity, Info } from 'lucide-react';
import { configService } from '../services/configService';

interface HeaderProps {
  onOpenSettings?: () => void;
  source?: 'API' | 'CACHE' | 'SIMULATION' | null;
}

/** Reusable inline connection badge — consumed by Header and other panels */
export const ConnectionBadge: React.FC<{
  connected: boolean;
  isForcedOffline?: boolean;
  label?: string;
  onOpenSettings?: () => void;
}> = ({
  connected,
  isForcedOffline = false,
  label = 'Live API',
  onOpenSettings
}) => {
  if (isForcedOffline) {
    return (
      <button
        onClick={onOpenSettings}
        type="button"
        title="Offline Demo Mode is intentionally active (configured in Settings)"
        aria-label="Offline demo mode active"
        className="hidden md:flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border bg-purple-950/40 border-purple-500/50 text-purple-300 shadow-[0_0_14px_rgba(168,85,247,0.3)] hover:bg-purple-900/40 transition-all cursor-pointer"
      >
        <span aria-hidden="true" className="mm-status-dot text-purple-400" />
        <WifiOff size={13} className="text-purple-300" aria-hidden="true" />
        <span>Offline Demo (Forced)</span>
      </button>
    );
  }

  const isCached = label === 'Live (Cached)';
  const isLive = connected && !isCached;

  return (
    <button
      onClick={onOpenSettings}
      type="button"
      role="status"
      aria-label={label}
      className={`hidden md:flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
        isLive
          ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.3)] hover:bg-emerald-900/40'
          : isCached
          ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.3)] hover:bg-cyan-900/40'
          : 'bg-amber-950/40 border-amber-500/50 text-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.3)] hover:bg-amber-900/40'
      }`}
    >
      <span
        aria-hidden="true"
        className={`mm-status-dot ${
          isLive ? 'text-emerald-400' : isCached ? 'text-cyan-400' : 'text-amber-400'
        }`}
      />
      {connected ? <Wifi size={13} aria-hidden="true" /> : <WifiOff size={13} aria-hidden="true" />}
      <span>{label}</span>
    </button>
  );
};

const Header: React.FC<HeaderProps> = ({ onOpenSettings, source }) => {
  const [isForcedOffline, setIsForcedOffline] = useState(configService.isForcedOffline());

  useEffect(() => {
    const checkState = () => setIsForcedOffline(configService.isForcedOffline());
    window.addEventListener('storage', checkState);
    return () => window.removeEventListener('storage', checkState);
  }, []);

  const isSimulation = source === 'SIMULATION' || isForcedOffline;

  return (
    <header className="w-full bg-slate-900/80 border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">

        {/* Logo */}
        <a
          href="/"
          aria-label="MutationMechanic home"
          className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 rounded-lg"
        >
          <div className="p-2 rounded-lg bg-cyan-400/10 border border-cyan-400/20">
            <Dna className="h-5 w-5 text-cyan-400" aria-hidden="true" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-100">
            Mutation<span className="text-cyan-400">Mechanic</span>
          </span>
        </a>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          <ConnectionBadge
            connected={!isSimulation}
            isForcedOffline={isForcedOffline}
            label={isForcedOffline ? 'Offline Demo (Forced)' : isSimulation ? 'Simulation (Fallback)' : source === 'CACHE' ? 'Live (Cached)' : 'Live API'}
            onOpenSettings={onOpenSettings}
          />

          <button
            onClick={onOpenSettings}
            aria-label="Open settings"
            className={[
              'p-2 rounded-lg text-slate-400',
              'hover:text-slate-100 hover:bg-slate-800',
              'transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70',
              'active:scale-95',
            ].join(' ')}
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </button>

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub (opens in new tab)"
            className={[
              'p-2 rounded-lg text-slate-500',
              'hover:text-slate-300 hover:bg-slate-800',
              'transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70',
              'active:scale-95',
            ].join(' ')}
          >
            <Github className="h-5 w-5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>
  );
};

export default Header;
