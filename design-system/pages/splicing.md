# Splicing Decoder Page — Design Overrides
> Inherits from MASTER.md.

## Input Form
- Gene input + Variant input: follow MASTER §5.5 input styling
- Example buttons: chip style from MASTER §5.2

## Empty State (no analysis run yet)
- Icon: `<GitMerge>` 48px muted
- Headline: "No splicing analysis yet"
- Subtext: "Enter a gene symbol and variant notation above, then click Analyze."
- Must be consistent with Analytics "No matching records found" pattern

## History Panel Empty State
- Icon: `<History>` 40px muted
- Headline: "No recent analyses"
- Subtext: "Previous analyses will appear here."

## Risk Badges
- HIGH: red bg-opacity-20 border-red, MEDIUM: amber, LOW: green (already correct — maintain)
