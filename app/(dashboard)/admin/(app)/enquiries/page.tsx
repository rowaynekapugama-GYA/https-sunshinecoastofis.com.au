import Link from 'next/link';
import { db, requireUser } from '@/dashboard/lib/auth';

const FORM_LABEL: Record<string, string> = { contact: 'Contact us', referral: 'Online doctor referral', 'patient-form': 'Patient information form', feedback: 'Feedback' };
const fmt = (iso: string) => new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export default async function EnquiriesList({ searchParams }: { searchParams: Promise<{ page?: string; f?: string }> }) {
  await requireUser();
  const { page = '1', f = '' } = await searchParams;
  const payload = await db();
  const where = f === 'open' ? { followedUp: { equals: false } } : f === 'done' ? { followedUp: { equals: true } } : undefined;
  const r = await payload.find({ collection: 'enquiries', limit: 30, page: Number(page) || 1, sort: '-createdAt', depth: 0, where, overrideAccess: true });
  return (
    <>
      <div className="d-page-head">
        <div>
          <h1>Enquiries</h1>
          <p>Every message sent through the website forms, with the date, the page it came from and the details. Each one is also emailed to reception.</p>
        </div>
        <div className="d-actions">
          <a className="d-btn" href="/api/enquiries-export.csv">
            Export to CSV (Excel)
          </a>
        </div>
      </div>
      <div className="d-tabs">
        <Link href="/admin/enquiries" className={`d-btn ghost sm ${!f ? 'active' : ''}`} style={{ fontWeight: !f ? 700 : 500 }}>
          All
        </Link>
        <Link href="/admin/enquiries?f=open" className="d-btn ghost sm" style={{ fontWeight: f === 'open' ? 700 : 500 }}>
          To follow up
        </Link>
        <Link href="/admin/enquiries?f=done" className="d-btn ghost sm" style={{ fontWeight: f === 'done' ? 700 : 500 }}>
          Followed up
        </Link>
      </div>
      <div className="d-card tight">
        {r.docs.length ? (
          <table className="d-table">
            <thead>
              <tr>
                <th>Received</th>
                <th>Name</th>
                <th>Contact</th>
                <th>From</th>
                <th>Email sent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {r.docs.map((e: any) => (
                <tr key={e.id}>
                  <td className="muted">{fmt(e.createdAt)}</td>
                  <td>
                    <Link className="title" href={`/admin/enquiries/${e.id}`}>
                      {e.name || '(no name)'}
                    </Link>
                    <div className="muted">{(e.message || '').slice(0, 70)}</div>
                  </td>
                  <td>
                    <div>{e.email}</div>
                    <div className="muted">{e.phone}</div>
                  </td>
                  <td className="muted">{FORM_LABEL[e.form] || 'Website form'}</td>
                  <td>{e.emailStatus === 'sent' ? <span className="d-badge ok">Sent</span> : e.emailStatus === 'failed' ? <span className="d-badge danger">Failed</span> : <span className="d-badge">Not set up</span>}</td>
                  <td>{e.followedUp ? <span className="d-badge ok">Followed up</span> : <span className="d-badge warn">To follow up</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="d-empty">No enquiries {f ? 'in this list' : 'yet'}.</div>
        )}
      </div>
      {r.totalPages > 1 && (
        <div className="d-actions">
          {r.hasPrevPage && (
            <Link className="d-btn sm" href={`/admin/enquiries?page=${r.page! - 1}${f ? `&f=${f}` : ''}`}>
              Previous
            </Link>
          )}
          <span className="d-help">
            Page {r.page} of {r.totalPages}
          </span>
          {r.hasNextPage && (
            <Link className="d-btn sm" href={`/admin/enquiries?page=${r.page! + 1}${f ? `&f=${f}` : ''}`}>
              Next
            </Link>
          )}
        </div>
      )}
    </>
  );
}
