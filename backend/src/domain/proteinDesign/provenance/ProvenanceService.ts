// Provenance Service - Tracks model versions, weights hashes, seeds, and input constraints.
// Ensures every design is reproducible with its full execution context.
//
// Phase G: the ledger becomes a cryptographically linked hash chain. Every entry
// records the candidate content hash, the validation hash, the source revision,
// the job id, and a link to the previous entry of the same candidate. Tampering
// with any entry (row, snapshot, or the files it points at) is detectable by
// recomputing the hashes and walking the chain.

import crypto from 'node:crypto';
import { stableStringify } from '../utils/stableJson.js';
import type {
  DesignLedgerEntry,
  Rfd3Conditioning,
  ValidationResult,
} from '../types/index.js';

export interface ProvenanceRecord {
  modelVersion: string;
  weightsHash: string;
  seed: number;
  inputConstraints: Rfd3Conditioning;
  user: string;
  executionContext: Record<string, unknown>;
  timestamp: Date;
  validationMetrics?: Record<string, unknown>;
}

/** Canonical payload a candidate's content hash commits to. */
export interface CandidateHashContent {
  structure?: string | null;
  sequence?: string | null;
  metrics?: Record<string, unknown> | null;
}

/**
 * Service that creates and manages immutable provenance records (design ledger).
 */
export class ProvenanceService {
  generateSeed(): number {
    return Math.floor(Math.random() * 2147483647);
  }

  /**
   * Build a provenance record for one design execution.
   *
   * The record deliberately does not carry candidate content: a candidate is
   * identified by its id (attached in `toLedgerEntry`) and its structure and
   * sequence live in the DesignCandidate row the ledger points at. Recording
   * them twice would create two sources of truth for the same artifact — the
   * hash chain commits to the content via `computeCandidateHash` instead.
   */
  createRecord(
    conditioning: Rfd3Conditioning,
    modelInfo: { version: string; weightsHash: string },
    seed: number,
    user: string,
    executionContext?: Record<string, unknown>,
  ): ProvenanceRecord {
    return {
      modelVersion: modelInfo.version,
      weightsHash: modelInfo.weightsHash,
      seed,
      inputConstraints: conditioning,
      user,
      executionContext: executionContext ?? {},
      timestamp: new Date(),
    };
  }

  toLedgerEntry(
    record: ProvenanceRecord,
    candidateId: string,
    runId?: string,
    projectId?: string,
    extras?: {
      jobId?: string;
      gitCommitHash?: string;
      candidateHash?: string;
      validationHash?: string;
    },
  ): DesignLedgerEntry {
    return {
      candidateId,
      modelVersion: record.modelVersion,
      weightsHash: record.weightsHash,
      seed: record.seed,
      inputConstraints: record.inputConstraints as unknown as Record<string, unknown>,
      userId: record.user,
      timestamp: record.timestamp,
      runId,
      projectId,
      validationMetrics: record.validationMetrics as unknown as ValidationResult,
      jobId: extras?.jobId,
      gitCommitHash: extras?.gitCommitHash,
      candidateHash: extras?.candidateHash,
      validationHash: extras?.validationHash,
    };
  }

  verifyReproducibility(
    entry: DesignLedgerEntry,
    modelInfo: { version: string; weightsHash: string },
    seed: number,
  ): boolean {
    return (
      entry.modelVersion === modelInfo.version &&
      entry.weightsHash === modelInfo.weightsHash &&
      entry.seed === seed
    );
  }

  formatReproducibilityKey(entry: DesignLedgerEntry): string {
    return `RFD3-${entry.modelVersion}-hash:${entry.weightsHash.slice(0, 12)}-seed:${entry.seed}`;
  }

  // --- Phase G: hash chain --------------------------------------------------

  /**
   * sha256 digest of the canonical serialization of `parts`. Canonical JSON via
   * stableStringify means the digest is independent of key order and insertion.
   */
  hashCanonical(...parts: unknown[]): string {
    const canonical = parts.map(p => stableStringify(p)).join('\x1e');
    return crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex');
  }

  /** Commit to a candidate's content: structure, sequence and metrics. */
  computeCandidateHash(content: CandidateHashContent): string {
    return this.hashCanonical({
      structure: content.structure ?? null,
      sequence: content.sequence ?? null,
      metrics: content.metrics ?? null,
    });
  }

  /** Commit to a validation snapshot (metrics + rank). */
  computeValidationHash(validation: ValidationResult, rank?: number): string {
    return this.hashCanonical({ validation, rank });
  }

  /**
   * sha256 of the entry's canonical content. `ledgerHash` itself is excluded
   * (it is the output), everything else — including the chain links — is
   * committed so the whole entry is tamper-evident.
   */
  computeEntryHash(entry: DesignLedgerEntry): string {
    const { ledgerHash: _omitted, ...content } = entry;
    void _omitted;
    return this.hashCanonical(content);
  }

  /**
   * Return a new entry with the chain link and self-hash attached. The input
   * entry is left untouched (append-only semantics).
   */
  linkEntry(entry: DesignLedgerEntry, previousLedgerHash?: string): DesignLedgerEntry {
    const linked: DesignLedgerEntry = { ...entry };
    if (previousLedgerHash) linked.previousLedgerHash = previousLedgerHash;
    linked.ledgerHash = this.computeEntryHash(linked);
    return linked;
  }

  /** Verify one entry: hashes recompute to the recorded values. */
  verifyEntry(entry: DesignLedgerEntry): { valid: boolean; reasons: string[] } {
    const reasons: string[] = [];
    if (!entry.ledgerHash) reasons.push('entry has no ledgerHash');
    else if (this.computeEntryHash(entry) !== entry.ledgerHash)
      reasons.push('ledgerHash does not match recomputed entry hash');
    return { valid: reasons.length === 0, reasons };
  }

  /**
   * Verify a chain of entries (ordered by timestamp): every entry's internal
   * hash must verify, and each entry's previousLedgerHash must match the
   * recomputed hash of the previous entry. Returns the index of the first
   * break, or -1 when the chain is intact.
   */
  verifyChain(entries: DesignLedgerEntry[]): { valid: boolean; brokenAt: number; reasons: string[] } {
    const reasons: string[] = [];
    if (entries.length === 0) return { valid: true, brokenAt: -1, reasons };

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const self = this.verifyEntry(entry);
      if (!self.valid) {
        reasons.push(`entry[${i}] (${entry.candidateId}): ${self.reasons.join('; ')}`);
        return { valid: false, brokenAt: i, reasons };
      }
      if (i > 0) {
        const expectedPrevious = this.computeEntryHash(entries[i - 1]);
        if (entry.previousLedgerHash !== expectedPrevious) {
          reasons.push(
            `entry[${i}] (${entry.candidateId}): previousLedgerHash does not link to entry[${i - 1}]`,
          );
          return { valid: false, brokenAt: i, reasons };
        }
      }
    }
    return { valid: true, brokenAt: -1, reasons };
  }
}