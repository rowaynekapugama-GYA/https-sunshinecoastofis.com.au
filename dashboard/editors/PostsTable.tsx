'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { useToast } from '../ui/Toast';

type Row = { id: number | string; title: string; slug: string; status: string; publishedAt?: string; updatedAt: string };
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function PostsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | number | null>(null);
  const act = async (id: Row['id'], fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try {
      await fn();
      toast(ok, 'success');
      router.refresh();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };
  if (!rows.length) return <div className="d-card d-empty">No articles yet. Click Write a new article to start the blog.</div>;
  return (
    <div className="d-card tight">
      <table className="d-table">
        <thead>
          <tr>
            <th>Article</th>
            <th>Status</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link className="title" href={`/admin/posts/${r.id}`}>
                  {r.title}
                </Link>
                <div className="muted">/blog/{r.slug}/</div>
              </td>
              <td>{r.status === 'published' ? <span className="d-badge ok">Published</span> : <span className="d-badge">Draft</span>}</td>
              <td className="muted">{fmt(r.publishedAt || r.updatedAt)}</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <Link className="d-btn sm" href={`/admin/posts/${r.id}`}>
                  Edit
                </Link>{' '}
                {r.status === 'published' ? (
                  <button className="d-btn sm ghost" disabled={busy === r.id} onClick={() => act(r.id, () => api.patch(`/api/posts/${r.id}`, { _status: 'draft' }), 'Article unpublished. It leaves the site at the next Publish website.')}>
                    Unpublish
                  </button>
                ) : (
                  <button className="d-btn sm ghost" disabled={busy === r.id} onClick={() => act(r.id, () => api.patch(`/api/posts/${r.id}`, { _status: 'published' }), 'Article published in the dashboard.')}>
                    Publish
                  </button>
                )}{' '}
                <button className="d-btn sm danger" disabled={busy === r.id} onClick={() => window.confirm(`Delete "${r.title}"? This cannot be undone.`) && act(r.id, () => api.delete(`/api/posts/${r.id}`), 'Article deleted.')}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
