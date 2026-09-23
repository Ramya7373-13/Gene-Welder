// SpliceAI scoring and a clinical-schema connectivity check.
// Mounted at /api by server.ts.
//
// NOTE: /spliceai returns 503 with source:"SIMULATION" when the upstream is
// unavailable — that fail-closed shape is part of the API contract.

import express from 'express';
import { prisma } from '../prisma.js';
import { logger } from '../utils/logger.js';
import { runSpliceAi } from '../utils/spliceaiUtil.js';

const router = express.Router();

router.post('/spliceai', async (req, res) => {
  const { gene, variant, chromosome, position, reference, alternate } = req.body as {
    gene?: string;
    variant?: string;
    chromosome?: string;
    position?: number;
    reference?: string;
    alternate?: string;
  };

  if (!gene || (!variant && (!chromosome || !position))) {
    return res.status(400).json({
      source: 'SIMULATION',
      error: 'gene and either variant notation or genomic coordinates (chromosome, position, ref, alt) are required'
    });
  }

  try {
    const result = await runSpliceAi({ gene, variant, chromosome, position, reference, alternate });
    return res.json(result);
  } catch (error) {
    logger.warn('SpliceAI unavailable:', error);
    return res.status(503).json({ source: 'SIMULATION', error: (error as Error).message });
  }
});

// Test clinical variant schema endpoint
router.get('/test-schema', async (req, res) => {
  try {
    const count = await prisma.variant.count();
    return res.json({ status: 'Schema ready', variantCount: count });
  } catch (error) {
    logger.error('Error in test-schema:', error);
    return res.status(500).json({ error: 'Schema test failed' });
  }
});

export { router as genomicsRouter };
