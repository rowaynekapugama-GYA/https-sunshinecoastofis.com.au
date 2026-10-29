import { redirect } from 'next/navigation';
import { getUser } from '@/dashboard/lib/auth';
import { Shell } from '@/dashboard/ui/Shell';
import { SITE } from '@/lib/site';
import { siteBase } from '@/dashboard/lib/siteBase';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect('/admin/login');
  return (
    <Shell user={user} siteName={SITE.name} siteUrl={await siteBase()}>
      {children}
    </Shell>
  );
}
