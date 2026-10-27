import { fmtDate } from './blocks';
import { pageByRoute, posts as allPosts, routedPages } from './content';
import { defaultContext, renderDocument, renderSections, type RenderContext } from './render';
import type { PageData, Post } from './types';

/** Breadcrumb parents, from the URL: /services/x/ sits under Services, and so on. */
export function parentsFor(route: string, ctx?: RenderContext): { name: string; route: string }[] {
  const segs = route.split('/').filter(Boolean);
  const out: { name: string; route: string }[] = [];
  for (let i = 1; i < segs.length; i++) {
    const r = `/${segs.slice(0, i).join('/')}/`;
    const p = pageByRoute(r);
    if (p) out.push({ name: p.title, route: r });
  }
  return out;
}

export function renderContentPage(page: PageData, ctx: RenderContext = defaultContext()): string {
  const body = renderSections(page.sections, ctx);
  return renderDocument({ route: page.route, title: page.title, seo: page.seo, pageId: page.pageId, body, kind: page.route === '/blog/' ? 'blog' : 'page', parents: parentsFor(page.route), bodyForSchema: body }, ctx);
}

const esc = (s: string) => String(s ?? '').replace(/&(?!amp;|#\d+;|[a-z]+;)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * A blog article, in the approved inner-page style: the page heading banner, then the
 * article in the same prose column the service pages use, then the referral call to action.
 */
export function renderPost(post: Post, ctx: RenderContext = defaultContext()): string {
  const img = post.image?.src || '/images/hall.jpg';
  const body = [
    '<section class="pagehead">',
    `  <div class="art"><img src="${esc(img)}" alt=""></div>`,
    `  <div class="wrap"><div><div class="crumb"><a href="/">Home</a> / <a href="/blog/">Blog</a> / ${esc(post.title)}</div><h1>${esc(post.title)}</h1><p>${esc(post.excerpt)}</p></div></div>`,
    '</section>',
    '<section class="block">',
    '  <div class="wrap two narrow-r">',
    '    <article class="prose post-body">',
    `      <p class="post-meta">${fmtDate(post.publishedAt)}${post.author ? ` &middot; ${esc(post.author)}` : ''}</p>`,
    post.body,
    '    </article>',
    '    <aside class="side">',
    '      <h3>Talk to our team</h3>',
    '      <p style="font-size:.95rem;color:var(--muted)">Questions about your own treatment are best answered at a consultation with one of our specialist surgeons.</p>',
    '      <a class="btn btn-primary" href="tel:{{phoneTel}}">Call {{phone}}</a>',
    '      <a class="btn btn-outline" href="/contact-us/">Make an enquiry</a>',
    '    </aside>',
    '  </div>',
    '</section>',
  ].join('\n');
  const html = renderDocument(
    {
      route: `/${post.slug}/`,
      title: post.title,
      seo: { metaTitle: post.metaTitle || `${post.title} | ${ctx.settings.name}`, metaDescription: post.metaDescription || post.excerpt, ogImage: post.ogImage || post.image?.src, noindex: post.noindex },
      pageId: 'blog--post',
      body,
      kind: 'post',
      post,
      parents: [{ name: 'Blog', route: '/blog/' }],
    },
    ctx,
  );
  return html.replace(/\{\{phone\}\}/g, ctx.settings.phone).replace(/\{\{phoneTel\}\}/g, ctx.settings.phoneTel);
}

export function render404(ctx: RenderContext = defaultContext()): string {
  const page = routedPages().find((p) => p.slug === 'not-found') || pageByRoute('/404/');
  if (page) {
    const body = renderSections(page.sections, ctx);
    return renderDocument({ route: '/404/', title: page.title, seo: { ...page.seo, noindex: true }, pageId: page.pageId, body, kind: '404' }, ctx);
  }
  return '<!DOCTYPE html><title>Page not found</title><p>Page not found. <a href="/">Home</a></p>';
}

/** HTML for any public address, or null when nothing lives there. */
export function renderRoute(route: string, ctx: RenderContext = defaultContext()): string | null {
  if (route === '/404/') return null;
  const page = pageByRoute(route);
  if (page) return renderContentPage(page, ctx);
  const slug = route.replace(/^\/|\/$/g, '');
  const post = allPosts().find((p) => p.slug === slug);
  if (post && !slug.includes('/')) return renderPost(post, ctx);
  return null;
}

/** Every public address the build pre-renders. */
export function allRoutes(): string[] {
  return [...routedPages().filter((p) => p.slug !== 'not-found').map((p) => p.route), ...allPosts().map((p) => `/${p.slug}/`)];
}
