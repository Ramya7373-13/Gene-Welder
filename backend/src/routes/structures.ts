// Protein structure upload / retrieval endpoints.
// Mounted at /api by server.ts.
// Session-gated writes/reads; GET /structures/file only resolves paths under
// the backend storage root (no arbitrary filesystem read).

import express from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../prisma.js';
import { logger } from '../utils/logger.js';
import { auditAction } from '../utils/redactor.js';
import { fetchAlphaFoldStructureBackend } from '../utils/alphafoldUtil.js';
import { upload, pdbUpload } from '../lib/uploads.js';
import { requireSession } from '../lib/requireSession.js';

const router = express.Router();

const STRUCTURE_STORAGE_ROOTS = [
  path.resolve('./storage'),
  path.resolve(process.cwd(), 'storage'),
];

function isAllowedStructurePath(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return STRUCTURE_STORAGE_ROOTS.some(
    (root) => resolved === root || resolved.startsWith(root + path.sep)
  );
}

// POST /structures - Upload protein structure file
router.post('/structures', requireSession, upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.body.variantId) {
      return res.status(400).json({ error: 'Missing file or variantId' });
    }

    const fileBuffer = await fs.readFile(req.file.path);
    const checksum = crypto.createHash('sha256')
      .update(fileBuffer)
      .digest('hex');

    const structureFile = await prisma.structureFile.create({
      data: {
        variantId: req.body.variantId,
        file_type: req.body.file_type || 'pdb',
        file_name: req.file.originalname,
        file_size: req.file.size,
        local_path: req.file.path,
        checksum
      }
    });

    // Audit log
    await auditAction(prisma, 'structure_uploaded', structureFile.id, 'StructureFile', null, {
      file_type: structureFile.file_type,
      file_name: structureFile.file_name,
      file_size: structureFile.file_size
    });

    return res.json(structureFile);
  } catch (error) {
    logger.error('Error uploading structure:', error);
    return res.status(500).json({ error: 'Failed to upload structure' });
  }
});

// POST /variants/upload-pdb - Attach a .pdb structure to a Variant's WT/mutant slot
router.post('/variants/upload-pdb', requireSession, pdbUpload.single('file'), async (req, res) => {
  const { variantId, slot } = req.body as { variantId?: string; slot?: string };

  // fileFilter rejects non-.pdb uploads (leaves req.file undefined); also covers a missing file.
  if (!req.file) {
    return res.status(400).json({ error: 'Missing or invalid .pdb file' });
  }

  // Capture concrete values so the cleanup closure is null-safe under strictNullChecks.
  const uploadedPath = req.file.path;
  const originalName = req.file.originalname;
  const fileSize = req.file.size;

  // Remove the file multer already wrote - invoked on every early-exit / failure path.
  const scrubOrphan = async () => {
    try {
      await fs.unlink(uploadedPath);
    } catch (cleanupError) {
      logger.error('Failed to scrub orphan PDB upload:', cleanupError);
    }
  };

  if (!variantId || typeof variantId !== 'string') {
    await scrubOrphan();
    return res.status(400).json({ error: 'Missing variantId' });
  }

  if (slot !== 'wildtype' && slot !== 'mutant') {
    await scrubOrphan();
    return res.status(400).json({ error: "Invalid slot: expected 'wildtype' or 'mutant'" });
  }

  try {
    const variantRecord = await prisma.variant.findUnique({ where: { id: variantId } });
    if (!variantRecord) {
      await scrubOrphan();
      return res.status(404).json({ error: 'Variant not found' });
    }

    const fileBuffer = await fs.readFile(uploadedPath);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const data = slot === 'wildtype'
      ? { wildtype_structure_path: uploadedPath }
      : { mutant_structure_path: uploadedPath };

    const variant = await prisma.variant.update({
      where: { id: variantId },
      data,
    });

    const structureFile = await prisma.structureFile.create({
      data: {
        variantId,
        file_type: 'pdb',
        file_name: originalName,
        file_size: fileSize,
        local_path: uploadedPath,
        checksum,
      },
    });

    await auditAction(prisma, 'pdb_uploaded', variant.id, 'Variant', null, {
      slot,
      file_name: originalName,
      file_size: fileSize,
      structureFileId: structureFile.id,
    });

    return res.json({ variant, structureFile, path: uploadedPath });
  } catch (error) {
    await scrubOrphan();
    logger.error('Error uploading PDB:', error);
    return res.status(500).json({ error: 'Failed to upload PDB' });
  }
});

// GET /structures/file - Fetch PDB file content by path (storage-root only)
router.get('/structures/file', requireSession, async (req, res) => {
  const { path: filePath } = req.query;
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'Missing file path' });
  }
  if (!isAllowedStructurePath(filePath)) {
    return res.status(403).json({ error: 'File path not allowed' });
  }
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return res.type('text/plain').send(content);
  } catch (error) {
    logger.error(`Error reading structure file ${filePath}:`, error);
    return res.status(404).json({ error: 'File not found' });
  }
});

// GET /alphafold/:gene - Fetch structure from public AlphaFold DB
router.get('/alphafold/:gene', async (req, res) => {
  const { gene } = req.params;
  try {
    const structureId = await fetchAlphaFoldStructureBackend(gene);
    res.json({ success: true, structureId });
  } catch (error) {
    logger.error(`Error fetching AlphaFold structure for gene ${gene}:`, error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /test-storage - Verify storage readiness
router.get('/test-storage', requireSession, async (req, res) => {
  try {
    const count = await prisma.structureFile.count();
    return res.json({ status: 'Storage ready', structureCount: count });
  } catch (error) {
    logger.error('Error in test-storage:', error);
    return res.status(500).json({ error: 'Storage test failed' });
  }
});

export { router as structuresRouter };
