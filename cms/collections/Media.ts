import type { CollectionConfig } from 'payload';
import { anyone, isLoggedIn } from '../access';
import { markChanged } from '../hooks/markChanged';

/**
 * Photos and files. Stored in Vercel Blob in production (see payload.config.ts)
 * and on disk under /media locally. Every image is resized to at most 2400px
 * wide and converted to WebP on upload, so a phone photo never lands on the
 * site at 6MB. Alt text is required, not optional.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Photo', plural: 'Media library' },
  admin: {
    group: 'Content',
    defaultColumns: ['filename', 'alt', 'updatedAt'],
    description: 'Upload photos here, then choose them on a page. Keep alt text short and descriptive.',
  },
  access: { read: anyone, create: isLoggedIn, update: isLoggedIn, delete: isLoggedIn },
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*'],
    resizeOptions: { width: 2400, withoutEnlargement: true },
    formatOptions: { format: 'webp', options: { quality: 82 } },
    adminThumbnail: 'thumb',
    imageSizes: [{ name: 'thumb', width: 400, height: 300, position: 'centre' }],
  },
  hooks: { afterChange: [markChanged], afterDelete: [markChanged] },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'Alt text',
      required: true,
      admin: { description: 'What is in the photo, in a few words. Used by search engines and screen readers.' },
    },
  ],
};
