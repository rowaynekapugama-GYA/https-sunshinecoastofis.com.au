/**
 * The website's forms: what each one is called in the dashboard, the email subject,
 * and the rows of the notification email (label, form field). The Online Doctor
 * Referral email is built separately (referral-email.js) to match the practice's
 * existing referral emails exactly.
 */
import { isMedicareNumber, isMedicareRef, isNA, notInFuture, toAuDate } from './rules';

export type Fields = Record<string, string | string[]>;
type Row = [label: string, key: string | ((f: Fields) => string)];

export interface FormDef {
  /** Enquiries collection value */
  kind: 'contact' | 'referral' | 'patient-form' | 'feedback';
  label: string;
  legacy?: boolean;
  subject?: (f: Fields) => string;
  sections?: [title: string, rows: Row[]][];
  replyTo?: string;
  /**
   * Fields kept in the dashboard (Enquiries). Leave out to keep everything. The patient
   * information form holds Medicare numbers and medical history: those go to the practice
   * by email only and are not stored in the website's database.
   */
  store?: string[];
  /** Who the enquiry is from, for the Enquiries list. */
  summary: (f: Fields) => { name: string; email: string; phone: string; message: string };
  /** Date fields, turned into dd/mm/yyyy when the form arrives (see rules.ts toAuDate). */
  dates?: string[];
  /** Required fields and the message shown when one is missing. Checked on the server as well as in the browser. */
  required?: Record<string, string>;
  /** Further checks on fields that were filled in: field -> message. */
  check?: (f: Fields) => Record<string, string>;
}

/**
 * Server side of the form rules: dates become dd/mm/yyyy (in place), then every required
 * field and extra check is applied. Returns field -> message for anything wrong.
 */
export function prepareSubmission(def: FormDef, f: Fields): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const k of def.dates || []) {
    const raw = v(f, k);
    if (!raw) continue;
    const au = toAuDate(raw);
    if (au) f[k] = au;
    else errors[k] = 'Please enter a real date as dd/mm/yyyy.';
  }
  for (const [k, msg] of Object.entries(def.required || {})) {
    if (!errors[k] && !v(f, k).trim()) errors[k] = msg;
  }
  if (def.check) for (const [k, msg] of Object.entries(def.check(f))) if (!errors[k]) errors[k] = msg;
  return errors;
}

/** Now in Queensland time, e.g. "Tuesday 10 November 2026, 1:25 pm". */
export const brisbaneNow = (d = new Date()) =>
  new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(d);

export const v = (f: Fields, key: string | ((f: Fields) => string)): string => {
  const x = typeof key === 'function' ? key(f) : f[key];
  return Array.isArray(x) ? x.join(', ') : x || '';
};
const join = (...xs: (string | string[] | undefined)[]) => xs.map((x) => (Array.isArray(x) ? x.join(', ') : x || '')).filter(Boolean).join(' ');

const yn = (label: string, key: string): Row => [label, key];

export const FORMS: Record<string, FormDef> = {
  referralForm: {
    kind: 'referral',
    label: 'Online doctor referral',
    legacy: true,
    replyTo: 'doctor_email',
    summary: (f) => ({
      name: join(f.patient_first_name, f.patient_last_name),
      email: v(f, 'doctor_email'),
      phone: v(f, 'practice_contact_number'),
      message: `Referred by ${join(f.doctor_first_name, f.doctor_last_name) || 'unknown'}. ${v(f, 'reason_for_referral')}`.trim(),
    }),
  },
  contactForm: {
    kind: 'contact',
    label: 'Contact us',
    subject: (f) => `Website enquiry: ${join(f.first, f.last)}`.trim() + (f.topic ? ` (${v(f, 'topic')})` : ''),
    sections: [
      [
        'Enquiry',
        [
          ['Name', (f) => join(f.first, f.last)],
          ['Mobile', 'phone'],
          ['Email', 'email'],
          ['What can we help with?', 'topic'],
          ['Has a referral', 'referral'],
          ['Message', 'message'],
        ],
      ],
    ],
    replyTo: 'email',
    summary: (f) => ({ name: join(f.first, f.last), email: v(f, 'email'), phone: v(f, 'phone'), message: [v(f, 'topic'), v(f, 'message')].filter(Boolean).join(': ') }),
  },
  patientForm: {
    kind: 'patient-form',
    label: 'Patient information form',
    subject: (f) => `Patient information form: ${join(f.first_name, f.surname)}`,
    replyTo: 'email',
    store: ['first_name', 'surname', 'dob', 'phone_mobile', 'phone_landline', 'email', 'fee_policy_agreed', 'consent_agreed', 'ai_agreed'],
    dates: ['dob', 'parent_dob', 'fee_policy_date', 'consent_date', 'ai_date'],
    required: {
      first_name: 'Please enter your first name.',
      surname: 'Please enter your surname.',
      dob: 'Please enter your date of birth.',
      sex: 'Please choose an option.',
      medicare_number: "Please enter your Medicare number, or NA if you don't have a Medicare card.",
      medicare_reference: "Please enter your reference number, or NA if you don't have a Medicare card.",
      allergies: 'Please list any allergies, or NKA if you have no known allergies.',
      weight: 'Please enter your current weight.',
      height: 'Please enter your current height.',
      smoker: 'Please choose an option.',
      alcohol: 'Please choose an option.',
      pregnant: 'Please choose an option.',
      fee_policy_agreed: 'Please tick to accept the fee policy.',
      fee_policy_name: 'Please enter your full name.',
      fee_policy_date: "Please enter today's date.",
      consent_agreed: 'Please tick to give your consent.',
      consent_name: 'Please enter your full name.',
      consent_date: "Please enter today's date.",
      ai_agreed: 'Please tick to confirm you have read how AI is used.',
      ai_name: 'Please enter your full name.',
      ai_date: "Please enter today's date.",
    },
    check: (f) => {
      const e: Record<string, string> = {};
      const num = v(f, 'medicare_number');
      const ref = v(f, 'medicare_reference');
      if (num && !isNA(num) && !isMedicareNumber(num)) e.medicare_number = "Please check your Medicare number (10 digits on your card), or enter NA if you don't have one.";
      if (ref && !isNA(ref) && !isMedicareRef(ref)) e.medicare_reference = 'Please enter the number beside your name on the card (1 to 9), or NA.';
      const dob = v(f, 'dob');
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dob) && !notInFuture(dob)) e.dob = 'Please check your date of birth.';
      return e;
    },
    sections: [
      [
        'Patient Information',
        [
          ['First Name', 'first_name'],
          ['Surname', 'surname'],
          ['Date of Birth', 'dob'],
          ['Sex', 'sex'],
          ['Address', 'address'],
          ['Suburb', 'suburb'],
          ['Postcode', 'postcode'],
          ['Phone (L)', 'phone_landline'],
          ['Phone (M)', 'phone_mobile'],
          ['E-mail', 'email'],
          ['Occupation', 'occupation'],
          ['Medicare', 'medicare_number'],
          ['Reference', 'medicare_reference'],
          ['Expiry Date', 'medicare_expiry'],
        ],
      ],
      [
        "Parent's Medicare Card Details",
        [
          ['Parent Name', 'parent_name'],
          ['DOB', 'parent_dob'],
          ['Medicare #', 'parent_medicare_number'],
          ['Ref. #', 'parent_medicare_reference'],
          ['Expiry Date', 'parent_medicare_expiry'],
        ],
      ],
      [
        'Patient Health Fund',
        [
          ['Patient Health Fund', 'health_fund'],
          ['Member', 'health_fund_member'],
          yn('Waiting period served', 'waiting_period'),
          yn('Hospital cover', 'hospital_cover'),
          yn('Covered for dental & medical procedures in hospital', 'dental_medical_cover'),
          yn('DVA', 'dva'),
          yn('Workcover', 'workcover'),
        ],
      ],
      ['Next of Kin', [['Next of Kin', 'next_of_kin'], ['Relationship', 'next_of_kin_relationship'], ['Phone', 'next_of_kin_phone']]],
      [
        'Medical History',
        [
          ['Conditions', 'conditions'],
          ['Other Medical Conditions', 'other_conditions'],
          ['Previous Surgical Procedures', 'previous_surgery'],
          ['Current Regular Medications', 'medications'],
          ['Allergies', 'allergies'],
          yn('Weight-loss medications (such as Ozempic)', 'weight_loss_medication'),
          yn('Difficulties with anaesthetics in the past', 'anaesthetic_difficulties'),
          ['Current weight', 'weight'],
          ['Current height', 'height'],
          yn('Able to take NSAIDs (Nurofen)', 'nsaids'),
          yn('Blood thinners', 'blood_thinners'),
          yn('Drugs for your bones', 'bone_drugs'),
          yn('Radiotherapy to the head or neck', 'radiotherapy'),
          ['When and where radiotherapy', 'radiotherapy_details'],
          yn('Smoker', 'smoker'),
          ['Cigarettes per day', 'cigarettes_per_day'],
          yn('Drinks alcohol', 'alcohol'),
          ['Glasses per week', 'alcohol_per_week'],
          yn('Could be pregnant', 'pregnant'),
          ['Name of GP', 'gp_name'],
          ['Name of Dentist', 'dentist_name'],
        ],
      ],
      ['Acknowledgement of fee policy', [['Accepted', 'fee_policy_agreed'], ['Full name', 'fee_policy_name'], ['Date', 'fee_policy_date'], ['Parent or guardian', 'fee_policy_guardian']]],
      ['Consent to collect patient information', [['Consent given', 'consent_agreed'], ['Full name', 'consent_name'], ['Date', 'consent_date'], ['Parent or guardian', 'consent_guardian']]],
      ['Use of AI in your care', [['Acknowledged', 'ai_agreed'], ['Full name', 'ai_name'], ['Date', 'ai_date'], ['Parent or guardian', 'ai_guardian']]],
    ],
    summary: (f) => ({ name: join(f.first_name, f.surname), email: v(f, 'email'), phone: v(f, 'phone_mobile') || v(f, 'phone_landline'), message: 'Patient information form. The full form was emailed to the practice (medical details are not stored on the website).' }),
  },
  // /feedback/ star rating (3.7.0): a 1 to 4 star rating opens this form; 5 stars goes to Google instead.
  feedbackForm: {
    kind: 'feedback',
    label: 'Feedback',
    subject: (f) => `Patient feedback – ${v(f, 'rating')}/5 – ${v(f, 'name')}`,
    replyTo: 'email',
    sections: [['Patient feedback', [
      ['Rating', (f) => `${v(f, 'rating')}/5`],
      ['Name', 'name'],
      ['Email', 'email'],
      ['Phone', 'phone'],
      ['Would like us to contact them', 'contact_me'],
      ['Feedback', 'message'],
      ['Date and time (Brisbane)', () => brisbaneNow()],
    ]]],
    required: { rating: 'Please choose a star rating.', name: 'Please enter your name.', email: 'Please enter your email address.', message: 'Please tell us about your experience.' },
    check: (f) => {
      const e: Record<string, string> = {};
      if (v(f, 'rating') && !/^[1-5]$/.test(v(f, 'rating'))) e.rating = 'Please choose a star rating from 1 to 5.';
      if (v(f, 'email') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v(f, 'email').trim())) e.email = 'Please enter a valid email address.';
      return e;
    },
    summary: (f) => ({ name: v(f, 'name'), email: v(f, 'email'), phone: v(f, 'phone'), message: `Rating ${v(f, 'rating')}/5. ${v(f, 'message')}` }),
  },
};
