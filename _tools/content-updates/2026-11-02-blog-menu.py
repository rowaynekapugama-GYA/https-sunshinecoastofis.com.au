#!/usr/bin/env python3
"""
Content update 3.2.1, 2 Nov 2026: Blog link in the main navigation (SEO team request).

  python3 _tools/content-updates/2026-11-02-blog-menu.py

Desktop: a sixth item in the Patients dropdown, in the existing icon-row style. A sixth
top-level item was tested and squeezes the logo to 63 to 103 px wide between 1140 and
1250 px, so it is not used. Mobile menu: a Blog link after Patient information.

The dashboard gets the same change through migrations/20261102_000002_blog_menu.ts.
Safe to run twice.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
C = os.path.join(ROOT, 'content')

ICON = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
        '<path d="M4 5h12v14H6a2 2 0 0 1-2-2z"/><path d="M16 9h4v8a2 2 0 0 1-4 0"/><path d="M8 9h4M8 13h4"/></svg>')

# ---- templates (file format: indent 1)
path = os.path.join(C, 'templates', 'sections.json')
t = json.load(open(path, encoding='utf-8'))
h = t['site/header']
anchor = '<span>{{f55}}</span></a>\n'
if '{{f60.href}}' not in h['html']:
    assert h['html'].count(anchor) == 1
    h['html'] = h['html'].replace(anchor, anchor + f'          <a href="{{{{f60.href}}}}"><i>{ICON}</i><span>{{{{f61}}}}</span></a>\n')
    h['fields']['f60'] = {'type': 'href', 'label': 'Link address (Blog)'}
    h['fields']['f61'] = {'type': 'text', 'label': 'Text (Blog)'}
d = t['site/drawer']
line = '  <a href="{{f13.href}}">{{f13}}</a>\n'
if '{{f19.href}}' not in d['html']:
    assert d['html'].count(line) == 1
    d['html'] = d['html'].replace(line, line + '  <a href="{{f19.href}}">{{f19}}</a>\n')
    d['fields']['f19'] = {'type': 'link', 'label': 'Link (Blog)'}
with open(path, 'w', encoding='utf-8') as f:
    f.write(json.dumps(t, indent=1, ensure_ascii=False) + '\n')

# ---- the header and menu record (pages format: indent 2)
p = os.path.join(C, 'pages', 'site-wide.json')
sw = json.load(open(p, encoding='utf-8'))
for s in sw['sections']:
    if s['id'] == 'header':
        s['fields'].setdefault('f60', {'href': '/blog/'})
        s['fields'].setdefault('f61', {'value': 'Blog'})
    if s['id'] == 'drawer':
        s['fields'].setdefault('f19', {'value': 'Blog', 'href': '/blog/'})
with open(p, 'w', encoding='utf-8') as f:
    f.write(json.dumps(sw, indent=2, ensure_ascii=False) + '\n')
print('Blog link added to the Patients dropdown and the mobile menu')
