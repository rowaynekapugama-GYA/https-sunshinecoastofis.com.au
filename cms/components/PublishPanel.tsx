'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { Button, toast } from '@payloadcms/ui';

type Status = {
  lastChangedAt?: string | null;
  lastPublishedAt?: string | null;
  lastPublishedBy?: string | null;
  lastPublishStatus?: string | null;
  lastImportAt?: string | null;
  hookConfigured?: boolean;
  role?: string;
};

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'never';

/**
 * Sits at the top of the dashboard. Saving in the dashboard does not change the
 * website by itself; this button asks Vercel to rebuild it with the latest
 * content, which takes two or three minutes.
 */
export const PublishPanel: React.FC = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<'publish' | 'import' | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/site-status', { credentials: 'include', cache: 'no-store' });
      if (res.ok) setStatus(await res.json());
    } catch {
      /* dashboard still usable without the panel */
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const pending = Boolean(status?.lastChangedAt && (!status.lastPublishedAt || new Date(status.lastChangedAt) > new Date(status.lastPublishedAt)));

  const publish = async () => {
    setBusy('publish');
    try {
      const res = await fetch('/api/publish-site', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (data.ok) toast.success('Publishing started. The website updates in about 2 to 3 minutes.');
      else toast.error(data.error || data.detail || 'Publish failed');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
      void load();
    }
  };

  const importContent = async (overwrite: boolean) => {
    if (overwrite && !window.confirm('Replace every page, the team and the settings with the files in the code? Dashboard edits will be lost.')) return;
    setBusy('import');
    try {
      const res = await fetch(`/api/import-content${overwrite ? '?overwrite=1' : ''}`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        const r = data.report;
        toast.success(`Imported: ${r.pagesCreated.length} pages created, ${r.pagesUpdated.length} updated, ${r.pagesSkipped.length} left as they were. Team: ${r.teamCreated.length} created. Settings ${r.settings}.`);
      } else toast.error(data.error || 'Import failed');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
      void load();
    }
  };

  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 8,
        padding: '1.25rem 1.5rem',
        marginBottom: '2rem',
        background: pending ? 'var(--theme-warning-50, #fff7e6)' : 'var(--theme-elevation-50)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <strong style={{ fontSize: '1.05rem' }}>{pending ? 'You have changes that are not on the website yet.' : 'The website is up to date with the dashboard.'}</strong>
          <div style={{ opacity: 0.75, marginTop: 4, fontSize: '0.9rem' }}>
            Last published {fmt(status?.lastPublishedAt)}
            {status?.lastPublishedBy ? ` by ${status.lastPublishedBy}` : ''} · Last change {fmt(status?.lastChangedAt)}
            {status?.lastPublishStatus ? ` · ${status.lastPublishStatus}` : ''}
          </div>
          {status && !status.hookConfigured && (
            <div style={{ color: 'var(--theme-error-500)', marginTop: 6, fontSize: '0.9rem' }}>
              Publishing is not connected yet: add the Vercel deploy hook as PUBLISH_HOOK_URL in the Vercel project settings.
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button onClick={publish} disabled={busy !== null} buttonStyle="primary">
            {busy === 'publish' ? 'Publishing…' : 'Publish website'}
          </Button>
          {status?.role === 'admin' && (
            <>
              <Button onClick={() => importContent(false)} disabled={busy !== null} buttonStyle="secondary">
                {busy === 'import' ? 'Importing…' : 'Import missing content'}
              </Button>
              <Button onClick={() => importContent(true)} disabled={busy !== null} buttonStyle="pill">
                Reset from files
              </Button>
            </>
          )}
        </div>
      </div>
      <p style={{ margin: '0.9rem 0 0', fontSize: '0.88rem', opacity: 0.8 }}>
        How it works: edit a page and click Save. When you are happy with everything, click Publish website. The live site is rebuilt with your changes in about
        two to three minutes. Enquiries do not need publishing.
      </p>
    </div>
  );
};
