# Skill Inventory Report (Instructions_6 Stage 1)

Date: 2026-09-24  
Sources: `C:\Users\Binod\.claude\skills`, `C:\Users\Binod\.config\opencode\skills`, `C:\Users\Binod\.agents\skills` (~835 `SKILL.md` files; heavily overlapping gstack/GSD junctions).  
No implementation before this report (per Instructions_6).

## 1. Relevant skills (MutationMechanic: TS/React + Express/tsx + Prisma + Playwright)

| Name | Purpose | Strengths | Weaknesses | Recommended uses | Repo targets |
|---|---|---|---|---|---|
| **codebase-memory** | Knowledge-graph structural queries | Indexed; callers/impact; cheaper than grep | Coverage gaps; not string/secret search | Dead code, fan-out, blast radius | `backend/src`, proteinDesign, routes |
| **task-observer** | Session protocol + methodology capture | Required activation; obs 0024–0028 logged | Meta-skill; `last_review=never` | Process hygiene across stages | n/a |
| **agent-browser** | Low-cost browser CLI | Priority over Playwright MCP | Not the project E2E suite | Ad-hoc UI probes | Frontend / flows |
| **playwright-cli / -trace / -component-testing** | Drive/debug/isolate Playwright | Native to stack | Live under gstack node_modules | Flake RCA, component isolation | `e2e/`, components |
| **gstack-qa / qa-only / browse** | QA loop / report-only / headless | Health scores; ~100ms browse | Heavy full loop; separate from suite | E2E regression evidence | Frontend + e2e |
| **gstack-review / gsd-code-review** | Pre-landing / phase code review | Structural + security angles | Needs a diff | Gate before commits | Touched files |
| **gstack-cso / gsd-secure-phase** | Security audit / retro threats | OWASP/STRIDE; phase-aligned | Broad in daily mode | API/auth/Prisma hardening | `routes/*`, session, env |
| **investigate / gsd-debug** | Root-cause debug | Iron Law: no fix without RCA | Slow if cause known | Red gates / regressions | backend runtime |
| **gstack-health** | Composite quality dashboard | Wraps tsc/lint/tests | Needs tools wired | Before/after Stage 4 | root + backend |
| **supabase-postgres-best-practices** | Postgres/SQL guidance | Closest to Prisma SQL | Not Prisma-ORM native | Schema/index review | `prisma/`, hot queries |
| **careful / guard / freeze** | Destructive-cmd warnings; edit scope | Protects migrate/git | Interactive | Stage 4 safety | DB + git |
| **document-generate / document-release / writing-guidelines** | Docs generate / post-ship sync / prose | Diataxis; drift detect | Can over-produce | Contract + phase docs | `docs/` |
| **gsd-add-tests / gsd-validate-phase / gsd-audit-fix** | Fill test gaps; retro validation; find→fix→commit | Closes coverage holes | Needs scope discipline | Audit-driven repairs | tests + evidence files |
| **gsd-plan-phase / gstack-plan-eng-review / gsd-execute-phase** | Spec→plan→review→execute | Verification loops | GSD ceremony overhead | If Stage 3 picks an impl phase | `.planning/` + code |
| **gsd-ship / gstack-review** (adapted) | Tests→review→commit | Full ship path | Must obey explicit-path commit rules | Close-out | repo |
| **archify / diagram** | Architecture diagrams | Repo-aware / offline triple output | Heavier HTML | Stage 3 visual of seams | docs diagrams |
| **codebase-memory + gstack-cso + review** | Evidence triple for audits | Maps Stage 2 finding classes | Multi-tool | **Stage 2 pattern** | whole backend |
| **plan-ceo-review / plan-eng-review** | Scope / architecture challenge | Expand vs lock modes | Interactive | Stage 3 candidate challenge | plan text |
| **vercel-react-best-practices / composition-patterns** | React patterns | Official guidance | Next/RN adjacent | Optional FE polish | `components/` |
| **canary / setup-deploy / ship** | Post-deploy / deploy config / PR | Full land path | Needs deploy target | Only if deploying | CI/CD |

**No dedicated Prisma skill.** Nearest stack: `supabase-postgres-best-practices` + `codebase-memory` + `careful`/`guard`.

**Skip:** iOS suite, HN fixture, RN skills, gstack self-test fixtures, sherlock, benchmark-models (unless meta-benchmarking).

## 2. Categories map

| Category | Skills |
|---|---|
| Architecture | codebase-memory, gsd-map-codebase, archify, diagram, graphify, gstack-plan-eng-review, gstack-plan-ceo-review |
| Refactoring | codebase-memory, gsd-audit-fix, gstack-review, vercel-react-best-practices |
| Testing | gstack-qa, qa-only, browse, gsd-add-tests, gsd-validate-phase, gsd-audit-uat, gstack-health, playwright-* |
| Playwright | playwright-cli, playwright-trace, playwright-component-testing, agent-browser, setup-browser-cookies |
| Backend | gstack-plan-eng-review, investigate, gsd-debug, codebase-memory |
| API | plan-devex-review, gstack-review, gstack-cso, gsd-docs-update |
| Prisma | supabase-postgres-best-practices, careful/guard, codebase-memory |
| Documentation | document-generate, document-release, gsd-docs-update, writing-guidelines, gsd-extract-learnings |
| Performance | gstack-benchmark, vercel-optimize, supabase-postgres-best-practices |
| Security | gstack-cso, gsd-secure-phase, gstack-review, gsd-code-review, careful, guard |
| Reliability | investigate, gsd-debug, canary, freeze/guard, context-save/restore |
| Code Quality | gstack-health, review, gsd-code-review, gsd-audit-fix, codebase-memory, gsd-quick |
| UX/UI | design-review, gsd-ui-review, web-design-guidelines, plan-design-review, agent-browser |
| Observability | canary, playwright-trace, gsd-forensics, investigate |
| DevOps | gsd-ship, land-and-deploy, setup-deploy, deploy-to-vercel, canary |
| Research | agent-reach, scrape, gsd-map-codebase, graphify, memory, learn |
| Auditing | gstack-cso, gsd-audit-fix, gsd-audit-milestone, gsd-audit-uat, gsd-validate-phase, gsd-secure-phase, qa-only |

## 3. Best skill combinations

1. **Security/API hardening (audit → fix):** `codebase-memory` + `gstack-cso` (daily) + `gstack-review` + `gstack-health` + `careful`
2. **Testing/E2E expansion:** `agent-browser` → project Playwright + `playwright-trace` + `gsd-add-tests` / `gsd-validate-phase` + `gstack-qa`
3. **Backend/Prisma:** `codebase-memory` + `supabase-postgres-best-practices` + `guard` + `gstack-cso`
4. **Architecture + refactor:** `codebase-memory` / `gsd-map-codebase` + `archify` + `gstack-plan-eng-review` + `gsd-audit-fix`
5. **Plan → execute → ship:** `gsd-spec-phase` / `gsd-plan-phase` + `gstack-plan-eng-review` + `gsd-execute-phase` + adapted ship (explicit `git add` only)

## 4. Strongest skill stack for the next phase

**Primary:**

1. `codebase-memory` — structural queries  
2. `gstack-cso` (daily) + `gsd-secure-phase` — security findings  
3. `gstack-review` / `gsd-code-review` — diff quality  
4. `gstack-health` — gate baseline before/after  
5. `careful` / `guard` — protect migrations, git, mixed tree (obs 0028)  
6. `gstack-qa` / `agent-browser` / `playwright-trace` — if E2E affected  
7. `task-observer` — remain active  

**Conditional:** `supabase-postgres-best-practices` (schema), `gsd-add-tests` (coverage), `document-release` (close-out docs), `gsd-plan-phase` + `gstack-plan-eng-review` (if multi-file phase plan required).

**Skip for this mission:** iOS, RN, HN, gbrain, sherlock unless task demands.

---

Stage 1 complete — research only.
