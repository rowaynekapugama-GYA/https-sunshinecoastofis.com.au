/**
 * The website's forms: what each one is called in the dashboard, the email subject,
 * and the rows of the notification email (label, form field). The Online Doctor
 * Referral email is built separately (referral-email.js) to match the practice's
 * existing referral emails exactly.
 */
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
}

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
    subject: (f) => `Patient information form: ${v(f, 'patient_name')}`,
    replyTo: 'email',
    store: ['patient_name', 'dob', 'phone_mobile', 'phone_landline', 'email', 'fee_policy_agreed', 'consent_agreed', 'ai_agreed'],
    sections: [
      [
        'Patient Information',
        [
          ['Patient Name', 'patient_name'],
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
    summary: (f) => ({ name: v(f, 'patient_name'), email: v(f, 'email'), phone: v(f, 'phone_mobile') || v(f, 'phone_landline'), message: 'Patient information form. The full form was emailed to the practice (medical details are not stored on the website).' }),
  },
  feedbackForm: {
    kind: 'feedback',
    label: 'Feedback',
    subject: (f) => `Website feedback: ${v(f, 'name')}`,
    replyTo: 'email',
    sections: [['Feedback', [['Name', 'name'], ['Email', 'email'], ['Phone', 'phone'], ['Feedback', 'message'], ['Would like a reply', 'contact_me']]]],
    summary: (f) => ({ name: v(f, 'name'), email: v(f, 'email'), phone: v(f, 'phone'), message: v(f, 'message') }),
  },
};
