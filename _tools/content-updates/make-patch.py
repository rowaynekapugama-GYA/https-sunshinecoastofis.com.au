#!/usr/bin/env python3
"""
Builds the dashboard patch for a content update from the before and after copies of content/.

  python3 _tools/content-updates/make-patch.py <content-before-dir> <patch.json>

The patch lists each change with the wording it replaces, so the migration that applies it
(migrations/20261102_000001_seo_compliance_content.ts) changes the dashboard only where the
practice has not edited that wording since. Pages: field, SEO, hidden and section changes.
Team: lede and story paragraphs. Posts: the exact wording edits from the update script.
Redirects: the target address.
"""
import importlib.util
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BEFORE, OUT = sys.argv[1], sys.argv[2]
AFTER = os.path.join(ROOT, 'content')


def load(base, rel):
    p = os.path.join(base, rel)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None


patch = {'pages': {}, 'team': [], 'posts': [], 'redirects': []}

for f in sorted(os.listdir(os.path.join(AFTER, 'pages'))):
    if not f.endswith('.json'):
        continue
    a, b = load(AFTER, f'pages/{f}'), load(BEFORE, f'pages/{f}')
    if a == b:
        continue
    slug = a['slug']
    if b is None:
        patch['pages'][slug] = {'create': a}
        continue
    ops = []
    for k in sorted(set(a.get('seo', {})) | set(b.get('seo', {}))):
        if a['seo'].get(k) != b['seo'].get(k):
            ops.append({'op': 'seo', 'key': k, 'old': b['seo'].get(k), 'new': a['seo'].get(k)})
    bs = {s['id']: s for s in b['sections']}
    as_ = {s['id']: s for s in a['sections']}
    prev = None
    for s in a['sections']:
        o = bs.get(s['id'])
        if o is None:
            ops.append({'op': 'insert', 'after': prev, 'section': s})
        elif o['template'] != s['template']:
            ops.append({'op': 'replace', 'old': o, 'section': s})
        else:
            if bool(o.get('hidden')) != bool(s.get('hidden')):
                ops.append({'op': 'hidden', 'section': s['id'], 'old': bool(o.get('hidden')), 'new': bool(s.get('hidden'))})
            for key in sorted(set(o['fields']) | set(s['fields'])):
                fo, fa = o['fields'].get(key, {}), s['fields'].get(key, {})
                for prop in sorted(set(fo) | set(fa)):
                    if fo.get(prop) != fa.get(prop):
                        ops.append({'op': 'field', 'section': s['id'], 'key': key, 'prop': prop, 'old': fo.get(prop), 'new': fa.get(prop)})
        prev = s['id']
    for sid, o in bs.items():
        if sid not in as_:
            ops.append({'op': 'remove', 'old': o})
    patch['pages'][slug] = {'ops': ops}

ta, tb = load(AFTER, 'team.json'), load(BEFORE, 'team.json')
for group in ('surgeons', 'staff'):
    before = {m['key']: m for m in tb[group]}
    for m in ta[group]:
        o = before.get(m['key'])
        if not o:
            continue
        if m.get('lede') != o.get('lede'):
            patch['team'].append({'key': m['key'], 'field': 'lede', 'old': o.get('lede'), 'new': m.get('lede')})
        for i, (x, y) in enumerate(zip(o.get('story', []), m.get('story', []))):
            if x != y:
                patch['team'].append({'key': m['key'], 'field': 'story', 'index': i, 'old': x, 'new': y})

spec = importlib.util.spec_from_file_location('upd', os.path.join(ROOT, '_tools', 'content-updates', '2026-11-02-seo-compliance.py'))
upd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(upd)
before_posts = {p['slug']: p for p in load(BEFORE, 'posts.json')}
for slug, edits in upd.POST_EDITS.items():
    body = before_posts[slug]['body']
    for old, new in edits:
        if old in body:
            patch['posts'].append({'slug': slug, 'old': old, 'new': new})
            body = body.replace(old, new)
    after_body = next(p['body'] for p in load(AFTER, 'posts.json') if p['slug'] == slug)
    assert body == after_body, f'{slug}: post edits do not reproduce the file'

ra = {r['from']: r['to'] for r in load(AFTER, 'redirects.json')}
for r in load(BEFORE, 'redirects.json'):
    if ra.get(r['from']) != r['to']:
        patch['redirects'].append({'from': r['from'], 'old': r['to'], 'new': ra.get(r['from'])})

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(json.dumps(patch, indent=1, ensure_ascii=False) + '\n')
print(f"{len(patch['pages'])} pages, {len(patch['team'])} team, {len(patch['posts'])} post edits, {len(patch['redirects'])} redirects")
for s, p in patch['pages'].items():
    print(' ', s, 'create' if 'create' in p else [o['op'] for o in p['ops']])
