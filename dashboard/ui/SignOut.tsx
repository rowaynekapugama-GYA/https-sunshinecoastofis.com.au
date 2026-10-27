'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from './Icons';

export function SignOut() {
  const router = useRouter();
  const Out = Icons.logout;
  return (
    <button
      type="button"
      className="d-btn ghost sm"
      style={{ color: '#fff', marginTop: 8, paddingLeft: 0 }}
      onClick={async () => {
        await fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
        router.push('/admin/login');
        router.refresh();
      }}
    >
      <Out /> Sign out
    </button>
  );
}
