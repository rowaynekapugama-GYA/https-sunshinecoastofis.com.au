import Link from 'next/link';
import { db, requireUser } from '@/dashboard/lib/auth';
import { SeoDefaultsForm } from '@/dashboard/editors/SeoDefaultsForm';

function flag(len: number, ideal: number, max: number) {
  if (!len) return <span className="d-badge danger">Missing</span>;
  if (len > max) return <span className="d-badge danger">Too long ({len})</span>;
  if (len < ideal) return <span className="d-badge warn">Short ({len})</span>;
  return <span className="d-badge ok">Good ({len})</span>;
}

export default async function SeoOverview() {
  await requireUser();
  const payload = await db();
  const [{ docs }, defaults] = await Promise.all([
    payload.find({ collection: 'pages', limit: 200, depth: 0, sort: 'title', overrideAccess: true }),
    payload.findGlobal({ slug: 'seo-defaults', depth: 1, overrideAccess: true }),
  ]);
  return (
    <>
      <div className="d-page-head">
        <div>
          <h1>SEO</h1>
          <p>Each page's meta title and description, at a glance. Click a page to edit them with a live preview of how it may look in Google.</p>
        </div>
      </div>
      <div className="d-card tight">
        <table className="d-table">
          <thead>
            <tr>
              <th>Page</th>
              <th>Meta title</th>
              <th>Meta description</th>
              <th>Indexing</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((p: any) => (
              <tr key={p.id}>
                <td>
                  <Link className="title" href={`/admin/pages/${p.id}#seo`}>
                    {p.title}
                  </Link>
                  <div className="muted">{p.route}</div>
                </td>
                <td>
                  {flag((p.metaTitle || '').length, 30, 60)}
                  <div className="muted">{p.metaTitle}</div>
                </td>
                <td>
                  {flag((p.metaDescription || '').length, 70, 155)}
                  <div className="muted">{(p.metaDescription || '').slice(0, 90)}…</div>
                </td>
                <td>{p.noindex ? <span className="d-badge warn">Hidden</span> : <span className="d-badge ok">Indexed</span>}</td>
                <td style={{ textAlign: 'right' }}>
                  <Link className="d-btn sm" href={`/admin/pages/${p.id}#seo`}>
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="d-card" style={{ maxWidth: 820 }}>
        <h2>Site-wide defaults</h2>
        <SeoDefaultsForm initial={defaults} />
      </div>
    </>
  );
}
