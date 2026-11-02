#!/usr/bin/env python3
"""
Content update, 2 Nov 2026: SEO and compliance fixes before go-live.

  python3 _tools/content-updates/2026-11-02-seo-compliance.py

Edits the files in content/ (the copy the site builds from). The same changes are applied
to the dashboard database by migrations/20261102_000001_seo_compliance_content.ts, which
is generated from the before/after difference by scripts/make-content-patch.ts.

Every edit checks the old wording first and refuses to run if it has changed, so nothing
the practice has edited is overwritten by accident. Running it twice is safe: edits
already made are skipped.

Australian English, no em dashes.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
C = os.path.join(ROOT, 'content')
LAST_UPDATED = '2 November 2026'
RISK = ('Any surgical or invasive procedure carries risks. Before proceeding, you should seek a second opinion '
        'from an appropriately qualified health practitioner.')
log = []


def load(rel):
    with open(os.path.join(C, rel), encoding='utf-8') as f:
        return json.load(f)


def save(rel, data):
    with open(os.path.join(C, rel), 'w', encoding='utf-8') as f:
        f.write(json.dumps(data, indent=2, ensure_ascii=False) + '\n')


def section(page, sid):
    for s in page['sections']:
        if s['id'] == sid:
            return s
    raise SystemExit(f"{page['slug']}: no section {sid}")


def field(slug, sid, key, old, new, prop='value'):
    page = load(f'pages/{slug}.json')
    f = section(page, sid)['fields'].setdefault(key, {})
    cur = f.get(prop)
    if cur == new:
        return
    if cur != old:
        raise SystemExit(f'{slug} {sid}.{key}.{prop} has changed; expected {old!r}, found {cur!r}')
    f[prop] = new
    save(f'pages/{slug}.json', page)
    log.append((slug, f'{sid}.{key}', old, new))


def page_seo(slug, key, old, new):
    page = load(f'pages/{slug}.json')
    cur = page['seo'].get(key)
    if cur == new:
        return
    if cur != old:
        raise SystemExit(f'{slug} seo.{key} has changed: {cur!r}')
    page['seo'][key] = new
    save(f'pages/{slug}.json', page)
    log.append((slug, f'seo.{key}', old, new))


def hide(slug, sid):
    page = load(f'pages/{slug}.json')
    s = section(page, sid)
    if not s.get('hidden'):
        s['hidden'] = True
        save(f'pages/{slug}.json', page)
        log.append((slug, f'{sid} hidden', 'shown', 'hidden'))


def add_section(slug, after_sid, sec):
    page = load(f'pages/{slug}.json')
    if any(s['id'] == sec['id'] for s in page['sections']):
        return
    idx = next(i for i, s in enumerate(page['sections']) if s['id'] == after_sid) + 1
    page['sections'].insert(idx, sec)
    save(f'pages/{slug}.json', page)
    log.append((slug, f"new section {sec['id']}", '', sec['template']))


def replace_sections(slug, keep_ids, new_sections):
    """Replace every section except keep_ids (the page heading) with new_sections."""
    page = load(f'pages/{slug}.json')
    if [s['id'] for s in page['sections']] == keep_ids + [s['id'] for s in new_sections] and page['sections'][len(keep_ids):] == new_sections:
        return
    page['sections'] = [s for s in page['sections'] if s['id'] in keep_ids] + new_sections
    save(f'pages/{slug}.json', page)
    log.append((slug, 'body sections', 'draft wording', 'final-form wording (client review needed)'))


def body(sid, groups, aside=None, label=''):
    """A 'content/body' section: up to 8 groups of heading, paragraphs and list items, plus the side panel."""
    fields = {}
    for g, grp in enumerate(groups):
        base = g * 13
        h, paras, items, after = grp.get('h', ''), grp.get('p', []), grp.get('li', []), grp.get('after', [])
        assert len(paras) <= 3 and len(items) <= 8 and len(after) <= 1, grp.get('h')
        fields[f'f{base + 1}'] = {'value': h}
        for i in range(3):
            fields[f'f{base + 2 + i}'] = {'value': paras[i] if i < len(paras) else ''}
        for i in range(8):
            fields[f'f{base + 5 + i}'] = {'value': items[i] if i < len(items) else ''}
        fields[f'f{base + 13}'] = {'value': after[0] if after else ''}
    for g in range(len(groups), 8):
        for i in range(13):
            fields[f'f{g * 13 + 1 + i}'] = {'value': ''}
    a = aside or {}
    fields['f105'] = {'value': a.get('h', '')}
    fields['f106'] = {'value': a.get('p', '')}
    fields['f107'] = {'value': a.get('call', '')}
    fields['f108'] = {'value': a.get('link', ''), 'href': a.get('href', '')}
    return {'id': sid, 'template': 'content/body', 'fields': fields}


# ---------------------------------------------------------------- templates (code, not dashboard content)
def templates():
    path = os.path.join(C, 'templates', 'sections.json')
    t = json.load(open(path, encoding='utf-8'))
    changed = False

    # A general text section built only from the approved prose and side panel styles. Empty headings,
    # paragraphs and list items are left out of the page (trim), so one design fits any length.
    if 'content/body' not in t:
        groups_html, fields = [], {}
        for g in range(8):
            b = g * 13
            lis = ''.join(f'<li>{{{{f{b + 5 + i}}}}}</li>' for i in range(8))
            groups_html.append(
                f'      <h2{" style=\"margin-top:0\"" if g == 0 else ""}>{{{{f{b + 1}}}}}</h2>\n'
                f'      <p>{{{{f{b + 2}}}}}</p>\n      <p>{{{{f{b + 3}}}}}</p>\n      <p>{{{{f{b + 4}}}}}</p>\n'
                f'      <ul>{lis}</ul>\n      <p>{{{{f{b + 13}}}}}</p>'
            )
            n = g + 1
            fields[f'f{b + 1}'] = {'type': 'text', 'label': f'Part {n}: heading'}
            for i in range(3):
                fields[f'f{b + 2 + i}'] = {'type': 'rich', 'label': f'Part {n}: paragraph {i + 1}'}
            for i in range(8):
                fields[f'f{b + 5 + i}'] = {'type': 'rich', 'label': f'Part {n}: list item {i + 1}'}
            fields[f'f{b + 13}'] = {'type': 'rich', 'label': f'Part {n}: closing paragraph'}
        fields['f105'] = {'type': 'text', 'label': 'Side panel: heading'}
        fields['f106'] = {'type': 'text', 'label': 'Side panel: text'}
        fields['f107'] = {'type': 'text', 'label': 'Side panel: call button wording'}
        fields['f108'] = {'type': 'link', 'label': 'Side panel: second button'}
        t['content/body'] = {
            'label': 'Text with headings, paragraphs and lists',
            'trim': True,
            'fields': fields,
            'html': (
                '<section class="block">\n  <div class="wrap two narrow-r">\n    <div class="prose">\n'
                + '\n'.join(groups_html)
                + '\n    </div>\n    <aside class="side">\n      <h3>{{f105}}</h3>\n'
                '      <p style="font-size:.95rem;color:var(--muted)">{{f106}}</p>\n'
                '      <a class="btn btn-primary" href="tel:{{phoneTel}}">{{f107}}</a>\n'
                '      <a class="btn btn-outline" href="{{f108.href}}">{{f108}}</a>\n    </aside>\n  </div>\n</section>'
            ),
        }
        changed = True

    # The surgical risk statement on procedure pages (AHPRA), in the approved muted paragraph style.
    if 'notice/risk' not in t:
        t['notice/risk'] = {
            'label': 'Risk statement',
            'fields': {'f1': {'type': 'rich', 'label': 'Statement'}},
            'html': '<section class="block" style="padding-top:0">\n  <div class="wrap">\n    <p style="color:var(--muted);font-size:.95rem;max-width:62rem">{{f1}}</p>\n  </div>\n</section>',
        }
        changed = True

    # Home banner: the five gold stars sat next to the Google rating, which is removed (AHPRA: no
    # reviews or ratings used as claims). The row's star icon stays; only the rating stars go.
    stars = ' <span class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>'
    if stars in t['home/1']['html']:
        t['home/1']['html'] = t['home/1']['html'].replace('{{f6}}' + stars, '{{f6}}')
        changed = True

    # Patient information form consent: clinical photos are no longer consented for "advertising" (AHPRA:
    # images in health advertising). Teaching and publication of de-identified images stay.
    pf = t['patient-information-form/2']['html']
    old_c = 'and use them in advertising, scientific papers or presentations.'
    if old_c in pf:
        t['patient-information-form/2']['html'] = pf.replace(old_c, 'and use them for teaching, scientific papers or presentations.')
        changed = True

    # Locations, "Serving patients across Queensland": the paragraph can now hold links (to the new town pages).
    if t['locations/4']['fields']['f2']['type'] != 'rich':
        t['locations/4']['fields']['f2']['type'] = 'rich'
        changed = True

    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(json.dumps(t, indent=1, ensure_ascii=False) + '\n')  # the file's own format
        log.append(('templates', 'content/body, notice/risk, home/1 stars, locations/4 f2', '', 'updated'))


# ---------------------------------------------------------------- 2. H1 location keywords
def h1s():
    field('wisdom-teeth-removal', 's1', 'f3', 'Wisdom teeth removed while you are completely asleep',
          'Wisdom teeth removal on the Sunshine Coast, completely asleep')
    field('dental-implants', 's1', 'f3', 'Dental implants placed by specialist surgeons',
          'Dental implants on the Sunshine Coast, placed by specialist surgeons')


# ---------------------------------------------------------------- 3. Hervey Bay and Gympie
SERVICES = [
    '<a href="/services/wisdom-teeth-removal/">Wisdom teeth removal</a>',
    '<a href="/services/dental-implants/">Dental implants</a>',
    '<a href="/services/all-on-4-dental-implants/">All-on-4 full arch implants</a>',
    '<a href="/services/zygomatic-implants/">Zygomatic implants</a>',
    '<a href="/services/jaw-bone-grafting/">Jaw bone grafting</a>',
    '<a href="/services/orthognathic-corrective-jaw-surgery/">Corrective jaw surgery</a>',
    '<a href="/services/facial-trauma/">Facial trauma</a>',
]
ASIDE = {
    'h': 'Book a consultation',
    'p': 'Our team will arrange your consultation in Buderim and, if you need surgery, your hospital booking.',
    'call': 'Call {{phone}}',
    'link': 'Make an enquiry',
    'href': '/contact-us/',
}


def location_pages():
    st = load('site-settings.json')
    hb = next(l for l in st['locations'] if l['area'] == 'Hervey Bay')
    rooms = next(l for l in st['locations'] if l.get('main'))

    hervey = {
        'slug': 'locations-hervey-bay',
        'route': '/locations/hervey-bay/',
        'pageId': 'locations--hervey-bay',
        'title': 'Hervey Bay',
        'kind': 'page',
        'seo': {
            'metaTitle': 'Oral & Maxillofacial Surgeon Hervey Bay | SCOFIS',
            'metaDescription': "Specialist oral and maxillofacial surgery for Hervey Bay, Maryborough and Fraser Coast patients at St Stephen's Private Hospital, Urraween.",
            'ogTitle': "Oral and maxillofacial surgeons in Hervey Bay | St Stephen's Private Hospital",
        },
        'sections': [
            {'id': 's1', 'template': 'locations/1', 'fields': {
                'f1': {'src': '/images/theatre.jpg', 'alt': 'Procedure room with monitoring equipment'},
                'f2': {'value': '<a href="/">Home</a> / <a href="/locations/">Locations</a>'},
                'f3': {'value': 'Oral and maxillofacial surgeons in Hervey Bay'},
                'f4': {'value': "Specialist surgery at St Stephen's Private Hospital in Urraween for patients from Hervey Bay, Maryborough and the Fraser Coast, without travelling to Brisbane."},
            }},
            body('s2', [
                {'h': "Surgery at St Stephen's Private Hospital",
                 'p': [
                     "Hervey Bay and Fraser Coast patients can have their surgery at St Stephen's Private Hospital in Urraween, so treatment under general anaesthetic happens close to home.",
                     f"<strong>{hb['name']}</strong><br>{hb['address']}<br><a href=\"{hb['mapLink'].replace('&', '&amp;')}\" target=\"_blank\" rel=\"noopener\">Get directions</a>",
                     'Surgery under general anaesthetic is performed with a specialist anaesthetist. [CONFIRM WITH CLIENT: which surgeon or surgeons operate at St Stephen\'s Private Hospital, Dr Trent Lincoln, Dr Andrew Higgins or both.]',
                 ]},
                {'h': 'Consultations and theatre days',
                 'p': [
                     f"Consultations are held at our Buderim rooms, {rooms['name']}, {rooms['address']}. A 3D CBCT scan is taken in our rooms on the day, so planning can begin straight away.",
                     '[CONFIRM WITH CLIENT: whether any consultations are held in Hervey Bay, and on which days; and the usual theatre days at St Stephen\'s Private Hospital.]',
                     'Call {{phone}} and our team will arrange your consultation and, if you need surgery, your booking at St Stephen\'s.',
                 ]},
                {'h': 'Treatment for Hervey Bay patients',
                 'p': ['Our surgeons provide the full scope of oral and maxillofacial surgery. [CONFIRM WITH CLIENT: which of these are performed at St Stephen\'s Private Hospital.]'],
                 'li': SERVICES},
                {'h': 'Referrals from Hervey Bay and Maryborough',
                 'p': [
                     'Dentists, orthodontists and doctors on the Fraser Coast can <a href="/online-doctor-referral/">refer online</a>. Our team contacts the patient directly to arrange their consultation.',
                     "You're welcome to see us without a referral. However, if you have a referral from your general dentist or GP, you may be eligible for a Medicare rebate on your consultation.",
                 ]},
                {'h': 'Our other locations',
                 'p': ['Patients can also be treated in our Buderim rooms or at private hospitals in Buderim, Maroochydore and Nambour. See <a href="/locations/">all our locations</a>.'],
                 'after': [RISK]},
            ], ASIDE),
        ],
    }

    gympie = {
        'slug': 'locations-gympie',
        'route': '/locations/gympie/',
        'pageId': 'locations--gympie',
        'title': 'Gympie',
        'kind': 'page',
        'seo': {
            'metaTitle': 'Oral & Maxillofacial Surgeon for Gympie Patients | SCOFIS',
            'metaDescription': 'Specialist oral and maxillofacial surgery for Gympie patients: consultations in Buderim and surgery at accredited private hospitals on the Sunshine Coast.',
            'ogTitle': 'Oral and maxillofacial surgeons for Gympie patients',
        },
        'sections': [
            {'id': 's1', 'template': 'locations/1', 'fields': {
                'f1': {'src': '/images/reception1.jpg', 'alt': 'Reception at our Buderim rooms'},
                'f2': {'value': '<a href="/">Home</a> / <a href="/locations/">Locations</a>'},
                'f3': {'value': 'Oral and maxillofacial surgeons for Gympie patients'},
                'f4': {'value': 'Patients travel to us from Gympie for wisdom teeth, dental implants, jaw surgery and facial trauma, with consultations in Buderim and surgery at accredited private hospitals on the Sunshine Coast.'},
            }},
            body('s2', [
                {'h': 'Where Gympie patients are seen',
                 'p': [
                     f"Consultations are held at our Buderim rooms in the {rooms['name']}, within the Buderim Private Hospital precinct, with on-site parking.",
                     f"<strong>{rooms['name']}</strong><br>{rooms['address']}<br><a href=\"{rooms['mapLink'].replace('&', '&amp;')}\" target=\"_blank\" rel=\"noopener\">Get directions</a>",
                     '[CONFIRM WITH CLIENT: whether there is any visiting consulting service for Gympie patients (the old website mentioned a visiting service at Noosa Private Hospital), and the usual travel time from Gympie to Buderim.]',
                 ]},
                {'h': 'Where surgery happens',
                 'p': [
                     'Selected patients can be treated in our Buderim rooms under local anaesthetic or IV sedation. Surgery under general anaesthetic, with a specialist anaesthetist, is performed at accredited private hospitals:',
                 ],
                 'li': ['Buderim Private Hospital, next door to our rooms', 'Sunshine Coast Day Surgery, Maroochydore', 'Maroochy Private Hospital, Maroochydore', 'Nambour Selangor Private Hospital, Nambour'],
                 'after': ['Your surgeon recommends the setting that suits your case and where you live.']},
                {'h': 'One trip for your consultation and scan',
                 'p': [
                     'A 3D CBCT scan is taken in our rooms at your consultation, so you do not need a separate trip for imaging and planning can begin straight away.',
                     'You receive a written treatment plan with itemised costs after your consultation, so you know the full figure before you decide anything.',
                 ]},
                {'h': 'Treatment for Gympie patients',
                 'p': ['Our surgeons provide the full scope of oral and maxillofacial surgery:'],
                 'li': SERVICES},
                {'h': 'Referrals from Gympie dentists and doctors',
                 'p': [
                     'Dentists, orthodontists and doctors in Gympie can <a href="/online-doctor-referral/">refer online</a>. Our team contacts the patient directly to arrange their consultation.',
                     "You're welcome to see us without a referral. However, if you have a referral from your general dentist or GP, you may be eligible for a Medicare rebate on your consultation.",
                     'See <a href="/locations/">all our locations</a>.',
                 ],
                 'after': [RISK]},
            ], ASIDE),
        ],
    }
    for p in (hervey, gympie):
        rel = f"pages/{p['slug']}.json"
        if not os.path.exists(os.path.join(C, rel)):
            save(rel, p)
            log.append((p['slug'], 'new page', '', p['route']))

    # Link both pages from Locations.
    field('locations', 's4', 'f2',
          'Because both surgeons are dual-qualified specialists operating in accredited hospitals, patients travel to us from well beyond the Sunshine Coast. We regularly treat patients from Gympie, Hervey Bay, Maryborough, Bundaberg, Caboolture and the Moreton Bay region, and accept referrals from dentists and doctors in Brisbane and regional Queensland for complex implant, grafting, jaw and trauma cases.',
          'Because both surgeons are dual-qualified specialists operating in accredited hospitals, patients travel to us from well beyond the Sunshine Coast. We regularly treat patients from <a href="/locations/gympie/">Gympie</a>, <a href="/locations/hervey-bay/">Hervey Bay</a>, Maryborough, Bundaberg, Caboolture and the Moreton Bay region, and accept referrals from dentists and doctors in Brisbane and regional Queensland for complex implant, grafting, jaw and trauma cases.')

    # Footer, "Referrers and locations": the Hervey Bay link opens the new Hervey Bay page.
    field('site-wide', 'footer', 'f26', '<a href="/locations/">Hervey Bay, St Stephen\'s Private</a>',
          '<a href="/locations/hervey-bay/">Hervey Bay, St Stephen\'s Private</a>')

    # The old Hervey Bay hospital page now goes straight to the new page (one 301).
    r = load('redirects.json')
    for x in r:
        if x['from'] == '/hervey-bay-st-stephens-private-hospital/' and x['to'] != '/locations/hervey-bay/':
            log.append(('redirects', x['from'], x['to'], '/locations/hervey-bay/'))
            x['to'] = '/locations/hervey-bay/'
    save('redirects.json', r)


# ---------------------------------------------------------------- 5. AHPRA wording
def ahpra_pages():
    # Ratings and reviews used as claims: the banner row becomes a plain fact, the review section is hidden.
    field('home', 's1', 'f6', '5.0 on Google', 'Specialist practice since 2018')
    field('home', 's1', 'f7', 'Rated by more than 300 patients across the Coast.',
          'Opened in 2018 at the Nucleus Medical Suites, Buderim.')
    hide('home', 's8')
    # Home and About carried the same description from the live site; Home gets its own (About keeps the live one).
    page_seo('home', 'metaDescription',
             'Sunshine Coast Oral, Facial & Implant Specialists (SCOFIS) was opened at the Nucleus Medical Suites at Buderim Private Hospital in 2018.',
             'Specialist oral and maxillofacial surgeons in Buderim, Sunshine Coast: wisdom teeth, dental implants, All-on-4, jaw surgery and facial trauma.')

    field('about', 's1', 'f4',
          ABOUT_INTRO_OLD,
          ABOUT_INTRO_OLD.replace('with a vision to provide exceptional care', 'with a vision to provide careful, patient-focused care'))
    field('all-on-4-dental-implants', 's2', 'f9', ALLON4_OLD, ALLON4_OLD.replace('trained further with leading surgeons from', 'trained further with surgeons in'))
    field('zygomatic-implants', 's2', 'f8', ZYGO_OLD, ZYGO_OLD.replace('has since trained with leading surgeons from', 'has since trained with surgeons in'))
    field('orthognathic-corrective-jaw-surgery', 's3', 'f10', ORTHO_OLD, ORTHO_OLD.replace('to perfect the bite', 'to fine-tune the bite'))
    page_seo('blog', 'metaDescription', BLOG_DESC_OLD,
             'General information about oral and maxillofacial surgery, wisdom teeth and dental implants from Sunshine Coast Oral, Facial & Implant Specialists in Buderim.')

    # Risk statement on every surgical procedure page, as the last section.
    for slug in ['wisdom-teeth-removal', 'dental-implants', 'all-on-4-dental-implants', 'zygomatic-implants',
                 'jaw-bone-grafting', 'orthognathic-corrective-jaw-surgery', 'facial-trauma']:
        page = load(f'pages/{slug}.json')
        last = page['sections'][-1]['id']
        add_section(slug, last, {'id': 'risk', 'template': 'notice/risk', 'fields': {'f1': {'value': RISK}}})


def ahpra_team():
    t = load('team.json')
    changed = False
    for s in t['surgeons']:
        if s['key'] in ('lincoln', 'trent'):
            new = s['lede'].replace('committed to expert care delivered in a compassionate, patient-focused way', 'committed to care delivered in a compassionate, patient-focused way')
            if new != s['lede']:
                log.append(('team: Dr Lincoln', 'lede', s['lede'], new)); s['lede'] = new; changed = True
            for i, para in enumerate(s['story']):
                new = para.replace('further training with world renowned surgeons from France, Brazil and Spain', 'further training with surgeons in France, Brazil and Spain')
                if new != para:
                    log.append(('team: Dr Lincoln', f'story {i + 1}', para, new)); s['story'][i] = new; changed = True
        if s['key'] in ('higgins', 'andrew'):
            for i, para in enumerate(s['story']):
                new = para.replace('in the world-renowned maxillofacial unit at the Royal Brisbane', 'in the maxillofacial unit at the Royal Brisbane')
                if new != para:
                    log.append(('team: Dr Higgins', f'story {i + 1}', para, new)); s['story'][i] = new; changed = True
    if changed:
        save('team.json', t)


POST_EDITS = {
    'teeth-in-a-day': [
        ('Imagine waking up and having a brand-new set of permanent teeth in just one day. This dream can now become a reality with the innovative dental procedure known as “teeth-in-a-day.” If you’re curious about how this process works and whether it’s right for you, keep reading.',
         'For suitable patients, a full arch of fixed temporary teeth can be fitted on the same day as implant surgery, a treatment often called “teeth in a day”. This article explains how it works, who it may suit and the factors that affect the result.'),
        ('is a cutting-edge dental procedure that allows patients to receive a full set of new teeth in a single day. Unlike traditional dental implant treatments that can take several months to complete, teeth in a day offers a quicker and more convenient solution for full mouth restorations.',
         'is a treatment in which a fixed temporary bridge is attached to the implants on the day of surgery. The final bridge is made and fitted once the implants have integrated with the bone, generally three to six months later.'),
        ('is surgically permanently implanted into the jaw bone', 'is surgically placed in the jaw bone'),
        ('However, with the teeth in a day procedure, everything is completed in just one appointment. This means that patients can leave the dental office with a beautiful new smile on the same day as their surgery.',
         'With teeth in a day, the implants and a fixed temporary bridge are placed in one surgical appointment, so suitable patients do not go without teeth while the implants heal. Follow-up visits are still needed, and the final bridge is fitted later.'),
        ('Thanks to advancements in dental technology, this process can often be completed with less trauma and discomfort compared to traditional implant surgeries. Generally, only four implants',
         'Generally, four implants'),
        ('<p>Photo Credit: Nobel Biocare</p>', ''),
        ('which allows the placement of a fixed set of teeth, that are indistinguishable from natural teeth.', 'which allows the placement of a fixed set of teeth.'),
        ('<p>All-on-4 Dental Implants Prosthesis</p>', ''),
        ('<h2>Benefits of Teeth in a Day</h2>', '<h2>Possible Benefits of Teeth in a Day</h2>'),
        ('<h3>1. Immediate Results</h3>', '<h3>1. Fixed Temporary Teeth From the Day of Surgery</h3>'),
        ('One of the most significant advantages of the same day teeth procedure is the immediate results it offers. Instead of waiting months for your final restoration, you can enjoy a brand-new smile with renewed function right away.',
         'For suitable patients, a fixed temporary bridge is attached on the day of surgery, so there is no period without teeth while waiting for the final bridge. A soft diet is needed while the implants heal.'),
        ('<h3>2. Reduced Healing Period</h3>', '<h3>2. Fewer Surgical Procedures</h3>'),
        ('Because teeth in a day eliminates the need for multiple surgeries and lengthy healing periods, patients can return to their normal activities much sooner. This means less time spent recovering and more time enjoying life with your new set of teeth.',
         'Because extractions and implant placement are often done in the same operation, and bone grafting can sometimes be avoided, some patients need fewer surgical procedures. Recovery varies from person to person, and your surgeon will explain what to expect in your case.'),
        ('<h3>3. Enhanced Confidence</h3>', '<h3>3. Function and Appearance</h3>'),
        ('Missing teeth can take a toll on your self-esteem and confidence. With teeth in a day, you can regain your smile and your confidence in just one day, allowing you to feel great about your appearance once again.',
         'Missing teeth can affect eating, speaking and how people feel about their smile. A fixed bridge may help with these, although individual results vary.'),
        ('Teeth in a day is an excellent option for individuals who are missing one or more teeth and are looking for a permanent solution for tooth replacement.',
         'Teeth in a day may be an option for people who are missing most or all of their teeth in one or both jaws, or whose remaining teeth cannot be saved. A consultation and 3D scan show whether it suits you.'),
        ('teeth in a day may be the perfect solution for you.', 'teeth in a day may be worth discussing with your surgeon.'),
        ('For busy individuals who don’t have time for multiple dental appointments, teeth in a day offers a convenient and time-saving alternative.',
         'Teeth in a day can mean fewer surgical appointments, although reviews and the final bridge still need several visits.'),
        ('<h2>Conclusion: A New Smile in Just One Day is Possible.</h2>', '<h2>Conclusion</h2>'),
        ('The teeth in a day technology has revolutionised the field of dentistry, offering a fast, convenient, and permanent solution for tooth replacement. Whether you’re missing one tooth or an entire arch, this innovative procedure can provide you with a brand-new smile in just one day. If you’re tired of dealing with missing teeth, pain or uncomfortable dentures, schedule a consultation with your dental practitioner to see if teeth in a day is right for you.',
         'Teeth in a day is one way to replace a full arch of teeth with fixed implant-supported teeth, with a temporary bridge fitted on the day of surgery for suitable patients. Whether it suits you depends on your bone, your general health and your goals. Talk to your dentist, or arrange a consultation with an oral and maxillofacial surgeon, to find out whether it is right for you.'),
        ('<h2>Why Chose Our Specialised Oral Surgeons?</h2>', '<h2>About Our Surgeons</h2>'),
        ('is an advanced oral surgery clinic. <a href="/about/">Dr Trent Lincoln and Dr Andrew Higgins</a> are highly experienced and highly qualified Oral and Maxillofacial surgeons, who are used to treat even the most difficult cases through referrals from general dentists. They are both:',
         'is a specialist oral and maxillofacial surgery practice in Buderim. <a href="/about/">Dr Trent Lincoln and Dr Andrew Higgins</a> are registered specialist oral and maxillofacial surgeons who see patients referred by general dentists and doctors as well as patients who contact us directly. They are both:'),
        ('<li>Specialists Fellow of the Royal Australian College of Dental Surgeons (RACDS)</li>',
         '<li>Fellows of the Royal Australasian College of Dental Surgeons in oral and maxillofacial surgery, FRACDS (OMS)</li>'),
        ('If you are in the Sunshine Coast area, you want to get your smile back, and are considering a full arch restoration, call our dental team today at 07 5406 0586 or email reception@sunshinecoastofis.com.au  to schedule an appointment and discuss your treatment plan. Remember: everything begins with a consultation and your life could change in a single visit!</p>',
         'If you are considering a full arch restoration, call our team on 07 5406 0586 or email reception@sunshinecoastofis.com.au to arrange a consultation and discuss your treatment options.</p>\n<p><em>' + RISK + '</em></p>'),
    ],
    'wisdom-teeth-removal-before-age-25': [
        ('however this procedure is often left too late and can cause serious complications. In this article, we explain what to pay attention to and why intervening early is important. Older adults may require longer procedure and/or face complications.',
         'and when a wisdom tooth does need to come out, removal is often simpler in younger adults. In this article, we explain what to look out for and why the timing can matter. Surgery in older adults can take longer and may carry a higher risk of complications.'),
        ('Wisdom teeth is the most common term behind third set of molars.', 'Wisdom teeth is the common name for the third set of molars.'),
        ('which is a fancy dental term to say that the tooth is partially or fully trapped', 'which means the tooth is partially or fully trapped'),
        ('other impacted wisdom teeth may cause sever issues', 'other impacted wisdom teeth may cause serious issues'),
        ('or cause by an infection.', 'or caused by an infection.'),
        ('rubbing against he inside of the cheek.', 'rubs against the inside of the cheek.'),
        ('causing bone damage to both teeth. Luckily this is not very common.', 'causing damage to both teeth. This is not very common.'),
        ('<strong>A food trap:</strong> when food becomes trapped when food becomes trapped between', '<strong>A food trap:</strong> when food becomes trapped between'),
        ('<h2>What is the Best Age to Remove Your Wisdom Teeth?</h2>', '<h2>When Should Wisdom Teeth Be Removed?</h2>'),
        ('Removing the wisdom teeth, particularly, if any pain has been noticed, should be done as early as possible. Having such problematic teeth removed between ages of 17 and 25 is recommended because the roots of the wisdom teeth have not formed totally, and the bone surrounding the tooth is softer making the extraction process easier.',
         'Not every wisdom tooth needs to be removed. When a wisdom tooth is causing problems, or is likely to, removal between the ages of 17 and 25 is often simpler, because the roots may not be fully formed and the surrounding bone is softer. Your surgeon will advise whether and when removal is recommended for you.'),
        ('<p>Delaying <a href="/services/wisdom-teeth-removal/">wisdom teeth removal</a> is often regretted when not occurred in the teenage years.</p>',
         '<p>If you have been advised that a wisdom tooth may need to come out, <a href="/services/wisdom-teeth-removal/">wisdom teeth removal</a> is usually easier to plan before problems develop.</p>'),
        ('<h2>Why Chose Our Specialised Oral Surgeons?</h2>', '<h2>About Our Surgeons</h2>'),
        ('is an advanced oral surgery clinic. Dr Trent Lincoln and Dr Andrew Higgins are highly experienced and highly qualified Oral and Maxillofacial surgeons, who are used to treat even the most difficult cases through referrals from general dentists. They are both:',
         'is a specialist oral and maxillofacial surgery practice in Buderim. Dr Trent Lincoln and Dr Andrew Higgins are registered specialist oral and maxillofacial surgeons who see patients referred by general dentists and doctors as well as patients who contact us directly. They are both:'),
        ('<li>Specialists Fellow of the <a href="https://racds.org/" target="_blank" rel="noopener">Royal Australian College of Dental Surgeons</a> (RACDS)</li>',
         '<li>Fellows of the <a href="https://racds.org/" target="_blank" rel="noopener">Royal Australasian College of Dental Surgeons</a> in oral and maxillofacial surgery, FRACDS (OMS)</li>'),
        ('If you are in the Sunshine Coast area, and are considering the removal of wisdom teeth, call our dental team today at 07 5406 0586 or email reception@sunshinecoastofis.com.au  to ask for an appointment and discuss the best course of action for your needs.</p>',
         'If you are considering wisdom teeth removal, call our team on 07 5406 0586 or email reception@sunshinecoastofis.com.au to arrange a consultation and discuss the options for your needs.</p>\n<p><em>' + RISK + '</em></p>'),
    ],
}


def ahpra_posts():
    posts = load('posts.json')
    changed = False
    for p in posts:
        for old, new in POST_EDITS.get(p['slug'], []):
            if new and new in p['body'] and old not in p['body']:
                continue
            if old not in p['body']:
                if not new:
                    continue  # a removal that was already made
                raise SystemExit(f"post {p['slug']}: wording not found: {old[:70]!r}")
            if p['body'].count(old) != 1:
                raise SystemExit(f"post {p['slug']}: wording found more than once: {old[:70]!r}")
            p['body'] = p['body'].replace(old, new)
            log.append((f"post: {p['slug']}", 'body', old, new))
            changed = True
    if changed:
        save('posts.json', posts)


# ---------------------------------------------------------------- 6. Privacy policy and disclaimer
def privacy_and_disclaimer():
    side = {'h': 'Questions about your privacy?', 'p': 'Our privacy officer can help with access to your records or any privacy question.',
            'call': 'Call {{phone}}', 'link': 'Make an enquiry', 'href': '/contact-us/'}
    part1 = body('s2', [
        {'h': 'About this policy',
         'p': [f'<em>Last updated: {LAST_UPDATED}</em>',
               'This policy explains how Sunshine Coast Oral, Facial &amp; Implant Specialists ([CONFIRM: legal entity name], ABN [CONFIRM: ABN]) collects, uses, discloses and protects your personal information, including your health information. We are bound by the <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles (APPs).',
               'In this policy, "we", "us" and "our" mean our practice, including our surgeons and staff. Our rooms are at Suite 5, Nucleus Medical Suites, 23 Elsa Wilson Drive, Buderim QLD 4556.']},
        {'h': 'What information we collect',
         'p': ['We collect only the information we need to provide your care and run our practice. This may include:'],
         'li': ['your name, date of birth, gender, address, phone numbers and email address',
                'your medical and dental history, medications, allergies and other health information',
                'referral letters, clinical notes, test results, photographs, x-rays, CBCT scans and other images',
                'your Medicare number, Department of Veterans\' Affairs number and private health insurance details',
                'the name and contact details of your referring practitioner, your general practitioner and your next of kin or emergency contact',
                'billing and payment information',
                'information you send us through our website forms, by email or by phone'],
         'after': ['You can ask to deal with us anonymously or using a pseudonym, but in most cases this is not practical for providing clinical care, issuing referrals or claiming Medicare or health fund benefits.']},
        {'h': 'How we collect it',
         'p': ['We collect most information directly from you, at your consultation, through our patient information form, by phone or email, or through our website.',
               'We also collect information from other people when this is needed for your care and you would reasonably expect it, for example from your referring dentist, doctor or specialist, hospitals, radiology and pathology providers, your health fund, or a parent, guardian or carer.']},
        {'h': 'Why we collect, use and disclose it',
         'p': ['We use and disclose your information to provide your care and for directly related purposes you would reasonably expect, including to:'],
         'li': ['assess, diagnose, plan and provide your treatment',
                'communicate with you about appointments, treatment and follow-up care',
                'report to and correspond with your referring practitioner, your general practitioner and other practitioners involved in your care',
                'arrange surgery with hospitals, day surgeries and anaesthetists',
                'request and receive imaging, pathology and other test results',
                'process Medicare, Department of Veterans\' Affairs and private health fund claims, and manage billing',
                'meet our legal, regulatory, professional and insurance obligations',
                'improve the quality and safety of our services, including through audits and accreditation'],
         'after': ['We disclose information for other purposes only with your consent, or where the law requires or allows it, for example to lessen a serious threat to someone\'s life, health or safety.']},
        {'h': 'Photographs and images',
         'p': ['Clinical photographs, x-rays and scans are part of your health record and are used for your care. With the consent you give on our patient information form, de-identified photographs and x-rays may also be used for teaching, scientific papers or presentations. We do not use your clinical images in advertising, and we will not use any image that could identify you without your separate written consent, which you can decline or withdraw at any time without it affecting your care.']},
        {'h': 'Direct marketing',
         'p': ['We do not sell or share your personal information for marketing. We may send you information about your own care, such as appointment reminders. If we ever send other information, you can opt out at any time.']},
        {'h': 'Storage and security',
         'p': ['We store your information in our practice management system [CONFIRM: name of practice management system and whether it is hosted in Australia] and in secure paper or electronic records. We take reasonable steps to protect it from misuse, interference, loss and unauthorised access, modification or disclosure, including staff confidentiality obligations, password and access controls, and secure storage and disposal.',
               'We keep health records for as long as the law requires [CONFIRM: retention period, for example at least 7 years after the last contact for adults, and until a patient who was a child turns 25], then destroy or de-identify them securely.']},
        {'h': 'Access and correction',
         'p': ['You can ask to see or receive a copy of the personal information we hold about you, and ask us to correct anything you believe is inaccurate, out of date, incomplete or misleading.',
               'Please make your request in writing to our privacy officer. We will respond within 30 days. We may charge a reasonable fee for providing copies, but not for making the request or correcting your information. If we refuse access or correction, we will tell you why in writing, as the law allows.']},
    ], side)
    part2 = body('s3', [
        {'h': 'Our website, analytics and cookies',
         'p': ['Our website is hosted by Vercel. When you send a form on our website (Contact us, Online doctor referral, Patient information form or Feedback), the details you enter are emailed to our practice team through SMTP2GO, an email delivery service. Contact details and messages are also kept in our website dashboard so our team can follow up your enquiry; the medical details from the patient information form are emailed only and are not kept in the dashboard.',
               'We may use Google Analytics and Google Tag Manager to understand how our website is used, for example which pages are visited and how people find us. These services use cookies and collect information such as your IP address, device, browser and pages viewed. We do not use them to identify you. You can block cookies in your browser settings or use the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener">Google Analytics opt-out add-on</a>.',
               'Some pages include content from other services, such as Google Maps, a Vimeo video and a Matterport virtual tour, which may set their own cookies under their own privacy policies.']},
        {'h': 'Overseas disclosure',
         'p': ['We do not send your health records overseas. Some of the services that support our website may store or process information outside Australia, including Google (website analytics) in the United States and other countries, and SMTP2GO (website form emails) [CONFIRM: the countries where SMTP2GO stores data for this account]. Our website hosting and dashboard database are located in Sydney, Australia.']},
        {'h': 'Data breaches',
         'p': ['If a data breach is likely to result in serious harm to you, we will notify you and the Office of the Australian Information Commissioner as required by the Notifiable Data Breaches scheme.']},
        {'h': 'Questions and complaints',
         'p': ['If you have a question or concern about how we handle your personal information, please contact our privacy officer first. We will acknowledge your complaint promptly and aim to resolve it within 30 days.',
               'If you are not satisfied with our response, you can contact the <a href="https://www.oaic.gov.au/" target="_blank" rel="noopener">Office of the Australian Information Commissioner</a> (OAIC) on 1300 363 992. For concerns about a health service in Queensland, you can also contact the <a href="https://www.oho.qld.gov.au/" target="_blank" rel="noopener">Office of the Health Ombudsman</a> on 133 646.']},
        {'h': 'Contact our privacy officer',
         'p': ['Privacy officer: [CONFIRM: privacy officer name]<br>Email: [CONFIRM: privacy officer email, for example reception@sunshinecoastofis.com.au]<br>Phone: {{phone}}<br>Post: Suite 5, Nucleus Medical Suites, 23 Elsa Wilson Drive, Buderim QLD 4556']},
        {'h': 'Changes to this policy',
         'p': ['We may update this policy from time to time. The current version is always on this page, with the date it was last updated at the top.']},
    ])
    replace_sections('privacy-policy', ['s1'], [part1, part2])
    field('privacy-policy', 's1', 'f4',
          'How Sunshine Coast Oral, Facial &amp; Implant Specialists collects, uses, stores and protects your personal and health information.',
          f'How Sunshine Coast Oral, Facial &amp; Implant Specialists collects, uses, stores and protects your personal and health information. Last updated: {LAST_UPDATED}.')

    dside = {'h': 'Have a question about your treatment?', 'p': 'A consultation with one of our surgeons is the right place to discuss your own situation.',
             'call': 'Call {{phone}}', 'link': 'Make an enquiry', 'href': '/contact-us/'}
    d = body('s2', [
        {'h': 'General information only',
         'p': [f'<em>Last updated: {LAST_UPDATED}</em>',
               'The information on this website is general in nature. It is not medical or dental advice and is not a substitute for a consultation with a qualified health practitioner who can assess your individual circumstances.',
               'Do not rely on this website to make decisions about your health or treatment. If you have questions about your health, please consult your doctor, dentist or one of our surgeons.']},
        {'h': 'Risks of treatment',
         'p': [RISK,
               'Every patient is different. The suitability, risks, recovery and outcome of any treatment depend on your individual circumstances and are discussed with you at your consultation. No outcome is guaranteed.']},
        {'h': 'Our surgeons',
         'p': ['Dr Trent Lincoln and Dr Andrew Higgins are registered with the Australian Health Practitioner Regulation Agency (AHPRA) as specialist oral and maxillofacial surgeons. You can check any practitioner\'s registration on the <a href="https://www.ahpra.gov.au/Registration/Registers-of-Practitioners.aspx" target="_blank" rel="noopener">AHPRA public register</a>.']},
        {'h': 'Fees',
         'p': ['Any fees, rebates or costs mentioned on this website are a general guide only. Your consultation and treatment fees, and any Medicare or health fund rebates you may be eligible for, are confirmed in writing after your consultation.']},
        {'h': 'Accuracy',
         'p': ['We take reasonable care to keep this website accurate and up to date, but information can change and we do not warrant that it is complete or current. To the extent permitted by law, we are not liable for any loss arising from reliance on information on this website.']},
        {'h': 'Links to other websites',
         'p': ['This website links to other websites and services, such as hospitals, professional organisations, Google Maps and Google reviews. We provide these links for convenience. We do not control and are not responsible for their content, accuracy or privacy practices, and a link does not mean we endorse them.']},
        {'h': 'Emergencies',
         'p': ['This website is not for emergencies. If you have a medical emergency, call 000 or go to your nearest emergency department. For urgent trauma or infection, please call our rooms on {{phone}} during opening hours.']},
        {'h': 'Copyright',
         'p': ['The content on this website, including text and photographs, belongs to Sunshine Coast Oral, Facial &amp; Implant Specialists or is used with permission. It may not be copied for commercial use without our written permission.']},
    ], dside)
    replace_sections('disclaimer', ['s1'], [d])
    field('disclaimer', 's1', 'f4', 'About the information on this website.',
          f'About the information on this website. Last updated: {LAST_UPDATED}.')


# Current approved wording, checked before each change.
ABOUT_INTRO_OLD = None
ALLON4_OLD = ZYGO_OLD = ORTHO_OLD = BLOG_DESC_OLD = None


def read_current():
    global ABOUT_INTRO_OLD, ALLON4_OLD, ZYGO_OLD, ORTHO_OLD, BLOG_DESC_OLD
    def cur(slug, sid, key, must_contain):
        v = section(load(f'pages/{slug}.json'), sid)['fields'][key]['value']
        if must_contain not in v and 'careful, patient-focused' not in v and 'surgeons in France' not in v and 'fine-tune the bite' not in v:
            raise SystemExit(f'{slug} {sid}.{key}: expected wording not found')
        return v
    ABOUT_INTRO_OLD = cur('about', 's1', 'f4', 'with a vision to provide exceptional care')
    ALLON4_OLD = cur('all-on-4-dental-implants', 's2', 'f9', 'leading surgeons from')
    ZYGO_OLD = cur('zygomatic-implants', 's2', 'f8', 'leading surgeons from')
    ORTHO_OLD = cur('orthognathic-corrective-jaw-surgery', 's3', 'f10', 'to perfect the bite')
    BLOG_DESC_OLD = load('pages/blog.json')['seo']['metaDescription']


if __name__ == '__main__':
    templates()
    read_current()
    h1s()
    location_pages()
    ahpra_pages()
    ahpra_team()
    ahpra_posts()
    privacy_and_disclaimer()
    print(f'{len(log)} changes')
    for x in log:
        print(' ', x[0], '|', x[1])
