/**
 * Loads the website's content files into the dashboard: every page (and the header,
 * menu and footer), the team, the site settings, the blog articles and the redirects.
 * Idempotent: run it as often as you like.
 *
 *   overwrite = false  (default) creates anything missing and leaves existing
 *                      dashboard edits alone. Safe to run at any time.
 *   overwrite = true   replaces pages, team, settings, articles and redirects with the
 *                      files in the repo. Use after a developer content update.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Payload } from 'payload';
import type { PageData, Post, Redirect, SiteSettings, TeamData } from '@/lib/types';
import { pageToDoc, postToDoc, settingsToDoc, teamToDocs } from './sync';

export interface ImportReport {
  pagesCreated: string[];
  pagesUpdated: string[];
  pagesSkipped: string[];
  teamCreated: string[];
  teamUpdated: string[];
  postsCreated: string[];
  redirectsCreated: number;
  settings: 'created' | 'updated' | 'skipped';
}

const DIR = path.join(process.cwd(), 'content');
const read = <T>(rel: string): T => JSON.parse(fs.readFileSync(path.join(DIR, rel), 'utf8')) as T;

async function upsert(payload: Payload, collection: any, where: Record<string, unknown>, data: Record<string, unknown>, overwrite: boolean): Promise<'created' | 'updated' | 'skipped'> {
  const existing = await payload.find({ collection, where: where as any, limit: 1, depth: 0, overrideAccess: true });
  if (existing.docs.length) {
    if (!overwrite) return 'skipped';
    await payload.update({ collection, id: existing.docs[0].id, data: data as any, depth: 0, overrideAccess: true, context: { importing: true } });
    return 'updated';
  }
  await payload.create({ collection, data: data as any, depth: 0, overrideAccess: true, context: { importing: true } });
  return 'created';
}

export async function importContent(payload: Payload, { overwrite = false }: { overwrite?: boolean } = {}): Promise<ImportReport> {
  const report: ImportReport = { pagesCreated: [], pagesUpdated: [], pagesSkipped: [], teamCreated: [], teamUpdated: [], postsCreated: [], redirectsCreated: 0, settings: 'skipped' };

  for (const f of fs.readdirSync(path.join(DIR, 'pages')).filter((x) => x.endsWith('.json')).sort()) {
    const page = read<PageData>(`pages/${f}`);
    const r = await upsert(payload, 'pages', { slug: { equals: page.slug } }, pageToDoc(page), overwrite);
    (r === 'created' ? report.pagesCreated : r === 'updated' ? report.pagesUpdated : report.pagesSkipped).push(page.slug);
  }

  for (const t of teamToDocs(read<TeamData>('team.json'))) {
    const r = await upsert(payload, 'team', { key: { equals: t.key } }, t, overwrite);
    if (r === 'created') report.teamCreated.push(String(t.name));
    if (r === 'updated') report.teamUpdated.push(String(t.name));
  }

  const categoryId = async (title: string) => {
    const found = await payload.find({ collection: 'categories', where: { title: { equals: title } }, limit: 1, depth: 0, overrideAccess: true });
    if (found.docs[0]) return found.docs[0].id;
    return (await payload.create({ collection: 'categories', data: { title }, depth: 0, overrideAccess: true })).id;
  };
  for (const p of read<Post[]>('posts.json')) {
    const ids = [];
    for (const c of p.categories || []) ids.push(await categoryId(c));
    const r = await upsert(payload, 'posts', { slug: { equals: p.slug } }, postToDoc(p, ids), overwrite);
    if (r === 'created') report.postsCreated.push(p.slug);
  }

  for (const rd of read<Redirect[]>('redirects.json')) {
    const r = await upsert(payload, 'redirects', { from: { equals: rd.from } }, { from: rd.from, to: rd.to, type: rd.type || '301', note: 'Migrated from the WordPress site' }, overwrite);
    if (r === 'created') report.redirectsCreated++;
  }

  const current = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true });
  if (!current?.name || overwrite) {
    await payload.updateGlobal({ slug: 'site-settings', data: settingsToDoc(read<SiteSettings>('site-settings.json')) as any, depth: 0, overrideAccess: true });
    report.settings = current?.name ? 'updated' : 'created';
  }

  await payload.updateGlobal({ slug: 'site-status', data: { lastImportAt: new Date().toISOString() }, overrideAccess: true }).catch(() => undefined);
  return report;
}
