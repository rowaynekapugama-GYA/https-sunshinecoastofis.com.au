/**
 * POST /api/lp-lead: the enquiry form on the Google Ads landing pages (/lp/dental-implants and
 * /lp/wisdom-teeth). Rowayne's landing page handler (api/lead.js), moved into this site as a
 * Next.js route so it does not clash with the site's own /api/lead.
 *
 * Receives the form as JSON, validates it, normalises the phone number to +61 E.164, drops empty
 * fields, keeps gclid and utm_* from the landing page address, and emails the lead to SmileOX as
 * JSON over TLS. Sending goes through lib/crm/intake.ts, the same path as the site's own forms:
 * one set of environment variables, SMTP when SMTP_HOST/SMTP_USER/SMTP_PASS are set (TLS required),
 * otherwise the site's SMTP2GO account, with up to 3 retries on temporary errors.
 *
 * Environment (shared with the rest of the site):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS     optional SMTP server
 *   MAIL_FROM (or SMTP_FROM)                        sender over SMTP
 *   LEAD_INTAKE (or CRM_INTAKE_EMAIL)               optional override of the SmileOX intake address
 * Email copy: a plain-English copy to reception and Rowayne (lib/forms/recipients.ts,
 * LANDING_PAGE_RECIPIENTS). NOTIFY_TO is no longer read.
 *
 * Only these two pages create SmileOX leads: pageType must be dental-implants or wisdom-teeth,
 * and lib/crm/intake.ts refuses any other form name (CRM_FORMS).
 *
 * Answers { ok: true } or { ok: false, message }: 400 invalid fields, 502 not sent.
 */
import { after } from 'next/server';
import { logEnquiry } from '@/lib/enquiries';
import { isEmail as validEmail, mailer, sendLeadToCrm, toE164AU, type Lead } from '@/lib/crm/intake';
import { LANDING_PAGE_RECIPIENTS } from '@/lib/forms/recipients';

/** The landing pages, by the data-page value each one sends as pageType. */
const LANDING_PAGES = new Set(['dental-implants', 'wisdom-teeth']);

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const json = (body: unknown, status = 200) => Response.json(body, { status });

/** Trim, collapse whitespace and cap length so nothing silly reaches the CRM. */
function clean(value: unknown, max = 500): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Australian numbers to +61 E.164; anything else kept as Rowayne's handler did. */
function normalisePhone(raw: unknown): string {
  const au = toE164AU(String(raw || ''));
  if (au) return au;
  const digits = String(raw || '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('61') && digits.length >= 11) return '+' + digits;
  if (digits.startsWith('0') && digits.length >= 9) return '+61' + digits.slice(1);
  return digits;
}

const FAILED = 'We could not send your enquiry just now. Please call us on (07) 5406 0586.';

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }

  // Honeypot. Real people never fill this in, bots almost always do.
  // Return a success shape so the bot does not learn anything, but send nothing.
  if (clean(body.company)) return json({ ok: true });

  const firstName = clean(body.firstName, 80);
  const lastName = clean(body.lastName, 80);
  const email = clean(body.email, 160).toLowerCase();
  const phoneNumber = normalisePhone(body.phoneNumber);

  if (!firstName || !lastName) return json({ ok: false, message: 'Please enter your first and last name.' }, 400);
  if (!validEmail(email)) return json({ ok: false, message: 'Please enter a valid email address.' }, 400);
  if (phoneNumber.replace(/\D/g, '').length < 8) return json({ ok: false, message: 'Please enter a valid contact number.' }, 400);
  const pageType = clean(body.pageType, 60);
  if (!LANDING_PAGES.has(pageType)) return json({ ok: false, message: FAILED }, 400);

  // The payload SmileOX stores. firstName / lastName / email / phoneNumber are the recognised
  // fields; everything else is kept as lead detail.
  const payload: Record<string, string> = {
    firstName,
    lastName,
    email,
    phoneNumber,
    enquiryType: clean(body.enquiryType, 120),
    hasReferral: clean(body.hasReferral, 20),
    anaesthetic: clean(body.anaesthetic, 120), // wisdom teeth form: preferred anaesthetic
    message: clean(body.message, 1500),
    source: 'Google Ads landing page',
    pageType,
    pageUrl: clean(body.pageUrl, 400),
    gclid: clean(body.gclid, 200),
    utmSource: clean(body.utm_source, 120),
    utmMedium: clean(body.utm_medium, 120),
    utmCampaign: clean(body.utm_campaign, 160),
    utmTerm: clean(body.utm_term, 160),
    utmContent: clean(body.utm_content, 160),
    submittedAt: new Date().toISOString(),
  };
  // Drop empty keys so the CRM record stays tidy.
  for (const k of Object.keys(payload)) if (payload[k] === '') delete payload[k];

  const formName = `lp-${pageType}`; // lp-dental-implants or lp-wisdom-teeth
  const result = await sendLeadToCrm(payload as Lead, formName);
  if (result.status !== 'sent') return json({ ok: false, message: FAILED }, 502);

  // After the answer: the email copy for reception and Rowayne, and a record in the dashboard's Enquiries.
  after(async () => {
    await notifyReception(payload).catch((e) => console.error(`[lp-lead] ${formName}: email copy failed: ${(e as Error).message}`));
    await logEnquiry({
      form: 'contact',
      name: `${firstName} ${lastName}`,
      email,
      phone: phoneNumber,
      message: [`Google Ads landing page (${payload.pageType || 'landing'})`, payload.enquiryType, payload.anaesthetic ? `Anaesthetic: ${payload.anaesthetic}` : '', payload.message].filter(Boolean).join('. '),
      source: payload.pageUrl || '',
      raw: payload,
      emailStatus: 'sent',
    }).catch(() => undefined);
  });

  return json({ ok: true });
}

export function GET() {
  return new Response(JSON.stringify({ ok: false, message: 'Method not allowed' }), { status: 405, headers: { Allow: 'POST', 'Content-Type': 'application/json' } });
}

/** Plain-English copy to reception and Rowayne (LANDING_PAGE_RECIPIENTS) so they see it straight away. */
async function notifyReception(p: Record<string, string>) {
  const to = LANDING_PAGE_RECIPIENTS.join(', ');
  const m = mailer();
  if (!m) throw new Error('no email provider set (SMTP2GO_API_KEY or SMTP)');
  const lines = [
    `New enquiry from the ${p.pageType || 'landing'} page`,
    '',
    `Name:        ${p.firstName} ${p.lastName}`,
    `Phone:       ${p.phoneNumber}`,
    `Email:       ${p.email}`,
    p.enquiryType ? `About:       ${p.enquiryType}` : null,
    p.anaesthetic ? `Anaesthetic: ${p.anaesthetic}` : null,
    p.hasReferral ? `Referral:    ${p.hasReferral}` : null,
    p.message ? `\nMessage:\n${p.message}` : null,
    '',
    p.gclid ? `Google click ID: ${p.gclid}` : null,
    p.utmCampaign ? `Campaign: ${p.utmCampaign}` : null,
    `Page: ${p.pageUrl || ''}`,
  ].filter((l) => l !== null);
  const subject = `Website enquiry: ${p.firstName} ${p.lastName}${p.enquiryType ? ` (${p.enquiryType})` : ''}`;
  await m.send({ to, subject, text: lines.join('\n'), replyTo: p.email });
}
