import React, { useEffect, useRef } from 'react';
import { configService } from '../services/configService';

export type DnaThemeColor = 'cyan' | 'purple' | 'emerald' | 'blue' | 'amber' | 'rose';

/**
 * Motion variants:
 * - 'fluid'    : smooth, continuous sinusoidal rotation (default, used for Splicing / Cyan)
 * - 'chaotic'  : erratic speed bursts + jitter, high-energy (Oncology / Rose)
 * - 'decay'    : slow, heavy, amplitude-degrading pulse then rebuild (Neurology / Purple)
 * - 'rhythmic' : steady metronomic pulses, amplitude breathes in/out (Metabolic / Emerald)
 * - 'angular'  : segment-snapped angular steps, lattice-like (Structural / Amber)
 * - 'pulse'    : sinusoidal base + periodic heartbeat amplitude surge (Cardiovascular / Blue)
 */
export type MotionVariant = 'fluid' | 'chaotic' | 'decay' | 'rhythmic' | 'angular' | 'pulse';

interface DnaHelixBackdropProps {
  color?: DnaThemeColor;
  /** Base opacity of the canvas element. 0.18–0.35 recommended for visibility. Default 0.22. */
  opacity?: number;
  className?: string;
  speed?: number;
  amplitude?: number;
  /** Motion physics variant – controls how the helix moves */
  motionVariant?: MotionVariant;
  /** Seed string (gene name or card index) for per-card phase/direction variation */
  seed?: string | number;
}

const COLOR_RGB_MAP: Record<DnaThemeColor, [number, number, number]> = {
  cyan:    [34,  211, 238],
  emerald: [16,  185, 129],
  purple:  [168, 85,  247],
  blue:    [59,  130, 246],
  amber:   [245, 158, 11],
  rose:    [244, 63,  94]
};

/** Simple deterministic hash → 0..1 from a string seed */
function seededRandom(seed: string | number): () => number {
  let s = 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) s = (Math.imul(31, s) + str.charCodeAt(i)) | 0;
  s = Math.abs(s) || 1;
  return () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return (Math.abs(s) % 10000) / 10000;
  };
}

export const DnaHelixBackdrop: React.FC<DnaHelixBackdropProps> = ({
  color = 'cyan',
  opacity = 0.22,
  className = '',
  speed = 1,
  amplitude = 28,
  motionVariant = 'fluid',
  seed = 0
}) => {
  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef       = useRef<number | null>(null);
  const visibleRef   = useRef<boolean>(false);
  const timeRef      = useRef<number>(0);

  useEffect(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || configService.getFeatureFlags().reduceAnimations;

    // ── Per-card seeded variation ───────────────────────────────────────────────
    const rng           = seededRandom(seed);
    const phaseOffset   = rng() * Math.PI * 2;       // initial phase shift
    const dirSign       = rng() > 0.5 ? 1 : -1;      // scroll direction
    const ampJitter     = 0.85 + rng() * 0.3;         // ±15% amplitude per card
    const speedJitter   = 0.88 + rng() * 0.24;        // ±12% speed per card

    // Start clock at a random point so cards don't animate in lockstep
    timeRef.current = rng() * 100;

    const rgb = COLOR_RGB_MAP[color] || COLOR_RGB_MAP.cyan;
    const [r, g, b] = rgb;

    let width = 0;
    let height = 0;

    const resize = () => {
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      width  = Math.max(rect.width,  100);
      height = Math.max(rect.height, 60);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width  = width  * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    // ── Effective amplitude per variant ────────────────────────────────────────
    const baseAmplitude = amplitude * ampJitter;

    // ── Draw one frame ─────────────────────────────────────────────────────────
    const renderFrame = (t: number) => {
      ctx.clearRect(0, 0, width, height);

      const centerY    = height / 2;
      const waveLength = Math.max(width * 0.5, 180);
      const pointCount = Math.max(16, Math.floor(width / 28));
      const stepX      = width / (pointCount - 1);
      const k          = (Math.PI * 2) / waveLength;

      // ── Variant-specific amplitude and phase modulation ───────────────────
      let liveAmplitude = baseAmplitude;
      let extraPhase = 0;

      switch (motionVariant) {
        case 'chaotic': {
          // Rapid erratic jitter: amplitude oscillates chaotically
          liveAmplitude = baseAmplitude * (0.6 + 0.6 * Math.abs(Math.sin(t * 2.3)) * (0.7 + 0.3 * Math.sin(t * 5.1)));
          extraPhase = Math.sin(t * 7.3) * 0.18; // subtle high-freq tremor
          break;
        }
        case 'decay': {
          // Amplitude slowly degrades then rebuilds — signal decay / neurodegeneration
          const cycle = (t * 0.18) % (Math.PI * 2);
          liveAmplitude = baseAmplitude * (0.3 + 0.7 * Math.pow(Math.max(0, Math.cos(cycle)), 2));
          break;
        }
        case 'rhythmic': {
          // Steady metabolic breathing — amplitude pulses evenly
          liveAmplitude = baseAmplitude * (0.75 + 0.25 * Math.sin(t * 1.2));
          break;
        }
        case 'angular': {
          // Snap amplitude to discrete "steps" — lattice-like
          const steps = 4;
          const raw = 0.5 + 0.5 * Math.sin(t * 0.8);
          liveAmplitude = baseAmplitude * (0.4 + (Math.round(raw * steps) / steps) * 0.6);
          break;
        }
        case 'pulse': {
          // Heartbeat: baseline + sharp amplitude surge every ~1.2s
          const heartPhase = (t * 0.85) % (Math.PI * 2);
          const beat = Math.max(0, Math.sin(heartPhase) > 0.92 ? 1.5 * Math.sin(heartPhase * 6) : 0);
          liveAmplitude = baseAmplitude * (0.8 + 0.3 * beat);
          break;
        }
        default: // 'fluid' — smooth continuous rotation
          break;
      }

      // For angular variant, draw segmented straight-line strands
      const angularMode = motionVariant === 'angular';
      const segmentSteps = angularMode ? Math.max(8, Math.floor(pointCount / 3)) : pointCount;
      const sStepX = width / (segmentSteps - 1);

      // ── Base Pair Rungs ─────────────────────────────────────────────────────
      const drawCount = angularMode ? segmentSteps : pointCount;
      const drawStepX = angularMode ? sStepX : stepX;

      for (let i = 0; i < drawCount; i++) {
        const x     = i * drawStepX;
        const phase = dirSign * (x * k - t) + phaseOffset + extraPhase;
        const sinP  = Math.sin(phase);
        const cosP  = Math.cos(phase);

        const y1 = centerY + sinP * liveAmplitude;
        const y2 = centerY - sinP * liveAmplitude;

        // Rung opacity varies with 3D depth projection
        const rungAlpha = 0.35 + Math.abs(cosP) * 0.55;
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${rungAlpha})`;
        ctx.lineWidth = motionVariant === 'angular' ? 1.5 : 1.2;
        ctx.setLineDash(motionVariant === 'angular' ? [3, 2] : [2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // ── Strand 1 ────────────────────────────────────────────────────────────
      ctx.beginPath();
      for (let i = 0; i < drawCount; i++) {
        const x = i * drawStepX;
        const phase = dirSign * (x * k - t) + phaseOffset + extraPhase;
        const y = centerY + Math.sin(phase) * liveAmplitude;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.85)`;
      ctx.lineWidth = motionVariant === 'angular' ? 2.5 : 2.0;
      ctx.stroke();

      // ── Strand 2 ────────────────────────────────────────────────────────────
      ctx.beginPath();
      for (let i = 0; i < drawCount; i++) {
        const x = i * drawStepX;
        const phase = dirSign * (x * k - t) + phaseOffset + extraPhase;
        const y = centerY - Math.sin(phase) * liveAmplitude;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.65)`;
      ctx.lineWidth = motionVariant === 'angular' ? 2.0 : 1.6;
      ctx.stroke();

      // ── Nucleotide Spheres ──────────────────────────────────────────────────
      for (let i = 0; i < drawCount; i++) {
        const x     = i * drawStepX;
        const phase = dirSign * (x * k - t) + phaseOffset + extraPhase;
        const sinP  = Math.sin(phase);
        const cosP  = Math.cos(phase);

        const y1 = centerY + sinP * liveAmplitude;
        const y2 = centerY - sinP * liveAmplitude;
        const z1 =  cosP;
        const z2 = -cosP;

        // Node 1
        const r1 = Math.max(1.5, 3.0 + z1 * 1.2);
        const a1 = Math.max(0.3, 0.70 + z1 * 0.3);
        ctx.beginPath();
        ctx.arc(x, y1, r1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a1})`;
        ctx.fill();

        // Node 2
        const r2 = Math.max(1.5, 3.0 + z2 * 1.2);
        const a2 = Math.max(0.3, 0.70 + z2 * 0.3);
        ctx.beginPath();
        ctx.arc(x, y2, r2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a2})`;
        ctx.fill();
      }
    };

    if (prefersReduced) {
      renderFrame(timeRef.current);
      return;
    }

    let lastTime = performance.now();

    const speedForVariant = () => {
      switch (motionVariant) {
        case 'chaotic':  return speed * speedJitter * 1.4;
        case 'decay':    return speed * speedJitter * 0.45;
        case 'rhythmic': return speed * speedJitter * 0.9;
        case 'angular':  return speed * speedJitter * 0.7;
        case 'pulse':    return speed * speedJitter * 0.85;
        default:         return speed * speedJitter * 0.6;
      }
    };
    const effectiveSpeed = speedForVariant();

    const loop = (now: number) => {
      if (!visibleRef.current) return;
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      timeRef.current += delta * effectiveSpeed;
      renderFrame(timeRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        const vis = entry.isIntersecting;
        visibleRef.current = vis;
        if (vis) {
          lastTime = performance.now();
          if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(loop);
          }
        } else {
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
        }
      },
      { threshold: 0.05 }
    );

    observer.observe(container);

    const handleResize = () => { resize(); renderFrame(timeRef.current); };
    window.addEventListener('resize', handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [color, speed, amplitude, motionVariant, seed]);

  return (
    <div
      ref={containerRef}
      className={`mm-dna-backdrop ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ pointerEvents: 'none' }}
      />
    </div>
  );
};

export default DnaHelixBackdrop;
