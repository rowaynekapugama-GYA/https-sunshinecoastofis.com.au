/**
 * Two-way mapping between the website's content files (lib/types.ts) and the Payload
 * documents the dashboard edits.
 *
 *   *ToDoc(file)   content file -> Payload document   (Import, seed)
 *   *FromDoc(doc)  Payload doc  -> content file       (build-time pull)
 *
 * Everything coming back from the dashboard is cleaned on the way out, so a value can
 * never break the approved markup: plain wording cannot contain tags, formatted wording
 * keeps only bold, italic, links and line breaks, and links and photo addresses cannot
 * carry quotes or scripts.
 */
import sanitizeHtml from 'sanitize-html';
import type { FieldValue, Location, PageData, Post, SectionData, SiteSettings, Staff, Surgeon, TeamData } from '@/lib/types';
import { sanitiseHtml } from '@/lib/sanitise';

type Media = { url?: string | null; alt?: string | null; width?: number | null; height?: number | null } | number | string | null | undefined;
type Row = { value: string };

const rows = (list?: string[] | null): Row[] => (list || []).map((value) => ({ value }));
const values = (list?: Row[] | null): string[] => (list || []).map((r) => r?.value).filter((v): v is string => typeof v === 'string');

/** Root-relative for our own /api/media files, absolute for Vercel Blob. */
export function mediaUrl(m: Media): string | undefined {
  if (!m || typeof m !== 'object' || !m.url) return undefined;
  const raw = m.url;
  if (/^https?:\/\//i.test(raw) && !raw.includes('/api/media/')) return raw;
  try {
    const u = new URL(raw, 'http://local.invalid');
    return u.pathname + u.search;
  } catch {
    return raw;
  }
}

// ---------------------------------------------------------------- cleaning
/** Plain wording: entities are kept as typed, but no tags. */
export const cleanText = (s: unknown) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Wording with formatting: bold, italic, links and line breaks only. */
export function cleanRich(s: unknown): string {
  const out = sanitizeHtml(String(s ?? ''), {
    allowedTags: ['strong', 'b', 'em', 'i', 'a', 'br'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    parser: { decodeEntities: false },
    selfClosing: ['br'],
  });
  // sanitize-html writes <br />; the approved markup uses <br>.
  return out.replace(/<br \/>/g, '<br>');
}
/** Link and photo addresses: no quotes, angle brackets or script links. */
export function cleanUrl(s: unknown): string {
  const v = String(s ?? '').trim();
  if (/^\s*(javascript|data|vbscript):/i.test(v) && !/^data:image\//i.test(v)) return '#';
  return v.replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E');
}
export const cleanAttr = (s: unknown) => String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function cleanField(type: string | undefined, v: FieldValue, mediaById?: (id: number | string) => string | undefined): FieldValue {
  const out: FieldValue = {};
  // A Media Library photo: use its current address, so replacing the file in the library updates every page.
  const fromLibrary = v.media != null && mediaById ? mediaById(v.media) : undefined;
  if (fromLibrary) v = { ...v, src: fromLibrary };
  if (v.value !== undefined) out.value = type === 'rich' ? cleanRich(v.value) : cleanText(v.value);
  if (v.href !== undefined) out.href = cleanUrl(v.href);
  if (v.src !== undefined) out.src = cleanUrl(v.src);
  if (v.alt !== undefined) out.alt = cleanAttr(v.alt);
  return out;
}

// ---------------------------------------------------------------- pages
export function pageToDoc(p: PageData): Record<string, unknown> {
  return {
    title: p.title,
    slug: p.slug,
    route: p.route || '',
    kind: p.kind,
    pageId: p.pageId || '',
    sections: p.sections.map((s) => ({ sectionId: s.id, template: s.template, hidden: Boolean(s.hidden), fields: s.fields })),
    metaTitle: p.seo?.metaTitle || '',
    metaDescription: p.seo?.metaDescription || '',
    ogTitle: p.seo?.ogTitle || '',
    ogDescription: p.seo?.ogDescription || '',
    ogImagePath: p.seo?.ogImage || '',
    noindex: Boolean(p.seo?.noindex),
    canonical: p.seo?.canonical || '',
    primaryKeyword: p.seo?.primaryKeyword || '',
    _status: 'published',
  };
}

export function pageFromDoc(d: any, fieldTypes: (template: string, key: string) => string | undefined, mediaById?: (id: number | string) => string | undefined): PageData {
  const sections: SectionData[] = (d.sections || []).map((s: any) => {
    const fields: Record<string, FieldValue> = {};
    for (const [k, v] of Object.entries((s.fields || {}) as Record<string, FieldValue>)) fields[k] = cleanField(fieldTypes(s.template, k), v || {}, mediaById);
    const out: SectionData = { id: s.sectionId, template: s.template, fields };
    if (s.hidden) out.hidden = true;
    return out;
  });
  const og = mediaUrl(d.ogImage) || d.ogImagePath || '';
  const seo: PageData['seo'] = {};
  if (d.metaTitle) seo.metaTitle = d.metaTitle;
  if (d.metaDescription) seo.metaDescription = d.metaDescription;
  if (d.ogTitle) seo.ogTitle = d.ogTitle;
  if (d.ogDescription) seo.ogDescription = d.ogDescription;
  if (og) seo.ogImage = og;
  if (d.canonical) seo.canonical = d.canonical;
  if (d.noindex) seo.noindex = true;
  if (d.primaryKeyword) seo.primaryKeyword = d.primaryKeyword;
  return { slug: d.slug, route: d.route || '', pageId: d.pageId || '', title: d.title, kind: d.kind === 'site' ? 'site' : 'page', seo, sections };
}

// ---------------------------------------------------------------- team
export function teamToDocs(t: TeamData): Record<string, unknown>[] {
  return [
    ...t.surgeons.map((s) => ({
      kind: 'surgeon',
      key: s.key,
      name: s.name,
      roleLine: s.roleLine,
      lede: s.lede,
      tags: rows(s.tags),
      facts: s.facts.map((f) => ({ title: f.title, text: f.text })),
      columns: s.columns.map((c) => ({ heading: c.heading, items: rows(c.items), paragraph: c.paragraph })),
      storyLabel: s.storyLabel,
      story: rows(s.story),
      photoPath: s.photoPath,
      photoAlt: s.photoAlt,
      hidden: s.hidden,
      order: s.order,
      credentials: rows(s.credentials),
      knowsAbout: rows(s.knowsAbout),
      sameAs: s.sameAs || '',
      ahpra: s.ahpra || '',
    })),
    ...t.staff.map((s) => ({
      kind: 'staff',
      key: s.key,
      name: s.name,
      role: s.role,
      photoPath: s.photoPath || '',
      photoWebp: s.photoWebp || '',
      width: s.width ?? null,
      height: s.height ?? null,
      photoTop: Boolean(s.photoTop),
      hidden: s.hidden,
      order: s.order + 100, // staff sort after the surgeons in the dashboard list
    })),
  ];
}

export function teamFromDocs(docs: any[]): TeamData {
  const sorted = [...docs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const surgeons: Surgeon[] = [];
  const staff: Staff[] = [];
  for (const d of sorted) {
    const up = d.photo && typeof d.photo === 'object' ? d.photo : null;
    const photo = mediaUrl(up);
    if (d.kind === 'surgeon') {
      const s: Surgeon = {
        kind: 'surgeon',
        key: d.key || String(d.name || '').toLowerCase().replace(/^dr\s+/, '').split(/\s+/)[0],
        name: cleanText(d.name),
        roleLine: cleanText(d.roleLine),
        lede: cleanText(d.lede),
        tags: values(d.tags).map(cleanText),
        facts: (d.facts || []).map((f: any) => ({ title: cleanText(f.title), text: cleanText(f.text) })),
        columns: (d.columns || []).map((c: any) => ({ heading: cleanText(c.heading), items: values(c.items).map(cleanText), paragraph: cleanText(c.paragraph || '') })),
        storyLabel: cleanText(d.storyLabel),
        story: values(d.story).map(cleanText),
        photoPath: photo || d.photoPath || '',
        photoAlt: cleanAttr(d.photoAlt || d.name),
        hidden: Boolean(d.hidden),
        order: surgeons.length + 1,
      };
      const cred = values(d.credentials);
      const knows = values(d.knowsAbout);
      if (cred.length) s.credentials = cred;
      if (knows.length) s.knowsAbout = knows;
      if (d.sameAs) s.sameAs = d.sameAs;
      if (d.ahpra) s.ahpra = d.ahpra;
      surgeons.push(s);
    } else {
      const s: Staff = { kind: 'staff', key: d.key || String(d.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: cleanText(d.name), role: cleanText(d.role), order: staff.length + 1, hidden: Boolean(d.hidden) };
      if (photo) {
        s.photoPath = photo;
        s.photoWebp = photo;
        if (up?.width && up?.height) {
          s.width = up.width;
          s.height = up.height;
        }
      } else if (d.photoPath) {
        s.photoPath = d.photoPath;
        s.photoWebp = d.photoWebp || d.photoPath;
        if (d.width && d.height) {
          s.width = d.width;
          s.height = d.height;
        }
      }
      if (d.photoTop) s.photoTop = true;
      staff.push(s);
    }
  }
  return { surgeons, staff };
}

// ---------------------------------------------------------------- site settings
export function settingsToDoc(s: SiteSettings): Record<string, unknown> {
  return {
    name: s.name,
    shortName: s.shortName,
    phone: s.phone,
    phoneTel: s.phoneTel,
    phoneIntl: s.phoneIntl,
    email: s.email,
    address: s.address,
    geo: s.geo,
    hours: s.hours.map((h) => ({ day: h.day, closed: h.closed, open: h.open, close: h.close })),
    mapsUrl: s.mapsUrl,
    googleReviewUrl: s.googleReviewUrl,
    googleReviewsUrl: s.googleReviewsUrl,
    areaServed: rows(s.areaServed),
    locations: s.locations.map((l) => ({ ...l, hidden: Boolean(l.hidden) })),
    colours: s.colours,
    social: s.social,
    tracking: s.tracking,
  };
}

export function settingsFromDoc(d: any, defaults: SiteSettings): SiteSettings {
  const tracking = d.tracking || {};
  const out: SiteSettings = {
    ...defaults,
    name: d.name || defaults.name,
    shortName: d.shortName || defaults.shortName,
    phone: cleanText(d.phone || defaults.phone),
    phoneTel: String(d.phoneTel || defaults.phoneTel).replace(/[^\d+]/g, ''),
    phoneIntl: String(d.phoneIntl || defaults.phoneIntl).replace(/[^\d+]/g, ''),
    email: d.email || '',
    address: { ...defaults.address, ...(d.address || {}) },
    geo: { lat: d.geo?.lat ?? defaults.geo.lat, lng: d.geo?.lng ?? defaults.geo.lng },
    hours: (d.hours?.length ? d.hours : defaults.hours).map((h: any) => ({ day: h.day, open: h.closed ? '' : h.open || '', close: h.closed ? '' : h.close || '', closed: Boolean(h.closed) })),
    mapsUrl: d.mapsUrl || defaults.mapsUrl,
    googleReviewUrl: d.googleReviewUrl || defaults.googleReviewUrl,
    googleReviewsUrl: d.googleReviewsUrl || defaults.googleReviewsUrl,
    social: { facebook: d.social?.facebook || '', instagram: d.social?.instagram || '' },
    areaServed: values(d.areaServed).length ? values(d.areaServed) : defaults.areaServed,
    locations: (d.locations?.length ? d.locations : defaults.locations).map(
      (l: any): Location => ({
        name: cleanAttr(l.name),
        area: cleanText(l.area),
        address: cleanAttr(l.address),
        note: cleanAttr(l.note || ''),
        mapLink: cleanUrl(l.mapLink),
        mapQuery: cleanAttr(l.mapQuery || l.name),
        mapEmbed: l.mapEmbed ? cleanUrl(l.mapEmbed) : '',
        pin: String(l.pin || '1'),
        main: Boolean(l.main),
        ...(l.hidden ? { hidden: true } : {}),
      }),
    ),
    logo: mediaUrl(d.logo) || '',
    colours: { navy: /^#[0-9a-f]{3,8}$/i.test(d.colours?.navy || '') ? d.colours.navy : '', cyan: /^#[0-9a-f]{3,8}$/i.test(d.colours?.cyan || '') ? d.colours.cyan : '' },
    tracking: {
      ga4Id: tracking.ga4Id || defaults.tracking.ga4Id,
      gtmId: tracking.gtmId || defaults.tracking.gtmId,
      metaPixelId: tracking.metaPixelId || defaults.tracking.metaPixelId,
      searchConsoleVerification: tracking.searchConsoleVerification || defaults.tracking.searchConsoleVerification,
    },
    defaultShareImage: mediaUrl(d.defaultShareImage) || defaults.defaultShareImage,
  };
  return out;
}

// ---------------------------------------------------------------- posts
export function postToDoc(p: Post, categoryIds: (number | string)[] = []): Record<string, unknown> {
  return {
    categories: categoryIds,
    modifiedAt: p.updatedAt || null,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    body: p.body,
    author: p.author,
    imagePath: p.image?.src || '',
    imageAlt: p.image?.alt || '',
    publishedAt: p.publishedAt,
    metaTitle: p.metaTitle || '',
    metaDescription: p.metaDescription || '',
    noindex: Boolean(p.noindex),
    _status: 'published',
  };
}

export function postFromDoc(d: any): Post {
  const fi = d.featuredImage && typeof d.featuredImage === 'object' ? d.featuredImage : null;
  const src = mediaUrl(fi) || d.imagePath || '';
  const p: Post = {
    slug: d.slug,
    title: d.title,
    excerpt: d.excerpt || '',
    body: sanitiseHtml(typeof d.body === 'string' ? d.body : ''),
    author: d.author || '',
    categories: (d.categories || []).filter((c: any) => c && typeof c === 'object').map((c: any) => c.title),
    publishedAt: d.publishedAt || d.createdAt,
  };
  // Only a real edit counts as an update (not the import or a republish).
  if (d.modifiedAt) p.updatedAt = d.modifiedAt;
  if (src) p.image = { src, alt: (fi?.alt as string) || d.imageAlt || d.title };
  if (d.metaTitle) p.metaTitle = d.metaTitle;
  if (d.metaDescription) p.metaDescription = d.metaDescription;
  const og = mediaUrl(d.ogImage);
  if (og) p.ogImage = og;
  if (d.noindex) p.noindex = true;
  return p;
}
