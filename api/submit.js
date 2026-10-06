// Vercel serverless function: receives the website forms (multipart, with attachments)
// and emails them via SMTP2GO. No dependencies.
//
// Environment variables (Vercel > Project > Settings > Environment Variables):
//   SMTP2GO_API_KEY   required. API key from SMTP2GO > Settings > API Keys.
//   FORM_TO           optional. Comma-separated recipients. Default: rowayne@gyaclients.com
//   FORM_FROM         optional. Sender. Must be on a domain verified in SMTP2GO.
//                     Default: noreply@sunshinecoastofis.com.au
//
// Forms post here with fetch(FormData). Files arrive as attachments on the email.

const DEFAULT_TO = 'rowayne@gyaclients.com';
const DEFAULT_FROM = 'Sunshine Coast OFIS Website <noreply@sunshinecoastofis.com.au>';
const MAX_BODY = 4 * 1024 * 1024; // Vercel's request limit is 4.5 MB

const FORMS = {
  referralForm: {
    subject: (f) => `New doctor referral: ${f.patient_first_name || ''} ${f.patient_last_name || ''}`.trim() + (f.urgent ? ' [URGENT]' : ''),
    sections: [
      ['Referral Patient Details', [
        ['Patient Name', (f) => `${f.patient_first_name || ''} ${f.patient_last_name || ''}`.trim()],
        ['Date of Birth', 'patient_dob'], ['Patient Best Contact #', 'patient_contact'], ['E-mail', 'patient_email'],
        ['Address', 'patient_address'], ['Reason For Referral', 'reason_for_referral'],
        ['Implant Brand Preference', 'implant_brand_preference'], ['Medical History', 'medical_history'],
        ['Radiographs', 'radiographs'], ['Comments', 'comments'],
      ]],
      ['Referral Doctor Details', [
        ['Referring Doctor', (f) => `${f.doctor_first_name || ''} ${f.doctor_last_name || ''}`.trim()],
        ['Practice Contact Number #', 'practice_contact_number'], ['E-mail', 'doctor_email'],
        ['Practice Address', 'practice_address'], ['Provider #', 'provider_number'],
        ['Preferred specialist to see', 'preferred_specialist'], ['Urgent', 'urgent'], ['Date', 'referral_date'],
      ]],
    ],
    replyTo: 'doctor_email',
  },
  contactForm: {
    subject: (f) => `Website enquiry: ${f.first || ''} ${f.last || ''}`.trim() + (f.topic ? ` (${f.topic})` : ''),
    sections: [
      ['Enquiry', [
        ['Name', (f) => `${f.first || ''} ${f.last || ''}`.trim()], ['Mobile', 'phone'], ['Email', 'email'],
        ['What can we help with?', 'topic'], ['Has a referral', 'referral'], ['Message', 'message'],
      ]],
    ],
    replyTo: 'email',
  },
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  if (!process.env.SMTP2GO_API_KEY) return res.status(500).json({ ok: false, error: 'SMTP2GO_API_KEY is not set' });

  let body;
  try { body = await readBody(req); } catch (e) { return res.status(413).json({ ok: false, error: e.message }); }
  const ct = req.headers['content-type'] || '';
  const { fields, files } = ct.includes('multipart/form-data') ? parseMultipart(body, ct) : parseUrlEncoded(body.toString());

  const form = FORMS[fields.form];
  if (!form) return res.status(400).json({ ok: false, error: 'Unknown form' });
  if (fields.website) return res.status(200).json({ ok: true }); // honeypot filled by a bot: pretend success, send nothing

  const to = (process.env.FORM_TO || DEFAULT_TO).split(',').map((s) => s.trim()).filter(Boolean);
  const text = renderText(form, fields, files);
  const html = renderHtml(form, fields, files);
  const replyTo = form.replyTo && fields[form.replyTo] && /^[^@\s]+@[^@\s]+$/.test(fields[form.replyTo]) ? fields[form.replyTo] : undefined;

  const payload = {
    api_key: process.env.SMTP2GO_API_KEY,
    to,
    sender: process.env.FORM_FROM || DEFAULT_FROM,
    subject: form.subject(fields),
    text_body: text,
    html_body: html,
    custom_headers: replyTo ? [{ header: 'Reply-To', value: replyTo }] : [],
    attachments: files.map((f) => ({ filename: f.filename, fileblob: f.data.toString('base64'), mimetype: f.type || 'application/octet-stream' })),
  };

  const r = await fetch('https://api.smtp2go.com/v3/email/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok || (out.data && out.data.failed > 0) || (out.data && out.data.error)) {
    console.error('SMTP2GO error', out);
    return res.status(502).json({ ok: false, error: 'Email could not be sent' });
  }
  return res.status(200).json({ ok: true });
};

module.exports.config = { api: { bodyParser: false } };

// ---------- helpers ----------
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error('Attachments too large (4 MB limit)')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseUrlEncoded(s) {
  const fields = {};
  for (const [k, v] of new URLSearchParams(s)) addField(fields, k, v);
  return { fields, files: [] };
}

function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!m) return { fields: {}, files: [] };
  const boundary = Buffer.from('--' + (m[1] || m[2]).trim());
  const fields = {}; const files = [];
  let start = buf.indexOf(boundary);
  while (start !== -1) {
    start += boundary.length;
    if (buf.slice(start, start + 2).toString() === '--') break;
    const next = buf.indexOf(boundary, start);
    if (next === -1) break;
    let part = buf.slice(start, next);
    if (part.slice(0, 2).toString() === '\r\n') part = part.slice(2);
    const sep = part.indexOf('\r\n\r\n');
    if (sep !== -1) {
      const head = part.slice(0, sep).toString('utf8');
      let data = part.slice(sep + 4);
      if (data.slice(-2).toString() === '\r\n') data = data.slice(0, -2);
      const name = (/name="([^"]*)"/i.exec(head) || [])[1];
      const filename = (/filename="([^"]*)"/i.exec(head) || [])[1];
      const type = (/content-type:\s*([^\r\n]+)/i.exec(head) || [])[1];
      if (name !== undefined) {
        if (filename !== undefined) { if (filename && data.length) files.push({ field: name, filename: safeName(filename), type, data }); }
        else addField(fields, name, data.toString('utf8'));
      }
    }
    start = next;
  }
  return { fields, files };
}

function addField(obj, k, v) { obj[k] = k in obj ? [].concat(obj[k], v) : v; }
function safeName(n) { return n.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120); }
function val(fields, key) { const v = typeof key === 'function' ? key(fields) : fields[key]; return Array.isArray(v) ? v.join(', ') : (v || ''); }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function renderText(form, fields, files) {
  const lines = [];
  for (const [title, rows] of form.sections) {
    lines.push(title.toUpperCase(), '-'.repeat(title.length));
    for (const [label, key] of rows) lines.push(`${label}: ${val(fields, key) || '-'}`);
    lines.push('');
  }
  lines.push(`Attachments: ${files.length ? files.map((f) => f.filename).join(', ') : 'none'}`);
  lines.push(`Submitted: ${new Date().toISOString()}${fields.page ? `\nPage: ${fields.page}` : ''}`);
  return lines.join('\n');
}

function renderHtml(form, fields, files) {
  let h = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1D2540;max-width:640px">';
  for (const [title, rows] of form.sections) {
    h += `<h3 style="color:#182650;border-bottom:2px solid #1DB2DE;padding-bottom:4px;margin:18px 0 8px">${esc(title)}</h3><table style="border-collapse:collapse;width:100%">`;
    for (const [label, key] of rows) {
      h += `<tr><td style="padding:5px 8px;border:1px solid #E3E9F0;background:#EFF3F7;width:40%;font-weight:bold">${esc(label)}</td><td style="padding:5px 8px;border:1px solid #E3E9F0;white-space:pre-wrap">${esc(val(fields, key) || '-')}</td></tr>`;
    }
    h += '</table>';
  }
  h += `<p style="margin-top:16px;color:#5C6579;font-size:12px">Attachments: ${files.length ? esc(files.map((f) => f.filename).join(', ')) : 'none'}<br>Submitted ${esc(new Date().toISOString())}${fields.page ? `<br>Page: ${esc(fields.page)}` : ''}</p></div>`;
  return h;
}
