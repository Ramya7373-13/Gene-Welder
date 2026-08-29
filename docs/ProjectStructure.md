# MutationMechanic - Project Structure

## Overview
MutationMechanic is an AI-driven protein engineering dashboard for analyzing pathogenicity, structural impact, and splicing defects of genetic variants. The application includes both frontend (React/Vite) and backend (Express/Prisma/PostgreSQL) with persistent storage and clinical variant management features.

## Complete Project Structure

`
mutationmechanic/
├── .git/                                       # Git repository
├── .kiro/                                      # Kiro AI configuration
│   └── steering/                               # AI steering configurations
│       ├── banner-design/
│       ├── brand/
│       ├── design/
│       ├── design-system/
│       ├── slides/
│       ├── ui-styling/
│       └── ui-ux-pro-max/
├── backend/                                    # Express/Prisma backend server
│   ├── dist/                                   # Compiled backend output
│   ├── node_modules/                           # Backend dependencies
│   ├── prisma/                                 # Database schema and migrations
│   │   ├── schema.prisma                         # Database schema definition
│   │   ├── seed-patients.ts                      # Patient data seeding script
│   │   ├── seed-mrn-variants.ts                  # MRN patient variants seeding script  
│   │   ├── seed-clinical.ts                      # Clinical data seeding script
│   │   ├── seed.ts                               # General seeding script
│   │   └── seed-test.js                          # Test seeding script
│   ├── src/                                    # Backend source code
│   │   ├── server.ts                             # Main server file with all endpoints
│   │   ├── prisma.ts                             # Prisma client configuration
│   │   ├── index.ts                              # Server entry point
│   │   └── utils/                                # Backend utilities
│   │       ├── alphafoldUtil.ts                  # AlphaFold API utilities
│   │       ├── logger.ts                         # Logging utilities
│   │       └── redactor.ts                       # Data redaction utilities
│   ├── storage/                                # Local storage for uploaded files
│   ├── tests/                                  # Backend tests
│   │   ├── unit/                                 # Unit tests
│   │   │   ├── health.test.ts                    # Health check tests
│   │   │   └── logger.test.ts                    # Logger tests
│   │   └── integration/                          # Integration tests
│   │       └── api.test.ts                       # API integration tests
│   ├── .env                                    # Backend environment variables
│   ├── .env.example                            # Backend environment example
│   ├── .gitignore                              # Git ignore patterns
│   ├── jest.config.js                          # Jest configuration
│   ├── nodemon.json                            # Nodemon configuration
│   ├── package.json                            # Backend dependencies
│   ├── package-lock.json                       # Backend lock file
│   ├── prisma.config.ts                        # Prisma configuration
│   ├── README.md                               # Backend README
│   ├── tsconfig.json                           # Backend TypeScript config
│   ├── update_meta.cjs                         # Metadata update script
│   └── update_meta.ts                          # Metadata update script
├── components/                                 # React UI components
│   ├── Analytics/                              # Analytics dashboard components
│   │   ├── AnalyticsDashboard.tsx                # Main analytics dashboard
│   │   └── HistoryTable.tsx                      # Clinical patient management table
│   ├── Longevity/                              # Longevity analysis components
│   ├── SplicingDecoder/                        # Splicing analysis components
│   ├── __tests__/                              # Component tests
│   │   └── ProteinStructureViewer.test.tsx       # Protein structure viewer tests
│   ├── AnalysisPanel.tsx                       # Variant analysis panel
│   ├── ChatWidget.tsx                          # AI chat interface
│   ├── CompensatoryDesignTab.tsx               # Compensatory mutation design
│   ├── ConfidenceHeatmap.tsx                   # pLDDT confidence visualization
│   ├── ConfirmModal.tsx                        # Confirmation dialog
│   ├── DiseaseTracerTab.tsx                    # Disease risk assessment
│   ├── EmptyState.tsx                          # Empty state placeholder
│   ├── ErrorBoundary.tsx                       # Error handling boundary
│   ├── GenomicAnnotationPanel.tsx              # Genomic annotation viewer
│   ├── Header.tsx                              # Application header
│   ├── LandingPage.tsx                         # Application landing page
│   ├── MechanismExplainer.tsx                  # Mechanism explanation
│   ├── OrthologTable.tsx                       # Ortholog comparison table
│   ├── ProteinStructureViewer.tsx              # 3D protein structure viewer
│   ├── SettingsModal.tsx                       # Settings/configuration modal
│   ├── ShortcutsModal.tsx                      # Keyboard shortcuts helper
│   ├── StructureCharts.tsx                     # Structural analysis charts
│   ├── Tabs.tsx                                # Tab navigation component
│   ├── ToastNotification.tsx                   # Toast notification system
│   ├── VariantExplainerTab.tsx                 # Main variant analysis component
│   └── VariantSelector.tsx                     # Variant selection component
├── design-system/                              # UI/UX design system (from skill)
│   ├── MASTER.md                               # Master design system definition
│   └── pages/                                  # Page-specific design overrides
│       ├── analytics.md                        # Analytics page design
│       ├── design.md                           # Design tab page design
│       ├── explainer.md                        # Explainer tab page design
│       ├── splicing.md                         # Splicing tab page design
│       └── tracer.md                           # Tracer tab page design
├── dist/                                       # Production build output
│   ├── assets/                                 # Compiled assets
│   │   ├── alphafoldClient-Dn6xdu_g.js         # AlphaFold client chunk
│   │   ├── index-BQH-ti1l.css                  # Stylesheet
│   │   └── index-DQP7XY5j.js                   # Main application bundle
│   └── index.html                              # Production HTML entry
├── docs/                                       # Documentation files
│   ├── diagnostics/                            # Diagnostic documentation
│   │   ├── backend-health-logging-tests.md     # Backend health logging test docs
│   │   ├── prisma-env-startup.md               # Prisma environment startup docs
│   │   └── PTM-ortholog-alpha-medgemma-check.md # PTM/ortholog/Alpha/MedGemma check
│   ├── Errors.md                               # Error logs and debugging info
│   ├── Instructions.md                         # Setup and development instructions
│   ├── Instructions_1.md                       # Clinical patient and variant instructions
│   ├── ProjectStructure.md                     # This file
│   └── README.md                               # Project overview
├── routes/                                     # API route definitions
│   └── splicing/                               # Splicing-related routes
│       └── index.ts                            # Splicing route definitions
├── services/                                   # API service clients and utilities
│   ├── alphaGenomeClient/                      # AlphaGenome API client
│   │   └── index.ts                            # AlphaGenome client implementation
│   ├── alphafoldClient.ts                      # AlphaFold3 API integration
│   ├── backendService.ts                       # Backend API client
│   ├── fusionAnalysisService.ts                # Fusion analysis orchestration
│   ├── fusionMagicDemo.ts                      # Fusion analysis demo
│   ├── geminiService.ts                        # Google AI services
│   ├── genomicAnnotationService.ts             # Genomic annotation services
│   ├── historyService.ts                       # History tracking service
│   ├── medgemmaClient.ts                       # MedGemma AI client
│   └── testFusionAnalysis.ts                   # Fusion analysis test
├── storage/                                    # Local storage for PDB files
├── types/                                      # TypeScript type definitions
│   ├── genomics.ts                             # Genomics-related types
│   ├── medgemma.ts                             # MedGemma-related types
│   └── splicing/                               # Splicing-related types
│       └── index.ts                            # Splicing type definitions
├── utils/                                      # Frontend utility functions
│   ├── alphafoldClient.ts                      # Frontend AlphaFold client
│   ├── cacheLayer.ts                           # Caching layer
│   ├── logger.ts                               # Frontend logging
│   ├── presetStorage.ts                        # Preset storage utilities
│   ├── storage.ts                              # Storage utilities
│   ├── uniprot.ts                              # UniProt API utilities
│   └── uniprot.test.ts                         # UniProt API tests
├── App.tsx                                     # Main React app component
├── index.html                                  # HTML entry point
├── index.tsx                                   # TypeScript entry point
├── package.json                                # Frontend dependencies
├── package-lock.json                           # Frontend lock file
├── constants.ts                                # Application constants (UNIPROT_MAP)
├── metadata.json                               # Project metadata
├── mutationmechanic.zip                        # Project archive
├── .env                                        # Frontend environment variables
├── .env.local                                  # Frontend local environment variables
├── .eslintrc.json                              # ESLint configuration
├── .gitignore                                  # Git ignore patterns
├── .stylelintrc.json                           # Stylelint configuration
├── .stylelintignore                            # Stylelint ignore patterns
├── testAlphaFoldIntegration.ts                 # AlphaFold integration test script
├── testFusionAnalysis.ts                       # Fusion analysis test script
├── fusionMagicDemo.ts                          # Fusion magic moments demo
├── addVariant.js                               # Variant addition utility
├── checkVariants.js                            # Variant checking utility
├── getModels.js                                # Model retrieval utility
├── logPrediction.js                            # Prediction logging utility
├── updateVariant.js                            # Variant update utility
├── tsconfig.json                               # Frontend TypeScript configuration
├── vite.config.ts                              # Vite configuration
└── README.md                                   # Project overview (duplicate in root)

## Backend API Endpoints

### Core Endpoints
- GET /api/health - Health check
- GET /api/patients - Get all patients with names
- GET /api/variants - Get patient variants
- POST /api/variants - Create/update variant
- POST /api/patients - Create patient
- GET /api/alphafold/:gene - Fetch protein structure from AlphaFold DB
- POST /api/structures - Upload protein structure file
- GET /api/test-storage - Verify storage readiness
- GET /api/test-schema - Test clinical schema
- POST /api/predictions - Log ML predictions
- GET /api/models - List active ML models
- POST /api/seed-clinical - Bulk seed clinical data
- POST /api/seed-models - Seed model registry

### Clinical Variant Endpoints
- GET /api/variants?patientId=... - Get variants for specific patient
- POST /api/variants - Create/Update variant with patientId, gene, hgvs_c
- GET /api/patients - Returns patientId, name, createdAt (with name field!)

### AlphaFold Integration Endpoints
- GET /api/alphafold/:gene - Fetch structure from public AlphaFold DB
- POST /api/structures - Upload PDB files to local storage

## Clinical Variant Schema

### Patient Model
- id: Internal Prisma ID (cuid)
- patientId: External patient ID (e.g., P001, MRN-123) 
- name: Patient name (e.g., "John Smith - SMA Diagnosis")
- createdAt: Creation timestamp

### Variant Model  
- id: Internal Prisma ID (cuid)
- patientId: Links to Patient.id (foreign key)
- gene: Gene name (e.g., SMN1, CFTR, BCR-ABL1)
- hgvs_c: cDNA variant (e.g., c.840+2T>G)
- hgvs_p: Protein variant (e.g., p.Gly281*)
- ref_allele/alt_allele: Reference and alternative alleles
- zygosity: Homozygous/heterozygous
- gnomad_freq: gnomAD frequency
- clinvar_path: Pathogenicity from ClinVar
- acmg_class: ACMG classification (PVS1, PS1, PM1, etc.)

## Clinical Features Implemented

### Patient Management
- 10 Clinical Patients: P001-P010 with real names and conditions
- MRN Patients: All existing MRN patients have 3+ clinical variants
- Patient Names: All patients show proper names in dropdown, not "No variants"
- Variant Distribution: Each patient has 3-4 specific clinical variants

### Clinical Examples
- P001 John Smith: SMA diagnosis (SMN1, SMN2, NAIP variants)
- P003 Michael Brown: CML with BCR-ABL1 fusion (BCR-ABL1, ABL1, BCR variants)
- P007 Robert Martinez: CFTR Triple Mutation (4 CFTR variants)
- MRN-226856: Oncology panel (EGFR, KRAS, TP53 variants)
- MRN-703891: Neuromuscular/DMD (3 DMD variants)
- MRN-461835: Now has 3 metabolic variants (PAH, G6PD)

### AlphaFold3 Integration
- Public API: Integration with AlphaFold EBI DB (2M+ structures)
- Fusion Support: BCR-ABL1, EML4-ALK, BRCA1-BRCA2, CFTR structure prediction
- Auto-trigger: Fusion genes automatically trigger real AlphaFold structure loading
- Storage: Real PDB structures uploaded to local backend storage
- Endpoints: /api/alphafold/:gene returns structureId when successful

## File Changes Summary

### Backend Updates
- backend/src/server.ts: Updated /api/patients to include name field in select
- backend/src/utils/alphafoldUtil.ts: AlphaFold DB API integration
- backend/prisma/schema.prisma: Clinical variant schema with Patient/Variant relationships
- backend/prisma/seed-patients.ts: Seeding script for P001-P010 patients with 3+ variants each
- backend/prisma/seed-mrn-variants.ts: Seeding script for MRN patients with clinical variants
- backend/prisma/seed-clinical.ts: Seeding script for clinical variant data
- Route organization: Moved from inline in server.ts to dedicated routes/ directory

### Frontend Updates  
- components/Analytics/HistoryTable.tsx: Updated dropdown to show p.name || p.patientId
- services/alphafoldClient.ts: Public AlphaFold DB API integration
- constants.ts: Added UNIPROT_MAP with clinical gene mappings
- components/VariantExplainerTab.tsx: Auto-trigger for fusion genes
- New components: LandingPage, ConfirmModal, EmptyState, ChatWidget, etc.
- Enhanced components: DiseaseTracerTab, CompensatoryDesignTab, GenomicAnnotationPanel
- Design system implementation: Complete UI/UX overhaul with Neumorphism styling
- Utility additions: cacheLayer, presetStorage, storage, improved logging

### Clinical Variant Features
- All Patients Have Variants: No patient shows "No variants" anymore
- Real Names: Clinical patients like "John Smith - SMA Diagnosis" displayed
- 3+ Variants Per Patient: Each patient has 3-4 clinically relevant variants
- No Duplicates: Seed scripts include cleanup logic to prevent duplicate variants
- ACMG Classifications: Proper clinical classifications assigned (PVS1, PS1, PM1, etc.)

## Testing & Validation
- curl http://localhost:5000/api/patients - Returns all patients with names
- curl http://localhost:5000/api/variants?patientId=P001 - Shows 3+ variants for P001
- curl http://localhost:5000/api/alphafold/BCR-ABL1 - Returns structureId for fusion
- Clinical dropdown shows "John Smith - SMA Diagnosis â–¼", "Robert Martinez - CFTR Triple Mutation â–¼", etc.

## Production Status
- Clinical Scale: All 20+ patients have 3+ clinical variants each
- AlphaFold3 Ready: Production API integration with public AlphaFold DB
- Fusion Analysis: BCR-ABL1 and other fusion proteins supported
- Patient Names: Clinical names properly displayed in frontend
- No Duplicates: Database cleanup ensures unique variants per patient
- Design System: Professional Neumorphism-based UI implemented
- Build System: Production-ready Vite build with asset optimization
