import type { CollectionConfig } from 'payload';
import { isAdminField, isLoggedIn, publishedOrLoggedIn } from '../access';
import { markChanged } from '../hooks/markChanged';

/**
 * Every page on the website, plus one "Header, menu and footer" record for the parts
 * shared by every page. A page is its sections in order; each section is one of the
 * approved section designs (content/templates/sections.json) with the wording, links
 * and photos the practice can change. The dashboard (/admin) edits these; the public
 * site is built from them (scripts/pull-content.ts) and never reads the database live.
 */
export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Page', plural: 'Pages' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'route', '_status', 'updatedAt'],
    group: 'Content',
    description: 'Edit pages in the website dashboard at /admin. Changes go live after Publish website.',
    listSearchableFields: ['title', 'slug', 'route'],
    pagination: { defaultLimit: 50 },
  },
  defaultSort: 'title',
  versions: { drafts: true, maxPerDoc: 30 },
  access: { read: publishedOrLoggedIn, create: isLoggedIn, update: isLoggedIn, delete: isLoggedIn },
  hooks: { afterChange: [markChanged], afterDelete: [markChanged] },
  fields: [
    { name: 'title', type: 'text', label: 'Page name (menus and breadcrumbs)', required: true },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            {
              name: 'sections',
              type: 'array',
              label: 'Sections',
              labels: { singular: 'Section', plural: 'Sections' },
              admin: { description: 'In page order. Edit them in the website dashboard, which shows each section with its own fields.' },
              fields: [
                { name: 'sectionId', type: 'text', required: true, admin: { readOnly: true } },
                { name: 'template', type: 'text', required: true, admin: { readOnly: true, description: 'Which approved section design this is.' } },
                { name: 'hidden', type: 'checkbox', label: 'Hide this section', defaultValue: false },
                { name: 'fields', type: 'json', label: 'Wording, links and photos' },
              ],
            },
          ],
        },
        {
          label: 'SEO',
          fields: [
            { name: 'metaTitle', type: 'text', label: 'Meta title', admin: { description: 'Shown in the browser tab and in Google. About 50 to 60 characters.' } },
            { name: 'metaDescription', type: 'textarea', label: 'Meta description', admin: { rows: 3, description: 'The summary Google shows under the title. About 120 to 155 characters.' } },
            { name: 'ogTitle', type: 'text', label: 'Share title (optional)', admin: { description: 'Shown when the page is shared on Facebook or in messages. Leave empty to use the meta title.' } },
            { name: 'ogDescription', type: 'textarea', label: 'Share description (optional)', admin: { rows: 2, description: 'Leave empty to use the meta description.' } },
            { name: 'ogImage', type: 'upload', relationTo: 'media', label: 'Share image (optional)', admin: { description: 'Shown when the page is shared on Facebook or in messages. 1200 x 630 works best.' } },
            { name: 'ogImagePath', type: 'text', label: 'Built-in share image', admin: { readOnly: true } },
            { name: 'noindex', type: 'checkbox', label: 'Hide this page from search engines', defaultValue: false },
            { name: 'canonical', type: 'text', label: 'Canonical URL (optional)', admin: { description: 'Leave empty: the page points to its own address on sunshinecoastofis.com.au.' } },
            { name: 'primaryKeyword', type: 'text', label: 'Primary keyword (reference only)', admin: { description: 'For the SEO team. Not shown on the page.' } },
          ],
        },
        {
          label: 'Settings',
          fields: [
            {
              name: 'kind',
              type: 'select',
              required: true,
              defaultValue: 'page',
              options: [
                { label: 'Page', value: 'page' },
                { label: 'Header, menu and footer', value: 'site' },
              ],
              access: { update: isAdminField },
            },
            { name: 'slug', type: 'text', required: true, unique: true, index: true, access: { update: isAdminField }, admin: { description: 'Developer setting.' } },
            {
              name: 'route',
              type: 'text',
              access: { update: isAdminField },
              admin: { description: 'The page address, for example /services/dental-implants/. Matches the old WordPress site, so it should never change without a redirect.' },
            },
            { name: 'pageId', type: 'text', access: { update: isAdminField }, admin: { description: 'Developer setting (menu highlight and page scripts).' } },
          ],
        },
      ],
    },
  ],
};
