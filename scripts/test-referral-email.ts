/**
 * Checks the Online Doctor Referral email still matches the practice's old WordPress email.
 *
 *   npm run test:email
 *
 * Builds the email from a sample referral (no email is sent) and checks the subject, From
 * name, section headings, every label in order (including "Patient Best Contact :" and
 * "Practice Address :" with the space before the colon), empty rows kept, line breaks kept,
 * HTML escaped, and the attachment names ({surname}_{firstname}_P{n}_{date}_{HH}_{MM}.{ext}
 * in Brisbane time). Writes a preview to audit/email-preview/referral.html.
 */
import fs from 'node:fs';
import path from 'node:path';
// @ts-ignore: plain JavaScript module, ported unchanged from the approved site
import { buildReferralEmail, SUBJECT, FROM_NAME, FOOTER_LINE } from '../lib/forms/referral-email.js';

let failed = 0;
const check = (ok: boolean, what: string) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
};

const fields = {
  form: 'referralForm',
  patient_first_name: 'Zoë',
  patient_last_name: "O'Brien-Smith",
  patient_dob: '1990-04-12',
  patient_email: 'patient@example.com',
  patient_contact: '0400 000 000',
  patient_address: '12 Example St\nBuderim QLD 4556',
  reason_for_referral: 'Assessment for lower left wisdom tooth <urgent>',
  implant_brand_preference: '',
  medical_history: 'Nil known',
  radiographs: ['OPG', 'CT'],
  comments: 'OPG attached',
  doctor_first_name: 'Sam',
  doctor_last_name: 'Example',
  doctor_email: 'dr@example.com',
  practice_contact_number: '(07) 5400 0000',
  practice_address: '1 Practice Rd, Maroochydore',
  provider_number: '1234567A',
  preferred_specialist: 'Dr Trent Lincoln',
  referral_date: '2026-10-27',
  urgent: 'Yes',
};
const files = [
  { filename: 'scan.PDF', type: 'application/pdf', data: Buffer.from('x') },
  { filename: 'photo', type: 'image/jpeg', data: Buffer.from('y') },
];
// 27 Oct 2026, 09:05 in Brisbane (UTC+10, no daylight saving).
const now = new Date('2026-10-26T23:05:00Z');
const email = buildReferralEmail(fields, files, now);
type Section = [string, [string, string][]];
const sections = email.rows as unknown as Section[];
const allRows = sections.flatMap(([, list]) => list);

check(email.subject === 'Sunshine Coast Oral, Facial & Implant Specialists "Online Doctor Referral"', 'subject matches the old email');
check(SUBJECT === email.subject && FROM_NAME === 'Sunshine Coast Oral, Facial & Implant Specialists', 'From name matches the old email');
check(FOOTER_LINE.includes('https://sunshinecoastofis.com.au'), 'footer names the live site');

const labels = allRows.map(([l]) => l);
const want = [
  'Patient Name:', 'Date of Birth:', 'Email:', 'Patient Best Contact :', 'Address:', 'Reason For Referral:',
  'Implant Brand Preference:', 'Medical History:', 'Radiographs:', 'Radiographs:',
  'Doctor Name:', 'Email:', 'Phone Number:', 'Practice Address :', 'Provider:', 'Preferred specialist to see:', 'Date:', 'Attach File:',
];
check(JSON.stringify(labels) === JSON.stringify(want), 'labels and order are verbatim (no Urgent row)');
check(sections.map(([t]) => t).join('|') === 'Referral Patient Details|Referral Doctor Details', 'section headings');

const value = (label: string, nth = 0) => allRows.filter(([l]) => l === label)[nth]?.[1];
check(value('Implant Brand Preference:') === '', 'an empty field keeps its row, empty');
check(value('Radiographs:', 0) === 'OPG, CT' && value('Radiographs:', 1) === 'OPG attached', 'tick boxes joined; both Radiographs rows');
check(email.html.includes('12 Example St<br>Buderim QLD 4556'), 'line breaks kept in the HTML');
check(email.html.includes('&lt;urgent&gt;') && !email.html.includes('<urgent>'), 'typed HTML is escaped');
check(email.attachments[0].filename === 'obriensmith_zoe_P1_2026-10-27_09_05.pdf', `first attachment name (${email.attachments[0].filename})`);
check(email.attachments[1].filename === 'obriensmith_zoe_P2_2026-10-27_09_05.jpg', `second attachment name from its type (${email.attachments[1].filename})`);
check(email.text.includes('Patient Best Contact :'), 'plain text version present');
check(!/[\u2014]/.test(email.html + email.text), 'no em dashes');

const out = path.join(process.cwd(), 'audit', 'email-preview');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'referral.html'), email.html);
fs.writeFileSync(path.join(out, 'referral.txt'), email.text);
console.log(`\nPreview: audit/email-preview/referral.html\n${failed ? `${failed} FAILED` : 'All passed'}`);
process.exit(failed ? 1 : 0);
