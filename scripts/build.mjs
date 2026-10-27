/**
 * Production build, in order:
 *   1. database migrations (only when DATABASE_URL is set; no-op when up to date)
 *   2. pull the latest dashboard content into /content
 *   3. next build (every public page pre-rendered to plain HTML)
 *
 * Steps 2 and 3 never fail the build on their own: a missing or unreachable
 * database means the site builds from the files committed in the repo.
 */
import { spawnSync } from 'node:child_process';

const run = (cmd, args, { allowFail = false } = {}) => {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0 && !allowFail) process.exit(r.status ?? 1);
  return r.status === 0;
};

if (process.env.DATABASE_URL) {
  const ok = run('npx', ['payload', 'migrate', '--force-accept-warning'], { allowFail: true });
  if (!ok) console.warn('[build] migrations failed; continuing with the content files in the repo');
  run('npx', ['tsx', 'scripts/pull-content.ts'], { allowFail: true });
} else {
  console.log('[build] DATABASE_URL not set: skipping migrations and content pull');
}

run('npx', ['next', 'build']);
