/**
 * SmileOX CRM intake. Run: npm run test:crm
 * Phone and name handling, which forms may send (only the two landing pages, 3.6.1), retries,
 * and the SMTP2GO fallback. Nothing is sent anywhere: the email sending is replaced in the test.
 */
import { brisbaneIso, CRM_FORMS, isTransient, sendLeadToCrm, splitName, toE164AU, type Lead } from '../lib/crm/intake';
import { LANDING_PAGE_RECIPIENTS, WEBSITE_FORM_RECIPIENTS } from '../lib/forms/recipients';

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

  // ---- which forms may send to SmileOX: the two landing pages only
  const contact = { firstName: 'Jane', lastName: 'Citizen', email: 'jane@example.com', phoneNumber: '+61412345678', enquiryType: 'All-on-4 / full arch', source: 'Google Ads landing page', pageType: 'dental-implants' } as unknown as Lead;
  ok(JSON.stringify([...CRM_FORMS].sort()) === '["lp-dental-implants","lp-wisdom-teeth"]', 'allow-list is exactly lp-dental-implants and lp-wisdom-teeth');
  for (const form of ['contact', 'referral', 'patient-form', 'feedback', 'contactForm', 'referralForm', 'patientForm', 'feedbackForm', 'lp-landing', 'test', '']) {
    let sent = false;
    const r0 = await sendLeadToCrm(contact, form, async () => { sent = true; });
    ok(r0.status === 'skipped' && !sent, `"${form || '(empty)'}" is refused, nothing sent to SmileOX`);
  }
  for (const form of ['lp-dental-implants', 'lp-wisdom-teeth']) {
    let sent = '';
    const r0 = await sendLeadToCrm(contact, form, async (j) => { sent = j; });
    ok(r0.status === 'sent' && sent === JSON.stringify(contact), `"${form}" is sent, payload unchanged`);
  }

  // ---- email recipients
  ok(JSON.stringify(WEBSITE_FORM_RECIPIENTS) === '["reception@sunshinecoastofis.com.au"]', 'website forms: reception only');
  ok(JSON.stringify(LANDING_PAGE_RECIPIENTS) === '["reception@sunshinecoastofis.com.au","rowayne@gyaclients.com"]', 'landing pages: reception and Rowayne');

  // ---- retries
  ok(isTransient({ responseCode: 421 }) && isTransient({ code: 'ETIMEDOUT' }) && isTransient({ code: 'ECONNRESET' }) && isTransient({ code: 'ECONNREFUSED' }) && isTransient({ status: 503 }), 'transient: SMTP 4xx, timeouts, reset, refused, HTTP 5xx');
  ok(!isTransient({ responseCode: 535 }) && !isTransient({ responseCode: 550 }) && !isTransient({ status: 400 }), 'not transient: SMTP 5xx (bad password, rejected), HTTP 400');
  let calls = 0;
  const flaky = async () => { calls++; if (calls < 3) throw Object.assign(new Error('Try again later'), { responseCode: 421 }); };
  let r = await sendLeadToCrm(contact, 'lp-wisdom-teeth', flaky);
  ok(r.status === 'sent' && r.attempts === 3, `421 twice then sent: ${r.status} after ${r.attempts} attempts`);
  calls = 0;
  r = await sendLeadToCrm(contact, 'lp-wisdom-teeth', async () => { calls++; throw Object.assign(new Error('Try again later'), { responseCode: 451 }); });
  ok(r.status === 'failed' && r.attempts === 4 && calls === 4, `always 4xx: gives up after ${r.attempts} attempts (1 + 3 retries)`);
  calls = 0;
  r = await sendLeadToCrm(contact, 'lp-wisdom-teeth', async () => { calls++; throw Object.assign(new Error('Authentication failed'), { responseCode: 535 }); });
  ok(r.status === 'failed' && calls === 1, 'wrong password (535): no retries');
  let body = '';
  r = await sendLeadToCrm(contact, 'lp-wisdom-teeth', async (j) => { body = j; });
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
  r = await sendLeadToCrm(contact, 'lp-dental-implants');
  globalThis.fetch = realFetch;
  const b = (req as unknown as { body: Record<string, unknown> })?.body || {};
  ok(r.status === 'sent' && r.via === 'smtp2go-api', 'no SMTP settings: sent through the existing SMTP2GO account');
  ok(JSON.stringify(b.to) === '["contact-submissions+50d8ee08-b736-4740-a84b-ae94788ca250@intake.smileox.com.au"]' && b.subject === 'Website form submission' && b.text_body === JSON.stringify(contact) && !('html_body' in b), 'SMTP2GO: intake address, subject, plain-text JSON body only');
  process.env.CRM_INTAKE_EMAIL = 'off';
  r = await sendLeadToCrm(contact, 'lp-dental-implants');
  ok(r.status === 'skipped', 'CRM_INTAKE_EMAIL=off turns the CRM off');
  delete process.env.CRM_INTAKE_EMAIL;

  console.log(failed ? `\n${failed} failed` : '\nAll passed');
  process.exit(failed ? 1 : 0);
})();
