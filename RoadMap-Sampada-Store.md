# RoadMap — Sampada-Store

**Date:** 2026-09-04 · **Supersedes:** RoadMap-Sampada-Store.md (2026-09-03)
**Status:** ⏸ **ON HOLD** — work starts when MutationMechanic and CropHealthMonitor are in sync (their security + DB + auth/paywall phases landed). Nothing below is assigned yet.

**Bench (when active):** Kilocode or Opencode (implementation) · Grok 4.6 (escalation) · ContentAgent = Sanity oracle + ongoing content ops (it already runs the store's content) · Claude (architect + PR review)
**Not to be committed to any repository.**

**Context:** Next.js + Sanity commerce app (Stripe, Razorpay, PayPal, Printify, NextAuth, admin JWT). Intends Cloud SQL Postgres but **ships no `schema.prisma`** — `lib/db.js` imports `PrismaClient` with no prisma dependency at root (only the nested `abscommerce/` duplicate has one). **No CI.** Several auth/authorization blockers. Orders live in Sanity, not SQL. **Sanity is the proven, permanent catalog CMS — confirmed by the user; it has earned its place. The SQL workstream takes orders/payments/users, never the product catalog.**

**Conventions (from MutationMechanic):** Prisma + PostgreSQL, cuid text PKs, `@@map` snake_case, `onDelete: Cascade`/`SetNull`, JSONB payloads, `media_files` (sha256 + size + `gcs_key`), `audit_logs`, `model_registry` + `predictions`. Same auth/paywall model as the other two: magic-link or NextAuth session, free = 2 uses per feature, Stripe "Pro" tier.

**Decisions locked:**
- Sanity stays the catalog CMS (source of truth for products); SQL takes orders/payments/users
- Free plan: 2 uses per feature — metered AI features: **try-on, visual search, style assistant, AI product mockups** (guest checkout stays unmetered)
- Payment: reuse the existing Stripe integration; same `subscriptions`/`usage_events` table shapes as MM/CropHealth
- Grok API key: server-side only, one `lib/xai.js` wrapper, `predictions` cost logging, fail-closed + shape-checked, rate-limited — applies to `pages/api/ai.ts` + `generate-image.js` once gated

---

## Phase B0 — Security blockers (week 1, when unpaused) ⚠️ everything else waits

- [ ] Rotate admin password + `JWT_SECRET` (deferred while private — mandatory before any public exposure; hardcoded values are in git history)
- [ ] Delete hardcoded bcrypt hash + fallback secret in `pages/api/verify-admin.ts` (line 47) and the *different* `'change-this-secret'` fallback in `middleware.ts`. One secret, env-only
- [ ] Fix JWT library mismatch: signed with `jsonwebtoken`, verified with `next-auth/jwt` — pick one
- [ ] Auth-gate write APIs: `pages/api/sanity/write.js`, `publish-drafts.js`, `printify/create-order.js`, `ai.ts`, `generate-image.js` (CORS `*` today). Middleware gates `/admin` pages only, not APIs
- [ ] Stripe webhook raw body: `export const config = { api: { bodyParser: false } }` + buffer
- [ ] Implement the missing Razorpay webhook route (documented but absent from `pages/api/webhooks/`)
- [ ] Server-side cart totals (`pages/api/stripe.js` trusts `req.body.totalPrice`)
- [ ] Fix `pages/api/creative/save-image.js` SSRF
- [ ] `.env.example` → empty placeholders (currently carries live-looking `NEXTAUTH_SECRET`, Stability keys, Cloud SQL IP, GCS bucket, Stripe account id)
- [ ] Clean `docs/API_KEYS_REFERENCE.md` (placeholder keys, but remove real Printify shop ID `25358004`)

**Done when:** every write API 401/403s without an admin token; Stripe test webhook verifies; admin login works env-only; curl evidence in the PR.

## Phase B1 — The database that doesn't exist (weeks 2–4)

- [ ] Commit `prisma/schema.prisma` at root + prisma deps in root `package.json`; reverse-engineer from Sanity order/user documents; reference DDL: `E:/analysis/project-analysis-shared.md` §9.4 (`users` with NextAuth `provider`+`provider_account_id`, `orders`, `order_items` with `sanity_product_id`, `payments` UNIQUE(provider, provider_ref), `carts`, `reviews`, `support_tickets`, `media_files`, `model_registry`, `predictions`, `audit_logs`, **+ `usage_events` + `subscriptions` for B2**)
- [ ] Empty DB `sampada`; first migration; seed from Grok §9.5
- [ ] Dual-write orders/payments from gateway webhooks → Postgres; Sanity stays catalog source of truth
- [ ] `audit_logs` on admin actions

**Done when:** a test order appears in `orders` + `order_items` + `payments` and survives a restart.

## Phase B2 — Subscriptions, consolidate, scale (weeks 5–9)

- [ ] Surface clean Login/Logout on the storefront; `/api/*` reads the NextAuth session (not client-sent user ids)
- [ ] `usage_events` metering (free = 2 uses on the AI features listed above); HTTP 402 + paywall payload; remaining-uses badge
- [ ] `subscriptions` table + `users.plan`; reuse existing Stripe; model shopper AI quota and designer tiers on the same table
- [ ] **Sanity client cleanup:** merge `lib/client.js` / `lib/sanity.js` into ONE client + one `urlFor()`
- [ ] Keep the consolidated signed webhook (`pages/api/webhooks/sanity.js`)
- [ ] Collapse duplicate `abscommerce/` tree into root after diffing
- [ ] GitHub Actions: lint + jest + `prisma validate`; reverse `typescript.ignoreBuildErrors: true`
- [ ] Real admin analytics; coupons from DB
- [ ] Fix `lib/markdown.js` `sanitize: false` → `dangerouslySetInnerHTML` (DOMPurify already a dep)
- [ ] Queue Printify fulfillment (BullMQ + Redis) only when webhook timeouts bite
- [ ] Purge PII/junk from git: `images/Binod_Resume.doc`, `terminals/*.txt`, `tmp/`, `hoppscotch/`, `onyx/`, `notebooklm-py/`, `--.babelrc`
- [ ] NextAuth fails soft when OAuth env missing in dev
- [ ] Later: `products`/`product_variants`/`inventory_transactions` SQL catalog — only after dual-write proves out

## 30/60/90 exit criteria (from unpause date)

| Window | Exit |
|---|---|
| 30 | All write APIs auth-gated; webhooks verify; Prisma schema merged; CI exists |
| 60 | Orders/payments dual-written to SQL; admin audit log; `abscommerce/` collapsed |
| 90 | Login unified on NextAuth session; 2-use AI quota + Stripe paywall live; real admin analytics; repo purged |

## Working rules

Branch per phase off `main` · one focused PR per phase · real curl/test output as evidence · no self-merge — Claude reviews · never point at MutationMechanic's database · worldmonitor is AGPL-3.0 — read-only reference only.
