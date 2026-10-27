import type { CollectionConfig } from 'payload';
import { anyone, isLoggedIn } from '../access';
import { markChanged } from '../hooks/markChanged';

/**
 * Old link fixes. Written to content/redirects.json at build time and applied
 * by next.config.mjs, so they take effect on the next publish.
 */
export const Redirects: CollectionConfig = {
  slug: 'redirects',
  labels: { singular: 'Redirect', plural: 'Redirects' },
  admin: {
    useAsTitle: 'from',
    defaultColumns: ['from', 'to', 'type'],
    group: 'Admin',
    description: 'Send an old address to a new one. Takes effect after the website is republished.',
  },
  access: { read: anyone, create: isLoggedIn, update: isLoggedIn, delete: isLoggedIn },
  hooks: { afterChange: [markChanged], afterDelete: [markChanged] },
  fields: [
    {
      name: 'from',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'The old path on this site, for example /old-page/' },
      validate: (v: unknown) => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('/api') && !v.startsWith('/admin')) || 'Must start with / and not be /api or /admin',
    },
    { name: 'to', type: 'text', required: true, admin: { description: 'Where to send visitors: a path such as /services/ or a full https:// address.' } },
    {
      name: 'type',
      type: 'select',
      defaultValue: '301',
      options: [
        { label: '301 permanent (usual)', value: '301' },
        { label: '302 temporary', value: '302' },
      ],
    },
    { name: 'note', type: 'text' },
  ],
};
