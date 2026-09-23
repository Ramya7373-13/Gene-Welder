// Phase H — domain knowledge graph builder.
//
// The builder is pure: a fixed dataset must yield the same nodes and links every
// run (stable content-hashed ids, sorted arrays), in the graphify-out envelope,
// projecting the Variant → Structure → Design → Candidate spine plus the Phase G
// ledger hash-chain. No prisma — fixture data only.

import { describe, expect, it } from '@jest/globals';
import {
  buildDesignKnowledgeGraph,
  serializeDesignGraph,
  type DesignGraphSource,
  type KnowledgeGraphDocument,
} from '../../../src/domain/proteinDesign/graph/DesignKnowledgeGraph.js';
import { projectsToSource } from '../../../src/domain/proteinDesign/graph/ingest.js';

const PDB = [
  'ATOM      1  N   ALA A   1       1.000   1.000   1.000  1.00  0.00           N',
  'ATOM      2  CA  ALA A   1       2.000   2.000   2.000  1.00  0.00           C',
].join('\n');

/** A small but representative fixture: one project, one run, two candidates, a ledger chain. */
function fixtureSource(builtAt = 'deadbeef'): DesignGraphSource {
  return {
    projects: [
      {
        id: 'proj-1',
        name: 'KRAS G12D binder',
        variant: { hgvs: 'p.G12D', gene: 'KRAS' },
        runs: [
          {
            id: 'run-1',
            mode: 'BINDER',
            designEngine: 'rfd3',
            status: 'COMPLETED',
            parameters: { numDesigns: 2 },
            targetStructure: PDB,
            targetSequence: 'ACDEFGHIK',
            candidates: [
              {
                id: 'cand-1',
                structure: PDB,
                sequence: 'ACDEFGHIK',
                affinityScore: 0.91,
                rankedPosition: 1,
                designMetrics: { pTM: 0.72 },
                structuredFile: 'candidates/cand-1/design_1.cif.gz',
                validation: { overallScore: 0.8, pTM: 0.72, ipTM: 0.61, pLDDT: 81 },
                ledgerEntries: [
                  {
                    candidateId: 'cand-1',
                    ledgerHash: 'aaaa1111',
                    modelVersion: 'rfd3-mock',
                    seed: 42,
                    timestamp: new Date('2026-09-22T00:00:00.000Z'),
                  },
                  {
                    candidateId: 'cand-1',
                    ledgerHash: 'bbbb2222',
                    previousLedgerHash: 'aaaa1111',
                    modelVersion: 'rfd3-mock',
                    seed: 42,
                    timestamp: new Date('2026-09-22T01:00:00.000Z'),
                  },
                ],
              },
              {
                id: 'cand-2',
                sequence: 'ACDEFGHIK',
                affinityScore: 0.77,
                rankedPosition: 2,
                designMetrics: { pTM: 0.6 },
                validation: { overallScore: 0.62 },
                ledgerEntries: [
                  {
                    candidateId: 'cand-2',
                    ledgerHash: 'cccc3333',
                    modelVersion: 'rfd3-mock',
                    seed: 7,
                    timestamp: new Date('2026-09-22T00:00:00.000Z'),
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'proj-2',
        name: 'Same variant, fresh structure',
        variant: { hgvs: 'p.G12D', gene: 'KRAS' },
        runs: [
          {
            id: 'run-2',
            mode: 'STABILIZER',
            designEngine: 'rfd3',
            status: 'FAILED',
            parameters: {},
            targetStructure: '# DIFFERENT TARGET\nATOM DIFFERENT',
            targetSequence: 'MKTAYIAKQRQISFVKSHFSRQDILDLWIYHTQGYFP',
            candidates: [
              {
                id: 'cand-3',
                sequence: 'MKTAYIAKQRQISFVKSHFSRQDILDLWIYHTQGYFP',
                ledgerEntries: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('DesignKnowledgeGraph', () => {
  it('emits the graphify-out envelope', () => {
    const doc = buildDesignKnowledgeGraph(fixtureSource(), { builtAtCommit: 'deadbeef' });
    expect(doc.directed).toBe(true);
    expect(doc.multigraph).toBe(true);
    expect(doc.graph).toEqual({});
    expect(doc.hyperedges).toEqual([]);
    expect(doc.built_at_commit).toBe('deadbeef');
    expect(Array.isArray(doc.nodes)).toBe(true);
    expect(Array.isArray(doc.links)).toBe(true);
  });

  it('builds the Variant → Structure → Design → Candidate spine', () => {
    const doc = buildDesignKnowledgeGraph(fixtureSource());

    const variant = doc.nodes.find((n) => n.domain_kind === 'variant');
    const structures = doc.nodes.filter((n) => n.domain_kind === 'structure');
    const design = doc.nodes.find((n) => n.id === 'design:run-1');
    const candidate = doc.nodes.find((n) => n.id === 'candidate:cand-1');

    expect(variant).toBeDefined();
    expect(variant?.hgvs).toBe('p.G12D');
    expect(variant?._origin).toBe('domain');
    expect(variant?.file_type).toBe('design');
    expect(structures).toHaveLength(2);
    expect(design).toBeDefined();
    expect(design?.mode).toBe('BINDER');
    expect(candidate).toBeDefined();
    expect(candidate?.rankedPosition).toBe(1);

    // maps_to (variant → structure)
    expect(
      doc.links.some(
        (l) =>
          l.source === variant?.id &&
          l.source.startsWith('variant:') &&
          l.relation === 'maps_to',
      ),
    ).toBe(true);
    // conditions (structure → design)
    expect(
      doc.links.some((l) => l.target === 'design:run-1' && l.relation === 'conditions'),
    ).toBe(true);
    // produces (design → candidate)
    expect(
      doc.links.some(
        (l) => l.source === 'design:run-1' && l.target === 'candidate:cand-1' && l.relation === 'produces',
      ),
    ).toBe(true);
  });

  it('deduplicates variants across projects by (hgvs, gene)', () => {
    const doc = buildDesignKnowledgeGraph(fixtureSource());
    const variants = doc.nodes.filter((n) => n.domain_kind === 'variant');
    expect(variants).toHaveLength(1);
    expect(variants[0].hgvs).toBe('p.G12D');
  });

  it('deduplicates identical structures but keeps distinct targets', () => {
    const doc = buildDesignKnowledgeGraph(fixtureSource());
    expect(doc.nodes.filter((n) => n.domain_kind === 'structure')).toHaveLength(2);
  });

  it('projects the ledger hash-chain as ledger nodes and chain links', () => {
    const doc = buildDesignKnowledgeGraph(fixtureSource());
    const ledgers = doc.nodes.filter((n) => n.domain_kind === 'ledger');
    expect(ledgers).toHaveLength(3);

    // cand-1 has two chained entries; the second links back to the first.
    const chain = doc.links.filter((l) => l.relation === 'hash_chain_link');
    expect(chain).toHaveLength(1);
    expect(chain[0].target).toContain('aaaa1111');
    expect(chain[0].source).toContain('bbbb2222');

    // Every ledger node is attached to its candidate.
    const attach = doc.links.filter((l) => l.relation === 'has_ledger_entry');
    expect(attach).toHaveLength(3);
  });

  it('is deterministic: identical input → identical document', () => {
    const a = serializeDesignGraph(buildDesignKnowledgeGraph(fixtureSource()));
    const b = serializeDesignGraph(buildDesignKnowledgeGraph(fixtureSource()));
    expect(a).toBe(b);
    expect(JSON.parse(a)).toEqual(JSON.parse(b));
  });

  it('sorts nodes and links for stable diffing', () => {
    const doc = buildDesignKnowledgeGraph(fixtureSource());
    const ids = doc.nodes.map((n) => n.id);
    expect(ids).toEqual([...ids].sort());
    const linkKeys = doc.links.map((l) => `${l.source}|${l.target}|${l.relation}`);
    expect(linkKeys).toEqual([...linkKeys].sort());
  });

  it('marks every node and link with _origin domain and EXTRACTED provenance', () => {
    const doc = buildDesignKnowledgeGraph(fixtureSource());
    for (const node of doc.nodes) {
      expect(node._origin).toBe('domain');
      expect(node._callable).toBe(false);
    }
    for (const link of doc.links) {
      expect(link._origin).toBe('domain');
      expect(link.confidence).toBe('EXTRACTED');
      expect(link.confidence_score).toBe(1.0);
    }
  });

  it('maps prisma-shaped project rows into the builder source', () => {
    const source = projectsToSource([
      {
        id: 'proj-9',
        name: 'proj',
        targetGene: 'TP53',
        targetVariant: 'p.R273H',
        runs: [
          {
            id: 'run-9',
            mode: 'STABILIZER',
            designEngine: 'rfd3',
            status: 'RUNNING',
            parameters: {},
            targetStructure: PDB,
            targetSequence: null,
            candidates: [
              {
                id: 'cand-9',
                runId: 'run-9',
                structure: PDB,
                sequence: null,
                affinityScore: null,
                rankedPosition: null,
                designMetrics: {},
                structuredFile: null,
                validationResults: [{ overallScore: 0.5, pTM: null, ipTM: null, pLDDT: null }],
                ledgerEntries: [
                  {
                    ledgerHash: 'deadbeefcafe',
                    previousLedgerHash: null,
                    modelVersion: 'rfd3-mock',
                    seed: 3,
                    timestamp: new Date('2026-09-22T00:00:00.000Z'),
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    const doc = buildDesignKnowledgeGraph(source);
    const variant = doc.nodes.find((n) => n.domain_kind === 'variant');
    expect(variant?.hgvs).toBe('p.R273H');
    const candidate = doc.nodes.find((n) => n.id === 'candidate:cand-9');
    expect(candidate?.overallScore).toBe(0.5);
    expect(doc.links.some((l) => l.relation === 'has_ledger_entry')).toBe(true);
  });

  it('serializes to stable, pretty JSON', () => {
    const doc = buildDesignKnowledgeGraph(fixtureSource());
    const json = serializeDesignGraph(doc);
    expect(json.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(json) as KnowledgeGraphDocument;
    expect(parsed.nodes.length).toBe(doc.nodes.length);
    expect(parsed.links.length).toBe(doc.links.length);
  });
});