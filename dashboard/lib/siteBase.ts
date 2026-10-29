import { headers } from 'next/headers';
import { SITE } from '@/lib/site';

/**
 * The website address the dashboard's "View" links open: the copy of the site this
 * dashboard belongs to, so testing on staging never sends anyone to the live site.
 *
 *   dashboard opened on sunshinecoastofis.com.au (or www)  -> https://sunshinecoastofis.com.au
 *   a Vercel preview (the cms staging branch)              -> the branch's stable address
 *                                                             (always its newest build)
 *   anything else (the vercel.app production address,
 *   localhost)                                             -> that same address
 *
 * Google previews in the SEO panels always show the live domain; only the links change.
 */
export async function siteBase(): Promise<string> {
  const h = await headers();
  const host = (h.get('x-forwarded-host') || h.get('host') || '').split(',')[0].trim().toLowerCase();
  const live = new URL(SITE.domain).host;
  if (!host || host === live || host === `www.${live}`) return SITE.domain;
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_BRANCH_URL) return `https://${process.env.VERCEL_BRANCH_URL}`;
  const proto = (h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')).split(',')[0].trim();
  return `${proto}://${host}`;
}
