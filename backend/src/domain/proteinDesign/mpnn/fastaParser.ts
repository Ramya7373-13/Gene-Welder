// Minimal FASTA parser for ProteinMPNN outputs.
//
// ProteinMPNN writes `.fa` files containing one or more `>header\nSEQUENCE`
// blocks (optionally followed by scored positions on the next line). We only
// need the sequences and headers; anything unparseable is skipped.

export interface FastaEntry {
  header: string;
  sequence: string;
}

export function parseFasta(text: string): FastaEntry[] {
  const entries: FastaEntry[] = [];
  let header: string | null = null;
  const seqLines: string[] = [];

  const flush = () => {
    if (header !== null && seqLines.length) {
      entries.push({ header, sequence: seqLines.join('').toUpperCase() });
    }
    header = null;
    seqLines.length = 0;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    if (line.startsWith('>')) {
      flush();
      header = line.slice(1).trim();
      continue;
    }
    if (header !== null) seqLines.push(line);
  }
  flush();
  return entries.filter((e) => /^[ACDEFGHIKLMNPQRSTVWYX]+$/.test(e.sequence));
}