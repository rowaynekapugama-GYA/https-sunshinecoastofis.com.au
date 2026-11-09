/*
 * Sunshine Coast Oral, Facial & Implant Specialists: page behaviour.
 * The approved single-page script, minus the hash router (every page now has its own
 * address). Menu, mobile drawer, scroll reveal, location map, 3D tour and forms are
 * unchanged.
 */
(function () {
  // Old links from the single-page preview (/#/services/dental-implants) go to the real page.
  var ROUTES = {
    '': '/', 'our-practice': '/about/', 'services': '/services/',
    'services/wisdom-teeth-removal': '/services/wisdom-teeth-removal/',
    'services/dental-implants': '/services/dental-implants/',
    'services/all-on-4-dental-implants': '/services/all-on-4-dental-implants/',
    'services/zygomatic-implants': '/services/zygomatic-implants/',
    'services/jaw-bone-grafting': '/services/jaw-bone-grafting/',
    'services/orthognathic-surgery': '/services/orthognathic-corrective-jaw-surgery/',
    'services/facial-trauma': '/services/facial-trauma/',
    'patient-information': '/patient-information/', 'locations': '/locations/',
    'doctor-referral': '/online-doctor-referral/', 'contact': '/contact-us/'
  };
  if (/^#\//.test(location.hash)) {
    var parts = location.hash.replace(/^#\/?/, '').split('#');
    var to = ROUTES[parts[0].replace(/\/$/, '')];
    if (to) { location.replace(to + (parts[1] ? '#' + parts[1] : '')); return; }
  }

  var page = document.querySelector('[data-page].on');
  var drawer = document.getElementById('drawer');

  // Menu highlight for the current section of the site
  var nav = page ? (page.getAttribute('data-page') || '').split('--')[0] : '';
  document.querySelectorAll('[data-nav]').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-nav') === nav); });

  // Add the Matterport tour once the Contact page has loaded
  var tpl = document.getElementById('tourTpl'), box = document.getElementById('tourbox');
  if (tpl && box && !box.querySelector('iframe')) box.appendChild(tpl.content.cloneNode(true));

  // Scroll reveal
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: .08 }) : null;
  document.querySelectorAll('.rv:not(.in),.rv-stagger:not(.in)').forEach(function (el) { if (io) io.observe(el); else el.classList.add('in'); });

  // Locations map switcher
  function selectLoc(card) {
    var scope = card.closest('[data-page]');
    scope.querySelectorAll('.loc-list .loc').forEach(function (c) { c.classList.toggle('active', c === card); });
    var pin = card.getAttribute('data-pin');
    scope.querySelectorAll('.coast-map .pin').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-pin') === pin); });
    var d = scope.querySelector('#locdetail');
    if (d) {
      d.querySelector('#ld-area').textContent = card.querySelector('.area').textContent;
      d.querySelector('#ld-name').textContent = card.getAttribute('data-name');
      d.querySelector('#ld-addr').textContent = card.getAttribute('data-addr');
      d.querySelector('#ld-note').textContent = card.getAttribute('data-note');
      d.querySelector('#ld-link').href = card.getAttribute('data-link');
      var f = d.querySelector('#ld-map');
      var src = card.getAttribute('data-embed') || ('https://maps.google.com/maps?q=' + encodeURIComponent(card.getAttribute('data-q')) + '&z=15&output=embed');
      f.setAttribute('title', card.hasAttribute('data-embed') ? f.getAttribute('data-title-main') || f.title : 'Google Map showing ' + card.getAttribute('data-name') + ', ' + card.getAttribute('data-addr'));
      if (f.getAttribute('src') !== src) f.setAttribute('src', src);
    }
  }
  document.addEventListener('click', function (e) {
    var card = e.target.closest('.loc-list .loc');
    if (card && !e.target.closest('a')) { selectLoc(card); return; }
    var pin = e.target.closest('.coast-map .pin');
    if (pin) {
      var first = pin.closest('[data-page]').querySelector('.loc-list .loc[data-pin="' + pin.getAttribute('data-pin') + '"]');
      if (first) { selectLoc(first); first.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && (e.target.matches('.loc-list .loc') || e.target.matches('.coast-map .pin'))) { e.preventDefault(); e.target.click(); }
  });

  var cap = document.getElementById('referralCaptcha');
  if (cap && cap.getAttribute('data-recaptcha-sitekey')) {
    cap.innerHTML = '<div class="g-recaptcha" data-sitekey="' + cap.getAttribute('data-recaptcha-sitekey') + '"></div>';
    var sc = document.createElement('script'); sc.src = 'https://www.google.com/recaptcha/api.js'; sc.async = true; sc.defer = true; document.head.appendChild(sc);
  }
  var rd = document.querySelector('input[name="referral_date"]');
  if (rd && !rd.value) { var t = new Date(); rd.value = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); }
  document.querySelectorAll('.coast-map .pin[data-pin="1"]').forEach(function (p) { p.classList.add('active'); });

  // Mobile menu
  function closeDrawer() { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
  document.getElementById('burger').addEventListener('click', function () { drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; });
  document.getElementById('drawerClose').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer(); });
  // A drawer link to a part of the current page (e.g. /patient-information/#payment) closes the drawer
  drawer.addEventListener('click', function (e) { var a = e.target.closest('a[href]'); if (a && a.pathname === location.pathname && a.hash) closeDrawer(); });

  // Desktop dropdowns: one open at a time, close on outside click or Escape
  document.querySelectorAll('nav.menu .dd').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) document.querySelectorAll('nav.menu .dd[open]').forEach(function (o) { if (o !== d) o.removeAttribute('open'); });
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.dd')) document.querySelectorAll('.dd[open]').forEach(function (d) { d.removeAttribute('open'); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') document.querySelectorAll('.dd[open]').forEach(function (d) { d.removeAttribute('open'); var s = d.querySelector('summary'); if (s) s.focus(); });
  });
  // A dropdown link to a part of the current page closes the dropdown
  document.querySelectorAll('.dd .panel a[href]').forEach(function (a) {
    a.addEventListener('click', function () { var d = a.closest('.dd'); if (d) d.removeAttribute('open'); });
  });
})();

/*
 * Google Tag Manager conversion event, sent only after the server confirms the form was
 * received. It carries the event name and which form it was, and nothing else: no names,
 * dates of birth, Medicare numbers, medical details, emails or phone numbers ever go to Google.
 */
var FORM_EVENT_NAMES = { contactForm: 'contact', referralForm: 'referral', patientForm: 'patient_information' };
function formSuccessEvent(f) {
  var name = FORM_EVENT_NAMES[f.id]; if (!name) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'form_submit_success', form_name: name });
}

/* Forms: posted to /api/submit (emailed through SMTP2GO and saved in the dashboard under Enquiries). */
function fakeSubmit(e) {
  e.preventDefault();
  var f = e.target;
  if (f.hasAttribute('data-validate')) { if (!checkForm(f)) return false; }
  else if (!f.checkValidity()) { f.reportValidity(); return false; }
  if (f.querySelector('.g-recaptcha') && window.grecaptcha && !grecaptcha.getResponse()) { alert('Please confirm you are not a robot.'); return false; }
  var fd = new FormData(f); // includes file attachments, every checked checkbox value and radio selection
  var done = function () { f.classList.add('sent'); f.scrollIntoView({ block: 'center' }); };
  var endpoint = f.getAttribute('data-endpoint');
  if (!endpoint || location.protocol === 'file:') { done(); return false; }
  fd.append('form', f.id); fd.append('page', location.href); fd.append('started', f.getAttribute('data-started') || '');
  var btn = f.querySelector('button[type=submit]'); var label = btn.textContent; btn.disabled = true; btn.textContent = 'Sending...';
  var msg = f.querySelector('.senderr');
  if (!msg) { msg = document.createElement('p'); msg.className = 'fine senderr'; msg.style.color = '#B42318'; msg.setAttribute('role', 'alert'); btn.insertAdjacentElement('afterend', msg); }
  msg.textContent = '';
  // Never leave the visitor on "Sending..." (the server gives up at 30 seconds too).
  var ctrl = window.AbortController ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 35000) : null;
  fetch(endpoint, { method: 'POST', body: fd, signal: ctrl ? ctrl.signal : undefined })
    .then(function (r) { clearTimeout(timer); return r.json().catch(function () { return {}; }).then(function (j) {
      // The server checks every field too: show its messages beside the fields, keep what was typed.
      if (j.fields && f.hasAttribute('data-validate')) { btn.disabled = false; btn.textContent = label; showErrors(f, j.fields); return; }
      if (!r.ok || !j.ok) throw new Error(j.error || ('HTTP ' + r.status)); formSuccessEvent(f); done(); }); })
    .catch(function (err) {
      clearTimeout(timer);
      if (err && err.name === 'AbortError') err = new Error('it took too long');
      console.error('Form submission failed', err);
      btn.disabled = false; btn.textContent = label;
      msg.textContent = 'Sorry, your message could not be sent (' + err.message + '). Please call (07) 5406 0586.';
    });
  return false;
}
document.querySelectorAll('form[data-endpoint]').forEach(function (f) { f.setAttribute('data-started', String(Date.now())); });

/*
 * Inline checks for forms marked data-validate (the Patient information form only).
 * Each missing or invalid field gets a red message beside it, the page scrolls to the
 * first one and nothing already typed is lost. Without this script the browser's own
 * required checks still apply; the server repeats every check either way.
 */
var FORM_RULES = {
  medicare: function (v) {
    if (/^n\/?a$/i.test(v)) return '';
    var n = v.replace(/[\s-]/g, '');
    if (!/^\d{10,11}$/.test(n) || !/^[2-6]/.test(n)) return "Please check your Medicare number (10 digits on your card), or enter NA if you don't have one.";
    var w = [1, 3, 7, 9, 1, 3, 7, 9], t = 0;
    for (var i = 0; i < 8; i++) t += w[i] * Number(n[i]);
    return t % 10 === Number(n[8]) ? '' : "Please check your Medicare number (10 digits on your card), or enter NA if you don't have one.";
  },
  'medicare-ref': function (v) { return /^n\/?a$/i.test(v) || /^[1-9]$/.test(v) ? '' : 'Please enter the number beside your name on the card (1 to 9), or NA.'; },
  date: function (v) { return auDate(v) ? '' : 'Please enter the date as dd/mm/yyyy, for example 05/11/1985.'; },
  'date-past': function (v) {
    var d = auDate(v); if (!d) return 'Please enter the date as dd/mm/yyyy, for example 05/11/1985.';
    return d > new Date() ? 'Please check the date: it is in the future.' : '';
  }
};
/* dd/mm/yyyy only (never the browser's own date order), as a real calendar date. */
function auDate(v) {
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v); if (!m) return null;
  var d = new Date(+m[3], m[2] - 1, +m[1]);
  return d.getFullYear() === +m[3] && d.getMonth() === m[2] - 1 && d.getDate() === +m[1] && +m[3] >= 1900 ? d : null;
}
var REQUIRED_MSG = {
  medicare_number: "Please enter your Medicare number, or NA if you don't have a Medicare card.",
  medicare_reference: "Please enter your reference number, or NA if you don't have a Medicare card.",
  allergies: 'Please list any allergies, or NKA if you have no known allergies.'
};
function fieldBox(f, name) {
  var el = f.elements[name]; if (!el) return null;
  var first = el.length && !el.tagName ? el[0] : el;
  var opts = first.closest('.opts');
  if (opts) return { el: first, at: opts.parentElement, opts: opts, group: true };
  var lab = first.closest('label');
  return { el: first, at: lab, after: lab && lab.classList.contains('robot') };
}
function clearError(f, name) {
  var b = fieldBox(f, name); if (!b || !b.at) return;
  var m = (b.after ? b.at.nextElementSibling : b.at.querySelector(':scope > .field-err'));
  if (m && m.classList.contains('field-err')) m.remove();
  b.el.removeAttribute('aria-invalid'); if (b.opts) b.opts.classList.remove('invalid');
}
function showErrors(f, errs) {
  var first = null;
  Object.keys(errs).forEach(function (name) {
    var b = fieldBox(f, name); if (!b || !b.at) return;
    clearError(f, name);
    var m = document.createElement('span'); m.className = 'field-err'; m.setAttribute('role', 'alert'); m.textContent = errs[name];
    if (b.after) b.at.insertAdjacentElement('afterend', m); else b.at.appendChild(m);
    if (b.opts) b.opts.classList.add('invalid'); else b.el.setAttribute('aria-invalid', 'true');
    if (!first) first = b;
  });
  if (first) { first.at.scrollIntoView({ block: 'center', behavior: 'smooth' }); try { first.el.focus({ preventScroll: true }); } catch (x) { first.el.focus(); } }
  return !first;
}
function checkForm(f) {
  var errs = {}, seen = {};
  Array.prototype.forEach.call(f.elements, function (el) {
    var name = el.name; if (!name || seen[name] || el.type === 'hidden' || name === 'website') return;
    seen[name] = true;
    var val = '';
    if (el.type === 'radio') { var c = f.querySelector('input[name="' + name + '"]:checked'); val = c ? c.value : ''; }
    else if (el.type === 'checkbox') { val = el.checked ? el.value : ''; }
    else val = (el.value || '').trim();
    var required = el.type === 'radio' ? !!f.querySelector('input[name="' + name + '"][required]') : el.required;
    clearError(f, name);
    if (required && !val) { errs[name] = REQUIRED_MSG[name] || (el.type === 'checkbox' ? 'Please tick this box to continue.' : el.type === 'radio' ? 'Please choose an option.' : 'Please fill in this field.'); return; }
    if (val && el.type === 'email' && el.validity && el.validity.typeMismatch) { errs[name] = 'Please enter a valid email address.'; return; }
    var rule = el.getAttribute && el.getAttribute('data-rule');
    if (val && rule && FORM_RULES[rule]) { var m = FORM_RULES[rule](val); if (m) errs[name] = m; }
  });
  return showErrors(f, errs);
}
document.querySelectorAll('form[data-validate]').forEach(function (f) {
  f.noValidate = true; // the inline messages above replace the browser's pop-ups
  // Date boxes: the slashes are added while typing, so the phone number pad is enough.
  f.querySelectorAll('input[data-rule^="date"]').forEach(function (el) {
    el.addEventListener('input', function (e) {
      if (e.inputType && e.inputType.indexOf('delete') === 0) return;
      var v = el.value.replace(/\/{2,}/g, '/');
      if (/^\d{3,8}$/.test(v)) v = v.slice(0, 2) + '/' + v.slice(2, 4) + (v.length > 4 ? '/' + v.slice(4) : ''); // digits only, e.g. pasted
      else if (/^\d{2}$/.test(v) || /^\d{1,2}\/\d{2}$/.test(v)) v += '/';
      if (v !== el.value) el.value = v;
    });
  });
  var clear = function (e) { if (e.target.name) clearError(f, e.target.name); };
  f.addEventListener('input', clear); f.addEventListener('change', clear);
});
