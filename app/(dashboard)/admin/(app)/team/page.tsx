import { db, requireUser } from '@/dashboard/lib/auth';
import { TeamManager } from '@/dashboard/editors/TeamManager';

export default async function TeamPage() {
  await requireUser();
  const payload = await db();
  const { docs } = await payload.find({ collection: 'team', limit: 100, depth: 1, sort: 'order', overrideAccess: true });
  return (
    <>
      <div className="d-page-head">
        <div>
          <h1>Team</h1>
          <p>The surgeons and the practice team shown on Our practice. Drag to change the order, hide someone who is away, add a new team member, or update a photo or bio. Save, then Publish website.</p>
        </div>
      </div>
      <TeamManager initial={docs as any[]} />
    </>
  );
}
