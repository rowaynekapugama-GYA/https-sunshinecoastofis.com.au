/**
 * Sunshine Coast Oral, Facial & Implant Specialists client dashboard (Payload CMS at /admin).
 *
 * How it fits the site: the public pages are still built statically from the
 * JSON files in /content. Before every build,
 * scripts/pull-content.ts copies the latest published dashboard content into
 * those files, so the templates render exactly as before and the site never
 * depends on the database at request time. "Publish website" on the dashboard
 * triggers that build through a Vercel deploy hook (PUBLISH_HOOK_URL).
 *
 * Environment (see README-CMS.md):
 *   DATABASE_URL           Neon Postgres connection string
 *   PAYLOAD_SECRET         long random string, signs sessions
 *   BLOB_READ_WRITE_TOKEN  Vercel Blob store token (media uploads)
 *   PUBLISH_HOOK_URL       Vercel deploy hook for the production branch
 *   NEXT_PUBLIC_SERVER_URL https://sunshinecoastofis.com.au
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob';
import sharp from 'sharp';

import { Users } from './cms/collections/Users';
import { Media } from './cms/collections/Media';
import { Pages } from './cms/collections/Pages';
import { Team } from './cms/collections/Team';
import { Categories, Posts } from './cms/collections/Posts';
import { Enquiries } from './cms/collections/Enquiries';
import { Redirects } from './cms/collections/Redirects';
import { SiteSettings } from './cms/globals/SiteSettings';
import { SeoDefaults } from './cms/globals/SeoDefaults';
import { SiteStatus } from './cms/globals/SiteStatus';
import { endpoints } from './cms/endpoints';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

/**
 * Where Payload builds absolute URLs to. On a Vercel preview (the `cms` staging
 * branch) this is left empty so /cms and the API use relative URLs and work on
 * whichever preview address is open. Otherwise NEXT_PUBLIC_SERVER_URL (the live
 * domain) would send the preview's logins and saves to the live site instead.
 */
const isPreview = process.env.VERCEL_ENV === 'preview';
const serverURL = isPreview
  ? ''
  : process.env.NEXT_PUBLIC_SERVER_URL?.replace(/\/$/, '') ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000';

/** Every host the dashboard may be opened on. Requests from other origins are treated as logged out. */
const trustedOrigins = Array.from(
  new Set(
    [
      serverURL,
      process.env.NEXT_PUBLIC_SERVER_URL?.replace(/\/$/, '') || '',
      'https://sunshinecoastofis.com.au',
      'https://www.sunshinecoastofis.com.au',
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
      process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : '',
      process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '',
      'http://localhost:3000',
    ].filter(Boolean),
  ),
);

const secret = process.env.PAYLOAD_SECRET;
if (!secret && process.env.NODE_ENV === 'production' && !process.env.PAYLOAD_ALLOW_INSECURE) {
  throw new Error('PAYLOAD_SECRET is not set. Add it in Vercel > Settings > Environment Variables (any long random string), then redeploy.');
}

export default buildConfig({
  serverURL,
  /**
   * Payload's own admin lives at /cms and is for GYA only. The practice uses the
   * custom dashboard at /admin (app/(dashboard)), which talks to the same REST API.
   */
  routes: { admin: '/cms' },
  cors: trustedOrigins,
  csrf: trustedOrigins,
  secret: secret || 'local-development-only-secret',
  admin: {
    user: Users.slug,
    meta: { titleSuffix: ' · SCOFIS (GYA CMS)' },
    importMap: { baseDir: dirname },
    components: {
      beforeDashboard: ['/cms/components/PublishPanel#PublishPanel'],
      graphics: { Logo: '/cms/components/Branding#Logo', Icon: '/cms/components/Branding#Icon' },
    },
    dateFormat: 'd MMM yyyy h:mm a',
    avatar: 'default',
  },
  collections: [Pages, Media, Team, Posts, Categories, Enquiries, Redirects, Users],
  globals: [SiteSettings, SeoDefaults, SiteStatus],
  endpoints,
  editor: lexicalEditor(),
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/scofis' },
    migrationDir: path.resolve(dirname, 'migrations'),
    // Schema changes go through committed migrations (npm run migrate:create, then
    // npm run migrate) in every environment, so local, preview and production
    // databases are always built the same way. scripts/build.mjs runs migrate
    // before each build.
    push: false,
  }),
  plugins: [
    vercelBlobStorage({
      enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      collections: { media: true },
      token: process.env.BLOB_READ_WRITE_TOKEN || '',
      clientUploads: true, // upload straight from the browser, so large photos are not limited by the 4.5MB function body cap
    }),
  ],
  sharp,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  graphQL: { disable: true },
  telemetry: false,
  upload: { limits: { fileSize: 25 * 1024 * 1024 } },
});
