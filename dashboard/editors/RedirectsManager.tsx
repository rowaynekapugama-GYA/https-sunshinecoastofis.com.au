'use client';
import React, { useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../ui/Toast';
import { Select, TextInput } from '../ui/fields';

export function RedirectsManager({ initial }: { initial: any[] }) {
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [form, setForm] = useState({ from: '', to: '', type: '301', note: '' });
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="d-card" style={{ maxWidth: 860 }}>
        <h2>Add a redirect</h2>
        <div className="d-row">
          <TextInput label="From (old path on this site)" value={form.from} onChange={(from) => setForm({ ...form, from })} placeholder="/old-page/" />
          <TextInput label="To" value={form.to} onChange={(to) => setForm({ ...form, to })} placeholder="/services/ or https://…" />
        </div>
        <div className="d-row">
          <Select label="Type" value={form.type} onChange={(type) => setForm({ ...form, type })} options={[{ label: '301 permanent (usual)', value: '301' }, { label: '302 temporary', value: '302' }]} />
          <TextInput label="Note (optional)" value={form.note} onChange={(note) => setForm({ ...form, note })} />
        </div>
        <button
          className="d-btn primary"
          disabled={busy || !form.from || !form.to}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await api.post('/api/redirects', form);
              setRows([...rows, r.doc].sort((a, b) => a.from.localeCompare(b.from)));
              setForm({ from: '', to: '', type: '301', note: '' });
              toast('Redirect added.', 'success');
            } catch (e) {
              toast((e as Error).message, 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          Add redirect
        </button>
      </div>
      <div className="d-card tight">
        {rows.length ? (
          <table className="d-table">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Type</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.from}</td>
                  <td>{r.to}</td>
                  <td>{r.type}</td>
                  <td className="muted">{r.note}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="d-btn sm danger"
                      onClick={async () => {
                        if (!window.confirm(`Remove the redirect from ${r.from}?`)) return;
                        try {
                          await api.delete(`/api/redirects/${r.id}`);
                          setRows(rows.filter((x) => x.id !== r.id));
                        } catch (e) {
                          toast((e as Error).message, 'error');
                        }
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="d-empty">No redirects yet.</div>
        )}
      </div>
    </>
  );
}
