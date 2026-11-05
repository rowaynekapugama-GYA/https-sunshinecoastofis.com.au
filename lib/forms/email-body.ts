/**
 * Notification email bodies for every form except the Online doctor referral (which has
 * its own layout in referral-email.js). Moved out of app/api/submit/route.ts unchanged in
 * 3.3.0 so the patient information form email can be tested (scripts/test-patient-form.ts).
 */
import { v, type Fields, type FormDef } from './definitions';

export interface Upload {
  field: string;
  filename: string;
  type: string;
  data: Buffer;
}

const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export function renderText(def: FormDef, f: Fields, files: Upload[], page: string) {
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

export function renderHtml(def: FormDef, f: Fields, files: Upload[], page: string) {
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
