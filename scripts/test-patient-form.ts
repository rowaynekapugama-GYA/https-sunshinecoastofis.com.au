/**
 * Patient information form rules (3.3.0). Run: npm run test:patient-form
 *
 * Checks the dd/mm/yyyy date fix, the Medicare / NA and NKA rules, that every required
 * field is refused by the server when missing, the notification email (first name and
 * surname as separate rows, DOB 05/11/1985) and how old and new records show in the dashboard.
 */
import { FORMS, prepareSubmission, type Fields } from '../lib/forms/definitions';
import { renderText } from '../lib/forms/email-body';
import { fieldLabel, fieldValue } from '../lib/forms/display';
import { isMedicareNumber, toAuDate } from '../lib/forms/rules';

let failed = 0;
const ok = (cond: boolean, what: string) => {
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${what}`);
};
const def = FORMS.patientForm;

// ---- dates
ok(toAuDate('1985-11-05') === '05/11/1985', 'date box value 1985-11-05 becomes 05/11/1985');
ok(toAuDate('5/11/1985') === '05/11/1985', 'typed 5/11/1985 becomes 05/11/1985');
ok(toAuDate('05/11/1985') === '05/11/1985', 'typed 05/11/1985 stays 05/11/1985 (never 11/05/1985)');
ok(toAuDate('31/02/1985') === null, '31/02/1985 is refused');
ok(toAuDate('') === '', 'empty stays empty');

// ---- Medicare
ok(isMedicareNumber('2123456701'), 'valid Medicare number accepted');
ok(isMedicareNumber('2123 45670 1'), 'valid Medicare number with spaces accepted');
ok(isMedicareNumber('21234567011'), 'Medicare number with the reference on the end accepted');
ok(!isMedicareNumber('2123456791'), 'Medicare number with a wrong check digit refused');
ok(!isMedicareNumber('12345'), 'short Medicare number refused');

// ---- a fully completed form
const full = (): Fields => ({
  first_name: 'Jane',
  surname: 'Citizen',
  dob: '1985-11-05',
  sex: 'Female',
  email: 'jane@example.com',
  phone_mobile: '0400 000 000',
  medicare_number: 'NA',
  medicare_reference: 'na',
  allergies: 'NKA',
  weight: '70 kg',
  height: '170 cm',
  smoker: 'No',
  alcohol: 'Yes',
  pregnant: 'Not applicable',
  fee_policy_agreed: 'Yes',
  fee_policy_name: 'Jane Citizen',
  fee_policy_date: '2026-11-05',
  consent_agreed: 'Yes',
  consent_name: 'Jane Citizen',
  consent_date: '2026-11-05',
  ai_agreed: 'Yes',
  ai_name: 'Jane Citizen',
  ai_date: '2026-11-05',
});
const f = full();
const errs = prepareSubmission(def, f);
ok(Object.keys(errs).length === 0, `complete form accepted with NA, na and NKA (${JSON.stringify(errs)})`);
ok(f.dob === '05/11/1985' && f.fee_policy_date === '05/11/2026', 'all dates stored as dd/mm/yyyy before the email is built');

const g = full();
g.medicare_number = '2123 45670 1';
g.medicare_reference = '1';
ok(Object.keys(prepareSubmission(def, g)).length === 0, 'real Medicare number and reference accepted');
const h = full();
h.medicare_number = '1234567890';
ok(Boolean(prepareSubmission(def, h).medicare_number), 'invalid Medicare number refused by the server');
const k = full();
k.dob = '2099-01-01';
ok(Boolean(prepareSubmission(def, k).dob), 'date of birth in the future refused');

// ---- every required field, missing, is refused by the server
for (const key of Object.keys(def.required || {})) {
  const x = full();
  delete x[key];
  const e = prepareSubmission(def, x);
  ok(Boolean(e[key]) && Object.keys(e).length === 1, `server refuses a submission without ${key}`);
}

// ---- notification email
const text = renderText(def, f, [], 'https://sunshinecoastofis.com.au/patient-information/patient-information-form/');
ok(text.includes('First Name: Jane') && text.includes('Surname: Citizen'), 'email has First Name and Surname as separate rows');
ok(text.includes('Date of Birth: 05/11/1985') && !text.includes('1985-11-05') && !text.includes('11/05/1985'), 'email shows Date of Birth: 05/11/1985');
ok(text.includes('Medicare: NA') && text.includes('Allergies: NKA'), 'email shows NA and NKA as entered');
ok(def.subject!(f) === 'Patient information form: Jane Citizen', 'email subject uses first name and surname');

// ---- dashboard and CSV display
ok(fieldLabel('patient-form', 'first_name') === 'First Name' && fieldLabel('patient-form', 'surname') === 'Surname', 'dashboard labels First Name and Surname');
ok(fieldLabel('patient-form', 'patient_name') === 'Patient Name', 'older record: Patient Name still labelled');
ok(fieldValue('patient-form', 'dob', '1985-11-05') === '05/11/1985', 'older record: yyyy-mm-dd DOB shown as 05/11/1985');
ok(fieldValue('patient-form', 'dob', '05/11/1985') === '05/11/1985', 'new record: DOB shown as 05/11/1985');
ok(fieldLabel('referral', 'patient_first_name') === 'Patient first name', 'referral records keep their existing labels');

console.log(failed ? `\n${failed} failed` : '\nAll passed');
process.exit(failed ? 1 : 0);
