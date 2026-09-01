// Pluggable codec adapter boundary (encoding profile C).
// The "advanced" codec is deliberately a disabled placeholder: this project must
// not claim fountain-code / Reed–Solomon / DNA-Fountain capabilities unless a
// tested, licensed, faithful implementation is integrated behind this interface.
import type { DnaStrand, EncodingProfile } from './types.js';
import { encodeLearning, decodeLearning } from './learningCodec.js';
import { encodeConstraintAware, decodeConstraintAware } from './constraintAwareCodec.js';

export interface DnaCodec {
  id: string;
  encode(payload: Buffer, experimentId: string, profile: EncodingProfile): DnaStrand[];
  decode(strands: DnaStrand[], profile: EncodingProfile): { bytes: Buffer; warnings: string[] };
  enabled: boolean;
}

const learningCodec: DnaCodec = {
  id: 'learning',
  encode: encodeLearning,
  decode: decodeLearning,
  enabled: true,
};

const constraintAwareCodec: DnaCodec = {
  id: 'constraint-aware',
  encode: encodeConstraintAware,
  decode: decodeConstraintAware,
  enabled: true,
};

const advancedCodec: DnaCodec = {
  id: 'advanced',
  encode: () => {
    throw new Error('Advanced codec adapter is not enabled in this version');
  },
  decode: () => {
    throw new Error('Advanced codec adapter is not enabled in this version');
  },
  enabled: false,
};

export function getCodec(profileMode: EncodingProfile['mode']): DnaCodec {
  switch (profileMode) {
    case 'learning':
      return learningCodec;
    case 'constraint-aware':
      return constraintAwareCodec;
    case 'advanced':
      return advancedCodec;
    default:
      throw new Error(`Unknown encoding profile mode: ${profileMode as string}`);
  }
}
