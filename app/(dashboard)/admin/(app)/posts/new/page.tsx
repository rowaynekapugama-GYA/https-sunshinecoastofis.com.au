import { db, requireUser } from '@/dashboard/lib/auth';
import { PostEditor } from '@/dashboard/editors/PostEditor';
import { SITE } from '@/lib/site';

export default async function NewPost() {
  await requireUser();
  const payload = await db();
  const cats = await payload.find({ collection: 'categories', limit: 100, depth: 0, sort: 'title', overrideAccess: true });
  return <PostEditor initial={null} categories={cats.docs.map((c: any) => ({ id: c.id, title: c.title }))} siteUrl={SITE.domain} siteName={SITE.name} />;
}
