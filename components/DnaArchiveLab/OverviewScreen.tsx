import React from 'react';
import { Archive, ArrowRight, Binary, Dna, FileText, RefreshCw, ShieldCheck } from 'lucide-react';
import DisclaimerFooter from './DisclaimerFooter';

const steps = [
  { label: 'Digital file', icon: FileText },
  { label: 'Bytes', icon: Binary },
  { label: 'Encoding', icon: Dna },
  { label: 'DNA strands', icon: Archive },
  { label: 'Channel error simulation', icon: RefreshCw },
  { label: 'Reconstruction', icon: ShieldCheck },
  { label: 'File verification', icon: ShieldCheck },
];

const OverviewScreen: React.FC = () => (
  <div className="space-y-6">
    <div className="mm-card-glowing mm-glow mm-glow--cyan p-6 relative overflow-hidden">
      <h2 className="text-white font-black text-sm uppercase tracking-wider mb-3 flex items-center gap-2.5">
        <div className="mm-section-accent" />
        <Archive className="h-4 w-4 text-cyan-400" />
        DNA Archive Lab
      </h2>
      <p className="text-slate-200 text-sm leading-relaxed max-w-3xl">
        Explore how digital information can be encoded, protected, degraded, and recovered through
        DNA-inspired archival storage simulations. Built for curiosity, education, and reproducible
        research — not a replacement for RAM/SSDs.
      </p>
    </div>

    <div className="mm-card-glowing mm-glow mm-glow--cyan p-6">
      <h3 className="text-white font-black text-sm uppercase tracking-wider mb-4">Computational flow</h3>
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <React.Fragment key={step.label}>
              <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2">
                <Icon size={14} className="text-cyan-400" aria-hidden="true" />
                <span className="text-xs font-semibold text-slate-200">{step.label}</span>
              </div>
              {index < steps.length - 1 ? (
                <ArrowRight size={14} className="text-slate-500" aria-hidden="true" />
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
      <p className="mt-4 text-slate-400 text-sm leading-relaxed">
        DNA storage is promising for long-horizon archival storage. It is not a replacement for RAM/SSDs.
        Every stage here is a computational model of a data-storage pipeline.
      </p>
    </div>
    <DisclaimerFooter />
  </div>
);

export default OverviewScreen;
