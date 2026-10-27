import { SITE_URL, posts, routedPages } from '@/lib/content';

/** Every public page and published article, on the live domain. Pages hidden from search are left out. */
export const dynamic = 'force-static';

export function GET() {
  const pages = routedPages().filter((p) => p.slug !== 'not-found' && !p.seo?.noindex);
  const urls = [
    ...pages.map((p) => ({ loc: `${SITE_URL}${p.route}`, lastmod: '' })),
    ...posts()
      .filter((p) => !p.noindex)
      .map((p) => ({ loc: `${SITE_URL}/${p.slug}/`, lastmod: (p.updatedAt || p.publishedAt || '').slice(0, 10) })),
  ];
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n') +
    '\n</urlset>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
