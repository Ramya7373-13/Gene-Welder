# Disease Tracer Page — Design Overrides
> Inherits from MASTER.md.

## Patient Selector
- Same dropdown spec as MASTER §5.5 (bg-slate-950, border, teal focus ring, chevron)
- "Load Profile" button: Primary style from MASTER §5.6

## Empty State (no patient selected)
- Icon: `<Activity>` 48px muted
- Headline: "No patient selected"
- Subtext: "Choose a research patient from the dropdown above to load their risk profile."

## Empty State (no data / API error)
- Icon: `<AlertTriangle>` 48px muted amber
- Headline: "Risk profile unavailable"
- Subtext: show the error message from state

## Sub-tabs (risk-details / ancestral-timeline / interventions / population-comparison / variant-browser)
- Follow MASTER §5.4 sub-tab styling
- All tabs must have `aria-selected` and keyboard arrow-key navigation

## Zero-value Risk Cards (0%)
- Do not show plain "0%" — style with muted text + "No data" label underneath
