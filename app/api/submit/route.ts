/**
 * POST /api/submit: every website form (Contact us, Online doctor referral, Patient
 * information form, Feedback). The submission is
 *   1. emailed through SMTP2GO (attachments included), and
 *   2. saved in the dashboard under Enquiries (when the database is configured).
 * GET /api/submit reports the email setup without sending anything.
 *
 * Environment (Vercel > Settings > Environment Variables):
 *   SMTP2GO_API_KEY  required for email
 *   FORM_TO          comma separated recipients. Default: rowayne@gyaclients.com, va@generateyouraudience.com
 *   FORM_FROM        sender on an SMTP2GO verified domain.
 *                    Default (temporary, until sunshinecoastofis.com.au is verified): noreply@dentalspecialists.com.au
 */
import { FORMS, v, type Fields } from '@/lib/forms/definitions';
import { buildReferralEmail } from '@/lib/forms/referral-email.js';
import { logEnquiry } from '@/lib/enquiries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_TO = 'rowayne@gyaclients.com, va@generateyouraudience.com';
const DEFAULT_FROM = 'Sunshine Coast OFIS Website <noreply@dentalspecialists.com.au>';
const MAX_BYTES = 4 * 1024 * 1024; // Vercel's request body limit is 4.5 MB
const MIN_FILL_MS = 2500; // faster than a person can fill a form in

interface Upload {
  field: string;
  filename: string;
  type: string;
  data: Buffer;
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const safeName = (n: string) => n.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
const recipients = () => (process.env.FORM_TO || DEFAULT_TO).split(/[,;]/).map((s) => s.trim()).filter(Boolean);
const sender = () => (process.env.FORM_FROM || DEFAULT_FROM).trim();
const senderAddress = () => ((/<([^>]+)>/.exec(sender()) || [])[1] || sender()).trim();

export async function POST(req: Request) {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > MAX_BYTES) return json({ ok: false, error: 'Attachments too large (4 MB limit)' }, 413);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, error: 'Could not read the form' }, 400);
  }
  const fields: Fields = {};
  const files: Upload[] = [];
  let size = 0;
  for (const [k, val] of form.entries()) {
    if (typeof val === 'string') {
      fields[k] = k in fields ? ([] as string[]).concat(fields[k], val) : val;
    } else if (val.name && val.size) {
      size += val.size;
      if (size > MAX_BYTES) return json({ ok: false, error: 'Attachments too large (4 MB limit)' }, 413);
      files.push({ field: k, filename: safeName(val.name), type: val.type || 'application/octet-stream', data: Buffer.from(await val.arrayBuffer()) });
    }
  }

  const def = FORMS[v(fields, 'form')];
  if (!def) return json({ ok: false, error: 'Unknown form' }, 400);

  // Spam: the hidden "website" box is only ever filled in by bots, and nobody completes a form in under 2.5 seconds.
  const started = Number(v(fields, 'started'));
  if (v(fields, 'website') || (started && Date.now() - started < MIN_FILL_MS)) return json({ ok: true });

  const page = v(fields, 'page');
  const summary = def.summary(fields);
  const raw: Record<string, string> = {};
  for (const k of Object.keys(fields)) if (!['website', 'form', 'page', 'started'].includes(k) && (!def.store || def.store.includes(k))) raw[k] = v(fields, k);
  if (files.length) raw.attachments = files.map((f) => `${f.filename} (${Math.round(f.data.length / 1024)} KB)`).join(', ');

  // ---- email
  let emailStatus: 'sent' | 'failed' | 'skipped' = 'skipped';
  let emailError = '';
  const apiKey = process.env.SMTP2GO_API_KEY?.trim();
  if (apiKey) {
    let subject: string, text: string, html: string, from: string, attachments: { filename: string; type: string; data: Buffer }[];
    if (def.legacy) {
      const mail = buildReferralEmail(fields, files, new Date());
      subject = mail.subject;
      text = mail.text;
      html = mail.html;
      from = `"${mail.fromName}" <${senderAddress()}>`; // quoted: the practice name contains a comma
      attachments = mail.attachments;
    } else {
      subject = def.subject!(fields);
      text = renderText(def, fields, files, page);
      html = renderHtml(def, fields, files, page);
      from = sender();
      attachments = files;
    }
    const replyTo = def.replyTo && /^[^@\s]+@[^@\s]+$/.test(v(fields, def.replyTo)) ? v(fields, def.replyTo) : '';
    try {
      const r = await fetch('https://api.smtp2go.com/v3/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          to: recipients(),
          sender: from,
          subject,
          text_body: text,
          html_body: html,
          custom_headers: replyTo ? [{ header: 'Reply-To', value: replyTo }] : [],
          attachments: attachments.map((f) => ({ filename: f.filename, fileblob: f.data.toString('base64'), mimetype: f.type })),
        }),
      });
      const out = (await r.json().catch(() => ({}))) as { data?: { failed?: number; error?: string; error_code?: string; failures?: string[] } };
      const d = out.data || {};
      if (!r.ok || (d.failed ?? 0) > 0 || d.error) {
        emailStatus = 'failed';
        emailError = (d.error || d.failures?.join('; ') || `SMTP2GO HTTP ${r.status}`) + (d.error_code ? ` [${d.error_code}]` : '');
      } else emailStatus = 'sent';
    } catch (e) {
      emailStatus = 'failed';
      emailError = `Could not reach SMTP2GO: ${(e as Error).message}`;
    }
  }

  // ---- dashboard record (never blocks the visitor)
  await logEnquiry({ form: def.kind, ...summary, source: page, raw, emailStatus, emailError: emailError || undefined });

  if (emailStatus === 'failed') {
    console.error('[submit] email failed', def.kind, emailError);
    return json({ ok: false, error: `Email could not be sent: ${emailError}` }, 502);
  }
  if (emailStatus === 'skipped' && !process.env.DATABASE_URL) {
    return json({ ok: false, error: 'SMTP2GO_API_KEY is not set' }, 500);
  }
  return json({ ok: true });
}

// ---------------------------------------------------------------- GET: setup check, sends nothing
export async function GET() {
  const key = process.env.SMTP2GO_API_KEY?.trim() || '';
  const fromDomain = (sender().match(/@([^>\s]+)/) || [])[1] || '';
  const out: Record<string, unknown> = {
    ok: true,
    api_key_set: Boolean(key),
    form_to_override: Boolean(process.env.FORM_TO),
    recipients: recipients().map((e) => e.replace(/^(.).*?(@.*)$/, '$1***$2')),
    sender: sender(),
    dashboard_logging: Boolean(process.env.DATABASE_URL),
  };
  if (!key) return json(out);
  try {
    const r = await fetch('https://api.smtp2go.com/v3/domain/view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: key }) });
    const j = (await r.json().catch(() => ({}))) as { data?: { domains?: unknown[]; error?: string } };
    out.smtp2go_key_accepted = r.ok;
    const list = (j.data?.domains || []) as { domain?: { fulldomain?: string; domain?: string } }[];
    const names = list.map((d) => d.domain?.fulldomain || d.domain?.domain || '').filter(Boolean);
    out.sender_domains = names;
    out.sender_domain_registered = names.some((n) => fromDomain && n.toLowerCase().endsWith(fromDomain.toLowerCase()));
  } catch (e) {
    out.smtp2go_message = `Could not reach SMTP2GO: ${(e as Error).message}`;
  }
  return json(out);
}

// ---------------------------------------------------------------- email bodies (all forms except the referral)
function renderText(def: (typeof FORMS)[string], f: Fields, files: Upload[], page: string) {
  const lines: string[] = [];
  for (const [title, rows] of def.sections || []) {
    lines.push(title.toUpperCase(), '-'.repeat(title.length));
    for (const [label, key] of rows) lines.push(`${label}: ${v(f, key) || '-'}`);
    lines.push('');
  }
  lines.push(`Attachments: ${files.length ? files.map((x) => x.filename).join(', ') : 'none'}`);
  lines.push(`Submitted: ${new Date().toISOString()}${page ? `\nPage: ${page}` : ''}`);
  return lines.join('\n');
}

function renderHtml(def: (typeof FORMS)[string], f: Fields, files: Upload[], page: string) {
  let h = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1D2540;max-width:640px">';
  for (const [title, rows] of def.sections || []) {
    h += `<h3 style="color:#182650;border-bottom:2px solid #1DB2DE;padding-bottom:4px;margin:18px 0 8px">${esc(title)}</h3><table style="border-collapse:collapse;width:100%">`;
    for (const [label, key] of rows) {
      h += `<tr><td style="padding:5px 8px;border:1px solid #E3E9F0;background:#EFF3F7;width:40%;font-weight:bold">${esc(label)}</td><td style="padding:5px 8px;border:1px solid #E3E9F0;white-space:pre-wrap">${esc(v(f, key) || '-')}</td></tr>`;
    }
    h += '</table>';
  }
  h += `<p style="margin-top:16px;color:#5C6579;font-size:12px">Attachments: ${files.length ? esc(files.map((x) => x.filename).join(', ')) : 'none'}<br>Submitted ${esc(new Date().toISOString())}${page ? `<br>Page: ${esc(page)}` : ''}</p></div>`;
  return h;
}
