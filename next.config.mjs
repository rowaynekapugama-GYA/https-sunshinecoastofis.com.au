import fs from 'node:fs';
import { withPayload } from '@payloadcms/next/withPayload';

/**
 * Redirects, in two groups:
 *
 * 1. content/redirects.json: old pages with no exact match on the new site, sent to the
 *    closest page (see seo-migration/url-parity.csv). Managed in the dashboard (Redirects)
 *    and written to this file before every build by scripts/pull-content.ts.
 * 2. WORDPRESS below: the patterns WordPress answered on (feeds, archives, the old
 *    sitemaps, the login page), so links and bookmarks to them still land somewhere useful.
 *
 * Every redirect is a single hop straight to the final address, trailing slash included.
 */
function contentRedirects() {
  try {
    const list = JSON.parse(fs.readFileSync(new URL('./content/redirects.json', import.meta.url), 'utf8'));
    return list
      .filter((r) => r.from && r.to && r.from !== r.to)
      .map((r) => ({ source: r.from.replace(/\/+$/, '') || '/', destination: r.to, statusCode: r.type === '302' ? 302 : 301 }));
  } catch {
    return [];
  }
}

const WORDPRESS = [
  // Old XML sitemaps (Yoast) and the WordPress core sitemap: Search Console may still request them.
  ['/sitemap_index.xml', '/sitemap.xml'],
  ['/wp-sitemap.xml', '/sitemap.xml'],
  ['/page-sitemap.xml', '/sitemap.xml'],
  ['/post-sitemap.xml', '/sitemap.xml'],
  ['/category-sitemap.xml', '/sitemap.xml'],
  ['/post_tag-sitemap.xml', '/sitemap.xml'],
  ['/post-archive-sitemap.xml', '/sitemap.xml'],
  ['/sitemap.rss', '/sitemap.xml'],
  // Feeds and archives
  ['/feed', '/blog/'],
  ['/comments/feed', '/blog/'],
  ['/blog/feed', '/blog/'],
  ['/category/:path*', '/blog/'],
  ['/tag/:path*', '/blog/'],
  ['/author/:path*', '/about/'],
  ['/blog/page/:n', '/blog/'],
  ['/page/:n', '/blog/'],
  ['/:year(\\d{4})/:month(\\d{2})/:path*', '/blog/'],
  // The WordPress login and admin: staff now sign in to the dashboard at /admin.
  ['/wp-admin/:path*', '/admin'],
  ['/wp-admin', '/admin'],
  ['/wp-login.php', '/admin'],
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  // The public site keeps trailing slashes (middleware.ts adds one); /admin, /cms and /api must not get one.
  skipTrailingSlashRedirect: true,
  reactStrictMode: true,
  poweredByHeader: false,
  // The page templates and content files are read at build time and by the preview and 404 routes.
  outputFileTracingIncludes: {
    '/**': ['./content/**/*', './public/assets/**/*'],
  },
  async redirects() {
    return [
      ...contentRedirects(),
      ...WORDPRESS.map(([source, destination]) => ({ source, destination, statusCode: 301 })),
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      { source: '/images/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }] },
      { source: '/assets/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    ];
  },
};

/**
 * Payload adds colour-scheme client hint headers (Accept-CH, Critical-CH, Vary) to every
 * address. On the public site Critical-CH makes Chrome request each page twice, which costs
 * about half a second on mobile. Keep those headers for the Payload screens at /cms only.
 */
const withCms = withPayload(nextConfig);
const payloadHeaders = withCms.headers;
withCms.headers = async () => {
  const all = (await payloadHeaders()) || [];
  return all.flatMap((rule) => {
    const hints = rule.headers.filter((h) => ['Accept-CH', 'Critical-CH', 'Vary'].includes(h.key) && /Sec-CH-Prefers-Color-Scheme/.test(h.value));
    if (rule.source !== '/:path*' || !hints.length) return [rule];
    const rest = rule.headers.filter((h) => !hints.includes(h));
    return [
      ...(rest.length ? [{ ...rule, headers: rest }] : []),
      { source: '/cms', headers: hints },
      { source: '/cms/:path*', headers: hints },
    ];
  });
};

export default withCms;
