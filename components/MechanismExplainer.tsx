import React from 'react';
import { BookOpen, Activity, ArrowRight } from 'lucide-react';
import DnaHelixBackdrop from './DnaHelixBackdrop';

interface MechanismExplainerProps {
  mechanism: string;
  summary?: string;
}

const MechanismExplainer: React.FC<MechanismExplainerProps> = ({ mechanism, summary }) => {
  return (
    <div className="mm-card-glowing mm-glow mm-glow--blue p-8 relative overflow-hidden group shadow-xl">
      <DnaHelixBackdrop color="blue" opacity={0.20} motionVariant="fluid" seed="mechanism" />
      
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="mm-section-accent mm-section-accent--blue" />
        <div className="p-2.5 bg-blue-500/20 border border-blue-500/30 rounded-xl shadow-[0_0_12px_rgba(59,130,246,0.3)]">
          <Activity className="h-5 w-5 text-blue-400" />
        </div>
        <h3 className="text-xl font-black text-white uppercase tracking-wider">Mechanism of Action</h3>
      </div>
      
      <div className="space-y-6 relative z-10">
        <div className="prose prose-invert max-w-none">
          <p className="text-base text-slate-200 leading-relaxed border-l-4 border-blue-500 pl-4 bg-blue-950/20 py-2 rounded-r-lg">
            {mechanism}
          </p>
          {summary && (
             <p className="text-slate-300 mt-4 leading-relaxed text-sm">
               {summary}
             </p>
          )}
        </div>

        <div className="bg-slate-950/80 rounded-xl p-4 border border-blue-500/25 flex items-start gap-3 shadow-inner">
          <BookOpen className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
          <div>
             <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">AI Pathological Interpretation</h4>
             <p className="text-xs text-slate-400 mt-1 leading-relaxed">
               Structural disruption often leads to loss of function (LOF) or gain of toxic function (GOF). 
               Compensatory strategies aim to restore native stability.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MechanismExplainer;