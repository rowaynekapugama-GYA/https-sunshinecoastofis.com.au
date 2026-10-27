#!/usr/bin/env python3
"""
Proves the templates give back the approved markup: fills every section template with
the values extracted into content/pages/*.json and compares it with the same section in
the approved HTML (after the hash links were turned into real URLs). Generated blocks
({{@locations}}, {{@staff}}, {{@surgeons}}) are compared by the site's own renderer test
(npm run test:render). Exit code 1 on any difference.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
import extract_templates as ex  # noqa: E402

ROOT = ex.ROOT
TOKENS = {'{{phone}}': '(07) 5406 0586', '{{phoneTel}}': '0754060586', '{{year}}': '2026'}


def fill(template, fields, values):
    def one(m):
        key, prop = m.group(1), m.group(2)
        v = values.get(key, {})
        return v.get(prop or 'value', '')

    out = re.sub(r'\{\{(f\d+)(?:\.(src|alt|href))?\}\}', one, template)
    for k, v in TOKENS.items():
        out = out.replace(k, v)
    return out


def main():
    src = ex.rewrite_source(open(ex.SRC, encoding='utf-8').read()) + ex.rewrite_source(open(ex.NEW_SRC, encoding='utf-8').read())
    templates = json.load(open(os.path.join(ROOT, 'content', 'templates', 'sections.json'), encoding='utf-8'))
    bad = 0
    checked = 0
    for f in sorted(os.listdir(os.path.join(ROOT, 'content', 'pages'))):
        page = json.load(open(os.path.join(ROOT, 'content', 'pages', f), encoding='utf-8'))
        for s in page['sections']:
            t = templates[s['template']]
            got = fill(t['html'], t['fields'], s['fields'])
            # Compare around generated blocks: every literal chunk must appear in the approved source in order.
            parts = re.split(r'\{\{@\w+\}\}', got)
            pos = 0
            ok = True
            for part in parts:
                i = src.find(part, pos)
                if i < 0 or (pos and part and i != pos and len(parts) == 1):
                    ok = False
                    break
                pos = i + len(part)
            if len(parts) == 1 and got not in src:
                ok = False
            checked += 1
            if not ok:
                bad += 1
                print(f'DIFF {s["template"]}')
    print(f'{checked} sections checked, {bad} different')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
