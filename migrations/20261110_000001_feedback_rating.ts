/**
 * Content update, 10 Nov 2026 (version 3.7.0): /feedback/ star rating restored.
 *
 * The page's wording for the new star-rating flow (heading, intro, the rating question, the
 * low-rating message and the 5-star thank-you) and "hide from search engines" are applied to the
 * dashboard here, once, during the next build. Data only, no table changes. See cms/contentPatch.ts.
 * Wording the practice has edited in the dashboard since is left as it is.
 *
 * Patch: migrations/data/20261110-feedback-rating.json (made by _tools/content-updates/make-patch.py).
 */
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres';
import { applyContentPatch } from '../cms/contentPatch';

export async function up(args: MigrateUpArgs): Promise<void> {
  await applyContentPatch(args, 'migrations/data/20261110-feedback-rating.json', '[content 3.7.0]');
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Content changes are not reversed automatically: restore an earlier page version in the dashboard instead.
  payload.logger.info('[content 3.7.0] down: nothing to do (use page version history in the dashboard).');
}
