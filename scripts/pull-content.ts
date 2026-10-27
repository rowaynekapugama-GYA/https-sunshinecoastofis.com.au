/**
 * Build-time content pull: dashboard (Payload / Postgres) -> the JSON files the site is
 * built from. Runs before every `next build` (scripts/build.mjs).
 *
 *   content/pages/<slug>.json    every published page (and the header, menu and footer)
 *   content/team.json            surgeons and practice team
 *   content/site-settings.json   Site Settings
 *   content/posts.json           published blog articles
 *   content/redirects.json       Redirects
 *
 * Safe by design: if DATABASE_URL is missing, the database is unreachable, or the
 * dashboard has never been imported, the files already in the repo are left untouched
 * and the build carries on with them. It never fails a build.
 */
import fs from 'node:fs';
import path from 'node:path';
import './load-env';
import { getPayload } from 'payload';
import config from '../payload.config';
import { mediaUrl, pageFromDoc, postFromDoc, settingsFromDoc, teamFromDocs } from '../cms/sync';
import type { SiteSettings, TemplateDef } from '../lib/types';

const ROOT = process.cwd();
const write = (rel: string, data: unknown) => {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
};
const read = <T>(rel: string): T => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')) as T;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[pull-content] DATABASE_URL not set; building from the files in the repo.');
    return;
  }
  const templates = read<Record<string, TemplateDef>>('content/templates/sections.json');
  const fieldType = (t: string, k: string) => templates[t]?.fields?.[k]?.type;
  const payload = await getPayload({ config });
  try {
    const pages = await payload.find({ collection: 'pages', limit: 500, depth: 1, overrideAccess: true, where: { _status: { equals: 'published' } } });
    if (!pages.docs.length) {
      console.log('[pull-content] The dashboard has no published pages yet (run Import on the dashboard); building from the files in the repo.');
      return;
    }
    const media = await payload.find({ collection: 'media', limit: 5000, depth: 0, overrideAccess: true });
    const byId = new Map(media.docs.map((m: any) => [String(m.id), mediaUrl(m)]));
    const mediaById = (id: number | string) => byId.get(String(id));
    for (const doc of pages.docs) {
      const page = pageFromDoc(doc, fieldType, mediaById);
      // A section whose design is not in this version of the site is dropped rather than breaking the build.
      page.sections = page.sections.filter((s) => {
        if (templates[s.template]) return true;
        console.warn(`[pull-content] ${page.slug}: unknown section design ${s.template}, left out`);
        return false;
      });
      write(`content/pages/${page.slug}.json`, page);
    }
    // A page deleted in the dashboard is removed from the build (the header and footer record is never removed).
    const keep = new Set(pages.docs.map((d: any) => `${d.slug}.json`));
    for (const f of fs.readdirSync(path.join(ROOT, 'content', 'pages'))) {
      if (f.endsWith('.json') && !keep.has(f) && f !== 'site-wide.json') {
        fs.unlinkSync(path.join(ROOT, 'content', 'pages', f));
        console.log(`[pull-content] removed ${f} (deleted in the dashboard)`);
      }
    }
    console.log(`[pull-content] ${pages.docs.length} pages`);

    const team = await payload.find({ collection: 'team', limit: 100, depth: 1, sort: 'order', overrideAccess: true });
    if (team.docs.length) {
      write('content/team.json', teamFromDocs(team.docs));
      console.log(`[pull-content] ${team.docs.length} team members`);
    }

    const settings = await payload.findGlobal({ slug: 'site-settings', depth: 1, overrideAccess: true });
    if (settings?.name) {
      const defaults = read<SiteSettings>('content/site-settings.json');
      write('content/site-settings.json', settingsFromDoc(settings, defaults));
      console.log('[pull-content] site settings');
    }

    const posts = await payload.find({ collection: 'posts', limit: 500, depth: 2, sort: '-publishedAt', overrideAccess: true, where: { _status: { equals: 'published' } } });
    write('content/posts.json', posts.docs.map(postFromDoc));
    console.log(`[pull-content] ${posts.docs.length} blog articles`);

    const redirects = await payload.find({ collection: 'redirects', limit: 1000, depth: 0, sort: 'from', overrideAccess: true });
    write('content/redirects.json', redirects.docs.map((r: any) => ({ from: r.from, to: r.to, type: r.type || '301' })));
    console.log(`[pull-content] ${redirects.docs.length} redirects`);
  } finally {
    void (payload.db as any)?.pool?.end?.().catch(() => undefined);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.warn(`[pull-content] skipped: ${(e as Error).message}. Building from the files in the repo.`);
    process.exit(0);
  });
