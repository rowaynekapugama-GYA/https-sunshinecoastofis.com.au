/**
 * How stored form fields are shown in the dashboard (Enquiries) and the CSV export.
 *
 * Patient information form records get the same labels as the notification email and
 * Australian dates. That includes records saved before 3.3.0, which have a single
 * "Patient Name" field and dates as yyyy-mm-dd. Other forms keep their existing display.
 */
import { FORMS } from './definitions';
import { toAuDate } from './rules';

const plain = (k: string) => (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ');

const PATIENT_LABELS: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [, rows] of FORMS.patientForm.sections || []) for (const [label, key] of rows) if (typeof key === 'string') out[key] = label;
  return {
    ...out,
    patient_name: 'Patient Name', // before 3.3.0 the name was one field
    fee_policy_agreed: 'Fee policy accepted',
    consent_agreed: 'Consent given',
    ai_agreed: 'AI use acknowledged',
    attachments: 'Attachments',
  };
})();
const PATIENT_DATES = new Set(FORMS.patientForm.dates || []);

/** Label for a stored field. */
export function fieldLabel(form: string, key: string): string {
  if (form === 'patient-form') return PATIENT_LABELS[key] || plain(key);
  return plain(key);
}

/** Value for display: patient form dates as dd/mm/yyyy, whatever format they were saved in. */
export function fieldValue(form: string, key: string, value: unknown): string {
  const s = String(value ?? '');
  if (form === 'patient-form' && PATIENT_DATES.has(key)) return toAuDate(s) || s;
  return s;
}
