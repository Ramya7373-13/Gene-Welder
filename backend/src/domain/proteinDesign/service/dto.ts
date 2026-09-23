// Request/response DTOs and validators for the Design Studio API.
// Single source of truth: these Zod schemas are used both for inbound HTTP
// validation and for re-validating conditioning payloads read back out of the
// database (DesignRun.constraintSpec), so a stored run can never be replayed
// with a shape the engine does not understand.

import { z } from 'zod';
import { ConstraintType, DesignMode, DesignRunStatus } from '../types/index.js';

// --- Primitive building blocks ----------------------------------------------

export const residuePositionDto = z.object({
  chain: z.string().min(1).max(8),
  position: z.number().int().positive(),
  insertCode: z.string().max(4).optional(),
});

export const vector3Dto = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

/**
 * RFD3 hyperparameters. Unknown keys are preserved so new engine parameters can
 * be threaded through without a schema change (and are recorded in the ledger).
 */
export const rfd3ParametersDto = z
  .object({
    numDesigns: z.number().int().min(1).max(200).optional(),
    diffusionSteps: z.number().int().min(1).max(1000).optional(),
    noiseScale: z.number().min(0).max(1).optional(),
    partialDiffusion: z.boolean().optional(),
    temperature: z.number().min(0).max(10).optional(),
    topP: z.number().min(0).max(1).optional(),
    seed: z.number().int().min(0).optional(),
  })
  .catchall(z.unknown());

// --- Constraint specs --------------------------------------------------------

export const designConstraintDto = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(ConstraintType.HOTSPOT),
    residues: z.array(residuePositionDto).min(1),
    minInteractions: z.number().int().min(1).optional(),
  }),
  z.object({
    type: z.literal(ConstraintType.BURY_DEPTH),
    residues: z.array(residuePositionDto).min(1),
    minDepth: z.number(),
    maxDepth: z.number().optional(),
  }),
  z.object({
    type: z.literal(ConstraintType.HBOND),
    donorPosition: residuePositionDto,
    acceptorPosition: residuePositionDto,
    donorAtom: z.string().max(8).optional(),
    acceptorAtom: z.string().max(8).optional(),
  }),
  z.object({
    type: z.literal(ConstraintType.INTERFACE),
    chain: z.string().min(1).max(8),
    residues: z.array(z.number().int().positive()).min(1),
    shapeComplementarity: z.number().min(0).max(1).optional(),
  }),
  z.object({
    type: z.literal(ConstraintType.MOTIF),
    motifName: z.string().min(1).max(120),
    residues: z.array(residuePositionDto).min(1),
    preserveOrientation: z.boolean(),
  }),
  z.object({
    type: z.literal(ConstraintType.CENTER_OF_MASS),
    targetPosition: vector3Dto,
    radius: z.number().positive(),
  }),
]);

export type DesignConstraintDto = z.infer<typeof designConstraintDto>;

// --- Conditioning payload ----------------------------------------------------

/**
 * A complete RFD3 conditioning payload.
 *
 * This is persisted verbatim on the DesignRun and re-parsed when a job executes,
 * which is what makes a run reproducible from its ledger alone.
 */
export const conditioningDto = z.object({
  hotspots: z.array(residuePositionDto),
  burialDepth: z.array(
    z.object({
      type: z.literal(ConstraintType.BURY_DEPTH),
      residues: z.array(residuePositionDto),
      minDepth: z.number(),
      maxDepth: z.number().optional(),
    }),
  ),
  hydrogenBonds: z.array(
    z.object({
      type: z.literal(ConstraintType.HBOND),
      donorPosition: residuePositionDto,
      acceptorPosition: residuePositionDto,
      donorAtom: z.string().optional(),
      acceptorAtom: z.string().optional(),
    }),
  ),
  interfaceRegions: z.array(
    z.object({
      type: z.literal(ConstraintType.INTERFACE),
      chain: z.string(),
      residues: z.array(z.number().int()),
      shapeComplementarity: z.number().optional(),
    }),
  ),
  motifSpec: z
    .object({
      type: z.literal(ConstraintType.MOTIF),
      motifName: z.string(),
      residues: z.array(residuePositionDto),
      preserveOrientation: z.boolean(),
    })
    .optional(),
  centerOfMass: z
    .object({
      type: z.literal(ConstraintType.CENTER_OF_MASS),
      targetPosition: vector3Dto,
      radius: z.number(),
    })
    .optional(),
  targetStructure: z.string(),
  targetSequence: z.string().optional(),
  designMode: z.nativeEnum(DesignMode),
  customConstraints: z.record(z.string(), z.unknown()).optional(),
});

export type ConditioningDto = z.infer<typeof conditioningDto>;

// --- HTTP request DTOs -------------------------------------------------------
// Note: no `userId` field appears in any inbound schema. The acting user is
// always resolved from the session cookie by the route layer.

export const createProjectDto = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  targetGene: z.string().max(64).optional(),
  targetVariant: z.string().max(255).optional(),
});
export type CreateProjectDto = z.infer<typeof createProjectDto>;

export const updateProjectDto = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'COMPLETED']).optional(),
});
export type UpdateProjectDto = z.infer<typeof updateProjectDto>;

export const createRunDto = z.object({
  projectId: z.string().min(1),
  mode: z.nativeEnum(DesignMode),
  parameters: rfd3ParametersDto.optional(),
  targetStructure: z.string().max(20_000_000).optional(),
  targetSequence: z.string().max(200_000).optional(),
  chainId: z.string().max(8).optional(),
  /** HGVS protein notation, e.g. "p.G12D". When present the VariantConditioningEngine runs. */
  variant: z.string().max(255).optional(),
  /** Explicit constraints, merged on top of anything the conditioning engine derived. */
  constraints: z.array(designConstraintDto).optional(),
});
export type CreateRunDto = z.infer<typeof createRunDto>;

export const updateRunDto = z.object({
  status: z.nativeEnum(DesignRunStatus).optional(),
  gpuId: z.string().max(120).optional(),
  failedReason: z.string().max(2000).optional(),
});
export type UpdateRunDto = z.infer<typeof updateRunDto>;

export const createCandidateDto = z.object({
  runId: z.string().min(1),
  structure: z.string().max(20_000_000).optional(),
  sequence: z.string().max(200_000).optional(),
  affinityScore: z.number().optional(),
  designMetrics: z.record(z.string(), z.unknown()).optional(),
});
export type CreateCandidateDto = z.infer<typeof createCandidateDto>;

export const validateCandidateDto = z.object({
  candidateId: z.string().min(1),
});
export type ValidateCandidateDto = z.infer<typeof validateCandidateDto>;

/** Query validator for the read-only ledger surface (`GET /candidates/:candidateId/ledger`). */
export const ledgerQueryDto = z.object({
  candidateId: z.string().min(1),
});
export type LedgerQueryDto = z.infer<typeof ledgerQueryDto>;

// --- Job payload DTO ---------------------------------------------------------

/**
 * Everything a queued design job needs to execute without re-reading mutable
 * state. Persisted as `DesignRun.parameters` snapshot semantics: the payload is
 * self-contained so a job is reproducible from the ledger.
 */
export const designJobPayloadDto = z.object({
  mode: z.nativeEnum(DesignMode),
  parameters: rfd3ParametersDto,
  conditioning: conditioningDto,
  targetSequence: z.string().optional(),
  variant: z.string().optional(),
  userId: z.string().min(1),
});
export type DesignJobPayload = z.infer<typeof designJobPayloadDto>;
