import React from 'react';
import { Info } from 'lucide-react';
import { DNA_ARCHIVE_DISCLAIMER } from '../../types/dnaStorage';

const DisclaimerFooter: React.FC = () => (
  <div className="mt-6 mm-card-glowing mm-glow mm-glow--amber p-3.5 flex items-start gap-3 text-[11px] text-slate-300">
    <Info size={16} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
    <p>{DNA_ARCHIVE_DISCLAIMER}</p>
  </div>
);

export default DisclaimerFooter;
