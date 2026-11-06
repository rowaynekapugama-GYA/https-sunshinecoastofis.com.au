/**
 * POST /api/lead: send a lead straight to the SmileOX CRM, for forms other than the site's
 * four built-in forms (which post to /api/submit and reach the CRM from there), for example
 * future Google Ads landing pages on this domain.
 *
 * Accepts JSON or form data:
 *   firstName + lastName, or a single name / fullName (split into first and last name)  required
 *   email                                                                                required, valid
 *   phone or phoneNumber (Australian; sent as E.164, e.g. +61412345678)                  required, valid
 *   formName, pageUrl, utm_* and any other fields the form collects (sent as lead details)
 *   website  hidden honeypot field: leave empty
 *   started  the time the form was shown (Date.now() in the browser), used for the minimum fill time
 *
 * Answers { ok: true } or { ok: false, error, fields? }:
 *   400 invalid or missing fields, 502 the CRM could not be reached after retries.
 * Bots (honeypot filled, or sent in under 2.5 seconds) get { ok: true } and nothing is sent.
 * The clinic also gets the usual notification email and a dashboard record (after the answer).
 *
 * Do not send health information (Medicare numbers, medical history and similar) to this endpoint.
 */
import { after } from 'next/server';
import { logEnquiry } from '@/lib/enquiries';
import { brisbaneIso, cleanPageUrl, compact, isEmail, sendLeadToCrm, splitName, toE164AU, utmFrom, type Lead } from '@/lib/crm/intake';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MIN_FILL_MS = 2500;
const PHONE = '(07) 5406 0586';
const json = (body: unknown, status = 200) => Response.json(body, { status });
/** Fields handled here, or never accepted from a browser (status changes stay server side). */
const RESERVED = new Set(['website', 'started', 'form', 'name', 'fullName', 'firstName', 'lastName', 'email', 'phone', 'phoneNumber', 'formName', 'pageUrl', 'page', 'submittedAt', 'action', 'targetStatusId']);
const MAX_EXTRA_FIELDS = 25;
const MAX_VALUE = 2000;

export async function POST(req: Request) {
  // ---- read JSON or form data
  const input: Record<string, string> = {};
  try {
    const type = req.headers.get('content-type') || '';
    if (type.includes('application/json')) {
      const body = (await req.json()) as Record<string, unknown>;
      for (const [k, val] of Object.entries(body || {})) if (['string', 'number', 'boolean'].includes(typeof val)) input[k] = String(val);
    } else {
      const fd = await req.formData();
      for (const [k, val] of fd.entries()) if (typeof val === 'string') input[k] = k in input ? `${input[k]}, ${val}` : val;
    }
  } catch {
    return json({ ok: false, error: 'Could not read the form' }, 400);
  }

  // ---- spam: honeypot and minimum fill time (bots get a quiet "ok")
  const started = Number(input.started);
  if (!input.started) return json({ ok: false, error: 'Missing form start time (started)' }, 400);
  if ((input.website || '').trim() || !Number.isFinite(started) || Date.now() - started < MIN_FILL_MS) return json({ ok: true });

  // ---- validate
  const named = input.firstName || input.lastName ? { firstName: input.firstName || '', lastName: input.lastName || '' } : splitName(input.fullName || input.name || '');
  const email = (input.email || '').trim();
  const phoneRaw = input.phoneNumber || input.phone || '';
  const phoneNumber = toE164AU(phoneRaw);
  const errors: Record<string, string> = {};
  if (!named.firstName.trim()) errors.name = 'Please enter your name.';
  if (!email) errors.email = 'Please enter your email address.';
  else if (!isEmail(email)) errors.email = 'Please enter a valid email address.';
  if (!phoneRaw.trim()) errors.phone = 'Please enter your phone number.';
  else if (!phoneNumber) errors.phone = 'Please enter a valid Australian phone number.';
  if (Object.keys(errors).length) return json({ ok: false, error: 'Please check the highlighted fields.', fields: errors }, 400);

  // ---- the lead: base fields, the form's other fields, where it came from
  const extras: Record<string, string> = {};
  for (const [k, val] of Object.entries(input)) {
    if (RESERVED.has(k) || k.startsWith('utm_') || !/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k)) continue;
    if (Object.keys(extras).length >= MAX_EXTRA_FIELDS) break;
    extras[k] = val.slice(0, MAX_VALUE);
  }
  const pageUrl = input.pageUrl || input.page || req.headers.get('referer') || '';
  const utm: Record<string, string> = {};
  for (const [k, val] of Object.entries(input)) if (k.startsWith('utm_')) utm[k] = val;
  const lead: Lead = compact({
    firstName: named.firstName,
    lastName: named.lastName,
    email: email.toLowerCase(),
    phoneNumber,
    ...extras,
    formName: (input.formName || 'Website form').slice(0, 100),
    pageUrl: cleanPageUrl(pageUrl),
    submittedAt: brisbaneIso(),
    ...utmFrom(pageUrl, utm),
  });

  // ---- clinic notification email and dashboard record, after the answer (as for the other forms)
  after(async () => {
    await notifyClinic(lead).catch((e) => console.error('[lead] clinic email failed:', (e as Error).message));
    await logEnquiry({
      form: 'contact',
      name: `${lead.firstName} ${lead.lastName || ''}`.trim(),
      email: String(lead.email || ''),
      phone: String(lead.phoneNumber || ''),
      message: `${lead.formName}${lead.message ? `: ${lead.message}` : ''}`,
      source: String(lead.pageUrl || ''),
      raw: Object.fromEntries(Object.entries(lead).map(([k, val]) => [k, String(val)])),
      emailStatus: 'sent',
    }).catch(() => undefined);
  });

  // ---- the CRM: this answer depends on it
  const result = await sendLeadToCrm(lead, String(lead.formName));
  if (result.status === 'failed') return json({ ok: false, error: `Sorry, your details could not be sent. Please call us on ${PHONE}.` }, 502);
  if (result.status === 'skipped') return json({ ok: false, error: `This form is not set up yet. Please call us on ${PHONE}.` }, 503);
  return json({ ok: true });
}

export function GET() {
  return json({ ok: false, error: 'Use POST' }, 405);
}

/** The clinic's notification email for an /api/lead submission (same recipients and sender as the other forms). */
async function notifyClinic(lead: Lead) {
  const key = process.env.SMTP2GO_API_KEY?.trim();
  if (!key) return;
  const to = (process.env.FORM_TO || 'rowayne@gyaclients.com, va@generateyouraudience.com').split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const cc = (process.env.FORM_CC || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const bcc = (process.env.FORM_BCC || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const sender = (process.env.FORM_FROM || 'Sunshine Coast OFIS Website <noreply@dentalspecialists.com.au>').trim();
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
  const rows = Object.entries(lead).map(([k, val]) => [k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), String(val)]);
  const r = await fetch('https://api.smtp2go.com/v3/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      api_key: key,
      to,
      ...(cc.length ? { cc } : {}),
      ...(bcc.length ? { bcc } : {}),
      sender,
      subject: `${lead.formName}: ${lead.firstName} ${lead.lastName || ''}`.trim(),
      text_body: rows.map(([k, val]) => `${k}: ${val}`).join('\n'),
      html_body: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1D2540;max-width:640px"><table style="border-collapse:collapse;width:100%">${rows.map(([k, val]) => `<tr><td style="padding:5px 8px;border:1px solid #E3E9F0;background:#EFF3F7;width:40%;font-weight:bold">${esc(k)}</td><td style="padding:5px 8px;border:1px solid #E3E9F0;white-space:pre-wrap">${esc(val)}</td></tr>`).join('')}</table></div>`,
      custom_headers: isEmail(String(lead.email)) ? [{ header: 'Reply-To', value: String(lead.email) }] : [],
    }),
  });
  if (!r.ok) throw new Error(`SMTP2GO HTTP ${r.status}`);
}
