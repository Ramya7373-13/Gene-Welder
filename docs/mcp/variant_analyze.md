# MCP Tool Spec — `variant_analyze`

Analyze a genomic / protein variant (HGVS format) and produce the variant
conditioning payload used to drive RFdiffusion3 design. Wraps the domain
`VariantConditioningEngine` (backend `backend/src/domain/proteinDesign/conditioning/VariantConditioningEngine.ts`).

## Purpose

Given a disease variant and its structural context, translate the mutation into
RFD3-ready constraints: hotspot residues, burial depth, hydrogen bonds, interface
regions, center of mass, and a derived design mode.

## Input Schema

```jsonc
{
  "variant": {                       // required
    "hgvs": "p.Gly12Asp",            // required — HGVS protein notation, regex p\.([A-Z])(\d+)([A-Z])
    "gene": "KRAS",                  // optional
    "aminoAcidChange": "G12D",       // optional — short annotation
    "position": 12                   // optional — numeric position
  },
  "structure": {                     // required — at least one content field
    "pdbContent": "ATOM ...",        // optional — PDB
    "mmCifContent": "data_...",      // optional — mmCIF
    "chainId": "A"                   // optional — target chain
  },
  "annotations": {                   // optional
    "alphamissenseScore": 0.82,      // optional
    "clinvarSignificance": "pathogenic", // optional
    "gnomadFrequency": 0.0013,       // optional
    "af3Model": "https://...",       // optional
    "rmsdToWildtype": 0.4            // optional
  },
  "designObjectives": [              // optional
    {
      "mode": "BINDER",              // optional — DesignMode
      "priority": 1,
      "description": "Binder against mutant hotspot",
      "notes": ""
    }
  ]
}
```

## Output Schema

```jsonc
{
  "body": {
    "conditioning": {
      "hotspots": [{ "chain": "A", "position": 12 }],          // ResiduePosition[]
      "burialDepth": [{ "type": "burialDepth", "residues": [{ "chain": "A", "position": 12 }], "minDepth": 2.0, "maxDepth": 8.0 }],
      "hydrogenBonds": [{ "type": "hbond", "donorPosition": { "chain": "A", "position": 12 }, "acceptorPosition": { "chain": "A", "position": 13 }, "donorAtom": "NE2", "acceptorAtom": "O" }],
      "interfaceRegions": [{ "type": "interface", "chain": "A", "residues": [12, 10, 11, 13, 14, 15], "shapeComplementarity": 0.7 }],
      "centerOfMass": { "type": "centerOfMass", "targetPosition": { "x": 3.14, "y": 10.48, "z": 3.99 }, "radius": 12.0 },
      "targetStructure": "ATOM ...",
      "targetSequence": "G12D",
      "designMode": "BINDER",
      "customConstraints": {
        "variantAnnotations": { "alphamissenseScore": 0.82 },
        "mutationDetails": { "wildType": "G", "position": 12, "mutant": "D" },
        "designObjectives": []
      }
    }
  },
  "status": 200
}
```

## Error Schema

```jsonc
{
  "error": {
    "code": "INVALID_HGVS",   // one of: INVALID_HGVS | INVALID_STRUCTURE | INTERNAL_ERROR
    "message": "Unable to parse HGVS variant: p.X12"
  },
  "status": 400
}
```

| code | status | trigger |
|---|---|---|
| `INVALID_HGVS` | 400 | `hgvs` does not match `p\.([A-Z])(\d+)([A-Z])` |
| `INVALID_STRUCTURE` | 400 | neither `pdbContent` nor `mmCifContent` provided |
| `INTERNAL_ERROR` | 500 | conditioning engine threw |

## Example Request

```
POST /tools/variant_analyze
{
  "variant": {
    "hgvs": "p.Gly12Asp",
    "gene": "KRAS",
    "aminoAcidChange": "G12D"
  },
  "structure": {
    "pdbContent": "ATOM      1  N   GLY A  12       1.230   2.034   3.490  1.00 50.00           N",
    "chainId": "A"
  }
}
```

## Example Response

```json
{
  "body": {
    "conditioning": {
      "hotspots": [{"chain": "A", "position": 12}, {"chain": "A", "position": 10}, {"chain": "A", "position": 11}, {"chain": "A", "position": 13}, {"chain": "A", "position": 14}, {"chain": "A", "position": 15}],
      "burialDepth": [{"type": "burialDepth", "residues": [{"chain": "A", "position": 12}], "minDepth": 2.0, "maxDepth": 8.0}],
      "hydrogenBonds": [{"type": "hbond", "donorPosition": {"chain": "A", "position": 12}, "acceptorPosition": {"chain": "A", "position": 13}, "donorAtom": "NE2", "acceptorAtom": "O"}],
      "interfaceRegions": [{"type": "interface", "chain": "A", "residues": [12, 10, 11, 13, 14, 15], "shapeComplementarity": 0.7}],
      "centerOfMass": {"type": "centerOfMass", "targetPosition": {"x": 3.14, "y": 10.48, "z": 3.99}, "radius": 12.0},
      "targetStructure": "ATOM      1  N   GLY A  12       1.230   2.034   3.490  1.00 50.00           N",
      "targetSequence": "G12D",
      "designMode": "BINDER",
      "customConstraints": {
        "variantAnnotations": {},
        "mutationDetails": {"wildType": "G", "position": 12, "mutant": "D"},
        "designObjectives": []
      }
    }
  },
  "status": 200
}
```

## OpenAPI-style Definition

```yaml
paths:
  /tools/variant_analyze:
    post:
      summary: Analyze HGVS variant into RFD3 conditioning payload
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/VariantAnalyzeInput' }
      responses:
        '200':
          description: Conditioning payload
          content:
            application/json:
              schema: { $ref: '#/components/schemas/VariantAnalyzeOutput' }
        '400':
          description: Invalid HGVS or missing structure
          content:
            application/json:
              schema: { $ref: '#/components/schemas/VariantAnalyzeError' }
components:
  schemas:
    VariantAnalyzeInput:
      type: object
      required: [variant, structure]
      properties:
        variant:
          type: object
          required: [hgvs]
          properties:
            hgvs: { type: string, pattern: '^p\.[A-Z]([0-9]+)[A-Z]$' }
            gene: { type: string }
            aminoAcidChange: { type: string }
            position: { type: integer }
        structure:
          type: object
          properties:
            pdbContent: { type: string }
            mmCifContent: { type: string }
            chainId: { type: string }
        annotations:
          type: object
          properties:
            alphamissenseScore: { type: number, format: float, maximum: 1 }
            clinvarSignificance: { type: string }
            gnomadFrequency: { type: number }
            af3Model: { type: string }
            rmsdToWildtype: { type: number }
        designObjectives:
          type: array
          items:
            type: object
            properties:
              mode: { $ref: '#/components/schemas/DesignMode' }
              priority: { type: integer }
              description: { type: string }
    VariantAnalyzeOutput:
      type: object
      properties:
        body:
          type: object
          properties:
            conditioning: { $ref: '#/components/schemas/Rfd3Conditioning' }
        status: { type: integer, example: 200 }
    VariantAnalyzeError:
      type: object
      properties:
        error:
          type: object
          properties:
            code: { type: string, enum: [INVALID_HGVS, INVALID_STRUCTURE, INTERNAL_ERROR] }
            message: { type: string }
        status: { type: integer }
    DesignMode:
      type: string
      enum: [BINDER, STABILIZER, DNA_BINDER, ENZYME_RESCUE, SCAFFOLD, SYMMETRIC_ASSEMBLY, MOTIF_SCAFFOLD, PROTEIN_SCAFFOLD]
    Rfd3Conditioning:
      type: object
      properties:
        hotspots:
          type: array
          items: { $ref: '#/components/schemas/ResiduePosition' }
        burialDepth:
          type: array
          items: { $ref: '#/components/schemas/BurialDepthConstraint' }
        hydrogenBonds:
          type: array
          items: { $ref: '#/components/schemas/HydrogenBondConstraint' }
        interfaceRegions:
          type: array
          items: { $ref: '#/components/schemas/InterfaceConstraint' }
        motifSpec: { $ref: '#/components/schemas/MotifConstraint' }
        centerOfMass: { $ref: '#/components/schemas/CenterOfMassConstraint' }
        targetStructure: { type: string }
        targetSequence: { type: string }
        designMode: { $ref: '#/components/schemas/DesignMode' }
        customConstraints: { type: object }
    ResiduePosition:
      type: object
      required: [chain, position]
      properties:
        chain: { type: string }
        position: { type: integer }
        insertCode: { type: string }
    BurialDepthConstraint:
      type: object
      properties:
        type: { type: string, enum: [burialDepth] }
        residues:
          type: array
          items: { $ref: '#/components/schemas/ResiduePosition' }
        minDepth: { type: number }
        maxDepth: { type: number }
    HydrogenBondConstraint:
      type: object
      properties:
        type: { type: string, enum: [hbond] }
        donorPosition: { $ref: '#/components/schemas/ResiduePosition' }
        acceptorPosition: { $ref: '#/components/schemas/ResiduePosition' }
        donorAtom: { type: string }
        acceptorAtom: { type: string }
    InterfaceConstraint:
      type: object
      properties:
        type: { type: string, enum: [interface] }
        chain: { type: string }
        residues:
          type: array
          items: { type: integer }
        shapeComplementarity: { type: number }
    MotifConstraint:
      type: object
      properties:
        type: { type: string, enum: [motif] }
        motifName: { type: string }
        residues:
          type: array
          items: { $ref: '#/components/schemas/ResiduePosition' }
        preserveOrientation: { type: boolean }
    CenterOfMassConstraint:
      type: object
      properties:
        type: { type: string, enum: [centerOfMass] }
        targetPosition:
          type: object
          properties:
            x: { type: number }
            y: { type: number }
            z: { type: number }
        radius: { type: number }
```

## Notes

- HGVS parsing uses the exact regex `p\.([A-Z])(\d+)([A-Z])` from
  `parseHgvsProtein`; `p.F508del`-style notations are not yet supported and
  return `INVALID_HGVS`. The frontend VariantSelector only offers variants that
  match this grammar.
- Hotspot residues are the mutated residue plus neighbors `[-2, -1, +1, +2, +3]`.
- The inferred design mode defaults to `BINDER` when no design objective is given.