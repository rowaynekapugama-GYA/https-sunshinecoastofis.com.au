# Sunshine Coast OFIS: website and dashboard (for GYA)

This repo is the Sunshine Coast Oral, Facial & Implant Specialists website with its client dashboard. It replaces the single `index.html` version (hash routing, `api/submit.js`) with real page addresses that match the WordPress site, plus a dashboard at `/admin`.

The practice's guide to the dashboard is `docs/HOW-TO-UPDATE.md`. The go-live audit is `GO-LIVE-AUDIT.md`. The SEO migration files are in `seo-migration/`.

## How it works

```
 practice edits in /admin  ->  Neon Postgres (Payload CMS)
                                     |
          "Publish website"  ->  Vercel deploy hook  ->  npm run build
                                                            1. payload migrate
                                                            2. scripts/pull-content.ts  (database -> content/*.json)
                                                            3. next build               (every public page pre-rendered)
```

- **Public pages** are plain HTML, rendered at build time from the approved design. Each page is a list of sections; every section is an approved HTML template (`content/templates/sections.json`) filled with the values the practice can edit (`content/pages/*.json`). The templates were taken from the approved `index.html` unchanged; `npm run test:render` proves the output matches it character for character.
- **The site never needs the database to serve a page.** If `DATABASE_URL` is missing or Neon is down at build time, the build uses the JSON committed in `content/` and still succeeds.
- **Dashboard:** `/admin` is the practice's dashboard (WordPress-style, SCOFIS logo and colours). Pages open in a visual editor: the real page in an iframe (`POST /edit-preview/` with `mode=edit`, signed-in users only), where text is edited in place and photos and links are changed by clicking them. `lib/render.ts` `markEditable` adds the `data-edit` marks and `public/assets/page-edit.js` does the in-page part; neither is ever in the public pages. `/cms` is Payload's own admin screen, GYA only (admin role).
- **Forms** (Contact us, Online doctor referral, Patient information form, Feedback) post to `/api/submit`, which emails through SMTP2GO and logs the enquiry in the dashboard. The referral email matches the old WordPress email (the 7 Oct 2026 rebuild, not pushed before this version; `npm run test:email`).

### Dashboard sidebar

Dashboard, Pages, Blog Posts, Media Library, Team, Enquiries, SEO, Site Settings, Redirects, Users.

| Role | Can do | Cannot see |
|---|---|---|
| Editor (practice staff) | Pages, Blog Posts, Media Library, Team, Enquiries, SEO, Site Settings (Practice, Opening hours, Locations, Brand), Publish website | Users, Redirects, tracking IDs (GA4, GTM, Meta Pixel, Search Console), `/cms` |
| Admin (GYA) | Everything, plus "Import missing content" on the Dashboard | |

## Environment variables

Set in Vercel > Project > Settings > Environment Variables (Production, and Preview if previews should have a working dashboard). `.env.example` has the same list with no values.

| Variable | Required | What it is | Where it comes from |
|---|---|---|---|
| `DATABASE_URL` | Yes, for the dashboard | Neon Postgres connection string (pooled) | Vercel > Storage > Neon (adds it automatically), or neon.tech > Connection details |
| `BLOB_READ_WRITE_TOKEN` | Yes, for photo uploads | Vercel Blob token for the Media Library | Vercel > Storage > Blob (adds it automatically) |
| `PAYLOAD_SECRET` | Yes | Long random string that signs dashboard sessions | `openssl rand -hex 32`. Keep it the same once set, or everyone is signed out |
| `PUBLISH_HOOK_URL` | Yes | Vercel deploy hook for the production branch, fired by "Publish website" | Vercel > Settings > Git > Deploy Hooks (branch `main`) |
| `NEXT_PUBLIC_SERVER_URL` | Yes | Full site address, no trailing slash. Production: `https://sunshinecoastofis.com.au` | Type it in |
| `SMTP2GO_API_KEY` | Yes, for form emails | Already set on the current Vercel project for the old `api/submit.js`. Keep it | SMTP2GO > Sending > API Keys |
| `FORM_TO` | Recommended | Form email recipients, comma separated. Empty means GYA's test inboxes | The practice: reception@sunshinecoastofis.com.au is the address on the live site (to confirm) |
| `FORM_FROM` | Recommended | Sender on an SMTP2GO verified domain | `Sunshine Coast OFIS Website <noreply@sunshinecoastofis.com.au>` once that domain is verified in SMTP2GO |
| `ALLOW_FIRST_USER` | One-off | `true` only while creating the first account at `/cms` on an empty database | Delete straight after |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | One-off | Sign-in rescue: typing these on `/admin` creates or resets that account as admin | Delete `ADMIN_PASSWORD` and redeploy once signed in |
| `EXTRA_LIVE_HOSTS` | Never on Vercel | Local testing only (treat `localhost` as the live site for Lighthouse) | |

Tracking IDs (GA4, Google Tag Manager, Meta Pixel, Search Console verification) are **not** environment variables. They are entered by an admin in the dashboard under Site Settings > Tracking and links, and written into every page at the next publish.

Credentials always come from the client or from GYA's own accounts. None are in this repo.

## Neon and Blob setup (one time)

1. Vercel > the SCOFIS project > **Storage** > Create > **Neon** (Postgres). Region: Sydney (`syd1`) if offered. Connect it to Production and Preview. This adds `DATABASE_URL`.
2. Vercel > Storage > Create > **Blob**. Connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`.
3. `vercel.json` runs the server functions in Sydney (`syd1`), next to the database. Keep Neon in Sydney too; if they are in different regions every dashboard click is slow.
4. Add `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL` and (after step 4 of the rollout) `PUBLISH_HOOK_URL`.

The first build with `DATABASE_URL` set creates the tables (`payload migrate`). Nothing else is needed.

## Rollout on the `cms` branch

The live site keeps running from `main` until the new version has been checked on a preview.

1. **Vercel project settings first.** The current project is set up as a static site. This version's `vercel.json` tells Vercel it is Next.js (framework, install and build commands) for every deployment made from it, so the Framework Preset in the dashboard does **not** need changing, and `main` keeps building the old static site until it is promoted. The Node version comes from `engines` in `package.json` (20.9 or later).
   - Check in Settings > Build and Deployment that Root Directory is empty and Output Directory has no override switched on. If an Output Directory override is on (for example `.` from the static site), switch it off at promote time.
   - Storage and environment variables below must be in place before the first `cms` build.
2. **Stage:** put this version on a `cms` branch (`bash scripts/push-to-github.sh stage <zip>` does it from a fresh clone and asks before pushing). Vercel builds a preview.
3. **First login on the preview** (empty database):
   - Easiest: set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (Preview), redeploy the preview, sign in at `<preview>/admin` with them, then delete `ADMIN_PASSWORD` and redeploy.
   - Or: set `ALLOW_FIRST_USER=true`, create the account at `<preview>/cms`, then delete the variable and redeploy.
   - Or from a terminal with the Neon `DATABASE_URL` and `PAYLOAD_SECRET` set: `npx tsx scripts/create-user.ts <email> <password> admin "<name>"` (password 10 characters or more; it is not stored anywhere else).
4. **Import:** on `/admin`, Dashboard > **Import missing content**. This loads every page, the team, site settings, the two blog articles and the 15 redirects from `content/` into the dashboard. It only adds what is missing, so it is safe to run again.
5. **Deploy hook:** create the hook for `main` (Settings > Git > Deploy Hooks) and add it as `PUBLISH_HOOK_URL`.
   - **For testing on staging:** also create a hook for branch `cms` and set it as `PUBLISH_HOOK_URL` for the **Preview** environment only (Production keeps the `main` hook). Then "Publish website" on the staging dashboard rebuilds the staging site, and the dashboard's View links (which always open the copy of the site the dashboard is on) show the change.
6. **Practice accounts:** Users > Add, role **Editor**, one per staff member. Send them `docs/HOW-TO-UPDATE.md`.
7. **Check the preview** against `GO-LIVE-AUDIT.md` (forms send to the right inbox, `/api/submit` in a browser shows the SMTP2GO setup).
8. **Promote:** `bash scripts/push-to-github.sh promote` fast-forwards `main` to the checked `cms` commit. Rollback: `bash scripts/push-to-github.sh rollback`.
9. **Domain cutover:** point `sunshinecoastofis.com.au` and `www` at this Vercel project. In Vercel > Domains, set `www.sunshinecoastofis.com.au` to redirect (301) to `sunshinecoastofis.com.au`. The site also does this itself in `middleware.ts`, so either way it is one hop.

`robots.txt` and the `noindex` header are driven by the request host: only `sunshinecoastofis.com.au` (and `www`) is indexable. The `vercel.app` addresses and previews are always `noindex` and blocked in `robots.txt`, so nothing needs switching at go-live.

## Day to day (GYA)

| Task | How |
|---|---|
| Content change for the practice | Usually they do it in `/admin`. GYA can too |
| Code or design change | Edit the repo, `npm run build`, check, push to `cms`, promote |
| Developer change to page content in the repo | Edit `content/*.json`, then on `/admin` Import (adds missing) or `npm run seed -- --reset` (replaces dashboard content with the files) |
| See what the dashboard holds | `npm run pull:content` with `DATABASE_URL` set (writes `content/`) |

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local site and dashboard on port 3000 |
| `npm run build` | Migrate, pull, build (the Vercel build) |
| `npm run typecheck` | TypeScript check |
| `npm run test:render` | Approved `index.html` vs rendered sections (must be 0 different) |
| `npm run test:email` | Referral email matches the old WordPress email |
| `npm run qa:banned` | Wording check on the served pages (needs `npm start` running) |
| `npm run seed` / `npm run seed -- --reset` | Load `content/` into the dashboard (add missing / replace) |
| `python3 _tools/seo_migration.py http://localhost:3000` | Rebuild the `seo-migration/` reports against a running build |
| `python3 _tools/tests/pixel_diff.py <approved> <new> <out>` | Pixel diff against the approved single page |
| `bash _tools/tests/lighthouse.sh` | Lighthouse on the five audit pages |

## Redirects

Two groups, both single-hop 301s:

1. **Old pages with no exact match** (15): `content/redirects.json`, editable by admins in the dashboard under Redirects. Read at build time by `next.config.mjs`.
2. **WordPress patterns** (feeds, category, tag and author archives, `/blog/page/2/`, dated URLs, Yoast and core sitemaps, `wp-admin`, `wp-login.php`): the `WORDPRESS` list in `next.config.mjs`. `?p=` and `?page_id=` links, trailing slashes and `www` are handled in `middleware.ts`.

See `seo-migration/url-parity.csv` for every live URL and where it lands.

## Conflicts between the site and the client brief

These are the places where the approved site, the brief or the live site disagree. Each needs a decision from Rowayne or the practice; none was changed on our own.

1. **Hospital pages.** The live site has five hospital pages (`/buderim-private-hospital/`, `/sunshine-coast-day-surgery/`, `/noosa-private-hospital/`, `/nambour-selangor-private-hospital/`, `/hervey-bay-st-stephens-private-hospital/`). The approved design has no hospital pages, only `/locations/`, so all five 301 to `/locations/`. The brief asks to keep the Noosa URL; there is no Noosa page in the approved design to keep, and Noosa Private Hospital is not in the approved location list. If the hospital pages should stay, they need to be designed and approved first.
2. **Noosa in the Locations meta description.** The live description lists Noosa; it was removed because Noosa is not on the approved site. Everything else on the Locations page metadata is the live wording.
3. **Patient information form wording.** The consent, fee policy and AI note text on the form are a summary written for the build, not the practice's own wording. The consent includes using clinical photos "in advertising", which needs a careful AHPRA read. A typed name plus a tick box stands in for a signature. Medical details are emailed but not stored in the dashboard.
4. **Feedback form.** The live feedback page sent happy patients to Google and unhappy ones to a private form (review gating). The new form is a plain feedback form for everyone.
5. **Privacy policy and Disclaimer.** The live Privacy Policy page said "Coming Soon". The new one is draft wording for the practice to approve. The Disclaimer uses the approved footer wording plus a few added lines.
6. **AHPRA wording on approved and migrated content** (listed, not changed): "expert care" in Dr Lincoln's bio (About and the bio panel), "trained with leading surgeons" (All-on-4 and Zygomatic pages), the blog index meta description ("expert information", the live wording), and in the two migrated blog posts: "highly experienced", "permanent", "revolutionised", "cutting-edge", "perfect", and "Royal Australian College" (should be "Royal Australasian College"). The homepage shows the Google rating and review count (317) with links to Google, not testimonial quotes; the count is typed in and will go out of date.
7. **Header between 821 and 1139 px wide** (iPad landscape, small laptops, phones turned sideways): the approved header does not fit, so at 1024 px the logo shrinks to about 11 px and at 844 x 390 the page scrolls sideways; on 375 px phones the logo is squeezed. A tested fix is ready in `_tools/proposed-fixes/header-fit.css` but changes the approved look at those widths, so it has not been applied.
8. **Locations map sea colour.** On the approved single page the map on Locations showed no sea colour, because two maps on the one page shared an SVG id. With real pages the Locations map now shows the sea exactly like the approved homepage map. Say if it should be pale as on the preview.
9. **Colour contrast.** White on the brand cyan buttons (2.5:1) and the small cyan-deep text (3.4 to 3.8:1) are below WCAG AA (4.5:1). This is the approved palette; changing it needs design sign-off.
10. **Tap targets and heading order.** 58 links and labels are under 44 x 44 px on phones (footer links, social icons, form option labels) and three pages go from h1 to h3. Both are in the approved markup and are listed in `GO-LIVE-AUDIT.md`.

## Files

| Path | What |
|---|---|
| `app/(frontend)/` | Public site route handlers (pages, `robots.txt`, `sitemap.xml`, dashboard preview) |
| `app/(dashboard)/admin/` | The `/admin` dashboard |
| `app/(payload)/` | Payload's `/cms` and API |
| `app/api/submit/` | Form handler (SMTP2GO, Enquiries) |
| `cms/` | Payload collections, globals, sync between the dashboard and `content/` |
| `content/` | The content the site is built from (written by the build from the dashboard) |
| `dashboard/` | Dashboard editors and UI |
| `lib/` | Rendering, head tags and schema, forms |
| `public/` | Images, the referral PDF, `assets/site.css` (approved CSS) and `assets/site.js` |
| `seo-migration/` | Live inventory, URL parity, redirects, metadata diff |
| `audit/` | Screenshots, Lighthouse, pixel diff and audit data |
| `_tools/` | Extraction tools, the approved source and the test scripts |
