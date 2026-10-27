/**
 * robots.txt depends on the address it is served from: the live domain allows crawling
 * and lists the sitemap; every other host (vercel.app previews, staging) blocks it.
 */
export const dynamic = 'force-dynamic';

const LIVE = new Set(['sunshinecoastofis.com.au', 'www.sunshinecoastofis.com.au', ...(process.env.EXTRA_LIVE_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)]);

export function GET(req: Request) {
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase();
  const body = LIVE.has(host)
    ? ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /cms', 'Disallow: /api/', 'Disallow: /edit-preview/', '', 'Sitemap: https://sunshinecoastofis.com.au/sitemap.xml', ''].join('\n')
    : ['# Not the live website: nothing here should be indexed.', 'User-agent: *', 'Disallow: /', ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' } });
}
