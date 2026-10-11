# Future RoadMap — CropHealthMonitor · Sampada-Store · (MutationMechanic conventions)

**Date:** 2026-09-03
**Author:** Claude (GLM-5.3) — synthesis + independent verification of two prior reports
**Sources:**
- `project-analysis-shared.md` (Grok 4.6) — primary, detailed, verified
- `project-analysis-shared_comet.md` (Comet) — secondary, partially verified
- Direct inspection of the shallow clones in `E:/analysis` and MutationMechanic's `backend/prisma/schema.prisma`

**This file is not to be committed to any repository.**

---

## 1. Verification verdict — which report to trust

Every load-bearing claim was checked against the actual clones:

| Claim | Source | Verdict |
|---|---|---|
| CropHealth `vite.config.ts` inlines Gemini/xAI/Firecrawl/Mapbox/Perplexity keys via `define` | Grok | ✅ **CONFIRMED** — lines 85–106; the file even comments "NEVER add OPENWEATHER… keys here" while doing exactly that for the AI keys |
| Sampada `verify-admin.ts` has hardcoded JWT fallback secret | Grok | ✅ **CONFIRMED** — line 47: `'ebFXdBotIUWzmK9IFlc2GTfGY3iUAUbE05NPb1QIELk='` |
| worldmonitor is **AGPL-3.0** | Grok | ✅ **CONFIRMED** — LICENSE preamble |
| automaton is **MIT** | Grok | ✅ **CONFIRMED** — LICENSE file |
| gods-eye-view is **MIT** (code) | Grok | ✅ **CONFIRMED** — LICENSE file |
| `docs/API_KEYS_REFERENCE.md` contains exposed API keys (BLOCKING) | Comet | ⚠️ **OVERSTATED** — file exists but uses placeholders (`YOUR_GOOGLE_API_KEY_HERE`); only real disclosure is Printify shop ID `25358004`. Not a key leak; still worth cleaning |
| worldmonitor / automaton "not accessible" | Comet | ❌ Wrong — both cloned fine; Grok analyzed them |
| PostGIS `GEOGRAPHY(POLYGON)` columns, `sensor_readings` table, UUID PKs | Comet | ⚠️ **Not grounded** — CropHealth has no sensor hardware; NDVI/weather come from APIs. PostGIS is premature. Grok's schema (JSONB `boundary_geojson`, `farm_analyses`, `weather_snapshots`) matches the actual code |

**Conclusion:** treat **Grok's report as the source of truth**. Comet's report adds two usable ideas — the `updated_at` trigger function, and a proper product/variant/inventory table set for Sampada's *eventual* SQL catalog — but its schemas were designed against an imagined app, not the real one.

**Net-new finding from this review:** none of the reports' blockers change rank, but note that CropHealth's `vite.config.ts` also copies **all** `.env` values into `process.env` at config load (lines 9–11) — harmless for build but confirms every key must be rotated once the `define` block is removed, since all have been bundle-exposed.

---

## 2. Standing decisions (adopt once, apply everywhere)

1. **PostgreSQL only.** New DBs: `crophealth`, `sampada`. Never point either app at MutationMechanic's database.
2. **Prisma** as ORM in both apps (matches MutationMechanic). One migration history per app; never `prisma db push` outside local dev.
3. **Conventions (from MutationMechanic `schema.prisma`):** cuid text PKs, `@@map("snake_case")` table names, `onDelete: Cascade` for owned children / `SetNull` for optional provenance FKs, JSONB for evolving payloads, `media_files`-style rows (checksum SHA-256, byte size, object-storage key) instead of BYTEA.
4. **Bytes in object storage, metadata in Postgres.** Sampada already names a GCS bucket; CropHealth gets its own (`crophealth-media`). Cloudflare R2 is the no-egress-fee alternative.
5. **No message broker initially.** Add Redis + BullMQ (BSD-3) only when Printify fulfillment or NDVI batch jobs actually queue.
6. **Licensing rules:** never vendor worldmonitor source (AGPL-3.0 — would force both apps AGPL). Copy from gods-eye-view / automaton (MIT) only with copyright notice retained. gods-eye-view's 3D models are CC BY 4.0; its submarine-cable dataset is CC BY-NC-SA (non-commercial — do not ship).
7. **AI provenance everywhere:** every paid LLM/vision call writes `model_registry` + `predictions` rows (model, version, prompt, response, cost_usd, execution_time) — the MutationMechanic pattern, applied to both apps.

---

## 3. Workstream A — CropHealthMonitor (agri-intel platform)

### Phase A0 — Stop the bleeding (week 1)
- [ ] Delete the `define` block in `vite.config.ts:85-106`; all AI/provider keys become server-only, read from `process.env` inside `/api/*` handlers exactly like the existing OpenWeather/FIRMS proxies.
- [ ] Move `services/climateService.ts` and `services/farmImageService.ts` browser-side Bearer calls (Gemini, Grok Imagine) behind `/api` proxies.
- [ ] **Rotate every key that was ever `define`d or `VITE_`-prefixed** — they must be considered public.
- [ ] Auth-gate + rate-limit `/api/analyze.ts`; stop accepting client-supplied `prompt`/`schema` (prompt-injection + cost vector).
- [ ] Fix `/api/firecrawl-analysis.ts` SSRF: host allowlist or disable.
- [ ] Replace CDN Tailwind (`cdn.tailwindcss.com` in `index.html`) with a build-time CSS pipeline.

### Phase A1 — Durable data (weeks 2–3)
- [ ] Add `prisma/schema.prisma` (farms, farm_analyses, civic_reports, weather_snapshots, disaster_events, media_files, model_registry, predictions, audit_logs — Grok §9.2 DDL is the reference).
- [ ] Migrate `server/civic/reportsStore.ts` off the JSON file (ephemeral on Vercel serverless — reports currently vanish) to Postgres.
- [ ] Feature-flag dual-write: `services/storageService.ts` (localStorage) stays as offline cache; Postgres becomes canonical.
- [ ] Object storage for NDVI images / report PDFs.

### Phase A2 — Product depth (weeks 4–6)
- [ ] Accounts: start with anonymous `owner_token` (16h); upgrade to magic-link auth via Resend when multi-device matters (another 16h).
- [ ] HashRouter → BrowserRouter for shareable civic URLs (+ sitemap).
- [ ] Playwright smoke job in CI (`scripts/smoke-routes.mjs` exists); un-skip integration tests.
- [ ] Label simulated soil metrics as SIMULATION in the UI.
- [ ] Cap OpenAQ fan-out (5 pollutants × 4 pages today).
- [ ] Reuse from gods-eye-view (MIT, keep notices): `src/annotations/annotationGeoJson.js` for farm field boundary marks (store as FeatureCollection in `farms.boundary_geojson`), `src/data/firmsCsv.js` to feed the existing FIRMS proxy.
- [ ] Optional: consume worldmonitor as a **hosted API only** (AGPL doesn't reach independent HTTP clients; check their ToS first). Never vendor the source.

---

## 4. Workstream B — Sampada-Store (commerce platform)

### Phase B0 — Security blockers (week 1) ⚠️ everything else waits
- [ ] Rotate admin password + `JWT_SECRET`; delete the hardcoded bcrypt hash and both fallback secrets (`verify-admin.ts:47`, `middleware.ts`). One secret, env-only.
- [ ] Fix the JWT library mismatch: admin tokens are signed with `jsonwebtoken` but verified with `next-auth/jwt` — pick one.
- [ ] Auth-gate `/api/sanity/write`, `publish-drafts`, `printify/create-order`, `ai`, `generate-image` (CORS `*` today). Middleware currently gates `/admin` pages only, not APIs.
- [ ] Stripe webhook raw body: `export const config = { api: { bodyParser: false } }` + buffer, or signature verification 400s forever.
- [ ] Implement the missing Razorpay webhook route (documented in `.env.example` but absent from `pages/api/webhooks/`).
- [ ] Replace `.env.example` secrets with empty placeholders (it currently carries live-looking `NEXTAUTH_SECRET`, Stability keys, Cloud SQL IP, GCS bucket, Stripe account id — inventory for attackers).
- [ ] Server-side cart totals (Stripe handler trusts `req.body.totalPrice`).
- [ ] Fix `save-image.js` SSRF (fetches any https URL).

### Phase B1 — The database that doesn't exist (weeks 2–4)
- [ ] Commit `prisma/schema.prisma` — root app imports `PrismaClient` in `lib/db.js` but has **no prisma dependency and no schema**; only the nested `abscommerce/` copy has one. Reverse-engineer from Sanity order/user documents + Grok §9.4 DDL.
- [ ] Dual-write orders/payments from gateway webhooks into Postgres; Sanity remains the catalog CMS (`sanity_product_id` on order lines).
- [ ] `audit_logs` on all admin actions.

### Phase B2 — Consolidate and scale (weeks 5–8)
- [ ] Collapse the duplicate `abscommerce/` tree into root after diffing (drift risk today).
- [ ] GitHub Actions: lint + jest + `prisma validate` (none exists; `typescript.ignoreBuildErrors: true` currently ships type errors).
- [ ] Real admin analytics (current pages are placeholders); coupons from DB instead of the hardcoded checkout map.
- [ ] Queue Printify fulfillment (BullMQ + Redis) when webhook timeouts bite.
- [ ] Purge PII/junk from git: `images/Binod_Resume.doc`, `terminals/*.txt`, nested `tmp/`, `hoppscotch/`, `onyx/`, `notebooklm-py/`.
- [ ] Later (comet's useful idea): full `products`/`product_variants`/`inventory_transactions` SQL catalog with snapshot-at-order `order_items` — only after the dual-write proves out.

---

## 5. Consolidated 30/60/90

| Window | CropHealthMonitor | Sampada-Store | Shared | Exit criteria |
|---|---|---|---|---|
| **Days 0–30** | A0 security fixes + key rotation; Prisma schema; civic reports in Postgres | B0 security blockers; Prisma schema + first migration; CI exists | Empty DBs `crophealth`/`sampada` created; DDL applied | No secrets in bundles; no unauthenticated CMS writes; `psql \dt` shows both schemas; Sampada CI green |
| **Days 31–60** | Farm analyses + media in Postgres; feature-flag dual-write; Playwright in CI | Order/payment dual-write from webhooks; admin audit logs; `abscommerce/` collapsed | `model_registry`/`predictions` on every AI call; object storage live | A farm report and a paid order each survive a server restart and are queryable in SQL |
| **Days 61–90** | Accounts or owner tokens; BrowserRouter; optional Redis proxy cache | Sanity retired as order store; Printify queue; admin analytics real | gods-eye-view MIT modules copied with notices | Customer-visible persistence (saved farms / order history); roadmap items above closed |

**Effort sanity check** (one fluent dev): Grok's line-items total ≈ 190h ≈ 5 focused weeks — the 90-day window holds with buffer for the surprises these repos will produce.

---

## 6. Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Rotated keys break running deploys (old env still live) | High | Rotate in the same deploy that removes the `define` block; stage in preview first |
| Sampada JWT fix logs out existing admin sessions | Medium | Announce; re-issue cookie on next login — acceptable |
| AGPL contamination via "just copying one file" from worldmonitor | High | Rule: worldmonitor source is read-only reference. Automated license check (e.g. `license-checker`) in both CIs |
| Sanity ↔ SQL dual-write divergence | Medium | Webhooks are the single write path; Sanity docs become projections; nightly reconciliation query |
| CropHealth localStorage → SQL migration loses user data | Low | localStorage stays as read fallback for one release |
| gods-eye-view datasets with mixed licenses entering CropHealth | Medium | Copy code only (`annotationGeoJson.js`, `firmsCsv.js`); never copy `public/models/*.glb` (CC BY) or data files (CC BY-NC-SA / ODbL) without a license review |

---

## 7. Division of labor (the coder bench)

| Track | Suggested owner | Why |
|---|---|---|
| B0 security blockers (Sampada) | **Kilo / MiniMax M2.7** | Well-scoped mechanical fixes; exact files and lines already identified |
| A0 + A1 (CropHealth security + Prisma) | **Grok 4.6** or Opencode | Needs judgment about proxy patterns; schema design from the DDL |
| CI pipelines, license checks, repo cleanup | **Opencode** | Mechanical, parallelizable, low-risk |
| Verification & review of every PR | **Claude (this session)** | Independent eyes; already holds the verified claim base |
| Report maintenance | Any | Update this file as phases close; keep it out of git |

---

## 8. Immediate next actions (this week)

1. CropHealth PR: remove `define` secret block → proxy Gemini/xAI → rotate keys (`fix(security): stop shipping API keys in the client bundle`).
2. Sampada PR: rotate admin creds, single env `JWT_SECRET`, gate `/api/sanity/write` (`fix(security): remove hardcoded admin credentials, gate CMS writes`).
3. Sampada PR: Stripe webhook raw body + Razorpay webhook route.
4. Open issues per repo (titles in Grok §8) so the bench can pick from a queue.
5. `createdb crophealth && createdb sampada`; apply Grok §9 DDL or first Prisma migration.
6. Do **not** git-add this file or the two analysis reports.

---

*End of FutureRoadMap. Do not commit this file.*
