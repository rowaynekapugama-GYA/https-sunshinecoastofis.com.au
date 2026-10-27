'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { useToast } from '../ui/Toast';
import { Check, TextArea } from '../ui/fields';

export function EnquiryActions({ id, followedUp: initialDone, notes: initialNotes }: { id: number | string; followedUp: boolean; notes: string }) {
  const router = useRouter();
  const toast = useToast();
  const [done, setDone] = useState(initialDone);
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <Check label="Followed up" checked={done} onChange={setDone} help="Tick once someone has called or replied." />
      <TextArea label="Notes" value={notes} onChange={setNotes} rows={5} help="For the team, for example: booked for 3 Dec, wants a Monday evening." />
      <div className="d-actions">
        <button
          className="d-btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api.patch(`/api/enquiries/${id}`, { followedUp: done, notes });
              toast('Saved.', 'success');
              router.refresh();
            } catch (e) {
              toast((e as Error).message, 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
