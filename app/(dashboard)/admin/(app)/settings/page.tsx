import { db, requireUser } from '@/dashboard/lib/auth';
import { SettingsForm } from '@/dashboard/editors/SettingsForm';

export default async function SettingsPage() {
  const user = await requireUser();
  const payload = await db();
  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 1, overrideAccess: false, user: user as any });
  return (
    <>
      <div className="d-page-head">
        <div>
          <h1>Site Settings</h1>
          <p>Practice details used across the whole website: the phone number, the practice and hospital locations, links, logo and brand colours. Save, then Publish website.</p>
        </div>
      </div>
      <SettingsForm initial={settings} isAdmin={user.role === 'admin'} />
    </>
  );
}
