import type { GlobalConfig } from 'payload';
import { anyone, isLoggedIn } from '../access';
import { markChanged } from '../hooks/markChanged';

export const SeoDefaults: GlobalConfig = {
  slug: 'seo-defaults',
  label: 'SEO defaults',
  admin: { group: 'Settings', description: 'Fallbacks used when a page has no share image of its own.' },
  access: { read: anyone, update: isLoggedIn },
  hooks: { afterChange: [markChanged] },
  fields: [
    {
      name: 'ogImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Default share image',
      admin: { description: '1200 x 630. Leave empty to keep the share card built from the logo.' },
    },
    { name: 'defaultDescription', type: 'textarea', label: 'Default meta description', admin: { rows: 2, description: 'Used only for pages without their own.' } },
  ],
};
