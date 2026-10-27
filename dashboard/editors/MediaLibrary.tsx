'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, mediaFull, mediaSrc } from '../lib/api';
import { useToast } from '../ui/Toast';
import { Modal, TextInput } from '../ui/fields';
import { Uploader, type MediaDoc } from '../ui/MediaPicker';

export function MediaLibrary() {
  const toast = useToast();
  const [docs, setDocs] = useState<MediaDoc[]>([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sel, setSel] = useState<MediaDoc | null>(null);
  const [alt, setAlt] = useState('');
  const [busy, setBusy] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const where = q ? `&where[or][0][alt][contains]=${encodeURIComponent(q)}&where[or][1][filename][contains]=${encodeURIComponent(q)}` : '';
    const r = await api.get(`/api/media?limit=48&page=${page}&sort=-createdAt${where}`);
    setDocs(r.docs);
    setPages(r.totalPages || 1);
    setTotal(r.totalDocs || 0);
  }, [q, page]);
  useEffect(() => {
    void load();
  }, [load]);

  const open = (m: MediaDoc) => {
    setSel(m);
    setAlt(m.alt || '');
  };
  const saveAlt = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      await api.patch(`/api/media/${sel.id}`, { alt });
      toast('Description saved.', 'success');
      setSel(null);
      void load();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const replace = async (file: File) => {
    if (!sel) return;
    setBusy(true);
    try {
      const r = await api.upload<{ doc: MediaDoc }>('media', file, { alt }, sel.id);
      toast('Photo replaced everywhere it is used. Publish website to update the live site.', 'success');
      setSel(r.doc);
      void load();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!sel || !window.confirm('Delete this photo? Any page using it will fall back to the photo built into the site.')) return;
    setBusy(true);
    try {
      await api.delete(`/api/media/${sel.id}`);
      toast('Photo deleted.', 'success');
      setSel(null);
      void load();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="d-card">
        <div className="d-actions" style={{ justifyContent: 'space-between' }}>
          <input className="d-input" style={{ maxWidth: 360 }} placeholder="Search by description or file name" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
          <button className="d-btn primary" onClick={() => setShowUpload(!showUpload)}>
            {showUpload ? 'Close upload' : '+ Upload photos'}
          </button>
        </div>
        {showUpload && (
          <div style={{ marginTop: 16 }}>
            <Uploader
              multiple
              onDone={() => {
                setShowUpload(false);
                void load();
              }}
            />
          </div>
        )}
      </div>
      {docs.length ? (
        <div className="d-media-grid">
          {docs.map((m) => (
            <button key={m.id} type="button" className="d-media-item" onClick={() => open(m)}>
              <div className="img" style={{ backgroundImage: `url("${mediaSrc(m)}")` }} />
              <div className="meta">
                <div className="name">{m.alt || <em>No description</em>}</div>
                <div className="alt">
                  {m.filename}
                  {m.width ? ` · ${m.width}×${m.height}` : ''}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="d-card d-empty">{q ? 'Nothing matches that search.' : 'No photos uploaded yet. The photos built into the site are not listed here; upload new ones to swap them on a page.'}</div>
      )}
      <div className="d-actions" style={{ marginTop: 16 }}>
        <span className="d-help">
          {total} photo{total === 1 ? '' : 's'}
        </span>
        {pages > 1 && (
          <>
            <button className="d-btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span className="d-help">
              Page {page} of {pages}
            </span>
            <button className="d-btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </>
        )}
      </div>

      {sel && (
        <Modal
          title="Photo details"
          onClose={() => setSel(null)}
          footer={
            <>
              <button className="d-btn danger" onClick={remove} disabled={busy}>
                Delete photo
              </button>
              <span style={{ flex: 1 }} />
              <button className="d-btn" onClick={() => setSel(null)}>
                Close
              </button>
              <button className="d-btn primary" onClick={saveAlt} disabled={busy}>
                Save description
              </button>
            </>
          }
        >
          <div className="d-grid-2">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaFull(sel)} alt={sel.alt} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--d-line)' }} />
              <div className="d-help" style={{ marginTop: 8 }}>
                {sel.filename}
                {sel.width ? ` · ${sel.width} × ${sel.height} px` : ''}
              </div>
            </div>
            <div>
              <TextInput label="Description (alt text)" value={alt} onChange={setAlt} help="What is in the photo, in a few words. Used by search engines and screen readers." />
              <div className="d-field">
                <span className="d-label">Replace this photo</span>
                <button type="button" className="d-btn" onClick={() => replaceRef.current?.click()} disabled={busy}>
                  Choose a new file…
                </button>
                <input ref={replaceRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && replace(e.target.files[0])} />
                <div className="d-help">The new photo takes this one's place on every page that uses it. Keep a similar shape (landscape or portrait) so the layout stays the same.</div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
