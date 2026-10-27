import type { Access, FieldAccess } from 'payload';

/**
 * Two roles.
 *   admin  – GYA. Manages users, can import content and change anything.
 *   editor – the practice. Edits content, settings, posts, media; sees enquiries.
 * Anyone not logged in can read published content (the build reads it too).
 */
export type Role = 'admin' | 'editor';

export const isAdmin: Access = ({ req }) => req.user?.role === 'admin';
export const isLoggedIn: Access = ({ req }) => Boolean(req.user);
export const anyone: Access = () => true;

/** Published docs for the public and the build, everything for logged-in users. */
export const publishedOrLoggedIn: Access = ({ req }) => {
  if (req.user) return true;
  return { _status: { equals: 'published' } };
};

export const isAdminField: FieldAccess = ({ req }) => req.user?.role === 'admin';

/** Users may edit their own account; admins may edit anyone. */
export const selfOrAdmin: Access = ({ req }) => {
  if (!req.user) return false;
  if (req.user.role === 'admin') return true;
  return { id: { equals: req.user.id } };
};
