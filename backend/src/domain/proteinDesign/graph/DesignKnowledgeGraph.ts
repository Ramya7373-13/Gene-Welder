// DesignKnowledgeGraph — pure builder for the RFD3 domain knowledge graph.
//
// Turns persisted design entities into a graphify-out compatible graph.json
// document so the repo's existing graph tooling (interactive graph.html,
// `graphify query`, `graphify path`) can query the design domain exactly like it
// queries the code AST graph. The spine is:
//
//   variant → structure → design → candidate
//
// with the Phase G hash-chain projected as ledger nodes. Every node carries
// `_origin: "domain"` (vs the code graph's `"ast"`/`"interpreted"`) so the two
// graphs can coexist and be filtered apart.
//
// The builder is pure: the same input always yields the same document (stable,
// content-hashed node ids; sorted node/link arrays), which the unit tests pin
// down.

import crypto from 'node:crypto';
import { stableStringify } from '../utils/stableJson.js';

// --- Source shapes (what the ingester feeds the builder) --------------------

export interface DesignGraphVariantSource {
  hgvs?: string | null;
  gene?: string | null;
}

export interface DesignGraphRunSource {
  id: string;
  mode: string;
  designEngine: string;
  status: string;
  parameters?: Record<string, unknown> | null;
  targetStructure?: string | null;
  targetSequence?: string | null;
  candidates: DesignGraphCandidateSource[];
}

export interface DesignGraphCandidateSource {
  id: string;
  structure?: string | null;
  sequence?: string | null;
  affinityScore?: number | null;
  rankedPosition?: number | null;
  designMetrics?: Record<string, unknown> | null;
  structuredFile?: string | null;
  validation?: {
    overallScore?: number | null;
    pTM?: number | null;
    ipTM?: number | null;
    pLDDT?: number | null;
  } | null;
  ledgerEntries: DesignGraphLedgerSource[];
}

export interface DesignGraphLedgerSource {
  candidateId: string;
  ledgerHash?: string | null;
  previousLedgerHash?: string | null;
  modelVersion: string;
  seed: number;
  timestamp: Date;
}

export interface DesignGraphProjectSource {
  id: string;
  name: string;
  variant?: DesignGraphVariantSource | null;
  runs: DesignGraphRunSource[];
}

export interface DesignGraphSource {
  projects: DesignGraphProjectSource[];
}

// --- Graphify-compatible output shapes --------------------------------------

export type DomainNodeKind = 'variant' | 'structure' | 'design' | 'candidate' | 'ledger';

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  _callable: boolean;
  _callable_class: boolean;
  _origin: string;
  community: number;
  community_name: string;
  file_type: string;
  norm_label: string;
  source_file: string;
  source_location: string;
  domain_kind: DomainNodeKind;
  [key: string]: unknown;
}

export interface KnowledgeGraphLink {
  source: string;
  target: string;
  relation: string;
  _origin: string;
  confidence: string;
  confidence_score: number;
  context: string;
  source_file: string;
  source_location: string;
  weight: number;
}

export interface KnowledgeGraphDocument {
  directed: boolean;
  multigraph: boolean;
  graph: Record<string, unknown>;
  nodes: KnowledgeGraphNode[];
  links: KnowledgeGraphLink[];
  hyperedges: unknown[];
  built_at_commit: string;
}

/**
 * Node community per domain kind, so the graph.html clustering splits the design
 * domain into its entity types. Numbers are arbitrary but stable.
 */
const COMMUNITY_BY_KIND: Record<DomainNodeKind, { community: number; name: string }> = {
  variant: { community: 0, name: 'variant' },
  structure: { community: 1, name: 'structure' },
  design: { community: 2, name: 'design' },
  candidate: { community: 3, name: 'candidate' },
  ledger: { community: 4, name: 'ledger' },
};

function normLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function variantNodeId(hgvs: string, gene?: string | null): string {
  const key = `${hgvs}|${gene ?? ''}`;
  return `variant:${shortHash(key)}`;
}

function structureNodeId(run: DesignGraphRunSource): string {
  const key = stableStringify({
    structure: run.targetStructure ?? null,
    sequence: run.targetSequence ?? null,
  });
  return `structure:${shortHash(key)}`;
}

function shortHash(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf-8').digest('hex').slice(0, 12);
}

function ledgerNodeId(candidateId: string, ledgerHash: string | null | undefined, index: number): string {
  const hash = ledgerHash && ledgerHash.length > 0 ? ledgerHash.slice(0, 12) : `entry-${index}`;
  return `ledger:${candidateId}:${hash}`;
}

function makeNode(input: {
  id: string;
  label: string;
  kind: DomainNodeKind;
  source_location: string;
  extra?: Record<string, unknown>;
}): KnowledgeGraphNode {
  const { community, name } = COMMUNITY_BY_KIND[input.kind];
  return {
    id: input.id,
    label: input.label,
    _callable: false,
    _callable_class: false,
    _origin: 'domain',
    community,
    community_name: name,
    file_type: 'design',
    norm_label: normLabel(input.label),
    source_file: `domain/${input.kind}`,
    source_location: input.source_location,
    domain_kind: input.kind,
    ...(input.extra ?? {}),
  };
}

function makeLink(input: {
  source: string;
  target: string;
  relation: string;
  context: string;
}): KnowledgeGraphLink {
  return {
    source: input.source,
    target: input.target,
    relation: input.relation,
    _origin: 'domain',
    confidence: 'EXTRACTED',
    confidence_score: 1.0,
    context: input.context,
    source_file: 'domain/design',
    source_location: input.source,
    weight: 1.0,
  };
}

/**
 * Build the domain graph from a source dataset.
 *
 * Identity rules:
 *   - a variant is keyed by (hgvs, gene) so identical variants collapse across
 *     projects and runs
 *   - a structure is keyed by its (structure, sequence) content so identical
 *     targets collapse across runs
 *   - designs, candidates and ledgers are unique by their own ids
 *
 * Output is deterministic: nodes sorted by id, links sorted by
 * (source, target, relation).
 */
export function buildDesignKnowledgeGraph(
  source: DesignGraphSource,
  options: { builtAtCommit?: string } = {},
): KnowledgeGraphDocument {
  return buildDesignGraphFromSource(source, options.builtAtCommit ?? 'unknown');
}

function buildDesignGraphFromSource(
  source: DesignGraphSource,
  builtAtCommit: string,
): KnowledgeGraphDocument {
  const nodes = new Map<string, KnowledgeGraphNode>();
  const variantsByKey = new Map<string, string>();
  const structuresByKey = new Map<string, string>();
  const links = new Map<string, KnowledgeGraphLink>();

  const getOrAddVariantNode = (variant: DesignGraphVariantSource | null | undefined): string | undefined => {
    if (!variant?.hgvs) return undefined;
    const id = variantNodeId(variant.hgvs, variant.gene);
    const byKey = variantsByKey.get(id);
    if (byKey) return byKey;
    nodes.set(
      id,
      makeNode({
        id,
        kind: 'variant',
        label: variant.hgvs,
        source_location: `variant:${variant.hgvs}`,
        extra: { hgvs: variant.hgvs, gene: variant.gene ?? null },
      }),
    );
    variantsByKey.set(id, id);
    return id;
  };

  const getOrAddStructureNode = (run: DesignGraphRunSource): string => {
    const id = structureNodeId(run);
    const byKey = structuresByKey.get(id);
    if (byKey) return byKey;
    nodes.set(
      id,
      makeNode({
        id,
        kind: 'structure',
        label: id,
        source_location: `run:${run.id}`,
        extra: {
          mode: run.mode,
          designEngine: run.designEngine,
          hasStructure: Boolean(run.targetStructure),
        },
      }),
    );
    structuresByKey.set(id, id);
    return id;
  };

  const addEdge = (
    source: string,
    target: string,
    relation: string,
    context: string,
  ): void => {
    const key = `${source}|${target}|${relation}`;
    if (!links.has(key)) {
      links.set(key, makeLink({ source, target, relation, context }));
    }
  };

  for (const project of source.projects) {
    for (const run of project.runs) {
      const structureId = getOrAddStructureNode(run);

      // Variant → structure: the mutation site sits on the target structure.
      const variantId = getOrAddVariantNode(project.variant);
      if (variantId) addEdge(variantId, structureId, 'maps_to', 'variant mapped to target structure');

      // Structure → design: the run was conditioned against the structure.
      const designId = `design:${run.id}`;
      if (!nodes.has(designId)) {
        nodes.set(
          designId,
          makeNode({
            id: designId,
            kind: 'design',
            label: `${run.mode}@${run.id.slice(0, 8)}`,
            source_location: `run:${run.id}`,
            extra: {
              mode: run.mode,
              designEngine: run.designEngine,
              status: run.status,
            },
          }),
        );
      }
      addEdge(structureId, designId, 'conditions', 'run conditioned against target structure');

      // Design → candidate, candidate → ledger, ledger → ledger hash chain.
      for (const candidate of run.candidates) {
        const candidateId = `candidate:${candidate.id}`;
        if (!nodes.has(candidateId)) {
          nodes.set(
            candidateId,
            makeNode({
              id: candidateId,
              kind: 'candidate',
              label: `candidate-${candidate.id.slice(0, 8)}`,
              source_location: `candidate:${candidate.id}`,
              extra: {
                rankedPosition: candidate.rankedPosition ?? null,
                affinityScore: candidate.affinityScore ?? null,
                overallScore: candidate.validation?.overallScore ?? null,
                pTM: candidate.validation?.pTM ?? null,
                ipTM: candidate.validation?.ipTM ?? null,
                pLDDT: candidate.validation?.pLDDT ?? null,
              },
            }),
          );
        }
        addEdge(designId, candidateId, 'produces', 'run produced candidate');

        const ledgerByHash = new Map<string, string>();
        candidate.ledgerEntries.forEach((entry, index) => {
          const id = ledgerNodeId(candidate.id, entry.ledgerHash, index);
          if (!nodes.has(id)) {
            nodes.set(
              id,
              makeNode({
                id,
                kind: 'ledger',
                label: `ledger-${id.slice(id.length - 12)}`,
                source_location: `ledger:${candidate.id}`,
                extra: {
                  modelVersion: entry.modelVersion,
                  seed: entry.seed,
                  ledgerHash: entry.ledgerHash ?? null,
                  previousLedgerHash: entry.previousLedgerHash ?? null,
                  timestamp: entry.timestamp.toISOString(),
                },
              }),
            );
          }
          if (entry.ledgerHash) ledgerByHash.set(entry.ledgerHash, id);
          addEdge(candidateId, id, 'has_ledger_entry', 'candidate recorded in provenance ledger');
        });

        // Chain projection: the current entry links back to the prior entry via
        // its previousLedgerHash (Phase G semantics).
        for (const [index, entry] of candidate.ledgerEntries.entries()) {
          if (!entry.previousLedgerHash) continue;
          const prior = ledgerByHash.get(entry.previousLedgerHash);
          const current = ledgerNodeId(candidate.id, entry.ledgerHash, index);
          if (prior && current !== prior) {
            addEdge(current, prior, 'hash_chain_link', 'ledger entry linked to previous hash');
          }
        }
      }
    }
  }

  const orderedNodes = Array.from(nodes.values()).sort((a, b) => a.id.localeCompare(b.id));
  const orderedLinks = Array.from(links.values()).sort((a, b) => {
    return `${a.source}|${a.target}|${a.relation}`.localeCompare(`${b.source}|${b.target}|${b.relation}`);
  });

  return {
    directed: true,
    multigraph: true,
    graph: {},
    nodes: orderedNodes,
    links: orderedLinks,
    hyperedges: [],
    built_at_commit: builtAtCommit,
  };
}

/** Serialize the document in the same pretty style as graphify's graph.json. */
export function serializeDesignGraph(doc: KnowledgeGraphDocument): string {
  return stableStringify(doc);
}