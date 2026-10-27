import type { Endpoint, PayloadRequest } from 'payload';
import { importContent } from './importContent';

const unauthorised = () => Response.json({ error: 'Please log in.' }, { status: 401 });

/**
 * POST /api/publish-site
 * Asks Vercel to rebuild the website (Deploy Hook in PUBLISH_HOOK_URL). The
 * build pulls the latest dashboard content, so this is how a save becomes live.
 */
const publishSite: Endpoint = {
  path: '/publish-site',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!req.user) return unauthorised();
    const hook = process.env.PUBLISH_HOOK_URL?.trim();
    const status = { lastPublishedAt: new Date().toISOString(), lastPublishedBy: req.user.email, lastPublishStatus: '' };
    if (!hook) {
      status.lastPublishStatus = 'PUBLISH_HOOK_URL is not set, so the website could not be rebuilt automatically.';
      await req.payload.updateGlobal({ slug: 'site-status', data: status, overrideAccess: true }).catch(() => undefined);
      return Response.json({ ok: false, error: status.lastPublishStatus }, { status: 503 });
    }
    let ok = false;
    let detail = '';
    try {
      const res = await fetch(hook, { method: 'POST', cache: 'no-store' });
      ok = res.ok;
      detail = ok ? 'Rebuild started' : `Vercel responded ${res.status}`;
    } catch (e) {
      detail = `Could not reach Vercel: ${(e as Error).message}`;
    }
    status.lastPublishStatus = detail;
    await req.payload.updateGlobal({ slug: 'site-status', data: status, overrideAccess: true }).catch(() => undefined);
    return Response.json({ ok, detail }, { status: ok ? 200 : 502 });
  },
};

/**
 * POST /api/import-content?overwrite=1
 * Admin only. Loads the content files (pages, team, settings, articles, redirects) into the dashboard.
 */
const importFromFiles: Endpoint = {
  path: '/import-content',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!req.user) return unauthorised();
    if (req.user.role !== 'admin') return Response.json({ error: 'Admins only.' }, { status: 403 });
    const overwrite = req.searchParams?.get('overwrite') === '1';
    try {
      const report = await importContent(req.payload, { overwrite });
      return Response.json({ ok: true, overwrite, report });
    } catch (e) {
      req.payload.logger.error(e);
      return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
    }
  },
};

/** GET /api/site-status: for the dashboard panel. */
const siteStatus: Endpoint = {
  path: '/site-status',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    if (!req.user) return unauthorised();
    const s = await req.payload.findGlobal({ slug: 'site-status', overrideAccess: true }).catch(() => null);
    return Response.json({ ...(s || {}), hookConfigured: Boolean(process.env.PUBLISH_HOOK_URL), role: req.user.role });
  },
};

/** GET /api/enquiries-export.csv: every enquiry as a spreadsheet for the practice. */
const enquiriesCsv: Endpoint = {
  path: '/enquiries-export.csv',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    if (!req.user) return unauthorised();
    const { docs } = await req.payload.find({ collection: 'enquiries', limit: 5000, sort: '-createdAt', depth: 0, overrideAccess: true });
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Date', 'Form', 'Name', 'Email', 'Phone', 'Message', 'Page', 'Email status', 'Followed up', 'Notes', 'All fields'],
      ...docs.map((d: any) => [
        new Date(d.createdAt).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' }),
        d.form,
        d.name,
        d.email,
        d.phone,
        d.message,
        d.source,
        d.emailStatus,
        d.followedUp ? 'yes' : 'no',
        d.notes,
        Object.entries(d.raw || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n'),
      ]),
    ];
    const csv = '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="scofis-enquiries-${new Date().toISOString().slice(0, 10)}.csv"` } });
  },
};

export const endpoints: Endpoint[] = [publishSite, importFromFiles, siteStatus, enquiriesCsv];
