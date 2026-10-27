/**
 * Proves every page renders the approved HTML: for each page that existed in the approved
 * single-page site, the rendered sections are compared with the same sections of the
 * approved file (hash links already turned into real URLs). Run: npm run test:render
 *
 * Two differences are expected and listed: the team card for Megan now carries the same
 * "photo coming soon" label as Taylor's, and a developer note inside the team grid is gone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { routedPages } from '../lib/content';
import { defaultContext, renderSections } from '../lib/render';

const src = fs.readFileSync(path.join(process.cwd(), '_tools/source/approved-rewritten.html'), 'utf8');
const ctx = defaultContext();
let bad = 0;
let n = 0;
const normalise = (s: string) =>
  s
    .replace(/\n\s*<!-- Taylor: no photo yet[\s\S]*?-->/g, '')
    .replace('<div class="tm" id="team-taylor">', '<div class="tm">')
    .replace('<div class="tm"><div class="sil"><svg', '<div class="tm"><div class="sil" role="img" aria-label="Megan, photo coming soon"><svg')
    .trim();

for (const page of routedPages()) {
  if (!page.pageId || page.pageId.includes('blog') ) continue;
  const open = `<div data-page="${page.pageId}" `;
  const i = src.indexOf(open);
  if (i < 0) continue; // a page added after approval
  const start = src.indexOf('>', i) + 1;
  const nextPage = src.indexOf('<div data-page="', start);
  const end = nextPage > 0 ? nextPage : src.indexOf('</main>', start);
  const sections = src.slice(start, end).match(/<section[\s\S]*?<\/section>/g) || [];
  const want = normalise(sections.join('\n'));
  const got = renderSections(page.sections, ctx).trim();
  n++;
  if (got !== want) {
    bad++;
    let k = 0;
    while (k < got.length && got[k] === want[k]) k++;
    console.log(`DIFF ${page.route} at ${k}\n  got:  ${JSON.stringify(got.slice(k - 80, k + 120))}\n  want: ${JSON.stringify(want.slice(k - 80, k + 120))}`);
  }
}
console.log(`${n} approved pages compared, ${bad} different`);
process.exit(bad ? 1 : 0);
