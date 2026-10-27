import { headers } from 'next/headers';
import { getPayload } from 'payload';
import config from '@payload-config';
import { mediaUrl, pageFromDoc } from '@/cms/sync';
import { templates } from '@/lib/content';
import { renderContentPage } from '@/lib/pages';
import { asset } from '@/lib/assets';
import type { PageData } from '@/lib/types';

/**
 * POST /edit-preview/ from the dashboard, for signed-in users only. Never cached, never indexed.
 *
 *   mode=preview (default)  the Preview button: the page exactly as it will look with the
 *                           editor's changes (saved or not), in a new tab.
 *   mode=edit               the visual editor's canvas: the same page with its editable
 *                           spots marked and /assets/page-edit.js added, shown in the
 *                           dashboard's iframe (same origin only).
 */
export const dynamic = 'force-dynamic';

const BANNER =
  '<div style="position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:9999;background:#182650;color:#fff;font:600 14px/1.3 Arial,sans-serif;padding:10px 16px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.25)">Preview only. Save, then Publish website to make it live.</div>';

export async function POST(req: Request) {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await headers() });
  if (!user) return new Response('Please sign in to the dashboard first.', { status: 401 });
  let doc: unknown;
  let edit = false;
  try {
    const form = await req.formData();
    doc = JSON.parse(String(form.get('doc') || '{}'));
    edit = form.get('mode') === 'edit';
  } catch {
    return new Response('Could not read the page.', { status: 400 });
  }
  const t = templates();
  // Only the library photos this page uses (one small query, not the whole library).
  const ids = new Set<string>();
  for (const s of (doc as any)?.sections || []) for (const f of Object.values(s?.fields || {}) as any[]) if (f?.media != null) ids.add(String(f.media));
  const media = ids.size
    ? await payload.find({ collection: 'media', where: { id: { in: [...ids] } }, limit: ids.size, depth: 0, overrideAccess: true, pagination: false })
    : { docs: [] as any[] };
  const byId = new Map(media.docs.map((m: any) => [String(m.id), mediaUrl(m)]));
  const page = pageFromDoc(doc, (tpl, key) => t[tpl]?.fields?.[key]?.type, (id) => byId.get(String(id)));
  page.sections = page.sections.filter((s) => t[s.template]);
  const { defaultContext } = await import('@/lib/render');
  const ctx = defaultContext();
  if (edit) ctx.edit = { sections: new WeakSet(page.sections) };

  let out: string;
  if (page.kind === 'site') {
    // The header, menu and footer: shown around the home page.
    const { pageByRoute } = await import('@/lib/content');
    const home = pageByRoute('/');
    if (!home) return new Response('No home page', { status: 500 });
    out = renderContentPage(home, { ...ctx, siteWide: page });
  } else {
    out = renderContentPage(page, ctx);
  }
  return html(edit ? withEditor(out, page, ctx.settings) : out.replace('<body>', `<body>\n${BANNER}`));
}

/** The in-page editing script, plus what it needs: the practice-wide values shown in place of {{phone}} and friends. */
function withEditor(doc: string, page: PageData, s: { phone: string; phoneTel: string }) {
  const raw: Record<string, string> = {};
  for (const sec of page.sections) {
    for (const [k, v] of Object.entries(sec.fields || {})) {
      if (v?.value && v.value.includes('{{')) raw[`${sec.id}|${k}`] = v.value;
    }
  }
  const data = { raw, tokens: { phone: s.phone, phoneTel: s.phoneTel, year: String(new Date().getFullYear()) } };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  // Speed: the background video, Google Maps and the 3D tour are not loaded in the editor (the photo or the
  // map's fallback text shows instead). They are unchanged on the real page.
  doc = doc.replace(/<iframe\b([^>]*?)\ssrc="https?:\/\/[^"]*"/gi, '<iframe$1 src="about:blank" data-edit-embed');
  return doc.replace('</body>', `<script>window.__EDIT=${json};</script>\n<script src="${asset('/assets/page-edit.js')}"></script>\n</body>`);
}

function html(doc: string) {
  return new Response(doc, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}
