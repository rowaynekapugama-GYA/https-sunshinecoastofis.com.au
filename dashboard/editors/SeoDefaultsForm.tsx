'use client';
import React, { useState } from 'react';
import { api, mediaSrc, relId } from '../lib/api';
import { useToast } from '../ui/Toast';
import { TextArea } from '../ui/fields';
import { MediaPicker, type MediaDoc } from '../ui/MediaPicker';
import { toPayload } from '../lib/toPayload';

export function SeoDefaultsForm({ initial }: { initial: any }) {
  const toast = useToast();
  const [doc, setDoc] = useState<any>(initial || {});
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const og = doc.ogImage && typeof doc.ogImage === 'object' ? (doc.ogImage as MediaDoc) : null;
  return (
    <div>
      <div className="d-field">
        <span className="d-label">Default share image</span>
        <div className="d-image">
          <div className="d-image-thumb" style={{ backgroundImage: og ? `url("${mediaSrc(og)}")` : 'url(/images/og-default.jpg)' }} />
          <div className="d-image-info">
            <div className="src">{og ? `Library photo: ${og.alt || og.filename}` : 'Share card built from the logo'}</div>
            <div className="d-actions">
              <button type="button" className="d-btn sm" onClick={() => setPick(true)}>
                Choose from library / Upload
              </button>
              {relId(doc.ogImage) && (
                <button type="button" className="d-btn sm ghost" onClick={() => setDoc({ ...doc, ogImage: null })}>
                  Use the logo card
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="d-help">Used when a page has no share image of its own.</div>
      </div>
      <TextArea label="Default meta description" value={doc.defaultDescription || ''} onChange={(defaultDescription) => setDoc({ ...doc, defaultDescription })} rows={2} counter={{ ideal: 70, max: 155 }} help="Only used for pages without their own." />
      <button
        className="d-btn primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api.post('/api/globals/seo-defaults?depth=1', toPayload({ ogImage: doc.ogImage, defaultDescription: doc.defaultDescription }));
            setDoc(r.result || r.doc || doc);
            toast('Saved.', 'success');
          } catch (e) {
            toast((e as Error).message, 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Saving…' : 'Save defaults'}
      </button>
      {pick && (
        <MediaPicker
          onClose={() => setPick(false)}
          onSelect={(m) => {
            setDoc({ ...doc, ogImage: m });
            setPick(false);
          }}
        />
      )}
    </div>
  );
}
