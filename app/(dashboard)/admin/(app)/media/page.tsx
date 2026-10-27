import { requireUser } from '@/dashboard/lib/auth';
import { MediaLibrary } from '@/dashboard/editors/MediaLibrary';

export default async function MediaPage() {
  await requireUser();
  return (
    <>
      <div className="d-page-head">
        <div>
          <h1>Media Library</h1>
          <p>Every photo uploaded to the website. Upload from your computer here, then choose the photo on any page, team member or article. Photos are resized automatically, so a phone photo is fine.</p>
        </div>
      </div>
      <MediaLibrary />
    </>
  );
}
