// Transparent analytics formulas for the DNA Archive Lab simulator.
// All formulas are deliberately simple and visible in the UI; theoretical
// storage density derived from these numbers is simulation-derived only.

export function gcPercent(sequence: string): number {
  if (sequence.length === 0) return 0;
  let gc = 0;
  for (const base of sequence) {
    if (base === 'G' || base === 'C') gc++;
  }
  return (gc / sequence.length) * 100;
}

export function maxHomopolymerRun(sequence: string): number {
  if (sequence.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sequence.length; i++) {
    if (sequence[i] === sequence[i - 1]) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }
  return longest;
}

// encoding overhead = (total encoded bases - raw payload bases) / raw payload bases
export function encodingOverhead(rawPayloadBases: number, totalEncodedBases: number): number {
  if (rawPayloadBases === 0) return 0;
  return (totalEncodedBases - rawPayloadBases) / rawPayloadBases;
}

// effective rate = recovered payload bits / total stored bases
export function effectivePayloadRate(recoveredPayloadBits: number, totalStoredBases: number): number {
  if (totalStoredBases === 0) return 0;
  return recoveredPayloadBits / totalStoredBases;
}
