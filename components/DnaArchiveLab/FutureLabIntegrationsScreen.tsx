import React from 'react';
import { Ban } from 'lucide-react';
import DisclaimerFooter from './DisclaimerFooter';

const FutureLabIntegrationsScreen: React.FC = () => (
  <div className="space-y-6">
    <div className="mm-card-glowing mm-glow mm-glow--amber p-8 text-center">
      <Ban className="mx-auto text-amber-400 mb-3" size={28} aria-hidden="true" />
      <h2 className="text-white font-black text-sm uppercase tracking-wider">Future integrations</h2>
      <p className="mt-2 text-amber-300 font-bold uppercase tracking-widest text-xs">Coming later</p>
      <p className="mt-3 text-sm text-slate-400 max-w-xl mx-auto">
        Partner integrations are disabled in this version. No operational steps, request forms, or physical-process
        guidance are available here.
      </p>
    </div>
    <DisclaimerFooter />
  </div>
);

export default FutureLabIntegrationsScreen;
