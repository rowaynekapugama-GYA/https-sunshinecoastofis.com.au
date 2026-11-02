/**
 * Content update, 2 Nov 2026 (version 3.2.1): Blog link in the main menu.
 *
 * The site is built from the dashboard, so the menu changes made in content/ (by
 * _tools/content-updates/2026-11-02-blog-menu.py) are applied to the dashboard here,
 * once, during the next build. Data only, no table changes. See cms/contentPatch.ts.
 *
 * Patch: migrations/data/20261102-blog-menu.json (made by _tools/content-updates/make-patch.py).
 */
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres';
import { applyContentPatch } from '../cms/contentPatch';

export async function up(args: MigrateUpArgs): Promise<void> {
  await applyContentPatch(args, 'migrations/data/20261102-blog-menu.json', '[content 3.2.1]');
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Content changes are not reversed automatically: restore an earlier page version in the dashboard instead.
  payload.logger.info('[content 3.2.1] down: nothing to do (use page version history in the dashboard).');
}
