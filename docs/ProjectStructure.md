# MutationMechanic - Project Structure

## Overview
MutationMechanic is a genomics analysis workbench that combines a Vite/React frontend with an Express/Prisma backend. The project supports variant explainer workflows, disease tracing, splicing assessment, DNA Archive Lab experiments, and analytics dashboards, while also integrating Gemini and Grok-backed AI validation.

This document reflects the current repository state as of 2026-09-22 and is intended to be a living map of the main application folders, domain modules, and operational entry points.

## Repository Layout

```text
mutationmechanic/
├── .agents/                                # Project agent metadata and generated scratch config
├── .claude/                                # Local Claude configuration
├── .config/                                # Local tool configuration / repo config files
├── .github/                                # GitHub workflows and automation
├── .grok/                                  # Grok-related runtime/config artifacts
├── .kilo/                                  # Kilo project metadata
├── .kiro/                                  # Kiro steering and workflow files
├── .mcp.json                               # MCP configuration
├── .opencode/                              # OpenCode project config
├── .playwright-mcp/                        # Browser automation config/fixtures
├── .superpowers-dna-archive-lab-backup/    # Backup copy of the DNA Archive Lab work
├── .workbuddy-ai/                          # Workbuddy AI artifacts
├── .env.example                            # Root environment template
├── .eslintrc.json                          # ESLint config
├── .gitignore                              # Root ignore rules
├── .stylelintrc.json                       # Stylelint config
├── .stylelintignore                        # Stylelint ignore patterns
├── AGENTS.md                               # Repo-level agent instructions
├── App.tsx                                 # Main React application shell
├── CLAUDE.md                               # Repo instructions for Claude
├── README.md                               # High-level project entry documentation
├── constants.ts                            # Core app constants and mappings
├── dist/                                   # Production Vite build output
├── dist-split/                             # Split build/chunk output
├── design-system/                           # Design-system definitions and page specs
│   ├── MASTER.md
│   └── pages/
│       ├── analytics.md
│       ├── design.md
│       ├── explainer.md
│       ├── splicing.md
│       └── tracer.md
├── docs/                                   # Operational docs and project notes
│   ├── ContentAgent.md
│   ├── DEV-WORKFLOW.md
│   ├── DNA_ARCHIVE_LAB.md
│   ├── Instructions.md
│   ├── Instructions_1.md
│   ├── Instructions_2.md
│   ├── ProjectStructure.md
│   ├── README.md
│   ├── Terrors.md
│   ├── clinical-workflow-evidence/
│   ├── data-integration-pattern.md
│   ├── diagnostics/
│   ├── dna-archive-lab-commit-and-fork-instructions.md
│   ├── dna-archive-lab-evidence/
│   ├── humanity-longevity.txt
│   ├── project-analysis-shared_comet.md
│   └── superpowers/
├── graphify-out/                           # Graphify knowledge graph output
│   ├── GRAPH_REPORT.md
│   ├── cache/
│   ├── graph.html
│   ├── graph.json
│   ├── manifest.json
│   └── 2026-09-06/
├── images/                                 # Static image assets
├── metadata.json                           # Project metadata
├── mutationmechanic.zip                    # Packaged project archive
├── node_modules/                           # Frontend dependencies
├── package-lock.json                       # Frontend lockfile
├── package.json                            # Vite/React app configuration
├── prisma/                                 # Root Prisma schema directory (legacy/adjacent tooling)
│   ├── schema.prisma
│   ├── seed-clinical.ts
│   ├── seed-mrn-variants.ts
│   ├── seed-patients.ts
│   └── seed.ts
├── routes/                                 # Root-level route definitions
│   └── splicing/
│       └── index.ts
├── services/                               # Frontend service clients
│   ├── alphaGenomeClient/
│   │   └── index.ts
│   ├── archive/
│   ├── alphafoldClient.ts
│   ├── backendService.ts
│   ├── configService.ts
│   ├── dnaArchiveLabService.ts
│   ├── dnaArchiveLabService.test.ts
│   ├── fusionAnalysisService.ts
│   ├── fusionMagicDemo.ts
│   ├── geminiService.ts
│   ├── genomicAnnotationService.ts
│   ├── grokService.ts
│   ├── historyService.ts
│   ├── medgemmaClient.ts
│   └── testFusionAnalysis.ts
├── src/                                    # Frontend app context / shared source area
│   ├── components/
│   └── contexts/
├── storage/                                # Local storage for PDB / uploaded artifacts
├── testAlphaFoldIntegration.ts             # AlphaFold integration test script
├── testFusionAnalysis.ts                   # Fusion analysis script
├── types/                                  # Shared TS types
│   ├── genomics.ts
│   ├── medgemma.ts
│   └── splicing/
│       └── index.ts
├── ui-ux-pro-max-skill/                    # Design system / skill bundle
├── utils/                                  # Frontend utility helpers
│   ├── alphafoldClient.ts
│   ├── cacheLayer.ts
│   ├── logger.ts
│   ├── presetStorage.ts
│   ├── storage.ts
│   ├── themeUtils.ts
│   ├── uniprot.ts
│   └── uniprot.test.ts
├── vite-env.d.ts                           # Vite env declarations
├── vite.config.ts                          # Vite config
├── vitest.setup.ts                         # Vitest setup hook
└── index.tsx                               # Frontend entrypoint

backend/
├── .env                                    # Backend environment configuration
├── .env.example                            # Backend env template
├── .gitignore                              # Backend ignore rules
├── README.md                               # Backend README
├── dist/                                   # Compiled backend output
├── jest.config.js                          # Jest config
├── node_modules/                           # Backend dependencies
├── nodemon.json                            # Dev watcher config
├── package-lock.json                       # Backend lockfile
├── package.json                            # Backend dependencies and scripts
├── prisma/                                 # Prisma schema + seed scripts
│   ├── migrations/
│   ├── schema.prisma
│   ├── seed-clinical.ts
│   ├── seed-mrn-variants.ts
│   ├── seed-patients.ts
│   └── seed.ts
├── prisma.config.ts                        # Prisma config
├── scripts/                                # Small operational helper scripts
├── seed_test.js                            # Seed test script
├── src/                                    # Backend source entry
│   ├── domain/                             # Domain logic
│   │   └── dnaStorage/
│   │       ├── analytics/
│   │       ├── codecs/
│   │       ├── decoder/
│   │       ├── errorSimulator/
│   │       ├── jobRunner/
│   │       ├── prng/
│   │       ├── reportGenerator/
│   │       └── types/
│   ├── index.ts                            # Server bootstrapping entry
│   ├── lib/                                # Shared backend library helpers
│   │   ├── clients.ts
│   │   ├── config.ts
│   │   ├── metering.ts
│   │   ├── rateLimit.ts
│   │   ├── request.ts
│   │   ├── session.ts
│   │   └── uploads.ts
│   ├── prisma.ts                           # Prisma client setup
│   ├── routes/                             # API routers
│   │   ├── ai.ts
│   │   ├── audit.ts
│   │   ├── auth.ts
│   │   ├── billing.ts
│   │   ├── clinical.ts
│   │   ├── collab.ts
│   │   ├── dnaStorage.ts
│   │   ├── genomics.ts
│   │   ├── predictions.ts
│   │   ├── records.ts
│   │   ├── structures.ts
│   │   └── variants.ts
│   ├── server.ts                           # Main Express server configuration
│   └── utils/                              # Common backend utilities
│       ├── logger.ts
│       ├── redactor.ts
│       └── ...
├── storage/                                # Uploaded file storage for backend features
├── tests/                                  # Backend tests
│   ├── integration/
│   └── unit/
├── tsconfig.json                           # Backend TypeScript config
├── update_meta.cjs                         # Metadata update helper
├── update_meta.ts                          # TypeScript metadata helper
└── test.pdb                                # Sample PDB file used in test flows
```

## Frontend structure and responsibilities

The UI is organized around a tab-based application shell in [App.tsx](../App.tsx). The current active interface includes six primary workstreams:

- Explainer: variant interpretation workflow
- Design: compensatory or engineered mutation design
- Tracer: disease-risk and pathway tracing
- Splicing: splice-site effect analysis
- Archive: DNA Archive Lab workflow
- Analytics: history, analysis dashboards, export, and review

Major frontend modules:

- `components/VariantExplainerTab.tsx` — primary gene/variant analysis surface
- `components/CompensatoryDesignTab.tsx` — design-oriented mutation engineering
- `components/DiseaseTracerTab.tsx` — phenotype and disease tracing
- `components/SplicingDecoder/` — splice-aware interpretation and visualizations
- `components/DnaArchiveLab/` — archive lab simulation and experiment flows
- `components/Analytics/` — analytics dashboard and history table
- `components/GrokConsensusCard.tsx` — Grok consensus validation display
- `components/ClinicalSummaryCard.tsx` — human-readable patient/variant summary
- `components/PrintableVariantReport.tsx` — clinical-style printable output
- `components/Header.tsx`, `Footer.tsx`, `Tabs.tsx` — shell navigation and layout

## Backend structure and responsibilities

The backend is bootstrapped in [backend/src/server.ts](../backend/src/server.ts), with route mounting split across dedicated feature modules in [backend/src/routes](../backend/src/routes).

Current route groups:

- `/api/auth` — authentication and session flows
- `/api/billing` — billing and metering related APIs
- `/api/clinical` — patient and clinical variant handling
- `/api/dna-storage` — DNA Archive Lab simulator endpoints
- `/api/genomics` — genomic lookup and evidence flows
- `/api/records` — record and history management
- `/api/predictions` — ML prediction logging and related outcomes
- `/api/structures` — PDB upload and storage
- `/api/variants` — variant ingestion and update APIs
- `/api/audit` — audit record endpoints
- `/api/ai` — AI analysis endpoints

The backend domain layer also includes a specialized DNA storage subsystem under `backend/src/domain/dnaStorage/` for encoding, decoding, simulation, analytics, and report generation.

## AI stack and services

### Core AI
- Gemini is the primary intelligence layer for clinical/variant reasoning.
- Grok is used as a secondary consensus-validation layer for structural impact checks.

### Common service areas
- `services/geminiService.ts` — Gemini-backed analysis access
- `services/grokService.ts` — external Grok validation client
- `services/alphafoldClient.ts` — AlphaFold data access patterns
- `services/genomicAnnotationService.ts` — annotation and sequence evidence helpers
- `services/fusionAnalysisService.ts` — fusion-aware analysis orchestration
- `services/medgemmaClient.ts` — model bridge for multimodal/clinical reasoning

## Data model and clinical domain

The project includes a clinical variant model backed by Prisma and seeded patient records:

- `Patient` records carry patient IDs and display names.
- `Variant` records attach to a patient and include gene, HGVS notation, zygosity, ACMG classification, and clinical metadata.
- Clinical example sets include SMA, CFTR, cancer-genomic, and neuromuscular variants.
- Database seeding scripts live in `backend/prisma/` and support both general and MRN-specific variant sets.

## Docs and project guidance

The repo includes operational and methodology docs in [docs](../docs), including:

- [docs/DNA_ARCHIVE_LAB.md](../docs/DNA_ARCHIVE_LAB.md)
- [docs/DEV-WORKFLOW.md](../docs/DEV-WORKFLOW.md)
- [docs/Instructions.md](../docs/Instructions.md)
- [docs/Terrors.md](../docs/Terrors.md)
- [docs/data-integration-pattern.md](../docs/data-integration-pattern.md)

These files capture system workflow, troubleshooting notes, design intent, and project background beyond the code itself.

## Tooling and scripts

Frontend:
- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run test` — Vitest suite

Backend:
- `npm run dev` — nodemon + tsx backend dev startup
- `npm run build` — TypeScript build
- `npm run start` — production backend start
- `npm run test` — Jest suite
- `npm run db:push`, `npm run db:generate`, `npm run db:migrate` — Prisma maintenance tasks

## Current status summary

- React + Vite frontend with tabbed multi-panel genomic workflow
- Express + Prisma backend with modular route structure
- Clinical variant and patient data model seeded in Prisma
- Gemini primary analysis engine plus Grok validation layer
- DNA Archive Lab prototype and simulation tooling in active codebase
- Analytics and patient-report workflows integrated in the main app shell
- Knowledge graph output generated under `graphify-out/`

This repo is a hybrid clinical-genomics application and research dashboard, with the codebase organized around variant interpretation, AI validation, patient data modeling, and archive/analytics tooling rather than a single monolithic app shell.
