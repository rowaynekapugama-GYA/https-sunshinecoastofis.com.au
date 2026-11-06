/**
 * SmileOX CRM intake (3.5.0). Run: npm run test:crm
 * Phone and name handling, what each form sends (and never sends), retries, and the
 * SMTP2GO fallback. Nothing is sent anywhere: the email sending is replaced in the test.
 */
import { FORMS, type Fields } from '../lib/forms/definitions';
import { leadFromForm } from '../lib/crm/forms';
import { brisbaneIso, isTransient, sendLeadToCrm, splitName, toE164AU } from '../lib/crm/intake';

let failed = 0;
const ok = (cond: boolean, what: string) => {
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${what}`);
};

(async () => {
  // ---- phone numbers
  const phones: [string, string | null][] = [
    ['0412 345 678', '+61412345678'],
    ['0412-345-678', '+61412345678'],
    ['(07) 5406 0586', '+61754060586'],
    ['07 5406 0586', '+61754060586'],
    ['+61 412 345 678', '+61412345678'],
    ['+61 (0) 412 345 678', '+61412345678'],
    ['0061412345678', '+61412345678'],
    ['61412345678', '+61412345678'],
    ['1300 123 456', '+611300123456'],
    ['412345678', '+61412345678'],
    ['+1 415 555 0100', null],
    ['12345', null],
    ['', null],
  ];
  for (const [input, want] of phones) ok(toE164AU(input) === want, `phone "${input}" -> ${want}`);

  // ---- names and time
  ok(JSON.stringify(splitName('Jane Mary Citizen')) === '{"firstName":"Jane","lastName":"Mary Citizen"}', 'full name split into first and last');
  ok(JSON.stringify(splitName('Cher')) === '{"firstName":"Cher","lastName":""}', 'single name kept as first name');
  ok(brisbaneIso(new Date('2026-11-05T23:44:00Z')) === '2026-11-06T09:44:00+10:00', 'submittedAt in Australia/Brisbane ISO');

  // ---- what each form sends
  const page = 'https://sunshinecoastofis.com.au/contact-us/?utm_source=google&utm_medium=cpc&utm_campaign=implants&gclid=abc';
  const contact = leadFromForm(FORMS.contactForm, { first: 'Jane', last: 'Citizen', phone: '0412 345 678', email: 'Jane@Example.com', topic: 'Dental implants', referral: 'No', message: 'Hi', page, website: '', started: '1' } as Fields)!;
  ok(contact.firstName === 'Jane' && contact.lastName === 'Citizen' && contact.email === 'jane@example.com' && contact.phoneNumber === '+61412345678', 'contact: base fields, email lower-cased, phone E.164');
  ok(contact.service === 'Dental implants' && contact.hasReferral === 'No' && contact.message === 'Hi', 'contact: service, referral and message sent');
  ok(contact.formName === 'Contact us' && contact.pageUrl === 'https://sunshinecoastofis.com.au/contact-us/' && /\+10:00$/.test(String(contact.submittedAt)), 'contact: formName, pageUrl (no query), submittedAt');
  ok(contact.utm_source === 'google' && contact.utm_medium === 'cpc' && contact.utm_campaign === 'implants' && !('gclid' in contact), 'contact: utm_* from the page address, nothing else from it');
  ok(!('website' in contact) && !('started' in contact) && !('page' in contact), 'contact: form internals not sent');
  const fromSaved = leadFromForm(FORMS.contactForm, { first: 'A', last: 'B', phone: '0412345678', email: 'a@b.com', page: 'https://sunshinecoastofis.com.au/contact-us/', utm_source: 'facebook' } as Fields)!;
  ok(fromSaved.utm_source === 'facebook', 'contact: utm_* saved from the landing page are sent');
  const empty = leadFromForm(FORMS.contactForm, { first: 'A', last: 'B', phone: '0412345678', email: 'a@b.com', topic: '', message: '  ', page } as Fields)!;
  ok(!('message' in empty) && !('service' in empty), 'empty fields are dropped');

  const referral = leadFromForm(FORMS.referralForm, {
    patient_first_name: 'Sam', patient_last_name: 'Patient', patient_dob: '1990-01-02', patient_contact: '0400 111 222', patient_email: 'sam@example.com', patient_address: '1 Street',
    reason_for_referral: 'Impacted 38', implant_brand_preference: 'BrandZeta', medical_history: 'Diabetes', radiographs: 'OPG', comments: 'note', doctor_first_name: 'Dr', doctor_last_name: 'Smith',
    practice_contact_number: '07 5400 0000', doctor_email: 'smith@clinic.com', practice_address: '2 Road', provider_number: '123456A', preferred_specialist: ['Dr Trent Lincoln'], urgent: 'Yes', referral_date: '2026-11-06', page,
  } as unknown as Fields)!;
  ok(referral.firstName === 'Sam' && referral.phoneNumber === '+61400111222' && referral.email === 'sam@example.com', 'referral: the patient is the lead');
  ok(referral.referringDoctor === 'Dr Smith' && referral.referringPracticePhone === '+61754000000' && referral.preferredSurgeon === 'Dr Trent Lincoln' && referral.urgent === 'Yes', 'referral: referring doctor, practice phone, surgeon, urgent');
  const refText = JSON.stringify(referral);
  ok(!/1990-01-02|Impacted|Diabetes|OPG|1 Street|123456A|note|BrandZeta|2 Road/i.test(refText), 'referral: no DOB, address, reason, implant brand, medical history, x-rays, comments, provider number or practice address');

  const patient = leadFromForm(FORMS.patientForm, {
    first_name: 'Jane', surname: 'Citizen', dob: '05/11/1985', email: 'jane@example.com', phone_mobile: '', phone_landline: '07 5406 0586', medicare_number: '2123456701', medicare_reference: '1',
    allergies: 'Penicillin', medications: 'Warfarin', conditions: ['Diabetes'], weight: '70', height: '170', smoker: 'No', address: '3 Lane', page,
  } as unknown as Fields)!;
  ok(patient.firstName === 'Jane' && patient.lastName === 'Citizen' && patient.phoneNumber === '+61754060586', 'patient form: name and phone (landline used when no mobile)');
  ok(!/1985|2123456701|Penicillin|Warfarin|Diabetes|3 Lane|"70"|170/.test(JSON.stringify(patient)), 'patient form: no DOB, Medicare, allergies, medications, conditions, address or measurements');
  ok(leadFromForm(FORMS.feedbackForm, { name: 'A', email: 'a@b.com', message: 'x', page } as Fields) === null, 'feedback form: not sent');
  const odd = leadFromForm(FORMS.contactForm, { first: 'A', last: 'B', phone: '+1 415 555 0100', email: 'a@b.com', page } as Fields)!;
  ok(!odd.phoneNumber && odd.phoneAsEntered === '+1 415 555 0100', 'overseas phone kept as typed, not as phoneNumber');

  // ---- retries
  ok(isTransient({ responseCode: 421 }) && isTransient({ code: 'ETIMEDOUT' }) && isTransient({ code: 'ECONNRESET' }) && isTransient({ code: 'ECONNREFUSED' }) && isTransient({ status: 503 }), 'transient: SMTP 4xx, timeouts, reset, refused, HTTP 5xx');
  ok(!isTransient({ responseCode: 535 }) && !isTransient({ responseCode: 550 }) && !isTransient({ status: 400 }), 'not transient: SMTP 5xx (bad password, rejected), HTTP 400');
  let calls = 0;
  const flaky = async () => { calls++; if (calls < 3) throw Object.assign(new Error('Try again later'), { responseCode: 421 }); };
  let r = await sendLeadToCrm(contact, 'test', flaky);
  ok(r.status === 'sent' && r.attempts === 3, `421 twice then sent: ${r.status} after ${r.attempts} attempts`);
  calls = 0;
  r = await sendLeadToCrm(contact, 'test', async () => { calls++; throw Object.assign(new Error('Try again later'), { responseCode: 451 }); });
  ok(r.status === 'failed' && r.attempts === 4 && calls === 4, `always 4xx: gives up after ${r.attempts} attempts (1 + 3 retries)`);
  calls = 0;
  r = await sendLeadToCrm(contact, 'test', async () => { calls++; throw Object.assign(new Error('Authentication failed'), { responseCode: 535 }); });
  ok(r.status === 'failed' && calls === 1, 'wrong password (535): no retries');
  let body = '';
  r = await sendLeadToCrm(contact, 'test', async (j) => { body = j; });
  ok(r.status === 'sent' && JSON.stringify(JSON.parse(body)) === JSON.stringify(contact), 'body is exactly JSON.stringify(payload)');

  // ---- SMTP2GO fallback (no SMTP_* set): request checked, nothing sent
  delete process.env.SMTP_HOST;
  process.env.SMTP2GO_API_KEY = 'test-key';
  process.env.FORM_FROM = 'Sunshine Coast OFIS Website <noreply@sunshinecoastofis.com.au>';
  const realFetch = globalThis.fetch;
  let req: { url: string; body: Record<string, unknown> } | null = null;
  globalThis.fetch = (async (url: string, init: { body: string }) => {
    req = { url, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ data: { succeeded: 1, failed: 0 } }), { status: 200 });
  }) as unknown as typeof fetch;
  r = await sendLeadToCrm(contact, 'contact');
  globalThis.fetch = realFetch;
  const b = (req as unknown as { body: Record<string, unknown> })?.body || {};
  ok(r.status === 'sent' && r.via === 'smtp2go-api', 'no SMTP settings: sent through the existing SMTP2GO account');
  ok(JSON.stringify(b.to) === '["contact-submissions+50d8ee08-b736-4740-a84b-ae94788ca250@intake.smileox.com.au"]' && b.subject === 'Website form submission' && b.text_body === JSON.stringify(contact) && !('html_body' in b), 'SMTP2GO: intake address, subject, plain-text JSON body only');
  process.env.CRM_INTAKE_EMAIL = 'off';
  r = await sendLeadToCrm(contact, 'contact');
  ok(r.status === 'skipped', 'CRM_INTAKE_EMAIL=off turns the CRM off');
  delete process.env.CRM_INTAKE_EMAIL;

  console.log(failed ? `\n${failed} failed` : '\nAll passed');
  process.exit(failed ? 1 : 0);
})();
