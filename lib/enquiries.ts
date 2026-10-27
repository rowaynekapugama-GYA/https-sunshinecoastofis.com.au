/**
 * Store every form submission in the dashboard (Enquiries collection) as well
 * as emailing it. Best effort: if the database is not configured or is down,
 * the email path is unaffected and the visitor still sees success.
 */
export interface EnquiryRecord {
  form: 'contact' | 'referral' | 'patient-form' | 'feedback';
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  source: string;
  raw: Record<string, string>;
  emailStatus: 'sent' | 'failed' | 'skipped';
  emailError?: string;
}

export async function logEnquiry(rec: EnquiryRecord): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const [{ getPayload }, { default: config }] = await Promise.all([import('payload'), import('@payload-config')]);
    const payload = await getPayload({ config });
    await payload.create({ collection: 'enquiries', data: rec as any, overrideAccess: true });
  } catch (e) {
    console.error('[enquiries] not stored:', (e as Error).message);
  }
}
