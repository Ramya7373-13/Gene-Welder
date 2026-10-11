# MCP Tool Spec — `design_stabilizer`

Launch an RFdiffusion3 **stabilizer design** run — redesign a protein scaffold
to stabilize a disease variant (e.g. restore folding free energy around a
destabilizing mutation). Wraps the frontend `StabilizerDesigner` payload and the
backend `POST /api/design/runs` → `RFDiffusion3Adapter.generateStabilizer`
pipeline (default `numDesigns` 6).

## Purpose

Generate stabilizer candidates that bury the mutated residue in a stabilizing
core, driven by `burialDepth` / `hotspot` constraints derived from the variant.

## Input Schema

```jsonc
{
  "projectId": "prj_...",           // required — existing design project
  "variant": "p.L144F",             // optional — HGVS; must match p\.([A-Z])(\d+)([A-Z])
  "targetStructure": "ATOM ...",    // optional — PDB/mmCIF content, max 20,000,000 chars
  "targetSequence": "MVKWK...",     // optional — protein sequence, max 200,000 chars
  "chainId": "A",                   // optional — target chain, max 8 chars
  "constraints": [                  // optional — RFD3 constraint list
    {
      "type": "burialDepth",        // hotspot | interface | burialDepth
      "residues": [{ "chain": "A", "position": 144 }],
      "minDepth": 2.0,
      "maxDepth": 8.0
    }
  ],
  "parameters": {
    "numDesigns": 6,                // 1–200
    "diffusionSteps": 50,           // 1–1000
    "noiseScale": 1.0,              // 0–1
    "temperature": 1.0,             // 0–10
    "topP": 0.95,                   // 0–1
    "seed": 7                       // optional, fixed → reproducible
  }
}
```

## Output Schema

Identical shape to `design_binders` but `mode: "STABILIZER"`.

```jsonc
{
  "body": {
    "run": {
      "id": "run_...",
      "projectId": "prj_...",
      "mode": "STABILIZER",
      "designEngine": "rfd3",
      "status": "QUEUED",
      "parameters": { "numDesigns": 6, "seed": 7 },
      "constraintSpec": {},
      "targetStructure": null,
      "targetSequence": null,
      "gpuId": null,
      "startedAt": null,
      "completedAt": null,
      "failedReason": null,
      "createdAt": "2026-09-22T10:05:00.000Z",
      "updatedAt": "2026-09-22T10:05:00.000Z"
    }
  },
  "status": 201
}
```

## Error Schema

Same as `design_binders`:

```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "projectId must be a valid design project",
    "issues": ["projectId: not found"]
  },
  "status": 400
}
```

| code | status | trigger |
|---|---|---|
| `VALIDATION_ERROR` | 400 | failed dto validation / no owning project |
| `UNAUTHORIZED` | 401 | no valid session cookie |
| `NOT_FOUND` | 404 | `projectId` does not exist |
| `INTERNAL_ERROR` | 500 | job enqueue failed |

## Example Request

```
POST /tools/design_stabilizer
{
  "projectId": "prj_abc123",
  "variant": "p.L144F",
  "chainId": "A",
  "constraints": [
    { "type": "burialDepth", "residues": [{ "chain": "A", "position": 144 }], "minDepth": 2.0, "maxDepth": 8.0 }
  ],
  "parameters": { "numDesigns": 6, "diffusionSteps": 40, "seed": 7 }
}
```

## Example Response

```json
{
  "body": {
    "run": {
      "id": "run_uvw999",
      "projectId": "prj_abc123",
      "mode": "STABILIZER",
      "designEngine": "rfd3",
      "status": "QUEUED",
      "parameters": { "numDesigns": 6, "diffusionSteps": 40, "seed": 7 },
      "constraintSpec": {},
      "targetStructure": null,
      "targetSequence": null,
      "gpuId": null,
      "startedAt": null,
      "completedAt": null,
      "failedReason": null,
      "createdAt": "2026-09-22T10:05:00.000Z",
      "updatedAt": "2026-09-22T10:05:00.000Z"
    }
  },
  "status": 201
}
```

## OpenAPI-style Definition

Same contract as `design_binders` with the mode fixed to `STABILIZER`:

```yaml
paths:
  /tools/design_stabilizer:
    post:
      summary: Launch an RFD3 stabilizer design run
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CreateRun' }
      responses:
        '201':
          description: Run created and queued
          content:
            application/json:
              schema:
                type: object
                properties:
                  body:
                    type: object
                    properties:
                      run: { $ref: '#/components/schemas/DesignRun' }
                  status: { type: integer, example: 201 }
        '400':
          description: Validation failure
components:
  schemas:
    CreateRun:
      type: object
      required: [projectId, mode, parameters]
      properties:
        projectId: { type: string, maxLength: 60 }
        mode:
          type: string
          enum: [STABILIZER]
          default: STABILIZER
        parameters: { $ref: '#/components/schemas/Rfd3ParametersDto' }
        targetStructure: { type: string, maxLength: 20000000 }
        targetSequence: { type: string, maxLength: 200000 }
        chainId: { type: string, maxLength: 8 }
        variant: { type: string, maxLength: 255 }
        constraints:
          type: array
          items: { type: object }
    DesignRun:
      type: object
      properties:
        id: { type: string }
        projectId: { type: string }
        mode: { type: string }
        designEngine: { type: string }
        status:
          type: string
          enum: [QUEUED, RUNNING, VALIDATING, COMPLETED, FAILED]
        parameters: { type: object }
        constraintSpec: { type: object }
        targetStructure: { type: string, nullable: true }
        targetSequence: { type: string, nullable: true }
        gpuId: { type: string, nullable: true }
        startedAt: { type: string, nullable: true }
        completedAt: { type: string, nullable: true }
        failedReason: { type: string, nullable: true }
        createdAt: { type: string }
        updatedAt: { type: string }
    Rfd3ParametersDto:
      type: object
      properties:
        numDesigns: { type: integer, minimum: 1, maximum: 200 }
        diffusionSteps: { type: integer, minimum: 1, maximum: 1000 }
        noiseScale: { type: number, minimum: 0, maximum: 1 }
        temperature: { type: number, minimum: 0, maximum: 10 }
        topP: { type: number, minimum: 0, maximum: 1 }
        seed: { type: integer, minimum: 0 }
```

## Notes

- Stabilizer runs emphasize `burialDepth` constraints (default generation
  target: mutated residue, `minDepth 2.0`, `maxDepth 8.0`).
- The VariantConditioningEngine always derives a `burialDepth` constraint from
  any parseable variant, so a run without explicit constraints still buries the
  mutation site.