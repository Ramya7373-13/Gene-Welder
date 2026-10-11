# MCP Tool Spec — `rank_designs`

Rank validated design candidates by their composite score and persist the
ranking (`rankedPosition`). Wraps `DesignRankingService.rank` /
`getTopN` (`backend/src/domain/proteinDesign/ranking/DesignRankingService.ts`)
and the `DesignService.persistRanks` path.

## Purpose

Order a run's candidates from best (`rank 1`) to worst by composite validation
score, optionally keeping only the top N.

## Input Schema

```jsonc
{
  "runId": "run_xyz789",         // required — run whose candidates get ranked
  "limit": 10                    // optional — keep only top N (default: all)
}
```

## Output Schema

```jsonc
{
  "body": {
    "ranked": [
      {
        "candidateId": "cand_run_2",
        "compositeScore": 0.71,
        "rank": 1,
        "validationMetrics": {
          "pTM": 0.74,
          "ipTM": 0.63,
          "pLDDT": 81.2,
          "constraintSatisfactionScore": 0.83,
          "diversityScore": 0.9,
          "overallScore": 0.71
        }
      }
    ],
    "totalRanked": 8
  },
  "status": 200
}
```

## Error Schema

```jsonc
{
  "error": {
    "code": "NOT_FOUND",         // one of: UNAUTHORIZED | NOT_FOUND | INTERNAL_ERROR
    "message": "Run run_xyz789 not found",
    "issues": []
  },
  "status": 404
}
```

| code | status | trigger |
|---|---|---|
| `UNAUTHORIZED` | 401 | no valid session cookie / run not in owned project |
| `NOT_FOUND` | 404 | `runId` does not exist |
| `INTERNAL_ERROR` | 500 | ranking persistence failed |

## Example Request

```
POST /tools/rank_designs
{
  "runId": "run_xyz789",
  "limit": 3
}
```

## Example Response

```json
{
  "body": {
    "ranked": [
      { "candidateId": "cand_run_2", "compositeScore": 0.71, "rank": 1 },
      { "candidateId": "cand_run_5", "compositeScore": 0.66, "rank": 2 },
      { "candidateId": "cand_run_1", "compositeScore": 0.6, "rank": 3 }
    ],
    "totalRanked": 8
  },
  "status": 200
}
```

## OpenAPI-style Definition

```yaml
paths:
  /tools/rank_designs:
    post:
      summary: Rank a run's candidates by composite score
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/RankInput' }
      responses:
        '200':
          description: Persisted ranking
          content:
            application/json:
              schema: { $ref: '#/components/schemas/RankOutput' }
        '404':
          description: Run not found
        '401':
          description: Unauthorized
components:
  schemas:
    RankInput:
      type: object
      required: [runId]
      properties:
        runId: { type: string }
        limit: { type: integer, minimum: 1 }
    RankOutput:
      type: object
      properties:
        body:
          type: object
          properties:
            ranked:
              type: array
              items: { $ref: '#/components/schemas/RankedCandidate' }
            totalRanked: { type: integer }
        status: { type: integer, example: 200 }
    RankedCandidate:
      type: object
      properties:
        candidateId: { type: string }
        compositeScore: { type: number }
        rank: { type: integer }
        validationMetrics: { $ref: '#/components/schemas/ValidationMetrics' }
    ValidationMetrics:
      type: object
      properties:
        pTM: { type: number }
        ipTM: { type: number }
        pLDDT: { type: number }
        interfaceArea: { type: number }
        constraintSatisfactionScore: { type: number }
        diversityScore: { type: number }
        overallScore: { type: number }
```

## Notes

- Ranking is strictly descending by `overallScore` (composite) using the same
  `computeCompositeScore` used by validation, so a run validated with custom
  weights should re-rank with the same weights for consistency.
- `rankedPosition` on `DesignCandidate` is the persisted outcome; the design
  results viewer lists candidates ordered by `rankedPosition` asc.
- The initial mock generation assigns `rankedPosition` from `generateMockCandidates`
  before any validation; `rank_designs` overwrites it with the validated order.