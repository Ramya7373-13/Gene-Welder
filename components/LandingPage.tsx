/**
 * LandingPage.tsx
 * ---------------------------------------------------------------------------
 * Public marketing / landing surface for MutationMechanic. Rendered at `/`
 * whenever there is no signed-in session, and it is the first impression of the
 * product, so it is intentionally more "product site" than "app shell":
 *
 *   - Sticky glass header (brand mark + Sign in / Get Started -> /workspace)
 *   - Hero with a real, animated 3D double helix drawn on a <canvas>
 *     (`DnaDoubleHelix3D`, defined below): two helical strands, depth-shaded
 *     nucleotide spheres, base-pair rungs, additive glow, drifting particles,
 *     pointer parallax, seeded start phase, reduced-motion fallback and
 *     IntersectionObserver pausing.
 *   - Animated stats strip with a dependency-free `CountUp`
 *   - Module grid (reuses the shared `DnaHelixBackdrop` for a hover sweep)
 *   - "How it works" three-step flow
 *   - CTA banner + footer
 *
 * Everything is self-contained: no new dependencies, Tailwind utility classes
 * only, plus one injected <style> block for the handful of keyframe animations.
 * All decorative layers are aria-hidden and respect prefers-reduced-motion.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Archive,
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  Dna,
  Github,
  Network,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import DnaHelixBackdrop from './DnaHelixBackdrop';
import type { DnaThemeColor } from './DnaHelixBackdrop';

/* -------------------------------------------------------------------------- */
/* Types and data                                                             */
/* -------------------------------------------------------------------------- */

interface LandingModule {
  tab: string | null;
  title: string;
  description: string;
  meta: string;
  icon: LucideIcon;
  tone: string;
  badge?: string;
}

const modules: LandingModule[] = [
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
    tab: 'archive',
    title: 'DNA Archive Lab',
    description: 'Encode files into DNA-like sequences, simulate channel errors, and verify recovery.',
    meta: 'In-silico archival simulator',
    icon: Archive,
    tone: 'cyan',
    badge: 'NEW',
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
];

interface ToneStyle {
  /** Icon chip classes */
  chip: string;
  /** Gradient used for the thin accent line on top of a card */
  accent: string;
  /** Colour handed to the shared DnaHelixBackdrop */
  helix: DnaThemeColor;
  /** Heading colour on hover */
  text: string;
  /** Dot / bullet colour */
  dot: string;
}

const toneStyles: Record<string, ToneStyle> = {
  cyan: {
    chip: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/20',
    accent: 'from-cyan-400/90 via-cyan-400/25 to-transparent',
    helix: 'cyan',
    text: 'group-hover:text-cyan-200',
    dot: 'bg-cyan-400',
  },
  pink: {
    chip: 'bg-pink-400/10 text-pink-300 border-pink-400/20',
    accent: 'from-pink-400/90 via-pink-400/25 to-transparent',
    helix: 'rose',
    text: 'group-hover:text-pink-200',
    dot: 'bg-pink-400',
  },
  emerald: {
    chip: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
    accent: 'from-emerald-400/90 via-emerald-400/25 to-transparent',
    helix: 'emerald',
    text: 'group-hover:text-emerald-200',
    dot: 'bg-emerald-400',
  },
  violet: {
    chip: 'bg-violet-400/10 text-violet-300 border-violet-400/20',
    accent: 'from-violet-400/90 via-violet-400/25 to-transparent',
    helix: 'purple',
    text: 'group-hover:text-violet-200',
    dot: 'bg-violet-400',
  },
  amber: {
    chip: 'bg-amber-400/10 text-amber-300 border-amber-400/20',
    accent: 'from-amber-400/80 via-amber-400/20 to-transparent',
    helix: 'amber',
    text: 'group-hover:text-amber-200',
    dot: 'bg-amber-400',
  },
  blue: {
    chip: 'bg-blue-400/10 text-blue-300 border-blue-400/20',
    accent: 'from-blue-400/90 via-blue-400/25 to-transparent',
    helix: 'blue',
    text: 'group-hover:text-blue-200',
    dot: 'bg-blue-400',
  },
};

const fallbackTone: ToneStyle = toneStyles.cyan;

interface LandingStat {
  value: number;
  suffix: string;
  label: string;
}

const stats: LandingStat[] = [
  { value: 500, suffix: '+', label: 'Research labs' },
  { value: 150, suffix: '+', label: 'Drug discovery teams' },
  { value: 200, suffix: '+', label: 'Genetics teams' },
  { value: 24, suffix: '/7', label: 'Uptime monitoring' },
];

interface LandingStep {
  index: string;
  title: string;
  body: string;
  icon: LucideIcon;
  tone: string;
}

const steps: LandingStep[] = [
  {
    index: '01',
    title: 'Upload variants',
    body: 'Paste an HGVS string, drop a VCF, or pick a gene and position. Sequence context is fetched and normalised automatically.',
    icon: Activity,
    tone: 'cyan',
  },
  {
    index: '02',
    title: 'Run AI consensus',
    body: 'AlphaMissense, Grok, SpliceAI and AlphaFold-3 score the variant in parallel, then reconcile into a single weighted call.',
    icon: Brain,
    tone: 'pink',
  },
  {
    index: '03',
    title: 'Review clinical interpretation',
    body: 'Read the mechanism, structural impact and ACMG-aligned summary, then export a report your team can act on.',
    icon: ShieldCheck,
    tone: 'emerald',
  },
];

/* -------------------------------------------------------------------------- */
/* Injected keyframes                                                         */
/* -------------------------------------------------------------------------- */

const LANDING_CSS = `
@keyframes mm-rise {
  from { opacity: 0; transform: translate3d(0, 20px, 0); }
  to   { opacity: 1; transform: translate3d(0, 0, 0); }
}
@keyframes mm-float {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50%      { transform: translate3d(0, -8px, 0); }
}
@keyframes mm-drift-a {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50%      { transform: translate3d(4%, -5%, 0) scale(1.08); }
}
@keyframes mm-drift-b {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50%      { transform: translate3d(-5%, 4%, 0) scale(1.06); }
}
@keyframes mm-drift-c {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50%      { transform: translate3d(3%, 6%, 0) scale(1.12); }
}
@keyframes mm-breathe {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 1; }
}
@keyframes mm-spin-slow {
  to { transform: rotate(360deg); }
}
@keyframes mm-lightning {
  0%   { background-position:   0% 50%; }
  100% { background-position: 400% 50%; }
}
@keyframes mm-shine {
  0%   { transform: translateX(-120%); }
  100% { transform: translateX(220%); }
}
@keyframes mm-pulse-soft {
  0%, 100% { box-shadow: 0 0 0 0 rgba(236, 72, 153, 0.0), 0 0 24px -6px rgba(236, 72, 153, 0.45); }
  50%      { box-shadow: 0 0 0 6px rgba(236, 72, 153, 0.06), 0 0 32px -4px rgba(236, 72, 153, 0.7); }
}
.mm-rise    { animation: mm-rise 0.9s cubic-bezier(0.22, 1, 0.36, 1) both; }
.mm-float   { animation: mm-float 7s ease-in-out infinite; }
.mm-drift-a { animation: mm-drift-a 18s ease-in-out infinite; }
.mm-drift-b { animation: mm-drift-b 22s ease-in-out infinite; }
.mm-drift-c { animation: mm-drift-c 26s ease-in-out infinite; }
.mm-breathe { animation: mm-breathe 4s ease-in-out infinite; }
.mm-spin-slow { animation: mm-spin-slow 28s linear infinite; }

/* Display font + lightning border */
.mm-display { font-family: 'Space Grotesk', 'Fira Sans', system-ui, sans-serif; letter-spacing: -0.02em; }
.mm-mono    { font-family: 'Fira Code', 'JetBrains Mono', monospace; }
.mm-lightning {
  position: relative;
  isolation: isolate;
  background:
    linear-gradient(135deg, rgba(15,23,42,0.92), rgba(15,23,42,0.86)) padding-box,
    linear-gradient(110deg, rgba(244,63,94,0) 0%, rgba(244,63,94,.85) 8%, rgba(236,72,153,.9) 18%, rgba(168,85,247,.85) 32%, rgba(34,211,238,.85) 46%, rgba(236,72,153,.85) 60%, rgba(168,85,247,.8) 72%, rgba(34,211,238,.8) 84%, rgba(244,63,94,0) 100%) border-box;
  background-size: 100% 100%, 300% 100%;
  border: 1px solid transparent;
  animation: mm-lightning 5.5s linear infinite;
}
.mm-lightning-static {
  position: relative;
  isolation: isolate;
  background:
    linear-gradient(135deg, rgba(15,23,42,0.92), rgba(15,23,42,0.86)) padding-box,
    linear-gradient(120deg, rgba(236,72,153,.7), rgba(168,85,247,.7), rgba(34,211,238,.7), rgba(236,72,153,.7)) border-box;
  background-size: 100% 100%, 300% 100%;
  border: 1px solid transparent;
  animation: mm-lightning 9s linear infinite;
}
.mm-shine::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg, transparent 0%, transparent 35%, rgba(255,255,255,0.10) 50%, transparent 65%, transparent 100%);
  transform: translateX(-120%);
  animation: mm-shine 6s ease-in-out infinite;
  pointer-events: none;
}
.mm-pulse-ring { animation: mm-pulse-soft 3.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .mm-rise, .mm-float, .mm-drift-a, .mm-drift-b, .mm-drift-c, .mm-breathe,
  .mm-spin-slow, .mm-lightning, .mm-lightning-static, .mm-shine::after, .mm-pulse-ring {
    animation: none !important;
  }
}
`;

/* -------------------------------------------------------------------------- */
/* DnaDoubleHelix3D - animated 3D double helix on canvas                      */
/* -------------------------------------------------------------------------- */

const TAU = Math.PI * 2;

interface DnaDoubleHelix3DProps {
  className?: string;
  /** Radians of rotation per second. */
  speed?: number;
  /** Vertical extent as a fraction of the canvas height. */
  amplitude?: number;
  /** Any string/number - gives this instance a stable, non-centred start phase. */
  seed?: string | number;
}

interface HelixNode {
  x: number;
  y: number;
  /** Depth in 0..1 where 1 is nearest the viewer. */
  d: number;
}

interface HelixParticle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  a: number;
  pink: boolean;
}

/** Deterministic PRNG so the helix looks the same for a given seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string | number): number {
  const str = String(seed);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Base-pair palette: A-T (pink), G-C (cyan/indigo), plus a violet wobble pair. */
const BASE_PAIRS: string[] = ['236,72,153', '34,211,238', '168,85,247'];

const STRAND_A = '244,114,182';
const STRAND_B = '167,139,250';

const DnaDoubleHelix3D: React.FC<DnaDoubleHelix3DProps> = ({
  className = '',
  speed = 0.5,
  amplitude = 0.34,
  seed = 'mutationmechanic',
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const visibleRef = useRef<boolean>(true);
  const timeRef = useRef<number>(0);
  const pointerRef = useRef<{ x: number; y: number; tx: number; ty: number }>({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const rng = mulberry32(hashSeed(seed));
    const phase0 = rng() * TAU;
    timeRef.current = rng() * 60;

    let width = 0;
    let height = 0;

    const particles: HelixParticle[] = [];
    for (let i = 0; i < 30; i++) {
      particles.push({
        x: rng(),
        y: rng(),
        r: 0.7 + rng() * 1.7,
        vx: (rng() - 0.5) * 0.02,
        vy: -0.008 - rng() * 0.03,
        a: 0.12 + rng() * 0.4,
        pink: rng() > 0.5,
      });
    }

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      width = Math.max(rect.width, 240);
      height = Math.max(rect.height, 200);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const advanceParticles = (dt: number) => {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y < -0.05) {
          p.y = 1.05;
          p.x = rng();
        }
        if (p.x < -0.05) p.x = 1.05;
        if (p.x > 1.05) p.x = -0.05;
      }
    };

    const renderFrame = (t: number) => {
      ctx.clearRect(0, 0, width, height);

      const pointer = pointerRef.current;
      const centerY = height * 0.5 + pointer.y * 20;
      const breathe = 1 + Math.sin(t * 0.55) * 0.05;
      const amp = Math.min(height * amplitude, height * 0.44) * breathe;
      const wavelength = Math.max(width * 0.55, 380);
      const k = TAU / wavelength;
      const count = Math.max(26, Math.min(64, Math.round(width / 24)));
      const stepX = width / (count - 1);
      const shift = pointer.x * 16;

      // Drifting particles behind the helix.
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, p.r, 0, TAU);
        ctx.fillStyle = `rgba(${p.pink ? '244,114,182' : '125,211,252'}, ${p.a})`;
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      // Sample both strands: strand B is the same helix offset by pi.
      const strandA: HelixNode[] = [];
      const strandB: HelixNode[] = [];
      for (let i = 0; i < count; i++) {
        const x = i * stepX + shift * 0.5;
        const phase = x * k - t + phase0;
        const s = Math.sin(phase);
        const c = Math.cos(phase);
        strandA.push({ x, y: centerY + s * amp, d: (c + 1) / 2 });
        strandB.push({ x, y: centerY - s * amp, d: (1 - c) / 2 });
      }

      // Base-pair rungs. Opacity tracks how edge-on the pair is (its projected
      // length), which is what makes the helix read as a 3D object.
      ctx.lineCap = 'round';
      for (let i = 0; i < count; i++) {
        const a = strandA[i];
        const b = strandB[i];
        const projected = amp > 0 ? Math.min(1, Math.abs(a.y - b.y) / (2 * amp)) : 0;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(${BASE_PAIRS[i % BASE_PAIRS.length]}, ${0.05 + projected * 0.5})`;
        ctx.lineWidth = 1 + projected * 1.8;
        ctx.stroke();
      }

      // Backbones, drawn segment by segment so width and alpha follow depth.
      const strokeStrand = (nodes: HelixNode[], color: string) => {
        for (let i = 0; i < nodes.length - 1; i++) {
          const n1 = nodes[i];
          const n2 = nodes[i + 1];
          const d = (n1.d + n2.d) * 0.5;
          ctx.beginPath();
          ctx.moveTo(n1.x, n1.y);
          ctx.lineTo(n2.x, n2.y);
          ctx.strokeStyle = `rgba(${color}, ${0.08 + d * 0.6})`;
          ctx.lineWidth = 0.9 + d * 2.4;
          ctx.stroke();
        }
      };
      strokeStrand(strandA, STRAND_A);
      strokeStrand(strandB, STRAND_B);

      // Nucleotide spheres: additive halo pass first, then solid cores.
      const drawNodes = (nodes: HelixNode[], near: string, far: string) => {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          if (n.d < 0.32) continue;
          const radius = (1.5 + n.d * 4) * 2.9;
          ctx.beginPath();
          ctx.arc(n.x, n.y, radius, 0, TAU);
          ctx.fillStyle = `rgba(${near}, ${0.025 + n.d * 0.06})`;
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';

        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const radius = 1.4 + n.d * 4;
          ctx.beginPath();
          ctx.arc(n.x, n.y, radius, 0, TAU);
          ctx.fillStyle = `rgba(${n.d > 0.5 ? near : far}, ${0.2 + n.d * 0.78})`;
          ctx.fill();

          if (n.d > 0.88) {
            ctx.beginPath();
            ctx.arc(n.x - radius * 0.25, n.y - radius * 0.3, radius * 0.32, 0, TAU);
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fill();
          }
        }
      };
      drawNodes(strandA, STRAND_A, '129,140,248');
      drawNodes(strandB, STRAND_B, '99,102,241');
    };

    resize();
    renderFrame(timeRef.current);

    if (prefersReduced) {
      // Static frame only - no rAF, no pointer tracking, no particle drift.
      const handleStaticResize = () => {
        resize();
        renderFrame(timeRef.current);
      };
      window.addEventListener('resize', handleStaticResize);
      return () => window.removeEventListener('resize', handleStaticResize);
    }

    const handlePointer = (event: PointerEvent) => {
      const nx = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
      const ny = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
      pointerRef.current.tx = Math.max(-1, Math.min(1, nx));
      pointerRef.current.ty = Math.max(-1, Math.min(1, ny));
    };
    window.addEventListener('pointermove', handlePointer, { passive: true });

    let lastTime = performance.now();

    const loop = (now: number) => {
      if (!visibleRef.current) return;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      timeRef.current += dt * speed;

      const pointer = pointerRef.current;
      const ease = Math.min(1, dt * 3);
      pointer.x += (pointer.tx - pointer.x) * ease;
      pointer.y += (pointer.ty - pointer.y) * ease;

      advanceParticles(dt);
      renderFrame(timeRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.length > 0 && entries[0].isIntersecting;
        visibleRef.current = visible;
        if (visible) {
          lastTime = performance.now();
          if (rafRef.current === null) {
            rafRef.current = requestAnimationFrame(loop);
          }
        } else if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      },
      { threshold: 0 }
    );
    observer.observe(wrap);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            resize();
            renderFrame(timeRef.current);
          })
        : null;
    if (resizeObserver) resizeObserver.observe(wrap);

    return () => {
      observer.disconnect();
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('pointermove', handlePointer);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [speed, amplitude, seed]);

  return (
    <div ref={wrapRef} className={className} aria-hidden="true">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* CountUp - rAF counter that fires once when scrolled into view              */
/* -------------------------------------------------------------------------- */

interface CountUpProps {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}

const CountUp: React.FC<CountUpProps> = ({ value, suffix = '', duration = 1500, className = '' }) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }

    let raf: number | null = null;
    let started = false;
    let startTime = 0;

    const tick = (now: number) => {
      if (!started) {
        started = true;
        startTime = now;
      }
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = null;
      }
    };

    const observer = new IntersectionObserver(
      entries => {
        if (entries.length > 0 && entries[0].isIntersecting) {
          observer.disconnect();
          raf = requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {Math.round(display)}
      {suffix}
    </span>
  );
};

/* -------------------------------------------------------------------------- */
/* LandingPage                                                                */
/* -------------------------------------------------------------------------- */

const GITHUB_URL = 'https://github.com';

const LandingPage: React.FC = () => (
  <div className="min-h-screen overflow-hidden bg-[#070d1d] text-slate-100">
    <style>{LANDING_CSS}</style>

    <header className="sticky top-0 z-50 border-b border-slate-800/70 bg-[#070d1d]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="/" className="group flex items-center gap-2.5" aria-label="MutationMechanic home">
          <span className="mm-pulse-ring relative rounded-lg border border-pink-400/25 bg-pink-400/10 p-2">
            <Dna className="h-5 w-5 text-pink-300 transition-transform duration-500 group-hover:rotate-12" aria-hidden="true" />
          </span>
          <span className="mm-display text-[15px] font-bold tracking-tight">
            Mutation<span className="bg-gradient-to-r from-pink-300 to-fuchsia-400 bg-clip-text text-transparent">Mechanic</span>
          </span>
        </a>
        <nav aria-label="Account" className="flex items-center gap-3 text-[13px] text-slate-400 sm:gap-5">
          <a href="/workspace" className="hidden transition-colors hover:text-white sm:inline">
            Sign in
          </a>
          <a
            href="/workspace"
            className="mm-display group inline-flex items-center gap-1.5 rounded-md bg-pink-500 px-4 py-2 font-semibold text-white shadow-[0_0_24px_-8px_rgba(236,72,153,0.85)] transition-all hover:bg-pink-400 hover:shadow-[0_0_30px_-6px_rgba(236,72,153,1)]"
          >
            Get Started
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
        </nav>
      </div>
    </header>

    <main>
      {/* ------------------------------- Hero ------------------------------- */}
      <section className="relative flex min-h-[620px] items-center justify-center overflow-hidden px-6 py-24 md:min-h-[88vh]">
        {/* Layer 0 - blurred radial blobs */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="mm-drift-a absolute -left-24 top-2 h-[420px] w-[420px] rounded-full bg-pink-500/25 blur-[120px]" />
          <div className="mm-drift-b absolute -right-24 top-1/4 h-[460px] w-[460px] rounded-full bg-violet-600/25 blur-[130px]" />
          <div className="mm-drift-c absolute -bottom-24 left-1/4 h-[380px] w-[520px] rounded-full bg-cyan-500/15 blur-[120px]" />
        </div>

        {/* Layer 1 - the animated double helix */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
          <DnaDoubleHelix3D
            className="h-[420px] w-full md:h-[560px]"
            speed={0.5}
            amplitude={0.34}
            seed="mutationmechanic-hero"
          />
        </div>

        {/* Layer 1b - rotating radar ring + sweeping conic arc (CropHealth signature) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
          <div className="relative h-[640px] w-[640px] max-w-[110vw] opacity-70">
            <div className="mm-spin-slow absolute inset-0 rounded-full bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0deg,rgba(236,72,153,0.18)_30deg,transparent_70deg)] blur-[1px]" />
            <div className="absolute inset-0 rounded-full border border-pink-500/10" />
            <div className="absolute inset-6 rounded-full border border-violet-500/10" />
            <div className="absolute inset-12 rounded-full border border-cyan-500/10" />
            <div className="mm-spin-slow absolute inset-0 rounded-full border border-dashed border-pink-400/20" style={{ animationDuration: '60s', animationDirection: 'reverse' }} />
          </div>
        </div>

        {/* Layer 2 - soft scrim so the headline stays legible over the helix */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(58%_48%_at_50%_50%,rgba(7,13,29,0.66)_0%,rgba(7,13,29,0.28)_55%,rgba(7,13,29,0)_100%)]"
        />

        {/* Layer 3 - copy */}
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mm-float inline-flex items-center gap-2 rounded-full border border-pink-400/25 bg-pink-500/10 px-3 py-1 text-[11px] font-medium text-pink-200 backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-pink-300" />
            </span>
            <Sparkles size={11} aria-hidden="true" />
            New AlphaFold-3 integration available
          </div>

          <h1 className="mm-display mm-rise mt-7 text-[44px] font-bold leading-[0.95] tracking-[-0.04em] drop-shadow-[0_0_40px_rgba(236,72,153,0.20)] sm:text-7xl lg:text-[88px]">
            <span className="block">Engineering proteins.</span>
            <span className="relative mt-2 inline-block">
              <span className="bg-gradient-to-r from-pink-200 via-pink-400 to-fuchsia-400 bg-clip-text pb-2 italic text-transparent">
                Decoding disease.
              </span>
              <span aria-hidden="true" className="absolute -bottom-1 left-0 h-[2px] w-full bg-gradient-to-r from-pink-400/0 via-pink-400 to-fuchsia-400/0" />
            </span>
          </h1>

          <p
            className="mm-rise mx-auto mt-7 max-w-2xl text-[15px] leading-relaxed text-slate-300/90 sm:text-base"
            style={{ animationDelay: '120ms' }}
          >
            Analyze pathogenicity, structural impact, and splicing defects with clinical precision. The all-in-one
            platform for modern genomic medicine.
          </p>

          <div
            className="mm-rise mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: '220ms' }}
          >
            <a
              href="/workspace?tab=explainer"
              className="mm-display group inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-pink-500 to-fuchsia-500 px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_0_36px_-8px_rgba(236,72,153,0.85)] transition-all hover:from-pink-400 hover:to-fuchsia-400 hover:shadow-[0_0_40px_-4px_rgba(236,72,153,1)] sm:w-auto"
            >
              <Dna size={16} aria-hidden="true" />
              Explore the platform
              <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mm-display inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-700/80 bg-slate-900/60 px-6 py-3.5 text-[15px] font-semibold text-slate-100 backdrop-blur-sm transition-all hover:border-pink-400/50 hover:bg-slate-900/80 sm:w-auto"
            >
              <Github size={16} aria-hidden="true" />
              View on GitHub
            </a>
          </div>

          <p className="mm-display mm-rise mt-7 text-[11px] uppercase tracking-[0.22em] text-slate-500" style={{ animationDelay: '320ms' }}>
            Trusted by research labs <span className="text-pink-400/60">&amp;</span> clinical centers
          </p>
        </div>
      </section>

      {/* ------------------------------- Stats ------------------------------ */}
      <section aria-label="Platform usage" className="relative border-y border-slate-800/70 bg-slate-950/40">
        <div aria-hidden="true" className="mm-lightning-static pointer-events-none absolute inset-x-0 top-0 h-px" />
        <div aria-hidden="true" className="mm-lightning-static pointer-events-none absolute inset-x-0 bottom-0 h-px" />
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-6 py-10 sm:grid-cols-4">
          {stats.map(stat => (
            <div key={stat.label} className="group relative px-2 py-5 text-center">
              <div className="mm-display text-[42px] font-bold leading-none tracking-[-0.03em] sm:text-5xl">
                <span className="bg-gradient-to-br from-white via-pink-200 to-pink-400 bg-clip-text text-transparent transition-all duration-500 group-hover:from-pink-300 group-hover:via-pink-400 group-hover:to-fuchsia-400">
                  <CountUp value={stat.value} suffix={stat.suffix} />
                </span>
              </div>
              <div className="mm-mono mt-3 text-[10px] uppercase tracking-[0.22em] text-slate-500">
                {stat.label}
              </div>
              <div
                aria-hidden="true"
                className="mx-auto mt-3 h-px w-6 bg-pink-400/40 transition-all duration-500 group-hover:w-12 group-hover:bg-pink-400"
              />
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------ Modules ----------------------------- */}
      <section className="relative mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <div className="mm-mono inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-pink-300/80">
              <span aria-hidden="true" className="h-px w-6 bg-pink-400/60" />
              06 Modules
            </div>
            <h2 className="mm-display mt-4 text-4xl font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl">
              Six powerful <span className="bg-gradient-to-r from-pink-300 to-fuchsia-400 bg-clip-text italic text-transparent">modules</span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Purpose-built tools for the questions that matter in genomic medicine.
            </p>
          </div>
          <a
            href="/workspace"
            className="mm-display inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400 transition-colors hover:text-pink-300"
          >
            Open the workspace
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {modules.map(({ tab, title, description, meta, icon: Icon, tone, badge }, i) => {
            const toneStyle = toneStyles[tone] || fallbackTone;
            const helixSeed = tab ? `${tab}-${i}` : `rna-${i}`;
            return (
              <a
                key={title}
                href={tab ? `/workspace?tab=${tab}` : undefined}
                aria-disabled={!tab}
                onClick={event => {
                  if (!tab) event.preventDefault();
                }}
                style={{ animationDelay: `${i * 60}ms` }}
                className={`mm-lightning mm-shine group relative min-h-48 overflow-hidden rounded-2xl p-[1px] transition-transform duration-500 ${
                  tab
                    ? 'hover:-translate-y-1.5 hover:scale-[1.01] cursor-pointer'
                    : 'opacity-70 cursor-not-allowed'
                }`}
              >
                <div className="relative h-full overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/85 to-slate-950/95 p-5 backdrop-blur-sm transition-colors duration-500 group-hover:from-slate-900/90 group-hover:via-slate-900/80 group-hover:to-slate-900/90">
                  {/* Animated DNA sweep - always present, fades stronger on hover */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-30 transition-opacity duration-700 group-hover:opacity-100"
                  >
                    <DnaHelixBackdrop
                      className="h-full w-full"
                      color={toneStyle.helix}
                      opacity={0.13}
                      motionVariant="fluid"
                      seed={helixSeed}
                    />
                  </div>

                  {/* Gradient mask fade so DNA doesn't overpower text */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,transparent_30%,rgba(7,13,29,0.85)_75%)]"
                  />

                  {/* Top accent bar */}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r opacity-80 transition-opacity duration-300 group-hover:opacity-100 ${toneStyle.accent}`}
                  />

                  <div className="relative z-10 flex h-full min-h-[170px] flex-col">
                    <div className="flex items-start justify-between">
                      <span
                        className={`inline-flex rounded-lg border p-2.5 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 ${toneStyle.chip}`}
                      >
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      {badge ? (
                        <span className="mm-mono rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-amber-300">
                          {badge}
                        </span>
                      ) : (
                        <span
                          aria-hidden="true"
                          className="mm-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600"
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      )}
                    </div>

                    <h3 className={`mm-display mt-5 text-[19px] font-semibold leading-snug tracking-tight transition-colors duration-300 ${toneStyle.text}`}>
                      {title}
                    </h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{description}</p>

                    <div className="mt-auto flex items-center justify-between gap-2 pt-5">
                      <p className="mm-mono flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                        <span className={`h-1.5 w-1.5 rounded-full ${toneStyle.dot}`} aria-hidden="true" />
                        {meta}
                      </p>
                      <span
                        aria-hidden="true"
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-800/80 bg-slate-900/60 text-slate-500 transition-all duration-300 group-hover:border-pink-400/60 group-hover:bg-pink-500/15 group-hover:text-pink-200 group-hover:translate-x-0.5 ${
                          !tab && 'opacity-40'
                        }`}
                      >
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* ---------------------------- How it works -------------------------- */}
      <section className="relative border-t border-slate-800/70 py-20">
        <div aria-hidden="true" className="mm-lightning-static pointer-events-none absolute inset-x-0 top-0 h-px" />
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-12 text-center">
            <div className="mm-mono inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-cyan-300/80">
              <span aria-hidden="true" className="h-px w-6 bg-cyan-400/60" />
              03 Steps
            </div>
            <h2 className="mm-display mt-4 text-4xl font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl">
              From raw variant to{' '}
              <span className="bg-gradient-to-r from-cyan-200 to-pink-300 bg-clip-text italic text-transparent">
                clinical answer
              </span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
              Three steps, one consensus call you can defend.
            </p>
          </div>

          <ol className="relative space-y-6 pl-16">
            <span
              aria-hidden="true"
              className="absolute bottom-6 left-[19px] top-6 w-px bg-gradient-to-b from-pink-500/70 via-violet-500/40 to-cyan-500/50"
            />
            {steps.map(step => {
              const toneStyle = toneStyles[step.tone] || fallbackTone;
              const StepIcon = step.icon;
              return (
                <li key={step.index} className="relative">
                  <span
                    aria-hidden="true"
                    className={`mm-display absolute -left-16 top-3 flex h-12 w-12 items-center justify-center rounded-2xl border ${toneStyle.chip} text-base font-bold transition-transform duration-500 group-hover:scale-110`}
                  >
                    {step.index}
                  </span>

                  <div className="mm-lightning mm-shine group relative overflow-hidden rounded-2xl p-[1px] transition-transform duration-500 hover:-translate-y-0.5">
                    <div className="relative h-full overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-slate-950/95 p-5 backdrop-blur-sm">
                      <div className="flex items-start gap-4">
                        <span className={`inline-flex shrink-0 rounded-lg border p-2.5 ${toneStyle.chip}`}>
                          <StepIcon size={18} aria-hidden="true" />
                        </span>
                        <div>
                          <h3 className="mm-display text-[17px] font-semibold leading-snug tracking-tight text-slate-100">
                            {step.title}
                          </h3>
                          <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{step.body}</p>
                        </div>
                      </div>

                      {/* DNA-rung flourish */}
                      <div aria-hidden="true" className="mt-4 flex items-center gap-2 pl-12 opacity-60">
                        {[0, 1, 2, 3, 4].map(i => (
                          <span
                            key={i}
                            className="h-px bg-gradient-to-r from-slate-600 to-slate-700"
                            style={{ width: `${18 + Math.abs(2 - i) * 12}px` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* -------------------------------- CTA ------------------------------- */}
      <section className="px-6 pb-24">
        <div className="mm-lightning mm-shine group relative mx-auto max-w-4xl overflow-hidden rounded-3xl p-[1px]">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950/90 p-12 text-center backdrop-blur-sm">
            <div aria-hidden="true" className="mm-drift-b absolute -right-16 -top-16 h-56 w-56 rounded-full bg-pink-500/25 blur-[90px]" />
            <div aria-hidden="true" className="mm-drift-a absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-cyan-500/15 blur-[90px]" />
            <div className="relative z-10">
              <div className="mm-mono inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-pink-300/80">
                <span aria-hidden="true" className="h-px w-6 bg-pink-400/60" />
                The Bottom Line
              </div>
              <h2 className="mm-display mt-5 text-3xl font-bold leading-[1.1] tracking-[-0.03em] sm:text-4xl">
                Ready to transform your{' '}
                <span className="bg-gradient-to-r from-pink-200 to-fuchsia-400 bg-clip-text italic text-transparent">
                  genomic research?
                </span>
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-slate-400">
                Start exploring MutationMechanic with the complete working toolkit.
              </p>
              <a
                href="/workspace"
                className="mm-display mt-7 inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-pink-500 to-fuchsia-500 px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_0_36px_-8px_rgba(236,72,153,0.85)] transition-all hover:from-pink-400 hover:to-fuchsia-400 hover:shadow-[0_0_40px_-4px_rgba(236,72,153,1)]"
              >
                Start exploring
                <ArrowRight size={15} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer className="border-t border-slate-800/70 py-8">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-3 px-6 text-xs text-slate-600 sm:flex-row">
        <span>&copy; 2026 MutationMechanic. Advancing precision medicine through AI.</span>
        <a href="/workspace" className="transition-colors hover:text-slate-300">
          Open workspace
        </a>
      </div>
    </footer>
  </div>
);

export default LandingPage;
