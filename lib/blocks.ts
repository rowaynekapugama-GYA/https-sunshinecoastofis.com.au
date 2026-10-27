import type { Location, Post, Staff, Surgeon } from './types';

/**
 * Markup for the parts of the approved pages that are built from Site Settings and
 * Team rather than typed into a page: the location cards (home and Locations), the
 * surgeons' full bios and the team photos (Our practice), and the blog cards. Each
 * function returns the approved HTML exactly (checked by scripts/test-render.ts).
 */

/** Attribute text: the approved HTML keeps & as typed, so only quotes and angle brackets are escaped. */
const attr = (s: string) => String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** URLs in attributes: & becomes &amp; (as in the approved HTML). */
const url = (s: string) => attr(String(s ?? '').replace(/&(?!amp;|#\d+;|[a-z]+;)/gi, '&amp;'));
const text = (s: string) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function locationCards(list: Location[]): string {
  return list
    .filter((l) => !l.hidden)
    .map((l) => {
      const cls = l.main ? 'loc main active' : 'loc';
      const embed = l.mapEmbed ? ` data-embed="${url(l.mapEmbed)}"` : '';
      return (
        `<div class="${cls}"${embed} data-pin="${attr(l.pin)}" data-q="${attr(l.mapQuery)}" data-name="${attr(l.name)}" data-addr="${attr(l.address)}" data-note="${attr(l.note)}" data-link="${url(l.mapLink)}" tabindex="0">` +
        `<span class="n">${text(l.pin)}</span><span class="area">${text(l.area)}</span><h3>${text(l.name)}</h3><p>${text(l.address)}</p>` +
        `<a class="map" href="${url(l.mapLink)}" target="_blank" rel="noopener">Get directions</a></div>`
      );
    })
    .join('');
}

const SILHOUETTE = '<svg viewBox="0 0 100 90" fill="currentColor"><circle cx="50" cy="30" r="20"/><path d="M8 90c0-24 19-38 42-38s42 14 42 38z"/></svg>';

export function staffCards(list: Staff[], practice: string): string {
  const cards = list
    .filter((s) => !s.hidden)
    .map((s) => {
      const meta = `<div class="meta"><b>${text(s.name)}</b><span>${text(s.role)}</span></div>`;
      if (!s.photoPath) {
        return `<div class="tm"><div class="sil" role="img" aria-label="${attr(s.name)}, photo coming soon">${SILHOUETTE}</div>${meta}</div>`;
      }
      const alt = `${s.name}, ${s.role} at ${practice}`.replace(/&(?!amp;)/g, '&amp;');
      const webp = s.photoWebp || s.photoPath;
      const size = s.width && s.height ? ` width="${s.width}" height="${s.height}"` : '';
      return (
        `<div class="tm"><picture class="tm-img${s.photoTop ? ' top' : ''}"><source srcset="${url(webp)}" type="image/webp">` +
        `<img src="${url(s.photoPath)}" alt="${attr(alt)}"${size} loading="lazy" decoding="async"></picture>${meta}</div>`
      );
    });
  return `\n      ${cards.join('\n      ')}\n    `;
}

export function surgeonBios(list: Surgeon[]): string {
  return list
    .filter((s) => !s.hidden)
    .map((s, i) => {
      const style = i === 0 ? ' style="margin-top:2.5rem"' : '';
      const tags = s.tags.map((t) => `<span>${t}</span>`).join('');
      const facts = s.facts.map((f) => `            <div class="fact"><b>${f.title}</b><span>${f.text}</span></div>`).join('\n');
      const cols = s.columns
        .map((c) => {
          const body = c.items.length ? `<ul>${c.items.map((li) => `<li>${li}</li>`).join('')}</ul>` : `<p>${c.paragraph}</p>`;
          return `        <div><h3>${c.heading}</h3>${body}</div>`;
        })
        .join('\n');
      const story = s.story.map((p) => `          <p>${p}</p>`).join('\n');
      return [
        `<article class="bio rv" id="${attr(s.key)}"${style}>`,
        `      <div class="bio-head">`,
        `        <div class="bio-photo"><img src="${url(s.photoPath)}" alt="${attr(s.photoAlt)}"></div>`,
        `        <div>`,
        `          <h2>${s.name}</h2>`,
        `          <p class="role">${s.roleLine}</p>`,
        `          <p class="lede">${s.lede}</p>`,
        `          <div class="tags">${tags}</div>`,
        `          <div class="facts rv-stagger">`,
        facts,
        `          </div>`,
        `        </div>`,
        `      </div>`,
        `      <div class="bio-cols">`,
        cols,
        `      </div>`,
        `      <details><summary>${s.storyLabel}</summary>`,
        `        <div class="prose">`,
        story,
        `        </div>`,
        `      </details>`,
        `    </article>`,
      ].join('\n');
    })
    .join('\n    ');
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' });

/** Blog index cards, in the services-grid card style the approved site already uses. */
export function postCards(list: Post[]): string {
  if (!list.length) return '\n      <p class="lead">New articles from our surgeons are coming soon.</p>\n    ';
  const cards = list.map(
    (p) =>
      `<a class="svc" href="/${attr(p.slug)}/">` +
      (p.image ? `<div class="post-img"><img src="${url(p.image.src)}" alt="${attr(p.image.alt)}" loading="lazy"></div>` : '') +
      `<span class="more" style="margin:0 0 .4rem">${fmtDate(p.publishedAt)}</span><h3>${text(p.title)}</h3><p>${text(p.excerpt)}</p><span class="more">Read article</span></a>`,
  );
  return `\n      ${cards.join('\n      ')}\n    `;
}

export { fmtDate };
