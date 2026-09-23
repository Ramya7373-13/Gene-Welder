// Ranking Service - Ranks design candidates by composite score.
// Aggregates validation metrics, structural properties, and design diversity.

import type {
  ValidationResult,
  RankedCandidate,
  ScoringWeights,
} from '../types/index.js';

/**
 * Weights for the composite scoring function.
 */
export const defaultScoringWeights: Required<ScoringWeights> = {
  pTM: 0.2,
  ipTM: 0.2,
  pLDDT: 0.15,
  interfaceArea: 0.15,
  constraintScore: 0.2,
  diversity: 0.1,
};

/**
 * The subset of metrics the composite score is computed from. Declaring it as
 * its own type lets both the validation engine (which has raw components) and
 * the ranking service (which has a ValidationResult) share one implementation.
 */
export interface ScoringInput {
  pTM?: number;
  ipTM?: number;
  pLDDT?: number;
  interfaceArea?: number;
  constraintSatisfactionScore?: number;
  diversityScore?: number;
}

/**
 * Normalize interface area to a 0-1 scale. Ranges from 200 to 2000 Å².
 */
function normalizeInterfaceArea(area: number): number {
  return Math.max(0, Math.min(1, (area - 200) / 1800));
}

/**
 * The single composite-scoring implementation for the design domain.
 *
 * Missing metrics contribute zero, except diversity which defaults to a neutral
 * 0.5 so an unscored candidate is neither rewarded nor punished for it.
 */
export function computeCompositeScore(
  metrics: ScoringInput,
  weights: Partial<ScoringWeights> = {},
): number {
  const w = { ...defaultScoringWeights, ...weights };

  const pTM = metrics.pTM ?? 0;
  const ipTM = metrics.ipTM ?? 0;
  const pLDDT = (metrics.pLDDT ?? 0) / 100;
  const interfaceArea = normalizeInterfaceArea(metrics.interfaceArea ?? 0);
  const constraintScore = metrics.constraintSatisfactionScore ?? 0;
  const diversity = metrics.diversityScore ?? 0.5;

  const score =
    pTM * w.pTM +
    ipTM * w.ipTM +
    pLDDT * w.pLDDT +
    interfaceArea * w.interfaceArea +
    constraintScore * w.constraintScore +
    diversity * w.diversity;

  return Math.max(0, Math.min(1, score));
}

/**
 * Service to rank validated design candidates.
 */
export class DesignRankingService {
  /**
   * Rank candidates based on validation results and weights.
   */
  rank(results: ValidationResult[], weights?: Partial<ScoringWeights>): RankedCandidate[] {
    const scored = results.map(result => ({
      candidateId: result.candidateId,
      compositeScore: computeCompositeScore(result, weights),
      validationMetrics: result,
    }));

    return scored
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
  }

  /**
   * Get top N candidates from a ranked list.
   */
  getTopN(ranked: RankedCandidate[], n: number): RankedCandidate[] {
    return ranked.slice(0, n);
  }
}
