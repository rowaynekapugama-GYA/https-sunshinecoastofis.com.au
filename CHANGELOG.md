# Changelog

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
