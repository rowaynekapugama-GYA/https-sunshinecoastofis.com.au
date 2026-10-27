/**
 * Wording check on the pages exactly as the site serves them.
 *
 *   npm run build && npm start        (in one terminal)
 *   npm run qa:banned                 (in another; or: node scripts/check-banned.mjs http://localhost:3000)
 *
 * Reads every address in sitemap.xml plus the 404 page, strips the markup and looks for:
 *
 *   FAIL  words that must never be on the live site: placeholders, leftovers from other
 *         GYA builds, unfilled template tokens, the wrong phone number, and
 *         "same day" on the zygomatic implants page (Dr Lincoln asked for "within 24 hours").
 *   FLAG  words AHPRA's advertising guidelines treat with caution for a regulated health
 *         service (superlatives, guarantees, "expert", "painless", "permanent" and so on).
 *         These are listed for review only: approved wording is never changed by this check.
 *
 * Exits with 1 when anything FAILs. Writes audit/wording-check.json.
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || process.env.CHECK_URL || 'http://localhost:3000').replace(/\/$/, '');

const FAIL = [
  'lorem',
  'ipsum',
  '[to confirm',
  'tbc',
  'todo',
  'xxx',
  '{{',
  '}}',
  'undefined',
  'cronulla',
  'caringbah',
  'coastal dental',
  '9525 0595',
];

// Wording that must not appear on one page in particular.
const FAIL_ON_PAGE = {
  // 2026-10: Dr Lincoln asked for "temporary teeth within 24 hours", not "the same day".
  '/services/zygomatic-implants/': ['same day', 'same-day'],
};

const FLAG = [
  'best',
  'leading',
  'world class',
  'world-class',
  'top ',
  'expert',
  'highly experienced',
  'most experienced',
  'guarantee',
  'painless',
  'pain free',
  'pain-free',
  'permanent',
  'risk free',
  'risk-free',
  'revolution',
  'miracle',
  'cutting edge',
  'cutting-edge',
  'state of the art',
  'state-of-the-art',
  'perfect',
  'free consultation',
  'cheap',
  'specialist dentist',
  'royal australian college',
  'testimonial',
  'what our clients say',
  'before and after photo',
];

// Wording that matches a list above but is fine in context.
const ALLOWED = [
  /\bbest (?:way|time|for you|option for you|suited|outcome for you|placed)\b/i,
  /\bno guarantee\b|\bcannot guarantee\b|\bnot guaranteed\b/i,
  /\btop (?:and|or) bottom\b|\btop jaw\b|\btop teeth\b|\bupper and lower\b/i,
];

const strip = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ');

function find(text, word) {
  const hits = [];
  const lower = text.toLowerCase();
  const isWord = /^[a-z]/.test(word) && !word.endsWith(' ');
  let i = lower.indexOf(word);
  while (i >= 0) {
    const before = lower[i - 1] || ' ';
    const after = lower[i + word.length] || ' ';
    const whole = !isWord || (!/[a-z0-9]/.test(before) && (word.length > 6 || !/[a-z0-9]/.test(after)));
    if (whole) {
      const context = text.slice(Math.max(0, i - 70), i + word.length + 70).trim();
      if (!ALLOWED.some((re) => re.test(context))) hits.push(context);
    }
    i = lower.indexOf(word, i + word.length);
  }
  return hits;
}

async function main() {
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  urls.push('/this-address-does-not-exist/');
  const report = { checked: [], fail: [], flag: [] };
  for (const p of urls) {
    const res = await fetch(BASE + p);
    const html = await res.text();
    const text = strip(html);
    report.checked.push({ path: p, status: res.status });
    // The head counts too: titles and descriptions are what Google shows.
    const head = (html.match(/<title>[\s\S]*?<\/title>/i)?.[0] || '') + ' ' + [...html.matchAll(/<meta (?:name|property)="(?:description|og:[a-z]+)" content="([^"]*)"/g)].map((m) => m[1]).join(' ');
    const all = `${strip(head)} ${text}`;
    for (const w of [...FAIL, ...(FAIL_ON_PAGE[p] || [])]) for (const c of find(all, w)) report.fail.push({ path: p, word: w.trim(), context: c });
    for (const w of FLAG) for (const c of find(all, w)) report.flag.push({ path: p, word: w.trim(), context: c });
  }
  fs.mkdirSync('audit', { recursive: true });
  fs.writeFileSync(path.join('audit', 'wording-check.json'), JSON.stringify(report, null, 1));
  console.log(`${report.checked.length} pages checked`);
  for (const f of report.fail) console.log(`FAIL ${f.path} "${f.word}": ...${f.context}...`);
  const byWord = {};
  for (const f of report.flag) (byWord[f.word] ||= new Set()).add(f.path);
  for (const [w, pages] of Object.entries(byWord)) console.log(`FLAG "${w}" on ${[...pages].join(', ')}`);
  console.log(`${report.fail.length} failures, ${report.flag.length} flags for review (details in audit/wording-check.json)`);
  process.exit(report.fail.length ? 1 : 0);
}

main().catch((e) => {
  console.error(`Could not reach ${BASE}: ${e.message}. Start the site first (npm start).`);
  process.exit(1);
});
