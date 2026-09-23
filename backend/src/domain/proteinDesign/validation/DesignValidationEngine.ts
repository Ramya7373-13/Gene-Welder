// DesignValidationEngine - Validates protein design candidates.
// Runs structural validation, interface metrics, constraint satisfaction,
// diversity analysis, and candidate ranking.

import type {
  DesignCandidate,
  ValidationResult,
  Rfd3Conditioning,
  RankedCandidate,
  CandidateMetrics,
  ScoringWeights,
} from '../types/index.js';
import { computeCompositeScore } from '../ranking/DesignRankingService.js';

/**
 * Interface for AlphaFold structure prediction (can be mocked or real).
 */
export interface StructurePredictor {
  predict(sequence: string, name?: string): Promise<{ pLDDT: number; pTM?: number; ipTM?: number }>;
  isAvailable(): Promise<boolean>;
}

/**
 * Interface for structural validation (Rosetta, geometry checks).
 */
export interface StructureValidator {
  validateGeometry(pdbContent: string): Promise<GeometryCheckResult>;
  computeInterfaceArea(pdbContent: string, targetChain: string): Promise<number>;
}

/**
 * Result of geometry validation.
 */
export interface GeometryCheckResult {
  valid: boolean;
  issues: string[];
  clashScore: number;
  bondLengthDeviations: number;
  angleDeviations: number;
}

/**
 * Interface for constraint satisfaction checking.
 */
export interface ConstraintChecker {
  checkConstraints(candidate: DesignCandidate, constraints: Rfd3Conditioning): Promise<ConstraintCheckResult>;
}

export interface ConstraintCheckResult {
  satisfied: boolean;
  satisfactionScore: number; // 0-1
  checkedConstraints: { type: string; satisfied: boolean; score: number }[];
}

/**
 * Interface for diversity analysis.
 */
export interface DiversityAnalyzer {
  analyze(candidates: DesignCandidate[]): Promise<DiversityResult>;
}

export interface DiversityResult {
  averagePairwiseSequenceIdentity: number;
  clusteringCount: number;
  representativeCandidates: string[];
}

/**
 * Mock structure predictor - returns pre-computed confidence values
 * based on candidate properties.
 */
export class MockStructurePredictor implements StructurePredictor {
  async predict(sequence: string): Promise<{ pLDDT: number; pTM?: number; ipTM?: number }> {
    // In Phase 1, return mock confidence values
    const baseScore = 70 + (sequence.length / 200) * 10;
    return {
      pLDDT: Math.min(90, baseScore),
      pTM: 0.65 + Math.random() * 0.25,
      ipTM: 0.55 + Math.random() * 0.3,
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

/**
 * Mock structure validator.
 */
export class MockStructureValidator implements StructureValidator {
  async validateGeometry(pdbContent: string): Promise<GeometryCheckResult> {
    // Count atoms as a proxy for structure size
    const atomCount = (pdbContent.match(/ATOM/g) || []).length;

    return {
      valid: atomCount > 10,
      issues: atomCount > 1000 ? ['Large structure, check for clashes'] : [],
      clashScore: 0.1 + Math.random() * 0.3,
      bondLengthDeviations: Math.random() * 2,
      angleDeviations: Math.random() * 5,
    };
  }

  async computeInterfaceArea(pdbContent: string, targetChain: string): Promise<number> {
    // Mock interface area computation
    const atomCount = (pdbContent.match(/ATOM/g) || []).length;
    return 200 + atomCount * 5 + Math.random() * 100;
  }
}

/**
 * Mock constraint checker.
 */
export class MockConstraintChecker implements ConstraintChecker {
  async checkConstraints(
    candidate: DesignCandidate,
    constraints: Rfd3Conditioning
  ): Promise<ConstraintCheckResult> {
    // Simple mock: each constraint is 75-95% satisfied
    const checkedConstraints = constraints.hotspots.map(residue => ({
      type: 'hotspot',
      satisfied: Math.random() > 0.2,
      score: 0.75 + Math.random() * 0.2,
    }));

    const satisfactionScore =
      checkedConstraints.length > 0
        ? checkedConstraints.reduce((sum, c) => sum + c.score, 0) / checkedConstraints.length
        : 0.8;

    return {
      satisfied: satisfactionScore >= 0.7,
      satisfactionScore,
      checkedConstraints,
    };
  }
}

/**
 * Mock diversity analyzer.
 */
export class MockDiversityAnalyzer implements DiversityAnalyzer {
  async analyze(candidates: DesignCandidate[]): Promise<DiversityResult> {
    // Mock: compute pairwise identity based on sequence similarity
    const pairwiseIds: number[] = [];
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const seq1 = candidates[i].sequence ?? '';
        const seq2 = candidates[j].sequence ?? '';
        const len = Math.min(seq1.length, seq2.length);
        let matches = 0;
        for (let k = 0; k < len; k++) {
          if (seq1[k] === seq2[k]) matches++;
        }
        pairwiseIds.push(matches / len);
      }
    }

    const avgPairwiseId = pairwiseIds.length > 0
      ? pairwiseIds.reduce((a, b) => a + b, 0) / pairwiseIds.length
      : 0;

    // Higher diversity = lower identity
    const diversity = 1 - avgPairwiseId;
    const clusteringCount = Math.max(1, Math.round(candidates.length * (0.5 + diversity / 2)));

    return {
      averagePairwiseSequenceIdentity: avgPairwiseId,
      clusteringCount,
      representativeCandidates: candidates
        .slice(0, Math.min(5, candidates.length))
        .map(c => c.id),
    };
  }
}

export class DesignValidationEngine {
  private structurePredictor: StructurePredictor;
  private structureValidator: StructureValidator;
  private constraintChecker: ConstraintChecker;
  private diversityAnalyzer: DiversityAnalyzer;

  constructor(
    structurePredictor?: StructurePredictor,
    structureValidator?: StructureValidator,
    constraintChecker?: ConstraintChecker,
    diversityAnalyzer?: DiversityAnalyzer,
  ) {
    this.structurePredictor = structurePredictor ?? new MockStructurePredictor();
    this.structureValidator = structureValidator ?? new MockStructureValidator();
    this.constraintChecker = constraintChecker ?? new MockConstraintChecker();
    this.diversityAnalyzer = diversityAnalyzer ?? new MockDiversityAnalyzer();
  }

  /**
   * Validate a single candidate against its design constraints.
   */
  async validateCandidate(
    candidate: DesignCandidate,
    conditioning: Rfd3Conditioning,
    existingCandidates?: DesignCandidate[],
    weights?: Partial<ScoringWeights>,
  ): Promise<ValidationResult> {
    // Get structure prediction confidence
    const prediction = await this.structurePredictor.predict(candidate.sequence ?? '');

    // Validate geometry
    const geometry = candidate.structure
      ? await this.structureValidator.validateGeometry(candidate.structure)
      : { valid: true, issues: [], clashScore: 0, bondLengthDeviations: 0, angleDeviations: 0 };

    // Compute interface area
    const interfaceArea = candidate.structure
      ? await this.structureValidator.computeInterfaceArea(candidate.structure, 'A')
      : 0;

    // Check constraint satisfaction
    const constraintCheck = await this.constraintChecker.checkConstraints(candidate, conditioning);

    // Compute diversity score (if we have existing candidates)
    let diversityScore = 0.8; // Default when alone
    if (existingCandidates && existingCandidates.length > 0) {
      const diversity = await this.diversityAnalyzer.analyze([candidate, ...existingCandidates]);
      diversityScore = 1 - diversity.averagePairwiseSequenceIdentity;
    }

    // Compute composite score
    const compositeScore = computeCompositeScore(
      {
        pTM: prediction.pTM,
        ipTM: prediction.ipTM,
        pLDDT: prediction.pLDDT,
        interfaceArea,
        constraintSatisfactionScore: constraintCheck.satisfactionScore,
        diversityScore,
      },
      weights,
    );

    return {
      candidateId: candidate.id,
      pTM: prediction.pTM,
      ipTM: prediction.ipTM,
      pLDDT: prediction.pLDDT,
      interfaceArea,
      constraintSatisfactionScore: constraintCheck.satisfactionScore,
      diversityScore,
      overallScore: compositeScore,
      details: {
        geometryCheck: geometry,
        constraintCheck: constraintCheck,
        pLDDT: prediction.pLDDT,
      },
      createdAt: new Date(),
    };
  }

  /**
   * Validate a batch of candidates against their design constraints.
   */
  async validateCandidates(
    candidates: DesignCandidate[],
    conditioning: Rfd3Conditioning,
    weights?: Partial<ScoringWeights>,
  ): Promise<ValidationResult[]> {
    // First pass: validate all candidates
    const results = await Promise.all(
      candidates.map(c => this.validateCandidate(c, conditioning, candidates, weights)),
    );

    // Compute design diversity across all candidates
    const diversity = await this.diversityAnalyzer.analyze(candidates);
    const diversityScores = results.map((_, i) => {
      const isRepresentative = diversity.representativeCandidates.includes(candidates[i].id);
      return isRepresentative ? 0.95 : 0.5;
    });

    // Update diversity scores in results
    return results.map((result, i) => ({
      ...result,
      diversityScore: diversityScores[i],
      overallScore: computeCompositeScore(
        {
          pTM: result.pTM,
          ipTM: result.ipTM,
          pLDDT: result.pLDDT,
          interfaceArea: result.interfaceArea,
          constraintSatisfactionScore: result.constraintSatisfactionScore,
          diversityScore: diversityScores[i],
        },
        weights,
      ),
    }));
  }

  /**
   * Rank candidates by composite score.
   */
  rankCandidates(results: ValidationResult[]): RankedCandidate[] {
    return results
      .map(result => ({
        candidateId: result.candidateId,
        compositeScore: result.overallScore ?? 0,
        rank: 0, // Will be set after sorting
        validationMetrics: result,
      }))
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .map((c, index) => ({
        ...c,
        rank: index + 1,
      }));
  }
}
