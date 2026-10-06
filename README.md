# Sunshine Coast Oral, Facial & Implant Specialists

Static site. Deploy the folder as-is to Vercel. `index.html` is the whole site with hash routing; images live in `images/`, the referral PDF in `files/`.

## Forms

Both forms (Contact enquiry and Doctor referral) POST to `/api/submit`, a Vercel serverless function in `api/submit.js` that emails the submission via SMTP2GO, with any attached files as email attachments.

Set these in Vercel > Project > Settings > Environment Variables, then redeploy:

| Variable | Required | Value |
|---|---|---|
| `SMTP2GO_API_KEY` | yes | API key from SMTP2GO > Settings > API Keys |
| `FORM_TO` | no | Recipients, comma separated. Default `rowayne@gyaclients.com` |
| `FORM_FROM` | no | Sender. Default `noreply@sunshinecoastofis.com.au` (the domain must be verified in SMTP2GO) |

Until `SMTP2GO_API_KEY` is set, the form shows an error to the visitor and nothing is sent.

Attachments are capped at about 4 MB per submission (Vercel request limit). A hidden `website` field acts as a honeypot; submissions that fill it are silently dropped.

Google reCAPTCHA: add `data-recaptcha-sitekey="..."` to `<div id="referralCaptcha">` in `index.html` to swap the "I'm not a robot" tick box for the real widget.
