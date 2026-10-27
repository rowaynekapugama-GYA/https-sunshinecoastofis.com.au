/**
 * Website wording is stored as the HTML the page uses. The editor shows it as plain
 * text, with three shortcuts for formatted wording: **bold**, *italic* and
 * [link text](/address/), and a new line for a line break.
 */
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '\u2014', hellip: '…', middot: '·', times: '×' };

export function decode(s: string): string {
  return String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}

/** Typed text back to HTML. & is kept as typed (the approved pages do the same). */
export const encodeText = (s: string) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const encodeAttr = (s: string) => String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const decodeAttr = (s: string) => decode(s);

/** Stored HTML -> what the editor shows. */
export function richToEditable(html: string): string {
  return decode(
    String(html ?? '')
      .replace(/<br\s*\/?>\s*/gi, '\n')
      .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**')
      .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '*$2*')
      .replace(/<a\s[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, t: string) => `[${t}](${decode(href)})`)
      .replace(/<[^>]+>/g, ''),
  );
}

/** What the practice typed -> stored HTML. */
export function editableToRich(text: string, bold: 'strong' | 'b' = 'strong'): string {
  let s = encodeText(text);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t: string, href: string) => {
    const external = /^https?:\/\//i.test(href) && !/sunshinecoastofis\.com\.au/i.test(href);
    return `<a href="${encodeAttr(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, `<${bold}>$1</${bold}>`);
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return s.replace(/\r?\n/g, '<br>');
}

export const preview = (html: string, n = 90) => {
  const v = decode(String(html ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  return v.length > n ? `${v.slice(0, n)}…` : v;
};
