# Analytics Page — Design Overrides
> Inherits from MASTER.md.

## Wipe History Button
- MUST use `<ConfirmModal>` (MASTER §7) — not window.confirm()
- Button style: Destructive from MASTER §5.6
- Confirm modal description must mention irreversibility of clinical audit data

## Filters Button
- Visually distinct from sub-tab pills: use border + icon style, NOT same pill as Overview/Hotspots/etc.
- When active: `bg-primary/10 border-primary text-primary`
- When inactive: `bg-slate-900 border-slate-700 text-slate-400`

## Zero-State Stat Cards
- When records = 0: show value "0" in muted color (not white/bold)
- Sub-label: "No data yet" in muted italic small

## Empty State (no records at all)
- Extend the existing "No matching records found" pattern to cover true-zero state
- Icon: `<BarChart3>` 48px muted
- Headline: "No analysis history"
- Subtext: "Run your first variant analysis to populate this dashboard."
- CTA: "Go to Explainer" → switches tab

## History Table Empty State
- Total Patients: 0 → EmptyState with "New Patient" CTA
- Total Analyses: 0 → "Run an analysis" subtext
