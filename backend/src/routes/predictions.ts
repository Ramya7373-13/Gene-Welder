// ML prediction logging, model registry listing, and dev seed endpoints.
// Mounted at /api by server.ts.
//
// IMPORTANT: the seed script import below is `'../../prisma/seed.js'`, not
// `'../prisma/seed.js'`. From this file's location (src/routes/) the single-dot
// form would resolve to src/prisma/seed.js, which does not exist — the actual
// script lives at backend/prisma/seed.ts. Do not "simplify" this back.
//
// SECURITY FIX (this session): /predictions, /seed-models and /seed-clinical
// previously had NO authentication check — anyone could write prediction rows
// or trigger a bulk reseed. All three now require a valid session (401
// otherwise). The frontend already sent `credentials: 'include'` to
// /predictions, so no client change was needed; the two seed endpoints had no
// frontend callers.
//
// Note: these are authenticated but NOT admin-restricted — any logged-in user
// can still trigger a reseed. Tightening that needs a role field on User.

import express from 'express';
import { prisma } from '../prisma.js';
import { logger } from '../utils/logger.js';
import { getSessionFromCookie } from '../lib/session.js';

const router = express.Router();

// POST /api/predictions - Log an ML prediction
router.post('/predictions', async (req, res) => {
  try {
    // Auth check — previously unauthenticated, so anyone could write prediction
    // rows. The frontend already sends credentials on this call.
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    const {
      variantId,
      modelId,
      model_name,
      model_version,
      model_provider,
      raw_prompt,
      raw_response,
      parsed_output,
      execution_time,
      confidence
    } = req.body;

    const prediction = await prisma.prediction.create({
      data: {
        variantId,
        modelId,
        model_name,
        model_version,
        model_provider: model_provider || 'google',
        raw_prompt,
        raw_response,
        parsed_output,
        execution_time: execution_time || 0,
        confidence
      }
    });

    return res.json(prediction);
  } catch (error) {
    logger.error('Error logging prediction:', error);
    return res.status(500).json({ error: 'Failed to log prediction' });
  }
});

// GET /api/models - List active ML models
router.get('/models', async (req, res) => {
  try {
    const models = await prisma.modelRegistry.findMany({
      where: { is_active: true }
    });
    return res.json(models);
  } catch (error) {
    logger.error('Error fetching models:', error);
    return res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// POST /api/seed-models - Seed initial models
router.post('/seed-models', async (req, res) => {
  try {
    // Auth check — previously unauthenticated, so anyone could trigger a reseed.
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    // Dynamic import for the seed script
    const seed = await import('../../prisma/seed.js');
    await seed.main();
    return res.json({ status: 'Models seeded' });
  } catch (error) {
    logger.error('Error seeding models:', error);
    return res.status(500).json({ error: 'Failed to seed models' });
  }
});

// TEMPORARY: POST /api/seed-clinical - Bulk seed clinical data
router.post('/seed-clinical', async (req, res) => {
  try {
    // Auth check — previously unauthenticated, so anyone could trigger a bulk
    // clinical reseed (upserts ~61 patients/variants/predictions).
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    const CLINICAL_PATIENTS = [
      { patientId: 'P123' },
      { patientId: 'P456' },
      { patientId: 'P789' },
      { patientId: 'P101' }
    ];

    const REAL_CLINICAL_VARIANTS = [
      { patientId: 'P123', gene: 'SMN1', hgvs_c: 'c.840+2T>G', hgvs_p: 'p.Gly281*', gnomad_freq: 0.00012, clinvar_path: true, acmg_class: 'PVS1+PM2' },
      { patientId: 'P123', gene: 'SMN2', hgvs_c: 'c.85T>G', hgvs_p: 'p.Cys29Gly', gnomad_freq: 0.0012, clinvar_path: false },
      { patientId: 'P456', gene: 'CFTR', hgvs_c: 'c.1520_1523del', hgvs_p: 'p.Phe508del', gnomad_freq: 0.00045, clinvar_path: true, acmg_class: 'PVS1+PM3' },
      { patientId: 'P789', gene: 'BRCA1', hgvs_c: 'c.5266dupC', hgvs_p: 'p.Gln1756Profs74', gnomad_freq: 0.0, clinvar_path: true },
      { patientId: 'P789', gene: 'BRCA2', hgvs_c: 'c.5946delT', hgvs_p: 'p.Ser1989Argfs5', gnomad_freq: 0.0, clinvar_path: true },
      { patientId: 'P101', gene: 'BCR-ABL1', hgvs_c: 't(9;22)(q34;q11)', hgvs_p: 'p210 fusion', gnomad_freq: 0.0, clinvar_path: true, acmg_class: 'PVS1' },
      { patientId: 'P101', gene: 'EML4-ALK', hgvs_c: 't(2;5)(p21;p23)', hgvs_p: 'p.E13;A20 fusion', gnomad_freq: 0.0, clinvar_path: true },
      // 10 NEW VARIETY VARIANTS
      { patientId: 'P789', gene: 'TP53', hgvs_c: 'c.524G>A', hgvs_p: 'p.Arg175His', gnomad_freq: 0.00001, clinvar_path: true, acmg_class: 'PVS1+PS2' },
      { patientId: 'P789', gene: 'KRAS', hgvs_c: 'c.35G>A', hgvs_p: 'p.Gly12Asp', gnomad_freq: 0.00002, clinvar_path: true, acmg_class: 'PVS1+PM2' },
      { patientId: 'P789', gene: 'EGFR', hgvs_c: 'c.2573T>G', hgvs_p: 'p.Leu858Arg', gnomad_freq: 0.00000, clinvar_path: true, acmg_class: 'PVS1' },
      { patientId: 'P789', gene: 'BRAF', hgvs_c: 'c.1799T>A', hgvs_p: 'p.Val600Glu', gnomad_freq: 0.00003, clinvar_path: true, acmg_class: 'PVS1' },
      { patientId: 'P101', gene: 'VHL', hgvs_c: 'c.499C>T', hgvs_p: 'p.Arg167Trp', gnomad_freq: 0.00005, clinvar_path: true, acmg_class: 'PVS1' },
      { patientId: 'P123', gene: 'MTHFR', hgvs_c: 'c.677C>T', hgvs_p: 'p.Ala222Val', gnomad_freq: 0.35, clinvar_path: false, acmg_class: 'BENIGN' },
      { patientId: 'P123', gene: 'DMD', hgvs_c: 'c.262delG', hgvs_p: 'p.Ala88fs', gnomad_freq: 0.00001, clinvar_path: true, acmg_class: 'PVS1' },
      { patientId: 'P456', gene: 'HBB', hgvs_c: 'c.20A>T', hgvs_p: 'p.Glu6Val', gnomad_freq: 0.05, clinvar_path: true, acmg_class: 'PVS1' },
      { patientId: 'P456', gene: 'PAH', hgvs_c: 'c.1222C>T', hgvs_p: 'p.Arg408Trp', gnomad_freq: 0.00018, clinvar_path: true, acmg_class: 'PVS1' },
      { patientId: 'P101', gene: 'FBN1', hgvs_c: 'c.3046T>C', hgvs_p: 'p.Cys1016Arg', gnomad_freq: 0.00009, clinvar_path: true, acmg_class: 'PVS1' }
    ];

    const SCALE_VARIANTS = [];
    for (let i = 1; i <= 45; i++) {
      const pId = CLINICAL_PATIENTS[i % CLINICAL_PATIENTS.length].patientId;
      SCALE_VARIANTS.push({
        patientId: pId,
        gene: `GENE-${1000 + i}`,
        hgvs_c: `c.${200 + i}A>G`,
        hgvs_p: `p.Thr${50 + i}Ala`,
        gnomad_freq: Math.random() * 0.01,
        clinvar_path: i % 5 === 0,
        acmg_class: i % 5 === 0 ? 'VUS' : 'BENIGN'
      });
    }

    const ALL_VARIANTS = [...REAL_CLINICAL_VARIANTS, ...SCALE_VARIANTS];
    const patientMap: Record<string, string> = {};

    for (const p of CLINICAL_PATIENTS) {
      const patient = await prisma.patient.upsert({
        where: { patientId: p.patientId },
        update: {},
        create: { patientId: p.patientId }
      });
      patientMap[p.patientId] = patient.id;
    }

    for (const v of ALL_VARIANTS) {
      const internalId = patientMap[v.patientId];
      const variant = await prisma.variant.upsert({
        where: { patientId_gene_hgvs_c: { patientId: internalId, gene: v.gene, hgvs_c: v.hgvs_c } },
        update: { hgvs_p: v.hgvs_p, gnomad_freq: v.gnomad_freq, clinvar_path: v.clinvar_path, acmg_class: v.acmg_class },
        create: {
          patientId: internalId,
          gene: v.gene,
          hgvs_c: v.hgvs_c,
          hgvs_p: v.hgvs_p,
          gnomad_freq: v.gnomad_freq,
          clinvar_path: v.clinvar_path,
          acmg_class: v.acmg_class,
          zygosity: 'heterozygous',
          ref_allele: v.hgvs_c.includes('>') ? v.hgvs_c.split('>')[0].slice(-1) : 'N',
          alt_allele: v.hgvs_c.includes('>') ? v.hgvs_c.split('>')[1] : 'N'
        }
      });

      await prisma.prediction.create({
        data: {
          variantId: variant.id,
          modelId: 'cmjeue3dp0000vou72g6ouie8',
          model_name: 'gemini-1.5-pro',
          model_version: '20241217',
          model_provider: 'google',
          parsed_output: {
            pathogenicity: v.clinvar_path ? 'PATHOGENIC' : 'Benign',
            splicing_impact: v.gene === 'SMN1' ? 'HIGH' : 'LOW',
            fusion_partner: v.gene.includes('-') ? v.gene.split('-')[1] : null
          },
          confidence: 0.92,
          execution_time: 2450
        }
      });
    }

    return res.json({ message: 'Seeding successful', count: ALL_VARIANTS.length });
  } catch (error) {
    logger.error('Error in bulk seed:', error);
    return res.status(500).json({ error: 'Bulk seed failed' });
  }
});

export { router as predictionsRouter };
