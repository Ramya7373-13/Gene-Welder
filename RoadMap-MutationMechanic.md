# RoadMap — MutationMechanic

**Date:** 2026-09-04 · **Supersedes:** RoadMap-MutationMechanic.md (2026-09-03)
**Bench:** Kilocode (implementation, in `E:\MutationMechanic`) · Grok 4.6 (escalation) · ContentAgent = Sanity oracle, consulted only when coders are stuck on content modeling · Claude (architect + PR review)
**Not to be committed to any repository.**

**Context:** The flagship and convention source. Shipped and clean as of 2026-09-02 (PRs #1/#4/#5 merged, issues #2/#3 closed, `main` at `c246b91`, 82 backend + 32 frontend tests). Stack: React/Vite frontend, Express + Prisma/PostgreSQL backend, dual-engine AI (Gemini + Grok consensus), AlphaFold/AlphaMissense/AlphaGenome, DNA Archive Lab. 24 Prisma models.

**Load-bearing safety properties — preserve in EVERY refactor:**
1. Fail-closed AI routes (unreachable engine → error, never fabricated clinical content)
2. Shape-checked Grok/consensus responses (schema-validated before UI)
3. Provenance on every AI result (`source: API|CACHE|SIMULATION`, model + version)

**Decisions locked:**
- **Neon** for production Postgres (own auth + quota = one SQL query; Supabase's Auth/RLS unneeded)
- Stays **React + Vite** (tool app, not a content site) — Sanity is client-side GROQ, marketing/metadata only
- **Auth = magic-link (Resend) + HttpOnly session cookie.** Free plan: **2 uses per feature, lifetime**; one "Pro" tier via Stripe = unlimited
- Sanity authored by **Kilocode** per this roadmap; **ContentAgent reviews schemas** when asked (oracle mode)

---

## Phase M0 — Deploy prep (branch `feat/m0-deploy-prep`) — **PR #6 OPEN, under review**

- [ ] `GET /health` in `backend/src/server.ts` → `{ status, uptime, db: "up"|"down" }` (Prisma ping) + test
- [ ] `prisma migrate deploy` verified against a local scratch DB (never the dev DB)
- [ ] `.env.example` complete for production (DATABASE_URL, AI keys, CORS origin, session secret placeholder) — no real values
- [ ] **Human owns:** Neon account, Resend + Stripe keys, actual deploy

**Done when:** PR #6 merged with test evidence; repo deploy-ready; suite counts grew.

## Phase M1 — Auth + monetization (branch `feat/m1-auth-paywall`) — **PR #7 OPEN, under review**

- [ ] Magic-link auth: `POST /api/auth/request-link` (single-use token, short TTL, stored **hashed**, rate-limited) → `GET /api/auth/verify` → HttpOnly Secure SameSite session cookie; logout endpoint; header Login/Logout + `useUser()`
- [ ] Ownership migration: `userId` from session, never request body; every analysis/splicing/DNA-Lab query filters by session user; one-time anonymous→account claim flow that **cannot let user A claim user B's records**
- [ ] `usage_events` metering (user_id, feature, created_at; index user+feature+created_at): server-side quota check **before** the AI call, free = 2 uses/feature, exhausted → HTTP 402 + paywall payload. Metered: variant analysis, splicing decode, DNA Lab experiment, compensatory design
- [ ] Stripe: `subscriptions` table (plan `free|pro`, `stripe_subscription_id` UNIQUE, status, period end) + `users.plan`; Checkout route; webhook with **raw/unparsed body** for signature verification
- [ ] Paywall UI: remaining-uses badge, exhausted → subscribe CTA → Checkout → plan refresh
- [ ] **Required tests:** magic-link lifecycle (incl. expired/reused token rejection), cross-user ownership denial, quota 402 on 3rd free call + pro pass, webhook signature accept/reject, health endpoint
- [ ] **Rule:** auth/metering wraps the AI routes — never relaxes fail-closed or shape-checking

**Done when:** fresh user signs up, runs 2 free analyses, paywalled on 3rd, subscribes in Stripe test mode, runs unlimited — all evidenced with curl + psql + test output. **If the diff is very large, split into stacked PRs:** (a) auth+sessions+ownership, (b) metering+quota, (c) Stripe+paywall.

## Phase M2 — Product growth (weeks 5–12)

- [ ] DNA Archive Lab Phase 2: learning-codec improvements (`learningCodec.ts` scaffold exists), richer error profiles, comparative decode-run analytics
- [ ] Splicing Decoder regression test (from issue #3's close note)
- [ ] Collaboration UI over the existing `SharedAccess` + `Comment` models
- [ ] AI cost observability dashboard over `predictions` (cost_usd, execution_time, model breakdown)
- [ ] Grok API rules (apply to all refactors): server-side only, one `services/xaiClient.ts` wrapper, every call logged to `predictions`, fail-closed + shape-checked, rate-limited routes

## Phase M3 — Sanity CMS (branch `feat/m3-sanity`) — after M1

- [ ] New Sanity project (human creates, or ContentAgent); `VITE_SANITY_PROJECT_ID` / `VITE_SANITY_DATASET` in `.env` (public by design)
- [ ] `lib/sanityClient.ts` — ONE client + `urlFor()`, used everywhere (avoid Sampada's client split)
- [ ] Co-located Studio `sanity_mutation/` (own package.json, mirrors Sampada's `sanity_abscommerce/`; reference clone at `E:/analysis/Sampada-Store`)
- [ ] SchemaTypes (Kilocode authors; ContentAgent reviews): `landingPage`, `module` (6 tool modules), `announcement`, `testimonial`, `changelog`, `pricingPage` (Pro/2-free-uses paywall copy)
- [ ] `constants.ts` audit (47 KB): marketing copy/labels → Sanity; scientific/computational constants stay in code; code-side fallback so marketing degrades gracefully if Sanity is down (fail-open for cosmetic content, unlike fail-closed AI routes)
- [ ] No webhooks (Vite, client refresh acceptable for this content class)

## 30/60/90 exit criteria

| Window | Exit |
|---|---|
| 30 | M0 merged; Neon deploy live; health monitoring |
| 60 | M1 merged: login/logout, 2-use quota enforced, Stripe paywall working |
| 90 | DNA Archive Lab Phase 2 or collaboration UI live; M3 Sanity serving landing/modules |

## Working rules

Branch per phase off `main` (stack if overlapping) · one focused PR per phase · real test/curl output as evidence in every PR body · no self-merge — Claude reviews · **merge order: M0 → M1 (rebased) → M3** · report deviations, don't improvise.
