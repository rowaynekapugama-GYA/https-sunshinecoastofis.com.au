import type { CollectionConfig, Field } from 'payload';
import { anyone, isLoggedIn } from '../access';
import { markChanged } from '../hooks/markChanged';

const list = (name: string, label: string, singular: string, rows = 2): Field => ({
  name,
  type: 'array',
  label,
  labels: { singular, plural: `${singular}s` },
  fields: [{ name: 'value', type: 'textarea', label: singular, required: true, admin: { rows } }],
});

/**
 * The surgeons and the practice team. Drives the surgeons' bios and the team photos on
 * Our practice, and the surgeons' Person schema. Names, titles and qualifications come
 * from the practice; they are never guessed.
 */
export const Team: CollectionConfig = {
  slug: 'team',
  labels: { singular: 'Team member', plural: 'Team' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'kind', 'role', 'order', 'hidden'], group: 'Content' },
  access: { read: anyone, create: isLoggedIn, update: isLoggedIn, delete: isLoggedIn },
  hooks: { afterChange: [markChanged], afterDelete: [markChanged] },
  defaultSort: 'order',
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'staff',
      options: [
        { label: 'Surgeon (full bio)', value: 'surgeon' },
        { label: 'Practice team (photo card)', value: 'staff' },
      ],
    },
    { name: 'name', type: 'text', required: true, admin: { description: 'As shown on the website, for example Dr Trent Lincoln or Taryn.' } },
    { name: 'role', type: 'text', label: 'Role', admin: { description: 'Team cards: for example Practice Manager.', condition: (d) => d?.kind !== 'surgeon' } },
    { name: 'photo', type: 'upload', relationTo: 'media', label: 'Photo', admin: { description: 'Leave empty to keep the photo built into the site.' } },
    { name: 'photoPath', type: 'text', label: 'Built-in photo', admin: { readOnly: true } },
    { name: 'photoWebp', type: 'text', label: 'Built-in photo (WebP)', admin: { readOnly: true } },
    { name: 'width', type: 'number', admin: { readOnly: true } },
    { name: 'height', type: 'number', admin: { readOnly: true } },
    { name: 'photoTop', type: 'checkbox', label: 'Line the photo up from the top', defaultValue: false, admin: { description: 'For photos with more space above the head.' } },
    { name: 'photoAlt', type: 'text', label: 'Photo alt text', admin: { condition: (d) => d?.kind === 'surgeon' } },
    { name: 'hidden', type: 'checkbox', label: 'Hide from the website', defaultValue: false },
    { name: 'order', type: 'number', label: 'Order', defaultValue: 1 },
    { name: 'key', type: 'text', label: 'Key (developer)', admin: { readOnly: true, description: 'Surgeons: the page anchor, for example trent (/about/#trent).' } },
    {
      type: 'collapsible',
      label: 'Surgeon bio',
      admin: { condition: (d) => d?.kind === 'surgeon' },
      fields: [
        { name: 'roleLine', type: 'textarea', label: 'Role and qualifications line', admin: { rows: 2 } },
        { name: 'lede', type: 'textarea', label: 'Introduction', admin: { rows: 4 } },
        list('tags', 'Areas of focus (tags)', 'Tag', 1),
        { name: 'facts', type: 'array', label: 'Three key facts', fields: [{ name: 'title', type: 'text', required: true }, { name: 'text', type: 'textarea', admin: { rows: 2 } }] },
        {
          name: 'columns',
          type: 'array',
          label: 'Columns (Training, Research, Beyond the clinic)',
          fields: [{ name: 'heading', type: 'text', required: true }, list('items', 'Points', 'Point'), { name: 'paragraph', type: 'textarea', label: 'Or a paragraph instead of points', admin: { rows: 3 } }],
        },
        { name: 'storyLabel', type: 'text', label: 'Full story button wording' },
        list('story', 'Full story paragraphs', 'Paragraph', 5),
        list('credentials', 'Qualifications for search engines (optional)', 'Qualification', 1),
        list('knowsAbout', 'Areas of practice for search engines (optional)', 'Area', 1),
        { name: 'sameAs', type: 'text', label: 'Public profile link (optional)' },
        { name: 'ahpra', type: 'text', label: 'AHPRA registration number (optional)' },
      ],
    },
  ],
};
