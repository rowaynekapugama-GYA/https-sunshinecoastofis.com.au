/**
 * Load the content files into the dashboard from the command line.
 *   npm run seed              adds anything missing, keeps dashboard edits
 *   npm run seed -- --reset   replaces pages, team and settings from the files
 * The dashboard has the same two actions as buttons (admin only).
 */
import './load-env';
import { getPayload } from 'payload';
import config from '../payload.config';
import { importContent } from '../cms/importContent';

const payload = await getPayload({ config });
const report = await importContent(payload, { overwrite: process.argv.includes('--reset') });
console.log(JSON.stringify(report, null, 2));
// process.exit rather than pool.end(): the pool does not always drain after a schema push.
process.exit(0);
