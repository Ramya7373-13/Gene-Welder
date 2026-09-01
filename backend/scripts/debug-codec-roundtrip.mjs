// Debug script: run the fixture through encode->decode for both codecs and
// print the actual byte diff. Run from backend/ with:
//   npx tsx scripts/debug-codec-roundtrip.mjs
import { encodeLearning, decodeLearning, LEARNING_PROFILE } from '../src/domain/dnaStorage/learningCodec.ts';
import { encodeConstraintAware, decodeConstraintAware, CONSTRAINT_AWARE_PROFILE } from '../src/domain/dnaStorage/constraintAwareCodec.ts';
import fs from 'fs';

const payload = fs.readFileSync(new URL('../../docs/humanity-longevity.txt', import.meta.url));
console.log('fixture:', payload.length, 'bytes', JSON.stringify(payload.toString('utf-8')));

const ls = encodeLearning(payload, 'exp-1', LEARNING_PROFILE);
const ld = decodeLearning(ls, LEARNING_PROFILE);
console.log('LEARNING: in=%d out=%d equal=%s warnings=%j', payload.length, ld.bytes.length, ld.bytes.equals(payload), ld.warnings);
console.log('LEARNING strand[0] sequence (%d bases): %s', ls[0].sequence.length, ls[0].sequence);

const cs = encodeConstraintAware(payload, 'exp-2', CONSTRAINT_AWARE_PROFILE);
const cd = decodeConstraintAware(cs, CONSTRAINT_AWARE_PROFILE);
console.log('CONSTRAINT-AWARE: in=%d out=%d equal=%s warnings=%j', payload.length, cd.bytes.length, cd.bytes.equals(payload), cd.warnings);
console.log('CA strand[0] sequence (%d bases): %s', cs[0].sequence.length, cs[0].sequence);

for (const [name, dec] of [['LEARNING', ld.bytes], ['CA', cd.bytes]]) {
  if (!dec.equals(payload)) {
    for (let i = 0; i < Math.max(payload.length, dec.length); i++) {
      if (payload[i] !== dec[i]) {
        console.log('%s first byte diff at offset %d: expected 0x%s got 0x%s', name, i, (payload[i] ?? 0).toString(16), (dec[i] ?? 0).toString(16));
        break;
      }
    }
    console.log('%s expected hex: %s', name, payload.toString('hex'));
    console.log('%s decoded hex: %s', name, dec.toString('hex'));
  }
}
