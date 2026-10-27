import sanitizeHtml from 'sanitize-html';

/**
 * The only HTML the site ever renders from the dashboard: blog article bodies.
 * Allow-list of the tags the article editor can produce. Applied at build time
 * (pull-content) and again at render, so nothing else can reach the page.
 */
export function sanitiseHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'b', 'i', 'u', 's', 'blockquote', 'img', 'br', 'hr', 'figure', 'figcaption', 'code', 'pre'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'loading'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const external = /^https?:\/\//i.test(attribs.href || '') && !/sunshinecoastofis\.com\.au/i.test(attribs.href || '');
        return { tagName, attribs: external ? { ...attribs, target: '_blank', rel: 'noopener' } : attribs };
      },
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy' } }),
    },
  });
}
