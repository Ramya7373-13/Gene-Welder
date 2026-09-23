import { describe, it, expect } from '@jest/globals';
import { parseFasta } from '../../../src/domain/proteinDesign/mpnn/fastaParser.js';

describe('parseFasta', () => {
  it('parses single and multi-block FASTA text', () => {
    const text = [
      '>sample|score=0.85',
      'ACDEFGHIKLMNPQRSTVWYACDEF',
      '>second',
      'MKTAYIAKQRQISFVKSHFSRQ',
      '>empty',
      '',
    ].join('\n');
    const entries = parseFasta(text);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ header: 'sample|score=0.85', sequence: 'ACDEFGHIKLMNPQRSTVWYACDEF' });
    expect(entries[1].header).toBe('second');
  });

  it('joins wrapped sequence lines', () => {
    const entries = parseFasta('>wrapped\nACDE\nFGHI\nKLMN\n');
    expect(entries[0].sequence).toBe('ACDEFGHIKLMN');
  });

  it('ignores blank lines and comments', () => {
    const entries = parseFasta('# comment\n>x\n\nACDE\n');
    expect(entries).toHaveLength(1);
    expect(entries[0].sequence).toBe('ACDE');
  });

  it('drops blocks containing invalid amino-acid characters', () => {
    const entries = parseFasta('>good\nACDEF\n>bad\nACDEFZ*?!!\n');
    expect(entries).toHaveLength(1);
    expect(entries[0].header).toBe('good');
  });

  it('returns empty for empty or header-less input', () => {
    expect(parseFasta('')).toEqual([]);
    expect(parseFasta('ACDEF\n')).toEqual([]);
  });
});