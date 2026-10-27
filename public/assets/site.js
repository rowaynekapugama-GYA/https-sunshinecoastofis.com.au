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

/* Forms: posted to /api/submit (emailed through SMTP2GO and saved in the dashboard under Enquiries). */
function fakeSubmit(e) {
  e.preventDefault();
  var f = e.target;
  if (!f.checkValidity()) { f.reportValidity(); return false; }
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
  fetch(endpoint, { method: 'POST', body: fd })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.ok) throw new Error(j.error || ('HTTP ' + r.status)); done(); }); })
    .catch(function (err) {
      console.error('Form submission failed', err);
      btn.disabled = false; btn.textContent = label;
      msg.textContent = 'Sorry, your message could not be sent (' + err.message + '). Please call (07) 5406 0586.';
    });
  return false;
}
document.querySelectorAll('form[data-endpoint]').forEach(function (f) { f.setAttribute('data-started', String(Date.now())); });
