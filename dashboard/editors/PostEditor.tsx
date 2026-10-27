'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, mediaSrc, relId, stripDoc } from '../lib/api';
import { useToast } from '../ui/Toast';
import { Icons } from '../ui/Icons';
import { Select, TextArea, TextInput } from '../ui/fields';
import { MediaPicker, type MediaDoc } from '../ui/MediaPicker';
import { RichTextEditor } from './RichTextEditor';
import { SeoPanel } from './SeoPanel';
import { toPayload } from '../lib/toPayload';

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function AhpraReminder() {
  return (
    <div className="d-notice info" style={{ alignItems: 'flex-start' }}>
      <div className="grow">
        <strong>A quick reminder before you write (AHPRA advertising rules)</strong>
        <small>
          No testimonials or reviews about clinical care. No claims such as &quot;pain-free&quot;, &quot;guaranteed&quot;, &quot;best&quot; or &quot;expert&quot;. Any offer must state the price, what is included and the
          offer period. Use &quot;specialist&quot; only for Dr Lincoln and Dr Higgins as registered specialist oral and maxillofacial surgeons, never for the practice team or for a treatment. Keep articles to
          general information and say that surgery carries risks. Ask GYA if you are unsure.
        </small>
      </div>
    </div>
  );
}

export function PostEditor({ initial, categories, siteUrl, siteName }: { initial: any | null; categories: { id: number | string; title: string }[]; siteUrl: string; siteName: string }) {
  const router = useRouter();
  const toast = useToast();
  const isNew = !initial;
  const [doc, setDoc] = useState<any>(
    initial || { title: '', slug: '', excerpt: '', body: '', author: siteName, categories: [], publishedAt: new Date().toISOString().slice(0, 10), _status: 'draft', metaTitle: '', metaDescription: '', noindex: false },
  );
  const [saved, setSaved] = useState<any>(doc);
  const [cats, setCats] = useState(categories);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<'article' | 'seo'>('article');
  const dirty = useMemo(() => JSON.stringify(doc) !== JSON.stringify(saved), [doc, saved]);
  const fi = doc.featuredImage && typeof doc.featuredImage === 'object' ? (doc.featuredImage as MediaDoc) : null;
  const slug = doc.slug || slugify(doc.title || '');
  const url = `${siteUrl}/${slug || 'article'}/`;
  const Ext = Icons.external;
  const Back = Icons.arrowLeft;

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = async (status: 'draft' | 'published') => {
    if (!doc.title.trim()) return toast('Please give the article a title.', 'error');
    if (!doc.excerpt.trim()) return toast('Please write a short summary.', 'error');
    if (!doc.body || doc.body === '<p></p>') return toast('The article is empty.', 'error');
    setBusy(status);
    try {
      const body = toPayload({
        ...stripDoc(doc),
        slug: slug,
        categories: (doc.categories || []).map((c: any) => relId(c)).filter(Boolean),
        publishedAt: doc.publishedAt ? new Date(doc.publishedAt).toISOString() : undefined,
        _status: status,
      });
      const r = isNew ? await api.post(`/api/posts?depth=1`, body) : await api.patch(`/api/posts/${doc.id}?depth=1`, body);
      const next = { ...r.doc, publishedAt: r.doc.publishedAt ? r.doc.publishedAt.slice(0, 10) : '' };
      setDoc(next);
      setSaved(next);
      toast(status === 'published' ? 'Article published in the dashboard. Click Publish website on the dashboard to put it on the site.' : 'Draft saved.', 'success');
      if (isNew) router.replace(`/admin/posts/${r.doc.id}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const addCategory = async () => {
    const title = window.prompt('New category name');
    if (!title?.trim()) return;
    try {
      const r = await api.post('/api/categories', { title: title.trim() });
      setCats([...cats, r.doc]);
      setDoc({ ...doc, categories: [...(doc.categories || []), r.doc] });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const selectedCats = new Set((doc.categories || []).map((c: any) => String(relId(c))));

  return (
    <>
      <div className="d-save-bar">
        <Link href="/admin/posts" className="d-btn ghost sm">
          <Back /> Blog posts
        </Link>
        <strong style={{ fontSize: 17 }}>{isNew ? 'New article' : doc.title}</strong>
        <span className={`d-badge ${doc._status === 'published' ? 'ok' : ''}`}>{doc._status === 'published' ? 'Published' : 'Draft'}</span>
        <span className={`state ${dirty ? 'dirty' : ''}`}>{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
        <div className="d-topbar-spacer" />
        {doc._status === 'published' && !isNew && (
          <a className="d-btn sm" href={url} target="_blank" rel="noopener">
            <Ext /> View article
          </a>
        )}
        <button className="d-btn" onClick={() => save('draft')} disabled={busy !== null}>
          {busy === 'draft' ? 'Saving…' : doc._status === 'published' ? 'Unpublish (save as draft)' : 'Save draft'}
        </button>
        <button className="d-btn primary" onClick={() => save('published')} disabled={busy !== null}>
          {busy === 'published' ? 'Saving…' : doc._status === 'published' ? 'Save changes' : 'Publish article'}
        </button>
      </div>

      <div className="d-tabs">
        <button className={tab === 'article' ? 'active' : ''} onClick={() => setTab('article')}>
          Article
        </button>
        <button className={tab === 'seo' ? 'active' : ''} onClick={() => setTab('seo')}>
          SEO
        </button>
      </div>

      {tab === 'article' ? (
        <div className="d-editor">
          <div>
            <AhpraReminder />
            <div className="d-card">
              <TextInput label="Title" value={doc.title} onChange={(title) => setDoc({ ...doc, title, slug: isNew && !saved.slug ? '' : doc.slug })} />
              <TextArea label="Summary" value={doc.excerpt} onChange={(excerpt) => setDoc({ ...doc, excerpt })} rows={2} counter={{ max: 200 }} help="One or two sentences shown on the blog page under the title." />
              <div className="d-field">
                <span className="d-label">Article</span>
                <RichTextEditor value={doc.body || ''} onChange={(body) => setDoc({ ...doc, body })} />
              </div>
            </div>
          </div>
          <div className="d-editor-side">
            <div className="d-card">
              <h2>Featured image</h2>
              <div className="d-image">
                <div className="d-image-thumb" style={{ backgroundImage: fi ? `url("${mediaSrc(fi)}")` : doc.imagePath ? `url("${doc.imagePath}")` : undefined }} />
                <div className="d-image-info">
                  <div className="src">{fi ? fi.alt || fi.filename : doc.imagePath ? 'Photo the article came with from the old website' : 'No photo yet'}</div>
                  <div className="d-actions">
                    <button type="button" className="d-btn sm" onClick={() => setPick(true)}>
                      Choose / Upload
                    </button>
                    {fi && (
                      <button type="button" className="d-btn sm ghost" onClick={() => setDoc({ ...doc, featuredImage: null })}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="d-card">
              <h2>Details</h2>
              <TextInput label="Author" value={doc.author || ''} onChange={(author) => setDoc({ ...doc, author })} />
              <TextInput label="Publish date" type="date" value={doc.publishedAt || ''} onChange={(publishedAt) => setDoc({ ...doc, publishedAt })} help="Shown on the article." />
              <TextInput label="Web address (slug)" value={doc.slug || ''} onChange={(s) => setDoc({ ...doc, slug: slugify(s) })} placeholder={slugify(doc.title || '')} help={`Becomes sunshinecoastofis.com.au/${slug || '…'}/ (the same pattern as the old blog). Filled in from the title if left empty.`} />
              <div className="d-field">
                <span className="d-label">Categories</span>
                {cats.map((c) => (
                  <label key={c.id} className="d-check" style={{ marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={selectedCats.has(String(c.id))}
                      onChange={(e) => {
                        const list = (doc.categories || []).filter((x: any) => String(relId(x)) !== String(c.id));
                        setDoc({ ...doc, categories: e.target.checked ? [...list, c] : list });
                      }}
                    />
                    <span>{c.title}</span>
                  </label>
                ))}
                <button type="button" className="d-add" onClick={addCategory}>
                  + New category
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="d-card" style={{ maxWidth: 820 }}>
          <SeoPanel value={doc} onChange={(v) => setDoc({ ...doc, ...v })} url={url} siteName={siteName} fallbackTitle={doc.title ? `${doc.title} | ${siteName}` : ''} fallbackDescription={doc.excerpt} showCanonical={false} showKeyword={false} />
        </div>
      )}
      {pick && (
        <MediaPicker
          onClose={() => setPick(false)}
          onSelect={(m) => {
            setDoc({ ...doc, featuredImage: m });
            setPick(false);
          }}
        />
      )}
    </>
  );
}
