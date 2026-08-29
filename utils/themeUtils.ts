import { DnaThemeColor, MotionVariant } from '../components/DnaHelixBackdrop';

export interface VariantGlowTheme {
  color: DnaThemeColor;
  motionVariant: MotionVariant;
  glowClass: string;
  badgeClass: string;
  accentClass: string;
  categoryLabel: string;
}

export function getVariantGlowTheme(item: { disease?: string; protein?: string; variant?: string }): VariantGlowTheme {
  const d = (item.disease || '').toLowerCase();
  const p = (item.protein || '').toUpperCase();
  const v = (item.variant || '').toLowerCase();

  // Splicing variants (c. notation splice or cryptic exon)
  if (v.includes('+') || v.includes('-') || v.includes('ivs') || v.includes('splice') || v.includes('kb')) {
    return {
      color: 'cyan',
      motionVariant: 'fluid',
      glowClass: 'mm-glow--cyan',
      badgeClass: 'text-cyan-300 bg-cyan-950/50 border-cyan-500/40',
      accentClass: 'mm-section-accent',
      categoryLabel: 'SPLICING'
    };
  }

  // Oncology / Cancer variants — erratic, chaotic motion (mutation instability)
  if (
    d.includes('cancer') || d.includes('carcinoma') || d.includes('melanoma') ||
    d.includes('adenocarcinoma') || d.includes('leukemia') || d.includes('glioma') ||
    d.includes('tumor') || d.includes('neoplasm') ||
    ['TP53', 'BRCA1', 'BRCA2', 'KRAS', 'BRAF', 'EGFR', 'PIK3CA', 'PTEN', 'MYC', 'ERBB2', 'ALK', 'IDH1', 'RB1'].includes(p)
  ) {
    return {
      color: 'rose',
      motionVariant: 'chaotic',
      glowClass: 'mm-glow--rose',
      badgeClass: 'text-rose-300 bg-rose-950/50 border-rose-500/40',
      accentClass: 'mm-section-accent mm-section-accent--rose',
      categoryLabel: 'ONCOLOGY'
    };
  }

  // Neurological / Neurodegenerative — slow, decaying pulse (signal decay)
  if (
    d.includes('als') || d.includes('sclerosis') || d.includes('alzheimer') ||
    d.includes('parkinson') || d.includes('huntington') || d.includes('sma') ||
    d.includes('muscular') || d.includes('epilepsy') || d.includes('seizure') ||
    d.includes('ataxia') || d.includes('dystrophy') ||
    ['SOD1', 'SMN1', 'APP', 'SNCA', 'HTT', 'SCN1A', 'FUS', 'TARDBP', 'DMD', 'NF1', 'MECP2'].includes(p)
  ) {
    return {
      color: 'purple',
      motionVariant: 'decay',
      glowClass: 'mm-glow--purple',
      badgeClass: 'text-purple-300 bg-purple-950/50 border-purple-500/40',
      accentClass: 'mm-section-accent mm-section-accent--purple',
      categoryLabel: 'NEUROLOGY'
    };
  }

  // Cardiovascular — rhythmic heartbeat pulse
  if (
    d.includes('cardio') || d.includes('marfan') || d.includes('hypertrophic') ||
    d.includes('vascular') || d.includes('artery') || d.includes('aorta') ||
    d.includes('long qt') || d.includes('brugada') ||
    ['MYH7', 'FBN1', 'LDLR', 'PCSK9', 'TNNT2', 'ACTC1', 'COL3A1', 'KCNQ1', 'KCNH2'].includes(p)
  ) {
    return {
      color: 'blue',
      motionVariant: 'pulse',
      glowClass: 'mm-glow--blue',
      badgeClass: 'text-blue-300 bg-blue-950/50 border-blue-500/40',
      accentClass: 'mm-section-accent mm-section-accent--blue',
      categoryLabel: 'CARDIOVASCULAR'
    };
  }

  // Metabolic / Monogenic / Hematological — steady rhythmic breathing
  if (
    d.includes('cystic') || d.includes('fibrosis') || d.includes('hemophilia') ||
    d.includes('sickle') || d.includes('anemia') || d.includes('pku') || d.includes('phenyl') ||
    d.includes('gaucher') || d.includes('fabry') || d.includes('glycogen') ||
    ['CFTR', 'FVIII', 'FIX', 'HBB', 'HBA', 'MTHFR', 'PAH', 'G6PD', 'HEXA', 'GBA', 'GLA'].includes(p)
  ) {
    return {
      color: 'emerald',
      motionVariant: 'rhythmic',
      glowClass: 'mm-glow--emerald',
      badgeClass: 'text-emerald-300 bg-emerald-950/50 border-emerald-500/40',
      accentClass: 'mm-section-accent mm-section-accent--emerald',
      categoryLabel: 'METABOLIC'
    };
  }

  // Default: Amber (Structural / Novel) — angular, lattice-like
  return {
    color: 'amber',
    motionVariant: 'angular',
    glowClass: 'mm-glow--amber',
    badgeClass: 'text-amber-300 bg-amber-950/50 border-amber-500/40',
    accentClass: 'mm-section-accent mm-section-accent--amber',
    categoryLabel: 'STRUCTURAL'
  };
}
