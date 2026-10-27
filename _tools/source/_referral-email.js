// Online Doctor Referral email, built to match the old WordPress site's email exactly.
// Reference: the printed copy of the legacy email supplied by the practice (Oct 2026).
//
// Files in /api starting with "_" are not deployed as routes by Vercel, so this is a
// private module used by api/submit.js and by scripts/test-referral-email.js.
//
// Rules (do not change without the practice's sign-off):
//   - Subject, From display name and footer are character-for-character from the old email.
//   - Labels, order and spacing are verbatim, including "Patient Best Contact :" and
//     "Practice Address :" (space before the colon) and the two "Radiographs:" rows.
//   - Empty fields keep their row with an empty value. Nothing is auto-filled.
//   - Values are shown exactly as typed (line breaks kept, no trimming or reformatting).
//   - Plain look: borderless table, inline styles only, no colours, logos or buttons.

const SUBJECT = 'Sunshine Coast Oral, Facial & Implant Specialists "Online Doctor Referral"';
const FROM_NAME = 'Sunshine Coast Oral, Facial & Implant Specialists';
const FOOTER_LINE = 'This e-mail was sent from Sunshine Coast Oral, Facial & Implant Specialists (https://sunshinecoastofis.com.au)';
const SITE_URL = 'https://sunshinecoastofis.com.au';
const TIME_ZONE = 'Australia/Brisbane';

// The new form has an "Urgent" tick box but the old email had no Urgent row.
// Kept off so the email matches the old one. Set to true to add an "Urgent:" row after "Date:".
const SHOW_URGENT_ROW = false;

const join = (a, b) => [a, b].filter((x) => x != null && String(x) !== '').join(' ');

// [label, value getter]. Order and wording copied from the legacy email.
function rows(f, attachNames) {
  const patient = [
    ['Patient Name:', join(v(f.patient_first_name), v(f.patient_last_name))],
    ['Date of Birth:', v(f.patient_dob)],
    ['Email:', v(f.patient_email)],
    ['Patient Best Contact :', v(f.patient_contact)],
    ['Address:', v(f.patient_address)],
    ['Reason For Referral:', v(f.reason_for_referral)],
    ['Implant Brand Preference:', v(f.implant_brand_preference)],
    ['Medical History:', v(f.medical_history)],
    ['Radiographs:', v(f.radiographs)], // radiograph type tick boxes (OPG, CT)
    ['Radiographs:', v(f.comments)], // free-text notes field (shown as "Comments" on the form)
  ];
  const doctor = [
    ['Doctor Name:', join(v(f.doctor_first_name), v(f.doctor_last_name))],
    ['Email:', v(f.doctor_email)],
    ['Phone Number:', v(f.practice_contact_number)],
    ['Practice Address :', v(f.practice_address)],
    ['Provider:', v(f.provider_number)],
    ['Preferred specialist to see:', v(f.preferred_specialist)],
    ['Date:', v(f.referral_date)],
  ];
  if (SHOW_URGENT_ROW) doctor.push(['Urgent:', v(f.urgent)]);
  doctor.push(['Attach File:', attachNames.join('\n')]);
  return [['Referral Patient Details', patient], ['Referral Doctor Details', doctor]];
}

// Field value as typed. Multi-value fields (tick boxes) are joined with ", ".
function v(x) {
  if (x == null) return '';
  return Array.isArray(x) ? x.join(', ') : String(x);
}

// ---------- attachment naming: {surname}_{firstname}_P{n}_{YYYY-MM-DD}_{HH}_{MM}.{ext} ----------
function slug(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // é -> e
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ''); // drop spaces, apostrophes, hyphens and anything unsafe
}

const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/heic': 'heic', 'image/webp': 'webp', 'application/pdf': 'pdf', 'application/zip': 'zip', 'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };

function extOf(file) {
  const m = /\.([A-Za-z0-9]{1,10})$/.exec(file.filename || '');
  if (m) return m[1].toLowerCase();
  return MIME_EXT[(file.type || '').toLowerCase()] || '';
}

// Date/time parts in Brisbane time (Vercel servers run in UTC).
function brisbaneParts(now) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-AU', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)) parts[p.type] = p.value;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hh: parts.hour, mm: parts.minute };
}

function attachmentNames(f, files, now) {
  const t = brisbaneParts(now);
  const surname = slug(v(f.patient_last_name)) || 'patient';
  const first = slug(v(f.patient_first_name)) || 'unknown';
  return files.map((file, i) => {
    const ext = extOf(file);
    return `${surname}_${first}_P${i + 1}_${t.date}_${t.hh}_${t.mm}${ext ? '.' + ext : ''}`;
  });
}

// ---------- rendering ----------
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Escape first, then keep the referrer's line breaks.
const escLines = (s) => esc(s).replace(/\r\n|\r|\n/g, '<br>');

// Inline styles only, no classes, flex or grid: renders the same in Outlook desktop, Outlook web and Gmail.
const TD_FONT = "font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:15px;color:#000000;";
const LABEL_TD = `width:116px;padding:3px 0 2px 0;${TD_FONT}`; // 116px wraps the same labels as the old email
const VALUE_TD = `padding:3px 0 2px 3px;${TD_FONT}`;
const HEAD_TD = "padding:6px 0 3px 0;font-family:'Times New Roman',Times,serif;font-size:18px;line-height:21px;font-weight:bold;color:#000000;text-align:center;";
const FOOT = "font-family:'Times New Roman',Times,serif;font-size:18px;line-height:21px;color:#000000;";

function renderHtml(sections) {
  let body = '';
  for (const [title, list] of sections) {
    body += `<tr><td colspan="2" align="center" style="${HEAD_TD}">${esc(title)}</td></tr>\n`;
    for (const [label, value] of list) {
      body += `<tr><td width="116" valign="middle" style="${LABEL_TD}">${esc(label)}</td><td valign="middle" style="${VALUE_TD}">${escLines(value)}</td></tr>\n`;
    }
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(SUBJECT)}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#ffffff;">
${body}</table>
<p style="margin:0;${FOOT}">&nbsp;</p>
<p style="margin:0;${FOOT}">--<br>This e-mail was sent from Sunshine Coast Oral, Facial &amp; Implant Specialists (<a href="${SITE_URL}" style="color:#0000EE;">${SITE_URL}</a>)</p>
</body>
</html>`;
}

function renderText(sections) {
  const out = [];
  for (const [title, list] of sections) {
    out.push(title);
    for (const [label, value] of list) out.push(value === '' ? label : `${label} ${value}`);
  }
  out.push('--', FOOTER_LINE);
  return out.join('\n');
}

// fields: parsed form fields. files: [{ filename, type, data }]. now: Date (defaults to now).
function buildReferralEmail(fields, files = [], now = new Date()) {
  const names = attachmentNames(fields, files, now);
  const sections = rows(fields, names);
  return {
    subject: SUBJECT,
    fromName: FROM_NAME,
    html: renderHtml(sections),
    text: renderText(sections),
    attachments: files.map((file, i) => ({ filename: names[i], type: file.type, data: file.data })),
    rows: sections,
  };
}

module.exports = { buildReferralEmail, attachmentNames, SUBJECT, FROM_NAME, FOOTER_LINE, SHOW_URGENT_ROW };
