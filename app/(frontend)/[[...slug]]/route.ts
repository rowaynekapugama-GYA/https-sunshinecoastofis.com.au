import { allRoutes, render404, renderRoute } from '@/lib/pages';

/**
 * Every public page. Pre-rendered to plain HTML at build time from the files in
 * /content (which the build first refreshes from the dashboard), so the live site
 * never touches the database and serves the approved markup as-is.
 */
export const dynamic = 'force-static';
export const dynamicParams = true;
export const revalidate = false;

export function generateStaticParams() {
  return allRoutes().map((r) => ({ slug: r.split('/').filter(Boolean) }));
}

const HTML = { 'Content-Type': 'text/html; charset=utf-8' };

export async function GET(_req: Request, { params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  const route = slug.length ? `/${slug.map(decodeURIComponent).join('/')}/` : '/';
  const html = renderRoute(route);
  if (html === null) return new Response(render404(), { status: 404, headers: { ...HTML, 'Cache-Control': 'no-store' } });
  return new Response(html, { headers: HTML });
}
