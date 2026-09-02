import React from 'react';
import { Lock, CreditCard, ArrowRight } from 'lucide-react';

interface PaywallUIProps {
  feature: string;
  used: number;
  limit: number;
  onUpgrade: () => void;
}

export default function PaywallUI({ feature, used, limit, onUpgrade }: PaywallUIProps) {
  return (
    <div className="mm-card-glowing mm-glow mm-glow--amber p-8 rounded-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-950/50 to-orange-950/30" />
      <div className="relative z-10 text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40">
          <Lock className="text-amber-400" size={32} />
        </div>

        <div>
          <h3 className="text-2xl font-black text-white mb-2">
            {used} of {limit} Free Uses Exhausted
          </h3>
          <p className="text-amber-200/80 max-w-md mx-auto">
            You've reached the free usage limit for {feature}. Upgrade to Pro for unlimited analyses.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={onUpgrade}
            className="mm-btn-tactical !bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold px-8 py-3 rounded-xl shadow-lg hover:shadow-amber-500/30 transition-all duration-200 flex items-center gap-2"
          >
            <CreditCard size={18} />
            Upgrade to Pro
            <ArrowRight size={18} />
          </button>
        </div>

        <p className="text-xs text-amber-200/60">
          Pro plan: unlimited analyses, priority support, advanced features
        </p>
      </div>
    </div>
  );
}
