import { asset } from './assets';
import { locationCards, postCards, staffCards, surgeonBios } from './blocks';
import { posts as allPosts, settings as loadSettings, siteWide, team as loadTeam, templates } from './content';
import { headTags, type HeadInput } from './head';
import type { PageData, Post, SectionData, SiteSettings, TeamData, TemplateDef } from './types';

export interface RenderContext {
  settings: SiteSettings;
  team: TeamData;
  posts: Post[];
  templates: Record<string, TemplateDef>;
  siteWide: PageData;
  /**
   * Dashboard visual editor only (POST /edit-preview/ with mode=edit): the sections the
   * editor is working on. Their editable spots get data-edit attributes so the in-page
   * script can make them clickable. Never set for the public site.
   */
  edit?: { sections: WeakSet<SectionData> };
}

export function defaultContext(): RenderContext {
  return { settings: loadSettings(), team: loadTeam(), posts: allPosts(), templates: templates(), siteWide: siteWide() };
}

const attrEsc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Visual editor: adds data attributes to a section template (before it is filled) so
 * each editable spot can be found on the page. Every wording placeholder is the whole
 * content of its element, so the attribute goes on that element:
 *   data-edit="<section>|fN" data-edit-type="text|rich|link"   wording, edited in place
 *   data-edit-img="<section>|fN"                                a photo (on the img tag)
 *   data-edit-href="<section>|fN"                               a link address (on the a tag)
 *   data-edit-note="team|locations|posts"                       generated from elsewhere
 *   data-edit-section="<section>" data-edit-label="..."         the section's outer element
 */
export function markEditable(html: string, section: SectionData, def: TemplateDef): string {
  const inserts: { at: number; text: string }[] = [];
  const id = attrEsc(`${section.id}|`);
  const re = /\{\{(f\d+)(?:\.(src|alt|href))?\}\}|\{\{@(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, key, prop, gen] = m;
    if (gen) {
      const gt = html.lastIndexOf('>', m.index);
      if (gt > 0 && html.slice(gt + 1, m.index).trim() === '') {
        const note = gen === 'surgeons' || gen === 'staff' ? 'team' : gen;
        inserts.push({ at: gt, text: ` data-edit-note="${note}"` });
      }
      continue;
    }
    const type = def.fields?.[key]?.type;
    if (!type) continue;
    if (!prop && (type === 'text' || type === 'rich' || type === 'link')) {
      const gt = html.lastIndexOf('>', m.index);
      if (gt > 0 && html.slice(gt + 1, m.index).trim() === '' && html[html.lastIndexOf('<', gt) + 1] !== '/') {
        inserts.push({ at: gt, text: ` data-edit="${id}${key}" data-edit-type="${type}"` });
      }
    } else if (prop === 'src' || prop === 'href') {
      const gt = html.indexOf('>', m.index);
      if (gt > 0) inserts.push({ at: gt, text: prop === 'src' ? ` data-edit-img="${id}${key}"` : ` data-edit-href="${id}${key}"` });
    }
  }
  const first = html.search(/<[a-zA-Z]/);
  if (first >= 0) {
    const gt = html.indexOf('>', first);
    if (gt > 0) inserts.push({ at: gt, text: ` data-edit-section="${attrEsc(section.id)}" data-edit-label="${attrEsc(def.label || section.template)}"` });
  }
  let out = html;
  for (const ins of inserts.sort((a, b) => b.at - a.at)) {
    // A self-closing tag (<img ... />) keeps its slash last.
    const at = out[ins.at - 1] === '/' ? ins.at - 1 : ins.at;
    out = out.slice(0, at) + ins.text + out.slice(at);
  }
  return out;
}

/** Fill one section template with its saved values. */
export function fillSection(section: SectionData, ctx: RenderContext): string {
  const t = ctx.templates[section.template];
  if (!t) throw new Error(`Unknown section template ${section.template}`);
  const html = ctx.edit?.sections.has(section) ? markEditable(t.html, section, t) : t.html;
  let out = html.replace(/\{\{(f\d+)(?:\.(src|alt|href))?\}\}/g, (_, key: string, prop?: string) => {
    const v = section.fields?.[key] || {};
    const val = (v as Record<string, string | undefined>)[prop || 'value'];
    return val ?? '';
  });
  out = out.replace(/\{\{@(\w+)\}\}/g, (_, name: string) => generated(name, ctx));
  return tokens(out, ctx.settings);
}

function generated(name: string, ctx: RenderContext): string {
  switch (name) {
    case 'locations':
      return locationCards(ctx.settings.locations);
    case 'staff':
      return staffCards(ctx.team.staff, ctx.settings.name);
    case 'surgeons':
      return surgeonBios(ctx.team.surgeons);
    case 'posts':
      return postCards(ctx.posts);
    default:
      throw new Error(`Unknown generated block {{@${name}}}`);
  }
}

/** Practice-wide values used inside wording and links. */
export function tokens(html: string, s: SiteSettings): string {
  return html
    .replace(/\{\{phone\}\}/g, s.phone)
    .replace(/\{\{phoneTel\}\}/g, s.phoneTel)
    .replace(/\{\{year\}\}/g, String(new Date().getFullYear()));
}

export function renderSections(sections: SectionData[], ctx: RenderContext): string {
  return sections
    .filter((s) => !s.hidden)
    .map((s) => fillSection(s, ctx))
    .join('\n');
}

/**
 * Speed only, no visual change: photos the visitor cannot see when the page opens (the
 * menu's dropdown photos, everything below the first section, the footer) load as they are
 * needed instead of competing with the opening photo. `skip` leaves the first n photos alone.
 */
export function lazyImages(html: string, skip = 0): string {
  let n = 0;
  return html.replace(/<img\b(?![^>]*\b(?:loading|fetchpriority)=)([^>]*)>/g, (tag, rest) => {
    n++;
    return n <= skip ? tag : `<img loading="lazy" decoding="async"${rest}>`;
  });
}

function lazyAfterFirstSection(body: string): string {
  const end = body.indexOf('</section>');
  if (end < 0) return body;
  const cut = end + '</section>'.length;
  return body.slice(0, cut) + lazyImages(body.slice(cut));
}

// ------------------------------------------------------------------ the whole document
export interface DocumentInput extends HeadInput {
  pageId: string;
  /** The page's sections, already rendered. */
  body: string;
}

export function renderDocument(input: DocumentInput, ctx: RenderContext): string {
  const shell = Object.fromEntries(ctx.siteWide.sections.map((s) => [s.id, s.hidden ? '' : fillSection(s, ctx)]));
  let doc = [
    '<!DOCTYPE html>',
    '<html lang="en-AU">',
    '<head>',
    headTags(input, ctx),
    '</head>',
    '',
    '<body>',
    '',
    shell.topbar,
    '',
    lazyImages(shell.header || '', 1),
    '',
    lazyImages(shell.drawer || ''),
    '',
    '<main id="main">',
    '',
    `<div data-page="${input.pageId}" class="on">`,
    lazyAfterFirstSection(input.body),
    '</div>',
    '',
    '</main>',
    '',
    lazyImages(shell.footer || ''),
    '',
    lazyImages(shell.mcta || ''),
    '',
    `<script src="${asset('/assets/site.js')}" defer></script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
  // A logo chosen in Site Settings replaces the built-in one everywhere.
  if (ctx.settings.logo) doc = doc.split('/images/logo.png').join(ctx.settings.logo);
  return doc;
}

export function renderPage(page: PageData, ctx: RenderContext = defaultContext(), extra: Partial<DocumentInput> = {}): string {
  return renderDocument(
    {
      route: page.route,
      title: page.title,
      seo: page.seo,
      pageId: page.pageId,
      body: renderSections(page.sections, ctx),
      kind: 'page',
      ...extra,
    },
    ctx,
  );
}
