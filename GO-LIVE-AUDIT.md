# Go-live audit: Sunshine Coast Oral, Facial & Implant Specialists

Version 3.1.0, 27 Oct 2026. Audited on a production build (`npm run build` then `npm start`) in GYA's test environment, against the live WordPress site crawled on 26 and 27 Oct 2026. This is an update to the existing repo `rowaynekapugama-GYA/https-sunshinecoastofis.com.au` (new `cms` branch), not a new repo. Nothing has been pushed or deployed.

**Summary:** every live URL is covered (21 kept exactly, 23 redirected in one hop, 0 missing). Titles, descriptions and canonicals carried over. All four forms send and log. Every dashboard function passes, including the visual page editor (click text or photos on the page to change them) and the editor restrictions. Lighthouse is 90 or more on all four scores in all ten runs (five pages, mobile and desktop). The open items are decisions, not build faults; they are listed first.

## 1. Decisions needed before go-live

| # | Item | Why it needs a decision | Recommendation |
|---|---|---|---|
| 1 | **Header between 821 and 1139 px** (iPad landscape, small laptops, phones turned sideways) | In the approved design the full menu does not fit at these widths: at 1024 px the logo shrinks to about 11 px wide, and at 844 x 390 the page scrolls sideways. The logo is also squeezed 19% narrower on 375 px phones. Fixing it changes the approved look at those widths, so it has not been applied. Screenshots: `audit/screenshots/issues/header-1024.png` (now) and `proposed-header-1024.png` (with the fix). | Approve `_tools/proposed-fixes/header-fit.css` (burger menu up to 1139 px, logo cannot shrink). Tested at 14 widths: no sideways scroll, logo correct everywhere, no change at 1140 px and wider. |
| 2 | **Colour contrast (WCAG AA)** | The brand cyan buttons (white on #1DB2DE, 2.5:1) and the small cyan-deep text and links (#0E8DB5, 3.4 to 3.8:1) are below the 4.5:1 AA minimum. This is the approved palette. | A darker cyan for button backgrounds and small text, for example #08739A (5.3:1 on white, 4.8:1 on the pale grey sections). Needs design sign-off. |
| 3 | **Five hospital pages** | The live site has a page per hospital (including `/noosa-private-hospital/`). The approved design has no hospital pages, so all five 301 to `/locations/`. The brief asks to keep the Noosa URL; there is no Noosa page to keep, and the live Noosa page was half converted to Maroochy Private Hospital. | Keep the redirects for go-live. If hospital pages are wanted later, design them and swap the redirects for pages. |
| 4 | **Patient information form wording** | The consent, fee policy and AI note text are a summary written for the build, not the practice's wording. The consent includes using clinical photos "in advertising", which needs an AHPRA read. A typed name plus a tick box stands in for a signature. Medical details are emailed but not stored. | The practice sends its exact consent and fee wording; GYA swaps it in. |
| 5 | **Privacy policy and Disclaimer** | The live Privacy Policy said "Coming Soon". The new one is draft wording. The Disclaimer uses the approved footer wording plus a few lines. | Practice approves both before go-live. |
| 6 | **Feedback form** | The live page sent happy patients to Google and unhappy ones to a private form (review gating, which Google's policy prohibits). The new form is the same for everyone. | Keep as built. |
| 7 | **Form recipients and sender** | `FORM_TO` defaults to GYA's test inboxes. `FORM_FROM` defaults to `noreply@dentalspecialists.com.au` until `sunshinecoastofis.com.au` is verified in SMTP2GO. | Set `FORM_TO` to the practice inbox (reception@sunshinecoastofis.com.au is on the live site; confirm) and verify the domain in SMTP2GO. |
| 8 | **GA4 and Search Console** | No GA4 tag or Search Console meta tag was found on the live site (it may use Site Kit or DNS verification). None have been invented. | Confirm the GA4 Measurement ID and Search Console method; enter the IDs in Site Settings > Tracking and links (admin) before go-live. If Search Console uses DNS verification, nothing is needed. |
| 9 | **AHPRA wording** (listed, not changed) | "expert care" in Dr Lincoln's bio (About and bio panel); "trained with leading surgeons" (All-on-4, Zygomatic); blog index meta description "expert information" (live wording); in the two migrated blog posts "highly experienced", "permanent", "revolutionised", "cutting-edge", "perfect" and "Royal Australian College" (should be "Royal Australasian College"). The homepage shows the Google rating and "317 Google reviews" with links, not quotes; the count is typed in and will date. The live homepage's "What Our Clients Say" testimonials are not on the new site. | Practice or GYA rewords the flagged lines; GYA updates in the dashboard. |
| 10 | **Blog post images** | The two migrated articles had stock and WordPress images that are not in the repo. They now use approved site photos as featured images and the in-article images were removed. | Re-upload the originals in the dashboard if wanted (list in `seo-migration/post-images-to-reupload.json`). |
| 11 | **Locations map sea colour** | On the approved single page the Locations map showed no sea colour (two maps shared an SVG id). On real pages it now shows the sea exactly like the approved homepage map. | Keep (it matches the homepage). Say if it should stay pale. |
| 12 | **Fax number and hours** | The live site lists a fax number and hours that differ from the approved site. The approved site's details are used. | Practice confirms the hours; Site Settings > Opening hours and the footer wording match once confirmed. |

## 2. Page audit: every page at every viewport

286 checks (22 pages x 13 viewports). Each check: HTTP status, console errors, failed requests, broken images, images without alt text, sideways scroll, logo proportions, one H1, pinch zoom allowed, body text at least 16 px. Data: `audit/site-audit.json`.

| Page | 320 | 360 | 375 | 390 | 414 | 768 | 820 | 1024 | 1280 | 1440 | 1920 | 390 land. | 768 land. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/about/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/services/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/services/wisdom-teeth-removal/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/services/dental-implants/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/services/all-on-4-dental-implants/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/services/zygomatic-implants/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/services/jaw-bone-grafting/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/services/orthognathic-corrective-jaw-surgery/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/services/facial-trauma/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/patient-information/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/patient-information/patient-information-form/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/locations/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/online-doctor-referral/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/contact-us/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/feedback/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/blog/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/teeth-in-a-day/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/wisdom-teeth-removal-before-age-25/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/privacy-policy/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/disclaimer/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |
| `/this-page-does-not-exist/` | PASS | PASS | L | L | PASS | PASS | PASS | L | PASS | PASS | PASS | H | L |

**Codes:** PASS = every check passed. **L** = logo squeezed (more than 6% out of proportion; approved design, decision 1). **H** = sideways scroll on a phone turned landscape, 844 x 390 (approved design, decision 1).

Results across all pages and viewports:

| Check | Result |
|---|---|
| HTTP status | PASS: every page 200; the 404 page answers 404 |
| Console errors | PASS: none (outside requests such as fonts, video and maps are blocked in the test environment and were excluded) |
| Broken images, missing alt text | PASS: none. Decorative images use empty alt text on purpose |
| One H1 per page | PASS on all 22 pages |
| Body text 16 px or more on mobile | PASS |
| Pinch zoom allowed | PASS (no `maximum-scale` or `user-scalable=no`) |
| Sticky header and bottom call bar | PASS: header sticks; on phones the footer has room for the bar so nothing is hidden behind it |
| Links | PASS: 37 internal links, all 200 with no redirect. Phone links are `tel:0754060586` and show (07) 5406 0586 |
| Footer year | PASS: 2026, set at build time (any publish in January updates it) |
| Navigation | PASS: Services menu opens by mouse and keyboard, Escape closes it, 3 px focus outline, mobile drawer and its Services list open and close, the drawer scrolls, the Locations switcher updates the map |
| Tap targets 44 x 44 px | **58 below 44 px**, all in the approved design: footer links (38 px tall), Facebook and Instagram icons (38 x 38), top bar phone link (16 px tall), radio and tick box labels on the forms (42 px), breadcrumb links (36 px). Listed, not changed |
| Heading order | **h1 then h3** (no h2) on `/services/`, `/online-doctor-referral/` and the Patient information form: approved markup. Listed, not changed |

Screenshots of every page at 1280 and 390 px: `audit/screenshots/pages/`.

| Page | 1280 | 390 |
|---|---|---|
| `about` | [1280](audit/screenshots/pages/about-1280.jpg) | [390](audit/screenshots/pages/about-390.jpg) |
| `blog` | [1280](audit/screenshots/pages/blog-1280.jpg) | [390](audit/screenshots/pages/blog-390.jpg) |
| `contact-us` | [1280](audit/screenshots/pages/contact-us-1280.jpg) | [390](audit/screenshots/pages/contact-us-390.jpg) |
| `disclaimer` | [1280](audit/screenshots/pages/disclaimer-1280.jpg) | [390](audit/screenshots/pages/disclaimer-390.jpg) |
| `feedback` | [1280](audit/screenshots/pages/feedback-1280.jpg) | [390](audit/screenshots/pages/feedback-390.jpg) |
| `home` | [1280](audit/screenshots/pages/home-1280.jpg) | [390](audit/screenshots/pages/home-390.jpg) |
| `locations` | [1280](audit/screenshots/pages/locations-1280.jpg) | [390](audit/screenshots/pages/locations-390.jpg) |
| `online-doctor-referral` | [1280](audit/screenshots/pages/online-doctor-referral-1280.jpg) | [390](audit/screenshots/pages/online-doctor-referral-390.jpg) |
| `patient-information` | [1280](audit/screenshots/pages/patient-information-1280.jpg) | [390](audit/screenshots/pages/patient-information-390.jpg) |
| `patient-information__patient-information-form` | [1280](audit/screenshots/pages/patient-information__patient-information-form-1280.jpg) | [390](audit/screenshots/pages/patient-information__patient-information-form-390.jpg) |
| `privacy-policy` | [1280](audit/screenshots/pages/privacy-policy-1280.jpg) | [390](audit/screenshots/pages/privacy-policy-390.jpg) |
| `services` | [1280](audit/screenshots/pages/services-1280.jpg) | [390](audit/screenshots/pages/services-390.jpg) |
| `services__all-on-4-dental-implants` | [1280](audit/screenshots/pages/services__all-on-4-dental-implants-1280.jpg) | [390](audit/screenshots/pages/services__all-on-4-dental-implants-390.jpg) |
| `services__dental-implants` | [1280](audit/screenshots/pages/services__dental-implants-1280.jpg) | [390](audit/screenshots/pages/services__dental-implants-390.jpg) |
| `services__facial-trauma` | [1280](audit/screenshots/pages/services__facial-trauma-1280.jpg) | [390](audit/screenshots/pages/services__facial-trauma-390.jpg) |
| `services__jaw-bone-grafting` | [1280](audit/screenshots/pages/services__jaw-bone-grafting-1280.jpg) | [390](audit/screenshots/pages/services__jaw-bone-grafting-390.jpg) |
| `services__orthognathic-corrective-jaw-surgery` | [1280](audit/screenshots/pages/services__orthognathic-corrective-jaw-surgery-1280.jpg) | [390](audit/screenshots/pages/services__orthognathic-corrective-jaw-surgery-390.jpg) |
| `services__wisdom-teeth-removal` | [1280](audit/screenshots/pages/services__wisdom-teeth-removal-1280.jpg) | [390](audit/screenshots/pages/services__wisdom-teeth-removal-390.jpg) |
| `services__zygomatic-implants` | [1280](audit/screenshots/pages/services__zygomatic-implants-1280.jpg) | [390](audit/screenshots/pages/services__zygomatic-implants-390.jpg) |
| `teeth-in-a-day` | [1280](audit/screenshots/pages/teeth-in-a-day-1280.jpg) | [390](audit/screenshots/pages/teeth-in-a-day-390.jpg) |
| `this-page-does-not-exist` | [1280](audit/screenshots/pages/this-page-does-not-exist-1280.jpg) | [390](audit/screenshots/pages/this-page-does-not-exist-390.jpg) |
| `wisdom-teeth-removal-before-age-25` | [1280](audit/screenshots/pages/wisdom-teeth-removal-before-age-25-1280.jpg) | [390](audit/screenshots/pages/wisdom-teeth-removal-before-age-25-390.jpg) |

## 3. Forms

Tested in a browser on the production build with the dashboard database connected (`_tools/tests/dashboard_e2e.py`).

| Form | Validation | Upload | Confirmation | Logged in Enquiries | Email |
|---|---|---|---|---|---|
| Contact us | PASS (empty form blocked) | n/a | PASS | PASS | Built and sent through SMTP2GO code path; real send needs the live key (see below) |
| Online doctor referral | PASS | PASS (photo attached) | PASS | PASS | Matches the old WordPress email: 13 of 13 checks in `npm run test:email` (preview `audit/email-preview/referral.html`) |
| Patient information form | PASS | n/a | PASS | PASS, medical details not stored | As above |
| Feedback | PASS | n/a | PASS | PASS | As above |

- **Spam protection:** hidden honeypot field (submissions that fill it are accepted silently and dropped) plus a minimum fill time of 2.5 seconds. PASS.
- **CSV export** from Enquiries includes every form and field: PASS.
- **SMTP2GO:** the real send could not be tested here (no key in the test environment, by design). After the preview is deployed with `SMTP2GO_API_KEY`, open `/api/submit` in a browser: it reports whether the key works and which sender domains are verified, without sending anything. Then send one test of each form to confirm delivery to `FORM_TO`.

## 4. Lighthouse

Lighthouse 12 on the production build, with the local server treated as the live domain (`EXTRA_LIVE_HOSTS=localhost`) so the `noindex` header used on preview addresses does not affect SEO. Mobile uses Lighthouse's simulated slow 4G and mid-range phone. Reports: `audit/lighthouse/*.report.html`; scores: `audit/lighthouse/summary.json`.

| Page | Device | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| Home `/` | Mobile | 96 | 95 | 96 | 100 | 2.6 s | 0 | 10 ms |
| Home `/` | Desktop | 100 | 94 | 96 | 100 | 0.6 s | 0.001 | 0 ms |
| Service `/services/dental-implants/` | Mobile | 97 | 94 | 96 | 100 | 2.4 s | 0 | 0 ms |
| Service `/services/dental-implants/` | Desktop | 100 | 93 | 96 | 100 | 0.6 s | 0 | 0 ms |
| Location `/locations/` | Mobile | 92 | 96 | 96 | 100 | 3.4 s | 0 | 0 ms |
| Location `/locations/` | Desktop | 100 | 96 | 96 | 100 | 0.8 s | 0 | 0 ms |
| Blog index `/blog/` | Mobile | 96 | 95 | 96 | 100 | 2.8 s | 0 | 0 ms |
| Blog index `/blog/` | Desktop | 100 | 95 | 96 | 100 | 0.6 s | 0 | 0 ms |
| Contact us `/contact-us/` | Mobile | 95 | 94 | 96 | 100 | 2.6 s | 0 | 0 ms |
| Contact us `/contact-us/` | Desktop | 100 | 94 | 96 | 100 | 0.6 s | 0.001 | 0 ms |

- **Performance:** 92 to 97 on mobile, 100 on desktop. Before go-live work the mobile scores were 74 to 80; two changes with no visual effect fixed it: photos that are not visible when the page opens now load as the visitor scrolls, and Payload's client hint headers (which made Chrome request every page twice) are limited to `/cms`.
- **Accessibility 93 to 96:** the only failures are colour contrast (decision 2) and, on three pages, a heading level skipped in the approved markup.
- **Best practices 96:** the only failure is a console message because Google Fonts cannot be reached from the test environment. It does not apply on the live site.
- **SEO 100** on every run.
- **Core Web Vitals (lab):** CLS 0 to 0.001 and TBT 0 to 10 ms (the lab stand-in for INP) are in Google's "good" range everywhere. Mobile LCP is 2.4 to 3.4 s under simulated slow 4G (good is 2.5 s or less), and 0.6 to 0.8 s on desktop. The test server does not compress HTML and cannot reach Google Fonts; Vercel compresses and caches at the edge, so live numbers should be better. Re-check with PageSpeed Insights after go-live and in Search Console's Core Web Vitals report after 28 days.

## 5. Keyboard, focus and 404

- Keyboard: Tab reaches every menu item and button, Enter opens the dropdown menus, Escape closes them and the mobile drawer. PASS.
- Focus: a visible 3 px cyan outline on every link, button and field. PASS.
- 404: on-brand page (approved header, footer and components), answers HTTP 404, `noindex`, links back to the main pages. Screenshots `audit/screenshots/pages/this-page-does-not-exist-*.jpg`. PASS.

## 6. SEO migration

Files in `seo-migration/`:

| File | What |
|---|---|
| `live-inventory.csv`, `.json` | All 44 live URLs found in the sitemaps and links, with title, meta description, canonical, robots, share tags, H1, H2s and notes |
| `url-parity.csv`, `.json` | Each live URL requested on the new site, with and without the trailing slash: status, where it ends, number of hops |
| `redirects.json` | The 15 page redirects with the reason for each (also in the dashboard under Redirects) |
| `wordpress-patterns.csv` | WordPress addresses: `?p=`, `?page_id=`, feeds, archives, old sitemaps, `wp-admin`, `wp-login.php`, `www` |
| `metadata-diff.csv`, `.json` | Title, meta description, canonical and H1, live against new, for every kept URL |
| `sitemap-check.csv` | Every URL in the new sitemap: 200, canonical to itself, indexable |
| `page-seo.json` | The SEO values seeded into the dashboard |
| `post-images-to-reupload.json` | Blog images that were not migrated |

| Check | Result |
|---|---|
| URL parity | 21 live URLs answer 200 at the same address; 23 redirect with a single 301 to the closest page; 0 missing; 0 redirect chains |
| Trailing slash | Every page uses the WordPress trailing slash; the address without it is one 301 to it |
| `www` | `www.sunshinecoastofis.com.au` is one 301 to `https://sunshinecoastofis.com.au` (same path), matching the live site's preference |
| Titles | 21 of 21 identical to live |
| Meta descriptions | 17 of 21 identical; 3 pages had none on live (Feedback, Privacy policy, Disclaimer) and now have one; Locations drops "Noosa" because Noosa is not on the approved site (decision 3) |
| Canonicals | 21 of 21 identical (`https://sunshinecoastofis.com.au/...`) |
| H1 | One per page. Most live pages had no H1 or "Welcome To"; the new H1s are the approved headings. The two blog posts keep their live H1 |
| Sitemap | `/sitemap.xml`: 21 URLs, all 200 and self-canonical. Old Yoast and WordPress sitemap addresses redirect to it |
| robots.txt | Live domain: allows everything except `/admin`, `/cms`, `/api/` and the preview route, and lists the sitemap. Any other host (vercel.app, previews): `Disallow: /` plus an `X-Robots-Tag: noindex` header |
| Structured data | MedicalClinic and Dentist (practice, address, phone, hours, areas served), Person for both surgeons (qualifications only as supplied), Hospital for each operating location on `/locations/`, BreadcrumbList, FAQPage where there are FAQs, BlogPosting on articles |
| Share tags | Open Graph and Twitter card on every page; default share image 1800 x 1200 |

## 7. Dashboard verification

| Check | Result |
|---|---|
| `tsc --noEmit` | PASS, clean |
| Build without `DATABASE_URL` | PASS, built from the committed JSON |
| Build with `DATABASE_URL` (migrate, pull, build) | PASS |
| Fresh database: migrate, seed, pull, JSON diff against the originals | PASS, 25 files, 0 differences |
| Build from files vs build from the database | PASS, identical HTML on all 24 outputs (21 pages, 404, robots.txt, sitemap.xml) |
| Build with the database stopped | PASS, migrations and pull skipped with a warning, identical HTML |
| Approved `index.html` vs rendered sections (`npm run test:render`) | PASS, 14 of 14 approved pages identical |
| Pixel diff at 1280 and 390 against the approved site (14 pages, 28 comparisons) | 26 identical; 2 differ only in the Locations map sea colour (decision 11). `audit/pixel-diff/` |
| Wording check (`npm run qa:banned`) | PASS, 0 failures; 31 AHPRA flags for review (decision 9). `audit/wording-check.json` |
| Secret scan | PASS, no keys, tokens, passwords or connection strings in the repo; `.env.local` and `media/` excluded |

Browser drive of every dashboard function, including the visual page editor (`_tools/tests/dashboard_e2e.py`, 29 of 29 passed; screenshots in `audit/screenshots/dashboard/`):

| Check | Result |
|---|---|
| Sign in as admin (GYA) | PASS |
| Dashboard home: sidebar order, publish button | PASS |
| Import missing content (loads the 2 migrated blog articles) | PASS |
| Visual editor: click the heading on the page, type, save | PASS |
| Reorder sections by drag handle (keyboard) and save | PASS |
| Hide and show a section | PASS |
| Preview shows unsaved and saved changes in a new tab | PASS |
| SEO fields with Google preview, saved | PASS |
| Media Library: upload a photo with alt text | PASS |
| Media Library: replace a photo everywhere | PASS |
| Visual editor: click a photo on the page, choose from the library, save | PASS |
| Visual editor: click a button, Change link, save | PASS |
| Visual editor: editing wording next to the phone number keeps it linked to Site Settings | PASS |
| Visual editor: desktop and mobile views | PASS |
| Visual editor: header and footer edited on their own screen | PASS |
| Team: give Taylor a library photo, open a surgeon bio | PASS |
| Team: hide and show a team member | PASS |
| Site Settings: change a hospital note and the GA4 ID | PASS |
| Blog: write and publish an article (AHPRA reminder shown) | PASS |
| Redirects: see the migrated list, add one | PASS |
| Publish website calls the deploy hook | PASS |
| Contact us form sends and confirms | PASS |
| Online doctor referral form (with attachment) sends and confirms | PASS |
| Patient information form sends and confirms | PASS |
| Feedback form sends and confirms | PASS |
| Required fields block an empty form | PASS |
| Spam: honeypot submission is accepted silently and not stored | PASS |
| Enquiries: all four forms logged with date and page, CSV export, no medical details stored | PASS |
| Editor role: no Users, Redirects or tracking IDs | PASS |

## 8. Go-live checklist

| Item | Status |
|---|---|
| Environment variables documented in `.env.example` and `README-CMS.md`, `NEXT_PUBLIC_SERVER_URL=https://sunshinecoastofis.com.au` | Ready |
| Vercel builds the new version as Next.js | Ready: `vercel.json` sets the framework and build commands per deployment, so `main` keeps building the static site until promote. Node comes from `package.json` (20.9 or later). Check no Output Directory override is on in Vercel |
| Neon, Blob, `PAYLOAD_SECRET`, `PUBLISH_HOOK_URL` set in Vercel | **Not ready**: set during the `cms` rollout (README-CMS.md) |
| First admin account, Import, editor accounts for the practice | **Not ready**: after the preview builds |
| `www` and non-www both resolve, `www` 301s to non-www | Ready in the code; add both domains in Vercel and set `www` to redirect |
| HTTP to HTTPS | Ready: Vercel issues the certificate and redirects HTTP to HTTPS automatically once the domain is attached. Check after cutover |
| Production robots.txt allows indexing and lists the sitemap | Ready (host driven, nothing to switch) |
| GA4 and Search Console verification in the production build | **Not ready**: IDs needed (decision 8) |
| Favicon and share image | Ready: SVG, ICO and Apple touch icons; homepage share image `https://sunshinecoastofis.com.au/images/reception2.jpg` (1800 x 1200) with title and description |
| Form email to the practice | **Not ready**: `FORM_TO`, SMTP2GO domain (decision 7) |
| Decisions 1 to 12 | Waiting on Rowayne and the practice |

## 9. Notes for the SEO team

- After cutover, submit `https://sunshinecoastofis.com.au/sitemap.xml` in Search Console and remove the old Yoast sitemaps if they are listed (they now redirect to the new one).
- Use URL Inspection on the homepage and the seven service pages to request indexing.
- Monitor Pages (coverage) and 404s for two weeks. Every URL in the live sitemaps and links is covered; anything new that shows up can be added in the dashboard under Redirects without a developer.
- Old image addresses (`/wp-content/uploads/...`) will 404, which is normal; Google Images will pick up the new image addresses.
- Check the Google Business Profile website link points to `https://sunshinecoastofis.com.au/` and the phone is (07) 5406 0586.
- The five hospital pages now redirect to `/locations/` (decision 3). Expect those URLs to drop out of the index over a few weeks.
- Re-run PageSpeed Insights on the five audit pages after go-live (section 4).
