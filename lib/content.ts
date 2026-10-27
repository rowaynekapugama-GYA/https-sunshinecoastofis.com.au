import fs from 'node:fs';
import path from 'node:path';
import type { PageData, Post, Redirect, SiteSettings, TeamData, TemplateDef } from './types';

/**
 * Reads the website's content files. scripts/pull-content.ts rewrites them from the
 * dashboard before every build; without a database the committed files are used as-is.
 */
const DIR = path.join(process.cwd(), 'content');
const read = <T>(rel: string): T => JSON.parse(fs.readFileSync(path.join(DIR, rel), 'utf8')) as T;

let pagesCache: PageData[] | null = null;
let templatesCache: Record<string, TemplateDef> | null = null;

export function templates(): Record<string, TemplateDef> {
  if (!templatesCache) templatesCache = read<Record<string, TemplateDef>>('templates/sections.json');
  return templatesCache;
}

/** Every page file, the site-wide header/footer included. */
export function allPages(): PageData[] {
  if (!pagesCache) {
    pagesCache = fs
      .readdirSync(path.join(DIR, 'pages'))
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => read<PageData>(`pages/${f}`));
  }
  return pagesCache;
}

/** Pages that have their own address on the website. */
export function routedPages(): PageData[] {
  return allPages().filter((p) => p.kind !== 'site' && p.route);
}

export function siteWide(): PageData {
  const p = allPages().find((x) => x.kind === 'site');
  if (!p) throw new Error('content/pages/site-wide.json is missing');
  return p;
}

export function pageByRoute(route: string): PageData | undefined {
  return routedPages().find((p) => p.route === route);
}

export function settings(): SiteSettings {
  return read<SiteSettings>('site-settings.json');
}

export function team(): TeamData {
  const t = read<TeamData>('team.json');
  return {
    surgeons: [...t.surgeons].sort((a, b) => a.order - b.order),
    staff: [...t.staff].sort((a, b) => a.order - b.order),
  };
}

export function posts(): Post[] {
  try {
    return read<Post[]>('posts.json').sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  } catch {
    return [];
  }
}

export function redirects(): Redirect[] {
  try {
    return read<Redirect[]>('redirects.json');
  } catch {
    return [];
  }
}

/** Live site address, no trailing slash. Canonicals and the sitemap always use the real domain. */
export const SITE_URL = 'https://sunshinecoastofis.com.au';
