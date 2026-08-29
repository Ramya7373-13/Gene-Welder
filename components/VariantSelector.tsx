import React from 'react';
import { VariantInfo } from '../types';
import { DISEASE_VARIANTS } from '../constants';
import { ChevronDown, AlertCircle, Loader2 } from 'lucide-react';

interface VariantSelectorProps {
  selectedId: string;
  onSelect: (id: string) => void;
  loading: boolean;
}

const VariantSelector: React.FC<VariantSelectorProps> = ({ selectedId, onSelect, loading }) => {
  return (
    <div className="mm-card-glowing mm-glow mm-glow--blue p-6 rounded-xl shadow-xl transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Target Variant</h2>
          <p className="text-slate-400 text-sm">Select a pathological variant to analyze structure and function.</p>
        </div>
        
        <div className="relative min-w-[320px]">
          <select
            value={selectedId}
            onChange={(e) => onSelect(e.target.value)}
            disabled={loading}
            aria-label="Select variant"
            className="w-full appearance-none bg-slate-900 border border-slate-700 text-white py-3 px-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 transition-opacity text-sm font-mono"
          >
            <option value="" disabled>Select a variant or pick a quick preset below...</option>
            {DISEASE_VARIANTS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.protein} : {v.variant} — {v.disease}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </div>
      </div>

      {/* Quick-Select Preset Pills */}
      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-slate-500 font-medium mr-1">Quick Presets:</span>
        {DISEASE_VARIANTS.slice(0, 6).map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v.id)}
            disabled={loading}
            className={`text-[11px] px-2.5 py-1 rounded-md border font-mono transition-all duration-150 ${
              selectedId === v.id
                ? 'bg-primary/20 border-primary text-white font-bold shadow-[0_0_12px_rgba(34,211,238,0.4)] mm-glow--cyan'
                : 'bg-slate-900 border-slate-750 text-slate-300 hover:bg-slate-800 hover:border-slate-600 hover:text-white'
            }`}
          >
            {v.protein} {v.variant}
          </button>
        ))}
      </div>

      {selectedId && (
        <div className="mt-4 pt-4 border-t border-slate-700 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-scientific-blue flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-bold text-scientific-blue uppercase tracking-wider">Mechanism Hypothesis</span>
            <p className="text-slate-300 text-sm mt-1">
              {DISEASE_VARIANTS.find(v => v.id === selectedId)?.mechanism_summary}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VariantSelector;