import Link from 'next/link';
import { db, requireUser } from '@/dashboard/lib/auth';
import { PublishPanel } from '@/dashboard/ui/PublishPanel';
import { Icons } from '@/dashboard/ui/Icons';
import { SITE } from '@/lib/site';

const FORM_LABEL: Record<string, string> = { contact: 'Contact us', referral: 'Online doctor referral', 'patient-form': 'Patient information form', feedback: 'Feedback' };
const fmt = (iso: string) => new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default async function Dashboard() {
  const user = await requireUser();
  const payload = await db();
  const [home, enquiries, pages, posts] = await Promise.all([
    payload.find({ collection: 'pages', where: { slug: { equals: 'home' } }, limit: 1, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'enquiries', limit: 6, sort: '-createdAt', depth: 0, overrideAccess: true }),
    payload.find({ collection: 'pages', limit: 5, sort: '-updatedAt', depth: 0, overrideAccess: true }),
    payload.find({ collection: 'posts', limit: 1, depth: 0, overrideAccess: true }),
  ]);
  const hour = Number(new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', hour12: false }));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = (user.name || user.email).split(/[\s@]/)[0];
  const Pages = Icons.pages;
  const Posts = Icons.posts;
  const Media = Icons.media;
  const homeId = home.docs[0]?.id;
  return (
    <>
      <div className="d-welcome">
        <h1>
          {greeting}, {first}.
        </h1>
        <p>
          This is where you update the website for {SITE.name}. Edit a page, a post or your practice details, click Save, then click Publish website when you are ready for the
          changes to go live. Enquiries arrive here on their own.
        </p>
      </div>

      <PublishPanel showImport={user.role === 'admin'} />

      <div className="d-card">
        <h2>Quick actions</h2>
        <div className="d-quick">
          <Link href={homeId ? `/admin/pages/${homeId}` : '/admin/pages'}>
            <span className="ic">
              <Pages />
            </span>
            <span>
              <strong>Edit the homepage</strong>
              <small>Banner, surgeons, treatments and FAQs</small>
            </span>
          </Link>
          <Link href="/admin/posts/new">
            <span className="ic">
              <Posts />
            </span>
            <span>
              <strong>Write a blog post</strong>
              <small>{posts.totalDocs ? `${posts.totalDocs} article${posts.totalDocs === 1 ? '' : 's'} so far` : 'Your first article starts the blog'}</small>
            </span>
          </Link>
          <Link href="/admin/media">
            <span className="ic">
              <Media />
            </span>
            <span>
              <strong>Upload photos</strong>
              <small>Then choose them on any page</small>
            </span>
          </Link>
        </div>
      </div>

      <div className="d-grid-2">
        <div className="d-card tight">
          <div style={{ padding: '16px 20px 0' }}>
            <h2>Latest enquiries</h2>
          </div>
          {enquiries.docs.length ? (
            <table className="d-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {enquiries.docs.map((e: any) => (
                  <tr key={e.id}>
                    <td className="muted">{fmt(e.createdAt)}</td>
                    <td>
                      <Link className="title" href={`/admin/enquiries/${e.id}`}>
                        {e.name || e.email}
                      </Link>
                      <div className="muted">{FORM_LABEL[e.form] || 'Website form'}</div>
                    </td>
                    <td>{e.followedUp ? <span className="d-badge ok">Followed up</span> : <span className="d-badge warn">To follow up</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="d-empty">No enquiries yet. They appear here the moment someone sends a form on the website.</div>
          )}
          <div style={{ padding: '12px 20px' }}>
            <Link href="/admin/enquiries">All enquiries</Link>
          </div>
        </div>
        <div className="d-card tight">
          <div style={{ padding: '16px 20px 0' }}>
            <h2>Recently edited pages</h2>
          </div>
          <table className="d-table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {pages.docs.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <Link className="title" href={`/admin/pages/${p.id}`}>
                      {p.title}
                    </Link>
                    <div className="muted">{p.route}</div>
                  </td>
                  <td className="muted">{fmt(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 20px' }}>
            <Link href="/admin/pages">All pages</Link>
          </div>
        </div>
      </div>
    </>
  );
}
