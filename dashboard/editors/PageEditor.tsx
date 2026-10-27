'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api, mediaFull, mediaSrc, stripDoc } from '../lib/api';
import { useToast } from '../ui/Toast';
import { Icons } from '../ui/Icons';
import { HelpBox, Modal as ModalBox, Switch, TextArea, TextInput } from '../ui/fields';
import { MediaPicker } from '../ui/MediaPicker';
import { SortableList, DragHandle } from '../ui/Sortable';
import { SeoPanel } from './SeoPanel';
import { decode, decodeAttr, editableToRich, encodeAttr, encodeText, preview, richToEditable } from './wording';

export type FieldDef = { type: 'text' | 'rich' | 'link' | 'href' | 'image'; label: string };
export type TemplateDefs = Record<string, { label: string; fields: Record<string, FieldDef>; generated?: string[] }>;
type FieldValue = { value?: string; href?: string; src?: string; alt?: string; media?: number | string };
type Section = { id?: string; sectionId: string; template: string; hidden?: boolean; fields: Record<string, FieldValue> };

const TOKEN_HELP = (
  <>
    <code>{'{{phone}}'}</code> shows the practice phone number from Site Settings.
  </>
);
const RICH_HELP = (
  <>
    Shortcuts: <code>**bold**</code>, <code>*italic*</code>, <code>[link text](/contact-us/)</code>. A new line starts a new line on the page. <code>{'{{phone}}'}</code> is the practice phone number.
  </>
);

/** Links: a page on this site (with the trailing slash) or a full https:// address. */
function LinkInput({ label, value, onChange, routes }: { label: string; value: string; onChange: (v: string) => void; routes: { title: string; route: string }[] }) {
  const id = useRef(`l${Math.random().toString(36).slice(2, 8)}`).current;
  return (
    <div className="d-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="d-input" list={`${id}-pages`} value={decodeAttr(value)} onChange={(e) => onChange(encodeAttr(e.target.value).replace(/&quot;/g, '%22'))} />
      <datalist id={`${id}-pages`}>
        {routes.map((r) => (
          <option key={r.route} value={r.route}>
            {r.title}
          </option>
        ))}
      </datalist>
      <div className="d-help">A page on this website, for example /contact-us/ (start typing to pick one), or a full https:// address.</div>
    </div>
  );
}

function ImageSlot({ label, value, onChange }: { label: string; value: FieldValue; onChange: (v: FieldValue) => void }) {
  const [open, setOpen] = useState(false);
  const original = useRef(value).current;
  return (
    <div className="d-field">
      <span className="d-label">{label}</span>
      <div className="d-image">
        <div className="d-image-thumb" style={{ backgroundImage: value.src ? `url("${decodeAttr(value.src)}")` : undefined }} aria-hidden="true" />
        <div className="d-image-info">
          <div className="src">{value.src?.startsWith('/images/') ? 'Photo built into the site' : 'Photo from the media library'}</div>
          <div className="d-actions" style={{ marginBottom: 10 }}>
            <button type="button" className="d-btn sm" onClick={() => setOpen(true)}>
              Choose from library / Upload
            </button>
            {original.src && value.src !== original.src && (
              <button type="button" className="d-btn sm ghost" onClick={() => onChange(original)}>
                Undo photo change
              </button>
            )}
          </div>
          {value.alt !== undefined && (
            <TextInput label="Alt text" value={decodeAttr(value.alt || '')} onChange={(alt) => onChange({ ...value, alt: encodeAttr(alt) })} help="What is in the photo, in a few words. Leave empty only for decorative background photos." />
          )}
        </div>
      </div>
      {open && (
        <MediaPicker
          onClose={() => setOpen(false)}
          onSelect={(m) => {
            onChange({ ...value, src: mediaFull(m) || mediaSrc(m), media: m.id, alt: value.alt === undefined ? undefined : encodeAttr(m.alt || decodeAttr(value.alt || '')) });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function FieldEditor({ def, value, onChange, routes }: { def: FieldDef; value: FieldValue; onChange: (v: FieldValue) => void; routes: { title: string; route: string }[] }) {
  const long = (s: string) => s.length > 70 || /Paragraph|Answer|Introduction|Text/.test(def.label);
  switch (def.type) {
    case 'text': {
      const shown = decode(value.value || '');
      return long(shown) ? (
        <TextArea label={def.label} value={shown} rows={Math.min(8, Math.max(2, Math.ceil(shown.length / 90)))} onChange={(x) => onChange({ ...value, value: encodeText(x) })} help={shown.includes('{{') ? TOKEN_HELP : undefined} />
      ) : (
        <TextInput label={def.label} value={shown} onChange={(x) => onChange({ ...value, value: encodeText(x) })} help={shown.includes('{{') ? TOKEN_HELP : undefined} />
      );
    }
    case 'rich': {
      const shown = richToEditable(value.value || '');
      const bold = /<b>/.test(value.value || '') && !/<strong>/.test(value.value || '') ? 'b' : 'strong';
      return <TextArea label={def.label} value={shown} rows={Math.min(10, Math.max(2, Math.ceil(shown.length / 90)))} onChange={(x) => onChange({ ...value, value: editableToRich(x, bold) })} help={RICH_HELP} />;
    }
    case 'link':
      return (
        <div className="d-group">
          <TextInput label={`${def.label}: wording`} value={decode(value.value || '')} onChange={(x) => onChange({ ...value, value: encodeText(x) })} />
          <LinkInput label={`${def.label}: goes to`} value={value.href || ''} onChange={(href) => onChange({ ...value, href })} routes={routes} />
        </div>
      );
    case 'href':
      return <LinkInput label={def.label} value={value.href || ''} onChange={(href) => onChange({ ...value, href })} routes={routes} />;
    case 'image':
      return <ImageSlot label={def.label} value={value} onChange={onChange} />;
  }
}

function SectionRow({ num, section, def, open, onToggle, onChange, draggable, routes }: { num: number; section: Section; def: TemplateDefs[string]; open: boolean; onToggle: () => void; onChange: (s: Section) => void; draggable: boolean; routes: { title: string; route: string }[] }) {
  const Chev = Icons.chevron;
  const first = Object.entries(def?.fields || {}).find(([, f]) => f.type === 'text' || f.type === 'rich');
  const peek = first ? preview(section.fields?.[first[0]]?.value || '') : '';
  return (
    <div className={`d-section ${open ? 'open' : ''} ${section.hidden ? 'is-hidden' : ''}`}>
      <div className="d-section-head" onClick={onToggle} role="button" aria-expanded={open} tabIndex={0} onKeyDown={(e) => e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onToggle())}>
        {draggable ? <DragHandle /> : <span className="d-handle disabled" title="This section stays at the top" />}
        <span className="num">{num}</span>
        <span className="label">
          {def?.label || section.template}
          {section.hidden ? <small>Hidden from the page</small> : peek && <small>{peek}</small>}
        </span>
        <span onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <span className="muted">{section.hidden ? 'Hidden' : 'Shown'}</span>
          <Switch on={!section.hidden} onChange={(on) => onChange({ ...section, hidden: !on })} label={`Show the section "${def?.label}" on the page`} />
        </span>
        <Chev className="chev" width={18} height={18} />
      </div>
      {open && (
        <div className="d-section-body">
          {Object.entries(def?.fields || {}).map(([key, f]) => (
            <FieldEditor key={key} def={f} value={section.fields?.[key] || {}} routes={routes} onChange={(v) => onChange({ ...section, fields: { ...section.fields, [key]: v } })} />
          ))}
          {!Object.keys(def?.fields || {}).length && <div className="d-help">This section has no wording of its own.</div>}
          {def?.generated?.includes('posts') ? (
            <div className="d-notice info" style={{ marginTop: 12 }}>
              <div className="grow">
                <strong>The article cards are added automatically.</strong>
                <small>
                  Every published article in <Link href="/admin/posts">Blog Posts</Link> appears here, newest first.
                </small>
              </div>
            </div>
          ) : null}
          {def?.generated?.includes('locations') ? (
            <div className="d-notice info" style={{ marginTop: 12 }}>
              <div className="grow">
                <strong>The location cards come from Site Settings.</strong>
                <small>
                  <Link href="/admin/settings#locations">Open Site Settings &gt; Locations</Link> to change an address, a note or a map link. It updates the home page and the Locations page together.
                </small>
              </div>
            </div>
          ) : null}
          {def?.generated?.some((g) => g === 'surgeons' || g === 'staff') ? (
            <div className="d-notice info" style={{ marginTop: 12 }}>
              <div className="grow">
                <strong>The bios and team photos are edited under Team.</strong>
                <small>
                  <Link href="/admin/team">Open Team</Link> to update a bio or photo, change the order, add someone or hide someone. This section only sets the wording around them.
                </small>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Relationship fields go back to Payload as ids. */
const toPayload = (doc: any) => ({ ...doc, ogImage: doc.ogImage && typeof doc.ogImage === 'object' ? doc.ogImage.id : doc.ogImage ?? null });

/** Wording edited on the page (contenteditable HTML) -> the stored HTML: bold, italic, links and line breaks only. */
function cleanRich(html: string): string {
  const box = document.createElement('div');
  box.innerHTML = html;
  const walk = (node: Node): string => {
    let out = '';
    node.childNodes.forEach((n, i) => {
      if (n.nodeType === 3) {
        out += encodeText(n.textContent || '').replace(/ /g, '&nbsp;');
        return;
      }
      if (n.nodeType !== 1) return;
      const el = n as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const inner = walk(el);
      if (tag === 'br') out += '<br>';
      else if (tag === 'strong' || tag === 'b' || tag === 'em' || tag === 'i') out += inner ? `<${tag}>${inner}</${tag}>` : '';
      else if (tag === 'a') {
        const href = el.getAttribute('href');
        const target = el.getAttribute('target');
        const rel = el.getAttribute('rel');
        out += href ? `<a href="${encodeAttr(href)}"${target ? ` target="${encodeAttr(target)}"` : ''}${rel ? ` rel="${encodeAttr(rel)}"` : ''}>${inner}</a>` : inner;
      } else if (tag === 'div' || tag === 'p') out += (i > 0 && out && !out.endsWith('<br>') ? '<br>' : '') + inner;
      else out += inner;
    });
    return out;
  };
  return walk(box).replace(/(<br>)+$/, '');
}

type Modal = { kind: 'image'; id: string } | { kind: 'field'; id: string } | null;
const splitId = (id: string) => {
  const i = id.lastIndexOf('|');
  return [id.slice(0, i), id.slice(i + 1)] as const;
};

export function PageEditor({ initial, defs, siteUrl, siteName, isAdmin, routes }: { initial: any; defs: TemplateDefs; siteUrl: string; siteName: string; isAdmin: boolean; routes: { title: string; route: string }[] }) {
  const toast = useToast();
  const [doc, setDoc] = useState<any>(initial);
  const [saved, setSaved] = useState<any>(initial);
  const [tab, setTab] = useState<'content' | 'sections' | 'seo' | 'settings'>('content');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [modal, setModal] = useState<Modal>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [slow, setSlow] = useState(false);
  const [size, setSize] = useState({ w: 1000, h: 700 });
  const dirty = useMemo(() => JSON.stringify(doc) !== JSON.stringify(saved), [doc, saved]);
  const isSite = doc.kind === 'site';
  const previewForm = useRef<HTMLFormElement>(null);
  const canvasForm = useRef<HTMLFormElement>(null);
  const canvasDoc = useRef<HTMLInputElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const canvasBox = useRef<HTMLDivElement>(null);
  const docRef = useRef(doc);
  docRef.current = doc;
  const scrollY = useRef(0);

  useEffect(() => {
    if (window.location.hash === '#seo') setTab('seo');
    if (window.location.hash === '#sections') setTab('sections');
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // ---------------------------------------------------------------- the canvas
  const loadCanvas = useCallback(() => {
    if (!canvasForm.current || !canvasDoc.current) return;
    canvasDoc.current.value = JSON.stringify(docRef.current);
    setLoading(true);
    canvasForm.current.submit();
  }, []);
  useEffect(() => {
    loadCanvas();
  }, [loadCanvas]);
  useEffect(() => {
    if (!reloadTick) return;
    const t = setTimeout(loadCanvas, 600);
    return () => clearTimeout(t);
  }, [reloadTick, loadCanvas]);
  const reload = () => setReloadTick((n) => n + 1);
  useEffect(() => {
    if (!loading) return setSlow(false);
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    const el = canvasBox.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tell = (msg: Record<string, unknown>) => frame.current?.contentWindow?.postMessage({ source: 'scofis-admin', ...msg }, window.location.origin);

  const sections: Section[] = doc.sections || [];
  const sectionIndex = (sid: string) => (docRef.current.sections || []).findIndex((s: Section) => s.sectionId === sid);
  const fieldOf = (id: string): { def?: FieldDef; value: FieldValue; label: string } => {
    const [sid, key] = splitId(id);
    const s: Section | undefined = (docRef.current.sections || [])[sectionIndex(sid)];
    const d = s ? defs[s.template] : undefined;
    return { def: d?.fields?.[key], value: s?.fields?.[key] || {}, label: d ? `${d.label}: ${d.fields?.[key]?.label || key}` : key };
  };
  /** Change one field. From the canvas itself no reload is needed; from the panel the canvas reloads (or is told). */
  const setField = useCallback((id: string, patch: FieldValue | ((v: FieldValue) => FieldValue)) => {
    const [sid, key] = splitId(id);
    setDoc((d: any) => ({
      ...d,
      sections: (d.sections || []).map((s: Section) => {
        if (s.sectionId !== sid) return s;
        const cur = s.fields?.[key] || {};
        const next = typeof patch === 'function' ? patch(cur) : { ...cur, ...patch };
        return { ...s, fields: { ...s.fields, [key]: next } };
      }),
    }));
  }, []);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow || e.data?.source !== 'scofis-edit') return;
      const m = e.data;
      if (m.type === 'ready') {
        setLoading(false);
        tell({ type: 'start', y: scrollY.current });
      } else if (m.type === 'scroll') scrollY.current = m.y;
      else if (m.type === 'text') {
        const { def } = fieldOf(m.id);
        if (!def) return;
        const value = def.type === 'rich' ? cleanRich(m.html) : encodeText(String(m.text || '').replace(/\s+/g, ' ')).replace(/ /g, '&nbsp;');
        setField(m.id, { value });
      } else if (m.type === 'pick-image') setModal({ kind: 'image', id: m.id });
      else if (m.type === 'edit-field') setModal({ kind: 'field', id: m.id });
      else if (m.type === 'note') {
        const where = m.note === 'team' ? 'Team' : m.note === 'locations' ? 'Site Settings > Locations' : m.note === 'posts' ? 'Blog Posts' : 'another part of the dashboard';
        toast(`This part comes from ${where}. Edit it there; it updates every page that shows it.`, 'info');
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSections = useCallback((next: Section[]) => {
    setDoc((d: any) => ({ ...d, sections: next }));
    reload();
  }, []);
  const rowId = (s: Section) => s.id || s.sectionId;

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.patch(`/api/pages/${doc.id}?depth=1`, toPayload({ ...stripDoc(doc), _status: 'published' }));
      setDoc(r.doc);
      setSaved(r.doc);
      toast('Saved. Click Publish website on the dashboard when you want it live.', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  // Everything editable on the page as shown (hidden sections are left out).
  const visible = sections.filter((s) => !s.hidden && defs[s.template]);
  const images = visible.flatMap((s) => Object.entries(defs[s.template].fields || {}).filter(([, f]) => f.type === 'image').map(([k, f]) => ({ id: `${s.sectionId}|${k}`, label: f.label, section: defs[s.template].label, value: s.fields?.[k] || {} })));
  const links = visible.flatMap((s) => Object.entries(defs[s.template].fields || {}).filter(([, f]) => f.type === 'link' || f.type === 'href').map(([k, f]) => ({ id: `${s.sectionId}|${k}`, label: f.type === 'link' ? decode(s.fields?.[k]?.value || '') || f.label : f.label, section: defs[s.template].label, value: s.fields?.[k] || {} })));

  // Scale the page to fit: desktop is drawn 1280 wide, mobile 390 wide.
  const logicalW = device === 'mobile' ? 390 : 1280;
  const pad = 48;
  const scale = Math.min(1, (size.w - pad) / logicalW);
  const stageW = Math.round(logicalW * scale);
  const stageH = Math.max(300, size.h - pad);
  const frameH = Math.round(stageH / scale);

  const Ext = Icons.external;
  const Back = Icons.arrowLeft;
  const Desk = Icons.desktop;
  const Mob = Icons.mobile;
  const pageUrl = `${siteUrl}${doc.route || '/'}`;
  const fixedFirst = !isSite && sections.length > 0;
  const modalField = modal?.kind === 'field' ? fieldOf(modal.id) : null;

  return (
    <div className="v-editor">
      <div className="v-bar">
        <Link href="/admin/pages" className="d-btn ghost sm v-pill">
          <Back /> Pages
        </Link>
        <span className="v-title" title={doc.title}>
          {doc.title}
        </span>
        <div className="d-topbar-spacer" />
        <div className="v-device" role="group" aria-label="Show the page as">
          <button type="button" className={device === 'desktop' ? 'on' : ''} onClick={() => setDevice('desktop')} aria-pressed={device === 'desktop'}>
            <Desk width={15} height={15} /> Desktop
          </button>
          <button type="button" className={device === 'mobile' ? 'on' : ''} onClick={() => setDevice('mobile')} aria-pressed={device === 'mobile'}>
            <Mob width={15} height={15} /> Mobile
          </button>
        </div>
        <span className={`v-state ${dirty ? 'dirty' : ''}`}>
          <span className="dot" />
          {dirty ? 'Unsaved changes' : 'All changes saved'}
        </span>
        <button type="button" className="d-btn sm v-pill" onClick={() => previewForm.current?.submit()} title="Opens this page with your changes, saved or not, in a new tab.">
          Preview
        </button>
        {!isSite && (
          <a className="d-btn sm v-pill" href={pageUrl} target="_blank" rel="noopener" title="The live page. Saved changes appear after Publish website.">
            <Ext /> View
          </a>
        )}
        <button className="d-btn primary" onClick={save} disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
      <form ref={previewForm} method="post" action="/edit-preview/" target="_blank" style={{ display: 'none' }}>
        <input type="hidden" name="doc" value={JSON.stringify(doc)} readOnly />
      </form>
      <form ref={canvasForm} method="post" action="/edit-preview/" target="scofis-canvas" style={{ display: 'none' }}>
        <input type="hidden" name="mode" value="edit" readOnly />
        <input ref={canvasDoc} type="hidden" name="doc" defaultValue="" />
      </form>

      <div className="v-body">
        <div className="v-canvas" ref={canvasBox}>
          {loading && <div className="v-updating">{slow ? 'Still loading. The first open after a quiet spell takes a little longer…' : 'Loading the page…'}</div>}
          <div className={`v-stage ${device === 'mobile' ? 'mobile' : ''}`} style={{ width: stageW, height: stageH }}>
            <iframe
              ref={frame}
              name="scofis-canvas"
              title={`${doc.title}: editable page`}
              style={{ width: logicalW, height: frameH, transform: `scale(${scale})`, transformOrigin: '0 0' }}
              // The in-page script normally says "ready" first; this is the fallback if it could not load.
              onLoad={() => setLoading(false)}
            />
          </div>
        </div>

        <aside className="v-panel">
          <div className="v-tabs" style={{ gridTemplateColumns: `repeat(${isSite ? 3 : 4}, 1fr)` }}>
            <button className={tab === 'content' ? 'active' : ''} onClick={() => setTab('content')}>
              Content
            </button>
            {!isSite && (
              <button className={tab === 'seo' ? 'active' : ''} onClick={() => setTab('seo')}>
                SEO
              </button>
            )}
            <button className={tab === 'sections' ? 'active' : ''} onClick={() => setTab('sections')}>
              Sections
            </button>
            <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
              Settings
            </button>
          </div>

          <div className="v-panel-body">
            {tab === 'content' && (
              <>
                <div className="v-hint">
                  <div>
                    <span>
                      <b>Click any text on the page</b> to edit it in place.
                      <br />
                      <b>Click any photo</b> to replace it.
                      <br />
                      <b>Click a button or link</b>, then <b>Change link</b>, to change where it goes.
                      <br />
                      Press <b>Save changes</b> when you are done{isSite ? '.' : ', then Publish website.'}
                    </span>
                  </div>
                </div>
                {isSite && <HelpBox>The header, menu, footer and phone call bar are shown on every page. They are shown here around the home page; only those parts can be edited on this screen.</HelpBox>}

                <div className="v-sec-group">Photos on this page ({images.length})</div>
                {!images.length && <div className="d-help">No photos here. Team photos are changed under Team.</div>}
                {images.map((im) => (
                  <div key={im.id} className="v-img-row">
                    <button type="button" className="v-img-thumb" style={{ backgroundImage: im.value.src ? `url("${decodeAttr(im.value.src)}")` : undefined }} onClick={() => tell({ type: 'scroll-to', id: im.id, block: 'center' })} title="Show on the page" aria-label={`Show ${im.label} on the page`} />
                    <input
                      className="d-input"
                      value={decodeAttr(im.value.alt || '')}
                      placeholder="Describe the photo"
                      aria-label={`Description of ${im.label}`}
                      onChange={(e) => {
                        const alt = encodeAttr(e.target.value);
                        setField(im.id, { alt });
                        tell({ type: 'set-image', id: im.id, src: decodeAttr(im.value.src || ''), alt: e.target.value });
                      }}
                    />
                    <button type="button" className="d-btn sm" onClick={() => setModal({ kind: 'image', id: im.id })}>
                      Replace
                    </button>
                  </div>
                ))}

                <div className="v-sec-group" style={{ marginTop: 22 }}>
                  Buttons and links ({links.length})
                </div>
                {links.map((l) => (
                  <div key={l.id} className="v-link-row">
                    <button type="button" className="linklike" onClick={() => tell({ type: 'scroll-to', id: l.id, block: 'center' })} title="Show on the page">
                      {l.label}
                    </button>
                    <input
                      className="d-input"
                      list="v-pages"
                      value={decodeAttr(l.value.href || '')}
                      aria-label={`Where "${l.label}" goes`}
                      onChange={(e) => {
                        const href = encodeAttr(e.target.value).replace(/&quot;/g, '%22');
                        setField(l.id, { href });
                        tell({ type: 'set-href', id: l.id, href: e.target.value });
                      }}
                    />
                  </div>
                ))}
                <datalist id="v-pages">
                  {routes.map((r) => (
                    <option key={r.route} value={r.route}>
                      {r.title}
                    </option>
                  ))}
                </datalist>
                <div className="d-help" style={{ marginTop: 10 }}>
                  A page on this website, for example /contact-us/, or a full https:// address.
                </div>
              </>
            )}

            {tab === 'sections' && (
              <>
                <HelpBox>
                  {isSite
                    ? 'Every part of the header, menu and footer, with all its wording and links, including the mobile menu. Changes show on the page on the left.'
                    : 'The sections in the order they appear. Drag the six-dot handle to move one; the switch hides a section without deleting it. Click a section to see all its wording, links and photos as a form (handy for anything hard to click on the page).'}
                </HelpBox>
                {fixedFirst && (
                  <SectionRow num={1} section={sections[0]} def={defs[sections[0].template]} open={open === rowId(sections[0])} onToggle={() => { setOpen(open === rowId(sections[0]) ? null : rowId(sections[0])); tell({ type: 'scroll-to', id: sections[0].sectionId }); }} onChange={(s) => setSections([s, ...sections.slice(1)])} draggable={false} routes={routes} />
                )}
                {isSite ? (
                  sections.map((s, i) => (
                    <SectionRow key={rowId(s)} num={i + 1} section={s} def={defs[s.template]} open={open === rowId(s)} onToggle={() => { setOpen(open === rowId(s) ? null : rowId(s)); tell({ type: 'scroll-to', id: s.sectionId }); }} onChange={(x) => setSections(sections.map((y, j) => (j === i ? x : y)))} draggable={false} routes={routes} />
                  ))
                ) : (
                  <SortableList items={sections.slice(1)} getId={(s) => rowId(s)} onReorder={(rest) => setSections([sections[0], ...rest])}>
                    {(s, i) => (
                      <SectionRow num={i + 2} section={s} def={defs[s.template]} open={open === rowId(s)} onToggle={() => { setOpen(open === rowId(s) ? null : rowId(s)); tell({ type: 'scroll-to', id: s.sectionId }); }} onChange={(x) => setSections(sections.map((y, j) => (j === i + 1 ? x : y)))} draggable routes={routes} />
                    )}
                  </SortableList>
                )}
              </>
            )}

            {tab === 'seo' && !isSite && (
              <>
                <SeoPanel value={doc} onChange={(v) => setDoc({ ...doc, ...v })} url={pageUrl} siteName={siteName} fallbackTitle={`${doc.title} | ${siteName}`} />
                {doc.ogImagePath && !doc.ogImage && <div className="d-help">Share image now: the page's banner photo ({doc.ogImagePath}).</div>}
                <TextInput label="Share title (optional)" value={doc.ogTitle || ''} onChange={(ogTitle) => setDoc({ ...doc, ogTitle })} help="Shown when the page is shared on Facebook or in messages. Leave empty to use the meta title." />
                <TextArea label="Share description (optional)" value={doc.ogDescription || ''} onChange={(ogDescription) => setDoc({ ...doc, ogDescription })} rows={2} help="Leave empty to use the meta description." />
              </>
            )}

            {tab === 'settings' && (
              <>
                <TextInput label="Page name (menus, breadcrumbs and the dashboard)" value={doc.title || ''} onChange={(title) => setDoc({ ...doc, title })} />
                {!isSite && <TextInput label="Web address" value={pageUrl} onChange={() => undefined} readOnly help="The same address as on the old WordPress site, so Google keeps the page's ranking. Changing it is done by GYA, with a redirect from the old address." />}
                {isAdmin && (
                  <>
                    <TextInput label="Slug (admin)" value={doc.slug || ''} onChange={(slug) => setDoc({ ...doc, slug })} />
                    <TextInput label="Route (admin)" value={doc.route || ''} onChange={(route) => setDoc({ ...doc, route })} help="Must start and end with /" />
                  </>
                )}
              </>
            )}
          </div>
        </aside>
      </div>

      {modal?.kind === 'image' && (
        <MediaPicker
          onClose={() => setModal(null)}
          onSelect={(m) => {
            const id = modal.id;
            const cur = fieldOf(id).value;
            const src = mediaFull(m) || mediaSrc(m);
            const alt = cur.alt === undefined ? undefined : encodeAttr(m.alt || decodeAttr(cur.alt || ''));
            setField(id, { src, media: m.id, alt });
            tell({ type: 'set-image', id, src, alt: alt === undefined ? null : decodeAttr(alt) });
            setModal(null);
          }}
        />
      )}
      {modal?.kind === 'field' && modalField?.def && (
        <ModalBox title={modalField.label} onClose={() => setModal(null)}>
          <FieldEditor
            def={modalField.def}
            value={modalField.value}
            routes={routes}
            onChange={(v) => {
              setField(modal.id, v);
              reload();
            }}
          />
          <div className="d-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="d-btn primary sm" onClick={() => setModal(null)}>
              Done
            </button>
          </div>
        </ModalBox>
      )}
    </div>
  );
}
