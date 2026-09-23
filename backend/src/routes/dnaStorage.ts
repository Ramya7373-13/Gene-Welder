// DNA Archive Lab API routes (Phase 1).
// Mounted once from server.ts: app.use('/api/dna-storage', dnaStorageRouter).
// Conventions: Zod validation (first backend feature to use it), optional userId
// from request body (no session/auth system exists in this codebase — ownership
// is record-id lookup plus a userId match when both are present), structured
// { error } responses, and audit logging of METADATA ONLY (never sequences or
// file contents) via auditAction.
import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import type { Prisma } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { auditAction } from '../utils/redactor.js';
import type { DnaStrand, EncodingProfile, ErrorProfile } from '../domain/dnaStorage/types.js';
import { PRNG_NAME, PRNG_VERSION } from '../domain/dnaStorage/types.js';
import { getCodec } from '../domain/dnaStorage/codecRegistry.js';
import { simulateChannelErrors, ZERO_ERROR_PROFILE } from '../domain/dnaStorage/errorSimulator.js';
import { generateReport } from '../domain/dnaStorage/reportGenerator.js';
import { encodingOverhead } from '../domain/dnaStorage/analytics.js';

export const dnaStorageRouter = Router();

// --- Validation schemas (Zod) -------------------------------------------------

const createExperimentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  userId: z.string().max(100).optional(),
});

const encodingProfileSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  mode: z.enum(['learning', 'constraint-aware', 'advanced']),
  maxPayloadBases: z.number().int().min(20).max(10000),
  maxHomopolymerLength: z.number().int().min(1).max(10),
  minGcPercent: z.number().min(0).max(100),
  maxGcPercent: z.number().min(0).max(100),
  redundancyFactor: z.number().int().min(1).max(10),
  checksumAlgorithm: z.enum(['sha256', 'crc32']),
});

const errorProfileSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  substitutionRate: z.number().min(0).max(1),
  insertionRate: z.number().min(0).max(1),
  deletionRate: z.number().min(0).max(1),
  strandDropoutRate: z.number().min(0).max(1),
  duplicationRate: z.number().min(0).max(1),
  coverageDepth: z.number().int().min(1).max(20),
  seed: z.number().int().min(0).max(2147483647),
});

const encodeSchema = z.object({
  encodingProfile: encodingProfileSchema,
  userId: z.string().max(100).optional(),
});

const simulateSchema = z.object({
  errorProfile: errorProfileSchema,
  userId: z.string().max(100).optional(),
});

const decodeSchema = z.object({
  errorRunId: z.string().optional(),
  userId: z.string().max(100).optional(),
});

// --- Upload handling -----------------------------------------------------------

const ALLOWED_MIME_TYPES = new Set(['text/plain', 'application/json', 'text/csv']);
const MAX_UPLOAD_BYTES = 1024 * 1024; // 1 MB (spec)

const dnaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      // Mark the rejection so the route handler can answer 415: multer's
      // cb(null, false) silently omits the file, which otherwise looks like
      // "no file attached".
      (req as any)._fileRejected = true;
      cb(null, false);
    }
  },
});

// Multer wraps its own failures (e.g. LIMIT_FILE_SIZE) as errors passed to
// next(), which skips the route handler — translate them to structured codes.
function dnaUploadErrorHandler(err: unknown, _req: Request, res: Response, _next: () => void) {
  const multerErr = err as { code?: string; message?: string };
  if (multerErr && multerErr.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File exceeds the 1 MB upload limit' });
  }
  return res.status(500).json({ error: 'Upload failed' });
}

const DNA_STORAGE_DIR = path.resolve('./storage/dna-archive');

// --- Helpers -------------------------------------------------------------------

type ExperimentRecord = {
  id: string;
  userId: string | null;
  status: string;
  title: string;
  description: string | null;
  sourceFileName: string | null;
  sourceMimeType: string | null;
  sourceFileSizeBytes: number | null;
  sourceSha256: string | null;
  randomSeed: number | null;
  encodingProfileJson: unknown;
  errorProfileJson: unknown;
  createdAt: Date;
};

/**
 * "Ownership" per this codebase's convention: there is no session/login system.
 * Unknown ids 404; when both the record and the request carry a userId and they
 * differ, we also 404 rather than leak the record's existence.
 */
async function findOwnedExperiment(id: string, userId?: string): Promise<ExperimentRecord | null> {
  const experiment = await prisma.dnaStorageExperiment.findUnique({ where: { id } });
  if (!experiment) return null;
  if (userId && experiment.userId && experiment.userId !== userId) return null;
  return experiment as ExperimentRecord;
}

/** Metadata-only audit payload — NEVER sequences or file contents (hard rule). */
function experimentAuditMeta(experiment: { id: string; status: string; sourceSha256?: string | null }, extra: Record<string, unknown> = {}) {
  return {
    id: experiment.id,
    status: experiment.status,
    ...(experiment.sourceSha256 ? { sourceSha256: experiment.sourceSha256 } : {}),
    ...extra,
  };
}

function zodErrorMessage(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

// --- Routes --------------------------------------------------------------------

// POST /experiments — create a DRAFT experiment
dnaStorageRouter.post('/experiments', async (req: Request, res: Response) => {
  const parsed = createExperimentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: `Invalid experiment payload: ${zodErrorMessage(parsed.error)}` });
  }
  try {
    const experiment = await prisma.dnaStorageExperiment.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        userId: parsed.data.userId,
        status: 'DRAFT',
      },
    });
    await auditAction(
      prisma,
      'POST /api/dna-storage/experiments',
      experiment.id,
      'DnaStorageExperiment',
      null,
      experimentAuditMeta(experiment),
      parsed.data.userId
    );
    return res.status(201).json(experiment);
  } catch (error) {
    logger.error('dna-storage create experiment failed:', error);
    return res.status(500).json({ error: 'Failed to create experiment' });
  }
});

// POST /experiments/:id/upload — small text/JSON/CSV file, 1 MB cap
dnaStorageRouter.post(
  '/experiments/:id/upload',
  dnaUpload.single('file'),
  dnaUploadErrorHandler,
  async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req.body?.userId as string | undefined) ?? undefined;
  const file = req.file;

  if ((req as any)._fileRejected) {
    return res.status(415).json({ error: 'Only text/plain, application/json, and text/csv files are allowed' });
  }
  if (!file) {
    return res.status(400).json({ error: 'A file field is required' });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return res.status(413).json({ error: 'File exceeds the 1 MB upload limit' });
  }

  try {
    const experiment = await findOwnedExperiment(id, userId);
    if (!experiment) return res.status(404).json({ error: 'Experiment not found' });

    const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
    await fs.mkdir(DNA_STORAGE_DIR, { recursive: true });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedName = `${Date.now()}-${safeName}`;
    const storagePath = path.join(DNA_STORAGE_DIR, storedName);
    await fs.writeFile(storagePath, file.buffer);

    const record = await prisma.dnaStorageFile.create({
      data: {
        experimentId: id,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        sha256,
        storagePath,
      },
    });
    const updated = await prisma.dnaStorageExperiment.update({
      where: { id },
      data: {
        sourceFileName: file.originalname,
        sourceMimeType: file.mimetype,
        sourceFileSizeBytes: file.size,
        sourceSha256: sha256,
      },
    });
    await auditAction(
      prisma,
      'POST /api/dna-storage/experiments/:id/upload',
      id,
      'DnaStorageExperiment',
      null,
      experimentAuditMeta(updated, { fileId: record.id, sizeBytes: file.size }),
      userId
    );
    return res.json({
      sourceFileName: updated.sourceFileName,
      sourceMimeType: updated.sourceMimeType,
      sourceFileSizeBytes: updated.sourceFileSizeBytes,
      sourceSha256: updated.sourceSha256,
      fileId: record.id,
    });
  } catch (error) {
    logger.error('dna-storage upload failed:', error);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

// POST /experiments/:id/encode — encode the uploaded file to DNA strands
dnaStorageRouter.post('/experiments/:id/encode', async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = encodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: `Invalid encode payload: ${zodErrorMessage(parsed.error)}` });
  }
  const profile = parsed.data.encodingProfile as EncodingProfile;

  try {
    const experiment = await findOwnedExperiment(id, parsed.data.userId);
    if (!experiment) return res.status(404).json({ error: 'Experiment not found' });
    if (!experiment.sourceSha256) {
      return res.status(409).json({ error: 'Upload a source file before encoding' });
    }

    const codec = getCodec(profile.mode);
    if (!codec.enabled) {
      return res.status(501).json({ error: 'Advanced codec adapter is not enabled in this version' });
    }

    const fileRecord = await prisma.dnaStorageFile.findFirst({ where: { experimentId: id, purgedAt: null } });
    if (!fileRecord?.storagePath) {
      return res.status(409).json({ error: 'Source file bytes are no longer available (already encoded or purged)' });
    }
    const payload = await fs.readFile(fileRecord.storagePath);

    await prisma.dnaStorageExperiment.update({ where: { id }, data: { status: 'ENCODING' } });
    const strands = codec.encode(payload, id, profile);

    await prisma.dnaStorageStrand.deleteMany({ where: { experimentId: id } });
    await prisma.dnaStorageStrand.createMany({
      data: strands.map((s) => ({
        experimentId: id,
        index: s.index,
        sequence: s.sequence,
        payloadLength: s.payloadLength,
        originalChecksum: s.originalChecksum,
        gcPercent: s.gcPercent,
        maxHomopolymerRun: s.maxHomopolymerRun,
        passedConstraints: s.passedConstraints,
        metadata: s.metadata as object,
      })),
    });

    // Retention rule: purge source bytes after encode; keep SHA-256 + metadata.
    // Swallow filesystem errors here: the worst case (bytes already gone, e.g.
    // a prior partial run) shouldn't fail an otherwise-successful encode.
    await fs.rm(fileRecord.storagePath, { force: true }).catch((rmErr) => {
      logger.warn('dna-storage source purge failed (non-fatal):', rmErr);
    });
    await prisma.dnaStorageFile.update({
      where: { id: fileRecord.id },
      data: { purgedAt: new Date(), storagePath: null },
    });

    const uniqueStrands = new Set(strands.map((s) => s.index)).size;
    const totalBases = strands.reduce((n, s) => n + s.sequence.length, 0);
    const rawPayloadBases = strands.reduce((n, s) => n + s.payloadLength * 4, 0);
    const updated = await prisma.dnaStorageExperiment.update({
      where: { id },
      data: {
        status: 'ENCODED',
        encodingProfileJson: profile as unknown as object,
        prngName: PRNG_NAME,
        prngVersion: PRNG_VERSION,
      },
    });
    await auditAction(
      prisma,
      'POST /api/dna-storage/experiments/:id/encode',
      id,
      'DnaStorageExperiment',
      null,
      experimentAuditMeta(updated, {
        mode: profile.mode,
        uniqueStrands,
        totalStrands: strands.length,
        totalBases,
        encodingOverhead: encodingOverhead(rawPayloadBases, totalBases),
        sourceBytesPurged: true,
      }),
      parsed.data.userId
    );

    return res.json({
      status: 'ENCODED',
      uniqueStrands,
      totalStrands: strands.length,
      totalBases,
      rawPayloadBases,
      encodingOverhead: encodingOverhead(rawPayloadBases, totalBases),
      strandsPassingConstraints: strands.filter((s) => s.passedConstraints).length / Math.max(1, uniqueStrands),
      prng: { name: PRNG_NAME, version: PRNG_VERSION },
    });
  } catch (error) {
    logger.error('dna-storage encode failed:', error);
    await prisma.dnaStorageExperiment
      .update({ where: { id }, data: { status: 'FAILED' } })
      .catch(() => undefined);
    return res.status(500).json({ error: 'Encoding failed' });
  }
});

// POST /experiments/:id/simulate — run a deterministic channel-error simulation
dnaStorageRouter.post('/experiments/:id/simulate', async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = simulateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: `Invalid simulate payload: ${zodErrorMessage(parsed.error)}` });
  }
  const errorProfile = parsed.data.errorProfile as ErrorProfile;

  try {
    const experiment = await findOwnedExperiment(id, parsed.data.userId);
    if (!experiment) return res.status(404).json({ error: 'Experiment not found' });

    const strandRecords = await prisma.dnaStorageStrand.findMany({ where: { experimentId: id } });
    if (strandRecords.length === 0) {
      return res.status(409).json({ error: 'Encode the experiment before simulating' });
    }
    const strands: DnaStrand[] = strandRecords.map((r: Prisma.DnaStorageStrandGetPayload<Record<string, never>>) => ({
      id: r.id,
      experimentId: r.experimentId,
      index: r.index,
      sequence: r.sequence,
      payloadLength: r.payloadLength,
      originalChecksum: r.originalChecksum,
      gcPercent: r.gcPercent,
      maxHomopolymerRun: r.maxHomopolymerRun,
      passedConstraints: r.passedConstraints,
      metadata: (r.metadata ?? {}) as Record<string, unknown>,
    }));

    const { stats } = simulateChannelErrors(strands, errorProfile);
    const errorRun = await prisma.dnaStorageErrorRun.create({
      data: {
        experimentId: id,
        errorProfileJson: errorProfile as unknown as object,
        seed: errorProfile.seed,
        statsJson: stats as unknown as object,
      },
    });
    const updated = await prisma.dnaStorageExperiment.update({
      where: { id },
      data: { status: 'SIMULATING', errorProfileJson: errorProfile as unknown as object, randomSeed: errorProfile.seed },
    });
    await auditAction(
      prisma,
      'POST /api/dna-storage/experiments/:id/simulate',
      id,
      'DnaStorageExperiment',
      null,
      experimentAuditMeta(updated, { errorRunId: errorRun.id, seed: errorProfile.seed, ...stats }),
      parsed.data.userId
    );

    // Estimated affected strands before decode (from the deterministic stats).
    const uniqueStrands = new Set(strands.map((s) => s.index)).size;
    return res.json({
      errorRunId: errorRun.id,
      seed: errorProfile.seed,
      stats,
      uniqueStrands,
      estimatedAffectedStrands: Math.min(uniqueStrands, stats.dropped + stats.duplicated),
      reproducible: true,
      prng: { name: PRNG_NAME, version: PRNG_VERSION },
    });
  } catch (error) {
    logger.error('dna-storage simulate failed:', error);
    return res.status(500).json({ error: 'Simulation failed' });
  }
});

// POST /experiments/:id/decode — reconstruct and verify against the source SHA-256
dnaStorageRouter.post('/experiments/:id/decode', async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = decodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: `Invalid decode payload: ${zodErrorMessage(parsed.error)}` });
  }

  try {
    const experiment = await findOwnedExperiment(id, parsed.data.userId);
    if (!experiment) return res.status(404).json({ error: 'Experiment not found' });
    if (!experiment.sourceSha256 || !experiment.encodingProfileJson) {
      return res.status(409).json({ error: 'Experiment must be encoded before decoding' });
    }

    const strandRecords = await prisma.dnaStorageStrand.findMany({ where: { experimentId: id } });
    if (strandRecords.length === 0) {
      return res.status(409).json({ error: 'Experiment has no strands to decode' });
    }
    const strands: DnaStrand[] = strandRecords.map((r: Prisma.DnaStorageStrandGetPayload<Record<string, never>>) => ({
      id: r.id,
      experimentId: r.experimentId,
      index: r.index,
      sequence: r.sequence,
      payloadLength: r.payloadLength,
      originalChecksum: r.originalChecksum,
      gcPercent: r.gcPercent,
      maxHomopolymerRun: r.maxHomopolymerRun,
      passedConstraints: r.passedConstraints,
      metadata: (r.metadata ?? {}) as Record<string, unknown>,
    }));

    const profile = experiment.encodingProfileJson as EncodingProfile;
    const codec = getCodec(profile.mode);
    if (!codec.enabled) {
      return res.status(501).json({ error: 'Advanced codec adapter is not enabled in this version' });
    }

    // Reproducibility: re-run the same deterministic simulation from the stored
    // error-run profile and seed, then decode the noisy strands.
    let errorProfile: ErrorProfile = { ...ZERO_ERROR_PROFILE, seed: 0 };
    let errorRunId: string | undefined;
    if (parsed.data.errorRunId) {
      const run = await prisma.dnaStorageErrorRun.findUnique({ where: { id: parsed.data.errorRunId } });
      if (!run || run.experimentId !== id) {
        return res.status(404).json({ error: 'Error run not found' });
      }
      errorProfile = run.errorProfileJson as ErrorProfile;
      errorRunId = run.id;
    }

    await prisma.dnaStorageExperiment.update({ where: { id }, data: { status: 'DECODING' } });
    const { noisyStrands } = simulateChannelErrors(strands, errorProfile);
    const { bytes, warnings } = codec.decode(noisyStrands, profile);
    const recoveredChecksum =
      bytes.length > 0 ? crypto.createHash('sha256').update(bytes).digest('hex') : undefined;
    const success = recoveredChecksum === experiment.sourceSha256;

    const expectedIndexes = new Set(strands.map((s) => s.index));
    const receivedIndexes = new Set(noisyStrands.map((s) => s.index));
    const missingStrands = [...expectedIndexes].filter((i) => !receivedIndexes.has(i)).length;

    const decodeResult = {
      success,
      recoveredChecksum,
      expectedChecksum: experiment.sourceSha256,
      recoveredBytes: bytes.length,
      missingStrands,
      corruptedStrands: warnings.filter((w) => w.includes('checksum mismatch')).length,
      correctedStrands: 0,
      uncorrectableStrands: warnings.filter((w) => w.includes('checksum mismatch')).length,
      message: success
        ? 'Recovered the exact original payload: recovered SHA-256 matches the source SHA-256.'
        : 'Recovery failed: the recovered payload does not match the source SHA-256.',
      warnings: success ? warnings : [
        ...warnings,
        missingStrands > 0
          ? `${missingStrands} strand(s) missing at decode time — if dropout exceeds the redundancy factor, missing indexes cannot be reconstructed.`
          : 'Insufficient redundancy or error correction for the configured channel-error rates.',
      ],
    };

    const decodeRun = await prisma.dnaStorageDecodeRun.create({
      data: {
        experimentId: id,
        errorRunId: errorRunId ?? null,
        resultJson: decodeResult as unknown as object,
        success,
      },
    });

    // Generate and persist the reproducible report.
    const report = generateReport({
      experiment: {
        id: experiment.id,
        title: experiment.title,
        description: experiment.description,
        sourceFileName: experiment.sourceFileName,
        sourceFileSizeBytes: experiment.sourceFileSizeBytes,
        sourceSha256: experiment.sourceSha256,
        randomSeed: errorProfile.seed,
        createdAt: experiment.createdAt,
      },
      encodingProfile: profile,
      errorProfile,
      strands,
      decodeResult: decodeResult as never,
    });
    await prisma.dnaStorageReport.create({
      data: {
        experimentId: id,
        markdown: report.markdown,
        reportJson: report.json as object,
      },
    });

    const updated = await prisma.dnaStorageExperiment.update({
      where: { id },
      data: { status: success ? 'COMPLETED' : 'FAILED' },
    });
    await auditAction(
      prisma,
      'POST /api/dna-storage/experiments/:id/decode',
      id,
      'DnaStorageExperiment',
      null,
      experimentAuditMeta(updated, { decodeRunId: decodeRun.id, success, missingStrands, errorRunId }),
      parsed.data.userId
    );

    return res.json({ ...decodeResult, decodeRunId: decodeRun.id, reportAvailable: true });
  } catch (error) {
    logger.error('dna-storage decode failed:', error);
    await prisma.dnaStorageExperiment
      .update({ where: { id }, data: { status: 'FAILED' } })
      .catch(() => undefined);
    return res.status(500).json({ error: 'Decoding failed' });
  }
});

// GET /experiments/:id — experiment details with counts
dnaStorageRouter.get('/experiments/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const experiment = await prisma.dnaStorageExperiment.findUnique({
      where: { id },
      include: {
        _count: { select: { strands: true, errorRuns: true, decodeRuns: true, reports: true } },
      },
    });
    if (!experiment) return res.status(404).json({ error: 'Experiment not found' });
    return res.json(experiment);
  } catch (error) {
    logger.error('dna-storage get experiment failed:', error);
    return res.status(500).json({ error: 'Failed to fetch experiment' });
  }
});

// GET /experiments/:id/strands — paginated, searchable strand table
dnaStorageRouter.get('/experiments/:id/strands', async (req: Request, res: Response) => {
  const { id } = req.params;
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? '50'), 10) || 50));
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  try {
    const experiment = await prisma.dnaStorageExperiment.findUnique({ where: { id } });
    if (!experiment) return res.status(404).json({ error: 'Experiment not found' });

    const where = {
      experimentId: id,
      ...(q ? { sequence: { contains: q.toUpperCase() } } : {}),
    };
    const [total, strands] = await Promise.all([
      prisma.dnaStorageStrand.count({ where }),
      prisma.dnaStorageStrand.findMany({
        where,
        orderBy: { index: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return res.json({ page, pageSize, total, strands });
  } catch (error) {
    logger.error('dna-storage get strands failed:', error);
    return res.status(500).json({ error: 'Failed to fetch strands' });
  }
});

// GET /experiments/:id/report — Markdown or JSON report
dnaStorageRouter.get('/experiments/:id/report', async (req: Request, res: Response) => {
  const { id } = req.params;
  const format = String(req.query.format ?? 'json').toLowerCase();
  try {
    const report = await prisma.dnaStorageReport.findFirst({
      where: { experimentId: id },
      orderBy: { createdAt: 'desc' },
    });
    if (!report) return res.status(404).json({ error: 'Report not found — run a decode first' });
    if (format === 'markdown') {
      return res.type('text/markdown').send(report.markdown);
    }
    return res.json(report.reportJson);
  } catch (error) {
    logger.error('dna-storage get report failed:', error);
    return res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// GET /experiments — list experiments, newest first
dnaStorageRouter.get('/experiments', async (req: Request, res: Response) => {
  try {
    const experiments = await prisma.dnaStorageExperiment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { _count: { select: { strands: true, decodeRuns: true } } },
    });
    return res.json(experiments);
  } catch (error) {
    logger.error('dna-storage list experiments failed:', error);
    return res.status(500).json({ error: 'Failed to list experiments' });
  }
});

// DELETE /experiments/:id — cascade delete + remove any stored file artifacts
dnaStorageRouter.delete('/experiments/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req.body?.userId as string | undefined) ?? undefined;
  try {
    const experiment = await findOwnedExperiment(id, userId);
    if (!experiment) return res.status(404).json({ error: 'Experiment not found' });

    const files = await prisma.dnaStorageFile.findMany({ where: { experimentId: id } });
    for (const file of files) {
      if (file.storagePath) {
        await fs.rm(file.storagePath, { force: true }).catch((rmErr) => {
          logger.warn('dna-storage delete purge failed (non-fatal):', rmErr);
        });
      }
    }
    await prisma.dnaStorageExperiment.delete({ where: { id } });
    await auditAction(
      prisma,
      'DELETE /api/dna-storage/experiments/:id',
      id,
      'DnaStorageExperiment',
      experimentAuditMeta(experiment),
      null,
      userId
    );
    return res.json({ deleted: true, id });
  } catch (error) {
    logger.error('dna-storage delete experiment failed:', error);
    return res.status(500).json({ error: 'Failed to delete experiment' });
  }
});
