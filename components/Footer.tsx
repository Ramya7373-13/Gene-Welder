import React from 'react';
import { AlertCircle, BookOpen, ExternalLink, ShieldCheck, Dna } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-slate-950 border-t border-slate-850 py-8 px-4 sm:px-6 lg:px-8 mt-12 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Research Use Only Banner */}
        <div className="bg-amber-500/8 border border-amber-500/25 rounded-xl p-4 flex items-start gap-3 text-amber-200/90">
          <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs leading-relaxed">
            <span className="font-bold text-amber-300 uppercase tracking-wide mr-1.5">For Research Use Only:</span>
            MutationMechanic predictions (including AlphaMissense pathogenicity, SpliceAI delta scores, Gemini mechanistic summaries, and AlphaFold structures) are algorithmic estimations. They are strictly intended for scientific research and educational investigation, and must not be used as the sole basis for clinical diagnosis, patient management, or medical decision-making.
          </div>
        </div>

        {/* Citations & Model Attributions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-slate-850">
          <div>
            <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <Dna size={14} className="text-primary" /> AlphaMissense
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              DeepMind precomputed missense catalog. Licensed under <span className="text-slate-300 font-medium">CC BY 4.0</span>.
            </p>
            <a
              href="https://doi.org/10.1126/science.adg7492"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-cyan-400 hover:underline inline-flex items-center gap-1 mt-1"
            >
              Cheng et al., Science (2023) <ExternalLink size={10} />
            </a>
          </div>

          <div>
            <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-violet-400" /> SpliceAI
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              32-layer deep residual network for splicing. Lookups via BioThings / MyVariant.info.
            </p>
            <a
              href="https://doi.org/10.1016/j.cell.2018.12.015"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-cyan-400 hover:underline inline-flex items-center gap-1 mt-1"
            >
              Jaganathan et al., Cell (2019) <ExternalLink size={10} />
            </a>
          </div>

          <div>
            <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <BookOpen size={14} className="text-emerald-400" /> AlphaFold & ESMFold
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              EBI AlphaFold DB structures & ESMAtlas live proxy folding. CC BY 4.0.
            </p>
            <a
              href="https://alphafold.ebi.ac.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-cyan-400 hover:underline inline-flex items-center gap-1 mt-1"
            >
              Varadi et al., NAR (2022) <ExternalLink size={10} />
            </a>
          </div>

          <div>
            <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block"></span> Gemini AI
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              Google DeepMind Gemini models for mechanistic protein reporting and conversational reasoning.
            </p>
            <span className="text-[10px] text-slate-400 block mt-1">Google AI Studio API</span>
          </div>
        </div>

        <div className="flex justify-between items-center text-[11px] text-slate-400 pt-2 border-t border-slate-900">
          <span>MutationMechanic Suite &copy; {new Date().getFullYear()}</span>
          <span>Data Sources: UniProt &bull; ClinVar &bull; gnomAD &bull; MyVariant.info &bull; DeepMind</span>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
