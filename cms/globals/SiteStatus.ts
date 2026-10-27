import type { GlobalConfig } from 'payload';
import { isLoggedIn } from '../access';

/** Hidden bookkeeping for the dashboard's publish panel. */
export const SiteStatus: GlobalConfig = {
  slug: 'site-status',
  label: 'Site status',
  admin: { hidden: true },
  access: { read: isLoggedIn, update: isLoggedIn },
  fields: [
    { name: 'lastChangedAt', type: 'date' },
    { name: 'lastPublishedAt', type: 'date' },
    { name: 'lastPublishedBy', type: 'text' },
    { name: 'lastPublishStatus', type: 'text' },
    { name: 'lastImportAt', type: 'date' },
  ],
};
