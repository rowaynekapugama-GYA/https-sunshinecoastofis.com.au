/**
 * Local development reads .env / .env.local like Next does; on Vercel the real
 * environment variables are already present. Imported first, before the
 * Payload config, because ES module imports run in order.
 */
for (const f of ['.env', '.env.local']) {
  try {
    (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(f);
  } catch {
    /* file absent */
  }
}
export {};
