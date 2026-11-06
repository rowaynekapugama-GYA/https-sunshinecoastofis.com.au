# Google Ads landing pages (/lp)

Two landing pages built by Rowayne (GYA) for paid search, added to the site in 3.6.0:

| Live address | File | Ad group |
|---|---|---|
| https://sunshinecoastofis.com.au/lp/dental-implants | `public/lp/dental-implants.html` | Dental implants, All-on-4, full arch |
| https://sunshinecoastofis.com.au/lp/wisdom-teeth | `public/lp/wisdom-teeth.html` | Wisdom teeth removal |

They are plain HTML files, not CMS pages: edit them in the code, not the dashboard. They share
`public/lp/assets/site.css` and `public/lp/assets/site.js`; the renders and logo are in `public/lp/images`,
and the practice photos come from the site's own `/images`.

## How they are served

- `next.config.mjs` rewrites `/lp/dental-implants` and `/lp/wisdom-teeth` to the `.html` files.
- `middleware.ts` gives `/lp/...` no trailing slash (every other public page has one), so the ads'
  final URLs answer 200 with no redirect. `/lp/dental-implants/` redirects to the address without
  the slash, query string (gclid, utm_*) kept.
- Cache: `/lp/assets/*` one week (must-revalidate; bump the `?v=` in both pages after a change),
  `/lp/images/*` 30 days.
- Search: both pages have `<meta name="robots" content="noindex, follow">`. They are not in
  `sitemap.xml` and not blocked in `robots.txt` (Google Ads needs to crawl them).
- Links to them: only the two small links at the end of the footer's bottom row
  (`content/templates/sections.json`, style in `public/assets/site.css`, `footer .bottom .quiet`).

## Form

The form posts JSON to `POST /api/lp-lead` (`app/api/lp-lead/route.ts`), which sends the lead to
SmileOX through `lib/crm/intake.ts`, the same path and environment variables as the site's own
forms (see `README_CRM.md`). Payload: `firstName`, `lastName`, `email`, `phoneNumber` (+61),
`enquiryType`, `hasReferral`, `anaesthetic` (wisdom teeth page), `message`, `source`, `pageType`,
`pageUrl`, `gclid`, `utmSource`, `utmMedium`, `utmCampaign`, `utmTerm`, `utmContent`, `submittedAt`.
Empty fields are dropped. `NOTIFY_TO`, if set, gets a plain-English copy. Each lead is also recorded
in the dashboard's Enquiries.

## Tracking

GTM-TZ7DJSC2, Google's standard snippet (it pushes the `gtm.js` start event, so All Pages triggers
fire) plus the noscript iframe. `site.js` pushes `call_click`, `enquiry_click`, `form_start` and
`generate_lead` (after the server confirms), each with `page_type`.
