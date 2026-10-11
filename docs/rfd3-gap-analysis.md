# RFdiffusion3 Gap Analysis
**Repository**: MutationMechanic  
**Analysis Date**: 2026-09-21  
**Base Document**: MutationMechanic × RFdiffusion3.md (Innovation Report)

## 1. Existing Capability Inventory

### 1.1 Backend Infrastructure
- **Express.js server** with Prisma ORM and PostgreSQL (`backend/src/server.ts`)
- **API routes** mounted at `/api`:
  - `auth`, `billing`, `ai`, `genomics`, `structures`, `variants`, `records`, `audit`, `predictions`, `collab`, `clinical`
- **Domain layer**: Only `dnaStorage` module exists under `backend/src/domain/dnaStorage/` (13 files covering codec, decoders, job runner, etc.)
- **No proteinDesign domain** currently exists
- **Prisma schema**: File appears corrupted/empty (19 bytes binary), no models defined
- **Existing database health check** in server.ts with Gemini, Grok, AlphaMissense, SpliceAI, AlphaFold services
- **MCP integration**: Partial - some MCP tool references in the architecture report but no actual MCP servers exposed

### 1.2 Frontend Infrastructure
- **Minimal React components**: `LoginButton.tsx`, `PaywallUI.tsx`, `UsageBadge.tsx` under `src/components/`
- **No Design Studio tab** or any design-related UI
- **No RFD3-related UI** components
- **Design system**: Tailwind CSS based, shadcn/ui patterns evident in codebase
- **No variant-to-design workflow UI**

### 1.3 RFdiffusion3 Integration
- **No RFD3 adapter** or wrapper code exists
- **No conditioning builder** service to translate variant analysis into RFD3 inputs
- **No inference worker** service wrapping foundry_RFdiffusion3 Python package
- **No ProteinMPNN/LigandMPNN** integration
- **No GPU job queue** or async execution framework
- **No design ledger** for audit trail and provenance

### 1.4 Data Models
- **No DesignProject, DesignRun, DesignCandidate, DesignConstraint, ValidationResult, DesignLedger** Prisma models
- **Existing clinical models** must be preserved (per Instructions_2.md rule)
- **No variant conditioning payload** structure for RFD3 input

## 2. Missing Capability Inventory

### 2.1 Core Missing Capabilities
1. **Variant conditioning engine** - Translate variant analysis into RFD3-compatible conditioning inputs (hotspot residues, H-bond specs, burial depth constraints)
2. **RFDiffusion3Adapter** - Node.js/TypeScript adapter wrapping the foundry_RFdiffusion3 Python package
3. **Design project lifecycle management** - CRUD for DesignProject, DesignRun, DesignCandidate entities
4. **Async job queue** - GPU-accelerated design job submission, status tracking (QUEUED→RUNNING→VALIDATING→COMPLETED/FAILED)
5. **Design validation engine** - AF3 re-prediction, interface metrics, constraint satisfaction scoring
6. **Design ledger** - Immutable audit trail for all designs (model version, weights hash, seeds, input constraints)
7. **Design Studio frontend tab** - Full React interface with BinderDesigner, StabilizerDesigner, DnaBinderDesigner, EnzymeDesigner submodules
8. **MCP tool exposure** - variant_analyze, structure_model, design_binders, design_stabilizer, design_dna_binder, inverse_fold, validate_design, rank_designs

### 2.2 Infrastructure Missing
1. **Prisma migrations** for new schema models
2. **GPU worker infrastructure** or mock queue system
3. **RFD3 model weights** integration (or placeholder mock)
4. **Provenance tracking** system
5. **Analytics dashboard** for design tracking

## 3. Reusable Modules

### 3.1 Existing Code That Can Be Reused
- **Express server pattern** (`backend/src/server.ts`) - Middleware, CORS, audit, health checks
- **Prisma client** (`backend/src/prisma.js`) - Database connection patterns
- **Audit middleware** - Request logging and audit trail
- **Health check patterns** - Service status checking (Gemini, Grok, AlphaFold, SpliceAI)
- **Route organization** - Modular route files mounted at `/api`
- **DNA storage domain** - Complete codec/decoder architecture that can pattern the proteinDesign domain
- **Tailwind design system** - Existing CSS classes, components, and patterns
- **shadcn/ui components** - LoginButton, PaywallUI, UsageBadge as starter components
- **MCP configuration** (`.mcp.json`) - Existing MCP server setup

### 3.2 New Reusable Modules to Create
- `backend/src/domain/proteinDesign/` - Full domain mirroring dnaStorage structure
- `components/DesignStudio/` - React Design Studio tab and all submodules
- `docs/rfd3-system-architecture.md` - System architecture documentation
- MCP tool servers for each design stage

## 4. Technical Debt

### 4.1 Current Debt Items
1. **Prisma schema is corrupted** - Needs reconstruction from scratch or from code analysis
2. **No design-related database models** - Missing all Design* entities
3. **Empty frontend** - No Design Studio UI, only authentication/paywall components
4. **No RFD3 integration** - Zero connection to the RFdiffusion3 pipeline
5. **Missing MCP tool servers** - Architecture documented but not implemented
6. **No job queue system** - Design execution is synchronous or not supported

### 4.2 Debt Risk Assessment
- **High risk**: Corrupted Prisma schema could cause db push failures
- **Medium risk**: Missing audit trail for designs could be regulatory issue
- **Low risk**: Frontend components can be built incrementally without breaking existing functionality

## 5. Database Impact Analysis

### 5.1 Current Schema Status
- Prisma schema file is binary/corrupted (19 bytes) - cannot be read
- Need to reconstruct schema from existing code analysis or generate from Prisma models

### 5.2 Required New Models (per Instructions_2.md & Instructions_3.md)
| Model | Purpose | Key Fields |
|-------|---------|------------|
| **DesignProject** | Container for design runs | name, description, userId, status, createdAt, updatedAt |
| **DesignRun** | Individual RFD3 design execution | projectId, mode (binder/dnaBinder/scaffold/etc.), status, gpuId, startedAt, completedAt |
| **DesignCandidate** | RFD3 output candidates | runId, structure (PDB/mmCIF), sequence, affinityScore, rankedPosition, metrics (pTM, ipTM, interfaceArea) |
| **DesignConstraint** | User-defined design constraints | runId, type (hotspot/buryDepth/HCONstraint), value, parameterized spec |
| **ValidationResult** | Validation metrics from AF3/Roetta | candidateId, pTM, ipTM, interfaceMetrics, constraintSatisfactionScore, overallScore |
| **DesignLedger** | Immutable audit trail | candidateId, modelVersion, weightsHash, seed, inputConstraints, validatedAt, validatorId |

### 5.3 Migration Considerations
- **DO NOT remove or modify existing clinical models** (Instructions_2.md rule)
- Must create new migration file that adds Design* tables without dropping existing ones
- Prisma `db push` will need fresh schema generation after schema.prisma is fixed

## 6. Frontend Impact Analysis

### 6.1 Current State
- Zero design-related UI components
- No Design Studio navigation in App.tsx
- No variant selector, gene search, or structure upload components

### 6.2 Required New Components (per Instructions_2.md)
| Component | Purpose |
|-----------|---------|
| **DesignStudioTab** | Primary tab navigation entry point |
| **BinderDesigner** | RFD3 binder design workflow |
| **StabilizerDesigner** | Stabilizer design workflow |
| **DnaBinderDesigner** | DNA binder design workflow |
| **EnzymeDesigner** | Enzyme rescue design workflow |
| **DesignHistory** | Design run history viewer |
| **DesignResultsViewer** | Visualize design candidates |
| **DesignMetricsPanel** | Display design validation metrics |

### 6.3 UI Patterns to Follow
- Existing Tailwind CSS design system
- shadcn/ui component patterns
- Existing responsive layout patterns
- Dark mode support (existing in design-system)

## 7. Backend Impact Analysis

### 7.1 Required New Routes (per Instructions_2.md)
| Route | HTTP Methods | Purpose |
|-------|-------------|---------|
| `/api/design/projects` | GET, POST | Manage design projects |
| `/api/design/runs` | POST, GET, PUT | Create and track design runs |
| `/api/design/candidates` | GET, POST | Retrieve design candidates |
| `/api/design/validate` | POST | Validate design candidates |

### 7.1 Required New Services
| Service | Purpose |
|---------|---------|
| **VariantConditioningEngine** | Translate variant data into RFD3 conditioning inputs |
| **RFDiffusion3Adapter** | Wrapper for RFD3 Python inference engine |
| **DesignValidationEngine** | AF3 re-prediction and interface scoring |
| **DesignRankingService** | Rank candidates by composite score |
| **DesignLedgerService** | Immutable audit trail management |

### 7.2 Backend Architecture Changes
- Create `backend/src/domain/proteinDesign/` mirroring `dnaStorage/` structure
- Add new route files under `backend/src/routes/design*.ts`
- Update `server.ts` to mount new design routes
- Implement job queue system (or mock for Phase 1)

## 8. Security Implications

### 8.1 New Security Considerations
1. **GPU job queue exposure** - Prevent unauthorized job submission
2. **Design candidate provenance** - Ensure design origins are tracked
3. **RFD3 model weights handling** - Secure storage of proprietary/checkpoint files
4. **Variant data sensitivity** - Patient variant data must be handled per privacy regulations
5. **MCP tool authentication** - Secure MCP server endpoints

### 8.2 Recommended Security Measures
- JWT authentication on all design API routes
- Rate limiting on design job submissions
- Input validation on all design constraints
- Audit logging of all design creation/modification events
- Secure handling of RFD3 model weights (read-only access for inference)

## 9. GPU Infrastructure Requirements

### 9.1 Current State
- No GPU infrastructure defined
- No job queue for async GPU execution

### 9.2 Required Infrastructure
1. **Job queue system** - BullMQ, RabbitMQ, or Redis-based queue
2. **GPU worker service** - Python service wrapping RFD3 inference
3. **Task dispatch** - API endpoint to submit design jobs to queue
4. **Status polling** - Frontend can poll run status
5. **Resource monitoring** - Track GPU utilization, job queue depth

### 9.3 Phase 1 Approach
- Implement mock job queue that simulates async execution
- Return immediate mock payloads (per Instructions_3.md Phase 5)
- Real GPU infrastructure in later phases

## 10. Summary of Gaps

| Category | Gap Severity | Estimated Effort |
|----------|-------------|-----------------|
| Prisma schema reconstruction | Critical | 1-2 days |
| Design project models & migrations | Critical | 2-3 days |
| RFDiffusion3Adapter (mock) | High | 3-5 days |
| Variant conditioning engine | High | 3-5 days |
| Design Studio frontend tab | High | 5-7 days |
| Design API routes | High | 3-5 days |
| Design validation engine | Medium | 3-5 days |
| Design ledger/audit trail | Medium | 2-3 days |
| MCP tool exposure | Medium | 3-5 days |
| GPU job queue (mock) | Low | 2-3 days |

**Overall Assessment**: The repository has solid backend infrastructure (Express + Prisma + PostgreSQL) and a design system foundation, but lacks the core RFD3 integration layer, design data models, and frontend UI. The corrupted Prisma schema is the highest priority technical debt item to address first.