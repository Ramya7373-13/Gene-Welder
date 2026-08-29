import React from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Dna,
  Github,
  Microscope,
  Network,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

const modules = [
  {
    tab: 'explainer',
    title: 'Variant Explainer',
    description: 'Decode pathogenicity and structural impact with clinical context.',
    meta: '500+ research labs',
    icon: BookOpen,
    tone: 'cyan',
  },
  {
    tab: 'design',
    title: 'Protein Design',
    description: 'Optimize mutations for stability and explore compensatory designs.',
    meta: '150+ drug discovery teams',
    icon: Zap,
    tone: 'pink',
  },
  {
    tab: 'tracer',
    title: 'Disease Tracer',
    description: 'Track patient risk progression and pathogenicity across cohorts.',
    meta: '200+ genetics teams',
    icon: ShieldCheck,
    tone: 'emerald',
  },
  {
    tab: 'splicing',
    title: 'Splicing Decoder',
    description: 'Catch hidden splice defects before they matter clinically.',
    meta: 'Used in clinical labs',
    icon: Network,
    tone: 'violet',
  },
  {
    tab: null,
    title: 'RNA Analysis',
    description: 'RNA folding and structure analysis is planned for a future release.',
    meta: 'Coming soon',
    icon: Dna,
    tone: 'amber',
    badge: 'COMING SOON',
  },
  {
    tab: 'analytics',
    title: 'System Analytics',
    description: 'Track analysis history and variant statistics across your workspace.',
    meta: 'Analysis history and stats',
    icon: BarChart3,
    tone: 'blue',
    badge: 'NEW',
  },
] as const;

const toneClasses: Record<string, string> = {
  cyan: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/20',
  pink: 'bg-pink-400/10 text-pink-300 border-pink-400/20',
  emerald: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
  violet: 'bg-violet-400/10 text-violet-300 border-violet-400/20',
  amber: 'bg-amber-400/10 text-amber-300 border-amber-400/20',
  blue: 'bg-blue-400/10 text-blue-300 border-blue-400/20',
};

const LandingPage: React.FC = () => (
  <div className="min-h-screen bg-[#070d1d] text-slate-100 overflow-hidden">
    <header className="border-b border-slate-800/70 bg-[#070d1d]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto h-16 px-6 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5" aria-label="MutationMechanic home">
          <span className="p-2 rounded-lg bg-pink-400/10 border border-pink-400/20">
            <Dna className="w-5 h-5 text-pink-300" aria-hidden="true" />
          </span>
          <span className="font-bold tracking-tight">Mutation<span className="text-pink-300">Mechanic</span></span>
        </a>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <a href="/workspace" className="hidden sm:inline hover:text-white transition-colors">Sign in</a>
          <a href="/workspace" className="px-4 py-2 rounded-md bg-pink-500 hover:bg-pink-400 text-white font-semibold transition-colors">Get Started</a>
        </div>
      </div>
    </header>

    <main>
      <section className="relative max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="absolute inset-x-1/4 top-10 h-72 bg-pink-500/10 blur-3xl rounded-full pointer-events-none" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-400/20 bg-cyan-400/5 text-cyan-300 text-xs">
            <Sparkles size={12} aria-hidden="true" /> New AlphaFold-3 integration available
          </div>
          <h1 className="mt-7 text-4xl sm:text-6xl font-bold tracking-tight leading-tight">
            AI-Powered Protein<br /><span className="text-pink-400">Engineering</span> &amp; Variant Analysis
          </h1>
          <p className="max-w-2xl mx-auto mt-5 text-slate-400 leading-relaxed">
            Analyze pathogenicity, structural impact, and splicing defects with clinical precision. The all-in-one platform for modern genomic medicine.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <a href="/workspace?tab=explainer" className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-white text-slate-900 font-semibold hover:bg-slate-200 transition-colors">
              <Dna size={16} aria-hidden="true" /> Explore the platform <ArrowRight size={15} aria-hidden="true" />
            </a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md border border-slate-700 bg-slate-900/70 text-slate-200 font-semibold hover:border-slate-500 transition-colors">
              <Github size={16} aria-hidden="true" /> View on GitHub <ArrowRight size={15} aria-hidden="true" />
            </a>
          </div>
          <p className="mt-5 text-xs text-slate-600">Trusted by research labs and clinical centers</p>
        </div>
      </section>

      <section className="border-t border-slate-800/70 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-8">
            <h2 className="text-2xl font-bold">Six powerful modules</h2>
            <p className="mt-2 text-sm text-slate-400 max-w-xl">Purpose-built tools for the questions that matter in genomic medicine.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map(({ tab, title, description, meta, icon: Icon, tone, badge }) => (
              <a
                key={title}
                href={tab ? `/workspace?tab=${tab}` : undefined}
                aria-disabled={!tab}
                onClick={event => { if (!tab) event.preventDefault(); }}
                className={`group relative min-h-44 rounded-lg border border-slate-800 bg-slate-900/45 p-5 transition-all duration-200 ${tab ? 'hover:-translate-y-1 hover:border-slate-600 hover:bg-slate-900/80' : 'cursor-not-allowed opacity-75'}`}
              >
                {badge && <span className="absolute top-4 right-4 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-950">{badge}</span>}
                <span className={`inline-flex p-2 rounded-md border ${toneClasses[tone]}`}><Icon size={17} aria-hidden="true" /></span>
                <h3 className="mt-4 font-semibold group-hover:text-pink-300 transition-colors">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
                <p className="mt-4 text-xs text-slate-600">{meta}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-8 text-center">
          <h2 className="text-xl font-bold">Ready to transform your genomic research?</h2>
          <p className="mt-2 text-sm text-slate-400">Start exploring MutationMechanic with the complete working toolkit.</p>
          <a href="/workspace" className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-md bg-pink-500 hover:bg-pink-400 text-white font-semibold transition-colors">Start exploring <ArrowRight size={15} aria-hidden="true" /></a>
        </div>
      </section>
    </main>

    <footer className="border-t border-slate-800/70 py-8">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between gap-3 text-xs text-slate-600">
        <span>© 2026 MutationMechanic. Advancing precision medicine through AI.</span>
        <a href="/workspace" className="hover:text-slate-300 transition-colors">Open workspace</a>
      </div>
    </footer>
  </div>
);

export default LandingPage;
