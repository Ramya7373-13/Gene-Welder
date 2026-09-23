// stableJson — canonical, deterministic JSON serialization.
//
// Shared by the artifact store (metadata files must be byte-identical for
// identical inputs) and the provenance hash chain (hashes must not depend on
// object key insertion order). Rules:
//   - object keys are recursively sorted
//   - `undefined` values are dropped (mirrors JSON.stringify)
//   - Date instances serialize to their ISO string
//   - 2-space indent + trailing newline, so on-disk JSON is human-readable

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value), null, 2) + '\n';
}

function sortValue(value: unknown): unknown {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const v = record[key];
      if (v === undefined) continue;
      out[key] = sortValue(v);
    }
    return out;
  }
  return value;
}