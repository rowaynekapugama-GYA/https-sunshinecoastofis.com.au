'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, mediaSrc } from '../lib/api';
import { Modal, TextInput } from './fields';
import { Icons } from './Icons';
import { useToast } from './Toast';

export type MediaDoc = { id: number | string; filename: string; alt: string; url: string; width?: number; height?: number; sizes?: any; createdAt?: string };

/** Choose a photo from the library or upload a new one. */
export function MediaPicker({ onSelect, onClose }: { onSelect: (m: MediaDoc) => void; onClose: () => void }) {
  const [docs, setDocs] = useState<MediaDoc[]>([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'library' | 'upload'>('library');
  const load = useCallback(async () => {
    const where = q ? `&where[or][0][alt][contains]=${encodeURIComponent(q)}&where[or][1][filename][contains]=${encodeURIComponent(q)}` : '';
    const r = await api.get(`/api/media?limit=40&page=${page}&sort=-createdAt${where}`);
    setDocs(r.docs);
    setPages(r.totalPages || 1);
  }, [q, page]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <Modal title="Choose a photo" onClose={onClose}>
      <div className="d-tabs">
        <button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>
          Media library
        </button>
        <button className={tab === 'upload' ? 'active' : ''} onClick={() => setTab('upload')}>
          Upload from your computer
        </button>
      </div>
      {tab === 'upload' ? (
        <Uploader
          onDone={(m) => {
            onSelect(m);
          }}
        />
      ) : (
        <>
          <input className="d-input" placeholder="Search by description or file name" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} style={{ marginBottom: 14 }} />
          {docs.length ? (
            <div className="d-media-grid">
              {docs.map((m) => (
                <button key={m.id} type="button" className="d-media-item" onClick={() => onSelect(m)} disabled={busy}>
                  <div className="img" style={{ backgroundImage: `url("${mediaSrc(m)}")` }} />
                  <div className="meta">
                    <div className="name">{m.alt || m.filename}</div>
                    <div className="alt">{m.filename}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="d-empty">No photos yet. Use the Upload tab.</div>
          )}
          {pages > 1 && (
            <div className="d-actions" style={{ marginTop: 14 }}>
              <button className="d-btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span className="d-help">
                Page {page} of {pages}
              </span>
              <button className="d-btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next
              </button>
            </div>
          )}
        </>
      )}
      {busy && <div className="d-help">Working…</div>}
    </Modal>
  );
}

/** Upload one or more photos with alt text. Calls onDone for the last one uploaded (single) or each (multi). */
export function Uploader({ onDone, multiple = false, onEach }: { onDone?: (m: MediaDoc) => void; multiple?: boolean; onEach?: (m: MediaDoc) => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [alt, setAlt] = useState('');
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const Up = Icons.upload;

  const pick = (list: FileList | null) => {
    if (!list || !list.length) return;
    const arr = Array.from(list).filter((f) => f.type.startsWith('image/'));
    if (!arr.length) return toast('Please choose an image file (JPG, PNG or WebP).', 'error');
    if (multiple) setFiles(arr);
    else {
      setFile(arr[0]);
      if (!alt) setAlt(arr[0].name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' '));
    }
  };

  const go = async () => {
    setBusy(true);
    try {
      if (multiple) {
        let last: MediaDoc | null = null;
        for (const f of files) {
          const a = f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
          const r = await api.upload<{ doc: MediaDoc }>('media', f, { alt: a });
          last = r.doc;
          onEach?.(r.doc);
        }
        toast(`${files.length} photo${files.length === 1 ? '' : 's'} uploaded. Remember to write a proper description for each one.`, 'success');
        setFiles([]);
        if (last) onDone?.(last);
      } else {
        if (!file) return;
        if (!alt.trim()) return toast('Please describe the photo (alt text) before uploading.', 'error');
        const r = await api.upload<{ doc: MediaDoc }>('media', file, { alt: alt.trim() });
        toast('Photo uploaded.', 'success');
        onDone?.(r.doc);
      }
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div
        className={`d-dropzone ${over ? 'over' : ''}`}
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files);
        }}
      >
        <Up width={28} height={28} />
        <p style={{ margin: '8px 0 10px' }}>Drag a photo here, or</p>
        <button type="button" className="d-btn" onClick={() => inputRef.current?.click()}>
          Choose from your computer
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple={multiple} hidden onChange={(e) => pick(e.target.files)} />
        <p className="d-help" style={{ marginTop: 10 }}>
          JPG, PNG or WebP. Phone photos are fine: large images are resized automatically.
        </p>
        {multiple && files.length > 0 && <p className="d-help">{files.map((f) => f.name).join(', ')}</p>}
        {!multiple && file && <p className="d-help">Selected: {file.name}</p>}
      </div>
      {!multiple && <TextInput label="Describe the photo (alt text)" value={alt} onChange={setAlt} help="A few words saying what is in the photo, for example: Reception desk at the Buderim practice. Used by search engines and screen readers." />}
      <button type="button" className="d-btn primary" onClick={go} disabled={busy || (multiple ? !files.length : !file)}>
        {busy ? 'Uploading…' : multiple ? 'Upload photos' : 'Upload and use this photo'}
      </button>
    </div>
  );
}
