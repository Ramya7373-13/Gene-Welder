# MCP Tool Spec — `structure_model`

Submit a target protein structure (PDB / mmCIF) for modeling and downstream
conditioning. Produces a lightweight structure handle (content + chain layout)
that downstream tools (`variant_analyze`, `design_binders`) consume as their
`structure` input.

## Purpose

Register the native target structure — disease-variant protein context — as the
structural basis for an RFdiffusion3 design campaign. The tool is a thin
validation/summary wrapper over structure ingestion; it does not run folding.

## Input Schema

```jsonc
{
  "pdbContent": "ATOM ...",         // optional — PDB, required if mmCifContent absent
  "mmCifContent": "data_...",       // optional — mmCIF, required if pdbContent absent
  "chainId": "A",                   // optional — primary target chain (default "A")
  "source": "alphafold-db",         // optional — provenance tag
  "ensembleMember": 0               // optional — AF3 ensemble index
}
```

## Output Schema

```jsonc
{
  "body": {
    "structure": {
      "pdbContent": "ATOM ...",
      "mmCifContent": null,
      "chainId": "A",
      "summary": {
        "atomCount": 1842,
        "residueCount": 230,
        "chains": ["A"],
        "source": "alphafold-db"
      },
      "parseable": true
    }
  },
  "status": 200
}
```

## Error Schema

```jsonc
{
  "error": {
    "code": "INVALID_STRUCTURE",  // one of: INVALID_STRUCTURE | EMPTY_STRUCTURE | INTERNAL_ERROR
    "message": "No structure content provided"
  },
  "status": 400
}
```

| code | status | trigger |
|---|---|---|
| `EMPTY_STRUCTURE` | 400 | neither `pdbContent` nor `mmCifContent` was provided |
| `INVALID_STRUCTURE` | 422 | content provided but contains no `ATOM`/`_atom_site` records |
| `INTERNAL_ERROR` | 500 | ingestion failed |

## Example Request

```
POST /tools/structure_model
{
  "pdbContent": "ATOM      1  N   MET A   1       0.120  12.450  22.310  1.00 50.00           N\nATOM      2  CA  MET A   1       0.400  13.120  21.200  1.00 50.00           C",
  "chainId": "A",
  "source": "alphafold-db"
}
```

## Example Response

```json
{
  "body": {
    "structure": {
      "pdbContent": "ATOM      1  N   MET A   1       0.120  12.450  22.310  1.00 50.00           N",
      "mmCifContent": null,
      "chainId": "A",
      "summary": { "atomCount": 2, "residueCount": 1, "chains": ["A"], "source": "alphafold-db" },
      "parseable": true
    }
  },
  "status": 200
}
```

## OpenAPI-style Definition

```yaml
paths:
  /tools/structure_model:
    post:
      summary: Model / register a target protein structure
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/StructureModelInput' }
      responses:
        '200':
          description: Structure handle summary
          content:
            application/json:
              schema: { $ref: '#/components/schemas/StructureModelOutput' }
        '400':
          description: Missing structure content
components:
  schemas:
    StructureModelInput:
      type: object
      properties:
        pdbContent: { type: string }
        mmCifContent: { type: string }
        chainId: { type: string, default: A }
        source: { type: string }
        ensembleMember: { type: integer }
    StructureModelOutput:
      type: object
      properties:
        body:
          type: object
          properties:
            structure:
              type: object
              properties:
                pdbContent: { type: string }
                mmCifContent: { type: string, nullable: true }
                chainId: { type: string }
                summary:
                  type: object
                  properties:
                    atomCount: { type: integer }
                    residueCount: { type: integer }
                    chains: { type: array, items: { type: string } }
                    source: { type: string }
                parseable: { type: boolean }
        status: { type: integer, example: 200 }
    StructureModelError:
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

- The output `structure` maps 1:1 to the `structure` field consumed by
  `variant_analyze` (see `VariantConditioningInput.structure`).
- Downstream conditioning uses `pdbContent ?? mmCifContent` as its target
  structure string.