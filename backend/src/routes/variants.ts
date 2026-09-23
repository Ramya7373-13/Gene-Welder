// Variant and patient endpoints, including the mock-data ingest batch route.
// Mounted at /api by server.ts.
//
// Extracted verbatim from server.ts by script (app.METHOD -> router.METHOD,
// /api prefix stripped since the router is mounted at /api).

import express from 'express';
import { prisma } from '../prisma.js';
import { logger } from '../utils/logger.js';
import { getSessionFromCookie } from '../lib/session.js';
import { redactSensitive, auditAction } from '../utils/redactor.js';

const router = express.Router();

// Variant routes
router.post('/variants', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    const { patientId, gene, hgvs_c, ...otherData } = req.body;

    // Ensure patient exists or create it
    let patient = await prisma.patient.findUnique({
      where: { patientId }
    });

    if (!patient) {
      patient = await prisma.patient.create({
        data: { patientId }
      });
      await auditAction(prisma, 'patient_created', patient.id, 'Patient', null, { patientId });
    }

    const variant = await prisma.variant.upsert({
      where: {
        patientId_gene_hgvs_c: {
          patientId: patient.id,
          gene,
          hgvs_c
        }
      },
      update: {
        ...otherData
      },
      create: {
        patientId: patient.id,
        gene,
        hgvs_c,
        ...otherData
      }
    });

    await auditAction(prisma, 'variant_updated_or_created', variant.id, 'Variant', null, redactSensitive(req.body));

    return res.json(redactSensitive(variant));
  } catch (error) {
    logger.error('Error upserting variant:', error);
    return res.status(500).json({ error: 'Failed to process variant' });
  }
});

router.post('/patients', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    const { patientId } = req.body;
    const patient = await prisma.patient.create({
      data: { patientId }
    });
    await auditAction(prisma, 'patient_created', patient.id, 'Patient', null, redactSensitive(req.body));
    return res.json(redactSensitive(patient));
  } catch (error) {
    logger.error('Error creating patient:', error);
    return res.status(500).json({ error: 'Failed to create patient' });
  }
});

router.get('/patients', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    const patients = await prisma.patient.findMany({
      select: {
        id: true,
        patientId: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(patients.map((r: any) => redactSensitive(r)));
  } catch (error) {
    logger.error('Error fetching patients:', error);
    return res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// POST /api/variants/mock-ingest - Populate database with realistic sample clinical mutation variant records
router.post('/variants/mock-ingest', async (req, res) => {
  const session = await getSessionFromCookie(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Mock seeding is not available in production' });
  }

  const MOCK_CLINICAL_VARIANTS = [
    {
      patientId: 'P001',
      gene: 'SMN1',
      hgvs_c: 'c.840+2T>G',
      hgvs_p: 'p.Gly281*',
      ref_allele: 'T',
      alt_allele: 'G',
      zygosity: 'homozygous',
      gnomad_freq: 0.00012,
      clinvar_path: true,
      acmg_class: 'PVS1,PM2',
      annotations: { disease: 'Spinal Muscular Atrophy', inheritance: 'autosomal_recessive' },
      plddt_avg: 94.5,
      plddt_per_residue: [92.3, 94.1, 95.8, 93.2, 96.1, 94.8, 97.2, 95.5],
      rmsd_to_wildtype: 2.34,
      wildtype_structure_path: './storage/SMN1_wildtype.pdb',
      mutant_structure_path: './storage/SMN1_c.840+2T>G_mutant.pdb',
      wildtype_chain: 'A',
      mutant_chain: 'A',
      domains_affected: ['SMN Tudor domain'],
      alphaFold_version: 'v3',
      structure_source: 'alphafold_db'
    },
    {
      patientId: 'P001',
      gene: 'SMN2',
      hgvs_c: 'c.85T>G',
      hgvs_p: 'p.Cys29Gly',
      ref_allele: 'T',
      alt_allele: 'G',
      zygosity: 'heterozygous',
      gnomad_freq: 0.0012,
      clinvar_path: false,
      acmg_class: 'BENIGN',
      plddt_avg: 88.2,
      plddt_per_residue: [85.1, 87.3, 89.2, 88.5, 90.1, 87.8],
      rmsd_to_wildtype: 0.89,
      wildtype_structure_path: './storage/SMN2_wildtype.pdb',
      mutant_structure_path: './storage/SMN2_c.85T>G_mutant.pdb',
      wildtype_chain: 'A',
      mutant_chain: 'A',
      domains_affected: [],
      alphaFold_version: 'v3',
      structure_source: 'alphafold_db'
    },
    {
      patientId: 'P002',
      gene: 'BCR-ABL1',
      hgvs_c: 't(9;22)(q34;q11)',
      hgvs_p: 'p210 fusion',
      ref_allele: 'N',
      alt_allele: 'fusion',
      zygosity: 'heterozygous',
      gnomad_freq: 0.0,
      clinvar_path: true,
      acmg_class: 'PVS1',
      annotations: { disease: 'Chronic Myeloid Leukemia', fusion_type: 'BCR-ABL1' },
      plddt_avg: 91.8,
      rmsd_to_wildtype: 3.67,
      wildtype_structure_path: './storage/BCR_wildtype.pdb',
      mutant_structure_path: './storage/BCR-ABL1_fusion.pdb',
      wildtype_chain: 'A',
      mutant_chain: 'A',
      domains_affected: ['SH2 domain', 'Kinase domain'],
      alphaFold_version: 'v3',
      structure_source: 'alphafold_db'
    },
    {
      patientId: 'P003',
      gene: 'BRCA1',
      hgvs_c: 'c.5266dupC',
      hgvs_p: 'p.Gln1756Profs*74',
      ref_allele: 'C',
      alt_allele: 'CC',
      zygosity: 'heterozygous',
      gnomad_freq: 0.0,
      clinvar_path: true,
      acmg_class: 'PVS1,PS2',
      annotations: { disease: 'Hereditary Breast and Ovarian Cancer', domain: 'BRCT domain' },
      plddt_avg: 87.3,
      rmsd_to_wildtype: 4.21,
      wildtype_structure_path: './storage/BRCA1_wildtype.pdb',
      mutant_structure_path: './storage/BRCA1_c.5266dupC_mutant.pdb',
      wildtype_chain: 'A',
      mutant_chain: 'A',
      domains_affected: ['BRCT repeat domain'],
      alphaFold_version: 'v3',
      structure_source: 'alphafold_db'
    },
    {
      patientId: 'P003',
      gene: 'TP53',
      hgvs_c: 'c.524G>A',
      hgvs_p: 'p.Arg175His',
      ref_allele: 'G',
      alt_allele: 'A',
      zygosity: 'heterozygous',
      gnomad_freq: 0.00001,
      clinvar_path: true,
      acmg_class: 'PVS1,PS2',
      annotations: { disease: 'Li-Fraumeni Syndrome', domain: 'DNA-binding domain' },
      plddt_avg: 93.1,
      rmsd_to_wildtype: 1.87,
      wildtype_structure_path: './storage/TP53_wildtype.pdb',
      mutant_structure_path: './storage/TP53_c.524G>A_mutant.pdb',
      wildtype_chain: 'A',
      mutant_chain: 'A',
      domains_affected: ['DNA-binding domain', 'Tetramerization domain'],
      alphaFold_version: 'v3',
      structure_source: 'alphafold_db'
    },
    {
      patientId: 'P004',
      gene: 'CFTR',
      hgvs_c: 'c.1521_1523del',
      hgvs_p: 'p.Phe508del',
      ref_allele: 'TTT',
      alt_allele: 'del',
      zygosity: 'homozygous',
      gnomad_freq: 0.00045,
      clinvar_path: true,
      acmg_class: 'PVS1,PM3',
      annotations: { disease: 'Cystic Fibrosis', domain: 'NBD1' },
      plddt_avg: 86.7,
      rmsd_to_wildtype: 5.43,
      wildtype_structure_path: './storage/CFTR_wildtype.pdb',
      mutant_structure_path: './storage/CFTR_p.Phe508del_mutant.pdb',
      wildtype_chain: 'A',
      mutant_chain: 'A',
      domains_affected: ['Nucleotide-binding domain 1 (NBD1)'],
      alphaFold_version: 'v3',
      structure_source: 'alphafold_db'
    },
    {
      patientId: 'P005',
      gene: 'KRAS',
      hgvs_c: 'c.35G>A',
      hgvs_p: 'p.Gly12Asp',
      ref_allele: 'G',
      alt_allele: 'A',
      zygosity: 'heterozygous',
      gnomad_freq: 0.00002,
      clinvar_path: true,
      acmg_class: 'PVS1,PM2',
      annotations: { disease: 'Pancreatic Cancer', domain: 'Switch I/II region' },
      plddt_avg: 92.4,
      rmsd_to_wildtype: 2.91,
      wildtype_structure_path: './storage/KRAS_wildtype.pdb',
      mutant_structure_path: './storage/KRAS_c.35G>A_mutant.pdb',
      wildtype_chain: 'A',
      mutant_chain: 'A',
      domains_affected: ['GTPase domain', 'Switch I region', 'Switch II region'],
      alphaFold_version: 'v3',
      structure_source: 'alphafold_db'
    },
    {
      patientId: 'P006',
      gene: 'EGFR',
      hgvs_c: 'c.2573T>G',
      hgvs_p: 'p.Leu858Arg',
      ref_allele: 'T',
      alt_allele: 'G',
      zygosity: 'heterozygous',
      gnomad_freq: 0.00000,
      clinvar_path: true,
      acmg_class: 'PVS1',
      annotations: { disease: 'Non-Small Cell Lung Cancer', domain: 'Kinase domain' },
      plddt_avg: 89.6,
      rmsd_to_wildtype: 2.15,
      wildtype_structure_path: './storage/EGFR_wildtype.pdb',
      mutant_structure_path: './storage/EGFR_c.2573T>G_mutant.pdb',
      wildtype_chain: 'A',
      mutant_chain: 'A',
      domains_affected: ['Kinase domain (activation loop)'],
      alphaFold_version: 'v3',
      structure_source: 'alphafold_db'
    },
    {
      patientId: 'P007',
      gene: 'DMD',
      hgvs_c: 'c.262delG',
      hgvs_p: 'p.Ala88fs',
      ref_allele: 'G',
      alt_allele: 'del',
      zygosity: 'hemizygous',
      gnomad_freq: 0.00001,
      clinvar_path: true,
      acmg_class: 'PVS1',
      annotations: { disease: 'Duchenne Muscular Dystrophy', domain: 'N-terminal actin-binding domain' },
      plddt_avg: 78.4,
      rmsd_to_wildtype: 8.92,
      wildtype_structure_path: './storage/DMD_wildtype.pdb',
      mutant_structure_path: './storage/DMD_c.262delG_mutant.pdb',
      wildtype_chain: 'A',
      mutant_chain: 'A',
      domains_affected: ['N-terminal actin-binding domain'],
      alphaFold_version: 'v3',
      structure_source: 'alphafold_db'
    },
    {
      patientId: 'P008',
      gene: 'VHL',
      hgvs_c: 'c.499C>T',
      hgvs_p: 'p.Arg167Trp',
      ref_allele: 'C',
      alt_allele: 'T',
      zygosity: 'heterozygous',
      gnomad_freq: 0.00005,
      clinvar_path: true,
      acmg_class: 'PVS1',
      annotations: { disease: 'Von Hippel-Lindau Disease', domain: 'hydroxylation domain' },
      plddt_avg: 95.2,
      rmsd_to_wildtype: 1.45,
      wildtype_structure_path: './storage/VHL_wildtype.pdb',
      mutant_structure_path: './storage/VHL_c.499C>T_mutant.pdb',
      wildtype_chain: 'A',
      mutant_chain: 'A',
      domains_affected: ['Elongin B/C binding domain'],
      alphaFold_version: 'v3',
      structure_source: 'alphafold_db'
    }
  ];

  const MOCK_PATIENTS = [
    { patientId: 'P001' },
    { patientId: 'P002' },
    { patientId: 'P003' },
    { patientId: 'P004' },
    { patientId: 'P005' },
    { patientId: 'P006' },
    { patientId: 'P007' },
    { patientId: 'P008' }
  ];

  try {
    let patientsCreated = 0;
    let variantsCreated = 0;

    logger.log('=== Starting Mock Data Ingestion ===');

    // PHASE 1: Create all patients first
    logger.log('Phase 1: Creating patients...');
    for (const p of MOCK_PATIENTS) {
      try {
        const patient = await prisma.patient.upsert({
          where: { patientId: p.patientId },
          update: {},
          create: { patientId: p.patientId }
        });
        logger.log(`  Created/found patient: ${p.patientId} (internal ID: ${patient.id})`);
        patientsCreated++;
      } catch (err) {
        console.error(`  ERROR creating patient ${p.patientId}:`, err);
        throw err;
      }
    }
    logger.log(`Phase 1 complete: ${patientsCreated} patients created/found`);

    // PHASE 2: Create all variants
    logger.log('Phase 2: Creating variants...');
    for (const v of MOCK_CLINICAL_VARIANTS) {
      try {
        // Find patient by external patientId to get internal ID
        const patient = await prisma.patient.findUnique({
          where: { patientId: v.patientId }
        });

        if (!patient) {
          console.error(`  ERROR: Patient ${v.patientId} not found for variant ${v.gene} ${v.hgvs_c}`);
          throw new Error(`Patient ${v.patientId} not found`);
        }

        logger.log(`  Processing variant: ${v.gene} ${v.hgvs_c} for patient ${v.patientId} (internal: ${patient.id})`);

        const variant = await prisma.variant.upsert({
          where: {
            patientId_gene_hgvs_c: {
              patientId: patient.id,  // Use internal Prisma ID
              gene: v.gene,
              hgvs_c: v.hgvs_c
            }
          },
          update: {
            hgvs_p: v.hgvs_p,
            ref_allele: v.ref_allele,
            alt_allele: v.alt_allele,
            zygosity: v.zygosity,
            gnomad_freq: v.gnomad_freq,
            clinvar_path: v.clinvar_path,
            acmg_class: v.acmg_class,
            annotations: v.annotations,
            plddt_avg: v.plddt_avg,
            plddt_per_residue: v.plddt_per_residue,
            rmsd_to_wildtype: v.rmsd_to_wildtype,
            wildtype_structure_path: v.wildtype_structure_path,
            mutant_structure_path: v.mutant_structure_path,
            wildtype_chain: v.wildtype_chain,
            mutant_chain: v.mutant_chain,
            domains_affected: v.domains_affected,
            alphaFold_version: v.alphaFold_version,
            structure_source: v.structure_source
          },
          create: {
            patientId: patient.id,  // Use internal Prisma ID
            gene: v.gene,
            hgvs_c: v.hgvs_c,
            hgvs_p: v.hgvs_p,
            ref_allele: v.ref_allele,
            alt_allele: v.alt_allele,
            zygosity: v.zygosity,
            gnomad_freq: v.gnomad_freq,
            clinvar_path: v.clinvar_path,
            acmg_class: v.acmg_class,
            annotations: v.annotations,
            plddt_avg: v.plddt_avg,
            plddt_per_residue: v.plddt_per_residue,
            rmsd_to_wildtype: v.rmsd_to_wildtype,
            wildtype_structure_path: v.wildtype_structure_path,
            mutant_structure_path: v.mutant_structure_path,
            wildtype_chain: v.wildtype_chain,
            mutant_chain: v.mutant_chain,
            domains_affected: v.domains_affected,
            alphaFold_version: v.alphaFold_version,
            structure_source: v.structure_source
          }
        });
        logger.log(`    Successfully created/found variant: ${variant.id}`);
        variantsCreated++;
      } catch (err) {
        console.error(`  ERROR creating variant ${v.gene} ${v.hgvs_c}:`, err);
        throw err;
      }
    }
    logger.log(`Phase 2 complete: ${variantsCreated} variants created/found`);

    await auditAction(prisma, 'mock_data_ingested', 'batch', 'Variant', null, {
      patients_created: patientsCreated,
      variants_created: variantsCreated,
      timestamp: new Date().toISOString()
    });

    logger.log('=== Mock Data Ingestion Complete ===');

    return res.json({
      message: 'Mock clinical data ingested successfully',
      patients_created: patientsCreated,
      variants_created: variantsCreated,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('=== MOCK INGEST ERROR ===');
    console.error('Full error object:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    logger.error('Error in mock-ingest:', error);
    return res.status(500).json({ 
      error: 'Mock data ingestion failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

router.get('/variants', async (req, res) => {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    const { patientId } = req.query;
    const variants = await prisma.variant.findMany({
      where: patientId ? {
        patient: { patientId: patientId as string }
      } : {},
      orderBy: { id: 'desc' }
    });
    return res.json(variants.map((r: any) => redactSensitive(r)));
  } catch (error) {
    logger.error('Error fetching variants:', error);
    return res.status(500).json({ error: 'Failed to fetch variants' });
  }
});

export { router as variantsRouter };
