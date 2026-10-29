import Link from 'next/link';
import { db, requireUser } from '@/dashboard/lib/auth';
import { siteBase } from '@/dashboard/lib/siteBase';

const fmt = (iso: string) => new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
/** Website order: home, about, services, the service pages, then the rest. */
const rank = (p: any) => (p.kind === 'site' ? 99 : p.route === '/' ? 0 : p.route === '/about/' ? 1 : p.route === '/services/' ? 2 : p.route?.startsWith('/services/') ? 3 : p.slug === 'not-found' ? 90 : 10);

export default async function PagesList() {
  await requireUser();
  const payload = await db();
  const base = await siteBase();
  const { docs } = await payload.find({ collection: 'pages', limit: 200, depth: 0, sort: 'title', overrideAccess: true });
  const pages = [...docs].sort((a: any, b: any) => rank(a) - rank(b) || String(a.route).localeCompare(String(b.route)));
  return (
    <>
      <div className="d-page-head">
        <div>
          <h1>Pages</h1>
          <p>Every page on the website, plus the header, menu and footer shared by all of them. Open one to change its wording, photos and search settings. Changes go live after you Publish website.</p>
        </div>
      </div>
      <div className="d-card tight">
        <table className="d-table">
          <thead>
            <tr>
              <th>Page</th>
              <th>Sections</th>
              <th>Last edited</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p: any) => (
              <tr key={p.id}>
                <td>
                  <Link className="title" href={`/admin/pages/${p.id}`}>
                    {p.title}
                  </Link>
                  <div className="muted">{p.kind === 'site' ? 'Shown on every page' : p.slug === 'not-found' ? 'Shown when an address does not exist' : p.route}</div>
                </td>
                <td className="muted">{(p.sections || []).length}</td>
                <td className="muted">{fmt(p.updatedAt)}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <Link className="d-btn sm" href={`/admin/pages/${p.id}`}>
                    Edit
                  </Link>{' '}
                  {p.kind !== 'site' && p.slug !== 'not-found' && (
                    <a className="d-btn sm ghost" href={`${base}${p.route}`} target="_blank" rel="noopener">
                      View
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
