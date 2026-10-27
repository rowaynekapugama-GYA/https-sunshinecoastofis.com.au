import type { GlobalConfig } from 'payload';
import { anyone, isAdminField, isLoggedIn } from '../access';
import { markChanged } from '../hooks/markChanged';

/**
 * Practice details used across the whole website. scripts/pull-content.ts writes this
 * global to content/site-settings.json before every build, and the pages read it from there.
 */
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site settings',
  admin: { group: 'Settings', description: 'Practice details used across the whole website. Save, then Publish website.' },
  access: { read: anyone, update: isLoggedIn },
  hooks: { afterChange: [markChanged] },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Practice',
          fields: [
            { name: 'name', type: 'text', label: 'Practice name', required: true },
            { name: 'shortName', type: 'text', label: 'Short name', admin: { description: 'For example SCOFIS.' } },
            {
              type: 'row',
              fields: [
                { name: 'phone', type: 'text', label: 'Phone (as shown)', required: true, admin: { description: 'For example (07) 5406 0586. Changes the number everywhere on the website.' } },
                { name: 'phoneTel', type: 'text', label: 'Phone for tap-to-call', required: true, admin: { description: 'Digits only, for example 0754060586.' } },
                { name: 'phoneIntl', type: 'text', label: 'Phone, international', admin: { description: 'For Google, for example +61754060586.' } },
              ],
            },
            { name: 'email', type: 'text', label: 'Public email (optional)', admin: { description: 'Not shown on the website at the moment.' } },
            {
              name: 'address',
              type: 'group',
              label: 'Main practice address (for Google)',
              fields: [
                { name: 'street', type: 'text', required: true },
                {
                  type: 'row',
                  fields: [
                    { name: 'suburb', type: 'text', required: true },
                    { name: 'state', type: 'text', required: true, defaultValue: 'QLD' },
                    { name: 'postcode', type: 'text', required: true },
                    { name: 'country', type: 'text', defaultValue: 'AU', admin: { hidden: true } },
                  ],
                },
              ],
            },
            {
              name: 'geo',
              type: 'group',
              label: 'Map pin',
              fields: [{ type: 'row', fields: [{ name: 'lat', type: 'number', label: 'Latitude' }, { name: 'lng', type: 'number', label: 'Longitude' }] }],
            },
            { name: 'mapsUrl', type: 'text', label: 'Google Maps link for the practice' },
            { name: 'googleReviewUrl', type: 'text', label: 'Google "Leave a review" link' },
            { name: 'googleReviewsUrl', type: 'text', label: 'Google reviews link' },
            { name: 'areaServed', type: 'array', label: 'Areas served (for Google)', fields: [{ name: 'value', type: 'text', required: true }] },
            { name: 'logo', type: 'upload', relationTo: 'media', label: 'Logo (optional)', admin: { description: 'Leave empty to keep the logo built into the site.' } },
            { name: 'defaultShareImage', type: 'upload', relationTo: 'media', label: 'Default share image (optional)', admin: { description: 'Used when a page has no share image of its own. 1200 x 630.' } },
            {
              name: 'colours',
              type: 'group',
              label: 'Brand colours',
              admin: { description: 'Leave empty to keep the colours the site was designed with.' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'navy', type: 'text', label: 'Main (navy)', admin: { placeholder: '#182650' } },
                    { name: 'cyan', type: 'text', label: 'Accent (cyan)', admin: { placeholder: '#1DB2DE' } },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Hours',
          fields: [
            {
              name: 'hours',
              type: 'array',
              label: 'Opening hours (for Google)',
              minRows: 7,
              maxRows: 7,
              admin: { description: 'Used in the practice listing Google reads. The hours shown in the page wording are edited on the page itself.' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'day', type: 'select', required: true, options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
                    { name: 'closed', type: 'checkbox', label: 'Closed', defaultValue: false },
                    { name: 'open', type: 'text', label: 'Opens (24h)', admin: { placeholder: '08:00' } },
                    { name: 'close', type: 'text', label: 'Closes (24h)', admin: { placeholder: '17:00' } },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Locations',
          fields: [
            {
              name: 'locations',
              type: 'array',
              label: 'Practice and hospital locations',
              admin: { description: 'The location cards on the home page and the Locations page, in this order. The first one is the main practice.' },
              fields: [
                { type: 'row', fields: [{ name: 'name', type: 'text', required: true }, { name: 'area', type: 'text', required: true, label: 'Area label' }] },
                { name: 'address', type: 'text', required: true },
                { name: 'note', type: 'textarea', label: 'Short note', admin: { rows: 2 } },
                { name: 'mapLink', type: 'text', label: 'Google Maps link (Get directions)', required: true },
                { name: 'mapQuery', type: 'text', label: 'Map search wording', admin: { description: 'What the small map on the Locations page searches for.' } },
                { name: 'mapEmbed', type: 'text', label: 'Map embed link (optional)', admin: { description: 'Google Maps > Share > Embed a map > the src address. Used instead of the search wording.' } },
                {
                  type: 'row',
                  fields: [
                    { name: 'pin', type: 'select', required: true, label: 'Map pin', options: [{ label: '1 Buderim', value: '1' }, { label: '2 Maroochydore', value: '2' }, { label: '3 Nambour', value: '3' }, { label: '4 Hervey Bay', value: '4' }] },
                    { name: 'main', type: 'checkbox', label: 'Main practice (highlighted card)', defaultValue: false },
                    { name: 'hidden', type: 'checkbox', label: 'Hide', defaultValue: false },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Tracking and links',
          fields: [
            {
              name: 'social',
              type: 'group',
              label: 'Social profiles',
              fields: [
                { name: 'facebook', type: 'text', label: 'Facebook page URL' },
                { name: 'instagram', type: 'text', label: 'Instagram URL' },
              ],
            },
            {
              name: 'tracking',
              type: 'group',
              label: 'Tracking (GYA)',
              access: { read: isAdminField, update: isAdminField },
              fields: [
                { name: 'ga4Id', type: 'text', label: 'Google Analytics 4 measurement ID', admin: { placeholder: 'G-XXXXXXXXXX' } },
                { name: 'gtmId', type: 'text', label: 'Google Tag Manager container ID', admin: { placeholder: 'GTM-XXXXXXX', description: 'Leave blank unless a container is set up.' } },
                { name: 'metaPixelId', type: 'text', label: 'Meta Pixel ID', admin: { description: 'Numbers only. Leave blank to not load the pixel.' } },
                { name: 'searchConsoleVerification', type: 'text', label: 'Google Search Console verification code', admin: { description: 'Only the content value of the google-site-verification meta tag.' } },
              ],
            },
          ],
        },
      ],
    },
  ],
};
