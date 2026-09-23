// MUST be first - ensure environment variables are loaded before any other imports
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { prisma } from './prisma.js';
import type { Prisma } from '@prisma/client';
import { logger } from './utils/logger.js';
import { redactSensitive, auditAction } from './utils/redactor.js';
import { dnaStorageRouter } from './routes/dnaStorage.js';
import { clinicalRouter } from './routes/clinical.js';
import { structuresRouter } from './routes/structures.js';
import { authRouter } from './routes/auth.js';
import { billingRouter } from './routes/billing.js';
import { collabRouter } from './routes/collab.js';
import { recordsRouter } from './routes/records.js';
import { auditRouter } from './routes/audit.js';
import { predictionsRouter } from './routes/predictions.js';
import { variantsRouter } from './routes/variants.js';
import { genomicsRouter } from './routes/genomics.js';
import { aiRouter } from './routes/ai.js';
import { designRouter } from './routes/design.js';
// reserveUsage is re-exported below for backwards compatibility with existing
// importers; it is not called in this file any more.
import { reserveUsage } from './lib/metering.js';
import { configuredFrontendUrl, isAllowedFrontendOrigin } from './lib/config.js';

// Defensive logging to check if DATABASE_URL is available
logger.log('DATABASE_URL present:', !!process.env.DATABASE_URL);

// Third-party clients and caches live in lib/clients.ts.

// Session store (in-memory for simplicity; use Redis in production)
const startTime = Date.now();

// Assert secure configuration: fail hard in production if SESSION_SECRET is missing
export function assertSecureConfig(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const secret = process.env.SESSION_SECRET;
  if (isProduction && !secret) {
    const error = 'FATAL: SESSION_SECRET environment variable is required in production. Refusing to boot with insecure configuration.';
    logger.error(error);
    throw new Error(error);
  }
}

// Session signing: HMAC-SHA256(sessionId, SESSION_SECRET)
const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy configuration: read from env, default to 0 (no proxy)
// When behind a proxy (Vercel, etc.), set TRUST_PROXY_HOPS=1
// When running directly without proxy, must be 0 to prevent XFF spoofing
const TRUST_PROXY_HOPS = parseInt(process.env.TRUST_PROXY_HOPS || '0', 10);
app.set('trust proxy', TRUST_PROXY_HOPS);

// getClientIp now lives in lib/request.ts; re-exported at the bottom for tests.

// Multer instances now live in lib/uploads.ts (used by routes/structures.ts).

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

// Validate secure configuration at startup - fail closed in production
assertSecureConfig();

// Middleware (configuredFrontendUrl / isAllowedFrontendOrigin live in lib/config.ts)

app.use(cors({
  origin: (origin, callback) => callback(null, isAllowedFrontendOrigin(origin) ? origin : false),
  credentials: true
}));
app.use(cookieParser());

// Stripe webhook needs raw body - register BEFORE global JSON parser
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

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
// DNA Archive Lab: self-contained feature router (in-silico DNA data-storage simulator)
app.use('/api/dna-storage', dnaStorageRouter);
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
      grok: {
        status: process.env.XAI_API_KEY ? 'ok' : 'unconfigured',
        model: process.env.GROK_MODEL || 'grok-4.6',
        configured: Boolean(process.env.XAI_API_KEY)
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

// Lightweight /health endpoint for monitoring (uptime robots, Better Stack, etc.)
app.get('/health', async (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  let dbStatus: 'up' | 'down' = 'down';

  try {
    if (prisma) {
      const dbCheck = prisma.$executeRawUnsafe('SELECT 1');
      const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 2000));
      const result = await Promise.race([dbCheck, timeout]);
      dbStatus = result === 'timeout' ? 'down' : 'up';
    }
  } catch (error) {
    dbStatus = 'down';
  }

  const status = dbStatus === 'up' ? 'ok' : 'degraded';
  return res.json({
    status,
    uptime: uptimeSeconds,
    db: dbStatus
  });
});

// ==================== AUTH ROUTES ====================
// Extracted to routes/auth.ts; mounted at /api (order preserved).
app.use('/api', authRouter);

// ==================== USAGE + BILLING ROUTES ====================
// Extracted to routes/billing.ts; mounted at /api (order preserved).
app.use('/api', billingRouter);
// ==================== AI / ALPHAMISSENSE ROUTES ====================
// Extracted to routes/ai.ts; mounted at /api (order preserved).
app.use('/api', aiRouter);

// ==================== SPLICEAI / SCHEMA-TEST ROUTES ====================
// Extracted to routes/genomics.ts; mounted at /api (order preserved).
app.use('/api', genomicsRouter);

// ==================== STRUCTURE ROUTES ====================
// Extracted to routes/structures.ts; mounted at /api (order preserved).
app.use('/api', structuresRouter);

// ==================== VARIANT / PATIENT ROUTES ====================
// Extracted to routes/variants.ts; mounted at /api (order preserved).
app.use('/api', variantsRouter);

// ==================== AUDIT ROUTES ====================
// Extracted to routes/audit.ts; mounted at /api (order preserved).
app.use('/api', auditRouter);

// ==================== PREDICTIONS / MODELS / SEED ROUTES ====================
// Extracted to routes/predictions.ts; mounted at /api (order preserved).
app.use('/api', predictionsRouter);

// ==================== USER / ANALYSIS / HISTORY ROUTES ====================
// Extracted to routes/records.ts; mounted at /api (order preserved).
app.use('/api', recordsRouter);

// ==================== SPLICING / SHARE / COMMENTS ROUTES ====================
// Extracted to routes/collab.ts; mounted at /api (order preserved).
app.use('/api', collabRouter);

// ==================== CLINICAL / LONGEVITY ROUTES ====================
// Extracted to routes/clinical.ts; mounted at /api (order preserved).
app.use('/api', clinicalRouter);

// ==================== DESIGN STUDIO ROUTES ====================
// RFdiffusion3 variant-to-intervention design surface. Mounted at its own
// prefix so the design domain stays isolated from the clinical routes above.
app.use('/api/design', designRouter);

export { prisma, app, reserveUsage };
export { getClientIp } from './lib/request.js';
