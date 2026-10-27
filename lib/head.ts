import { SITE_URL } from './content';
import type { PageSeo, Post, SiteSettings } from './types';
import type { RenderContext } from './render';
import { asset } from './assets';

export interface HeadInput {
  route: string;
  /** Menu name, used for breadcrumbs and as a title fallback. */
  title: string;
  seo: PageSeo;
  kind: 'page' | 'post' | 'blog' | '404';
  post?: Post;
  /** Breadcrumb trail above this page, for BreadcrumbList schema. */
  parents?: { name: string; route: string }[];
  /** Rendered body, scanned for FAQs. */
  bodyForSchema?: string;
}

const esc = (s: string) => String(s ?? '').replace(/&(?!amp;|#\d+;|[a-z]+;)/gi, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = (s: string) =>
  String(s ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const abs = (p: string) => (!p ? '' : /^https?:\/\//i.test(p) ? p : `${SITE_URL}${p.startsWith('/') ? '' : '/'}${p}`);


export function headTags(input: HeadInput, ctx: RenderContext): string {
  const s = ctx.settings;
  const seo = input.seo || {};
  const title = seo.metaTitle || `${input.title} | ${s.name}`;
  const description = seo.metaDescription || '';
  const canonical = seo.canonical ? abs(seo.canonical) : `${SITE_URL}${input.route}`;
  const ogImage = abs(seo.ogImage || (input.post?.image?.src ?? '') || s.defaultShareImage);
  const robots = seo.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const t = s.tracking || ({} as SiteSettings['tracking']);
  const lines = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(title)}</title>`,
    description ? `<meta name="description" content="${esc(description)}">` : '',
    `<meta name="robots" content="${robots}">`,
    `<link rel="canonical" href="${esc(canonical)}">`,
    '<meta property="og:locale" content="en_AU">',
    `<meta property="og:type" content="${input.kind === 'post' ? 'article' : 'website'}">`,
    `<meta property="og:title" content="${esc(seo.ogTitle || title)}">`,
    description || seo.ogDescription ? `<meta property="og:description" content="${esc(seo.ogDescription || description)}">` : '',
    `<meta property="og:url" content="${esc(canonical)}">`,
    `<meta property="og:site_name" content="${esc(s.name)}">`,
    ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : '',
    input.post ? `<meta property="article:published_time" content="${esc(input.post.publishedAt)}">` : '',
    input.post?.updatedAt ? `<meta property="article:modified_time" content="${esc(input.post.updatedAt)}">` : '',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(seo.ogTitle || title)}">`,
    description ? `<meta name="twitter:description" content="${esc(seo.ogDescription || description)}">` : '',
    ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">` : '',
    t.searchConsoleVerification ? `<meta name="google-site-verification" content="${esc(t.searchConsoleVerification)}">` : '',
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    '<link rel="icon" href="/favicon.ico" sizes="32x32">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&family=Mulish:ital,wght@0,400;0,500;0,700;1,400&display=swap" rel="stylesheet">',
    `<link rel="stylesheet" href="${asset('/assets/site.css')}">`,
    s.colours?.navy || s.colours?.cyan
      ? `<style>:root{${s.colours.navy ? `--navy:${esc(s.colours.navy)};` : ''}${s.colours.cyan ? `--cyan:${esc(s.colours.cyan)};` : ''}}</style>`
      : '',
    ...schema(input, ctx).map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`),
    tracking(t),
  ];
  return lines.filter(Boolean).join('\n');
}

function tracking(t: SiteSettings['tracking']): string {
  const out: string[] = [];
  if (t.gtmId && /^GTM-[A-Z0-9]+$/i.test(t.gtmId)) {
    out.push(
      `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${t.gtmId}');</script>`,
    );
  }
  if (t.ga4Id && /^(G|GT|AW)-[A-Z0-9]+$/i.test(t.ga4Id)) {
    out.push(
      `<script async src="https://www.googletagmanager.com/gtag/js?id=${t.ga4Id}"></script>`,
      `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${t.ga4Id}');</script>`,
    );
  }
  if (t.metaPixelId && /^\d+$/.test(t.metaPixelId)) {
    out.push(
      `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${t.metaPixelId}');fbq('track','PageView');</script>`,
    );
  }
  return out.join('\n');
}

// ------------------------------------------------------------------ structured data
const PRACTICE_ID = `${SITE_URL}/#practice`;

function practice(s: SiteSettings, withTeam: boolean, ctx: RenderContext) {
  const days = s.hours.filter((h) => !h.closed && h.open && h.close);
  const groups: Record<string, string[]> = {};
  for (const h of days) (groups[`${h.open}-${h.close}`] ||= []).push(h.day);
  const main = s.locations.find((l) => l.main);
  return {
    '@context': 'https://schema.org',
    '@type': ['MedicalClinic', 'Dentist'],
    '@id': PRACTICE_ID,
    name: s.name,
    alternateName: s.shortName,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/images/logo.png`,
    image: abs(s.defaultShareImage),
    telephone: s.phoneIntl,
    medicalSpecialty: 'Oral and Maxillofacial Surgery',
    priceRange: '$$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: s.address.street,
      addressLocality: s.address.suburb,
      addressRegion: s.address.state,
      postalCode: s.address.postcode,
      addressCountry: s.address.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: s.geo.lat, longitude: s.geo.lng },
    hasMap: main?.mapLink || s.mapsUrl,
    openingHoursSpecification: Object.entries(groups).map(([k, d]) => {
      const [opens, closes] = k.split('-');
      return { '@type': 'OpeningHoursSpecification', dayOfWeek: d.length === 1 ? d[0] : d, opens, closes };
    }),
    areaServed: s.areaServed,
    sameAs: [s.social.facebook, s.social.instagram].filter(Boolean),
    ...(withTeam ? { employee: ctx.team.surgeons.filter((x) => !x.hidden).map((x) => ({ '@id': `${SITE_URL}/about/#${x.key}` })) } : {}),
  };
}

function surgeons(ctx: RenderContext) {
  return ctx.team.surgeons
    .filter((x) => !x.hidden)
    .map((x) => {
      // Credentials exactly as the practice supplied them, from the role line ("..., Founder. BMed (Hons), BDSc, FRACDS (OMS)").
      const parts = plain(x.roleLine).split('. ');
      const quals = x.credentials?.length ? x.credentials : parts.length > 1 ? parts.slice(1).join('. ').split(/,\s*/) : [];
      return {
        '@context': 'https://schema.org',
        '@type': 'Person',
        '@id': `${SITE_URL}/about/#${x.key}`,
        name: plain(x.name),
        jobTitle: plain(parts[0]),
        honorificSuffix: quals.join(', ') || undefined,
        image: abs(x.photoPath),
        url: `${SITE_URL}/about/#${x.key}`,
        worksFor: { '@id': PRACTICE_ID },
        knowsAbout: x.knowsAbout?.length ? x.knowsAbout : x.tags.map(plain),
        ...(x.sameAs ? { sameAs: [x.sameAs] } : {}),
      };
    });
}

function breadcrumbs(input: HeadInput) {
  const items = [{ name: 'Home', route: '/' }, ...(input.parents || []), { name: input.title, route: input.route }];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: plain(it.name), item: `${SITE_URL}${it.route}` })),
  };
}

function faqs(html: string) {
  const faq = html.match(/<div class="faq[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  if (!faq) return null;
  const qa = [...faq[1].matchAll(/<details><summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)];
  if (!qa.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qa.map((m) => ({ '@type': 'Question', name: plain(m[1]), acceptedAnswer: { '@type': 'Answer', text: plain(m[2]) } })),
  };
}

function hospitals(s: SiteSettings) {
  return s.locations
    .filter((l) => !l.main && !l.hidden)
    .map((l) => ({
      '@context': 'https://schema.org',
      '@type': 'Hospital',
      name: plain(l.name),
      address: { '@type': 'PostalAddress', streetAddress: plain(l.address), addressCountry: 'AU' },
      hasMap: l.mapLink,
      description: plain(l.note),
    }));
}

function schema(input: HeadInput, ctx: RenderContext): object[] {
  const s = ctx.settings;
  const out: object[] = [];
  const isHome = input.route === '/';
  if (input.kind === '404') return out;
  out.push(practice(s, isHome || input.route === '/about/', ctx));
  if (isHome || input.route === '/about/') out.push(...surgeons(ctx));
  if (!isHome) out.push(breadcrumbs(input));
  if (input.route === '/locations/') out.push(...hospitals(s));
  if (input.bodyForSchema) {
    const f = faqs(input.bodyForSchema);
    if (f) out.push(f);
  }
  if (input.kind === 'post' && input.post) {
    const p = input.post;
    out.push({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: plain(p.title),
      description: plain(p.metaDescription || p.excerpt),
      datePublished: p.publishedAt,
      dateModified: p.updatedAt || p.publishedAt,
      author: { '@type': 'Organization', name: p.author || s.name, url: `${SITE_URL}/` },
      publisher: { '@id': PRACTICE_ID },
      image: p.image?.src ? abs(p.image.src) : abs(s.defaultShareImage),
      mainEntityOfPage: `${SITE_URL}/${p.slug}/`,
    });
  }
  return out;
}
