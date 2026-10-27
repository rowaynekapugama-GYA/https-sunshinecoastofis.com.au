#!/usr/bin/env python3
"""
Browser drive of every dashboard function against a local build with a database.
  python3 _tools/tests/dashboard_e2e.py http://localhost:3000 <screenshot dir>
Needs the two test logins from scripts/create-user.ts. Prints PASS/FAIL per step.
"""
import json
import os
import re
import sys
import time

from PIL import Image
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1].rstrip('/')
SHOTS = sys.argv[2]
os.makedirs(SHOTS, exist_ok=True)
# Local test accounts only (create them with scripts/create-user.ts on a local database).
# Never point this test at the live dashboard.
ADMIN = (os.environ.get('E2E_ADMIN_EMAIL', 'admin@example.com'), os.environ['E2E_ADMIN_PASSWORD'])
EDITOR = (os.environ.get('E2E_EDITOR_EMAIL', 'editor@example.com'), os.environ['E2E_EDITOR_PASSWORD'])
results = []


def step(name, fn):
    try:
        fn()
        results.append((name, 'PASS', ''))
        print('PASS', name)
    except Exception as e:  # noqa: BLE001
        results.append((name, 'FAIL', str(e)[:300]))
        print('FAIL', name, str(e)[:300])


def login(page, who):
    page.goto(f'{BASE}/admin/login')
    page.fill('#email', who[0])
    page.fill('#password', who[1])
    page.click('button[type=submit]')
    page.wait_for_url(re.compile(r'/admin/?$'), timeout=20000)


def toast(page, text):
    expect(page.locator('body')).to_contain_text(text, timeout=15000)


def open_page(page, title, sections=True):
    """Open a page in the visual editor; wait for the editable page to load in the canvas."""
    page.goto(f'{BASE}/admin/pages')
    page.get_by_role('link', name=title, exact=True).first.click()
    page.wait_for_selector('.v-editor', timeout=20000)
    canvas().locator('[data-edit]').first.wait_for(timeout=30000)
    expect(page.locator('.v-updating')).to_have_count(0, timeout=20000)
    if sections:
        page.locator('.v-tabs').get_by_role('button', name='Sections').click()
        page.wait_for_selector('.d-section', timeout=20000)


def canvas():
    return page.frame_locator('iframe[name=scofis-canvas]')


def canvas_frame():
    return page.frame(name='scofis-canvas')


img = os.path.join(SHOTS, 'test-photo.png')
Image.new('RGB', (1600, 1000), (29, 178, 222)).save(img)
img2 = os.path.join(SHOTS, 'test-photo-2.png')
Image.new('RGB', (1600, 1000), (24, 38, 80)).save(img2)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1440, 'height': 950})
    page = ctx.new_page()

    step('Sign in as admin (GYA)', lambda: login(page, ADMIN))

    def dashboard_home():
        expect(page.locator('.d-sidebar')).to_contain_text('Pages')
        names = [t.strip() for t in page.locator('.d-nav a').all_inner_texts()]
        assert names == ['Dashboard', 'Pages', 'Blog Posts', 'Media Library', 'Team', 'Enquiries', 'SEO', 'Site Settings', 'Redirects', 'Users'], names
        expect(page.get_by_role('button', name='Publish website')).to_be_visible()
        page.screenshot(path=f'{SHOTS}/dashboard-home.png')
    step('Dashboard home: sidebar order, publish button', dashboard_home)

    def import_content():
        page.get_by_role('button', name='Import missing content').click()
        toast(page, 'Imported')
    step('Import missing content (loads the 2 migrated blog articles)', import_content)

    def edit_page():
        open_page(page, 'Disclaimer', sections=False)
        page.screenshot(path=f'{SHOTS}/dashboard-page-editor.png')
        h1 = canvas().locator('h1[data-edit]')
        h1.click()
        page.keyboard.press('Control+A')
        page.keyboard.type('Website disclaimer')
        expect(page.locator('.v-state')).to_contain_text('Unsaved changes')
        page.get_by_role('button', name='Save changes').click()
        toast(page, 'Saved')
        r = page.request.get(f'{BASE}/api/pages?where[slug][equals]=disclaimer&depth=0').json()['docs'][0]
        assert 'Website disclaimer' in json.dumps(r['sections'][0]['fields']), r['sections'][0]['fields']
    step('Visual editor: click the heading on the page, type, save', edit_page)

    def reorder_sections():
        open_page(page, 'Home')
        before = page.locator('.d-section .label').all_inner_texts()
        handle = page.locator('.d-section').nth(2).locator('.d-handle')
        handle.focus()
        page.keyboard.press('Space'); page.wait_for_timeout(250)
        page.keyboard.press('ArrowDown'); page.wait_for_timeout(250)
        page.keyboard.press('Space')
        page.wait_for_timeout(400)
        after = page.locator('.d-section .label').all_inner_texts()
        assert before[2].split('\n')[0] == after[3].split('\n')[0], (before[:5], after[:5])
        page.get_by_role('button', name='Save changes').click()
        toast(page, 'Saved')
        # put it back, so the home page matches the approved order again
        handle = page.locator('.d-section').nth(3).locator('.d-handle')
        handle.focus()
        page.keyboard.press('Space'); page.wait_for_timeout(250)
        page.keyboard.press('ArrowUp'); page.wait_for_timeout(250)
        page.keyboard.press('Space')
        page.wait_for_timeout(400)
        page.get_by_role('button', name='Save changes').click()
        toast(page, 'Saved')
    step('Reorder sections by drag handle (keyboard) and save', reorder_sections)

    def hide_section():
        open_page(page, 'Feedback')
        page.locator('.d-section').nth(1).get_by_role('switch').click()
        expect(page.locator('.d-section').nth(1)).to_contain_text('Hidden')
        page.get_by_role('button', name='Save changes').click()
        toast(page, 'Saved')
        page.locator('.d-section').nth(1).get_by_role('switch').click()
        page.get_by_role('button', name='Save changes').click()
        toast(page, 'Saved')
    step('Hide and show a section', hide_section)

    def preview():
        open_page(page, 'Disclaimer')
        with ctx.expect_page() as pi:
            page.get_by_role('button', name='Preview').click()
        pv = pi.value
        pv.wait_for_load_state()
        expect(pv.locator('h1')).to_have_text('Website disclaimer')
        expect(pv.locator('body')).to_contain_text('Preview only')
        pv.screenshot(path=f'{SHOTS}/dashboard-preview.png')
        pv.close()
    step('Preview shows unsaved and saved changes in a new tab', preview)

    def seo_fields():
        open_page(page, 'Disclaimer')
        page.get_by_role('button', name='SEO', exact=True).click()
        page.get_by_label('Meta title').fill('Disclaimer | SCOFIS Buderim')
        expect(page.locator('.d-snippet')).to_contain_text('Disclaimer | SCOFIS Buderim')
        page.screenshot(path=f'{SHOTS}/dashboard-seo.png')
        page.get_by_role('button', name='Save changes').click()
        toast(page, 'Saved')
    step('SEO fields with Google preview, saved', seo_fields)

    def media_upload():
        page.goto(f'{BASE}/admin/media')
        page.get_by_role('button', name='+ Upload photos').click()
        page.set_input_files('input[type=file]', img)
        page.get_by_role('button', name='Upload photos', exact=True).click()
        toast(page, 'uploaded')
        expect(page.locator('.d-media-item').first).to_be_visible(timeout=15000)
        page.screenshot(path=f'{SHOTS}/dashboard-media.png')
    step('Media Library: upload a photo with alt text', media_upload)

    def media_replace():
        page.goto(f'{BASE}/admin/media')
        page.locator('.d-media-item').first.click()
        page.set_input_files('input[type=file]', img2)
        toast(page, 'Photo replaced everywhere')
    step('Media Library: replace a photo everywhere', media_replace)

    def choose_photo_on_page():
        open_page(page, 'Wisdom teeth removal', sections=False)
        img_el = canvas().locator('img[data-edit-img]').first
        before = img_el.get_attribute('src')
        img_el.click(force=True)  # at its position, like a person: overlays sit on top of some photos
        page.locator('.d-media-item').first.click()
        expect(img_el).not_to_have_attribute('src', before or '', timeout=10000)
        expect(page.locator('.v-state')).to_contain_text('Unsaved changes')
        page.screenshot(path=f'{SHOTS}/dashboard-visual-photo.png')
        page.get_by_role('button', name='Save changes').click()
        toast(page, 'Saved')
    step('Visual editor: click a photo on the page, choose from the library, save', choose_photo_on_page)

    def change_link_on_page():
        open_page(page, 'Wisdom teeth removal', sections=False)
        a = canvas().locator('a[data-edit-href]').first
        a.click()
        chip = canvas().locator('.scofis-chip')
        expect(chip).to_be_visible()
        chip.get_by_role('button', name='Change link').click()
        box = page.locator('.d-modal input[list]').first
        box.fill('/locations/')
        page.locator('.d-modal').get_by_role('button', name='Done').click()
        expect(page.locator('.v-updating')).to_have_count(0, timeout=20000)
        canvas().locator('a[data-edit-href][href="/locations/"]').first.wait_for(timeout=20000)
        page.get_by_role('button', name='Save changes').click()
        toast(page, 'Saved')
    step('Visual editor: click a button, Change link, save', change_link_on_page)

    def phone_placeholder_kept():
        open_page(page, 'Wisdom teeth removal', sections=False)
        el = canvas().locator('[data-edit]', has_text='(07) 5406 0586').first
        el.click()
        page.keyboard.press('End')
        page.keyboard.type(' Thanks.')
        page.wait_for_timeout(300)
        page.get_by_role('button', name='Save changes').click()
        toast(page, 'Saved')
        r = page.request.get(f'{BASE}/api/pages?where[slug][equals]=wisdom-teeth-removal&depth=0').json()['docs'][0]
        dump = json.dumps(r['sections'])
        assert '{{phone}} Thanks.' in dump or ('{{phone}}' in dump and 'Thanks.' in dump), 'phone placeholder lost'
        assert '(07) 5406 0586 Thanks.' not in dump, 'phone number was saved as fixed text'
    step('Visual editor: editing wording next to the phone number keeps it linked to Site Settings', phone_placeholder_kept)

    def mobile_view():
        open_page(page, 'Home', sections=False)
        page.get_by_role('button', name='Mobile').click()
        expect(page.locator('iframe[name=scofis-canvas]')).to_have_attribute('style', re.compile('width: 390px'))
        page.wait_for_timeout(800)
        page.screenshot(path=f'{SHOTS}/dashboard-visual-mobile.png')
        page.get_by_role('button', name='Desktop').click()
    step('Visual editor: desktop and mobile views', mobile_view)

    def header_footer():
        open_page(page, 'Header, menu and footer', sections=False)
        f = canvas_frame()
        assert f.locator('main [data-edit]').count() == 0, 'home page body should not be editable here'
        assert f.locator('header [data-edit], footer [data-edit]').count() > 5
        page.screenshot(path=f'{SHOTS}/dashboard-visual-header.png')
    step('Visual editor: header and footer edited on their own screen', header_footer)

    def team():
        page.goto(f'{BASE}/admin/team')
        expect(page.locator('body')).to_contain_text('Dr Trent Lincoln')
        page.screenshot(path=f'{SHOTS}/dashboard-team.png')
        row = page.locator('strong', has_text=re.compile('^Taylor$')).locator('xpath=ancestor::div[.//button][1]')
        row.get_by_role('button', name='Edit').click()
        page.get_by_role('button', name='Choose from library / Upload').click()
        page.locator('.d-media-item').first.click()
        page.get_by_label('Role').fill('Surgical Assistant')
        page.get_by_role('button', name='Save', exact=True).click()
        toast(page, 'Saved')
        surg = page.locator('strong', has_text=re.compile('^Dr Andrew Higgins$')).locator('xpath=ancestor::div[.//button][1]')
        surg.get_by_role('button', name='Edit').click()
        expect(page.get_by_label('Role and qualifications line')).to_have_value(re.compile('FRACDS'))
        page.get_by_role('button', name='Cancel').click()
    step('Team: give Taylor a library photo, open a surgeon bio', team)

    def team_hide():
        page.goto(f'{BASE}/admin/team')
        row = page.locator('strong', has_text=re.compile('^Megan$')).locator('xpath=ancestor::div[.//button][1]')
        row.get_by_role('button', name='Hide').click()
        toast(page, 'hidden from the website')
        row.get_by_role('button', name='Show').click()
        toast(page, 'shown on the website')
    step('Team: hide and show a team member', team_hide)

    def settings():
        page.goto(f'{BASE}/admin/settings')
        page.screenshot(path=f'{SHOTS}/dashboard-settings.png')
        page.get_by_role('button', name='Locations', exact=True).click()
        note = page.get_by_label('Short note').nth(1)
        note.fill('Next door to our rooms. Test note from the dashboard.')
        page.get_by_role('button', name='Tracking and links').click()
        page.get_by_label('Google Analytics 4 measurement ID').fill('G-TEST12345')
        page.get_by_role('button', name='Save settings').click()
        toast(page, 'Settings saved')
    step('Site Settings: change a hospital note and the GA4 ID', settings)

    def blog_post():
        page.goto(f'{BASE}/admin/posts')
        expect(page.locator('body')).to_contain_text('Teeth in a Day')
        page.goto(f'{BASE}/admin/posts/new')
        expect(page.locator('body')).to_contain_text('AHPRA')
        page.get_by_label('Title').fill('Test article from the dashboard')
        page.get_by_label('Summary').fill('A short test article written in the dashboard.')
        ed = page.locator('.ProseMirror').first
        ed.click()
        page.keyboard.type('This article was written in the dashboard during go-live testing.')
        page.screenshot(path=f'{SHOTS}/dashboard-blog-editor.png')
        page.get_by_role('button', name='Publish article').click()
        toast(page, 'Article published')
    step('Blog: write and publish an article (AHPRA reminder shown)', blog_post)

    def redirect():
        page.goto(f'{BASE}/admin/redirects')
        expect(page.locator('body')).to_contain_text('/noosa-private-hospital/')
        page.get_by_label('From (old path on this site)').fill('/test-old-page/')
        page.get_by_label('To').fill('/contact-us/')
        page.get_by_role('button', name=re.compile('Add', re.I)).last.click()
        toast(page, '/test-old-page/')
    step('Redirects: see the migrated list, add one', redirect)

    def publish():
        page.goto(f'{BASE}/admin')
        page.get_by_role('button', name='Publish website').click()
        toast(page, 'Publishing started')
    step('Publish website calls the deploy hook', publish)

    b.close()

# ---- public forms -> Enquiries
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={'width': 1280, 'height': 900})

    def fill_contact():
        page.goto(f'{BASE}/contact-us/')
        f = page.locator('#contactForm')
        f.locator('[name=first]').fill('Test'); f.locator('[name=last]').fill('Contact')
        f.locator('[name=phone]').fill('0400000000'); f.locator('[name=email]').fill('test.contact@example.com')
        f.locator('input[name=topic][value="Wisdom teeth"] + span').click()
        f.locator('[name=message]').fill('Go-live test enquiry')
        page.wait_for_timeout(2700)
        f.locator('button[type=submit]').click()
        expect(f).to_have_class(re.compile('sent'), timeout=20000)
    step('Contact us form sends and confirms', fill_contact)

    def fill_referral():
        page.goto(f'{BASE}/online-doctor-referral/')
        f = page.locator('#referralForm')
        for k, v in {'patient_first_name': 'Testpatient', 'patient_last_name': 'Referral', 'patient_dob': '1990-01-01', 'patient_contact': '0400000001', 'reason_for_referral': 'Go-live test referral', 'implant_brand_preference': 'None', 'medical_history': 'Nil', 'doctor_first_name': 'Test', 'doctor_last_name': 'Dentist', 'practice_contact_number': '0754000000', 'practice_address': '1 Test St, Buderim', 'doctor_email': 'dentist@example.com'}.items():
            f.locator(f'[name={k}]').fill(v)
        f.locator('input[name=not_a_robot] + span').click()
        f.locator('input[type=file]').set_input_files(img)
        page.wait_for_timeout(2700)
        f.locator('button[type=submit]').click()
        expect(f).to_have_class(re.compile('sent'), timeout=20000)
    step('Online doctor referral form (with attachment) sends and confirms', fill_referral)

    def fill_patient():
        page.goto(f'{BASE}/patient-information/patient-information-form/')
        f = page.locator('#patientForm')
        f.locator('[name=patient_name]').fill('Test Patientform'); f.locator('[name=dob]').fill('1985-05-05')
        f.locator('input[name=sex][value=Female] + span').click()
        f.locator('[name=email]').fill('patientform@example.com'); f.locator('[name=phone_mobile]').fill('0400000002')
        f.locator('[name=medications]').fill('Test medication')
        for s in ('fee_policy', 'consent', 'ai'):
            f.locator(f'input[name={s}_agreed] + span').click()
            f.locator(f'[name={s}_name]').fill('Test Patientform')
            f.locator(f'[name={s}_date]').fill('2026-10-27')
        page.wait_for_timeout(2700)
        f.locator('button[type=submit]').click()
        expect(f).to_have_class(re.compile('sent'), timeout=20000)
    step('Patient information form sends and confirms', fill_patient)

    def fill_feedback():
        page.goto(f'{BASE}/feedback/')
        f = page.locator('#feedbackForm')
        f.locator('[name=name]').fill('Test Feedback'); f.locator('[name=email]').fill('feedback@example.com')
        f.locator('[name=message]').fill('Go-live test feedback')
        page.wait_for_timeout(2700)
        f.locator('button[type=submit]').click()
        expect(f).to_have_class(re.compile('sent'), timeout=20000)
    step('Feedback form sends and confirms', fill_feedback)

    def required_validation():
        page.goto(f'{BASE}/contact-us/')
        f = page.locator('#contactForm')
        f.locator('button[type=submit]').click()
        page.wait_for_timeout(400)
        assert 'sent' not in (f.get_attribute('class') or '')
        assert page.evaluate("document.querySelector('#contactForm [name=first]').validationMessage") != ''
    step('Required fields block an empty form', required_validation)

    def honeypot():
        r = page.request.post(f'{BASE}/api/submit', multipart={'form': 'contactForm', 'website': 'http://spam', 'first': 'Bot', 'email': 'bot@example.com'})
        assert r.ok and r.json().get('ok'), r.text()
    step('Spam: honeypot submission is accepted silently and not stored', honeypot)
    b.close()

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1440, 'height': 950}, accept_downloads=True)
    page = ctx.new_page()
    login(page, ADMIN)

    def enquiries():
        page.goto(f'{BASE}/admin/enquiries')
        body = page.locator('body')
        for t in ('Contact us', 'Online doctor referral', 'Patient information form', 'Feedback'):
            expect(body).to_contain_text(t)
        expect(body).not_to_contain_text('Bot')
        page.screenshot(path=f'{SHOTS}/dashboard-enquiries.png')
        with page.expect_download() as d:
            page.get_by_role('link', name=re.compile('Export to CSV')).click()
        path = d.value.path()
        csv = open(path, encoding='utf-8-sig').read()
        assert 'Testpatient Referral' in csv and 'Go-live test feedback' in csv, csv[:300]
        page.get_by_role('link', name='Test Patientform').first.click()
        expect(page.locator('body')).not_to_contain_text('Test medication')
    step('Enquiries: all four forms logged with date and page, CSV export, no medical details stored', enquiries)
    b.close()

    b = p.chromium.launch()
    page = b.new_page(viewport={'width': 1440, 'height': 950})

    def editor_role():
        login(page, EDITOR)
        names = [t.strip() for t in page.locator('.d-nav a').all_inner_texts()]
        assert 'Users' not in names and 'Redirects' not in names, names
        page.goto(f'{BASE}/admin/settings')
        expect(page.locator('.d-tabs')).not_to_contain_text('Tracking')
        r = page.request.get(f'{BASE}/api/globals/site-settings')
        assert 'G-TEST12345' not in r.text(), 'editor can read tracking IDs'
        r = page.request.get(f'{BASE}/api/users')
        data = r.json()
        assert len(data.get('docs', [])) <= 1, 'editor can list other users'
        page.screenshot(path=f'{SHOTS}/dashboard-editor-view.png')
    step('Editor role: no Users, Redirects or tracking IDs', editor_role)
    b.close()

ok = sum(1 for r in results if r[1] == 'PASS')
print(f'\n{ok}/{len(results)} dashboard checks passed')
json.dump([{'check': a, 'result': b, 'detail': c} for a, b, c in results], open(os.path.join(SHOTS, 'dashboard-e2e.json'), 'w'), indent=1)
