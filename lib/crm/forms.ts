/**
 * Which website form fields go to the SmileOX CRM.
 *
 * Only the details needed to follow up an enquiry are sent: name, email, phone, what it is
 * about and where it came from. Health information is never sent to the CRM: no dates of
 * birth, Medicare numbers, medical history, medications, referral reasons, clinical notes or
 * attachments. Those stay in the email to the practice, as before.
 *
 *   Contact us                  -> lead: name, email, phone, service, has a referral, message
 *   Online doctor referral      -> lead (the patient): name, email, phone, plus the referring
 *                                  doctor and practice contact, preferred surgeon, urgent, referral date
 *   Patient information form    -> lead: name, email, phone (a patient who has booked)
 *   Feedback                    -> not sent (not an enquiry)
 *
 * To send another field, add it to the form's entry below.
 */
import { v, type Fields, type FormDef } from '../forms/definitions';
import { brisbaneIso, cleanPageUrl, compact, isEmail, toE164AU, utmFrom, type Lead } from './intake';

export const CRM_FORM_NAMES: Record<string, string> = {
  contact: 'Contact us',
  referral: 'Online doctor referral',
  'patient-form': 'Patient information form',
};

const list = (f: Fields, k: string) => ([] as string[]).concat(f[k] || []).filter(Boolean).join(', ');

/** The base fields, with the phone in E.164. A phone that isn't a valid AU number is kept as typed. */
function contactFields(first: string, last: string, email: string, phone: string) {
  const e164 = toE164AU(phone);
  return {
    firstName: first,
    lastName: last,
    email: isEmail(email) ? email.trim().toLowerCase() : '',
    phoneNumber: e164 || '',
    phoneAsEntered: e164 ? '' : phone,
  };
}

/** The CRM lead for a website form submission, or null when that form is not sent to the CRM. */
export function leadFromForm(def: FormDef, f: Fields, submittedAt = new Date()): Lead | null {
  const page = v(f, 'page');
  const utmExtra: Record<string, string> = {};
  for (const k of Object.keys(f)) if (k.startsWith('utm_')) utmExtra[k] = v(f, k);
  const common = {
    formName: CRM_FORM_NAMES[def.kind],
    pageUrl: cleanPageUrl(page),
    submittedAt: brisbaneIso(submittedAt),
    ...utmFrom(page, utmExtra),
  };

  let lead: Record<string, unknown>;
  switch (def.kind) {
    case 'contact':
      lead = {
        ...contactFields(v(f, 'first'), v(f, 'last'), v(f, 'email'), v(f, 'phone')),
        service: v(f, 'topic'),
        hasReferral: v(f, 'referral'),
        message: v(f, 'message'),
      };
      break;
    case 'referral':
      lead = {
        ...contactFields(v(f, 'patient_first_name'), v(f, 'patient_last_name'), v(f, 'patient_email'), v(f, 'patient_contact')),
        newOrExistingPatient: 'New patient (referred)',
        referringDoctor: [v(f, 'doctor_first_name'), v(f, 'doctor_last_name')].filter(Boolean).join(' '),
        referringPracticePhone: toE164AU(v(f, 'practice_contact_number')) || v(f, 'practice_contact_number'),
        referringDoctorEmail: isEmail(v(f, 'doctor_email')) ? v(f, 'doctor_email') : '',
        preferredSurgeon: list(f, 'preferred_specialist'),
        urgent: v(f, 'urgent') ? 'Yes' : '',
        referralDate: v(f, 'referral_date'),
      };
      break;
    case 'patient-form':
      lead = {
        ...contactFields(v(f, 'first_name'), v(f, 'surname'), v(f, 'email'), v(f, 'phone_mobile') || v(f, 'phone_landline')),
        newOrExistingPatient: 'Booked patient (patient information form)',
      };
      break;
    default:
      return null; // feedback and anything else
  }
  const out = compact({ ...lead, ...common });
  // Without an email or a phone number SmileOX can't create or match a lead.
  return out.email || out.phoneNumber || out.phoneAsEntered ? out : null;
}
