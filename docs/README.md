# MutationMechanic

AI-assisted genomics analysis workbench: pathogenicity interpretation, structural impact, and splicing defect analysis.

> **Research Use Only.** Outputs are not for clinical, diagnostic, or laboratory decision-making.

## Features

- **Variant Explainer** — AlphaFold/ESMFold structures with per-residue confidence (pLDDT) heatmaps; wild-type vs mutant side-by-side.
- **Compensatory Design** — AI-suggested stabilizing mutations to rescue protein function.
- **Splicing Decoder** — exon skipping and cryptic splice-site prediction (AlphaGenome / SpliceAI), with MedGemma clinical interpretation.
- **DNA Archive Lab** — in-silico DNA data-storage simulator: encode files into synthetic strands, apply deterministic channel-error models (substitution, insertion, deletion, dropout, duplication, coverage), decode and verify against the original checksum, export reproducible reports. See [`DNA_ARCHIVE_LAB.md`](DNA_ARCHIVE_LAB.md). *Simulation only.*
- **Disease Tracer / Longevity** — risk assessment, polygenic scores, and intervention tracking.
- **Interactive 3D viewer** — WebGL via `3Dmol.js`, with molecular surface and confidence coloring.
- **Dual-engine AI consensus** — Gemini + Grok cross-validation with provenance on every result.

## Repository layout

| Path | Contents |
|---|---|
| `/` | Vite + React 18 + TypeScript frontend |
| `backend/` | Express 5 + Prisma/PostgreSQL API |
| `backend/prisma/schema.prisma` | Authoritative Prisma schema |

Note: the empty `prisma/schema.prisma` at the repo root is not used — the real schema lives under `backend/`.

## Tech stack

- **Frontend:** React 18, TypeScript, Vite 6, Recharts, Lucide, Vitest + Testing Library
- **Backend:** Node, Express 5, Prisma 7, PostgreSQL (Neon in production)
- **AI:** Google GenAI (Gemini), xAI (Grok) consensus, MedGemma, ESMFold
- **Auth:** magic link (Resend) + HttpOnly session cookie; Stripe subscriptions

## Prerequisites

- Node.js 18+
- A PostgreSQL database (local, or Neon for production)

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # then fill in real values
npx prisma generate
npm run db:migrate        # local dev; use `npx prisma migrate deploy` in production
npm run dev               # http://localhost:5000
```

### 2. Frontend

```bash
npm install
cp .env.example .env
npm run dev               # http://localhost:3001
```

`VITE_BACKEND_URL` must point at the backend (default `http://localhost:5000`).

## Environment variables and secrets

**All API keys are server-side only.** The backend reads them from `backend/.env`; the browser never sees them.

- Never prefix a secret with `VITE_` — Vite inlines `VITE_*` values into the client bundle, which makes them public.
- The frontend `.env` carries one variable: `VITE_BACKEND_URL`.
- `backend/.env.example` lists every server-side key (Gemini, Grok/xAI, AlphaGenome, Resend, Stripe, `SESSION_SECRET`, `DATABASE_URL`).
- `SESSION_SECRET` must be a real random value in production; the server fails closed if it is missing.

## Scripts

| Location | Command | Purpose |
|---|---|---|
| root | `npm run dev` | Vite dev server on port 3001 |
| root | `npm run build` | Production build to `dist/` |
| root | `npm test` | Vitest suite (frontend) |
| backend | `npm run dev` | Express via tsx/nodemon on port 5000 |
| backend | `npm test` | Jest unit + integration suites (needs a reachable database) |

Note: `npm run build` does not typecheck. Run `npx tsc --noEmit` separately — the project currently reports type errors that the build will not surface.

## Safety properties

Preserve these in every refactor:

1. **Fail-closed AI routes** — an unreachable engine returns an error; it never fabricates clinical content.
2. **Shape-checked responses** — Grok and consensus payloads are schema-validated before reaching the UI.
3. **Provenance on every AI result** — `source: API | CACHE | SIMULATION`, plus model and version.

## Key components

- `components/VariantExplainerTab.tsx` — structural analysis dashboard
- `components/SplicingDecoder/SplicingDecoderTab.tsx` — splice junction visualization
- `components/ProteinStructureViewer.tsx` — 3Dmol.js wrapper
- `components/DnaArchiveLab/` — DNA storage simulator
- `components/Longevity/` — risk and intervention UI

## License

Research Use Only.
