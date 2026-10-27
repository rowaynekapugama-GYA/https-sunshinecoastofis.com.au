#!/usr/bin/env python3
"""
SEO migration checks: the live WordPress site (crawl in _tools/source/live-crawl.json)
against a running build of the new site.

  python3 _tools/seo_migration.py http://localhost:3000

Writes to seo-migration/:
  live-inventory.json / .csv   every live URL and its SEO fields (from the crawl)
  url-parity.csv / .json       every live URL requested on the new site: status, where it
                               goes, how many hops, and whether it ends on a 200 page
  wordpress-patterns.csv       WordPress addresses (feeds, archives, ?p=, login, sitemaps)
  metadata-diff.json / .csv    title, meta description, canonical and H1, live vs new
  sitemap-check.csv            every URL in the new sitemap.xml: 200, self canonical, indexable
"""
import csv
import html
import json
import os
import re
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000').rstrip('/')
LIVE = 'https://sunshinecoastofis.com.au'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'seo-migration')
CRAWL = os.path.join(ROOT, '_tools', 'source', 'live-crawl.json')
os.makedirs(OUT, exist_ok=True)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


opener = urllib.request.build_opener(NoRedirect)


def get(path, host=None):
    req = urllib.request.Request(BASE + path, headers={'User-Agent': 'scofis-seo-check', **({'Host': host} if host else {})})
    try:
        r = opener.open(req, timeout=30)
        return r.status, r.headers.get('Location'), r.read().decode('utf8', 'replace'), dict(r.headers)
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf8', 'replace') if e.fp else ''
        return e.code, e.headers.get('Location'), body, dict(e.headers)


def local(loc):
    """A Location header as a path on the test server."""
    if not loc:
        return None
    for prefix in (BASE, LIVE, 'http://sunshinecoastofis.com.au'):
        if loc.startswith(prefix):
            return loc[len(prefix):] or '/'
    return loc


def follow(path, host=None):
    """Request a path and follow redirects. Returns (first status, hops, final path, final status, body)."""
    hops, cur, first, seen = 0, path, None, set()
    status, loc, body, headers = get(cur, host)
    first = status
    while status in (301, 302, 307, 308) and loc and hops < 10:
        hops += 1
        nxt = local(loc)
        if nxt in seen or not nxt.startswith('/'):
            return first, hops, nxt, status, body, headers
        seen.add(nxt)
        cur = nxt.split('#')[0] or '/'
        status, loc, body, headers = get(cur)
        cur = nxt
    return first, hops, cur, status, body, headers


def meta(body):
    def one(pattern):
        m = re.search(pattern, body, re.I | re.S)
        return html.unescape(m.group(1)).strip() if m else ''
    h1s = [re.sub(r'<[^>]+>', ' ', h) for h in re.findall(r'<h1\b[^>]*>(.*?)</h1>', body, re.I | re.S)]
    return {
        'title': one(r'<title>(.*?)</title>'),
        'meta_description': one(r'<meta name="description" content="([^"]*)"'),
        'canonical': one(r'<link rel="canonical" href="([^"]*)"'),
        'robots': one(r'<meta name="robots" content="([^"]*)"'),
        'og_title': one(r'<meta property="og:title" content="([^"]*)"'),
        'og_description': one(r'<meta property="og:description" content="([^"]*)"'),
        'og_image': one(r'<meta property="og:image" content="([^"]*)"'),
        'h1': ' | '.join(re.sub(r'\s+', ' ', html.unescape(h)).strip() for h in h1s),
        'h1_count': len(h1s),
    }


def write_csv(name, rows, cols):
    with open(os.path.join(OUT, name), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore')
        w.writeheader()
        for r in rows:
            w.writerow({k: ('' if r.get(k) is None else r.get(k)) for k in cols})


# ------------------------------------------------------------------ 1. live inventory
crawl = json.load(open(CRAWL))
page_seo = json.load(open(os.path.join(OUT, 'page-seo.json')))
pages = {}
for f in os.listdir(os.path.join(ROOT, 'content', 'pages')):
    d = json.load(open(os.path.join(ROOT, 'content', 'pages', f)))
    if d.get('route'):
        pages[d['route']] = d
posts = {f"/{p['slug']}/": p for p in json.load(open(os.path.join(ROOT, 'content', 'posts.json')))}

# Full live wording recovered separately where the new site deliberately differs (so the
# inventory records what is live today, not the new value).
LIVE_FULL = {
    '/locations/': 'Private Hospital locations on the Sunshine Coast that our specialists work from. From Buderim, Maroochydore, Noosa, Nambour & Hervey Bay',
}
inventory = []
for r in crawl:
    path = r['url'][len(LIVE):] or '/'
    desc = r.get('meta_description') or ''
    truncated = 'truncated' in desc
    # Where the crawl tool cut a description short, use the full wording recovered for the migration.
    if truncated and path in LIVE_FULL:
        desc, truncated = LIVE_FULL[path], False
    if truncated:
        page = pages.get(path)
        full = (page_seo.get(page['slug'], {}) if page else {}).get('metaDescription') or (posts.get(path) or {}).get('metaDescription')
        if full:
            desc, truncated = full, False
    inventory.append({
        'url': r['url'], 'path': path, 'live_status': r['status'],
        'title': html.unescape(r.get('title') or ''), 'meta_description': html.unescape(desc),
        'description_complete': 'no (cut short by the crawl tool)' if truncated else 'yes',
        'canonical': r.get('canonical') or '', 'meta_robots': r.get('meta_robots') or '',
        'og_title': r.get('og_title') or '', 'og_description': html.unescape(r.get('og_description') or ''),
        'og_image': r.get('og_image') or '', 'h1': r.get('h1') or '', 'h2': ' | '.join(r.get('h2') or []),
        'pdfs': ' | '.join(r.get('pdfs') or []), 'forms': r.get('forms') or '', 'notes': r.get('notes') or '',
    })
json.dump(inventory, open(os.path.join(OUT, 'live-inventory.json'), 'w'), indent=1, ensure_ascii=False)
write_csv('live-inventory.csv', inventory, list(inventory[0].keys()))
print(f'live inventory: {len(inventory)} URLs')

# ------------------------------------------------------------------ 2. URL parity
redirects = {r['from']: r for r in json.load(open(os.path.join(OUT, 'redirects.json')))}
parity = []
for row in inventory:
    path = row['path']
    first, hops, final, status, body, _ = follow(path)
    noslash = path.rstrip('/') or '/'
    ns_first, ns_hops, ns_final, ns_status, _, _ = follow(noslash) if noslash != path else (None, 0, None, None, '', {})
    if first == 200:
        match, action = 'same URL', 'kept'
    elif path in redirects:
        match, action = 'redirected', f"301 to {redirects[path]['to']} ({redirects[path]['note']})"
    elif first in (301, 308):
        match, action = 'redirected', f'301 to {final} (WordPress pattern)'
    else:
        match, action = 'MISSING', 'needs a redirect'
    ok = (first == 200 or (first == 301 and hops == 1 and status == 200)) and (ns_first is None or (ns_first == 301 and ns_hops == 1 and ns_status == 200))
    parity.append({
        'old_url': row['url'], 'old_path': path, 'live_status': row['live_status'],
        'new_status': first, 'new_url': LIVE + final if final and final.startswith('/') else final,
        'hops': hops, 'final_status': status, 'match': match, 'action': action,
        'no_slash_status': ns_first if ns_first is not None else '', 'no_slash_hops': ns_hops if ns_first is not None else '',
        'result': 'PASS' if ok else 'CHECK',
    })
json.dump(parity, open(os.path.join(OUT, 'url-parity.json'), 'w'), indent=1)
write_csv('url-parity.csv', parity, list(parity[0].keys()))
print(f"url parity: {sum(p['match']=='same URL' for p in parity)} same, {sum(p['match']=='redirected' for p in parity)} redirected, "
      f"{sum(p['match']=='MISSING' for p in parity)} missing, {sum(p['result']!='PASS' for p in parity)} to check")

# ------------------------------------------------------------------ 3. WordPress patterns and host rules
patterns = [
    '/?p=123', '/?page_id=2', '/feed/', '/comments/feed/', '/blog/feed/', '/category/general/', '/tag/dental-implants/',
    '/author/admin/', '/blog/page/2/', '/page/2/', '/2024/06/teeth-in-a-day/', '/sitemap_index.xml', '/wp-sitemap.xml',
    '/page-sitemap.xml', '/post-sitemap.xml', '/wp-login.php', '/wp-admin/', '/services', '/about', '/blog',
    '/teeth-in-a-day', '/sitemap.xml', '/robots.txt', '/this-page-does-not-exist/',
]
wp = []
for p in patterns:
    first, hops, final, status, _, _ = follow(p)
    wp.append({'request': p, 'first_status': first, 'hops': hops, 'ends_at': final, 'final_status': status})
for host in ('www.sunshinecoastofis.com.au',):
    for p in ('/', '/services/dental-implants/'):
        status, loc, _, _ = get(p, host)
        wp.append({'request': f'{host}{p}', 'first_status': status, 'hops': 1 if loc else 0, 'ends_at': loc, 'final_status': ''})
write_csv('wordpress-patterns.csv', wp, list(wp[0].keys()))
print('wordpress patterns:', ', '.join(f"{w['request']} {w['first_status']}->{w['final_status']}" for w in wp))

# ------------------------------------------------------------------ 4. metadata diff
diff = []
for row, par in zip(inventory, parity):
    if par['match'] != 'same URL':
        continue
    _, _, _, _, body, headers = follow(row['path'])
    new = meta(body)
    item = {'path': row['path']}
    for k_live, k_new in (('title', 'title'), ('meta_description', 'meta_description'), ('canonical', 'canonical'), ('h1', 'h1')):
        live_v, new_v = row[k_live].strip(), new[k_new].strip()
        item[f'{k_live}_live'] = live_v
        item[f'{k_live}_new'] = new_v
        item[f'{k_live}_same'] = 'yes' if live_v == new_v else 'no'
    item['h1_count_new'] = new['h1_count']
    item['robots_new'] = new['robots']
    item['x_robots_tag'] = headers.get('X-Robots-Tag', '')
    item['og_image_new'] = new['og_image']
    diff.append(item)
json.dump(diff, open(os.path.join(OUT, 'metadata-diff.json'), 'w'), indent=1, ensure_ascii=False)
write_csv('metadata-diff.csv', diff, list(diff[0].keys()))
print('metadata diff: titles same', sum(d['title_same'] == 'yes' for d in diff), '/', len(diff),
      '; descriptions same', sum(d['meta_description_same'] == 'yes' for d in diff),
      '; canonicals same', sum(d['canonical_same'] == 'yes' for d in diff),
      '; one H1', sum(d['h1_count_new'] == 1 for d in diff))

# ------------------------------------------------------------------ 5. sitemap
_, _, sm, _ = get('/sitemap.xml')
locs = re.findall(r'<loc>(.*?)</loc>', sm)
rows = []
for loc in locs:
    path = loc[len(LIVE):] or '/'
    status, _, body, headers = get(path)
    m = meta(body)
    rows.append({'url': loc, 'status': status, 'canonical_self': 'yes' if m['canonical'] == loc else 'no',
                 'robots': m['robots'], 'x_robots_tag': headers.get('X-Robots-Tag', ''), 'h1_count': m['h1_count']})
write_csv('sitemap-check.csv', rows, list(rows[0].keys()))
print(f"sitemap: {len(rows)} URLs, {sum(r['status']==200 for r in rows)} answer 200, {sum(r['canonical_self']=='yes' for r in rows)} self-canonical")
