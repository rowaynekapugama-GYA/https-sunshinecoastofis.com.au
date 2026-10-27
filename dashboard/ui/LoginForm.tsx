'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          // Sign-in rescue: only does anything when these match ADMIN_EMAIL / ADMIN_PASSWORD in Vercel.
          await fetch('/api/ensure-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password }) }).catch(() => undefined);
          const res = await fetch('/api/users/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password }) });
          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            setError(d?.errors?.[0]?.message || 'That email or password is not right. Please try again.');
            return;
          }
          router.push('/admin');
          router.refresh();
        } catch {
          setError('Could not reach the server. Please try again.');
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <div className="d-notice danger">{error}</div>}
      <div className="d-field">
        <label htmlFor="email">Email</label>
        <input id="email" className="d-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="d-field">
        <label htmlFor="password">Password</label>
        <input id="password" className="d-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <button className="d-btn primary" type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="d-help" style={{ textAlign: 'center', marginTop: 14 }}>
        Forgotten your password? Ask GYA to reset it.
      </p>
    </form>
  );
}
