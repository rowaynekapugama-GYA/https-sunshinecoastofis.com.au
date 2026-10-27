import { APIError, type CollectionConfig } from 'payload';
import { isAdmin, isAdminField, selfOrAdmin } from '../access';

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'User', plural: 'Users' },
  auth: {
    tokenExpiration: 60 * 60 * 24 * 7, // a week, so reception is not logged out mid-morning
    maxLoginAttempts: 8,
    lockTime: 10 * 60 * 1000,
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'role'],
    group: 'Admin',
    description: 'Who can log in. Editors change content; admins (GYA) also manage users.',
  },
  hooks: {
    /**
     * Accounts are only ever created by a signed-in admin (Users in the dashboard) or by GYA's scripts.
     * This closes Payload's public "create first user" screen on a live site with an empty users table.
     * To set up a brand-new site, add ALLOW_FIRST_USER=true in Vercel, create the account at /cms,
     * then delete the variable and redeploy.
     */
    beforeOperation: [
      ({ operation, req }) => {
        if (operation !== 'create' || req.user || req.payloadAPI === 'local') return;
        if (process.env.ALLOW_FIRST_USER === 'true') return;
        throw new APIError('New accounts can only be added by an admin, under Users in the dashboard.', 403);
      },
    ],
  },
  access: {
    read: selfOrAdmin,
    create: isAdmin,
    update: selfOrAdmin,
    delete: isAdmin,
    // /cms (Payload's own admin) is GYA only. Editors use the /admin dashboard.
    admin: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    { name: 'name', type: 'text', label: 'Name', required: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      options: [
        { label: 'Editor (practice team)', value: 'editor' },
        { label: 'Admin (GYA)', value: 'admin' },
      ],
      access: { update: isAdminField, create: isAdminField },
      saveToJWT: true,
    },
  ],
};
