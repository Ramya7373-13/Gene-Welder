# Design (Compensatory Design) Page — Design Overrides
> Inherits from MASTER.md.

## Benchmark Repository Cards
- Same anatomy as Explainer cards (MASTER §5.1) for consistency
- Type badge chips (frameshift/splice/folding/custom): colored dot prefix + label

## Filter Chips
- Row: `flex flex-wrap gap-2` — wraps on narrow screens (MASTER §5.2)
- All / Frameshift / Splice / Folding / Custom: use `<button aria-pressed>` — never `<div>` or plain `<span>`

## Variant Selector Empty State
- When no variant is selected, show inside the analysis panel:
  - Icon: `<FlaskConical>` 40px muted
  - Headline: "Select a variant to begin"
  - Subtext: "Choose from the benchmark repository or enter a custom HGVS notation above."
- Do NOT show a blank white/dark area

## Save Preset Modal
- Use standard modal (animate-in zoom-in-95)
- Confirm = Primary button, Cancel = Ghost
