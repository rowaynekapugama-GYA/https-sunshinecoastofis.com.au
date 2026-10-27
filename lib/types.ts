/**
 * The website's content model. Every page is a list of sections; every section is an
 * approved HTML template (content/templates/sections.json) plus the values the
 * practice can change. The dashboard edits these same shapes.
 */
export type FieldType = 'text' | 'rich' | 'link' | 'href' | 'image';

export interface FieldDef {
  type: FieldType;
  label: string;
}

export interface TemplateDef {
  label: string;
  fields: Record<string, FieldDef>;
  html: string;
  before_main?: boolean;
}

/**
 * One editable spot. Values are stored as HTML exactly as they appear in the page:
 *   text  -> value (plain words, &amp; style entities)
 *   rich  -> value (words with <strong>, <em>, <a href> and <br> only)
 *   link  -> value (button or link wording) + href
 *   href  -> href only (a link whose wording is fixed, for example a whole card)
 *   image -> src + alt
 */
export interface FieldValue {
  value?: string;
  href?: string;
  src?: string;
  alt?: string;
  /** Dashboard only: the Media Library photo chosen for this slot (its address is looked up at build time). */
  media?: number | string;
}

export interface SectionData {
  id: string;
  template: string;
  hidden?: boolean;
  fields: Record<string, FieldValue>;
}

export interface PageSeo {
  metaTitle?: string;
  metaDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonical?: string;
  noindex?: boolean;
  primaryKeyword?: string;
}

export type PageKind = 'page' | 'site';

export interface PageData {
  slug: string;
  route: string;
  /** The approved page id (data-page). Drives the menu highlight and page scripts. */
  pageId: string;
  /** Menu and breadcrumb name. */
  title: string;
  kind: PageKind;
  seo: PageSeo;
  sections: SectionData[];
}

export interface Location {
  name: string;
  area: string;
  address: string;
  note: string;
  mapLink: string;
  mapQuery: string;
  mapEmbed: string;
  pin: string;
  main: boolean;
  hidden?: boolean;
}

export interface Hours {
  day: string;
  open: string;
  close: string;
  closed: boolean;
}

export interface SiteSettings {
  name: string;
  shortName: string;
  phone: string;
  phoneTel: string;
  phoneIntl: string;
  email: string;
  address: { street: string; suburb: string; state: string; postcode: string; country: string };
  geo: { lat: number; lng: number };
  hours: Hours[];
  mapsUrl: string;
  googleReviewUrl: string;
  googleReviewsUrl: string;
  social: { facebook: string; instagram: string };
  areaServed: string[];
  locations: Location[];
  logo: string;
  colours: { navy: string; cyan: string };
  tracking: { ga4Id: string; gtmId: string; metaPixelId: string; searchConsoleVerification: string };
  defaultShareImage: string;
}

export interface Surgeon {
  kind: 'surgeon';
  key: string;
  name: string;
  roleLine: string;
  lede: string;
  tags: string[];
  facts: { title: string; text: string }[];
  columns: { heading: string; items: string[]; paragraph: string }[];
  storyLabel: string;
  story: string[];
  photoPath: string;
  photoAlt: string;
  hidden: boolean;
  order: number;
  /** Schema only (never shown): qualifications and areas, as supplied by the practice. */
  credentials?: string[];
  knowsAbout?: string[];
  sameAs?: string;
  ahpra?: string;
}

export interface Staff {
  kind: 'staff';
  key: string;
  name: string;
  role: string;
  order: number;
  hidden: boolean;
  photoPath?: string;
  photoWebp?: string;
  width?: number;
  height?: number;
  photoTop?: boolean;
}

export interface TeamData {
  surgeons: Surgeon[];
  staff: Staff[];
}

export interface Post {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  image?: { src: string; alt: string };
  author: string;
  categories: string[];
  publishedAt: string;
  updatedAt?: string;
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  noindex?: boolean;
}

export interface Redirect {
  from: string;
  to: string;
  type: '301' | '302';
}
