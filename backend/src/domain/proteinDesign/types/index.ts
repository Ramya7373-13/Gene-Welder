// Type definitions for the protein design domain.
// Mirrors the DesignMode enum and related structures from the Prisma schema.
// All types are shared across adapter, conditioning, validation, and ranking modules.

export enum DesignMode {
  BINDER = 'BINDER',
  STABILIZER = 'STABILIZER',
  DNA_BINDER = 'DNA_BINDER',
  ENZYME_RESCUE = 'ENZYME_RESCUE',
  SCAFFOLD = 'SCAFFOLD',
  SYMMETRIC_ASSEMBLY = 'SYMMETRIC_ASSEMBLY',
  MOTIF_SCAFFOLD = 'MOTIF_SCAFFOLD',
  PROTEIN_SCAFFOLD = 'PROTEIN_SCAFFOLD',
}

export enum DesignRunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  VALIDATING = 'VALIDATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum ConstraintType {
  HOTSPOT = 'hotspot',
  BURY_DEPTH = 'burialDepth',
  HBOND = 'hbond',
  INTERFACE = 'interface',
  MOTIF = 'motif',
  CENTER_OF_MASS = 'centerOfMass',
  RESIDUE_MASK = 'residueMask',
}

/**
 * A residue position on the target protein structure.
 */
export interface ResiduePosition {
  chain: string;
  position: number;
  insertCode?: string;
}

/**
 * Hotspot residue constraint: residues the design must interact with.
 */
export interface HotspotConstraint {
  type: ConstraintType.HOTSPOT;
  residues: ResiduePosition[];
  minInteractions?: number;
}

/**
 * Burial depth constraint: how deeply a residue or atom should be buried.
 */
export interface BurialDepthConstraint {
  type: ConstraintType.BURY_DEPTH;
  residues: ResiduePosition[];
  minDepth: number;
  maxDepth?: number;
}

/**
 * Hydrogen bond constraint: specific H-bonds to form between design and target.
 */
export interface HydrogenBondConstraint {
  type: ConstraintType.HBOND;
  donorPosition: ResiduePosition;
  acceptorPosition: ResiduePosition;
  donorAtom?: string;
  acceptorAtom?: string;
}

/**
 * Interface constraint: regions on the target to bind.
 */
export interface InterfaceConstraint {
  type: ConstraintType.INTERFACE;
  chain: string;
  residues: number[];
  shapeComplementarity?: number;
}

/**
 * Motif constraint: a functional motif that must be preserved or included.
 */
export interface MotifConstraint {
  type: ConstraintType.MOTIF;
  motifName: string;
  residues: ResiduePosition[];
  preserveOrientation: boolean;
}

/**
 * Center of mass constraint: spatial envelope for the design.
 */
export interface CenterOfMassConstraint {
  type: ConstraintType.CENTER_OF_MASS;
  targetPosition: { x: number; y: number; z: number };
  radius: number;
}

export type DesignConstraintSpec =
  | HotspotConstraint
  | BurialDepthConstraint
  | HydrogenBondConstraint
  | InterfaceConstraint
  | MotifConstraint
  | CenterOfMassConstraint;

/**
 * Full conditioning input for the VariantConditioningEngine.
 */
export interface VariantConditioningInput {
  variant: {
    hgvs: string;
    gene?: string;
    aminoAcidChange?: string;
    position?: number;
  };
  structure: {
    pdbContent?: string;
    mmCifContent?: string;
    chainId?: string;
  };
  annotations?: {
    alphamissenseScore?: number;
    clinvarSignificance?: string;
    gnomadFrequency?: number;
    af3Model?: string;
    rmsdToWildtype?: number;
  };
  designObjectives?: DesignObjectiveSpec[];
}

/**
 * User-specified design objective for a design run.
 */
export interface DesignObjectiveSpec {
  mode: DesignMode;
  priority: number;
  description: string;
  notes?: string;
}

/**
 * RFD3-ready conditioning payload.
 * This is the output of VariantConditioningEngine and the input to the RFDiffusion3Adapter.
 */
export interface Rfd3Conditioning {
  hotspots: ResiduePosition[];
  burialDepth: BurialDepthConstraint[];
  hydrogenBonds: HydrogenBondConstraint[];
  interfaceRegions: InterfaceConstraint[];
  motifSpec?: MotifConstraint;
  centerOfMass?: CenterOfMassConstraint;
  targetStructure: string;
  targetSequence?: string;
  designMode: DesignMode;
  customConstraints?: Record<string, unknown>;
}

/**
 * Parameters for an RFD3 design run.
 */
export interface Rfd3Parameters {
  numDesigns?: number;
  diffusionSteps?: number;
  noiseScale?: number;
  partialDiffusion?: boolean;
  temperature?: number;
  topP?: number;
  seed?: number;
  [key: string]: unknown;
}

/**
 * Request to start a design run, passed to the RFDiffusion3Adapter.
 */
export interface DesignRunRequest {
  runId: string;
  projectId: string;
  mode: DesignMode;
  parameters: Rfd3Parameters;
  conditioning: Rfd3Conditioning;
  targetSequence?: string;
}

/**
 * A design candidate produced by RFD3.
 *
 * `structure` and `sequence` are optional because the backing columns are
 * nullable: a design may be sequence-only (no fold was produced) or
 * structure-only. Consumers must treat an absent value as "not available",
 * never as an empty design.
 */
export interface DesignCandidate {
  id: string;
  runId: string;
  structure?: string; // PDB/mmCIF content
  sequence?: string;
  affinityScore?: number;
  rankedPosition?: number;
  metrics?: CandidateMetrics;
  /** Relative path in the Phase F artifact store (e.g. candidates/<id>/design_1.cif.gz). */
  structuredFile?: string;
  createdAt: Date;
}

/**
 * Metrics computed for a design candidate.
 */
export interface CandidateMetrics {
  pLDDT?: number;
  pTM?: number;
  ipTM?: number;
  interfaceArea?: number;
  designScore?: number;
  [key: string]: unknown;
}

/**
 * Result from the DesignValidationEngine.
 */
export interface ValidationResult {
  candidateId: string;
  pTM?: number;
  ipTM?: number;
  pLDDT?: number;
  interfaceArea?: number;
  constraintSatisfactionScore?: number;
  diversityScore?: number;
  overallScore?: number;
  details: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Composite ranking for a candidate.
 */
export interface RankedCandidate {
  candidateId: string;
  compositeScore: number;
  rank: number;
  validationMetrics: ValidationResult;
}

/**
 * Weights for the composite scoring function.
 */
export interface ScoringWeights {
  pTM: number;
  ipTM: number;
  pLDDT: number;
  interfaceArea: number;
  constraintScore: number;
  diversity: number;
}

/**
 * Design ledger entry - immutable audit trail record.
 *
 * Phase G hash-chain fields:
 *   - `gitCommitHash`    source revision that ran the engine
 *   - `jobId`            execution job id that produced the candidate
 *   - `candidateHash`    sha256 of the candidate's canonical content
 *   - `validationHash`   sha256 of the validation snapshot at write time
 *   - `previousLedgerHash` sha256 of the prior entry in the candidate's chain
 *   - `ledgerHash`       sha256 of this entry's canonical content (excludes itself)
 */
export interface DesignLedgerEntry {
  candidateId: string;
  projectId?: string;
  modelVersion: string;
  weightsHash: string;
  seed: number;
  inputConstraints: Record<string, unknown>;
  userId: string;
  timestamp: Date;
  validationMetrics?: ValidationResult;
  runId?: string;
  gitCommitHash?: string;
  jobId?: string;
  candidateHash?: string;
  validationHash?: string;
  previousLedgerHash?: string;
  ledgerHash?: string;
}

/**
 * Job status event for WebSocket updates.
 */
export interface JobStatusEvent {
  runId: string;
  status: DesignRunStatus;
  progress?: number;
  message?: string;
  candidates?: DesignCandidate[];
}

/**
 * Analytics data for the Design Analytics dashboard.
 */
export interface AnalyticsData {
  totalProjects: number;
  totalRuns: number;
  totalCandidates: number;
  averageValidationScore: number;
  runDurations: number[];
  topGenes: { gene: string; count: number }[];
  commonVariants: { variant: string; count: number }[];
  validationScoreDistribution: { score: number; count: number }[];
  successRate: number;
}
