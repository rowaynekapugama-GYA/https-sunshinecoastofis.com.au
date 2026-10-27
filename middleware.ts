import { NextResponse, type NextRequest } from 'next/server';

/**
 * 1. Trailing slashes. Public pages live at /about/, /services/dental-implants/ and so on,
 *    exactly as WordPress had them. /about (no slash) gets one 301 to /about/. The
 *    dashboard (/admin, /cms) and the API (/api) are left alone.
 * 2. Search engines only index the real domain. On any other host (the vercel.app
 *    preview and production deployment URLs, staging branches) every response carries
 *    X-Robots-Tag: noindex, and /robots.txt blocks crawling (app/robots.txt/route.ts).
 *    Driven by the request host, so nothing has to be remembered at go-live.
 */
const LIVE_HOSTS = new Set([
  'sunshinecoastofis.com.au',
  'www.sunshinecoastofis.com.au',
  // Testing only (Lighthouse on a local build): extra hosts to treat as the live site. Never set on Vercel.
  ...(process.env.EXTRA_LIVE_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean),
]);

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase();

  // Payload's "create first user" screen is closed unless GYA is setting up a new site.
  if (pathname.startsWith('/cms/create-first-user') && process.env.ALLOW_FIRST_USER !== 'true') {
    return new NextResponse('Not found', { status: 404 });
  }

  const isFile = /\.[a-z0-9]+$/i.test(pathname);
  const isApp = pathname.startsWith('/admin') || pathname.startsWith('/cms') || pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.startsWith('/edit-preview');

  // Work out the one correct address, so every fix below is a single 301 hop:
  //   www.sunshinecoastofis.com.au -> sunshinecoastofis.com.au (the live WordPress site's preference)
  //   /about -> /about/
  //   /?p=123 and /?page_id=123 (WordPress short links) -> /
  let path = pathname;
  let query = search;
  if (!isApp && !isFile && !path.endsWith('/')) path = `${path}/`;
  if (path === '/' && (req.nextUrl.searchParams.has('p') || req.nextUrl.searchParams.has('page_id'))) query = '';
  const www = host === 'www.sunshinecoastofis.com.au';
  let res: NextResponse;
  if (www) {
    res = NextResponse.redirect(`https://sunshinecoastofis.com.au${path}${query}`, 301);
  } else if (path !== pathname || query !== search) {
    res = NextResponse.redirect(new URL(`${path}${query}`, req.url), 301);
  } else {
    res = NextResponse.next();
  }
  if (!LIVE_HOSTS.has(host) || isApp) res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
