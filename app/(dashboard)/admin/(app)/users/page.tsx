import { notFound } from 'next/navigation';
import { db, requireUser } from '@/dashboard/lib/auth';
import { UsersManager } from '@/dashboard/editors/UsersManager';

export default async function UsersPage() {
  const user = await requireUser();
  if (user.role !== 'admin') notFound();
  const payload = await db();
  const { docs } = await payload.find({ collection: 'users', limit: 100, depth: 0, sort: 'name', overrideAccess: true });
  return (
    <>
      <div className="d-page-head">
        <div>
          <h1>Users</h1>
          <p>Who can sign in to this dashboard. Editors (the practice) can change everything except users and redirects. Admins (GYA) can do everything. Admin only.</p>
        </div>
      </div>
      <UsersManager initial={docs.map((u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role }))} me={String(user.id)} />
    </>
  );
}
