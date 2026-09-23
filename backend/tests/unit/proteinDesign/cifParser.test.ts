import { describe, it, expect } from '@jest/globals';
import { gzipSync } from 'node:zlib';
import {
  parseCifContent,
  decompressCif,
  isGzipped,
} from '../../../src/domain/proteinDesign/rfd3/cifParser.js';

const MMCIF_FIXTURE = `#
# sample mmCIF with two chains
#
data_rfd3_design_0
#
_entity_poly_seq.id
_entity_poly_seq.entity_id
_entity_poly_seq.num
_entity_poly_seq.mon_id
;
loop_
_atom_site.group_PDB
_atom_site.id
_atom_site.type_symbol
_atom_site.label_atom_id
_atom_site.label_comp_id
_atom_site.label_asym_id
_atom_site.label_seq_id
_atom_site.Cartn_x
_atom_site.Cartn_y
_atom_site.Cartn_z
ATOM 1 C N GLY A 1 1.0 2.0 3.0
ATOM 2 C CA GLY A 2 4.0 5.0 6.0
ATOM 3 N N ALA B 1 7.0 8.0 9.0
ATOM 4 C CA CYS B 2 10.0 11.0 12.0
#
`;

describe('parseCifContent', () => {
  it('extracts per-chain sequences from the atom_site loop', () => {
    const parsed = parseCifContent(MMCIF_FIXTURE);
    expect(parsed.format).toBe('mmCIF');
    expect(parsed.atomCount).toBe(4);
    expect(parsed.sequenceByChain.A).toBe('GG');
    expect(parsed.sequenceByChain.B).toBe('AC');
    expect(parsed.chains.sort()).toEqual(['A', 'B']);
    expect(parsed.residueCount).toBe(4);
    expect(parsed.hasCoordinates).toBe(true);
  });

  it('handles a topology-only mmCIF without coordinates', () => {
    const parsed = parseCifContent(
      `data_x\n#\n_entity_poly_seq.id\n_entity_poly_seq.entity_id\n_entity_poly_seq.num\n_entity_poly_seq.mon_id\n1 1 1 GLY\n1 1 2 ALA\n1 1 3 CYS\n#\n`,
    );
    expect(parsed.format).toBe('mmCIF');
    expect(parsed.residueCount).toBe(3);
    expect(parsed.hasCoordinates).toBe(false);
    expect(Object.values(parsed.sequenceByChain).some((s) => s.includes('GA'))).toBe(true);
  });

  it('is resilient to junk input', () => {
    const parsed = parseCifContent('not a cif at all\n');
    expect(parsed.format).toBe('mmCIF');
    expect(parsed.sequenceByChain).toEqual({});
    expect(parsed.residueCount).toBe(0);
  });
});

describe('gzip handling', () => {
  it('round-trips a .cif.gz payload', () => {
    const compressed = gzipSync(Buffer.from(MMCIF_FIXTURE, 'utf-8'));
    expect(isGzipped(compressed)).toBe(true);
    const text = decompressCif(compressed);
    expect(text).toBe(MMCIF_FIXTURE);
  });

  it('detects non-gzip bytes', () => {
    expect(isGzipped(Buffer.from('# data_x\n', 'utf-8'))).toBe(false);
  });
});