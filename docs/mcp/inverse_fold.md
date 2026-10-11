# MCP Tool Spec — `inverse_fold`

Run **inverse folding** — design an amino-acid sequence that adopts a target
structure / motif. Wraps the ProteinMPNN-style adapter
(`backend/src/domain/proteinDesign/mpnn/ProteinMpnnAdapter.ts`) —
`designSequence(structure, options)` returning sequence candidates with scores.

## Purpose

Given a PDB/mmCIF structure (or a structure scaffolded by another tool), produce
one or more sequences that fold to it, optionally fixing positions in place.

## Input Schema

```jsonc
{
  "structure": "ATOM ...",         // required — PDB/mmCIF content to inverse-fold
  "numSequences": 8,               // optional — 1–200 (default 8)
  "temperature": 0.2,              // optional — 0–10 sampling temperature (default 0.2)
  "seed": 1,                       // optional — fixed → reproducible
  "fixedPositions": [              // optional — keep these residues as-is
    { "chain": "A", "position": 12 }
  ]
}
```

## Output Schema

```jsonc
{
  "body": {
    "model": {
      "version": "proteinmpnn-mock-v1.0.0",
      "weightsHash": "ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100"
    },
    "sequences": [
      {
        "sequence": "ACDEFGHIKLMNPQRSTVWYACD...",
        "score": 0.82,             // 0–1
        "confidence": 0.91,        // 0–1
        "positionScores": [0.7, 0.9, 0.85]
      }
    ]
  },
  "status": 200
}
```

## Error Schema

```jsonc
{
  "error": {
    "code": "INVALID_STRUCTURE",   // one of: INVALID_STRUCTURE | EMPTY_STRUCTURE | INTERNAL_ERROR
    "message": "No structure content provided"
  },
  "status": 400
}
```

| code | status | trigger |
|---|---|---|
| `EMPTY_STRUCTURE` | 400 | `structure` missing |
| `INVALID_STRUCTURE` | 422 | structure contains no `ATOM`/`_atom_site` records |
| `INTERNAL_ERROR` | 500 | adapter failed |

## Example Request

```
POST /tools/inverse_fold
{
  "structure": "ATOM      1  N   GLY A  12       1.230   2.034   3.490  1.00 50.00           N",
  "numSequences": 4,
  "temperature": 0.2,
  "seed": 1,
  "fixedPositions": [{ "chain": "A", "position": 12 }]
}
```

## Example Response

```json
{
  "body": {
    "model": {
      "version": "proteinmpnn-mock-v1.0.0",
      "weightsHash": "ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100"
    },
    "sequences": [
      {
        "sequence": "ACDEFGHIKLMNPQRSTVWYACD...",
        "score": 0.82,
        "confidence": 0.91,
        "positionScores": [0.71, 0.88, 0.84, 0.9]
      }
    ]
  },
  "status": 200
}
```

## OpenAPI-style Definition

```yaml
paths:
  /tools/inverse_fold:
    post:
      summary: Inverse-fold a structure into designable sequences
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/InverseFoldInput' }
      responses:
        '200':
          description: Designed sequences with scores
          content:
            application/json:
              schema: { $ref: '#/components/schemas/InverseFoldOutput' }
        '400':
          description: Missing structure
components:
  schemas:
    InverseFoldInput:
      type: object
      required: [structure]
      properties:
        structure: { type: string }
        numSequences: { type: integer, minimum: 1, maximum: 200, default: 8 }
        temperature: { type: number, minimum: 0, maximum: 10, default: 0.2 }
        seed: { type: integer, minimum: 0 }
        fixedPositions:
          type: array
          items:
            type: object
            properties:
              chain: { type: string }
              position: { type: integer }
    InverseFoldOutput:
      type: object
      properties:
        body:
          type: object
          properties:
            model:
              type: object
              properties:
                version: { type: string }
                weightsHash: { type: string }
            sequences:
              type: array
              items:
                type: object
                properties:
                  sequence: { type: string }
                  score: { type: number }
                  confidence: { type: number }
                  positionScores:
                    type: array
                    items: { type: number }
        status: { type: integer, example: 200 }
    InverseFoldError:
      type: object
      properties:
        error:
          type: object
          properties:
            code: { type: string, enum: [INVALID_STRUCTURE, EMPTY_STRUCTURE, INTERNAL_ERROR] }
            message: { type: string }
        status: { type: integer }
```

## Notes

- Current implementation is the mock adapter: sequences are random 20-letter
  residues with mock `score` / `confidence`; real ProteinMPNN execution is a
  later-phase integration.
- Deterministic when `seed` is fixed, matching the reproducibility goal shared
  with the design ledger.