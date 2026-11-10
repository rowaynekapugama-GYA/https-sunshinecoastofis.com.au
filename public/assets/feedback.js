/*
 * /feedback/ : patient star rating (3.7.0). Loaded only on this page.
 *
 *   1 to 4 stars  the feedback form appears (no reload). It posts to /api/submit like every
 *                 other form on the site, and is emailed to reception (lib/forms/recipients.ts).
 *   5 stars       a thank-you and a "Leave a Google review" button, then the same tab goes to
 *                 Google after about 2 seconds (only when the star was tapped or clicked, or came
 *                 from a ?rating=5 link; a keyboard user arrowing past 5 is never sent away).
 *
 * The Google review address is the page's "Google review button" field in the dashboard
 * (Pages > Feedback), rendered into data-google on #fbFlow. It is the only copy on this page.
 * Deep links: /feedback/?rating=1 to 5 preselects a rating.
 * GTM dataLayer events: feedback_rating_selected {rating}, feedback_submitted {rating}, google_review_click.
 * No names, emails, phone numbers or feedback text are ever sent to Google.
 */

/* Show a small "You're also welcome to leave a review on Google" link under the form for
   1 to 4 star ratings. Keep this true: Google's review policy doesn't allow offering the
   review link only to happy patients. */
var SHOW_GOOGLE_LINK_ON_LOW_RATING = true;
/* How long the 5-star thank-you shows before the page goes to Google. */
var GOOGLE_REDIRECT_DELAY_MS = 2000;

(function () {
  'use strict';
  var flow = document.getElementById('fbFlow');
  if (!flow) return;

  var GOOGLE_REVIEW_URL = flow.getAttribute('data-google') || '';
  var radios = Array.prototype.slice.call(flow.querySelectorAll('input[name="fb_rating"]'));
  var stars = Array.prototype.slice.call(flow.querySelectorAll('.fb-star'));
  var low = document.getElementById('fbLow');
  var top = document.getElementById('fbTop');
  var live = document.getElementById('fbLive');
  var form = document.getElementById('feedbackForm');
  var hidden = form ? form.querySelector('input[name="rating"]') : null;
  var googleAlt = flow.querySelector('[data-fb-google-alt]');
  var redirectNote = flow.querySelector('[data-fb-redirect]');
  var timer = null;
  var pointerAt = 0;
  var current = 0;

  window.dataLayer = window.dataLayer || [];
  function track(event, extra) {
    var o = { event: event };
    if (extra) for (var k in extra) o[k] = extra[k];
    window.dataLayer.push(o);
  }

  if (googleAlt) googleAlt.hidden = !SHOW_GOOGLE_LINK_ON_LOW_RATING;

  /* ---- star fill: hover and focus preview, otherwise the chosen rating */
  function paint(n) {
    stars.forEach(function (s, i) { s.classList.toggle('on', i < n); });
  }
  stars.forEach(function (s, i) {
    s.addEventListener('mouseenter', function () { paint(i + 1); });
    s.addEventListener('mouseleave', function () { paint(current); });
    s.addEventListener('pointerdown', function () { pointerAt = Date.now(); });
    s.addEventListener('mousedown', function () { pointerAt = Date.now(); });
    s.addEventListener('touchstart', function () { pointerAt = Date.now(); }, { passive: true });
  });
  radios.forEach(function (r) {
    r.addEventListener('focus', function () { paint(Number(r.value) || current); });
    r.addEventListener('blur', function () { paint(current); });
    r.addEventListener('change', function () {
      choose(Number(r.value), Date.now() - pointerAt < 1500);
    });
  });

  function cancelRedirect() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (redirectNote) redirectNote.hidden = true;
  }

  /* Same tab, so the Google review sheet opens properly on phones. The event is sent first;
     GTM gets up to 0.8 seconds before the page moves on. */
  function goToGoogle() {
    if (!GOOGLE_REVIEW_URL) return;
    var gone = false;
    var go = function () { if (!gone) { gone = true; window.location.href = GOOGLE_REVIEW_URL; } };
    window.dataLayer.push({ event: 'google_review_click', eventCallback: go, eventTimeout: 800 });
    setTimeout(go, 800);
  }

  function say(text) {
    if (!live) return;
    live.textContent = '';
    setTimeout(function () { live.textContent = text; }, 50);
  }

  function choose(n, autoRedirect) {
    if (!(n >= 1 && n <= 5)) return;
    current = n;
    paint(n);
    cancelRedirect();
    track('feedback_rating_selected', { rating: n });
    flow.setAttribute('data-rating', String(n));
    if (n <= 4) {
      if (hidden) hidden.value = String(n);
      Array.prototype.forEach.call(flow.querySelectorAll('[data-fb-rating]'), function (el) { el.textContent = String(n); });
      top.hidden = true;
      low.hidden = false;
      say('You rated us ' + n + ' out of 5. A feedback form has appeared below the stars.');
      if (autoRedirect) reveal(low);
    } else {
      low.hidden = true;
      top.hidden = false;
      if (autoRedirect && GOOGLE_REVIEW_URL) {
        if (redirectNote) redirectNote.hidden = false;
        say('Thank you for rating us 5 out of 5. Taking you to Google to leave a review.');
        timer = setTimeout(goToGoogle, GOOGLE_REDIRECT_DELAY_MS);
      } else {
        say('Thank you for rating us 5 out of 5. The Leave a Google review button is below the stars.');
      }
      if (autoRedirect) reveal(top);
    }
  }

  /* On a phone the next step is below the fold: bring it into view without stealing focus. */
  function reveal(el) {
    if (!el || !el.scrollIntoView) return;
    var r = el.getBoundingClientRect();
    if (r.top > window.innerHeight * 0.75) {
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }

  /* "Change rating": stop any redirect and put the keyboard back on the stars. */
  Array.prototype.forEach.call(flow.querySelectorAll('.fb-change'), function (b) {
    b.addEventListener('click', function () {
      cancelRedirect();
      var target = radios[(current || 1) - 1] || radios[0];
      var rate = flow.querySelector('.fb-rate');
      if (rate && rate.scrollIntoView) rate.scrollIntoView({ block: 'center' });
      if (target) target.focus();
      say('Choose a new rating from 1 to 5 stars.');
    });
  });

  /* Google links (5-star button and the low-rating text link): same tab, tracked. */
  Array.prototype.forEach.call(flow.querySelectorAll('[data-fb-google]'), function (a) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) { track('google_review_click'); return; }
      e.preventDefault();
      cancelRedirect();
      goToGoogle();
    });
  });

  /* After the form is sent: lock the rating and record the conversion (rating only). */
  if (form) {
    form.addEventListener('formsent', function () {
      cancelRedirect();
      flow.classList.add('is-sent');
      track('feedback_submitted', { rating: current });
      say('Thank you for your feedback. It has been sent to our practice.');
      // The stars above are now hidden, so bring the thank-you back into view.
      var ok = form.querySelector('.ok');
      if (ok) {
        if (ok.scrollIntoView) ok.scrollIntoView({ block: 'center' });
        try { ok.focus({ preventScroll: true }); } catch (x) { ok.focus(); }
      }
    });
  }

  /* Deep link: /feedback/?rating=3 */
  var m = /[?&]rating=([1-5])(?:&|$)/.exec(window.location.search);
  if (m) {
    var n = Number(m[1]);
    radios[n - 1].checked = true;
    choose(n, true);
  }
})();
