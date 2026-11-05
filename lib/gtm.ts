/**
 * Google Tag Manager: the one container for the whole website (installed 5 Nov 2026).
 *
 * The container ID comes from the Vercel environment variable NEXT_PUBLIC_GTM_ID and falls
 * back to GTM-TZ7DJSC2, so the live site keeps working if the variable is missing. This is
 * the only place the ID is read. The dashboard's old "Google Tag Manager container ID" field
 * is no longer used, so there can never be two containers on a page.
 *
 * Like the other analytics, GTM loads only on the live website: in a Vercel production build
 * (VERCEL_ENV=production) and, in the browser, only on sunshinecoastofis.com.au (or www).
 * Previews, the vercel.app address, local builds and the dashboard's page editor and
 * preview never load it, so testing and editing never reach the reports.
 * TRACKING_TEST=1 turns the production check on for local testing (never set it on Vercel).
 */
export const GTM_FALLBACK_ID = 'GTM-TZ7DJSC2';

export const trackingEnabled = () => process.env.VERCEL_ENV === 'production' || process.env.TRACKING_TEST === '1';
/** Browser-side check: the live domain only. */
export const LIVE_HOST_TEST = "/^(www\\.)?sunshinecoastofis\\.com\\.au$/.test(location.hostname)";
export const validGtm = (id?: string) => Boolean(id && /^GTM-[A-Z0-9]+$/i.test(id.trim()));

let warned = false;
/** The container ID: NEXT_PUBLIC_GTM_ID if it is a valid GTM-... ID, otherwise GTM-TZ7DJSC2. */
export function gtmId(): string {
  const env = (process.env.NEXT_PUBLIC_GTM_ID || '').trim();
  if (validGtm(env)) return env.toUpperCase();
  if (env && !warned) {
    warned = true;
    console.warn(`[gtm] NEXT_PUBLIC_GTM_ID "${env}" is not a GTM-... ID; using ${GTM_FALLBACK_ID}`);
  }
  return GTM_FALLBACK_ID;
}

/** Google's official head snippet (unchanged apart from the live-domain check), placed near the top of <head>. */
export function gtmHead(): string {
  if (!trackingEnabled()) return '';
  return [
    '<!-- Google Tag Manager -->',
    `<script>if(${LIVE_HOST_TEST}){(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':`,
    "new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],",
    "j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=",
    "'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);",
    `})(window,document,'script','dataLayer','${gtmId()}');}</script>`,
    '<!-- End Google Tag Manager -->',
  ].join('\n');
}

/** Google's official noscript fallback, placed immediately after <body>. */
export function gtmBody(): string {
  if (!trackingEnabled()) return '';
  return [
    '<!-- Google Tag Manager (noscript) -->',
    `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId()}"`,
    'height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>',
    '<!-- End Google Tag Manager (noscript) -->',
  ].join('\n');
}
