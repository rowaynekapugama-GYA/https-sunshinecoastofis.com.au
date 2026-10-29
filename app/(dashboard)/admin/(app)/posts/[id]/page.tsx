import { notFound } from 'next/navigation';
import { db, requireUser } from '@/dashboard/lib/auth';
import { PostEditor } from '@/dashboard/editors/PostEditor';
import { SITE } from '@/lib/site';
import { siteBase } from '@/dashboard/lib/siteBase';

export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const payload = await db();
  const [doc, cats] = await Promise.all([
    payload.findByID({ collection: 'posts', id, depth: 1, draft: true, overrideAccess: true }).catch(() => null),
    payload.find({ collection: 'categories', limit: 100, depth: 0, sort: 'title', overrideAccess: true }),
  ]);
  if (!doc) notFound();
  const initial = { ...doc, publishedAt: doc.publishedAt ? String(doc.publishedAt).slice(0, 10) : '' };
  return <PostEditor initial={initial} categories={cats.docs.map((c: any) => ({ id: c.id, title: c.title }))} siteUrl={await siteBase()} siteName={SITE.name} />;
}
