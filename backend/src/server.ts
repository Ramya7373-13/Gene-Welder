// MUST be first - ensure environment variables are loaded before any other imports
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import { prisma } from './prisma.js';
import { logger } from './utils/logger.js';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { redactSensitive, auditAction } from './utils/redactor.js';
import { fetchAlphaFoldStructureBackend } from './utils/alphafoldUtil.js';
import { runSpliceAi } from './utils/spliceaiUtil.js';
import { getAlphaMissenseScore } from './utils/alphamissenseUtil.js';
import { GoogleGenAI } from '@google/genai';

// Defensive logging to check if DATABASE_URL is available
logger.log('DATABASE_URL present:', !!process.env.DATABASE_URL);

const geminiCache = new Map<string, { timestamp: number; data: any }>();
const GEMINI_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

const app = express();
const PORT = process.env.PORT || 5000;

// Multer storage configuration
const multerStorage = multer.diskStorage({
  destination: './storage/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage: multerStorage });

// Prisma client is now imported from ./prisma.js

// Test database connection on startup with defensive error handling
async function testDbConnection() {
  if (!prisma) {
    logger.error('Prisma Client not initialized');
    return;
  }

  try {
    await prisma.$connect();
    logger.log('✓ Connected to database');
  } catch (error) {
    logger.error('✗ Database connection failed:', error);
    logger.log('Note: Database connection is required for full functionality');
  }
}

// Run connection test with async/await handling to prevent crashes
testDbConnection().catch(error => {
  logger.error('Database connection test failed:', error);
  logger.log('Server will continue running without database connection');
});

// Middleware
const configuredFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
const isAllowedFrontendOrigin = (origin?: string) => {
  if (!origin) return true;
  if (origin === configuredFrontendUrl) return true;
  try {
    const parsed = new URL(origin);
    return parsed.hostname === 'localhost' && parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

app.use(cors({
  origin: (origin, callback) => callback(null, isAllowedFrontendOrigin(origin) ? origin : false),
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Audit middleware
app.use(async (req, res, next) => {
  const start = Date.now();

  res.on('finish', async () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    // Audit API endpoints only, for successful requests
    if (req.path.startsWith('/api/') && statusCode < 400 && req.method !== 'GET') {
      try {
        const entityParts = req.path.split('/');
        const entityTypeRaw = entityParts[entityParts.length - 1] || 'N/A';
        const entityType = entityTypeRaw.replace(/s$/, ''); // variants -> variant

        await auditAction(
          prisma,
          `${req.method} ${req.path}`,
          req.body.id || req.params.id || 'N/A',
          entityType,
          null, // oldValues
          redactSensitive(req.body),
          req.body.userId
        );
      } catch (error) {
        logger.error('Middleware Audit failure:', error);
      }
    }
  });

  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'MutationMechanic Backend API' });
});

// Health check endpoint with lightweight cached service status
app.get('/api/health', async (req, res) => {
  const healthData = {
    app: 'ok',
    db: 'unavailable',
    timestamp: new Date().toISOString(),
    services: {
      gemini: {
        status: process.env.GEMINI_API_KEY ? 'ok' : 'unconfigured',
        model: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
        configured: Boolean(process.env.GEMINI_API_KEY)
      },
      alphamissense: {
        status: 'ok',
        source: 'DeepMind Precomputed + MyVariant.info REST',
        license: 'CC BY 4.0'
      },
      spliceai: {
        status: 'ok',
        source: 'Illumina Precomputed + MyVariant.info REST',
        rateLimit: '4 req/sec (client throttled)'
      },
      alphafold: {
        status: 'ok',
        source: 'ESMAtlas Proxy / EBI AlphaFold DB'
      }
    }
  };

  try {
    // Perform a lightweight query to check DB connectivity
    if (prisma) {
      await prisma.$executeRawUnsafe('SELECT 1');
      healthData.db = 'ok';
    }
  } catch (error) {
    logger.error('Health check DB failed:', error);
    healthData.db = 'unavailable';
  }

  return res.json(healthData);
});

app.post('/api/ai/variant-analysis', async (req, res) => {
  const { gene, variant, mode = 'explainer' } = req.body as {
    gene?: string;
    variant?: string;
    mode?: 'explainer' | 'design';
  };

  if (!gene || !variant) {
    return res.status(400).json({ error: 'gene and variant are required' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'Gemini integration is not configured' });
  }

  const cacheKey = `${mode}:${gene}:${variant}`.toUpperCase();
  const cached = geminiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < GEMINI_CACHE_TTL) {
    return res.json({ ...cached.data, source: 'CACHE' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `You are a molecular biologist analyzing ${gene} ${variant} for the ${mode} workflow.
Return only valid JSON with this shape:
{
  "variant": { "protein": "${gene}", "hgvs": "${variant}", "disease": "", "id": "${gene}-${variant}", "uniprot": "", "sequence": "", "mutantSequence": "", "mutationPositionInSnippet": 1 },
  "mechanism": "",
  "analysis": { "summary": "", "compensatory_mutations": [{ "mutation": "", "reasoning": "", "confidence": 0.0 }] },
  "predictions": {
    "native": { "plddt_avg": 0, "domains": [] },
    "mutant": { "plddt_avg": 0, "rmsd_to_native": 0, "domains_affected": [] },
    "delta": { "rmsd": 0, "confidence_drop": 0, "functional_impact": "" }
  },
  "riskScore": 0,
  "confidence": 0,
  "proteinChange": "${variant}",
  "consequence": "missense"
}
Use cautious scientific language, do not invent citations, and keep confidence values between 0 and 1 for compensatory mutations and 0 and 100 elsewhere.`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    if (!response.text) {
      return res.status(502).json({ error: 'Gemini returned an empty response' });
    }

    const data = JSON.parse(response.text);
    
    // Attach AlphaMissense pathogenicity score
    let alphaMissense = null;
    try {
      alphaMissense = await getAlphaMissenseScore(gene, variant);
    } catch (amErr) {
      logger.warn('AlphaMissense score lookup failed:', amErr);
    }

    const payload = {
      ...data,
      aiAnalysis: data.analysis,
      variantId: `${gene}-${variant}`,
      alphaMissense,
      source: 'API'
    };
    geminiCache.set(cacheKey, { timestamp: Date.now(), data: payload });
    return res.json(payload);
  } catch (error) {
    logger.error('Gemini variant analysis failed:', error);
    return res.status(502).json({ error: 'Gemini analysis failed' });
  }
});

app.post('/api/alphamissense', async (req, res) => {
  const { gene, variant } = req.body as { gene?: string; variant?: string };
  if (!gene || !variant) {
    return res.status(400).json({ error: 'gene and variant are required for AlphaMissense' });
  }

  try {
    const result = await getAlphaMissenseScore(gene, variant);
    return res.json(result);
  } catch (error) {
    logger.error('AlphaMissense endpoint failed:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/alphamissense/:gene/:variant', async (req, res) => {
  const { gene, variant } = req.params;
  try {
    const result = await getAlphaMissenseScore(gene, variant);
    return res.json(result);
  } catch (error) {
    logger.error('AlphaMissense GET endpoint failed:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  const { message, context, history = [] } = req.body as {
    message?: string;
    context?: string;
    history?: Array<{ role: 'user' | 'model'; parts: { text: string }[] }>;
  };

  if (!message) return res.status(400).json({ error: 'message is required' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'Gemini integration is not configured' });

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_CHAT_MODEL || 'gemini-3-flash-preview',
      contents: [
        ...(history || []).map(item => ({ role: item.role, parts: item.parts })),
        { role: 'user', parts: [{ text: `Context:\n${context || 'No variant context'}\n\nQuestion:\n${message}` }] }
      ]
    });
    return res.json({ text: response.text || '', source: 'API' });
  } catch (error) {
    logger.error('Gemini chat failed:', error);
    return res.status(502).json({ error: 'Gemini chat failed' });
  }
});

app.post('/api/ai/clinical-analysis', async (req, res) => {
  const { gene, variant } = req.body as { gene?: string; variant?: string };
  if (!gene || !variant) return res.status(400).json({ error: 'gene and variant are required' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'Gemini integration is not configured' });

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
      contents: `Analyze ${gene} ${variant} as a clinical genetics expert. Return only JSON with pathogenicity, confidence, confidenceScore, diseases, inheritanceMode, mechanism, clinicalSignificance, populationFrequency, treatments, phenotype, citations, and drugInteractions. Do not claim certainty beyond available evidence.`,
      config: { responseMimeType: 'application/json', temperature: 0.3 }
    });
    if (!response.text) return res.status(502).json({ error: 'Gemini returned an empty response' });
    return res.json({ ...JSON.parse(response.text), variantId: `${gene}-${variant}`, gene, timestamp: Date.now(), source: 'API' });
  } catch (error) {
    logger.error('Gemini clinical analysis failed:', error);
    return res.status(502).json({ error: 'Gemini clinical analysis failed' });
  }
});

app.post('/api/spliceai', async (req, res) => {
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
app.get('/api/test-schema', async (req, res) => {
  try {
    const count = await prisma.variant.count();
    return res.json({ status: 'Schema ready', variantCount: count });
  } catch (error) {
    logger.error('Error in test-schema:', error);
    return res.status(500).json({ error: 'Schema test failed' });
  }
});

// POST /api/structures - Upload protein structure file
app.post('/api/structures', upload.single('file'), async (req, res) => {
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

// GET /api/structures/file - Fetch PDB file content by path
app.get('/api/structures/file', async (req, res) => {
  const { path: filePath } = req.query;
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'Missing file path' });
  }
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return res.type('text/plain').send(content);
  } catch (error) {
    logger.error(`Error reading structure file ${filePath}:`, error);
    return res.status(404).json({ error: 'File not found' });
  }
});

// GET /api/alphafold/:gene - Fetch structure from public AlphaFold DB
app.get('/api/alphafold/:gene', async (req, res) => {
  const { gene } = req.params;
  try {
    const structureId = await fetchAlphaFoldStructureBackend(gene);
    res.json({ success: true, structureId });
  } catch (error) {
    logger.error(`Error fetching AlphaFold structure for gene ${gene}:`, error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/test-storage - Verify storage readiness
app.get('/api/test-storage', async (req, res) => {
  try {
    const count = await prisma.structureFile.count();
    return res.json({ status: 'Storage ready', structureCount: count });
  } catch (error) {
    logger.error('Error in test-storage:', error);
    return res.status(500).json({ error: 'Storage test failed' });
  }
});

// Variant routes
app.post('/api/variants', async (req, res) => {
  try {
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

    return res.json(variant);
  } catch (error) {
    logger.error('Error upserting variant:', error);
    return res.status(500).json({ error: 'Failed to process variant' });
  }
});

app.post('/api/patients', async (req, res) => {
  try {
    const { patientId, name } = req.body;
    const patient = await prisma.patient.create({
      data: { patientId, name }
    });
    await auditAction(prisma, 'patient_created', patient.id, 'Patient', null, redactSensitive(req.body));
    return res.json(patient);
  } catch (error) {
    logger.error('Error creating patient:', error);
    return res.status(500).json({ error: 'Failed to create patient' });
  }
});

app.get('/api/patients', async (req, res) => {
  try {
    const patients = await prisma.patient.findMany({
      select: {
        id: true,
        patientId: true,
        name: true,     // ← CRITICAL: Include name!
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(patients);
  } catch (error) {
    logger.error('Error fetching patients:', error);
    return res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// POST /api/variants/mock-ingest - Populate database with realistic sample clinical mutation variant records
app.post('/api/variants/mock-ingest', async (req, res) => {
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
    { patientId: 'P001', name: 'John Smith - SMA Diagnosis' },
    { patientId: 'P002', name: 'Sarah Johnson - CML with BCR-ABL1 Fusion' },
    { patientId: 'P003', name: 'Michael Brown - Hereditary Breast Cancer' },
    { patientId: 'P004', name: 'Emily Davis - Cystic Fibrosis' },
    { patientId: 'P005', name: 'Robert Martinez - Pancreatic Cancer' },
    { patientId: 'P006', name: 'Jennifer Wilson - NSCLC' },
    { patientId: 'P007', name: 'David Anderson - DMD' },
    { patientId: 'P008', name: 'Lisa Thompson - VHL Disease' }
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
          update: { name: p.name },
          create: { patientId: p.patientId, name: p.name }
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

app.get('/api/variants', async (req, res) => {
  try {
    const { patientId } = req.query;
    const variants = await prisma.variant.findMany({
      where: patientId ? {
        patient: { patientId: patientId as string }
      } : {},
      orderBy: { id: 'desc' }
    });
    return res.json(variants);
  } catch (error) {
    logger.error('Error fetching variants:', error);
    return res.status(500).json({ error: 'Failed to fetch variants' });
  }
});

// Audit routes
app.get('/api/audits', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const audits = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return res.json(audits);
  } catch (error) {
    logger.error('Error fetching audits:', error);
    return res.status(500).json({ error: 'Failed to fetch audits' });
  }
});

app.get('/api/audits/stats', async (req, res) => {
  try {
    // Note: Prisma 7 $queryRaw requires specific treatment for PostgreSQL types if using strings
    const stats = await prisma.$queryRaw`
      SELECT 
        "entityType", 
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM "createdAt")::int) as avg_time
      FROM "audit_logs" 
      WHERE "createdAt" > NOW() - INTERVAL '24 hours'
      GROUP BY "entityType"
    `;

    // Convert BigInt to Number for JSON serialization if needed
    const serializedStats = JSON.parse(JSON.stringify(stats, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    return res.json(serializedStats);
  } catch (error) {
    logger.error('Error fetching audit stats:', error);
    return res.status(500).json({ error: 'Failed to fetch audit stats' });
  }
});
// POST /api/predictions - Log an ML prediction
app.post('/api/predictions', async (req, res) => {
  try {
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
app.get('/api/models', async (req, res) => {
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
app.post('/api/seed-models', async (req, res) => {
  try {
    // Dynamic import for the seed script
    const seed = await import('../prisma/seed.js');
    await seed.main();
    return res.json({ status: 'Models seeded' });
  } catch (error) {
    logger.error('Error seeding models:', error);
    return res.status(500).json({ error: 'Failed to seed models' });
  }
});

// TEMPORARY: POST /api/seed-clinical - Bulk seed clinical data
app.post('/api/seed-clinical', async (req, res) => {
  try {
    const CLINICAL_PATIENTS = [
      { patientId: 'P123', name: 'SMA Patient A' },
      { patientId: 'P456', name: 'Cystic Fibrosis Cohort' },
      { patientId: 'P789', name: 'Cancer Panel 1' },
      { patientId: 'P101', name: 'Rare Disease Family' }
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
        update: { name: p.name },
        create: p
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

// User routes
app.post('/api/users', async (req, res) => {
  try {
    const { email, name } = req.body;
    const user = await prisma.user.create({
      data: {
        email,
        name
      }
    });
    return res.json(user);
  } catch (error) {
    logger.error('Error creating user:', error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        analyses: true,
        userPreferences: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (error) {
    logger.error('Error fetching user:', error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Analysis routes
app.post('/api/analyses', async (req, res) => {
  try {
    const { userId, gene, variant, ...analysisData } = req.body;
    const analysis = await prisma.analysis.create({
      data: {
        userId,
        gene,
        variant,
        ...analysisData
      }
    });
    return res.json(analysis);
  } catch (error) {
    logger.error('Error creating analysis:', error);
    return res.status(500).json({ error: 'Failed to create analysis' });
  }
});

app.get('/api/analyses', async (req, res) => {
  try {
    const { userId } = req.query;
    const analyses = await prisma.analysis.findMany({
      where: {
        userId: userId as string
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(analyses);
  } catch (error) {
    logger.error('Error fetching analyses:', error);
    return res.status(500).json({ error: 'Failed to fetch analyses' });
  }
});

app.get('/api/analyses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const analysis = await prisma.analysis.findUnique({
      where: { id },
      include: {
        user: true,
        historyRecords: true,
        splicingAnalysis: true
      }
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    return res.json(analysis);
  } catch (error) {
    logger.error('Error fetching analysis:', error);
    return res.status(500).json({ error: 'Failed to fetch analysis' });
  }
});

// History routes
app.post('/api/history', async (req, res) => {
  try {
    const { userId, analysisId, gene, variant, ...historyData } = req.body;
    const history = await prisma.historyRecord.create({
      data: {
        userId,
        analysisId,
        gene,
        variant,
        ...historyData
      }
    });
    return res.json(history);
  } catch (error) {
    logger.error('Error creating history record:', error);
    return res.status(500).json({ error: 'Failed to create history record' });
  }
});

app.get('/api/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const history = await prisma.historyRecord.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 50 // Limit to last 50 records
    });
    return res.json(history);
  } catch (error) {
    logger.error('Error fetching history records:', error);
    return res.status(500).json({ error: 'Failed to fetch history records' });
  }
});

// Splicing analysis routes
app.post('/api/splicing', async (req, res) => {
  try {
    const { userId, analysisId, gene, variant, ...splicingData } = req.body;
    const splicingAnalysis = await prisma.splicingAnalysis.create({
      data: {
        userId,
        analysisId,
        gene,
        variant,
        ...splicingData
      }
    });
    return res.json(splicingAnalysis);
  } catch (error) {
    logger.error('Error creating splicing analysis:', error);
    return res.status(500).json({ error: 'Failed to create splicing analysis' });
  }
});

// Sharing routes
app.post('/api/share', async (req, res) => {
  try {
    const { analysisId, sharedWithId, permissionType, isPublic } = req.body;
    const shareToken = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const sharedAccess = await prisma.sharedAccess.create({
      data: {
        analysisId,
        sharedById: req.body.userId, // This should come from authentication
        sharedWithId,
        shareToken,
        permissionType,
        isPublic
      }
    });

    return res.json(sharedAccess);
  } catch (error) {
    logger.error('Error creating shared access:', error);
    return res.status(500).json({ error: 'Failed to create shared access' });
  }
});

// Comments routes
app.post('/api/comments', async (req, res) => {
  try {
    const { analysisId, userId, content, parentId } = req.body;
    const comment = await prisma.comment.create({
      data: {
        analysisId,
        userId,
        content,
        parentId
      }
    });
    return res.json(comment);
  } catch (error) {
    logger.error('Error creating comment:', error);
    return res.status(500).json({ error: 'Failed to create comment' });
  }
});

app.get('/api/comments/:analysisId', async (req, res) => {
  try {
    const { analysisId } = req.params;
    const comments = await prisma.comment.findMany({
      where: { analysisId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    return res.json(comments);
  } catch (error) {
    logger.error('Error fetching comments:', error);
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// LONGEVITY RISK ASSESSMENT ENDPOINTS

// GET /api/risk-assessments - Get all risk assessments for a patient
app.get('/api/risk-assessments', async (req, res) => {
  try {
    const { patientId } = req.query;
    const assessments = await prisma.riskAssessment.findMany({
      where: patientId ? { patientId: patientId as string } : {},
      include: {
        variant: true,
        patient: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(assessments);
  } catch (error) {
    logger.error('Error fetching risk assessments:', error);
    return res.status(500).json({ error: 'Failed to fetch risk assessments' });
  }
});

// POST /api/risk-assessments - Create or update a risk assessment
app.post('/api/risk-assessments', async (req, res) => {
  try {
    const { patientId, variantId, diseaseType, riskScore, biologicalAge,
            relativeRisk, confidenceIntervalLower, confidenceIntervalUpper,
            riskTrajectoryCurrent, riskTrajectory5Year, riskTrajectory10Year,
            riskTrajectoryLifetime, severityLevel, riskCategory } = req.body;

    const assessment = await prisma.riskAssessment.create({
      data: {
        patientId,
        variantId,
        diseaseType,
        riskScore,
        biologicalAge: biologicalAge || null,
        relativeRisk,
        confidenceIntervalLower,
        confidenceIntervalUpper,
        riskTrajectoryCurrent: riskTrajectoryCurrent || null,
        riskTrajectory5Year: riskTrajectory5Year || null,
        riskTrajectory10Year: riskTrajectory10Year || null,
        riskTrajectoryLifetime: riskTrajectoryLifetime || null,
        severityLevel,
        riskCategory
      },
      include: {
        variant: true,
        patient: true
      }
    });

    return res.json(assessment);
  } catch (error) {
    logger.error('Error creating risk assessment:', error);
    return res.status(500).json({ error: 'Failed to create risk assessment' });
  }
});

// GET /api/interventions - Get interventions for a risk assessment
app.get('/api/interventions', async (req, res) => {
  try {
    const { riskAssessmentId } = req.query;
    const interventions = await prisma.intervention.findMany({
      where: riskAssessmentId ? { riskAssessmentId: riskAssessmentId as string } : {},
      include: {
        riskAssessment: {
          include: {
            patient: true,
            variant: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(interventions);
  } catch (error) {
    logger.error('Error fetching interventions:', error);
    return res.status(500).json({ error: 'Failed to fetch interventions' });
  }
});

// POST /api/interventions - Create an intervention
app.post('/api/interventions', async (req, res) => {
  try {
    const { riskAssessmentId, interventionType, interventionName, interventionDescription,
            evidenceLevel, expectedRiskReduction, preventableYears, recommended } = req.body;

    const intervention = await prisma.intervention.create({
      data: {
        riskAssessmentId,
        interventionType,
        interventionName,
        interventionDescription: interventionDescription || '',
        evidenceLevel,
        expectedRiskReduction: expectedRiskReduction || null,
        preventableYears: preventableYears || null,
        recommended: recommended !== undefined ? recommended : true
      },
      include: {
        riskAssessment: {
          include: {
            patient: true,
            variant: true
          }
        }
      }
    });

    return res.json(intervention);
  } catch (error) {
    logger.error('Error creating intervention:', error);
    return res.status(500).json({ error: 'Failed to create intervention' });
  }
});

// GET /api/polygenic-scores - Get polygenic scores for a patient
app.get('/api/polygenic-scores', async (req, res) => {
  try {
    const { patientId } = req.query;
    const scores = await prisma.polygenicScore.findMany({
      where: patientId ? { patientId: patientId as string } : {},
      orderBy: { createdAt: 'desc' }
    });
    return res.json(scores);
  } catch (error) {
    logger.error('Error fetching polygenic scores:', error);
    return res.status(500).json({ error: 'Failed to fetch polygenic scores' });
  }
});

// POST /api/polygenic-scores - Create or update a polygenic score
app.post('/api/polygenic-scores', async (req, res) => {
  try {
    const { patientId, diseaseType, prsScore, prsPercentile, referencePopulation, variantCount } = req.body;

    const score = await prisma.polygenicScore.upsert({
      where: {
        patientId_diseaseType: {
          patientId,
          diseaseType
        }
      },
      update: {
        prsScore,
        prsPercentile,
        referencePopulation,
        variantCount,
        updatedAt: new Date()
      },
      create: {
        patientId,
        diseaseType,
        prsScore,
        prsPercentile,
        referencePopulation,
        variantCount
      }
    });

    return res.json(score);
  } catch (error) {
    logger.error('Error creating/updating polygenic score:', error);
    return res.status(500).json({ error: 'Failed to create/update polygenic score' });
  }
});

// GET /api/family-risks - Get family risk assessments for a patient
app.get('/api/family-risks', async (req, res) => {
  try {
    const { patientId } = req.query;
    const risks = await prisma.familyRisk.findMany({
      where: patientId ? { patientId: patientId as string } : {},
      include: {
        variant: true,
        patient: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(risks);
  } catch (error) {
    logger.error('Error fetching family risks:', error);
    return res.status(500).json({ error: 'Failed to fetch family risks' });
  }
});

// POST /api/family-risks - Create or update a family risk assessment
app.post('/api/family-risks', async (req, res) => {
  try {
    const { patientId, relativeType, relationship, variantId, recurrenceRisk,
            inheritancePattern, geneticCounselingNeeded } = req.body;

    const risk = await prisma.familyRisk.create({
      data: {
        patientId,
        relativeType,
        relationship,
        variantId: variantId || null,
        recurrenceRisk,
        inheritancePattern,
        geneticCounselingNeeded: geneticCounselingNeeded || false
      }
    });

    return res.json(risk);
  } catch (error) {
    logger.error('Error creating family risk assessment:', error);
    return res.status(500).json({ error: 'Failed to create family risk assessment' });
  }
});

// GET /api/risk-assessment/:patientId - Get risk assessment for a patient
app.get('/api/risk-assessment/:patientId', async (req, res) => {
  const { patientId } = req.params;

  try {
    // Get patient variants from database
    const variants = await prisma.variant.findMany({
      where: { patientId: patientId }
    });

    // SIMPLE MOCK CALCULATION (we'll make it real later)
    const riskScore = {
      cardiovascular: calculateRisk(variants, 'cardiovascular'),
      cancer: calculateRisk(variants, 'cancer'),
      neurodegenerative: calculateRisk(variants, 'neurodegenerative'),
      metabolic: calculateRisk(variants, 'metabolic'),
      biologicalAge: 45, // Mock for now
      chronologicalAge: 40, // Get from patient data
      longevityScore: 72,
      topInterventions: [
        'Start statin therapy (APOE4 carrier)',
        'Annual colonoscopy (Lynch syndrome)',
        'Mediterranean diet (CAD risk)'
      ]
    };

    return res.json(riskScore);
  } catch (error) {
    logger.error('Error calculating risk assessment:', error);
    return res.status(500).json({ error: 'Failed to calculate risk assessment' });
  }
});

function calculateRisk(
  variants: Array<{ gene: string; hgvs_c: string }>,
  category: 'cardiovascular' | 'cancer' | 'neurodegenerative' | 'metabolic'
) {
  // TEMPORARY: Return mock percentages
  // TODO: Integrate with ClinVar/gnomAD later
  const mockRisks = {
    cardiovascular: 35,
    cancer: 22,
    neurodegenerative: 18,
    metabolic: 28
  };
  return mockRisks[category] || 15;
}

// End of routes and app definition
export { prisma, app };