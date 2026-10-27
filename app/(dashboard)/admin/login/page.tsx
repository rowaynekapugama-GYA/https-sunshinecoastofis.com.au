import { redirect } from 'next/navigation';
import { getUser } from '@/dashboard/lib/auth';
import { LoginForm } from '@/dashboard/ui/LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const user = await getUser();
  if (user) redirect('/admin');
  const { expired } = await searchParams;
  return (
    <div className="d-login">
      <div className="d-login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/images/logo.png" alt="Sunshine Coast Oral, Facial & Implant Specialists" />
        <h1>Website dashboard</h1>
        {expired && <div className="d-notice warn">Your session ended. Please sign in again.</div>}
        <LoginForm />
      </div>
    </div>
  );
}
