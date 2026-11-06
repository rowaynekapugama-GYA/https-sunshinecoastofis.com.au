/**
 * SmileOX CRM intake: every website enquiry becomes a lead in the practice's SmileOX pipeline.
 *
 * SmileOX creates a lead from any email sent to the practice's unique intake address, where
 * the email body is the lead as JSON (plain text, subject "Website form submission"). A
 * submission with the same email and phone number as an existing lead updates that lead.
 *
 * Server side only: this file (nodemailer and the SMTP credentials) is never sent to the browser.
 *
 * How the email is sent, in this order:
 *   1. SMTP_HOST + SMTP_USER + SMTP_PASS set: nodemailer over SMTP with TLS required
 *      (port 465/8465/443 implicit TLS; any other port STARTTLS with requireTLS), TLS 1.2 or later.
 *   2. Otherwise SMTP2GO_API_KEY (already used for the clinic's form emails): SMTP2GO's HTTPS API.
 *   3. Neither: nothing is sent and the build log says so.
 * In both cases the provider delivers to SmileOX over TLS when SmileOX's mail server offers it;
 * the TLS settings here protect the leg from the website to the provider.
 *
 * Environment (one set, shared by the site's forms and the Google Ads landing pages in /lp):
 *   SMTP_HOST, SMTP_PORT (465), SMTP_SECURE (optional true/false override), SMTP_USER, SMTP_PASS
 *   MAIL_FROM or SMTP_FROM   sender when sending over SMTP
 *   LEAD_INTAKE or CRM_INTAKE_EMAIL   intake address (defaults to the address below; "off" turns the CRM off)
 * The SMTP2GO fallback always sends from FORM_FROM (or the default below), the sender the clinic's
 * form emails already use, so a MAIL_FROM on an unverified domain cannot stop leads going out.
 */
import nodemailer from 'nodemailer';

export const DEFAULT_INTAKE_EMAIL = 'contact-submissions+50d8ee08-b736-4740-a84b-ae94788ca250@intake.smileox.com.au';
const SUBJECT = 'Website form submission';
const DEFAULT_FROM = 'Sunshine Coast OFIS Website <noreply@dentalspecialists.com.au>';
const MAX_RETRIES = 3; // after the first attempt
const BACKOFF_MS = [500, 1500, 3500];

export type LeadValue = string | number | boolean;
export type Lead = Record<string, LeadValue>;

const intakeSetting = () => (process.env.LEAD_INTAKE || process.env.CRM_INTAKE_EMAIL || '').trim();
export const crmEnabled = () => !/^(off|false|0|none|disabled)$/i.test(intakeSetting());
export const intakeAddress = () => (intakeSetting() && crmEnabled() ? intakeSetting() : DEFAULT_INTAKE_EMAIL);

// ---------------------------------------------------------------- field helpers

/**
 * Australian phone number to E.164. Spaces, brackets, dashes and dots are removed.
 * 0412 345 678 -> +61412345678, (07) 5406 0586 -> +61754060586, +61 412 345 678 kept,
 * 0061..., 61... and 1300/1800/13 numbers handled. Returns null when it is not a valid AU number.
 */
export function toE164AU(raw: string): string | null {
  let s = String(raw || '').trim().replace(/[\s().\-]/g, '');
  if (!s) return null;
  if (s.startsWith('+')) {
    if (!s.startsWith('+61')) return null;
    s = s.slice(3);
  } else if (s.startsWith('0061')) s = s.slice(4);
  else if (/^61\d{9}$/.test(s)) s = s.slice(2);
  else if (/^1[38]00\d{6}$/.test(s) || /^13\d{4}$/.test(s)) return `+61${s}`;
  else if (s.startsWith('0')) s = s.slice(1);
  if (s.startsWith('0')) s = s.slice(1); // +61 (0)4...
  if (/^[23478]\d{8}$/.test(s)) return `+61${s}`; // landline 2/3/7/8, mobile 4
  if (/^1[38]00\d{6}$/.test(s) || /^13\d{4}$/.test(s)) return `+61${s}`;
  return null;
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());

/** "Full name" -> first name and the rest as last name. */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/** ISO 8601 time in Australia/Brisbane (always UTC+10, no daylight saving): 2026-11-06T09:44:00+10:00 */
export function brisbaneIso(d = new Date()): string {
  const t = new Date(d.getTime() + 10 * 3600 * 1000);
  return t.toISOString().replace(/\.\d{3}Z$/, '+10:00');
}

/** utm_* parameters from a page address, plus any passed in separately (first touch wins). */
export function utmFrom(pageUrl: string, extra: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(extra)) if (/^utm_[a-z_]+$/.test(k) && v) out[k] = String(v).slice(0, 200);
  try {
    const u = new URL(pageUrl);
    u.searchParams.forEach((v, k) => {
      if (/^utm_[a-z_]+$/.test(k) && v && !out[k]) out[k] = v.slice(0, 200);
    });
  } catch {
    /* no page address */
  }
  return out;
}

/** The page address without its query string (utm_* are sent as their own fields). */
export const cleanPageUrl = (pageUrl: string) => {
  try {
    const u = new URL(pageUrl);
    return `${u.origin}${u.pathname}`;
  } catch {
    return '';
  }
};

/** Drops empty values so only data the visitor actually gave is sent. */
export function compact(obj: Record<string, unknown>): Lead {
  const out: Lead = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') {
      const s = v.trim();
      if (s) out[k] = s;
    } else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------- sending

export interface SendResult {
  status: 'sent' | 'failed' | 'skipped';
  via?: 'smtp' | 'smtp2go-api';
  attempts: number;
  error?: string;
}

type SendOnce = (json: string) => Promise<void>;

/** Errors worth retrying: SMTP 4xx replies, timeouts, refused or reset connections, SMTP2GO 429/5xx. */
export function isTransient(err: unknown): boolean {
  const e = err as { responseCode?: number; code?: string; errno?: string; status?: number; message?: string; cause?: { code?: string } };
  if (e?.responseCode && e.responseCode >= 400 && e.responseCode < 500) return true;
  if (e?.status && (e.status === 429 || e.status >= 500)) return true;
  const codes = [e?.code, e?.errno, e?.cause?.code, e?.message].join(' ');
  return /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENETUNREACH|ETIMEOUT|fetch failed|aborted due to timeout/i.test(codes);
}

/** Sender over SMTP: MAIL_FROM (the landing pages' name) or SMTP_FROM, else the form sender. */
const smtpFrom = () => (process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.FORM_FROM || DEFAULT_FROM).trim();
/** Sender through SMTP2GO's API: the address the clinic's form emails already send from. */
const apiFrom = () => (process.env.FORM_FROM || DEFAULT_FROM).trim();

/** One plain-text email. */
export interface Mail {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}
export interface Mailer {
  via: 'smtp' | 'smtp2go-api';
  send: (mail: Mail) => Promise<void>;
}

/** The provider every CRM and landing page email goes through: SMTP when set, else SMTP2GO's API. */
export function mailer(): Mailer | null {
  return smtpMailer() || smtp2goMailer();
}

function smtpMailer(): Mailer | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  const secureSetting = (process.env.SMTP_SECURE || '').trim().toLowerCase();
  const secure = secureSetting ? secureSetting === 'true' : [465, 8465, 443].includes(port);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure, // implicit TLS (465)
    requireTLS: !secure, // STARTTLS is mandatory on other ports (587): never send in the clear
    auth: { user, pass },
    tls: { minVersion: 'TLSv1.2' },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  });
  return {
    via: 'smtp',
    send: async ({ to, subject, text, replyTo }) => {
      await transporter.sendMail({ to, from: smtpFrom(), subject, text, ...(replyTo ? { replyTo } : {}) });
    },
  };
}

function smtp2goMailer(): Mailer | null {
  const key = process.env.SMTP2GO_API_KEY?.trim();
  if (!key) return null;
  return {
    via: 'smtp2go-api',
    send: async ({ to, subject, text, replyTo }) => {
      const r = await fetch('https://api.smtp2go.com/v3/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          api_key: key,
          to: to.split(/[,;]/).map((x) => x.trim()).filter(Boolean),
          sender: apiFrom(),
          subject,
          text_body: text,
          ...(replyTo && isEmail(replyTo) ? { custom_headers: [{ header: 'Reply-To', value: replyTo }] } : {}),
        }),
      });
      const out = (await r.json().catch(() => ({}))) as { data?: { failed?: number; error?: string; error_code?: string } };
      const d = out.data || {};
      if (!r.ok || (d.failed ?? 0) > 0 || d.error) {
        throw Object.assign(new Error(`SMTP2GO: ${d.error || `HTTP ${r.status}`}${d.error_code ? ` [${d.error_code}]` : ''}`), { status: r.status });
      }
    },
  };
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
const short = (err: unknown) => {
  const e = err as { code?: string; responseCode?: number; message?: string };
  return [e?.responseCode, e?.code, String(e?.message || err).replace(/\s+/g, ' ').slice(0, 180)].filter(Boolean).join(' ');
};

/**
 * Sends one lead to SmileOX, retrying transient errors up to 3 times with backoff.
 * Logs the form name, the outcome and the error only: never the lead's details.
 * `sendOnce` is for tests.
 */
export async function sendLeadToCrm(lead: Lead, formName: string, sendOnce?: SendOnce): Promise<SendResult> {
  if (!crmEnabled()) return { status: 'skipped', attempts: 0, error: 'CRM_INTAKE_EMAIL is off' };
  let via: SendResult['via'];
  let send = sendOnce;
  if (!send) {
    const m = mailer();
    if (m) {
      via = m.via;
      send = (json) => m.send({ to: intakeAddress(), subject: SUBJECT, text: json });
    }
  }
  if (!send) {
    console.warn(`[crm] ${formName}: not sent, no SMTP settings or SMTP2GO_API_KEY`);
    return { status: 'skipped', attempts: 0, error: 'no email provider configured' };
  }

  // Lead status updates are not used yet (no status IDs were supplied). When they are, a
  // second, separate send goes here with only the matching keys and the action, for example:
  //   { email, phoneNumber, action: 'UPDATE_TARGET_STATUS', targetStatusId: '<status id from SmileOX>' }
  // SmileOX matches it to the existing lead and changes its status instead of creating a lead.
  const json = JSON.stringify(lead);
  let attempts = 0;
  for (;;) {
    attempts++;
    try {
      await send(json);
      console.log(`[crm] ${formName}: lead sent${via ? ` via ${via}` : ''}${attempts > 1 ? ` after ${attempts} attempts` : ''}`);
      return { status: 'sent', via, attempts };
    } catch (err) {
      const transient = isTransient(err);
      if (!transient || attempts > MAX_RETRIES) {
        const error = short(err);
        console.error(`[crm] ${formName}: lead NOT sent after ${attempts} attempt(s)${transient ? '' : ' (permanent error)'}: ${error}`);
        return { status: 'failed', via, attempts, error };
      }
      console.warn(`[crm] ${formName}: attempt ${attempts} failed (${short(err)}), retrying`);
      await sleep(BACKOFF_MS[attempts - 1] ?? 3500);
    }
  }
}
