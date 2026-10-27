'use client';
import React, { useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../ui/Toast';
import { Modal, Select, TextInput } from '../ui/fields';

type U = { id: number | string; name?: string; email: string; role: string };

export function UsersManager({ initial, me }: { initial: U[]; me: string }) {
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [form, setForm] = useState({ name: '', email: '', role: 'editor', password: '' });
  const [reset, setReset] = useState<U | null>(null);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="d-card" style={{ maxWidth: 860 }}>
        <h2>Add a user</h2>
        <div className="d-row">
          <TextInput label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <TextInput label="Email" value={form.email} onChange={(email) => setForm({ ...form, email })} type="email" />
        </div>
        <div className="d-row">
          <Select label="Role" value={form.role} onChange={(role) => setForm({ ...form, role })} options={[{ label: 'Editor (practice team)', value: 'editor' }, { label: 'Admin (GYA)', value: 'admin' }]} />
          <TextInput label="Password" value={form.password} onChange={(password) => setForm({ ...form, password })} type="text" help="At least 10 characters. Send it to them securely; they can be given a new one here any time." />
        </div>
        <button
          className="d-btn primary"
          disabled={busy || !form.email || form.password.length < 10 || !form.name}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await api.post('/api/users', form);
              setRows([...rows, { id: r.doc.id, name: r.doc.name, email: r.doc.email, role: r.doc.role }]);
              setForm({ name: '', email: '', role: 'editor', password: '' });
              toast('User added.', 'success');
            } catch (e) {
              toast((e as Error).message, 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          Add user
        </button>
      </div>
      <div className="d-card tight">
        <table className="d-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.name}</strong>
                  {String(u.id) === me ? <span className="d-badge info" style={{ marginLeft: 8 }}>You</span> : null}
                </td>
                <td>{u.email}</td>
                <td>{u.role === 'admin' ? <span className="d-badge info">Admin (GYA)</span> : <span className="d-badge">Editor</span>}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="d-btn sm" onClick={() => (setReset(u), setPw(''))}>
                    Set new password
                  </button>{' '}
                  {String(u.id) !== me && (
                    <button
                      className="d-btn sm danger"
                      onClick={async () => {
                        if (!window.confirm(`Remove ${u.email}? They will no longer be able to sign in.`)) return;
                        try {
                          await api.delete(`/api/users/${u.id}`);
                          setRows(rows.filter((x) => x.id !== u.id));
                        } catch (e) {
                          toast((e as Error).message, 'error');
                        }
                      }}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {reset && (
        <Modal
          title={`New password for ${reset.email}`}
          small
          onClose={() => setReset(null)}
          footer={
            <>
              <button className="d-btn" onClick={() => setReset(null)}>
                Cancel
              </button>
              <button
                className="d-btn primary"
                disabled={pw.length < 10 || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api.patch(`/api/users/${reset.id}`, { password: pw });
                    toast('Password updated.', 'success');
                    setReset(null);
                  } catch (e) {
                    toast((e as Error).message, 'error');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Save password
              </button>
            </>
          }
        >
          <TextInput label="New password" value={pw} onChange={setPw} type="text" help="At least 10 characters." />
        </Modal>
      )}
    </>
  );
}
