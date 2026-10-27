#!/usr/bin/env python3
"""
Go-live page audit: every public page at every viewport.
  python3 _tools/tests/site_audit.py http://localhost:3000 audit
Writes audit/site-audit.json and full-page screenshots at 1280 and 390 to audit/screenshots/pages/.

Per page and viewport: HTTP status, console errors, failed same-site requests, broken
images, images without alt, horizontal scrolling, overlapping fixed elements, H1 count,
heading order, mobile body text size, tap targets under 44 x 44 px, zoom allowed.
Per page: every link checked (internal: 200 with no redirect; tel: and mailto: format).
Interaction: desktop menu by mouse and keyboard, mobile drawer and its Services list.
Outside addresses (video, maps, fonts, Google, social) are blocked in this sandbox, so
they are listed for a manual check rather than fetched.
"""
import json
import os
import re
import sys
from urllib.parse import urljoin, urlparse

from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip('/')
OUT = sys.argv[2]
SHOTS = os.path.join(OUT, 'screenshots', 'pages')
os.makedirs(SHOTS, exist_ok=True)

ROUTES = [
    '/', '/about/', '/services/', '/services/wisdom-teeth-removal/', '/services/dental-implants/', '/services/all-on-4-dental-implants/',
    '/services/zygomatic-implants/', '/services/jaw-bone-grafting/', '/services/orthognathic-corrective-jaw-surgery/', '/services/facial-trauma/',
    '/patient-information/', '/patient-information/patient-information-form/', '/locations/', '/online-doctor-referral/', '/contact-us/',
    '/feedback/', '/blog/', '/teeth-in-a-day/', '/wisdom-teeth-removal-before-age-25/', '/privacy-policy/', '/disclaimer/', '/this-page-does-not-exist/',
]
VIEWPORTS = [(320, 640), (360, 740), (375, 812), (390, 844), (414, 896), (768, 1024), (820, 1180), (1024, 768), (1280, 900), (1440, 900), (1920, 1080), (844, 390), (1024, 768, 'landscape-768')]

CHECK = r"""() => {
  const vw = document.documentElement.clientWidth;
  const r = {};
  r.scrollW = document.documentElement.scrollWidth; r.vw = vw;
  r.hscroll = r.scrollW > vw + 1;
  const vis = el => { const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const hidden = el => { for (let p = el; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none') return true; if (p.id === 'drawer' && !p.classList.contains('open')) return true; if (p.tagName === 'DETAILS' && !p.open && el !== p && !el.closest('summary')) return true; } return false; };
  r.h1 = [...document.querySelectorAll('h1')].map(h => h.textContent.trim());
  const hs = [...document.querySelectorAll('main h1, main h2, main h3, main h4')].filter(h => !hidden(h)).map(h => +h.tagName[1]);
  r.headingSkips = []; for (let i = 1; i < hs.length; i++) if (hs[i] > hs[i - 1] + 1) r.headingSkips.push(`h${hs[i - 1]}->h${hs[i]}`);
  r.imgs = [...document.images].length;
  r.brokenImgs = [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.src && i.src.startsWith(location.origin)).map(i => i.getAttribute('src'));
  r.noAlt = [...document.images].filter(i => !i.hasAttribute('alt')).map(i => i.getAttribute('src'));
  r.stretched = [...document.images].filter(i => { if (!vis(i) || !i.naturalWidth) return false; const b = i.getBoundingClientRect(); const fit = getComputedStyle(i).objectFit; if (fit === 'cover' || fit === 'contain') return false; const a = b.width / b.height, n = i.naturalWidth / i.naturalHeight; return Math.abs(a - n) / n > 0.06; }).map(i => i.getAttribute('src'));
  const body = parseFloat(getComputedStyle(document.body).fontSize); r.bodyFont = body;
  const ps = [...document.querySelectorAll('main p, main li')].filter(e => vis(e) && !hidden(e));
  r.smallText = ps.filter(e => parseFloat(getComputedStyle(e).fontSize) < 14).length;
  const vm = document.querySelector('meta[name=viewport]').content; r.zoomBlocked = /user-scalable\s*=\s*(0|no)|maximum-scale\s*=\s*1(\.0)?\b/.test(vm);
  const taps = [...document.querySelectorAll('a[href],button,summary,input:not([type=hidden]),select,textarea,label:has(> input[type=radio]),label:has(> input[type=checkbox])')].filter(e => vis(e) && !hidden(e));
  r.smallTaps = taps.filter(e => {
    if (e.matches('input[type=radio],input[type=checkbox]')) return false; // the visible label is the target
    if (e.closest('[aria-hidden=true]') || e.name === 'website') return false;
    const inline = e.tagName === 'A' && getComputedStyle(e).display === 'inline' && e.closest('p,li,small,span.crumb,.crumb,dd'); // links inside a sentence (WCAG 2.5.8 exception)
    if (inline) return false;
    const b = e.getBoundingClientRect(); return b.height < 44 || b.width < 44;
  }).map(e => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''} "${(e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
  // something fixed at the bottom covering the footer's last line?
  const bar = document.querySelector('.mcta'); r.mctaShown = !!bar && vis(bar);
  r.footerPadForBar = r.mctaShown ? parseFloat(getComputedStyle(document.body).paddingBottom) >= bar.getBoundingClientRect().height - 2 : true;
  r.links = [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href'));
  return r;
}"""


def main():
    report = {'pages': {}, 'links': {}, 'interaction': {}}
    all_links = set()
    with sync_playwright() as p:
        b = p.chromium.launch()
        for vp in VIEWPORTS:
            w, h = vp[0], vp[1]
            label = vp[2] if len(vp) > 2 else (f'{w}x{h}' if w > h else str(w))
            ctx = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 800 and w < h, has_touch=w < 1025)
            page = ctx.new_page()
            errors, failed = [], []
            page.on('console', lambda m: m.type == 'error' and errors.append(m.text[:200]))
            page.on('pageerror', lambda e: errors.append(str(e)[:200]))
            page.on('requestfailed', lambda r: r.url.startswith(BASE) and failed.append(r.url))
            page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
            for route in ROUTES:
                errors.clear(); failed.clear()
                resp = page.goto(BASE + route, wait_until='load')
                page.evaluate("document.querySelectorAll('.rv,.rv-stagger').forEach(e=>e.classList.add('in'))")
                page.evaluate("document.querySelectorAll('img[loading=lazy]').forEach(i=>i.loading='eager')")
                # Scroll through like a visitor so photos set to load on scroll arrive, then wait for them.
                page.evaluate("async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); } window.scrollTo(0, 0); }")
                page.evaluate("Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 6000); })))")
                page.wait_for_timeout(300)
                r = page.evaluate(CHECK)
                r['status'] = resp.status
                r['consoleErrors'] = [e for e in errors if 'net::ERR_FAILED' not in e and 'ERR_BLOCKED' not in e and 'Failed to load resource' not in e]
                r['failedRequests'] = list(failed)
                all_links.update((route, l) for l in r.pop('links'))
                report['pages'].setdefault(route, {})[label] = r
                if w in (1280, 390) and label in ('1280x900', '390'):
                    name = (route.strip('/').replace('/', '__') or 'home')
                    page.evaluate('window.scrollTo(0,0)')
                    page.screenshot(path=os.path.join(SHOTS, f'{name}-{w}.png'), full_page=True)
            ctx.close()

        # ---- links
        ctx = b.new_context()
        req = ctx.request
        checked = {}
        for src, href in sorted(all_links):
            if href.startswith('tel:'):
                checked[href] = 'ok' if href == 'tel:0754060586' else 'WRONG NUMBER'
                continue
            if href.startswith('mailto:'):
                checked[href] = 'ok' if re.match(r'^mailto:[^@\s]+@[^@\s]+$', href) else 'bad'
                continue
            if href.startswith('#'):
                continue
            u = urljoin(BASE + src, href)
            if not u.startswith(BASE):
                checked.setdefault(u.split('#')[0], 'external (not fetched from the sandbox)')
                continue
            key = u.split('#')[0]
            if key in checked:
                continue
            resp = req.get(key, max_redirects=0)
            checked[key] = resp.status if resp.status == 200 else f'{resp.status} -> {resp.headers.get("location")}'
        report['links'] = checked

        # ---- interaction
        it = {}
        page = b.new_page(viewport={'width': 1280, 'height': 900})
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        page.goto(BASE + '/')
        page.locator('nav.menu .dd-mega > summary').click()
        it['desktop_services_menu_opens_on_click'] = page.locator('nav.menu .dd-mega').evaluate('d=>d.open')
        page.keyboard.press('Escape')
        it['escape_closes_menu'] = not page.locator('nav.menu .dd-mega').evaluate('d=>d.open')
        page.locator('a.logo').focus()
        for _ in range(3):
            page.keyboard.press('Tab')
        focused = page.evaluate('document.activeElement.tagName+" "+(document.activeElement.textContent||"").trim().slice(0,20)')
        it['keyboard_tab_reaches_menu'] = focused
        page.keyboard.press('Enter')
        it['enter_opens_dropdown_from_keyboard'] = page.evaluate("[...document.querySelectorAll('nav.menu .dd')].some(d=>d.open)")
        outline = page.evaluate('getComputedStyle(document.activeElement).outlineStyle+" "+getComputedStyle(document.activeElement).outlineWidth')
        it['focus_outline_on_menu_item'] = outline
        page.close()
        page = b.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        page.goto(BASE + '/locations/')
        page.click('#burger')
        it['mobile_drawer_opens'] = page.locator('#drawer').evaluate("d=>d.classList.contains('open')")
        page.locator('#drawer details summary').click()
        it['mobile_services_list_opens'] = page.locator('#drawer details').evaluate('d=>d.open')
        links = page.locator('#drawer details a')
        it['mobile_services_links_visible'] = sum(1 for i in range(links.count()) if links.nth(i).is_visible())
        it['drawer_scrolls_if_long'] = page.locator('#drawer').evaluate("d=>getComputedStyle(d).overflowY")
        page.click('#drawerClose')
        it['mobile_drawer_closes'] = not page.locator('#drawer').evaluate("d=>d.classList.contains('open')")
        page.locator('.loc-list .loc').nth(2).click()
        it['location_switcher_updates_map'] = page.locator('#ld-name').inner_text()
        page.close()
        report['interaction'] = it
        b.close()

    # ---- summary
    summary = []
    for route, vps in report['pages'].items():
        for label, r in vps.items():
            issues = []
            expected = 404 if 'does-not-exist' in route else 200
            if r['status'] != expected: issues.append(f'status {r["status"]}')
            if r['hscroll']: issues.append(f'horizontal scroll {r["scrollW"]}>{r["vw"]}')
            if len(r['h1']) != 1: issues.append(f'{len(r["h1"])} H1')
            if r['brokenImgs']: issues.append(f'broken images {r["brokenImgs"]}')
            if r['noAlt']: issues.append(f'images without alt {r["noAlt"]}')
            if r['consoleErrors']: issues.append(f'console {r["consoleErrors"][:2]}')
            if r['failedRequests']: issues.append(f'failed {r["failedRequests"][:2]}')
            if r['zoomBlocked']: issues.append('zoom blocked')
            if r['stretched']: issues.append(f'stretched {r["stretched"]}')
            if not r['footerPadForBar']: issues.append('call bar covers footer')
            summary.append({'page': route, 'viewport': label, 'pass': not issues, 'issues': issues, 'smallTaps': r['smallTaps'], 'headingSkips': r['headingSkips'], 'bodyFont': r['bodyFont']})
    report['summary'] = summary
    json.dump(report, open(os.path.join(OUT, 'site-audit.json'), 'w'), indent=1)
    fails = [s for s in summary if not s['pass']]
    print(f'{len(summary)} page x viewport checks, {len(fails)} with issues')
    for s in fails[:40]:
        print(' ', s['page'], s['viewport'], s['issues'])
    bad_links = {k: v for k, v in report['links'].items() if v not in (200, 'ok') and not str(v).startswith('external')}
    print('links checked:', len(report['links']), 'problems:', bad_links)
    print('interaction:', report['interaction'])
    taps = {}
    for s in summary:
        for t in s['smallTaps']:
            if s['viewport'] in ('390', '375', '320'):
                taps[t.rsplit(' ', 1)[0]] = t
    print('small tap targets on phones:', len(taps))
    for t in list(taps.values())[:40]:
        print('   ', t)
    skips = {(s['page'], tuple(s['headingSkips'])) for s in summary if s['headingSkips']}
    print('heading order skips:', sorted(skips)[:20])


main()
