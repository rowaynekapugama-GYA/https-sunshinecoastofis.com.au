/** Relationship fields go back to Payload as ids. */
const REL_KEYS = new Set(['upload', 'ogImage', 'photo', 'featuredImage', 'logo', 'defaultShareImage']);
export function toPayload(v: any, key?: string): any {
  if (Array.isArray(v)) return v.map((x) => toPayload(x));
  if (v && typeof v === 'object') {
    if (key && REL_KEYS.has(key) && 'id' in v) return v.id;
    const out: any = {};
    for (const [k, val] of Object.entries(v)) out[k] = toPayload(val, k);
    return out;
  }
  return v;
}
