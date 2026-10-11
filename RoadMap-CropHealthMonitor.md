# RoadMap — CropHealthMonitor

**Date:** 2026-09-04 · **Supersedes:** RoadMap-CropHealthMonitor.md (2026-09-03)
**Bench:** Opencode (implementation, in `E:\CropHealthMonitor`) · Grok 4.6 (escalation) · ContentAgent = Sanity oracle, reviews schemas when asked · Claude (architect + PR review)
**Not to be committed to any repository.**

**Context:** Vite 6 + React 18 agri-intel platform (NDVI/soil/weather dashboards, civic pulse, AI-assisted reports) on Vercel. CI exists (unit tests + tsc). **No database** — farm reports in localStorage, civic reports in a JSON file that vanishes on serverless. Gemini/xAI/Firecrawl/Mapbox/Perplexity keys are inlined into the client bundle via `vite.config.ts` `define` (lines 85–106). Keys are bundled and in git history — **rotation deferred** (private repo), mandatory before any public exposure or shared preview URL.

**Conventions (from MutationMechanic):** Prisma + PostgreSQL, cuid text PKs, `@@map` snake_case, `onDelete: Cascade`/`SetNull`, JSONB payloads, `media_files` (sha256 + size + object-storage key), `model_registry` + `predictions` for every paid AI call, `audit_logs`.

**Decisions locked:**
- **Neon** for Postgres (same as MM)
- Stays **React + Vite for 90 days** (Next.js = day-90 decision gate, only if EarthBrief SEO/ISR becomes a real need — design `earthbrief.ts` migration-compatible)
- **Auth = magic-link (Resend) + HttpOnly session cookie** (mirrors MM M1 — same table shapes); free = **2 uses per feature, lifetime**; one "Pro" Stripe tier = unlimited
- Sanity authored by **Opencode** per this roadmap; ContentAgent = oracle/reviewer
- Grok API key: server-side only (lands *after* A0 removes the `define` leak — that's the prerequisite), one shared client wrapper, `predictions` cost logging, fail-closed, rate-limited

---

## Phase A0 — Security & secrets (branch `fix/a0-secrets`) — **assigned to Opencode**

- [ ] Delete the `define` block `vite.config.ts:85-106`; keys server-only via `/api/*` handlers (existing OpenWeather/FIRMS proxy pattern)
- [ ] Move `services/climateService.ts` + `services/farmImageService.ts` browser Bearer calls behind `/api` proxies
- [ ] Auth-gate + rate-limit `/api/analyze.ts`; drop client-supplied `prompt`/`schema`
- [ ] `/api/firecrawl-analysis.ts` SSRF: host allowlist or disable
- [ ] CDN Tailwind → build-time CSS pipeline

**Done when:** `npm run build` + `grep -r "VITE_GEMINI\|VITE_XAI\|VITE_FIRECRAWL\|VITE_MAPBOX\|VITE_PERPLEXITY" dist/` finds nothing; AI features work in dev; unit tests + tsc green.

## Phase A1 — Durable data (branch `feat/a1-prisma-schema`)

- [ ] Prisma schema: `farms` (JSONB `boundary_geojson`), `farm_analyses` (payload JSONB + `source`), `civic_reports` (status/category CHECKs), `weather_snapshots`, `disaster_events`, `media_files`, `model_registry`, `predictions`, `audit_logs` — reference DDL: `E:/analysis/project-analysis-shared.md` §9.2. **Add `usage_events` + `subscriptions` tables now (A2 needs them).**
- [ ] `server/civic/reportsStore.ts` JSON file → Postgres (file is ephemeral on Vercel)
- [ ] Feature-flag dual-write: localStorage stays as offline fallback one release; Postgres canonical
- [ ] Object storage bucket `crophealth-media` (or R2) for NDVI images / report PDFs
- [ ] Empty DB `crophealth`; first migration; seed from Grok §9.3

**Done when:** civic report POST survives a restart, queryable via `psql`; farm analysis round-trips to SQL.

## Phase A2 — Accounts + paywall (branch `feat/a2-auth-paywall`)

- [ ] Magic-link auth (Resend) — mirrors MM M1 exactly (same endpoints, same cookie rules, same `useUser()`); anonymous farms get a one-time claim flow on first login (claim must not cross users)
- [ ] `usage_events` metering, free = 2 uses/feature: **farm health analysis, climate sitrep, civic report submission, Grok Imagine image generation**. Server-side check before the paid call → HTTP 402 + paywall payload
- [ ] Stripe: `subscriptions` + `users.plan`; Checkout route; webhook (raw body!) flipping the plan; one Pro tier
- [ ] Paywall UI: remaining-uses badge, exhausted → subscribe CTA
- [ ] Required tests: auth lifecycle, cross-user denial, quota 402, webhook signature

**Done when:** fresh user signs up, 2 free uses, paywalled on 3rd, subscribes (Stripe test mode), unlimited — evidenced with curl + psql + test output.

## Phase A3 — Sanity CMS (branch `feat/a3-sanity`) — after A2

- [ ] Sanity project + `VITE_SANITY_PROJECT_ID` / `VITE_SANITY_DATASET=production`
- [ ] `lib/sanityClient.ts` — ONE client + `urlFor()` (avoid Sampada's client split from day one)
- [ ] Co-located Studio `sanity_crophealth/` (own package.json, mirrors Sampada's `sanity_abscommerce/`; reference clone at `E:/analysis/Sampada-Store`)
- [ ] SchemaTypes (Opencode authors; ContentAgent reviews): `farm`, `crop`, `region`, `alert`, `earthbrief` (Next.js-compatible), `paywallCopy`. Shapes documented below
- [ ] One-time migration script: `mockData/*.json` + `data/sampleFarmData.ts` demo content → Sanity via Mutations API. **`data/` civic datasets (Yale EPI, ISFR, officials, GBIF) stay as versioned JSON — reference data, not editorial content.** Normalize the dashboard JSON's snake_case duplicates to camelCase
- [ ] Swap `ActiveRegionContext.tsx` / `ActiveSiteContext.tsx` to Sanity fetches; EarthBrief feed → Sanity posts
- [ ] No webhooks in this phase (Vite has no signed-endpoint surface; free plan = 2 webhooks anyway)
- [ ] Shared PortableText renderer — copy Sampada's `components/PortableTextComponents.jsx` pattern

**Data shapes (from the repo, for the schemas):**
- `FarmHealthAnalysis` (`data/sampleFarmData.ts`): `farmName`, `location{name,coordinates{lat,lon}}`, `cropType`, `areaHa`, `healthScore` 0–100, `healthLabel`, `primaryDiagnosis`, `confidenceScore`, `timeToAction`, `yieldRisk`, `executiveSummary`, `ndviMetrics{min,max,mean,stressZones{critical,moderate,healthy}}`, `images{ndviMap,deficiencyOverlay}` (URLs), `soilMetrics{pH,nitrogen,phosphorus,potassium,moisture,organicMatter}`, `weatherMetrics{temperature,humidity,windSpeed,precipitation}`, `impactAssessment`, `reportId`, `version`, `generatedAt`
- Dashboard (`mockData/healthDashboard.json`, +climate/risk variants): `healthScore`, `confidence`, `primaryDiagnosis`, `affectedArea`, `detailedExplanation`, `interventions[{title,goal,impact,confidence,materials[]}]`, `monitoringPlan`, `ndviMetrics`, `soilMetrics`, `weatherMetrics` — has snake_case/camelCase duplicates; normalize

## 30/60/90 exit criteria

| Window | Exit |
|---|---|
| 30 | A0 merged (no secrets in bundle); A1 merged (Prisma + civic reports in Postgres) |
| 60 | Farm analyses + media durable; Playwright in CI; dual-write on; A2 paywall live |
| 90 | Login/logout + 2-use quota + Stripe paywall live; BrowserRouter; gods-eye-view MIT modules copied (with notices) · **Next.js decision gate** |
| 90+ (A3) | Sanity wired (farms/crops/regions/EarthBrief/paywall copy); mockData migrated |

## gods-eye-view reuse (MIT — keep copyright notices)

Copy `src/annotations/annotationGeoJson.js` (farm boundary marks → `farms.boundary_geojson`) and `src/data/firmsCsv.js` (feeds existing FIRMS proxy). **Never copy** `public/models/*.glb` (CC BY 4.0) or datasets (CC BY-NC-SA / ODbL). worldmonitor is AGPL-3.0 — hosted API only, never vendor source.

## Working rules

Branch per phase off `main` · one focused PR per phase · real command output as evidence in the PR body · no self-merge — Claude reviews · report deviations, don't improvise · never point at MutationMechanic's database.
