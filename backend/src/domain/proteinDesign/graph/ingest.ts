// ingest — Prisma-backed adapter that loads persisted design rows and hands them
// to the pure DesignKnowledgeGraph builder.
//
// Initial ingestion returns the graphify-compatible document for a user's design
// portfolio (or the whole studio when no user is given) and can optionally write
// it to `graphify-out/design-domain/graph.json` — a sibling of the repo's code
// graph, never an overwrite — so both graphs remain queryable by the same tooling.

import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../../../prisma.js';
import { getGitCommitHash } from '../utils/gitHash.js';
import {
  buildDesignKnowledgeGraph,
  serializeDesignGraph,
  type DesignGraphSource,
  type KnowledgeGraphDocument,
} from './DesignKnowledgeGraph.js';

/** Shape of a Project row with the nested relations ingestion needs. */
interface ProjectWithRelations {
  id: string;
  name: string;
  targetGene: string | null;
  targetVariant: string | null;
  runs: {
    id: string;
    mode: string;
    designEngine: string;
    status: string;
    parameters: unknown;
    targetStructure: string | null;
    targetSequence: string | null;
    candidates: CandidateWithRelations[];
  }[];
}

interface CandidateWithRelations {
  id: string;
  runId: string;
  structure: string | null;
  sequence: string | null;
  affinityScore: number | null;
  rankedPosition: number | null;
  designMetrics: unknown;
  structuredFile: string | null;
  validationResults: { overallScore: number | null; pTM: number | null; ipTM: number | null; pLDDT: number | null }[];
  ledgerEntries: { ledgerHash: string | null; previousLedgerHash: string | null; modelVersion: string; seed: number; timestamp: Date }[];
}

/**
 * Load a user's design portfolio (or the whole studio) and build the domain
 * knowledge graph document from the persisted rows.
 */
export async function ingestDesignGraph(userId?: string): Promise<KnowledgeGraphDocument> {
  const projects = (await prisma.designProject.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { createdAt: 'asc' },
    include: {
      runs: {
        orderBy: { createdAt: 'asc' },
        include: {
          candidates: {
            orderBy: { createdAt: 'asc' },
            include: {
              validationResults: { orderBy: { createdAt: 'desc' }, take: 1 },
              ledgerEntries: { orderBy: { timestamp: 'asc' } },
            },
          },
        },
      },
    },
  })) as unknown as ProjectWithRelations[];

  const source = projectsToSource(projects);
  return buildDesignKnowledgeGraph(source, { builtAtCommit: getGitCommitHash() });
}

/** Environment override for the graph output directory. */
const graphDirEnv = process.env.DESIGN_GRAPH_DIR;

/**
 * Write the domain graph to disk. Defaults to `<repo>/graphify-out/design-domain/`
 * (one level up from the backend cwd, matching the repo layout), overridable via
 * `DESIGN_GRAPH_DIR` or an explicit directory.
 */
export function writeDesignGraph(
  doc: KnowledgeGraphDocument,
  options: { dir?: string } = {},
): string {
  const dir =
    options.dir ??
    graphDirEnv ??
    path.join(process.cwd(), '..', 'graphify-out', 'design-domain');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'graph.json');
  fs.writeFileSync(file, serializeDesignGraph(doc), 'utf-8');
  return file;
}

/** Map persisted project rows into the builder's source shape (pure, testable). */
export function projectsToSource(projects: ProjectWithRelations[]): DesignGraphSource {
  return {
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      variant: {
        hgvs: project.targetVariant ?? undefined,
        gene: project.targetGene ?? undefined,
      },
      runs: (project.runs ?? []).map((run) => ({
        id: run.id,
        mode: run.mode,
        designEngine: run.designEngine,
        status: run.status,
        parameters: (run.parameters ?? undefined) as Record<string, unknown> | undefined,
        targetStructure: run.targetStructure ?? undefined,
        targetSequence: run.targetSequence ?? undefined,
        candidates: (run.candidates ?? []).map((candidate) => ({
          id: candidate.id,
          structure: candidate.structure ?? undefined,
          sequence: candidate.sequence ?? undefined,
          affinityScore: candidate.affinityScore ?? undefined,
          rankedPosition: candidate.rankedPosition ?? undefined,
          designMetrics: (candidate.designMetrics ?? undefined) as Record<string, unknown> | undefined,
          structuredFile: candidate.structuredFile ?? undefined,
          validation: candidate.validationResults?.[0]
            ? {
                overallScore: candidate.validationResults[0].overallScore ?? undefined,
                pTM: candidate.validationResults[0].pTM ?? undefined,
                ipTM: candidate.validationResults[0].ipTM ?? undefined,
                pLDDT: candidate.validationResults[0].pLDDT ?? undefined,
              }
            : undefined,
          ledgerEntries: (candidate.ledgerEntries ?? []).map((entry) => ({
            candidateId: candidate.id,
            ledgerHash: entry.ledgerHash ?? undefined,
            previousLedgerHash: entry.previousLedgerHash ?? undefined,
            modelVersion: entry.modelVersion,
            seed: entry.seed,
            timestamp: entry.timestamp,
          })),
        })),
      })),
    })),
  };
}