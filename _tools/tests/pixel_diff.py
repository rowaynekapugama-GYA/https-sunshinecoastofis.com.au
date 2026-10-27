#!/usr/bin/env python3
"""
Pixel diff: every approved page on the approved single-page site (served from
_tools/source/approved-index.html) against the same page on the new build, full page,
at 1280 and 390 wide. Animations off, scroll reveals shown, outside requests blocked on
both (video, maps, fonts), so only the site's own markup and styles are compared.

  python3 _tools/tests/pixel_diff.py <approved base url> <new base url> <out dir>
"""
import json
import os
import sys

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

APPROVED, NEW, OUT = sys.argv[1].rstrip('/'), sys.argv[2].rstrip('/'), sys.argv[3]
PAGES = [
    ('home', '', '/'), ('our-practice', 'our-practice', '/about/'), ('services', 'services', '/services/'),
    ('wisdom', 'services/wisdom-teeth-removal', '/services/wisdom-teeth-removal/'),
    ('implants', 'services/dental-implants', '/services/dental-implants/'),
    ('all-on-4', 'services/all-on-4-dental-implants', '/services/all-on-4-dental-implants/'),
    ('zygomatic', 'services/zygomatic-implants', '/services/zygomatic-implants/'),
    ('grafting', 'services/jaw-bone-grafting', '/services/jaw-bone-grafting/'),
    ('orthognathic', 'services/orthognathic-surgery', '/services/orthognathic-corrective-jaw-surgery/'),
    ('trauma', 'services/facial-trauma', '/services/facial-trauma/'),
    ('patient-info', 'patient-information', '/patient-information/'),
    ('locations', 'locations', '/locations/'), ('referral', 'doctor-referral', '/online-doctor-referral/'), ('contact', 'contact', '/contact-us/'),
]
CALM = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}html{scroll-behavior:auto!important}'
os.makedirs(OUT, exist_ok=True)


def shot(page, url, path):
    page.goto(url, wait_until='load')
    page.add_style_tag(content=CALM)
    page.evaluate("document.querySelectorAll('.rv,.rv-stagger').forEach(e=>e.classList.add('in'))")
    page.evaluate("document.querySelectorAll('img[loading=lazy]').forEach(i=>i.loading='eager')")
    # Scroll the whole page like a visitor would, so photos set to load on scroll start loading,
    # then wait until every photo has arrived and been decoded.
    page.evaluate("async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } }")
    page.evaluate("Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 8000); })).concat([...document.images].map(i => i.decode ? i.decode().catch(() => 0) : 0)))")
    page.wait_for_timeout(700)
    page.evaluate('window.scrollTo(0,0)')
    page.screenshot(path=path, full_page=True)


results = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for w, h in ((1280, 900), (390, 844)):
        for host in (APPROVED, NEW):
            pass
        ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1)
        page = ctx.new_page()
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(('http://localhost', 'http://127.0.0.1')) else r.abort())
        for name, hashp, route in PAGES:
            a = os.path.join(OUT, f'{name}-{w}-approved.png')
            n = os.path.join(OUT, f'{name}-{w}-new.png')
            shot(page, f'{APPROVED}/#/{hashp}', a)
            shot(page, f'{NEW}{route}', n)
            ia, ib = Image.open(a).convert('RGB'), Image.open(n).convert('RGB')
            same_size = ia.size == ib.size
            if not same_size:
                hgt = max(ia.height, ib.height)
                ca, cb = Image.new('RGB', (w, hgt), 'white'), Image.new('RGB', (w, hgt), 'white')
                ca.paste(ia, (0, 0)); cb.paste(ib, (0, 0)); ia, ib = ca, cb
            diff = ImageChops.difference(ia, ib)
            bbox = diff.getbbox()
            px = sum(1 for v in diff.convert('L').getdata() if v > 16)
            pct = 100 * px / (ia.width * ia.height)
            if bbox:
                diff.save(os.path.join(OUT, f'{name}-{w}-diff.png'))
            results.append({'page': route, 'width': w, 'approved_size': list(Image.open(a).size), 'new_size': list(Image.open(n).size), 'pixels_different_pct': round(pct, 4), 'diff_box': bbox})
            print(f'{route:52} {w:5} sizes {Image.open(a).size} vs {Image.open(n).size}  diff {pct:.4f}%  box {bbox}')
        ctx.close()
    b.close()
json.dump(results, open(os.path.join(OUT, 'pixel-diff.json'), 'w'), indent=1)
bad = [r for r in results if r['pixels_different_pct'] > 0]
print(f'{len(results)} comparisons, {len(bad)} with any difference')
