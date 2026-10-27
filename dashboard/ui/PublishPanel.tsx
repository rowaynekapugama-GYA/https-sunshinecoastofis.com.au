'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { Icons } from './Icons';
import { useToast } from './Toast';
import { api } from '../lib/api';

type Status = {
  lastChangedAt?: string | null;
  lastPublishedAt?: string | null;
  lastPublishedBy?: string | null;
  lastPublishStatus?: string | null;
  hookConfigured?: boolean;
  role?: string;
};
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'never');

/**
 * Saving in the dashboard changes the dashboard only. Publish website asks
 * Vercel to rebuild the site with everything saved so far (two to three minutes).
 */
export function PublishPanel({ compact = false, showImport = false }: { compact?: boolean; showImport?: boolean }) {
  const toast = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setStatus(await api.get<Status>('/api/site-status'));
    } catch {
      /* panel is informational */
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const pending = Boolean(status?.lastChangedAt && (!status.lastPublishedAt || new Date(status.lastChangedAt) > new Date(status.lastPublishedAt)));

  const publish = async () => {
    setBusy('publish');
    try {
      const r = await api.post('/api/publish-site');
      toast(r.ok ? 'Publishing started. The website updates in about 2 to 3 minutes.' : r.detail || 'Publish failed', r.ok ? 'success' : 'error');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
      void load();
    }
  };
  const importContent = async (overwrite: boolean) => {
    if (overwrite && !window.confirm('Replace every page, the team and the settings with the files in the code? Dashboard edits will be lost.')) return;
    setBusy('import');
    try {
      const r = await api.post(`/api/import-content${overwrite ? '?overwrite=1' : ''}`);
      const rep = r.report;
      toast(`Imported: ${rep.pagesCreated.length} pages created, ${rep.pagesUpdated.length} updated, ${rep.pagesSkipped.length} unchanged. Team ${rep.teamCreated.length} added. Settings ${rep.settings}.`, 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
      void load();
    }
  };
  const Rocket = Icons.rocket;
  const Warn = Icons.warning;
  const Ok = Icons.check;

  return (
    <div className={`d-notice ${pending ? 'warn' : 'ok'}`} role="status">
      {pending ? <Warn width={22} height={22} /> : <Ok width={22} height={22} />}
      <div className="grow">
        <strong>{pending ? 'You have changes that are not on the website yet.' : 'The website is up to date with the dashboard.'}</strong>
        {!compact && (
          <small>
            Last published {fmt(status?.lastPublishedAt)}
            {status?.lastPublishedBy ? ` by ${status.lastPublishedBy}` : ''} · Last change {fmt(status?.lastChangedAt)}
            {status?.lastPublishStatus ? ` · ${status.lastPublishStatus}` : ''}
          </small>
        )}
        {status && !status.hookConfigured && <small style={{ color: 'var(--d-danger)' }}>Publishing is not connected yet. GYA needs to add the Vercel deploy hook (PUBLISH_HOOK_URL).</small>}
      </div>
      <div className="d-actions">
        <button className="d-btn primary" onClick={publish} disabled={busy !== null}>
          <Rocket /> {busy === 'publish' ? 'Publishing…' : 'Publish website'}
        </button>
        {showImport && status?.role === 'admin' && (
          <>
            <button className="d-btn" onClick={() => importContent(false)} disabled={busy !== null}>
              {busy === 'import' ? 'Importing…' : 'Import missing content'}
            </button>
            <button className="d-btn ghost sm" onClick={() => importContent(true)} disabled={busy !== null}>
              Reset from files
            </button>
          </>
        )}
      </div>
    </div>
  );
}
