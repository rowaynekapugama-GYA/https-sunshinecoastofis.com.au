'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { api, mediaSrc } from '../lib/api';
import { useToast } from '../ui/Toast';
import { Check, Select, TextArea, TextInput, HelpBox } from '../ui/fields';
import { MediaPicker, type MediaDoc } from '../ui/MediaPicker';
import { StringListEditor, withId, newId } from './listEditors';
import { SortableList, DragHandle } from '../ui/Sortable';
import { decode, encodeText } from './wording';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TABS = ['Practice', 'Opening hours', 'Locations', 'Brand', 'Tracking and links'] as const;
const PINS = [
  { label: '1 Buderim', value: '1' },
  { label: '2 Maroochydore', value: '2' },
  { label: '3 Nambour', value: '3' },
  { label: '4 Hervey Bay', value: '4' },
];
/** Location wording is stored as page HTML (an & as typed); quotes are made safe. */
const plain = (s: unknown) => decode(String(s ?? ''));
const safe = (s: string) => encodeText(s).replace(/"/g, '&quot;');

function ImagePick({ label, value, onChange, fallback, help }: { label: string; value: any; onChange: (m: MediaDoc | null) => void; fallback: string; help: string }) {
  const [open, setOpen] = useState(false);
  const m = value && typeof value === 'object' ? (value as MediaDoc) : null;
  return (
    <div className="d-field">
      <span className="d-label">{label}</span>
      <div className="d-image">
        <div className="d-image-thumb" style={{ backgroundImage: `url("${m ? mediaSrc(m) : fallback}")`, backgroundSize: 'contain', backgroundColor: '#fff' }} />
        <div className="d-image-info">
          <div className="src">{m ? `Library image: ${m.alt || m.filename}` : 'Built into the site'}</div>
          <div className="d-actions">
            <button type="button" className="d-btn sm" onClick={() => setOpen(true)}>
              Choose from library / Upload
            </button>
            {m && (
              <button type="button" className="d-btn sm ghost" onClick={() => onChange(null)}>
                Use the built-in one
              </button>
            )}
          </div>
          <div className="d-help">{help}</div>
        </div>
      </div>
      {open && (
        <MediaPicker
          onClose={() => setOpen(false)}
          onSelect={(x) => {
            onChange(x);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

export function SettingsForm({ initial, isAdmin }: { initial: any; isAdmin: boolean }) {
  const toast = useToast();
  const [doc, setDoc] = useState<any>(() => {
    const d = { ...initial };
    const byDay = new Map((d.hours || []).map((h: any) => [h.day, h]));
    d.hours = DAYS.map((day) => byDay.get(day) || { day, closed: true });
    d.address = d.address || {};
    d.social = d.social || {};
    d.colours = d.colours || {};
    d.geo = d.geo || {};
    d.tracking = d.tracking || {};
    d.locations = (d.locations || []).map((l: any) => withId({ ...l, name: plain(l.name), area: plain(l.area), address: plain(l.address), note: plain(l.note), mapQuery: plain(l.mapQuery), mapLink: plain(l.mapLink), mapEmbed: plain(l.mapEmbed) }));
    d.areaServed = (d.areaServed || []).map(withId);
    return d;
  });
  const [saved, setSaved] = useState(doc);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Practice');
  const [busy, setBusy] = useState(false);
  const dirty = useMemo(() => JSON.stringify(doc) !== JSON.stringify(saved), [doc, saved]);
  const up = (patch: Record<string, unknown>) => setDoc({ ...doc, ...patch });
  const upIn = (group: string, patch: Record<string, unknown>) => setDoc({ ...doc, [group]: { ...(doc[group] || {}), ...patch } });
  const visibleTabs = TABS.filter((t) => t !== 'Tracking and links' || isAdmin);

  useEffect(() => {
    if (window.location.hash === '#locations') setTab('Locations');
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const { id, createdAt, updatedAt, globalType, ...rest } = doc;
      const body: any = {
        ...rest,
        hours: doc.hours.map((h: any) => ({ day: h.day, closed: Boolean(h.closed), open: h.closed ? '' : h.open || '', close: h.closed ? '' : h.close || '' })),
        locations: doc.locations.map((l: any) => ({
          id: l.id,
          name: safe(l.name),
          area: encodeText(l.area),
          address: safe(l.address),
          note: safe(l.note || ''),
          mapQuery: safe(l.mapQuery || l.name),
          mapLink: (l.mapLink || '').trim(),
          mapEmbed: (l.mapEmbed || '').trim(),
          pin: l.pin || '1',
          main: Boolean(l.main),
          hidden: Boolean(l.hidden),
        })),
        areaServed: doc.areaServed,
        logo: doc.logo && typeof doc.logo === 'object' ? doc.logo.id : doc.logo || null,
        defaultShareImage: doc.defaultShareImage && typeof doc.defaultShareImage === 'object' ? doc.defaultShareImage.id : doc.defaultShareImage || null,
      };
      if (!isAdmin) delete body.tracking;
      await api.post('/api/globals/site-settings?depth=1', body);
      setSaved(doc);
      toast('Settings saved. Publish website to update the live site.', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const setLoc = (i: number, patch: Record<string, unknown>) => up({ locations: doc.locations.map((l: any, j: number) => (j === i ? { ...l, ...patch } : l)) });

  return (
    <>
      <div className="d-save-bar">
        <span className={`state ${dirty ? 'dirty' : ''}`}>{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
        <div className="d-topbar-spacer" />
        <button className="d-btn primary" onClick={save} disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </div>
      <div className="d-tabs">
        {visibleTabs.map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Practice' && (
        <div className="d-card" style={{ maxWidth: 860 }}>
          <TextInput label="Practice name" value={doc.name || ''} onChange={(name) => up({ name })} />
          <div className="d-row">
            <TextInput label="Phone, as shown on the website" value={doc.phone || ''} onChange={(phone) => up({ phone })} help="Changes the number in every button, the header, the footer and the wording." />
            <TextInput label="Phone for tap-to-call" value={doc.phoneTel || ''} onChange={(phoneTel) => up({ phoneTel: phoneTel.replace(/[^\d+]/g, '') })} help="Digits only, for example 0754060586." />
          </div>
          <TextInput label="Phone, international (for Google)" value={doc.phoneIntl || ''} onChange={(phoneIntl) => up({ phoneIntl })} help="For example +61754060586." />
          <TextInput label="Street address (for Google)" value={doc.address.street || ''} onChange={(street) => upIn('address', { street })} />
          <div className="d-row">
            <TextInput label="Suburb" value={doc.address.suburb || ''} onChange={(suburb) => upIn('address', { suburb })} />
            <TextInput label="State" value={doc.address.state || ''} onChange={(state) => upIn('address', { state })} />
            <TextInput label="Postcode" value={doc.address.postcode || ''} onChange={(postcode) => upIn('address', { postcode })} />
          </div>
          <HelpBox>The address and hours shown in the page wording (footer, Contact and Locations pages) are edited on those pages. The details here are what Google reads.</HelpBox>
          <TextInput label="Google Maps link for the practice" value={doc.mapsUrl || ''} onChange={(mapsUrl) => up({ mapsUrl })} />
          <TextInput label="Google &quot;Leave a review&quot; link" value={doc.googleReviewUrl || ''} onChange={(googleReviewUrl) => up({ googleReviewUrl })} />
          <TextInput label="Google reviews link" value={doc.googleReviewsUrl || ''} onChange={(googleReviewsUrl) => up({ googleReviewsUrl })} />
          <div className="d-row">
            <TextInput label="Facebook page" value={doc.social.facebook || ''} onChange={(facebook) => upIn('social', { facebook })} />
            <TextInput label="Instagram" value={doc.social.instagram || ''} onChange={(instagram) => upIn('social', { instagram })} />
          </div>
          <div className="d-field">
            <span className="d-label">Areas served (for Google)</span>
            <StringListEditor value={doc.areaServed} onChange={(areaServed) => up({ areaServed })} itemLabel="Area" rows={1} />
          </div>
        </div>
      )}

      {tab === 'Opening hours' && (
        <div className="d-card" style={{ maxWidth: 760 }}>
          <HelpBox>These hours go to Google with the practice listing. The hours written on the Contact and Locations pages are edited on those pages.</HelpBox>
          {doc.hours.map((h: any, i: number) => (
            <div className="d-row" key={h.day} style={{ alignItems: 'end' }}>
              <div className="d-field" style={{ minWidth: 120 }}>
                <span className="d-label">{h.day}</span>
                <Check label="Closed" checked={Boolean(h.closed)} onChange={(closed) => up({ hours: doc.hours.map((x: any, j: number) => (j === i ? { ...x, closed } : x)) })} />
              </div>
              {!h.closed && (
                <>
                  <TextInput label="Opens (24 hour)" value={h.open || ''} onChange={(open) => up({ hours: doc.hours.map((x: any, j: number) => (j === i ? { ...x, open } : x)) })} placeholder="08:00" />
                  <TextInput label="Closes (24 hour)" value={h.close || ''} onChange={(close) => up({ hours: doc.hours.map((x: any, j: number) => (j === i ? { ...x, close } : x)) })} placeholder="17:00" />
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'Locations' && (
        <div className="d-content narrow" style={{ padding: 0 }}>
          <HelpBox>The location cards on the home page and the Locations page, in this order. Change an address, a note or a map link here and both pages update. Drag to reorder.</HelpBox>
          <SortableList items={doc.locations} getId={(l: any) => l.id} onReorder={(locations) => up({ locations })}>
            {(l: any, i) => (
              <div className="d-card" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <DragHandle />
                  <strong>{l.name || 'New location'}</strong>
                  <span className="muted">{l.area}</span>
                  <div className="d-topbar-spacer" />
                  <button type="button" className="d-btn sm ghost" onClick={() => window.confirm(`Remove ${l.name}?`) && up({ locations: doc.locations.filter((_: any, j: number) => j !== i) })}>
                    Remove
                  </button>
                </div>
                <div className="d-row">
                  <TextInput label="Name" value={l.name} onChange={(name) => setLoc(i, { name })} />
                  <TextInput label="Area label" value={l.area} onChange={(area) => setLoc(i, { area })} help="The small line above the name, for example Maroochydore." />
                </div>
                <TextInput label="Address" value={l.address} onChange={(address) => setLoc(i, { address })} />
                <TextArea label="Short note" value={l.note || ''} onChange={(note) => setLoc(i, { note })} rows={2} help="Shown on the Locations page when this location is selected." />
                <TextInput label="Google Maps link (Get directions)" value={l.mapLink || ''} onChange={(mapLink) => setLoc(i, { mapLink })} />
                <TextInput label="Map search wording" value={l.mapQuery || ''} onChange={(mapQuery) => setLoc(i, { mapQuery })} help="What the map on the Locations page looks up, for example: Buderim Private Hospital, 12 Elsa Wilson Drive, Buderim QLD" />
                <TextInput label="Map embed link (optional)" value={l.mapEmbed || ''} onChange={(mapEmbed) => setLoc(i, { mapEmbed })} help="Google Maps > Share > Embed a map > copy the address inside src=&quot;...&quot;. Used instead of the search wording." />
                <div className="d-row">
                  <Select label="Pin on the coast map" value={l.pin || '1'} onChange={(pin) => setLoc(i, { pin })} options={PINS} />
                  <Check label="Main practice (highlighted card)" checked={Boolean(l.main)} onChange={(main) => setLoc(i, { main })} />
                  <Check label="Hide" checked={Boolean(l.hidden)} onChange={(hidden) => setLoc(i, { hidden })} />
                </div>
              </div>
            )}
          </SortableList>
          <button type="button" className="d-add" onClick={() => up({ locations: [...doc.locations, { id: newId(), name: '', area: '', address: '', note: '', mapLink: '', mapQuery: '', mapEmbed: '', pin: '1', main: false, hidden: false }] })}>
            + Add a location
          </button>
        </div>
      )}

      {tab === 'Brand' && (
        <div className="d-card" style={{ maxWidth: 860 }}>
          <ImagePick label="Logo" value={doc.logo} onChange={(logo) => up({ logo })} fallback="/images/logo.png" help="Replaces the logo in the header, mobile menu and footer. A wide PNG with a transparent background works best." />
          <ImagePick label="Default share image" value={doc.defaultShareImage} onChange={(defaultShareImage) => up({ defaultShareImage })} fallback="/images/reception2.jpg" help="Used when a page is shared on Facebook or in messages and has no share image of its own. 1200 x 630." />
          <div className="d-row">
            <TextInput label="Main colour (navy)" value={doc.colours.navy || ''} onChange={(navy) => upIn('colours', { navy })} placeholder="#182650" help="Leave empty to keep the colours the site was designed with." />
            <TextInput label="Accent colour (cyan)" value={doc.colours.cyan || ''} onChange={(cyan) => upIn('colours', { cyan })} placeholder="#1DB2DE" />
          </div>
        </div>
      )}

      {tab === 'Tracking and links' && isAdmin && (
        <div className="d-card" style={{ maxWidth: 860 }}>
          <HelpBox>GYA only. These load on every public page once the website is published.</HelpBox>
          <TextInput label="Google Analytics 4 measurement ID" value={doc.tracking.ga4Id || ''} onChange={(ga4Id) => upIn('tracking', { ga4Id: ga4Id.trim() })} placeholder="G-XXXXXXXXXX" />
          <TextInput label="Google Tag Manager container ID" value={doc.tracking.gtmId || ''} onChange={(gtmId) => upIn('tracking', { gtmId: gtmId.trim() })} placeholder="GTM-XXXXXXX" help="Leave blank unless a container is set up. Do not add GA4 both here and in Tag Manager." />
          <TextInput label="Meta Pixel ID" value={doc.tracking.metaPixelId || ''} onChange={(metaPixelId) => upIn('tracking', { metaPixelId: metaPixelId.trim() })} />
          <TextInput label="Google Search Console verification code" value={doc.tracking.searchConsoleVerification || ''} onChange={(searchConsoleVerification) => upIn('tracking', { searchConsoleVerification: searchConsoleVerification.trim() })} help='Only the content="..." value of the google-site-verification tag. Not needed if Search Console is verified by DNS.' />
        </div>
      )}
    </>
  );
}
