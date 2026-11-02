/**
 * Proves every page renders the approved HTML: for each page that existed in the approved
 * single-page site, the rendered sections are compared with the same sections of the
 * approved file (hash links already turned into real URLs). Run: npm run test:render
 *
 * Two differences are expected and listed: the team card for Megan now carries the same
 * "photo coming soon" label as Taylor's, and a developer note inside the team grid is gone.
 *
 * Approved changes made after the approval are undone before comparing, so the test still
 * catches anything else: version 3.2.0 (SEO and compliance wording) from its dashboard patch,
 * migrations/data/20261102-seo-compliance.json, and the five rating stars removed from the
 * homepage banner design.
 */
import fs from 'node:fs';
import path from 'node:path';
import { routedPages } from '../lib/content';
import { defaultContext, renderSections } from '../lib/render';

const src = fs.readFileSync(path.join(process.cwd(), '_tools/source/approved-rewritten.html'), 'utf8');
const ctx = defaultContext();

// ---- undo the approved 3.2.0 content changes (pages and surgeon bios)
const patch = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'migrations/data/20261102-seo-compliance.json'), 'utf8'));
function undo320(page: { slug: string; sections: any[] }) {
  const ops: any[] = patch.pages[page.slug]?.ops || [];
  let sections = JSON.parse(JSON.stringify(page.sections));
  for (const op of [...ops].reverse()) {
    const at = (id: string) => sections.findIndex((s: any) => s.id === id);
    if (op.op === 'field') {
      const f = sections[at(op.section)].fields[op.key];
      if (op.old === null || op.old === undefined) delete f[op.prop];
      else f[op.prop] = op.old;
    } else if (op.op === 'hidden') sections[at(op.section)].hidden = op.old;
    else if (op.op === 'insert') sections = sections.filter((s: any) => s.id !== op.section.id);
    else if (op.op === 'replace') sections[at(op.section.id)] = op.old;
  }
  return sections;
}
for (const t of patch.team) {
  const m: any = ctx.team.surgeons.find((x) => x.key === t.key);
  if (!m) continue;
  if (t.field === 'lede') m.lede = t.old;
  else m.story[t.index] = t.old;
}
let bad = 0;
let n = 0;
const normalise = (s: string) =>
  s
    .replace(/\n\s*<!-- Taylor: no photo yet[\s\S]*?-->/g, '')
    .replace('<div class="tm" id="team-taylor">', '<div class="tm">')
    .replace('<div class="tm"><div class="sil"><svg', '<div class="tm"><div class="sil" role="img" aria-label="Megan, photo coming soon"><svg')
    .replace(' <span class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>', '')
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
  const got = renderSections(undo320(page), ctx).trim();
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
