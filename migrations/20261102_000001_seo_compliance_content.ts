/**
 * Content update, 2 Nov 2026 (version 3.2.0): SEO and compliance fixes before go-live.
 *
 * The site is built from the dashboard, so the wording changes made in content/ (by
 * _tools/content-updates/2026-11-02-seo-compliance.py) are applied to the dashboard here,
 * once, during the next build. Data only, no table changes.
 *
 * Every change carries the wording it replaces and is applied only where the dashboard
 * still has that wording, so nothing the practice has edited since is overwritten.
 * Anything skipped is listed in the build log ("[content 3.2.0] skipped ...").
 * A dashboard that has not been imported yet is left alone (Import loads the new files).
 *
 * Patch: migrations/data/20261102-seo-compliance.json (made by _tools/content-updates/make-patch.py).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres';
import { pageFromDoc, pageToDoc } from '../cms/sync';
import type { PageData, SectionData, TemplateDef } from '../lib/types';

type Op =
  | { op: 'seo'; key: string; old: unknown; new: unknown }
  | { op: 'field'; section: string; key: string; prop: string; old: unknown; new: unknown }
  | { op: 'hidden'; section: string; old: boolean; new: boolean }
  | { op: 'insert'; after: string | null; section: SectionData }
  | { op: 'replace'; old: SectionData; section: SectionData }
  | { op: 'remove'; old: SectionData };

interface Patch {
  pages: Record<string, { create?: PageData; ops?: Op[] }>;
  team: { key: string; field: 'lede' | 'story'; index?: number; old: string; new: string }[];
  posts: { slug: string; old: string; new: string }[];
  redirects: { from: string; old: string; new: string }[];
}

const TAG = '[content 3.2.0]';
const SEO_FIELDS: Record<string, string> = {
  metaTitle: 'metaTitle',
  metaDescription: 'metaDescription',
  ogTitle: 'ogTitle',
  ogDescription: 'ogDescription',
  ogImage: 'ogImagePath',
  canonical: 'canonical',
  noindex: 'noindex',
  primaryKeyword: 'primaryKeyword',
};
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const readJson = <T>(rel: string): T => JSON.parse(fs.readFileSync(path.join(process.cwd(), rel), 'utf8')) as T;

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const patch = readJson<Patch>('migrations/data/20261102-seo-compliance.json');
  const templates = readJson<Record<string, TemplateDef>>('content/templates/sections.json');
  const fieldType = (t: string, k: string) => templates[t]?.fields?.[k]?.type;
  const opts = { depth: 0, overrideAccess: true, req, context: { importing: true } } as const;

  const any = await payload.find({ collection: 'pages', limit: 1, ...opts });
  if (!any.docs.length) {
    payload.logger.info(`${TAG} dashboard not imported yet; nothing to update (Import loads the new content).`);
    return;
  }
  const skipped: string[] = [];
  let applied = 0;

  // ---- pages
  for (const [slug, change] of Object.entries(patch.pages)) {
    const found = await payload.find({ collection: 'pages', where: { slug: { equals: slug } }, limit: 1, draft: false, ...opts });
    const doc: any = found.docs[0];
    if (change.create) {
      if (doc) continue; // already there (or made in the dashboard): left as it is
      else {
        await payload.create({ collection: 'pages', data: pageToDoc(change.create) as any, draft: false, ...opts });
        applied++;
      }
      continue;
    }
    if (!doc) {
      skipped.push(`${slug}: page not in the dashboard`);
      continue;
    }
    // Compare against the page as the site sees it; change the dashboard's own records.
    const seen = pageFromDoc(doc, fieldType);
    const sections: any[] = (doc.sections || []).map((s: any) => ({ ...s, fields: { ...(s.fields || {}) } }));
    const seenById = new Map(seen.sections.map((s) => [s.id, s]));
    const at = (id: string) => sections.findIndex((s) => s.sectionId === id);
    const data: Record<string, unknown> = {};
    let changed = false;
    for (const op of change.ops || []) {
      const label = `${slug} ${op.op}`;
      if (op.op === 'seo') {
        const key = SEO_FIELDS[op.key];
        if (same(seen.seo?.[op.key as keyof PageData['seo']], op.new)) continue; // already done
        if (same(seen.seo?.[op.key as keyof PageData['seo']], op.old)) {
          data[key] = op.new ?? (op.key === 'noindex' ? false : '');
          changed = true;
        } else skipped.push(`${label} ${op.key}: edited in the dashboard`);
      } else if (op.op === 'field') {
        const i = at(op.section);
        const cur = seenById.get(op.section)?.fields?.[op.key] as Record<string, unknown> | undefined;
        if (i >= 0 && same(cur?.[op.prop], op.new)) continue; // already done
        if (i < 0 || !same(cur?.[op.prop], op.old)) {
          skipped.push(`${label} ${op.section}.${op.key}: edited in the dashboard`);
          continue;
        }
        sections[i].fields[op.key] = { ...(sections[i].fields[op.key] || {}), [op.prop]: op.new };
        if (op.prop === 'src') delete sections[i].fields[op.key].media;
        changed = true;
      } else if (op.op === 'hidden') {
        const i = at(op.section);
        if (i >= 0 && Boolean(sections[i].hidden) === op.new) continue; // already done
        if (i < 0 || Boolean(sections[i].hidden) !== op.old) skipped.push(`${label} ${op.section}: changed in the dashboard`);
        else {
          sections[i].hidden = op.new;
          changed = true;
        }
      } else if (op.op === 'insert') {
        if (at(op.section.id) >= 0) continue; // already there
        const after = op.after ? at(op.after) : -1;
        const row = { sectionId: op.section.id, template: op.section.template, hidden: Boolean(op.section.hidden), fields: op.section.fields };
        if (op.after && after < 0) sections.push(row);
        else sections.splice(after + 1, 0, row);
        changed = true;
      } else if (op.op === 'replace' || op.op === 'remove') {
        const i = at(op.old.id);
        const cur = seenById.get(op.old.id);
        if (op.op === 'replace' && cur && same(cur, { id: op.section.id, template: op.section.template, fields: op.section.fields, ...(op.section.hidden ? { hidden: true } : {}) })) continue; // already done
        const old = { id: op.old.id, template: op.old.template, fields: op.old.fields, ...(op.old.hidden ? { hidden: true } : {}) };
        if (i < 0 || !cur || !same(cur, old)) {
          skipped.push(`${label} ${op.old.id}: edited in the dashboard`);
          continue;
        }
        if (op.op === 'remove') sections.splice(i, 1);
        else sections[i] = { sectionId: op.section.id, template: op.section.template, hidden: Boolean(op.section.hidden), fields: op.section.fields };
        changed = true;
      }
    }
    if (changed) {
      data.sections = sections.map((s) => ({ sectionId: s.sectionId, template: s.template, hidden: Boolean(s.hidden), fields: s.fields }));
      await payload.update({ collection: 'pages', id: doc.id, data: { ...data, _status: 'published' } as any, draft: false, ...opts });
      applied++;
    }
  }

  // ---- team
  for (const t of patch.team) {
    const found = await payload.find({ collection: 'team', where: { key: { equals: t.key } }, limit: 1, ...opts });
    const doc: any = found.docs[0];
    if (!doc) {
      skipped.push(`team ${t.key}: not in the dashboard`);
      continue;
    }
    if (t.field === 'lede') {
      if (doc.lede === t.new) continue;
      if (doc.lede !== t.old) skipped.push(`team ${t.key} lede: edited in the dashboard`);
      else {
        await payload.update({ collection: 'team', id: doc.id, data: { lede: t.new } as any, ...opts });
        applied++;
      }
    } else {
      const story = (doc.story || []).map((r: any) => ({ value: r?.value }));
      if (story[t.index!]?.value === t.new) continue;
      if (story[t.index!]?.value !== t.old) skipped.push(`team ${t.key} story ${t.index! + 1}: edited in the dashboard`);
      else {
        story[t.index!].value = t.new;
        await payload.update({ collection: 'team', id: doc.id, data: { story } as any, ...opts });
        applied++;
      }
    }
  }

  // ---- blog posts: each wording edit on its own
  const bodies = new Map<string, { id: number | string; body: string; start: string }>();
  for (const p of patch.posts) {
    if (!bodies.has(p.slug)) {
      const found = await payload.find({ collection: 'posts', where: { slug: { equals: p.slug } }, limit: 1, draft: false, ...opts });
      const doc: any = found.docs[0];
      if (!doc) {
        skipped.push(`post ${p.slug}: not in the dashboard`);
        bodies.set(p.slug, { id: '', body: '', start: '' });
        continue;
      }
      const body = typeof doc.body === 'string' ? doc.body : '';
      bodies.set(p.slug, { id: doc.id, body, start: body });
    }
    const b = bodies.get(p.slug)!;
    if (!b.id) continue;
    const n = b.body.split(p.old).length - 1;
    if (n === 1) b.body = b.body.replace(p.old, () => p.new);
    else if (p.new ? !b.body.includes(p.new) : n > 1) skipped.push(`post ${p.slug}: wording not found "${p.old.slice(0, 60)}..."`);
  }
  for (const [slug, b] of bodies) {
    if (b.id && b.body !== b.start) {
      await payload.update({ collection: 'posts', id: b.id, data: { body: b.body, _status: 'published' } as any, draft: false, ...opts });
      applied++;
    }
  }

  // ---- redirects
  for (const r of patch.redirects) {
    const found = await payload.find({ collection: 'redirects', where: { from: { equals: r.from } }, limit: 1, ...opts });
    const doc: any = found.docs[0];
    if (!doc) skipped.push(`redirect ${r.from}: not in the dashboard`);
    else if (doc.to === r.new) continue;
    else if (doc.to !== r.old) skipped.push(`redirect ${r.from}: changed in the dashboard (now ${doc.to})`);
    else {
      await payload.update({ collection: 'redirects', id: doc.id, data: { to: r.new } as any, ...opts });
      applied++;
    }
  }

  payload.logger.info(`${TAG} ${applied} records updated, ${skipped.length} changes skipped`);
  for (const s of skipped) payload.logger.warn(`${TAG} skipped ${s}`);
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Content changes are not reversed automatically: restore an earlier page version in the dashboard instead.
  payload.logger.info(`${TAG} down: nothing to do (use page version history in the dashboard).`);
}
