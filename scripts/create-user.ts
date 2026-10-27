/**
 * Create (or reset) a dashboard login from the command line, for GYA:
 *   npx tsx scripts/create-user.ts <email> <password> <admin|editor> "<name>"
 * Needs DATABASE_URL and PAYLOAD_SECRET (from .env.local or the environment).
 */
import './load-env';
import { getPayload } from 'payload';
import config from '../payload.config';

const [email, password, role = 'editor', name = 'Website editor'] = process.argv.slice(2);
if (!email || !password || password.length < 10) {
  console.error('Usage: npx tsx scripts/create-user.ts <email> <password (10+ characters)> <admin|editor> "<name>"');
  process.exit(1);
}
const payload = await getPayload({ config });
const found = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, overrideAccess: true });
if (found.docs.length) {
  await payload.update({ collection: 'users', id: found.docs[0].id, data: { password, role: role as 'admin' | 'editor', name, loginAttempts: 0, lockUntil: null } as any, overrideAccess: true });
  console.log(`Updated ${email} (${role})`);
} else {
  await payload.create({ collection: 'users', data: { email, password, role: role as 'admin' | 'editor', name } as any, overrideAccess: true });
  console.log(`Created ${email} (${role})`);
}
process.exit(0);
