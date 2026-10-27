'use client';
import React, { useMemo, useState } from 'react';
import { MediaPicker, type MediaDoc } from '../ui/MediaPicker';
import { Check, TextArea, TextInput } from '../ui/fields';
import { mediaSrc, relId } from '../lib/api';

export type SeoValue = { metaTitle?: string | null; metaDescription?: string | null; ogImage?: MediaDoc | number | string | null; canonical?: string | null; noindex?: boolean | null; primaryKeyword?: string | null };

/**
 * Per-page search settings with live character counts and a Google-style
 * preview. Used by the page editor and the blog post editor.
 */
export function SeoPanel({ value, onChange, url, siteName, fallbackTitle, fallbackDescription, showCanonical = true, showKeyword = true }: { value: SeoValue; onChange: (v: SeoValue) => void; url: string; siteName: string; fallbackTitle?: string; fallbackDescription?: string; showCanonical?: boolean; showKeyword?: boolean }) {
  const [pick, setPick] = useState(false);
  const title = value.metaTitle || fallbackTitle || '';
  const desc = value.metaDescription || fallbackDescription || '';
  const og = value.ogImage && typeof value.ogImage === 'object' ? (value.ogImage as MediaDoc) : null;
  const host = useMemo(() => {
    try {
      const u = new URL(url);
      return { host: u.host.replace(/^www\./, ''), path: u.pathname.replace(/\/$/, '').split('/').filter(Boolean).join(' › ') };
    } catch {
      return { host: 'sunshinecoastofis.com.au', path: url };
    }
  }, [url]);
  return (
    <div>
      <div className="d-field">
        <span className="d-label">How it may look in Google</span>
        <div className="d-snippet" aria-hidden="true">
          <div className="url">
            <span className="fav" style={{ backgroundImage: 'url(/apple-touch-icon.png)' }} />
            <span>
              {siteName}
              <br />
              <span className="path">
                {host.host}
                {host.path ? ` › ${host.path}` : ''}
              </span>
            </span>
          </div>
          <div className="title">{title || 'Page title'}</div>
          <div className="desc">{desc ? (desc.length > 160 ? desc.slice(0, 157) + '…' : desc) : 'The meta description appears here.'}</div>
        </div>
      </div>
      <TextInput label="Meta title" value={value.metaTitle || ''} onChange={(metaTitle) => onChange({ ...value, metaTitle })} counter={{ ideal: 30, max: 60 }} help="Shown in the browser tab and as the blue link in Google. Keep it under 60 characters so it is not cut off." />
      <TextArea label="Meta description" value={value.metaDescription || ''} onChange={(metaDescription) => onChange({ ...value, metaDescription })} counter={{ ideal: 70, max: 155 }} rows={3} help="The summary under the link in Google. Aim for 70 to 155 characters and say what the page is about." />
      <div className="d-field">
        <span className="d-label">Share image</span>
        <div className="d-image">
          <div className="d-image-thumb" style={{ backgroundImage: og ? `url("${mediaSrc(og)}")` : 'url(/images/reception2.jpg)' }} />
          <div className="d-image-info">
            <div className="src">{og ? `Library photo: ${og.alt || og.filename}` : 'Default share image'}</div>
            <div className="d-actions">
              <button type="button" className="d-btn sm" onClick={() => setPick(true)}>
                Choose from library / Upload
              </button>
              {relId(value.ogImage) && (
                <button type="button" className="d-btn sm ghost" onClick={() => onChange({ ...value, ogImage: null })}>
                  Use the default
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="d-help">Shown when the page is shared on Facebook or in messages. 1200 x 630 pixels works best.</div>
      </div>
      {showCanonical && <TextInput label="Canonical URL (optional)" value={value.canonical || ''} onChange={(canonical) => onChange({ ...value, canonical })} help="Leave empty. Only used if search engines should treat a different address as the main copy of this page." />}
      <Check label="Hide this page from search engines" checked={Boolean(value.noindex)} onChange={(noindex) => onChange({ ...value, noindex })} help="Leave unticked unless GYA says otherwise." />
      {showKeyword && <TextInput label="Focus keyword (reference only)" value={value.primaryKeyword || ''} onChange={(primaryKeyword) => onChange({ ...value, primaryKeyword })} help="For the SEO team. Not shown on the page." />}
      {pick && (
        <MediaPicker
          onClose={() => setPick(false)}
          onSelect={(m) => {
            onChange({ ...value, ogImage: m });
            setPick(false);
          }}
        />
      )}
    </div>
  );
}
