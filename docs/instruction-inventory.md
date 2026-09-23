# Instruction Inventory

Catalog of all `Instructions*.md` documents in the repository (main tree;
worktree copies under `.kilo/worktrees/` are excluded as non-authoritative).
Date: 2026-09-24. Purpose: close-out step per `docs/Instructions_5.md` §4.

| Filename | Purpose | Phases covered | Completion status | New work defined? |
|---|---|---|---|---|
| `docs/Instructions.md` | Distilled **Agent Capability Router** implementation spec (advisory-only local router; separate from MutationMechanic design mission). Includes Phase A–D build order for the *router* workspace + a later hook-fix task appendix. | Router Phases A–D (and A–D only in that document’s numbering) | Spec only in this file (“nothing here has been built yet” at authoring); **not** the design-mission Phase H/I chain | Defines router implementation work, **not** post–Phase I design-mission work. Out of scope for next design phase unless explicitly authorized. |
| `docs/Instructions_1.md` | Full **design review** (21 sections) for the same Agent Capability Router; no code during design phase. Ends with recommended advisory-only Phase A decisions. | Router design (pre–Phase A) | Design-phase complete as a document; no phase-completion gates for MutationMechanic Phases A–J | No MutationMechanic post–Phase I work |
| `docs/Instructions_2.md` | **MutationMechanic → Variant-to-Intervention Design Platform** mandate: gap analysis then architecture (Design Studio, workflows, moonshot placeholders). Own numbering: **PHASE 1** Design Studio, **PHASE 2** Moonshot placeholders (“Do NOT fully implement”). | Product PHASE 1 / PHASE 2 (not letter Phase I) | PHASE 1 marked `COMPLETED` in-file (~L397); PHASE 2 is placeholder architecture by directive | **Defines PHASE 2 placeholder work** in *this document’s* numbering. Does **not** define letter “Phase J” or a successor to mission Phase I. Treat as separate product scope unless the human maps it to the next mission phase. |
| `docs/Instructions_3.md` | Directive to execute **Phase I** (Playwright E2E: project → run → candidates → analytics → ledger) + acceptance criteria; records Phase H accepted. | Mission **Phase H** (accepted) + **Phase I** (directive) | Phase H complete; Phase I complete | **No** work after Phase I |
| `docs/Instructions_4.md` | Phase I runtime evidence conclusion + “proceed with real Phase I path” + gate/docs finish list. | Mission **Phase I** only | All directives satisfied | **No** work after Phase I |
| `docs/Instructions_5.md` | Formal Phase I acceptance + close-out checklist (hygiene, docs, lessons, handoff, next-phase extract rules). Current text also states mission is blocked without an authoritative post–Phase I spec. | Mission **Phase I** close-out | Close-out in progress / complete for hygiene+docs+handoff; next-phase extract **blocked** | Defines **process** (inventory, mission status, stop coding), not a next feature phase |
| `docs/Instructions_6.md` | — | — | **Does not exist** | — |
| Other `Instructions_*.md` | None found in main tree | — | — | — |

## Confirmation: work after mission Phase I?

| Source | Defines post–Phase I (letter) work? |
|---|---|
| `Instructions_3.md` | No |
| `Instructions_4.md` | No |
| `Instructions_5.md` | No — only close-out + “do not infer Phase J” |
| `Instructions_6.md` | Missing |
| `Instructions.md` / `Instructions_1.md` | No (different product: capability router) |
| `Instructions_2.md` | Only its own **PHASE 2** moonshot placeholders — **not** an authoritative letter-phase successor |

**Conclusion:** No `Instructions_*.md` defines authoritative **letter** Phase
successor work after mission Phase I. Implementation of a next letter phase
must not begin.
