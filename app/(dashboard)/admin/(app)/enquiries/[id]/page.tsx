import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db, requireUser } from '@/dashboard/lib/auth';
import { EnquiryActions } from '@/dashboard/editors/EnquiryActions';

const FORM_LABEL: Record<string, string> = { contact: 'Contact us', referral: 'Online doctor referral', 'patient-form': 'Patient information form', feedback: 'Feedback' };
/** form field name -> readable label: patient_first_name -> Patient first name */
const label = (k: string) => (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ');
const fmt = (iso: string) => new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export default async function EnquiryDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const payload = await db();
  const e: any = await payload.findByID({ collection: 'enquiries', id, depth: 0, overrideAccess: true }).catch(() => null);
  if (!e) notFound();
  const raw = (e.raw || {}) as Record<string, string>;
  return (
    <>
      <div className="d-page-head">
        <div>
          <Link href="/admin/enquiries" className="d-btn ghost sm" style={{ marginBottom: 8 }}>
            ← All enquiries
          </Link>
          <h1>{e.name || 'Enquiry'}</h1>
          <p>
            Received {fmt(e.createdAt)} via the {(FORM_LABEL[e.form] || 'website').toLowerCase()} form.
          </p>
        </div>
      </div>
      <div className="d-grid-2">
        <div className="d-card">
          <h2>Everything that was sent</h2>
          <dl className="d-kv">
            <dt>Name</dt>
            <dd>{e.name}</dd>
            <dt>Email</dt>
            <dd>{e.email ? <a href={`mailto:${e.email}`}>{e.email}</a> : 'Not given'}</dd>
            <dt>Phone</dt>
            <dd>{e.phone ? <a href={`tel:${e.phone}`}>{e.phone}</a> : 'Not given'}</dd>
            <dt>Message</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>{e.message || 'No message'}</dd>
            <dt>Page</dt>
            <dd>{e.source}</dd>
            <dt>Email notification</dt>
            <dd>
              {e.emailStatus === 'sent' ? 'Emailed to the practice' : e.emailStatus === 'failed' ? `Failed: ${e.emailError || 'unknown error'}` : 'Email not configured at the time'}
            </dd>
            {Object.entries(raw)
              .filter(([k, v]) => String(v ?? '').trim() !== '')
              .map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt>{label(k)}</dt>
                  <dd>{String(v)}</dd>
                </React.Fragment>
              ))}
          </dl>
        </div>
        <div className="d-card">
          <h2>Follow up</h2>
          <EnquiryActions id={e.id} followedUp={Boolean(e.followedUp)} notes={e.notes || ''} />
        </div>
      </div>
    </>
  );
}
