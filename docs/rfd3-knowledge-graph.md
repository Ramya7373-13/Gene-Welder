# RFD3 Domain Knowledge Graph (Phase H)

## Purpose

The design studio produces real scientific artifacts — protein variants, target
structures, full design runs, and ranked candidates — and Phase G made each one
auditable with a hash-linked provenance chain. This document defines how those
entities become a **domain knowledge graph** with the spine

```
Variant → Structure → Design → Candidate
```

rendered in the same `graph.json` format that the repo's `graphify-out/`
pipeline consumes, so the existing interactive `graph.html`, `graphify query`,
and `graphify path` tooling work against the domain graph without modification.

## 1. Analysis of `graphify-out/`

`graphify-out/` is a whole-repository **code AST graph** (built 2026-09-06, before
the RFD3 work existed). From `graphify-out/graph.json`:

- **7015 nodes**, **9469 links** (9 community-aggregated edges rendered in
  `graph.html`), each node keyed by slug like
  `backend_src_domain_dnastorage_constraintawarecodec_decodeconstraintaware`.
- Node schema (AST origin): `id`, `label`, `_callable`, `_callable_class`,
  `_origin`, `community`, `community_name`, `file_type`, `norm_label`,
  `source_file`, `source_location`.
- Link schema: `source`, `target`, `relation` (e.g. `calls`), `_origin`,
  `confidence`, `confidence_score`, `context`, `source_file`,
  `source_location`, `weight`.
- Top-level keys: `directed`, `multigraph`, `graph`, `nodes`, `links`,
  `hyperedges`, `built_at_commit`.

The code graph describes *files and symbols*. It says nothing about design
*instances* — a specific p.G12D run, its PDB target, or the candidates it
produced. That is the gap Phase H fills.

## 2. Domain model

Five node kinds, all carrying `_origin: "domain"` (distinct from the code
graph's `"ast"`/`"interpreted"` origins so the two graphs can coexist and be
filtered apart).

| Node kind | Source of truth                       | Backing code                             |
|-----------|---------------------------------------|------------------------------------------|
| `variant` | `DesignProject.targetVariant` (HGVS)  | `parseHgvsProtein` in `VariantConditioningEngine.ts` |
| `structure` | `DesignRun.targetStructure` (PDB/mmCIF) | `Rfd3Conditioning.targetStructure`      |
| `design`  | `DesignRun` row (mode/status/engine)  | `DesignService` + `RFDiffusion3Adapter`  |
| `candidate` | `DesignCandidate` row (rank/score)  | `DesignValidationEngine`/`DesignRankingService` |
| `ledger`  | `DesignLedger` row (Phase G chain)    | `ProvenanceService`                      |

### Edges (all directed)

| relation        | source      | target      | meaning |
|-----------------|-------------|-------------|---------|
| `maps_to`       | `variant`   | `structure` | the mutation site sits on the target structure |
| `conditions`    | `structure` | `design`    | the run was conditioned against the structure |
| `produces`      | `design`    | `candidate` | the run generated the candidate |
| `has_ledger_entry` | `candidate` | `ledger`  | the immutable provenance record for the candidate |
| `hash_chain_link` | `ledger`   | `ledger`    | phase G `previousLedgerHash` → `ledgerHash` link |

Node identity is deterministic and content-hashed so identical variants /
structures collapse to one node across projects and runs:

- `variant:<first-12-of-sha256(hgvs\|gene)>`, label = HGVS
- `structure:<first-12-of-sha256(pdbContent\|sequence)>`, label = `structure:<hash>`
- `design:<runId>`
- `candidate:<candidateId>`
- `ledger:<candidateId>:<first-12-of-ledgerHash>`

## 3. Graphify-compatible serialization

The builder emits a document with the same envelopes as `graphify-out/graph.json`:

```json
{
  "directed": true,
  "multigraph": true,
  "graph": {},
  "nodes": [ { "id": "...", "label": "...", "_origin": "domain", ... } ],
  "links": [ { "source": "...", "target": "...", "relation": "...",
                "confidence": "EXTRACTED", "confidence_score": 1.0,
                "_origin": "domain", "weight": 1.0 } ],
  "hyperedges": [],
  "built_at_commit": "<git hash of the ingester>"
}
```

Domain nodes add `domain_kind` and mark `file_type: "design"`; links carry the
graphify-confident `EXTRACTED` provenance because every edge is derived
deterministically from persisted rows — nothing is inferred.

## 4. Ingestion

Initial ingestion is a Prisma-backed adapter (`graph/ingest.ts`) that reads
`DesignProject → runs → candidates → ledgerEntries` for a user and runs the
pure builder `buildDesignKnowledgeGraph(...)`. Output is written to
`graphify-out/design-domain/graph.json` — a sibling of the code graph, never an
overwrite of it — so both graphs remain queryable by the existing tooling.

Reproducibility: the ingester stamps `built_at_commit` via
`getGitCommitHash()`, so the graph is tied to the exact code that produced it,
mirroring the ledger's `gitCommitHash`.

## 5. Verification

- Builder is pure: a fixed input dataset always yields the same nodes/links
  (stable ids, sorted output) — covered by unit tests.
- Tamper/consistency story reuses Phase G: `has_ledger_entry` +
  `hash_chain_link` edges mirror `previousLedgerHash`/`ledgerHash`, so the
  graph is a faithful projection of the verified ledger chain.