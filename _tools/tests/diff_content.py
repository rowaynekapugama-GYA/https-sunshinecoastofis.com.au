#!/usr/bin/env python3
"""Deep-compare two content folders (JSON values, key order ignored). Usage: diff_content.py <before> <after>"""
import json, os, sys

A, B = sys.argv[1], sys.argv[2]
bad = 0


def walk(a, b, path):
    global bad
    if type(a) != type(b):
        print('TYPE', path, repr(a)[:80], repr(b)[:80]); bad += 1; return
    if isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b:
                print('KEY', f'{path}.{k}', 'only in', 'before' if k in a else 'after', repr(a.get(k, b.get(k)))[:100]); bad += 1
            else:
                walk(a[k], b[k], f'{path}.{k}')
    elif isinstance(a, list):
        if len(a) != len(b):
            print('LEN', path, len(a), len(b)); bad += 1; return
        for i, (x, y) in enumerate(zip(a, b)):
            walk(x, y, f'{path}[{i}]')
    elif a != b:
        print('VAL', path, repr(a)[:120], '|', repr(b)[:120]); bad += 1


files = ['site-settings.json', 'team.json', 'posts.json', 'redirects.json'] + ['pages/' + f for f in sorted(os.listdir(os.path.join(A, 'pages')))]
extra = set(os.listdir(os.path.join(B, 'pages'))) - set(os.listdir(os.path.join(A, 'pages')))
for f in sorted(extra):
    print('EXTRA FILE pages/' + f); bad += 1
for rel in files:
    walk(json.load(open(os.path.join(A, rel))), json.load(open(os.path.join(B, rel))), rel)
print(f'{len(files)} files compared, {bad} differences')
sys.exit(1 if bad else 0)
