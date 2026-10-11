# MCP Tool Spec — `design_binders`

Launch an RFdiffusion3 **binder design** run against a target protein,
conditioned on a disease variant and/or user-specified constraints. Wraps the
frontend `BinderDesigner` payload and the backend
`POST /api/design/runs` → `DesignService.executeDesignJob` →
`RFDiffusion3Adapter.generateBinder` pipeline.

## Purpose

Generate binder candidates (`numDesigns` default 8) that bind the target's
hotspot / interface regions derived from the variant conditioning.

## Input Schema

```jsonc
{
  "projectId": "prj_...",           // required — existing design project
  "variant": "p.Gly12Asp",          // optional — HGVS; must match p\.([A-Z])(\d+)([A-Z])
  "targetStructure": "ATOM ...",    // optional — PDB/mmCIF content, max 20,000,000 chars
  "targetSequence": "MKLTP...",     // optional — protein sequence, max 200,000 chars
  "chainId": "A",                   // optional — target chain, max 8 chars
  "constraints": [                  // optional — RFD3 constraint list
    {
      "type": "hotspot",            // hotspot | interface | burialDepth
      "residues": [{ "chain": "A", "position": 12 }],
      "minInteractions": 3
    }
  ],
  "parameters": {                   // optional — RFD3 parameters
    "numDesigns": 8,                // 1–200
    "diffusionSteps": 50,           // 1–1000
    "noiseScale": 1.0,              // 0–1
    "temperature": 1.0,             // 0–10
    "topP": 0.95,                   // 0–1
    "seed": 42                      // optional, fixed → reproducible
  }
}
```

## Output Schema

```jsonc
{
  "body": {
    "run": {
      "id": "run_...",
      "projectId": "prj_...",
      "mode": "BINDER",
      "designEngine": "rfd3",
      "status": "QUEUED",
      "parameters": { "numDesigns": 8 },
      "constraintSpec": {},
      "targetStructure": null,
      "targetSequence": null,
      "gpuId": null,
      "startedAt": null,
      "completedAt": null,
      "failedReason": null,
      "createdAt": "2026-09-22T10:00:00.000Z",
      "updatedAt": "2026-09-22T10:00:00.000Z"
    }
  },
  "status": 201
}
```

## Error Schema

```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR",  // one of: VALIDATION_ERROR | UNAUTHORIZED | NOT_FOUND | INTERNAL_ERROR
    "message": "projectId must be a valid design project",
    "issues": ["projectId: not found"]
  },
  "status": 400
}
```

| code | status | trigger |
|---|---|---|
| `VALIDATION_ERROR` | 400 | failed dto validation / no owning project (issue list in `issues`) |
| `UNAUTHORIZED` | 401 | no valid session cookie |
| `NOT_FOUND` | 404 | `projectId` does not exist |
| `INTERNAL_ERROR` | 500 | job enqueue failed |

## Example Request

```
POST /tools/design_binders
{
  "projectId": "prj_abc123",
  "variant": "p.Gly12Asp",
  "chainId": "A",
  "constraints": [
    { "type": "hotspot", "residues": [{ "chain": "A", "position": 12 }], "minInteractions": 3 }
  ],
  "parameters": { "numDesigns": 8, "diffusionSteps": 50, "seed": 42 }
}
```

## Example Response

```json
{
  "body": {
    "run": {
      "id": "run_xyz789",
      "projectId": "prj_abc123",
      "mode": "BINDER",
      "designEngine": "rfd3",
      "status": "QUEUED",
      "parameters": { "numDesigns": 8, "diffusionSteps": 50, "seed": 42 },
      "constraintSpec": {},
      "targetStructure": null,
      "targetSequence": null,
      "gpuId": null,
      "startedAt": null,
      "completedAt": null,
      "failedReason": null,
      "createdAt": "2026-09-22T10:00:00.000Z",
      "updatedAt": "2026-09-22T10:00:00.000Z"
    }
  },
  "status": 201
}
```

## OpenAPI-style Definition

```yaml
paths:
  /tools/design_binders:
    post:
      summary: Launch an RFD3 binder design run
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
        mode: { $ref: '#/components/schemas/DesignMode' }
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
        mode: { $ref: '#/components/schemas/DesignMode' }
        designEngine: { type: string }
        status: { $ref: '#/components/schemas/DesignRunStatus' }
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
    DesignRunStatus:
      type: string
      enum: [QUEUED, RUNNING, VALIDATING, COMPLETED, FAILED]
```

## Notes

- Run status life cycle: `QUEUED → RUNNING → VALIDATING → COMPLETED`, or
  `FAILED` on job error. Progress can be polled via `GET /api/design/runs/:id`.
- Binder mode is the default `inferModeFromVariant` outcome when no objective
  is supplied.
- `seed` is persisted verbatim and written to the design ledger, so a fixed
  seed makes a run reproducible.