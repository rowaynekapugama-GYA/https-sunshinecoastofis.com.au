'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, mediaSrc, stripDoc } from '../lib/api';
import { useToast } from '../ui/Toast';
import { Check, Modal, TextArea, TextInput } from '../ui/fields';
import { SortableList, DragHandle } from '../ui/Sortable';
import { MediaPicker, type MediaDoc } from '../ui/MediaPicker';
import { StringListEditor, withId, newId } from './listEditors';
import { decode, encodeText } from './wording';

const EMPTY_STAFF = { kind: 'staff', name: '', role: '', hidden: false, photoTop: false };
const EMPTY_SURGEON = { kind: 'surgeon', name: '', roleLine: '', lede: '', tags: [], facts: [{ title: '', text: '' }, { title: '', text: '' }, { title: '', text: '' }], columns: [], storyLabel: '', story: [], hidden: false, photoAlt: '' };

/** Wording is stored as page HTML: show it plain, save it safely. */
const t = (s: unknown) => decode(String(s ?? ''));
const e = (s: string) => encodeText(s);
const rowsIn = (list: any[] | undefined) => (list || []).map((r) => withId({ ...r, value: t(r.value) }));
const rowsOut = (list: any[] | undefined) => (list || []).map((r) => ({ id: r.id, value: e(r.value) }));

function Photo({ row }: { row: any }) {
  const src = row.photo && typeof row.photo === 'object' ? mediaSrc(row.photo) : row.photoPath || '';
  return <div style={{ width: 56, height: 56, borderRadius: 12, flex: 'none', background: src ? `#e7edf3 center/cover url("${src}")` : '#e7edf3' }} aria-hidden="true" />;
}

function List({ title, help, rows, onReorder, onEdit, onToggle, onAdd, addLabel }: { title: string; help: string; rows: any[]; onReorder: (r: any[]) => void; onEdit: (r: any) => void; onToggle: (r: any) => void; onAdd: () => void; addLabel: string }) {
  return (
    <div className="d-card tight" style={{ marginBottom: 22 }}>
      <div style={{ padding: '16px 20px 6px' }}>
        <h2 style={{ marginBottom: 4 }}>{title}</h2>
        <div className="d-help" style={{ marginTop: 0 }}>
          {help}
        </div>
      </div>
      <SortableList items={rows} getId={(r) => String(r.id)} onReorder={onReorder}>
        {(r) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: '1px solid var(--d-line)', opacity: r.hidden ? 0.55 : 1 }}>
            <DragHandle />
            <Photo row={r} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{t(r.name)}</strong>
              <div className="muted" style={{ fontSize: 13, color: 'var(--d-muted)' }}>
                {t(r.kind === 'surgeon' ? r.roleLine : r.role)}
                {!r.photo && !r.photoPath ? ' · photo coming soon' : ''}
                {r.hidden ? ' · hidden from the website' : ''}
              </div>
            </div>
            <button className="d-btn sm" onClick={() => onEdit(r)}>
              Edit
            </button>
            <button className="d-btn sm ghost" onClick={() => onToggle(r)}>
              {r.hidden ? 'Show' : 'Hide'}
            </button>
          </div>
        )}
      </SortableList>
      <div style={{ padding: 14 }}>
        <button className="d-add" onClick={onAdd}>
          + {addLabel}
        </button>
      </div>
    </div>
  );
}

export function TeamManager({ initial }: { initial: any[] }) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<any[]>(initial);
  const [edit, setEdit] = useState<any | null>(null);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const surgeons = rows.filter((r) => r.kind === 'surgeon').sort((a, b) => a.order - b.order);
  const staff = rows.filter((r) => r.kind !== 'surgeon').sort((a, b) => a.order - b.order);

  const reorder = async (list: any[], offset: number) => {
    const next = list.map((r, i) => ({ ...r, order: offset + i + 1 }));
    setRows([...rows.filter((r) => !next.some((n) => n.id === r.id)), ...next]);
    try {
      await Promise.all(next.map((r) => api.patch(`/api/team/${r.id}`, { order: r.order })));
      toast('Order saved. Publish website when you are ready.', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };
  const toggle = async (r: any) => {
    try {
      const res = await api.patch(`/api/team/${r.id}?depth=1`, { hidden: !r.hidden });
      setRows(rows.map((x) => (x.id === r.id ? res.doc : x)));
      toast(res.doc.hidden ? `${t(r.name)} is hidden from the website.` : `${t(r.name)} is shown on the website.`, 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };
  const open = (r: any) =>
    setEdit({
      ...r,
      name: t(r.name),
      role: t(r.role),
      roleLine: t(r.roleLine),
      lede: t(r.lede),
      storyLabel: t(r.storyLabel),
      photoAlt: t(r.photoAlt),
      tags: rowsIn(r.tags),
      story: rowsIn(r.story),
      credentials: rowsIn(r.credentials),
      knowsAbout: rowsIn(r.knowsAbout),
      facts: (r.facts || []).map((f: any) => withId({ ...f, title: t(f.title), text: t(f.text) })),
      columns: (r.columns || []).map((c: any) => withId({ ...c, heading: t(c.heading), paragraph: t(c.paragraph), items: rowsIn(c.items) })),
    });
  const save = async () => {
    if (!edit.name.trim()) return toast('A name is required.', 'error');
    setBusy(true);
    try {
      const body: any = {
        ...stripDoc(edit),
        name: e(edit.name),
        role: e(edit.role || ''),
        roleLine: e(edit.roleLine || ''),
        lede: e(edit.lede || ''),
        storyLabel: e(edit.storyLabel || ''),
        photoAlt: e(edit.photoAlt || ''),
        tags: rowsOut(edit.tags),
        story: rowsOut(edit.story),
        credentials: rowsOut(edit.credentials),
        knowsAbout: rowsOut(edit.knowsAbout),
        facts: (edit.facts || []).filter((f: any) => f.title.trim()).map((f: any) => ({ id: f.id, title: e(f.title), text: e(f.text || '') })),
        columns: (edit.columns || []).filter((c: any) => c.heading.trim()).map((c: any) => ({ id: c.id, heading: e(c.heading), paragraph: e(c.paragraph || ''), items: rowsOut(c.items) })),
        photo: edit.photo && typeof edit.photo === 'object' ? edit.photo.id : edit.photo || null,
        key: edit.key || t(edit.name).toLowerCase().replace(/^dr\s+/, '').replace(/[^a-z0-9]+/g, '-').split('-')[0] || newId(),
      };
      const same = rows.filter((r) => (r.kind === 'surgeon') === (edit.kind === 'surgeon'));
      const res = edit.id ? await api.patch(`/api/team/${edit.id}?depth=1`, body) : await api.post(`/api/team?depth=1`, { ...body, order: (edit.kind === 'surgeon' ? 0 : 100) + same.length + 1 });
      setRows(edit.id ? rows.map((x) => (x.id === edit.id ? res.doc : x)) : [...rows, res.doc]);
      setEdit(null);
      toast('Saved. Publish website when you are ready.', 'success');
      router.refresh();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!edit?.id || !window.confirm(`Remove ${edit.name} from the website for good? Use Hide instead if they may come back.`)) return;
    setBusy(true);
    try {
      await api.delete(`/api/team/${edit.id}`);
      setRows(rows.filter((x) => x.id !== edit.id));
      setEdit(null);
      toast('Removed.', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const photo = edit?.photo && typeof edit.photo === 'object' ? (edit.photo as MediaDoc) : null;
  const up = (patch: Record<string, unknown>) => setEdit({ ...edit, ...patch });

  return (
    <>
      <List
        title="Surgeons"
        help="The full bios on Our practice. Qualifications and titles exactly as the surgeons supply them."
        rows={surgeons}
        onReorder={(l) => reorder(l, 0)}
        onEdit={open}
        onToggle={toggle}
        onAdd={() => open(EMPTY_SURGEON)}
        addLabel="Add a surgeon"
      />
      <List title="Practice team" help="The photo cards under The team who will look after you, in this order. Someone without a photo shows a silhouette until one is added." rows={staff} onReorder={(l) => reorder(l, 100)} onEdit={open} onToggle={toggle} onAdd={() => open(EMPTY_STAFF)} addLabel="Add a team member" />

      {edit && (
        <Modal
          title={edit.id ? `Edit ${edit.name}` : edit.kind === 'surgeon' ? 'Add a surgeon' : 'Add a team member'}
          onClose={() => setEdit(null)}
          footer={
            <>
              {edit.id && (
                <button className="d-btn danger" onClick={remove} disabled={busy}>
                  Remove
                </button>
              )}
              <div className="d-topbar-spacer" />
              <button className="d-btn ghost" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button className="d-btn primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <div className="d-image" style={{ marginBottom: 16 }}>
            <div className="d-image-thumb" style={{ backgroundImage: photo ? `url("${mediaSrc(photo)}")` : edit.photoPath ? `url("${edit.photoPath}")` : undefined }} />
            <div className="d-image-info">
              <div className="src">{photo ? `Library photo: ${photo.alt || photo.filename}` : edit.photoPath ? 'Photo built into the site' : 'No photo yet (a silhouette is shown)'}</div>
              <div className="d-actions">
                <button type="button" className="d-btn sm" onClick={() => setPick(true)}>
                  Choose from library / Upload
                </button>
                {photo && (
                  <button type="button" className="d-btn sm ghost" onClick={() => up({ photo: null })}>
                    {edit.photoPath ? 'Use the built-in photo' : 'Remove photo'}
                  </button>
                )}
              </div>
              <div className="d-help">Portrait photos work best: 4 wide by 5 tall, at least 800 pixels wide.</div>
            </div>
          </div>
          <TextInput label="Name" value={edit.name} onChange={(name) => up({ name })} placeholder={edit.kind === 'surgeon' ? 'Dr Firstname Lastname' : 'Taylor'} />
          {edit.kind !== 'surgeon' ? (
            <>
              <TextInput label="Role" value={edit.role || ''} onChange={(role) => up({ role })} placeholder="Surgical Assistant" />
              <Check label="Line the photo up from the top" checked={Boolean(edit.photoTop)} onChange={(photoTop) => up({ photoTop })} help="Tick it if the top of the head is cut off on the website." />
            </>
          ) : (
            <>
              <TextInput label="Photo alt text" value={edit.photoAlt || ''} onChange={(photoAlt) => up({ photoAlt })} placeholder="Dr Firstname Lastname" />
              <TextArea label="Role and qualifications line" value={edit.roleLine || ''} onChange={(roleLine) => up({ roleLine })} rows={2} help="Exactly as the surgeon supplies it, for example: Oral & Maxillofacial Surgeon, Co-owner. MBBS, BDS, FRACDS (OMS)" />
              <TextArea label="Introduction" value={edit.lede || ''} onChange={(lede) => up({ lede })} rows={4} help="AHPRA: describe training and experience, never use words like expert, best or leading." />
              <div className="d-field">
                <span className="d-label">Areas of focus (the small tags)</span>
                <StringListEditor value={edit.tags} onChange={(tags) => up({ tags })} itemLabel="Tag" rows={1} />
              </div>
              <div className="d-field">
                <span className="d-label">Three key facts</span>
                {(edit.facts || []).map((f: any, i: number) => (
                  <div className="d-row" key={f.id}>
                    <TextInput label={`Fact ${i + 1}: figure or title`} value={f.title} onChange={(title) => up({ facts: edit.facts.map((x: any, j: number) => (j === i ? { ...x, title } : x)) })} />
                    <TextInput label="Line under it" value={f.text} onChange={(text) => up({ facts: edit.facts.map((x: any, j: number) => (j === i ? { ...x, text } : x)) })} />
                  </div>
                ))}
              </div>
              <div className="d-field">
                <span className="d-label">Columns (for example Training, Research, Beyond the clinic)</span>
                {(edit.columns || []).map((c: any, i: number) => (
                  <div key={c.id} className="d-group" style={{ border: '1px solid var(--d-line)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                    <TextInput label="Column heading" value={c.heading} onChange={(heading) => up({ columns: edit.columns.map((x: any, j: number) => (j === i ? { ...x, heading } : x)) })} />
                    <span className="d-label">Points</span>
                    <StringListEditor value={c.items} onChange={(items) => up({ columns: edit.columns.map((x: any, j: number) => (j === i ? { ...x, items } : x)) })} itemLabel="Point" />
                    {!c.items?.length && <TextArea label="Or a short paragraph" value={c.paragraph || ''} onChange={(paragraph) => up({ columns: edit.columns.map((x: any, j: number) => (j === i ? { ...x, paragraph } : x)) })} />}
                    <button type="button" className="d-btn sm ghost" onClick={() => up({ columns: edit.columns.filter((_: any, j: number) => j !== i) })}>
                      Remove this column
                    </button>
                  </div>
                ))}
                <button type="button" className="d-add" onClick={() => up({ columns: [...(edit.columns || []), { id: newId(), heading: '', items: [], paragraph: '' }] })}>
                  + Add a column
                </button>
              </div>
              <TextInput label="Full story button wording" value={edit.storyLabel || ''} onChange={(storyLabel) => up({ storyLabel })} placeholder="Read Dr Lastname's full story" />
              <div className="d-field">
                <span className="d-label">Full story paragraphs</span>
                <StringListEditor value={edit.story} onChange={(story) => up({ story })} itemLabel="Paragraph" rows={5} />
              </div>
              <details className="d-more">
                <summary>Details for Google (optional)</summary>
                <div>
                  <div className="d-field">
                    <span className="d-label">Qualifications</span>
                    <StringListEditor value={edit.credentials} onChange={(credentials) => up({ credentials })} itemLabel="Qualification" rows={1} />
                    <div className="d-help">Leave empty to use the qualifications in the role line.</div>
                  </div>
                  <TextInput label="AHPRA registration number" value={edit.ahpra || ''} onChange={(ahpra) => up({ ahpra })} />
                  <TextInput label="Public profile link" value={edit.sameAs || ''} onChange={(sameAs) => up({ sameAs })} />
                </div>
              </details>
            </>
          )}
          <Check label="Hide from the website" checked={Boolean(edit.hidden)} onChange={(hidden) => up({ hidden })} />
        </Modal>
      )}
      {pick && (
        <MediaPicker
          onClose={() => setPick(false)}
          onSelect={(m) => {
            setEdit({ ...edit, photo: m });
            setPick(false);
          }}
        />
      )}
    </>
  );
}
