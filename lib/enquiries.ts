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
    const save = (async () => {
      const payload = await getPayload({ config });
      await payload.create({ collection: 'enquiries', data: rec as any, overrideAccess: true });
    })();
    // Give up after 20 seconds (a database waking up takes a few) rather than hang.
    await Promise.race([save, new Promise((_, reject) => setTimeout(() => reject(new Error('timed out after 20 s')), 20000))]);
  } catch (e) {
    console.error('[enquiries] not stored:', (e as Error).message);
  }
}
