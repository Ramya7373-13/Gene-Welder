# Explainer Page — Design Overrides
> Inherits from MASTER.md. Rules here take precedence.

## Card Grid
- 3-column grid: `grid md:grid-cols-2 lg:grid-cols-3 gap-4`
- Card anatomy (from MASTER §5.1): gene bold → HGVS mono teal → UniProt badge right → disease muted line-clamp-1
- Compare mode selected card: `border-primary ring-1 ring-primary bg-primary-dim` with `<CheckSquare>` icon replacing UniProt badge

## Compare Mode Interaction
- Selection limit: 2 cards max (enforce with disabled state on unselected after 2 chosen)
- Disabled-but-unselected card when 2 already chosen: `opacity-40 cursor-not-allowed pointer-events-none`
- "Run Comparison" button: only active when exactly 2 selected; disabled state `opacity-50 cursor-not-allowed`

## Report View
- Back button: Ghost style from MASTER §5.6 (no emoji, use `<ArrowLeft>`)
- Header gradient: `bg-gradient-to-r from-primary/20 to-indigo-900/20 border border-primary/20`

## Empty State (no variants loaded)
- Icon: `<Dna>` 48px muted
- Headline: "No variants available"
- Subtext: "Variants will appear here when loaded from the constants file."
