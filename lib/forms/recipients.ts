/**
 * Who receives the website's form emails. Set here in the code, not in Vercel variables, so the
 * routing is the same on every deployment (FORM_TO, FORM_CC, FORM_BCC and NOTIFY_TO are no longer read).
 *
 * Website forms (/api/submit): Online doctor referral, Patient information form (medical history),
 * Contact us (online enquiry) and Feedback go to reception only. They are NOT sent to SmileOX.
 *
 * Google Ads landing pages (/api/lp-lead, /lp/dental-implants and /lp/wisdom-teeth): reception and
 * Rowayne by email, plus the SmileOX intake (lib/crm/intake.ts).
 */
export const RECEPTION = 'reception@sunshinecoastofis.com.au';
export const ROWAYNE = 'rowayne@gyaclients.com';

export const WEBSITE_FORM_RECIPIENTS: readonly string[] = [RECEPTION];
export const LANDING_PAGE_RECIPIENTS: readonly string[] = [RECEPTION, ROWAYNE];
