# Website forms → SmileOX CRM

> **3.6.1 (9 Nov 2026): SmileOX now receives ONLY the two Google Ads landing pages** (`/lp/dental-implants`, `/lp/wisdom-teeth`, through `/api/lp-lead`). The website's own forms (Online doctor referral, Patient information form, Contact us, Feedback) are no longer sent, `lib/crm/forms.ts` and `/api/lead` were removed, and `sendLeadToCrm` refuses any form not in `CRM_FORMS` (`lib/crm/intake.ts`). Form email recipients are in `lib/forms/recipients.ts`; `FORM_TO`, `FORM_CC`, `FORM_BCC` and `NOTIFY_TO` are no longer read. Sections below that describe the website forms or `/api/lead` sending to SmileOX are kept as history of 3.5.0.

Version 3.5.0, 6 November 2026. Every enquiry form on sunshinecoastofis.com.au now creates (or updates) a lead in the practice's SmileOX pipeline. The clinic's notification emails and the dashboard's Enquiries records are unchanged.

## How it works

SmileOX creates a lead from any email sent to the practice's intake address, where the body is the lead as JSON:

- **To:** `contact-submissions+50d8ee08-b736-4740-a84b-ae94788ca250@intake.smileox.com.au`
- **Subject:** `Website form submission`
- **Body:** `JSON.stringify(lead)`, sent as plain text (`Content-Type: text/plain`)
- **Matching:** a lead with the same email *and* phone number as an existing lead updates that lead instead of creating a duplicate.

```
visitor submits a form ─► POST /api/submit (unchanged for the visitor)
                              ├─ email to the clinic (SMTP2GO), as before
                              ├─ "Thank you" shown to the visitor
                              └─ after the answer: dashboard record, and the lead to SmileOX (retried if needed)
```

The lead is sent **after** the visitor has their answer, so the CRM can never slow down or break a form.

## What each form sends

| Form | Sent to the CRM | Never sent |
|---|---|---|
| Contact us | `firstName`, `lastName`, `email`, `phoneNumber`, `service` (topic), `hasReferral`, `message` | – |
| Online doctor referral | The **patient** as the lead: `firstName`, `lastName`, `email`, `phoneNumber`, `newOrExistingPatient` ("New patient (referred)"), `referringDoctor`, `referringPracticePhone`, `referringDoctorEmail`, `preferredSurgeon`, `urgent`, `referralDate` | Date of birth, address, reason for referral, implant brand, medical history, x-rays, comments, attachments, provider number, practice address |
| Patient information form | `firstName`, `lastName`, `email`, `phoneNumber` (mobile, or landline if no mobile), `newOrExistingPatient` ("Booked patient (patient information form)") | Date of birth, Medicare, health fund, next of kin, medical history, medications, allergies, measurements, consents |
| Feedback | Nothing (not an enquiry) | – |
| `POST /api/lead` (new, for other forms) | `firstName`, `lastName`, `email`, `phoneNumber` and the form's other fields | `action`, `targetStatusId` (never accepted from a browser) |

Every lead also carries `formName`, `pageUrl` (without its query string), `submittedAt` (ISO, Australia/Brisbane, e.g. `2026-11-06T09:44:00+10:00`) and any `utm_*` tags. Campaign tags on the page a visitor lands on are remembered for the visit, so a form filled in on a later page still carries them. Empty fields are dropped.

Health information stays out of the CRM on purpose: the full details still go to the practice in the notification email, as before. To send another field, add it to the form's entry in `lib/crm/forms.ts`.

**Phone numbers** are sent in E.164: `0412 345 678` → `+61412345678`, `(07) 5406 0586` → `+61754060586`. A number that isn't a valid Australian number (an overseas mobile, for example) is sent as `phoneAsEntered` instead of `phoneNumber`. The built-in forms don't block on this, because they were working before and the clinic still gets the email. `/api/lead` does require a valid Australian number.

## Files

| File | What it does |
|---|---|
| `lib/crm/intake.ts` (new) | Phone and name handling, payload clean-up, sending with TLS and retries |
| `lib/crm/forms.ts` (new) | Which fields of each form are sent |
| `app/api/lead/route.ts` (new) | `POST /api/lead` for other forms |
| `app/api/lp-lead/route.ts` (3.6.0) | `POST /api/lp-lead` for the Google Ads landing pages in `public/lp` (see `docs/landing-pages.md`) |
| `app/api/submit/route.ts` | Sends the lead after the existing email (maximum run time 30 → 60 seconds for retries) |
| `public/assets/site.js` | Remembers `utm_*` tags for the visit and adds them to form submissions |
| `scripts/test-crm.ts` (new) | `npm run test:crm` |
| `package.json` | `nodemailer` (and `@types/nodemailer` for development) |
| `.env.example` | The new settings |

Nodemailer and the SMTP credentials are only used on the server. The build was checked: nothing about them is in the files sent to browsers.

## Settings (Vercel → Settings → Environment Variables)

| Variable | Needed | What it is |
|---|---|---|
| `SMTP_HOST` | Optional | SMTP server, e.g. `mail.smtp2go.com`, `smtp.postmarkapp.com`, `smtp.resend.com`, `smtp.sendgrid.net`, `smtp-relay.gmail.com` |
| `SMTP_PORT` | Optional | `465` (default, implicit TLS) or `587` (STARTTLS, then required). `8465` and `443` are also treated as implicit TLS |
| `SMTP_SECURE` | Optional | `true` or `false` to force implicit TLS on other ports |
| `SMTP_USER` | Optional | SMTP username |
| `SMTP_PASS` | Optional | SMTP password or API key (secret) |
| `MAIL_FROM` or `SMTP_FROM` | Optional | Sender over SMTP, on a domain verified with the provider, e.g. `no-reply@sunshinecoastofis.com.au`. `MAIL_FROM` wins if both are set. Empty: `FORM_FROM` |
| `LEAD_INTAKE` or `CRM_INTAKE_EMAIL` | Optional | The intake address. `LEAD_INTAKE` wins if both are set. Empty: the address above. `off` stops sending leads |
| `NOTIFY_TO` | Optional | Landing pages only: a plain-English copy of each landing page enquiry for reception |

The landing pages' handler (`/api/lp-lead`) and the site's own forms read the same variables, so there is one set to manage. `MAIL_FROM`, `LEAD_INTAKE` and `NOTIFY_TO` are the names Rowayne's landing page handler used.

**Without any SMTP settings, leads are sent through the SMTP2GO account the site already uses for the clinic's form emails (`SMTP2GO_API_KEY`).** That works the moment this is deployed. The SMTP settings are only needed to send through a different provider or account. The SMTP2GO fallback always sends from `FORM_FROM` (or the built-in default, `noreply@dentalspecialists.com.au`), the sender the clinic's emails already go out from; `MAIL_FROM`/`SMTP_FROM` are used only over SMTP, so a sender on an unverified domain can't stop leads going out.

## SMTP requirements

- **TLS.** With SMTP settings, the website only ever talks to the SMTP server over TLS 1.2 or later:
  - Port 465: implicit TLS.
  - Port 587: STARTTLS is required. A server that doesn't offer it is refused, so nothing is sent in the clear.

  The provider then delivers to SmileOX's mail server, using TLS when that server offers it (all the providers below do).
- **A verified sender domain** for `SMTP_FROM` (SPF and DKIM DNS records on the domain), or emails may be rejected as spam.
  - `sunshinecoastofis.com.au` is already verified in GYA's SMTP2GO account.
  - With another provider, the practice's DNS needs that provider's SPF/DKIM records.
- **Suggested providers:** SMTP2GO (already in use), Postmark, Resend, SendGrid, or Google Workspace SMTP relay.

## Errors, retries and logs

- **Retried up to 3 times** with backoff (0.5, 1.5 and 3.5 seconds): SMTP 4xx replies, timeouts, refused or reset connections, and SMTP2GO 429/5xx.
- **Not retried:** permanent errors such as a wrong password (535) or a rejected address (550).
- **Vercel logs** (Functions → `/api/submit` or `/api/lead`) show one line per lead with the form name and the outcome, for example `[crm] contact: lead sent via smtp2go-api` or `[crm] contact: lead NOT sent after 4 attempt(s): ...`. Names, emails, phone numbers and other details are never logged.
- A lead that can't be delivered is not lost to the practice: the clinic email and the dashboard record are separate and unaffected.

## Not done yet: lead status updates

SmileOX can change a lead's status when a payload includes `"action": "UPDATE_TARGET_STATUS"` and a `targetStatusId`. No status IDs were supplied, so this isn't used. The place for it is marked in `lib/crm/intake.ts` (`sendLeadToCrm`). `/api/lead` deliberately ignores these two fields if a browser sends them.

## How to test

- **Automated:**
  - `npm run test:crm`: phone and name handling, what each form sends and never sends, retries, the SMTP2GO fallback.
  - The 3.5.0 release was also tested against local TLS mail servers (implicit TLS, STARTTLS, no TLS, temporary failures, wrong password) and in a browser on every form. See the test checklist for the live checks.
- **By hand:** see the checklist in the release notes or the reply that came with this update.

## Privacy

Contact details from website enquiries now also go to SmileOX. The privacy policy (`/privacy-policy/`) should mention this. For example, under "Our website, analytics and cookies": "Contact details from our website enquiry forms are also sent to our patient enquiry system (SmileOX) so our team can follow up your enquiry." Also add SmileOX's data location under "Overseas disclosure" if it stores data outside Australia. This wording needs the practice's approval and was not changed in this update.
