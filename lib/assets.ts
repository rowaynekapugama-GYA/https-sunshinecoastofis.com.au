import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PUBLIC = path.join(process.cwd(), 'public');
const hashCache: Record<string, string> = {};
/** /assets/site.css?v=<content hash>, so a new build is never served a stale stylesheet. */
export function asset(rel: string): string {
  if (!hashCache[rel]) {
    try {
      hashCache[rel] = crypto.createHash('sha1').update(fs.readFileSync(path.join(PUBLIC, rel))).digest('hex').slice(0, 10);
    } catch {
      hashCache[rel] = 'dev';
    }
  }
  return `${rel}?v=${hashCache[rel]}`;
}

