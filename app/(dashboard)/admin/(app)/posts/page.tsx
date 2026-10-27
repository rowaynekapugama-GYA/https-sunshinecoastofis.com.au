import Link from 'next/link';
import { db, requireUser } from '@/dashboard/lib/auth';
import { PostsTable } from '@/dashboard/editors/PostsTable';

export default async function PostsList() {
  await requireUser();
  const payload = await db();
  const { docs } = await payload.find({ collection: 'posts', limit: 200, depth: 0, sort: '-updatedAt', draft: true, overrideAccess: true });
  const rows = docs.filter((d: any) => d && d.id != null).map((d: any) => ({ id: d.id, title: d.title, slug: d.slug, status: d._status, publishedAt: d.publishedAt, updatedAt: d.updatedAt }));
  return (
    <>
      <div className="d-page-head">
        <div>
          <h1>Blog Posts</h1>
          <p>Articles for the Dental advice and news section. Publishing an article adds it to the blog, the sitemap and the footer link the next time the website is published.</p>
        </div>
        <div className="d-actions">
          <Link className="d-btn primary" href="/admin/posts/new">
            + Write a new article
          </Link>
        </div>
      </div>
      <PostsTable rows={rows} />
    </>
  );
}
