# MCP Tool Spec — `validate_design`

Run the full validation round on a design candidate and persist the result.
Wraps `DesignValidationEngine.validateCandidates`(
`backend/src/domain/proteinDesign/validation/DesignValidationEngine.ts`) plus the
backend `POST /api/design/validate` route, which writes the `ValidationResult`
and updates the design ledger.

## Purpose

Score a design candidate across structure prediction confidence (pLDDT/pTM/ipTM),
geometry, interface area, constraint satisfaction and diversity, producing a
single composite `overallScore` (0–1).

## Input Schema

```jsonc
{
  "candidateId": "cand_run_2",      // required — candidate to validate
  "weights": {                      // optional — override composite score weights
    "pTM": 0.2,                     // optional
    "ipTM": 0.2,                    // optional
    "pLDDT": 0.15,                  // optional
    "interfaceArea": 0.15,          // optional
    "constraintScore": 0.2,         // optional
    "diversity": 0.1                // optional
  }
}
```

## Output Schema

```jsonc
{
  "body": {
    "validation": {
      "candidateId": "cand_run_2",
      "pTM": 0.74,
      "ipTM": 0.63,
      "pLDDT": 81.2,
      "interfaceArea": 638.5,
      "constraintSatisfactionScore": 0.83,
      "diversityScore": 0.9,
      "overallScore": 0.71,
      "details": {
        "geometryCheck": { "valid": true, "issues": [], "clashScore": 0.22, "bondLengthDeviations": 0.9, "angleDeviations": 2.1 },
        "constraintCheck": { "satisfied": true, "satisfactionScore": 0.83, "checkedConstraints": [{ "type": "hotspot", "satisfied": true, "score": 0.85 }] },
        "pLDDT": 81.2
      },
      "createdAt": "2026-09-22T11:00:00.000Z"
    }
  },
  "status": 200
}
```

## Error Schema

```jsonc
{
  "error": {
    "code": "NOT_FOUND",             // one of: UNAUTHORIZED | NOT_FOUND | VALIDATION_FAILED | INTERNAL_ERROR
    "message": "Candidate cand_run_2 not found",
    "issues": []
  },
  "status": 404
}
```

| code | status | trigger |
|---|---|---|
| `UNAUTHORIZED` | 401 | no valid session cookie / candidate not in owned project |
| `NOT_FOUND` | 404 | `candidateId` does not exist |
| `VALIDATION_FAILED` | 500 | validation engine threw |
| `INTERNAL_ERROR` | 500 | persistence failed |

## Example Request

```
POST /tools/validate_design
{
  "candidateId": "cand_run_2",
  "weights": { "pTM": 0.25, "ipTM": 0.25, "constraintScore": 0.25 }
}
```

## Example Response

```json
{
  "body": {
    "validation": {
      "candidateId": "cand_run_2",
      "pTM": 0.74,
      "ipTM": 0.63,
      "pLDDT": 81.2,
      "interfaceArea": 638.5,
      "constraintSatisfactionScore": 0.83,
      "diversityScore": 0.9,
      "overallScore": 0.71,
      "details": {
        "pLDDT": 81.2
      },
      "createdAt": "2026-09-22T11:00:00.000Z"
    }
  },
  "status": 200
}
```

## OpenAPI-style Definition

```yaml
paths:
  /tools/validate_design:
    post:
      summary: Validate a design candidate and persist the result
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ValidateInput' }
      responses:
        '200':
          description: Validation result persisted
          content:
            application/json:
              schema:
                type: object
                properties:
                  body:
                    type: object
                    properties:
                      validation: { $ref: '#/components/schemas/ValidationResult' }
                  status: { type: integer, example: 200 }
        '404':
          description: Candidate not found
        '401':
          description: Unauthorized
components:
  schemas:
    ValidateInput:
      type: object
      required: [candidateId]
      properties:
        candidateId: { type: string }
        weights:
          type: object
          properties:
            pTM: { type: number }
            ipTM: { type: number }
            pLDDT: { type: number }
            interfaceArea: { type: number }
            constraintScore: { type: number }
            diversity: { type: number }
    ValidationResult:
      type: object
      properties:
        candidateId: { type: string }
        pTM: { type: number, nullable: true }
        ipTM: { type: number, nullable: true }
        pLDDT: { type: number, nullable: true }
        interfaceArea: { type: number, nullable: true }
        constraintSatisfactionScore: { type: number, nullable: true }
        diversityScore: { type: number, nullable: true }
        overallScore: { type: number, nullable: true }
        details: { type: object }
        createdAt: { type: string }
    ScoreWeight:
      type: object
      properties:
        pTM: { type: number }
        ipTM: { type: number }
        pLDDT: { type: number }
        interfaceArea: { type: number }
        constraintScore: { type: number }
        diversity: { type: number }
```

## Notes

- Composite score formula (see `computeCompositeScore` in
  `DesignRankingService.ts`): `pTM*w.pTM + ipTM*w.ipTM + pLDDT/100*w.pLDDT +
  norm(interfaceArea)*w.interfaceArea + constraintScore*w.constraintScore +
  diversity*w.diversity`, clamped to [0, 1]. Missing metrics contribute zero;
  missing diversity defaults to neutral `0.5`.
- Default weights: pTM 0.2, ipTM 0.2, pLDDT 0.15, interfaceArea 0.15,
  constraintScore 0.2, diversity 0.1.
- `interfaceArea` is normalized via `(area-200)/1800` clamped to [0, 1].
- After validation, the candidate's latest `ValidationResult` (and any ledger
  record) are returned with the candidate by `GET /api/design/candidates`.