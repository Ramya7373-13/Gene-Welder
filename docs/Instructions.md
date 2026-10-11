# Agent Capability Router — Implementation Instructions

> Source: distilled from `docs/Instructions_1.md` (21-section design review).
> Status: implementation spec. Nothing here has been built yet. This phase makes **no** file/code/config changes.

---

## 1. What we're building

A **local, advisory-only capability router**. Given a task and an agent, it classifies the task, then recommends which **installed agent capability** (skill / plugin / MCP / utility / agent-host / overlay) is best suited — and, when warranted, raises a **confirmation gate**.

The router **never executes anything**. It recommends, explains, and warns.

It answers: *"For agent X, what is the safest and best way to attempt task T?"* — and stops there.

---

## 2. Non-negotiable invariants

```text
Recommendation is not execution.
Declared installation is not verified availability.
Tool availability is not agent compatibility.
Agent compatibility is not policy approval.
Policy approval is not user confirmation.
User confirmation is not implemented execution.
```

Never collapse these four availability dimensions into a single `available: true`:

1. **Declared capability** — what the registry says should exist.
2. **Agent compatibility** — whether the given agent can invoke/use it.
3. **Observed state** — what discovery/`doctor` can actually verify.
4. **Policy approval** — whether it is permitted for the task + sensitivity level.

The router must not pretend it can introspect every agent equally (Kilo 7.5.14, in particular, has **no verified lifecycle hooks** and is not an automatic Task Observer host).

---

## 3. Locked decisions (from the design review)

- **TypeScript**, Node.js built-ins (`fs/promises`, `path`, `crypto`), JSON Schema **draft 2020-12** validated with **`ajv`**.
- **Deterministic, explainable classifier** first — no LLM dependency. Optional future classifier behind an explicit *local-only* adapter.
- **No** shell execution, **no** dynamic code execution, **no** automatic config writes, **no** network calls during recommendation.
- Fail-closed for **critical or ambiguous** actions; ambiguous requests escalate to the higher sensitivity, never downgrade.
- Must run from Windows PowerShell, Git Bash, and WSL; normalize paths internally while preserving source-path metadata.
- Run `router recommend` as a **pure function** over (registry, agent data, policy, task text).
- Directory: `agent-capability-router/` (self-contained repo/workspace, not woven into this project).

**Target directory structure** (from §2):

```text
agent-capability-router/
├── capability-registry.json        # declared capabilities
├── capability-registry.schema.json
├── agent-capabilities.json         # per-agent host capabilities
├── task-taxonomy.json              # categories + sensitivity defaults
├── routing-policy.md
├── router.ts
├── package.json / tsconfig.json / README.md
├── adapters/                       # claude-code / grok-build / opencode / kilo.AGENTS.md
├── examples/                       # 12 example .json task+outcome fixtures
├── tests/                          # + tests/fixtures/
├── schemas/                        # recommendation / doctor-report / example schemas
└── docs/                           # threat-model.md, discovery-model.md, task-observer-integration.md
```

---

## 4. Core data model

### 4.1 Capability record (essential fields)

Each record carries: `id`, `display_name`, `type`, `description`, `category`, `status`, `status_reason`, `installed/enabled/configured`, `version`, `supported_agents`, `host_requirements`, `invocation`, `required_environment_variable_names` (names only), a boolean capability-flag block, `sensitivity`, `risk_tier`, `confirmation`, `allowed_task_categories` / `denied_task_categories`, `fallback_capabilities`, `provenance`, `notes`.

**Capability flags** — risk is **never** inferred from `write: true` alone; represent all of:

`read`, `write`, `execute`, `network`, `external_communication`, `privileged`, `may_process_secrets`, `irreversible`

### 4.2 Declaration vs verification (keep separate)

```json
{
  "installed": true, "enabled": true, "configured": true, "status": "active",
  "verification": { "state": "declared", "last_checked_at": null, "checks": [] }
}
```

Verification states: `verified | declared | unknown | failed | unsupported`.
`installed:true` + `verification.state:"unknown"` must **not** be described as verified.

### 4.3 Enums

- **type**: `skill | plugin | mcp | utility | agent-host | overlay`
- **status**: `active | manual | unsupported | missing | deferred | disabled | unknown`
- **risk_tier**: `low | medium | high | critical`
- **sensitivity**: `low | medium | high | critical`
- **agent compatibility**: `supported | unsupported | unknown | manual-only`

Status meaning: `active` usable under declared conditions · `manual` usable only by explicit action, no auto lifecycle · `unsupported` known blocker · `missing` expected but absent · `deferred` excluded pending audit/approval · `disabled` present but off · `unknown` insufficient evidence.

A capability is recommendable **only if all** hold:
`status usable` AND `agent compatibility is supported|manual-only` AND `runtime constraints pass` AND `task policy permits` AND `sensitivity policy permits`.

---

## 5. Schema validation rules (JSON Schema 2020-12)

- `additionalProperties: false` on every object, **including nested**.
- `uniqueItems: true` for ID arrays; enforce ID uniqueness in application code (JSON Schema can't by object property).
- Strict `enum`s for `type`, `risk_tier`, `status`, etc.
- **Safe/restrictive defaults**: capability flags default `false` and are `required` — reject missing fields rather than treating them as permissive.
- **High/critical risk ⇒ `confirmation.required` must be `true`** (schema `if/then` + app-level check).
- **status ∈ {manual, unsupported, missing, deferred} ⇒ non-empty `status_reason` required.**
- Environment fields are **names only**: pattern `^[A-Z][A-Z0-9_]*$`.
- **Secret-like value rejection** (app-level, beyond JSON Schema): reject `sk-…`, `ghp_…`, `github_pat_…`, `Bearer …`, `postgres://…`/`postgresql://…`, strings with `password=` or `token=`, private-key delimiters, long high-entropy values.
- **No executable commands stored**: `invocation.command` stays `null`; never construct/execute shell commands from registry data.
- Schema version pinned: `schema_version: "1.0.0"` (pattern `^1\.0\.0$`).

---

## 6. Risk tiers (policy defaults)

- **low** — read-only, local, non-sensitive (code understanding, static arch metadata, public lookup, doc review).
- **medium** — read-only over project content/local indexes/documents/browser-visible content (codebase indexing, PDF/DOCX conversion, local SAST, browser testing without login/submission, doc retrieval).
- **high** — secrets-adjacent / personal-memory / remote services / potentially sensitive (Supabase schema queries, Postgres access, browser sessions, Vercel info, Obsidian/personal memory, remote repo inspection).
- **critical** — irreversible, externally visible, privileged, state-changing (DB writes/migrations, prod deploy, git push/merge/branch delete, browser login/purchase/submit, credential access, file deletion, installs/config changes, external communication).

A read-only remote service can still be **high** sensitivity. A local scanner may spawn a fixed, read-only subprocess yet stay policy-approved.

---

## 7. Task classification (deterministic first pass)

### 7.1 Task-category model

Each category defines: `id`, `description`, `default_sensitivity`, `keywords`, `required_capability_traits`, `forbidden_capability_traits`, `confirmation_required`, `allowed_modes`, `fallback_categories`.

**Sensitivity defaults per category:** code-understanding **low** · code-search **low** · architecture-diagram **medium** · UI-review/UI-implementation **medium** · writing-review **low** · documentation-ingestion **medium** · document-conversion **high** · research **low** · security-scan **medium** · browser-testing **high** · browser-action **critical** · database-read **high** · database-write **critical** · deployment-read **high** · deployment-write **critical** · GitHub-read **medium** · GitHub-write **critical** · skill-management **critical** · knowledge-management **high** · memory-management **high** · incident-debugging **high** · project-planning **low**.

Agents may request a **stricter** sensitivity than inferred, never a lower one.

### 7.2 Stages

1. Normalize task text. 2. Detect action verbs. 3. Detect sensitive nouns / system names. 4. Detect target environment (local fs, browser, database, deployment, GitHub, external). 5. Detect reversibility (inspect/explain/review/generate/modify/delete/deploy/submit). 6. Assign categories. 7. Take highest sensitivity. 8. Require confirmation for critical classes. 9. Keep original task **only as opaque input metadata** — never executable config.

**Ambiguity:** "Update the database" → `database-write` (higher). "Inspect what a migration would do" → `database-read`/`incident-debugging` if no execution requested. Output the inferred classification + uncertainty.

---

## 8. Ranking algorithm

Order of preference (after filtering): (1) hard policy eligibility → (2) agent compatibility → (3) availability verification → (4) task-category match → (5) least privilege → (6) lowest sensitivity/risk compatible → (7) local over remote → (8) read-only over write-capable → (9) existing configured over manual fallback → (10) specific over generic → (11) explicit preference rules → (12) deterministic tie-break by capability ID.

**Hard filters (reject if any):** `status ∈ {missing, unsupported, deferred, disabled}` · agent doesn't support the invocation mechanism · task category denied · required runtime/OS constraint fails · risk above policy without confirmation · not configured for that agent · would require install or activation.

**Pseudocode:** filter candidates, sort by `[categoryMatch↓, exactCapability↓, leastPrivilege↓, localTransport↓, verification↓, risk↑, id↑]`; if empty → `noSafeCapabilityRecommendation`. Else pick `ranked[0]` preferred + safe fallbacks, compute confirmation, return `{ recommendation_id, mode:"advisory", agent, task_summary, classification, preferred, fallbacks, confirmation, execution_performed:false, explanation, warnings }`.

Recommendation IDs: **random/opaque** — must not encode task text, secrets, or paths.

---

## 9. Confirmation-gate model

Two separate concepts:
- **Advisory recommendation** — the router may say *"Recommended: mcp.supabase … Gate: explicit confirmation required."*
- **Execution authorization** — the router must not execute. A separate, future integration could consume an approved recommendation, but it must require explicit confirmation for critical actions.

Confirmation metadata includes: exact action class, target system, scope, expected side effects, reversibility, data sensitivity, capability, invoking agent, expiration/one-time-use semantics.

```json
{
  "required": true,
  "reason_codes": ["DATABASE_WRITE", "REMOTE_STATE_CHANGE"],
  "confirmation_scope": "single-recommendation",
  "confirmation_text": "Apply the requested migration to the configured Supabase project?",
  "execution_allowed": false
}
```

Even after confirmation, the router reports that an **external approved executor** would be required.

---

## 10. CLI contract

- `router validate` — registry/agent/taxonomy schema, duplicate IDs, secret-like values, cross-file refs, unsupported agents, missing fallback IDs, invalid status combos → `{command, valid, errors, warnings}`.
- `router list [--type] [--agent] [--status] [--category]`
- `router agent <agent-name>` — declared host capabilities + limitations. Kilo must show: *Lifecycle hooks: unsupported · Automatic Task Observer capture: unsupported · Manual skill use: supported · AGENTS.md: instruction-only*.
- `router capability <id>` — metadata, agent compatibility, verification state, sensitivity, fallbacks, confirmation, why it may/may not be recommended.
- `router recommend --agent <a> --task "<t>" --mode advisory` — **no** process spawn, **no** MCP invoke, **no** file mutation, **no** secret-value config reads; `--json` (default) or `--text`.
- `router explain --recommendation <id>` — if persisted, store only ID/timestamp/agent/classification/capability IDs/policy decisions/redacted explanation. **Do not store raw task text by default.**
- `router doctor` — read-only diagnostics (validity, cross-refs, agent-consistency, declared-vs-verified, OS constraints, Kilo hook limits, GSD exclusion, graphify-wrapper uncertainty, secret scan).
- `router dry-run` — run the example suite; report expected vs actual, whether a confirmation gate appeared, whether execution was attempted, whether unavailable caps were excluded.

---

## 11. Staged build order

### Phase A — Schema, registry, advisory CLI
Deliver: `capability-registry.schema.json`, `capability-registry.json`, `agent-capabilities.json`, `task-taxonomy.json`, `router.ts`, read-only CLI. **No** agent-config changes, MCP calls, subprocesses, or network. Validate schema, cross-refs, secret scan, deterministic recommendations, explicit unavailable messages.

### Phase B — Agent instruction adapters
Deliver adapters for **claude-code, grok-build, opencode**, and the **Kilo `AGENTS.md` managed block**. Constraints: generate **proposed diffs only**; never write/overwrite by default; preserve existing instructions; label Kilo support **manual**; don't claim Task Observer hooks.

### Phase C — Tests and dry-run validation
Deliver unit tests, cross-agent compatibility tests, sensitive-action tests, **no-execution** tests, dry-run example suite, CI command. Suggested (document only): `npm test`, `npm run validate`, `npm run dry-run`.

### Phase D — Optional approved configuration integration (separate, later)
Possible: read-only config discovery, proposed adapter diffs, human-approved config changes, explicit verification, version-drift detection. **Never** auto-install/activate/update/deploy/DB-write/browser-action. If config application is ever added: explicit command → dry-run diff first → user confirmation → backup/rollback → atomic write → secret-free audit record → clear target-agent scope.

---

## 12. Testing strategy (condensed)

**Unit:** schema/enum validation, status-reason requirements, secret-like rejection, agent compatibility, category matching, sensitivity escalation, fallback ordering, deterministic ranking.
**Security (assert):** `mcp.gsd` never recommendable · unverified `graphify.js` never shown enabled · Kilo never has automatic hooks · no env-var **values** in output · no raw task text interpreted as code · no subprocess APIs called · no fs writes during recommendation · no network calls during recommendation.
**Dry-run examples:** "Explain this codebase" (kilo) → codebase-memory/graphify, confirmation false · "Apply a DB migration" (kilo) → no executable recommendation, confirmation true · "Test this page without logging in" (opencode) → mcp.playwright, high-sensitivity warning · "Run a local security scan" (claude-code) → semgrep **only if** Claude Code compatibility explicitly verified, else no safe cap — never assume Claude Code can reach OpenCode/Kilo-configured MCPs.

---

## 13. Security abuse cases to guard (from §13)

1. **Prompt injection in task text** — treat as untrusted data; classify only; never parse/interpolate/execute; escape in reports.
2. **Injection from MCP/web content** — label external content untrusted; capability output must not modify routing policy or grant capabilities; re-enforce policy after classification; don't log raw MCP responses.
3. **False availability** — keep declared/verified/failed/unknown distinct; `doctor` required for verified; don't infer Kilo support from OpenCode config.
4. **GSD accidentally recommended** — `deferred`, empty `supported_agents`, empty allowed list, hard-coded deny test, doctor warning.
5. **Graphify wrapper falsely enabled** — separate skill record from wrapper; register `graphify.js` unknown/missing/unsupported until verified; test no unverified wrapper is recommended enabled.
6. **Secret leakage via env inspection** — read env **names** only; report `present|absent|not_checked`; never print values; redact path segments likely to carry usernames/secrets.
7. **Cross-agent capability confusion** — explicit per-capability `supported_agents` ∩ per-agent invocation mechanisms; no global "installed ⇒ usable."
8. **Router becoming an execution broker** — keep recommendation vs execution in separate modules; no executor deps in Phase A; tests mock process exec and fail if called.
9. **Unsafe generated config** — no config writes in Phases A–C; Phase D uses explicit diff generation + human approval; never generate secret values; never silently overwrite instruction files.

---

## 14. Boundary integrations (condensed)

- **Task Observer** = separate metadata overlay. Router may *read* accepted Task Observer metadata and report overlay status, but must **not** duplicate observation logic, consume raw payloads, generate proposals from backlog, modify entries, infer Kilo observations, or claim automatic capture where hooks are unverified.
- **Kilo (no lifecycle hooks)** = delimited managed block in `AGENTS.md` (BEGIN/END `MANAGED: agent-capability-router` markers). Manual instruction support only, never automatic interception. Adapter recommends `router recommend --agent kilo --task "<task>" --mode advisory` but states the user/agent must invoke it manually.
- **Agent adapters** (Phase B) carry: managed-block marker, invocation guidance, per-agent availability limits, security rules, "recommendation ≠ execution," and no claims beyond verified agent support.

---

## 15. Open questions — blocking start (from §21, requires your answers before coding)

1. TypeScript (recommended) or Python?
2. Exact Node.js runtime versions on Windows and WSL?
3. Repo on a Windows path, WSL filesystem path, or both?
4. `router recommend` pure/fs-read-only, or may it read agent config for verification?
5. Exact config locations/formats for Claude Code, Grok Build, OpenCode, and Kilo?
6. All listed MCPs configured for both OpenCode and Kilo, or verify each separately?
7. `codebase-memory-mcp` transport — stdio, local HTTP, or other?
8. Archify — write files, return artifacts, or both?
9. Treat MarkItDown output as a project-file write when an output path is given?
10. Playwright allowed for unauthenticated read-only testing w/o confirmation, or all browser access gated?
11. Remote public research MCPs allowed in low-sensitivity tasks by default?
12. Declared-but-unverified caps recommendable with a warning, or excluded until `doctor` verifies?
13. Read Task Observer metadata from its production registry during `doctor`, or static registry metadata initially?
14. Adapter files generated into existing instruction files, or standalone snippets for manual insertion?
15. Recommendation records persisted, or in-memory only?
16. Acceptable retention period for redacted recommendation metadata?
17. Omit sensitive task text from persisted output entirely, or store as one-way hash?
18. Which fallback utilities are actually installed (registry eligibility)?
19. Support multiple repos/workspace roots in one invocation?
20. Is a future approved executor in scope, or does the architecture stop permanently at advisory?

Answers to §21 open questions — grant full powers

1. TypeScript (preferred language).
2. Use exact Node.js runtime versions on both Windows and WSL — full verification allowed.
3. Repo may live on Windows path, WSL filesystem path, or both — support all.
4. `router recommend` may read agent config for verification, not just pure/fs-read-only.
5. Config locations/formats for Claude Code, Grok Build, OpenCode, and Kilo — all in scope, full verification.
6. All listed MCPs configured for both OpenCode and Kilo — verify each separately if needed.
7. `codebase-memory-mcp` transport — stdio, local HTTP, or other — all supported.
8. Archify — may write files, return artifacts, or both.
9. MarkItDown output — treat as project-file write when an output path is given.
10. Playwright — allowed for unauthenticated read-only testing without confirmation; all browser access gated otherwise.
11. Remote public research MCPs — allowed in low-sensitivity tasks by default.
12. Declared-but-unverified caps — recommendable with a warning; exclude only if `doctor` fails verification.
13. Task Observer metadata — read from production registry during `doctor`; static registry metadata acceptable initially.
14. Adapter files — may be generated into existing instruction files or standalone snippets for manual insertion.
15. Recommendation records — persisted, not in-memory only.
16. Retention period for redacted recommendation metadata — acceptable as long as needed for review cycles.
17. Sensitive task text in persisted output — omit entirely or store as one-way hash (both acceptable).
18. Fallback utilities — all installed are registry-eligible.
19. Multiple repos/workspace roots — supported in one invocation.
20. Future approved executor — in scope (architecture continues beyond advisory).


---

## 16. Validation / acceptance for this phase

Proceed with a strict **advisory-only Phase A**: TypeScript · JSON Schema 2020-12 · `ajv` · deterministic classification · explicit agent-compatibility records · **no** process execution, network calls, config writes, automatic Task Observer integration · **no** GSD MCP recommendation · **no** assumption `graphify.js` is available · **fail-closed** for critical/ambiguous actions.

Design-phase constraint honored: this spec and the source design review make **no** code, registry, config, or network changes.

---

# HOOK FIX TASK — coder agent, apply this

> Owner: this is the actionable repair. Everything above is the capability-router spec; this section is a separate environment fix requested 2026-09-07. Do NOT edit the system directly if the owner said to delegate — apply via your normal tooling, and confirm before and after.

## Problem
Every Claude Code **`gsd-*` hook** fails with:
```
/usr/bin/bash: -c: line 1: syntax error near unexpected token `&'
```
Cause: the hook `command` strings in the **global** settings file were written in **PowerShell syntax** (leading `&` call operator), but Claude Code executes hooks on this machine under **bash**, where a leading `&` means "background" → parse error. This blocks `Read`, `Bash`, `Write`, `Edit`, and `Stop` (and silently disables the gsd security guards: secret-read guard, write guard, context monitor, etc.).

## Files affected
Only one file:
- `C:\Users\Binod\.claude\settings.json` — 18 hook `command` values carry the bad prefix.

No project or `.claude/settings.local.json` files are affected (verified).

## The exact defect
In the raw JSON the stored command text is (note the double backslashes, as JSON escapes them):
```json
"command": "& 'C:\\Program Files\\Git\\bin\\bash.exe' 'C:/Users/Binod/.claude/hooks/gsd-node-runner.sh' 'C:/Program Files/nodejs/node.exe' 'C:/Users/Binod/.claude/hooks/gsd-<guard>.js'"
```
The shell-agnostic pattern that already works here is the `cbm-*` hooks, e.g.:
```
cmd.exe /d /v:off /s /c '""%USERPROFILE%\.claude\hooks\cbm-*.cmd""'
```

## Fix (mechanical, reversible)
Remove the leading **`& `** (ampersand + one space) from each of the 18 gsd `command` values, so each starts directly with the quoted exe:
- BEFORE: `& 'C:\\Program Files\\Git\\bin\\bash.exe' 'C:/Users/Binod/.claude/hooks/gsd-node-runner.sh' ...`
- AFTER:  `'C:\\Program Files\\Git\\bin\\bash.exe' 'C:/Users/Binod/.claude/hooks/gsd-node-runner.sh' ...`

This is valid bash and invokes the identical Git-bash → `gsd-node-runner.sh` → node → guard chain that was intended.

## Run this (PowerShell 5.1), which backs up then rewrites:
```powershell
$p = "C:\Users\Binod\.claude\settings.json"
Copy-Item -Path $p -Destination ("{0}.bak-hookfix-{1}" -f $p, (Get-Date -Format 'yyyyMMdd-HHmmss')) -Force
$t = [System.IO.File]::ReadAllText($p)
$old = "& 'C:\\Program Files\\Git\\bin\\bash.exe' "   # literal two-backslash form as stored in the JSON file
$new = "'C:\\Program Files\\Git\\bin\\bash.exe' "
$count = ([regex]::Matches($t, [regex]::Escape($old))).Count
if ($count -ne 18) { Write-Output "ABORT: expected 18 occurrences, found $count"; exit 1 }
$fixed = $t.Replace($old, $new)
[System.IO.File]::WriteAllText($p, $fixed, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "OK: replaced $count occurrences"
```

## Verify
1. Re-run the count: should now be **0** for the ampersand prefix.
2. The JSON must still parse: `Get-Content $p -Raw | ConvertFrom-Json` should not throw.
3. Then trigger any hook (e.g. a normal `Read`/`Bash`/`Write`) — it should run without the `syntax error near unexpected token '&'` message. If hooks still error after editing, restart the Claude Code session so it reloads `settings.json`.

## Rollback
If anything misbehaves, restore the newest backup created above (`settings.json.bak-hookfix-<timestamp>`) over `settings.json` and restart.