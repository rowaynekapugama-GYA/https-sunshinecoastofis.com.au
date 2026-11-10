# /feedback/ (patient star rating)

The link the practice sends patients after a procedure: https://sunshinecoastofis.com.au/feedback/

| Rating | What happens |
|---|---|
| 1 to 4 stars | The feedback form appears. It is emailed to reception@sunshinecoastofis.com.au (`lib/forms/recipients.ts`) through `/api/submit` and SMTP2GO, subject `Patient feedback – {rating}/5 – {name}`, reply-to the patient. A small "You're also welcome to leave a review on Google" link sits under it. |
| 5 stars | A thank-you and a Leave a Google review button. The same tab goes to Google after about 2 seconds when the star was tapped or clicked. |

- **Settings** at the top of `public/assets/feedback.js`:
  - `SHOW_GOOGLE_LINK_ON_LOW_RATING` (default `true`; keep it on, because Google's review policy doesn't allow offering the review link only to happy patients)
  - `GOOGLE_REDIRECT_DELAY_MS` (2000)
- **Wording and Google link:** Dashboard > Pages > Feedback, "Star rating and feedback form" section. The Google review address is the "Google review button" field, the only copy of it on this page.
- **Deep links:** `/feedback/?rating=N` (1 to 5) preselects a rating, for clickable stars in an email or SMS. `?rating=5` thanks the patient and goes straight on to Google.
- **GTM** (GTM-TZ7DJSC2): `feedback_rating_selected` {rating}, `feedback_submitted` {rating}, `google_review_click`.
- **Search:** noindex, follow; not in the sitemap; canonical /feedback/.
- **Redirects** to /feedback/: /review, /reviews, /leave-a-review, /rate-us, /patient-feedback (`next.config.mjs`); /feedback (middleware).
- **Spam:** the hidden box, the 2.5-second fill timer, server checks, and at most 5 messages per connection every 10 minutes.
