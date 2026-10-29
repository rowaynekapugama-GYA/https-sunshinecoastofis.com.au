import { notFound } from 'next/navigation';
import { db, requireUser } from '@/dashboard/lib/auth';
import { templateDefs } from '@/dashboard/lib/templates';
import { PageEditor } from '@/dashboard/editors/PageEditor';
import { SITE } from '@/lib/site';
import { siteBase } from '@/dashboard/lib/siteBase';

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const payload = await db();
  const doc = await payload.findByID({ collection: 'pages', id, depth: 1, overrideAccess: true, draft: true }).catch(() => null);
  if (!doc) notFound();
  const all = await payload.find({ collection: 'pages', limit: 200, depth: 0, overrideAccess: true, where: { kind: { equals: 'page' } } });
  const routes = all.docs.filter((p: any) => p.route && p.slug !== 'not-found').map((p: any) => ({ title: p.title, route: p.route })).sort((a, b) => a.route.localeCompare(b.route));
  return <PageEditor initial={doc} defs={templateDefs()} siteUrl={await siteBase()} siteName={SITE.name} isAdmin={user.role === 'admin'} routes={routes} />;
}
