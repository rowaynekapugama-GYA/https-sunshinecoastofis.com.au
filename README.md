# Sunshine Coast Oral, Facial & Implant Specialists

Website for sunshinecoastofis.com.au, with the practice's dashboard at `/admin`.

- **GYA setup, environment variables, rollout and conflicts with the brief:** `README-CMS.md`
- **Guide for the practice:** `docs/HOW-TO-UPDATE.md`
- **Go-live audit and decisions:** `GO-LIVE-AUDIT.md`
- **SEO migration reports:** `seo-migration/`
- **What changed:** `CHANGELOG.md`

## Quick start (local)

```bash
npm install
cp .env.example .env.local      # fill in PAYLOAD_SECRET; DATABASE_URL only if you want the dashboard
npm run dev                     # http://localhost:3000 (site) and http://localhost:3000/admin (dashboard)
```

Without `DATABASE_URL` the site runs from the JSON in `content/` and the dashboard is unavailable.

## Before handing over a change

```bash
npm run typecheck
npm run test:render     # approved design unchanged
npm run test:email      # referral email unchanged
npm run build && npm start
npm run qa:banned       # in a second terminal
```

## Forms

All four forms post to `/api/submit` (SMTP2GO). Open `/api/submit` in a browser to check the email setup without sending anything. Variables: `SMTP2GO_API_KEY`, `FORM_TO`, `FORM_FROM` (see `README-CMS.md`).
