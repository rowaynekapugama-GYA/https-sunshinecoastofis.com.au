import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getPayload } from 'payload';
import config from '@payload-config';

export type DashboardUser = { id: number | string; email: string; name?: string | null; role: 'admin' | 'editor' };

/** The logged-in dashboard user from the Payload session cookie, or null. Server components only. */
export async function getUser(): Promise<DashboardUser | null> {
  try {
    const payload = await getPayload({ config });
    const { user } = await payload.auth({ headers: await headers() });
    if (!user) return null;
    return { id: user.id, email: user.email, name: (user as any).name, role: (user as any).role === 'admin' ? 'admin' : 'editor' };
  } catch {
    return null;
  }
}

export async function db() {
  return getPayload({ config });
}

/** For pages: the user, or a redirect to the login screen (pages render in parallel with the layout guard). */
export async function requireUser(): Promise<DashboardUser> {
  const user = await getUser();
  if (!user) redirect('/admin/login');
  return user;
}
