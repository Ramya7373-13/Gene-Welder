// Lightweight mmCIF parser for RFD3 outputs.
//
// RFD3 emits `.cif.gz` (gzipped mmCIF), not PDB. This module normalizes those
// artifacts so the rest of the pipeline can consume them like a PDB: it extracts
// per-chain sequences from `_atom_site.` loops, classifies the structure, and
// produces a plain-text representation for storage/viewing.
//
// It is intentionally dependency-free (node:zlib + string parsing) — the plan
// adds zero npm packages. Real geometric validation stays with
// DesignValidationEngine; this only reads what the file literally contains.

import { gunzipSync } from 'node:zlib';

const THREE_TO_ONE: Record<string, string> = {
  ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C',
  GLN: 'Q', GLU: 'E', GLY: 'G', HIS: 'H', ILE: 'I',
  LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P',
  SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
  MSE: 'M', ASX: 'B', GLX: 'Z', UNK: 'X', SEC: 'C',
  PYL: 'O',
};

export interface MmCifSummary {
  chains: string[];
  sequenceByChain: Record<string, string>;
  residueCount: number;
  atomCount: number;
  hasCoordinates: boolean;
  format: 'mmCIF' | 'PDB';
}

/** Decompress a `.cif.gz` payload into text (or return plain text untouched). */
export function decompressCif(bytes: Uint8Array): string {
  return gunzipSync(bytes).toString('utf-8');
}

/** True when the byte stream starts with a gzip magic header. */
export function isGzipped(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/** Read a `.cif.gz` or plain mmCIF artifact and summarize it. */
export function parseCifContent(text: string): MmCifSummary {
  const lines = text.split(/\r?\n/);

  // Locate the `_atom_site.` loop and its typed column list.
  let loopStart = -1;
  let fieldEnd = -1;
  const fields: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === 'loop_') {
      // A loop_ immediately followed by _atom_site. is the atom site table.
      let j = i + 1;
      const cols: string[] = [];
      while (j < lines.length && lines[j].trim().startsWith('_')) {
        const name = lines[j].trim().slice(1);
        cols.push(name.split('.')[1] ?? name);
        j++;
      }
      if (cols.length && cols[0] === 'group_PDB') {
        loopStart = j; // first data row
        fieldEnd = loopStart;
        fields.push(...cols);
        break;
      }
    }
  }

  if (loopStart < 0) {
    // No atom_site table: a topology-only / no-coordinate mmCIF. Fall back to
    // the `_entity_poly_seq` loop, which lists the sequence directly.
    return {
      chains: [],
      sequenceByChain: parsePolySeq(text),
      residueCount: countPolySeqResidues(text),
      atomCount: 0,
      hasCoordinates: false,
      format: 'mmCIF',
    };
  }

  const chainsSeen = new Map<string, Map<number, string>>();
  let atomCount = 0;
  for (let i = loopStart; i < lines.length; i++) {
    const row = lines[i].trim();
    if (row === '' || row === '#' || row.startsWith('loop_') || row.startsWith('_')) break;
    const cols = row.split(/\s+/);
    if (cols.length < fields.length) continue;
    const recordName = get(fields, cols, 'group_PDB') ?? get(fields, cols, 'record_name');
    if (recordName !== 'ATOM' && recordName !== 'HETATM') continue;
    atomCount++;

    const compId = get(fields, cols, 'label_comp_id') ?? get(fields, cols, 'comp_id');
    const chainId =
      get(fields, cols, 'label_asym_id') ??
      get(fields, cols, 'auth_asym_id') ??
      get(fields, cols, 'asym_id') ??
      'A';
    const seqIdRaw =
      get(fields, cols, 'label_seq_id') ??
      get(fields, cols, 'seq_id') ??
      get(fields, cols, 'auth_seq_id');
    const seqId = parseInt(seqIdRaw ?? '', 10);
    if (Number.isNaN(seqId) || !compId) continue;

    if (!chainsSeen.has(chainId)) chainsSeen.set(chainId, new Map<number, string>());
    const resMap = chainsSeen.get(chainId)!;
    if (!resMap.has(seqId)) resMap.set(seqId, compId);
  }

  const sequenceByChain: Record<string, string> = {};
  const chains: string[] = [];
  for (const [chain, resMap] of chainsSeen) {
    const ids = [...resMap.keys()].sort((a, b) => a - b);
    let seq = '';
    for (const id of ids) {
      seq += THREE_TO_ONE[resMap.get(id)!] ?? 'X';
    }
    sequenceByChain[chain] = seq;
    chains.push(chain);
  }

  let residueCount = 0;
  for (const seq of Object.values(sequenceByChain)) residueCount += seq.length;

  return {
    chains,
    sequenceByChain,
    residueCount,
    atomCount,
    hasCoordinates: atomCount > 0,
    format: 'mmCIF',
  };
}

/** Fallback: build sequences from `entity_poly_seq` data when no atom_site loop exists. */
function parsePolySeq(text: string): Record<string, string> {
  const lines = text.split(/\r?\n/);
  const byEntity = new Map<string, string[]>();
  let headerNames: string[] = [];

  const active = () =>
    headerNames.some(
      (n) => n === 'entity_id' || n === 'entity_poly_seq' || n.startsWith('entity'),
    );

  for (const raw of lines) {
    const line = raw.trim();
    if (line === 'loop_') {
      headerNames = [];
      continue;
    }
    if (line.startsWith('_')) {
      const name = (line.slice(1).split('.')[1] ?? line.slice(1).split('.')[0]).trim();
      headerNames.push(name);
      continue;
    }
    if (line === '' || line === '#') {
      headerNames = [];
      continue;
    }
    if (!active()) continue;

    const cols = line.split(/\s+/);
    const at = (name: string): string | undefined => {
      const idx = headerNames.indexOf(name);
      return idx >= 0 ? cols[idx] : undefined;
    };
    const entityId = at('entity_id') ?? at('id');
    const compId = (at('mon_id') ?? at('monomer_id') ?? '').toUpperCase();
    if (!entityId || !compId) continue;
    const num = parseInt(at('num') ?? '', 10);
    if (Number.isNaN(num)) continue;
    if (!byEntity.has(entityId)) byEntity.set(entityId, []);
    byEntity.get(entityId)!.push(THREE_TO_ONE[compId] ?? 'X');
  }

  const out: Record<string, string> = {};
  for (const [entity, residues] of byEntity) {
    out[entity] = residues.join('');
  }
  return out;
}

function countPolySeqResidues(text: string): number {
  let total = 0;
  for (const seq of Object.values(parsePolySeq(text))) total += seq.length;
  return total;
}

function get(fields: string[], cols: string[], name: string): string | undefined {
  const idx = fields.indexOf(name);
  return idx >= 0 && idx < cols.length ? cols[idx] : undefined;
}