# Changelog

## 3.6.1 (9 Nov 2026): SmileOX on the landing pages only; form emails to reception

- **SmileOX scoped to the two landing pages.** Online doctor referral, Patient information form (medical history), Contact us (online enquiry) and Feedback no longer send anything to SmileOX.
  - `app/api/submit/route.ts` and `public/assets/site.js` are back to their 3.4.0 code (before the CRM change), apart from the recipients below.
  - `lib/crm/forms.ts` and the unused `app/api/lead/route.ts` are removed.
  - `lib/crm/intake.ts` gains an allow-list (`CRM_FORMS` = `lp-dental-implants`, `lp-wisdom-teeth`): `sendLeadToCrm` refuses every other form name.
  - `/api/lp-lead` accepts only `pageType` `dental-implants` or `wisdom-teeth`.
  - The landing pages' SmileOX email (address, subject, JSON payload) is unchanged.
- **Form email recipients are set in the code** (`lib/forms/recipients.ts`, new) instead of Vercel variables:
  - Website forms go to `reception@sunshinecoastofis.com.au` only. Previously `FORM_TO`, or by default `rowayne@gyaclients.com, va@generateyouraudience.com`, plus `FORM_CC`/`FORM_BCC`.
  - Landing pages send a plain-English copy to `reception@sunshinecoastofis.com.au` and `rowayne@gyaclients.com`, plus SmileOX. Previously the copy went only to an optional `NOTIFY_TO`.
  - `FORM_TO`, `FORM_CC`, `FORM_BCC` and `NOTIFY_TO` are no longer read.
- **Docs and tooling:** `.env.example`, `README_CRM.md`, `README-CMS.md`, `README.md`, `docs/landing-pages.md`, the `scripts/update-and-deploy.sh` NOTIFY_TO prompt removed, and `scripts/test-crm.ts` now tests the allow-list and recipients.

## 3.6.0 (6 Nov 2026): Google Ads landing pages at /lp with discreet footer links

- Rowayne's two landing pages are on the site: `/lp/dental-implants` (from `index.html`) and `/lp/wisdom-teeth`, as static files in `public/lp` with rewrites so the addresses work without `.html`. Design, copy, section order and the `noindex, follow` meta are unchanged.
- Paths inside the pages are root-absolute (`/lp/assets/...`, `/lp/images/...`). The footer cross-links point at `/lp/...`, and Main website, Contact us and Privacy policy are same-tab links to `/`, `/contact-us/` and `/privacy-policy/`. All nine practice photos the pages used from the live site now load from the site's own `/images`.
- `/lp/...` pages have no trailing slash (middleware), so the ad final URLs answer 200 with no redirect; a trailing slash redirects back with gclid and utm_* kept.
- Form: new `POST /api/lp-lead` (Rowayne's `api/lead.js` as a Next.js route, so it doesn't clash with the site's `/api/lead`). It sends through the same SmileOX path as the site's forms (SMTP when set, otherwise the existing SMTP2GO account, TLS, retries), and reads both naming styles: `MAIL_FROM`/`SMTP_FROM`, `LEAD_INTAKE`/`CRM_INTAKE_EMAIL`. Fixed: the wisdom teeth form's `anaesthetic` answer was dropped; it's now in the lead and on an "Anaesthetic:" line in the `NOTIFY_TO` copy. The `NOTIFY_TO` copy is sent after the answer, so it can no longer turn a sent lead into an error. Each lead is also recorded in the dashboard's Enquiries.
- Tracking: the pages' GTM head snippet loaded gtm.js without pushing the `gtm.js` start event, so "All Pages" triggers (including the Conversion Linker) might never fire. Replaced with Google's standard GTM-TZ7DJSC2 snippet; noscript iframe and the `site.js` dataLayer events unchanged.
- Footer: "Implants" and "Wisdom teeth" links at the end of the bottom row (after Privacy policy | Disclaimer), at the disclaimer's size and colour. Not in the header, menus or sitemap; `/lp/` is not blocked in robots.txt.
- Cache headers for `/lp/assets` (1 week) and `/lp/images` (30 days), from Rowayne's `vercel.json`. `cleanUrls` was not added: it is for static sites, and the rewrites do the same job in Next.js.
- `lib/crm/intake.ts`: the SMTP2GO fallback always sends from `FORM_FROM` (the sender the clinic emails already use), so a `MAIL_FROM` on an unverified domain can't stop leads.
- Files: `public/lp/**` (new), `app/api/lp-lead/route.ts` (new), `lib/crm/intake.ts`, `middleware.ts`, `next.config.mjs`, `content/templates/sections.json`, `public/assets/site.css`, `.env.example`, `README_CRM.md`, `docs/landing-pages.md` (new), `package.json`.

## 3.5.0 (6 Nov 2026): website forms create leads in the SmileOX CRM

- Contact us, Online doctor referral and the Patient information form now also send each submission to SmileOX as a lead: an email to the practice's intake address, subject "Website form submission", with the lead as plain-text JSON (`firstName`, `lastName`, `email`, `phoneNumber` in E.164, plus `formName`, `pageUrl`, `submittedAt` in Brisbane time, any `utm_*` and the form's own non-medical fields). SmileOX updates an existing lead when the email and phone match.
- Health information is never sent to the CRM: no dates of birth, Medicare numbers, medical history, medications, referral reasons, clinical notes or attachments. The Feedback form is not sent. The clinic's notification emails and dashboard records are unchanged.
- The lead is sent after the visitor sees "thank you", so the CRM can never slow down or break a form; transient errors are retried 3 times with backoff, and the log records the outcome without patient details.
- Sent with nodemailer over SMTP when `SMTP_HOST`, `SMTP_USER` and `SMTP_PASS` are set (TLS required, TLS 1.2 or later), otherwise through the existing SMTP2GO account (`SMTP2GO_API_KEY`).
- New `POST /api/lead` for other forms (for example future landing pages): validates name, email and an Australian phone number, honeypot and minimum fill time, sends the lead and the clinic notification.
- Campaign tags (`utm_*`) on the page a visitor lands on are kept for the visit and sent with the lead.
- Files: `lib/crm/intake.ts`, `lib/crm/forms.ts`, `app/api/lead/route.ts` (new), `app/api/submit/route.ts`, `public/assets/site.js`, `scripts/test-crm.ts` (`npm run test:crm`), `package.json` (nodemailer), `.env.example`, `README_CRM.md`.

## 3.4.0 (5 Nov 2026): Google Tag Manager (GTM-TZ7DJSC2) site-wide

- Google's official Tag Manager snippet is on every page: all 23 pages in the sitemap and the 404 page. That includes the home page, service and location pages, the blog, the Contact, Referral and Patient information form pages, and the form thank-you messages, which appear on the same pages. The head snippet sits straight after the charset and viewport tags and the noscript iframe straight after `<body>`, exactly once per page. The client's gtag-style snippet was not used.
- One container ID, in one place (`lib/gtm.ts`): the Vercel variable `NEXT_PUBLIC_GTM_ID`, falling back to `GTM-TZ7DJSC2` if it is missing or not a GTM-... ID. The dashboard's old "Google Tag Manager container ID" field is no longer used (its help text says so), so there can never be two containers; the build log warns if it holds a different ID.
- GTM loads only on the live site: Vercel production builds, and in the browser only on sunshinecoastofis.com.au or www. It never loads on previews, the vercel.app address, local builds, or the dashboard's page editor and preview, so staff editing pages is not counted as visits.
- Conversion event: `dataLayer.push({ event: 'form_submit_success', form_name: 'contact' | 'referral' | 'patient_information' })`, sent only after the server confirms a submission (not on click, not when a form is refused). It holds nothing else: no patient data is sent to Google. The Feedback form sends no event.
- No Content Security Policy exists in the project, so none needed changing.
- Existing tracking: nothing hard-coded (no gtag.js, GA4, Google Ads, Meta Pixel, call tracking or older GTM in the code). The only other analytics are the dashboard's Site Settings > Tracking fields (GA4 measurement ID, Meta Pixel ID), which load gtag.js or the Pixel separately if filled in. Check them on the live dashboard: if GA4 is also set up inside GTM, clear the GA4 field to avoid counting visits twice.

Files: `lib/gtm.ts` (new), `lib/head.ts`, `lib/render.ts`, `app/(frontend)/edit-preview/route.ts`, `public/assets/site.js`, `dashboard/editors/SettingsForm.tsx`, `cms/globals/SiteSettings.ts` (help text only), `README-CMS.md`, `package.json`.

## 3.3.0 (5 Nov 2026): Patient information form changes (requested by Taryn)

Only the Patient information form changed. The Contact and Referral forms, page layout, SEO, tracking and email recipients are unchanged.

1. **First Name and Surname** replace Patient Name, both required. They are separate rows in the email and the dashboard. Older records still show their single Patient Name.
2. **Date of birth as dd/mm/yyyy.** Cause: the browser's date box always sent yyyy-mm-dd, and its day and month order on screen followed the browser's language setting (US-English browsers showed mm/dd/yyyy). All five date boxes are now plain dd/mm/yyyy boxes (slashes added while typing, number pad on phones), and every date is stored as dd/mm/yyyy when the form arrives. The email, dashboard and CSV therefore all match, and older yyyy-mm-dd records display as dd/mm/yyyy.
3. **Medicare number and reference required**, with the note "If you don't have a Medicare card, please write NA." NA (any case, or N/A) is accepted. Otherwise the number must be a valid Medicare number (10 digits, check digit) and the reference must be 1 to 9. These boxes no longer open the number-only keypad, so NA can be typed on a phone.
4. **Allergies required**, with the note "If you have no known allergies, please write NKA."
5. **Current weight and height required** (labels unchanged).
6. **Smoker, Drink Alcohol and Could you be pregnant? required.** Pregnant already had a "Not applicable" option.

How the checks work: a red asterisk marks every required field. A red message appears beside each missing or invalid field, the page scrolls to the first one, and everything already typed is kept. The server repeats every check and refuses incomplete submissions, so nothing incomplete is emailed or saved.

Files: `content/templates/sections.json` (patient-information-form/2 only), `public/assets/site.js`, `public/assets/site.css`, `lib/forms/definitions.ts`, `lib/forms/rules.ts` (new), `lib/forms/email-body.ts` (new, the email layout moved unchanged from the submit route), `lib/forms/display.ts` (new), `app/api/submit/route.ts`, `app/(dashboard)/admin/(app)/enquiries/[id]/page.tsx`, `cms/endpoints.ts` (CSV export), `scripts/test-patient-form.ts` (new, `npm run test:patient-form`), `package.json`.

## 3.2.1 (2 Nov 2026): Blog in the main menu

- **Blog** added to the main navigation (SEO team request): a sixth item in the Patients dropdown on desktop, in the same style as the other five, and a Blog link after Patient information in the mobile menu. A sixth top-level item was tested and not used: between 1140 and 1250 px it squeezes the logo to 63 to 103 px wide (141 px normally).
- Dashboard: applied by the data migration `20261102_000002_blog_menu` (same rules as 3.2.0: only where the menu has not been changed in the dashboard). The patch logic now lives in `cms/contentPatch.ts`, shared by both updates.
- `deploy-update.sh` / `.ps1` take an optional commit message (`--message` / `-Message`).
- Checked again for go-live: `robots.txt` on sunshinecoastofis.com.au allows crawling (the `vercel.app` address deliberately blocks it); `www` and missing trailing slashes are one 301 to `https://sunshinecoastofis.com.au/...`; HTTP to HTTPS is done by Vercel once the domain is attached.

## 3.2.0 (2 Nov 2026): SEO and compliance fixes before go-live

Content changes are made in `content/` and reach the dashboard through the data migration `20261102_000001_seo_compliance_content`, which runs once in the next Vercel build. It changes a field only where the dashboard still has the wording being replaced, so edits made by the practice are kept; anything skipped is listed in the build log under `[content 3.2.0]`.

### Tracking
- Google Analytics, Tag Manager and the Meta Pixel load only on the production deployment, and only on sunshinecoastofis.com.au (not previews, `vercel.app` or local). The Tag Manager noscript frame now sits straight after `<body>`. Tag Manager IDs are checked (`GTM-...`) before use.
- README: where to paste each code, and Search Console verification by DNS TXT record.

### Headings
- Wisdom teeth H1: "Wisdom teeth removal on the Sunshine Coast, completely asleep". Dental implants H1: "Dental implants on the Sunshine Coast, placed by specialist surgeons". Meta titles unchanged.

### New pages
- `/locations/hervey-bay/` (St Stephen's Private Hospital, Urraween, with Hospital structured data) and `/locations/gympie/`, built from the approved page heading, text and side panel styles. Both in the sitemap, linked from Locations; the footer's Hervey Bay link opens the new page.
- The old `/hervey-bay-st-stephens-private-hospital/` now 301s to `/locations/hervey-bay/` in one hop.
- New section designs: "Text with headings, paragraphs and lists" (`content/body`, empty parts are left out of the page) and "Risk statement" (`notice/risk`).

### AHPRA wording
- Risk statement on all seven procedure pages and both articles.
- Google rating and review count removed from the homepage banner (five stars removed from the design) and the homepage review section hidden.
- "exceptional", "expert", "leading", "world renowned", "perfect", "highly experienced", "cutting-edge", "revolutionised", "permanent solution" and similar claims reworded; "Royal Australian College" corrected to "Royal Australasian College of Dental Surgeons". Full list in the 3.2.0 summary.
- Patient information form consent: clinical photos no longer consented for "advertising" (teaching, scientific papers and presentations stay).
- Article side panel: "can be discussed at a consultation" instead of "are best answered".

### Privacy policy and Disclaimer
- Full privacy policy (Privacy Act 1988 and APPs) and disclaimer, each with "Last updated: 2 November 2026". Placeholders marked `[CONFIRM: ...]` for the practice to fill in. `npm run qa:banned` now fails while any `[CONFIRM` remains, so they cannot reach the live site unnoticed.

### SEO
- Homepage meta description made unique (it repeated About's).
- `seo-migration/old-wordpress-urls.txt`: the 44 live WordPress URLs, one per line. All 44 re-tested: 21 kept, 23 one 301 to a 200.
- `seo-migration/post-images-to-reupload.json`: the three article images, their positions and suggested alt text (the live site cannot be reached from GYA's build environment).

## 3.1.5 (2 Nov 2026): forms never hang on "Sending..."

- The form now answers as soon as the email is sent; saving the copy under Enquiries happens straight after the answer, so a slow or sleeping database can no longer hold the visitor up (it still waits when no email is configured, because then the dashboard is the only copy).
- Time limits: 15 seconds for SMTP2GO, 20 seconds for the dashboard record, 30 seconds for the whole request, and 35 seconds in the browser, after which the visitor sees "please call (07) 5406 0586" instead of an endless "Sending...".
- Each submission logs `[submit] <form>: email <status> after <n> ms` in the Vercel logs.

## 3.1.4 (2 Nov 2026): copies of form emails

- New optional Vercel variables `FORM_CC` (visible copy) and `FORM_BCC` (hidden copy), comma separated, applied to every form email. `GET /api/submit` shows the copy addresses masked.

## 3.1.3 (29 Oct 2026): form check page no longer lists other domains

- `GET /api/submit` (the email setup check) listed every sender domain on the SMTP2GO account, which includes other GYA clients, to anyone who opened it. It now answers yes or no only: `sender_domain_registered` (the current sender) and `practice_domain_registered` (sunshinecoastofis.com.au).

## 3.1.2 (27 Oct 2026): View links follow the site being tested

- Every "View" link in the dashboard (sidebar, top bar, Pages list, page and article editors) opens the copy of the site the dashboard belongs to: the staging (`cms`) preview while testing, the vercel.app address before the domain moves, and sunshinecoastofis.com.au once it is live. Nothing to change at go-live.
- The Google previews in the SEO panels still show sunshinecoastofis.com.au, as Google will.

## 3.1.1 (27 Oct 2026): faster page editor

- Server functions now run in Sydney (`vercel.json` `regions: ["syd1"]`), next to the Neon database. They were running in Vercel's default US region, so every dashboard request crossed the Pacific several times.
- The editor's page view no longer loads the background video, Google Maps or the 3D tour (the photo or the map's note shows instead), and looks up only the library photos the page uses.
- A "Still loading" message after 6 seconds, and the page shows even if the editing script is slow to arrive.

## 3.1.0 (27 Oct 2026): visual page editor

- **Edit on the page:** Pages now opens the real page in the dashboard (desktop or mobile view). Click any text to edit it in place, click any photo to replace it, click a button then "Change link" to change where it goes. Same approach as the Coastal Dental dashboard.
- Right panel: **Content** (every photo with its description and a Replace button, every button and link with its address), **SEO**, **Sections** (move, hide, and the full form for each section), **Settings**.
- The phone number placeholder is kept when wording around it is edited, so it still follows Site Settings.
- Header, menu and footer are edited on their own screen, shown around the home page.
- Parts generated from Team, Site Settings and the blog explain where to edit them when clicked.
- Nothing changes on the public site: the editing marks and script exist only in the signed-in dashboard preview.

## 3.0.0 (27 Oct 2026): go-live version with the client dashboard

Replaces the single-page `index.html` site (hash routing) with the same approved design on real page addresses, plus the practice dashboard. Built for go-live on sunshinecoastofis.com.au.

### Website
- Every approved page now has its own address, identical to the WordPress site (trailing slash kept): `/`, `/about/`, `/services/`, the seven service pages, `/patient-information/`, `/online-doctor-referral/`, `/locations/`, `/contact-us/`.
- Pages that were on the live site but not in the single page, built only from approved components: `/blog/`, the two existing articles at their old addresses (`/teeth-in-a-day/`, `/wisdom-teeth-removal-before-age-25/`), `/patient-information/patient-information-form/`, `/feedback/`, `/privacy-policy/`, `/disclaimer/`, and an on-brand 404 page.
- Design, wording and images unchanged from the approved version (22 Oct 2026, commit 988e5f8). Checked by an exact HTML comparison of every section and a pixel comparison at 1280 and 390 px.
- Public pages are pre-rendered plain HTML with no framework script, so they load as fast as the static version.
- Photos that are not visible when a page opens (menu dropdown photos, everything below the first section) now load as the visitor scrolls. No visual change; mobile Lighthouse performance went from 74 to 80 up to 92 to 97.
- Payload's colour-scheme client hint headers limited to `/cms`, which removes a repeated page request in Chrome on the public site.

### SEO migration
- Every live title and meta description carried over, with the full wording recovered where the crawl cut it short. Share titles carried over.
- Canonicals on `https://sunshinecoastofis.com.au`, `sitemap.xml`, host-driven `robots.txt` and `noindex` (only the real domain can be indexed).
- 15 page redirects for live URLs with no exact match, plus WordPress patterns (feeds, archives, old sitemaps, `?p=` links, `wp-admin`, `wp-login.php`). All single-hop 301s. `www` and missing trailing slashes are one 301 hop to the canonical address.
- Structured data: MedicalClinic and Dentist for the practice, Person for both surgeons, Hospital for each operating location, BreadcrumbList, FAQPage, BlogPosting.
- Reports in `seo-migration/`.

### Dashboard (`/admin`)
- Payload CMS 3 on Neon Postgres with Vercel Blob for photos. The build pulls the dashboard content into `content/` and falls back to the committed files if the database is unavailable.
- Sidebar: Dashboard, Pages, Blog Posts, Media Library, Team, Enquiries, SEO, Site Settings, Redirects, Users. SCOFIS logo and colours.
- Pages: edit wording, links and photos section by section, reorder and hide sections, preview before publishing, SEO tab with a Google preview.
- Media Library with "replace everywhere". Team with both surgeons' bios and the practice team. Blog with an AHPRA reminder that covers the specialist title. Site Settings for practice details, opening hours, the six locations, brand and (admins only) tracking IDs.
- Enquiries: every website form is logged with the page it came from, with follow-up notes and CSV export. Medical details from the Patient information form are emailed only, not stored.
- Editors cannot see Users, Redirects or tracking IDs. `/cms` is GYA only.
- "Publish website" triggers the Vercel build through a deploy hook.

### Forms
- Contact us, Online doctor referral, Patient information form and Feedback post to `/api/submit` (SMTP2GO, attachments up to about 4 MB, honeypot and a minimum fill time against spam).
- The Online doctor referral email now matches the old WordPress email (the 7 Oct 2026 rebuild, which had not been pushed to the repo before), with its test `npm run test:email`.

### Tooling
- `npm run test:render`, `npm run test:email`, `npm run qa:banned`, `_tools/seo_migration.py`, `_tools/tests/` (pixel diff, page audit, dashboard browser test, Lighthouse).
- `scripts/push-to-github.sh` (stage on `cms`, promote, rollback) for SCOFIS.

### Removed
- `index.html` (single page; kept for reference in `_tools/source/`), `api/submit.js` (now `app/api/submit/`), the old `vercel.json` `cleanUrls` setting (Next.js handles clean addresses; `vercel.json` now sets the Next.js framework and build commands so the Vercel dashboard preset does not need changing). `images/` and `files/` moved to `public/images/` and `public/files/` (same addresses).
