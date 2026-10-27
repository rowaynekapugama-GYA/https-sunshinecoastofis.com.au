import { notFound } from 'next/navigation';
import { db, requireUser } from '@/dashboard/lib/auth';
import { RedirectsManager } from '@/dashboard/editors/RedirectsManager';

export default async function RedirectsPage() {
  const user = await requireUser();
  if (user.role !== 'admin') notFound();
  const payload = await db();
  const { docs } = await payload.find({ collection: 'redirects', limit: 500, depth: 0, sort: 'from', overrideAccess: true });
  return (
    <>
      <div className="d-page-head">
        <div>
          <h1>Redirects</h1>
          <p>Send an old address to a new one. Takes effect after Publish website. Admin only.</p>
        </div>
      </div>
      <RedirectsManager initial={docs as any[]} />
    </>
  );
}
