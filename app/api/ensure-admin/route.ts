import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getPayload } from 'payload';
import config from '@payload-config';

/**
 * Sign-in rescue (the same pattern GYA uses on its other dashboards). When the email and password typed on the /admin login
 * exactly equal ADMIN_EMAIL and ADMIN_PASSWORD set in Vercel, that account is created (or its password
 * reset, role set to admin and any lock-out cleared) before the normal sign-in runs.
 *
 * Only someone who can edit the Vercel environment variables can use it. It says nothing about whether
 * an account exists. Delete ADMIN_PASSWORD in Vercel and redeploy to switch it off.
 */
export const dynamic = 'force-dynamic';

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function POST(req: Request) {
  const wantEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const wantPassword = process.env.ADMIN_PASSWORD || '';
  if (!wantEmail || wantPassword.length < 10) return NextResponse.json({ ok: true });
  let body: { email?: unknown; password?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!same(email, wantEmail) || !same(password, wantPassword)) return NextResponse.json({ ok: true });

  const payload = await getPayload({ config });
  const found = await payload.find({ collection: 'users', where: { email: { equals: wantEmail } }, limit: 1, overrideAccess: true });
  const existing = found.docs[0];
  if (existing) {
    await payload.update({ collection: 'users', id: existing.id, data: { password: wantPassword, role: 'admin' } as any, overrideAccess: true });
    await payload.unlock({ collection: 'users', data: { email: wantEmail, password: wantPassword }, overrideAccess: true }).catch(() => undefined);
  } else {
    await payload.create({ collection: 'users', data: { email: wantEmail, password: wantPassword, role: 'admin', name: 'GYA admin' } as any, overrideAccess: true });
  }
  return NextResponse.json({ ok: true });
}
