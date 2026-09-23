// Longevity / clinical risk endpoints.
// Mounted at /api by server.ts.
//
// Session-gated per route (not router.use — this router is mounted at /api
// root, so router-wide middleware would run for unrelated /api/* paths).
// Acting user comes only from the session (see lib/requireSession.ts).

import express from 'express';
import { prisma } from '../prisma.js';
import { logger } from '../utils/logger.js';
import { requireSession } from '../lib/requireSession.js';

const router = express.Router();

// GET /risk-assessments - Get all risk assessments for a patient
router.get('/risk-assessments', requireSession, async (req, res) => {
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

// POST /risk-assessments - Create or update a risk assessment
router.post('/risk-assessments', requireSession, async (req, res) => {
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

// GET /interventions - Get interventions for a risk assessment
router.get('/interventions', requireSession, async (req, res) => {
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

// POST /interventions - Create an intervention
router.post('/interventions', requireSession, async (req, res) => {
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

// GET /polygenic-scores - Get polygenic scores for a patient
router.get('/polygenic-scores', requireSession, async (req, res) => {
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

// POST /polygenic-scores - Create or update a polygenic score
router.post('/polygenic-scores', requireSession, async (req, res) => {
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

// GET /family-risks - Get family risk assessments for a patient
router.get('/family-risks', requireSession, async (req, res) => {
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

// POST /family-risks - Create or update a family risk assessment
router.post('/family-risks', requireSession, async (req, res) => {
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

// GET /risk-assessment/:patientId - Get risk assessment for a patient
router.get('/risk-assessment/:patientId', requireSession, async (req, res) => {
  const { patientId } = req.params;

  try {
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

export { router as clinicalRouter };
