/*
 * Visual editor, in-page half. Loaded only inside the dashboard's page editor (POST
 * /edit-preview/ with mode=edit, signed-in users, same origin). Never on the public site.
 *
 * Marks (added by lib/render.ts markEditable):
 *   [data-edit="sec|fN"][data-edit-type]  wording: edited in place
 *   [data-edit-img="sec|fN"]              a photo: click to replace
 *   [data-edit-href="sec|fN"]             a link address: "Change link" chip
 *   [data-edit-note]                      generated from Team, Site Settings or the blog
 *   [data-edit-section]                   a section (for "scroll to")
 *
 * Talks to the dashboard with postMessage (source "scofis-edit" out, "scofis-admin" in).
 */
(function () {
  'use strict';
  var DATA = window.__EDIT || { raw: {}, tokens: {} };
  var ORIGIN = location.origin;
  var parentWin = window.parent;
  if (!parentWin || parentWin === window) return;

  function post(msg) {
    msg.source = 'scofis-edit';
    parentWin.postMessage(msg, ORIGIN);
  }

  /* Practice-wide values ({{phone}} and friends) stay as placeholders in the saved wording. */
  function restoreTokens(id, s) {
    var raw = DATA.raw[id];
    if (!raw) return s;
    ['phone', 'phoneTel', 'year'].forEach(function (k) {
      var shown = DATA.tokens[k];
      if (shown && raw.indexOf('{{' + k + '}}') !== -1) s = s.split(shown).join('{{' + k + '}}');
    });
    return s;
  }

  var css = document.createElement('style');
  css.textContent = [
    '.rv,.rv-stagger,.rv-stagger>*{opacity:1!important;transform:none!important}',
    '[data-page]{animation:none!important}',
    '[data-edit]{outline:1.5px dashed transparent;outline-offset:3px;border-radius:3px;cursor:text;transition:outline-color .15s}',
    '[data-edit]:hover{outline-color:rgba(29,178,222,.75)}',
    '[data-edit]:focus{outline:2px solid #1DB2DE;background:rgba(29,178,222,.08)}',
    '[data-edit]:empty{display:inline-block;min-width:3em;min-height:1em}',
    '[data-edit]:empty::before{content:"Type here";opacity:.45}',
    'img[data-edit-img]{cursor:pointer}',
    'img[data-edit-img]:hover{outline:3px solid #1DB2DE;outline-offset:-3px}',
    '.scofis-tip{position:fixed;z-index:2147483646;pointer-events:none;background:#182650;color:#fff;font:600 12px/1 Arial,sans-serif;padding:7px 10px;border-radius:7px;opacity:0;transition:opacity .12s}',
    '.scofis-chip{position:fixed;z-index:2147483647;display:none;align-items:center;gap:8px;background:#182650;color:#fff;font:500 12.5px/1.2 Arial,sans-serif;padding:6px 6px 6px 11px;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.25);max-width:420px}',
    '.scofis-chip span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.scofis-chip button{border:0;border-radius:999px;background:#1DB2DE;color:#fff;font:700 12px/1 Arial,sans-serif;padding:7px 10px;cursor:pointer;white-space:nowrap}',
    '.scofis-flash{animation:scofisFlash 1.4s ease-out}',
    '@keyframes scofisFlash{0%{box-shadow:inset 0 0 0 4px #1DB2DE}100%{box-shadow:inset 0 0 0 4px transparent}}',
  ].join('\n');
  document.head.appendChild(css);

  var tip = document.createElement('div');
  tip.className = 'scofis-tip';
  document.body.appendChild(tip);
  function showTip(text, e) {
    tip.textContent = text;
    tip.style.opacity = 1;
    tip.style.left = e.clientX + 14 + 'px';
    tip.style.top = e.clientY + 14 + 'px';
  }
  function hideTip() {
    tip.style.opacity = 0;
  }

  /* ---- nothing navigates, submits or opens while editing ---- */
  document.addEventListener(
    'click',
    function (e) {
      var t = e.target;
      if (t.closest('.scofis-chip')) return;
      var a = t.closest('a,button');
      var editable = t.closest('[data-edit]');
      if (a) e.preventDefault();
      // A summary toggles its menu or bio, unless the click is to edit its own wording.
      var sum = t.closest('summary');
      if (sum && editable && sum.contains(editable)) e.preventDefault();
      var note = t.closest('[data-edit-note]');
      if (note && !editable && !t.closest('[data-edit-img]')) post({ type: 'note', note: note.getAttribute('data-edit-note') });
    },
    true,
  );
  document.querySelectorAll('form').forEach(function (f) {
    f.addEventListener('submit', function (e) { e.preventDefault(); }, true);
  });

  /* ---- wording ---- */
  function inAwkwardParent(el) {
    // Typing inside a button or a menu summary toggles it, so those open a small form in the dashboard instead.
    return el.closest('button,summary,select,option,label');
  }
  document.querySelectorAll('[data-edit]').forEach(function (el) {
    var id = el.getAttribute('data-edit');
    var type = el.getAttribute('data-edit-type');
    if (inAwkwardParent(el)) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        post({ type: 'edit-field', id: id });
      });
      el.addEventListener('mousemove', function (e) { showTip('Click to change this wording', e); });
      el.addEventListener('mouseleave', hideTip);
      return;
    }
    if (type === 'rich') {
      el.setAttribute('contenteditable', 'true');
    } else {
      el.setAttribute('contenteditable', 'plaintext-only');
      if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true');
    }
    el.setAttribute('spellcheck', 'true');
    el.addEventListener('input', function () {
      post({ type: 'text', id: id, html: restoreTokens(id, el.innerHTML), text: restoreTokens(id, el.textContent || '') });
    });
    el.addEventListener('paste', function (e) {
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, t.replace(/\s*\n\s*/g, type === 'rich' ? '\n' : ' '));
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (type === 'rich') document.execCommand('insertLineBreak');
      }
      if (e.key === 'Escape') el.blur();
    });
    el.addEventListener('focus', function () { post({ type: 'focus', id: id }); });
  });

  /* ---- photos ----
     A photo is often under something else (the hero's shade and video, a card overlay),
     so the photo under the pointer is found by position, not by what was clicked. */
  css.textContent += '\niframe{pointer-events:none!important}';
  function photoAt(x, y) {
    // By position rather than elementsFromPoint, which skips photos styled with pointer-events:none.
    var best = null;
    var bestArea = Infinity;
    document.querySelectorAll('[data-edit-img]').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height || x < r.left || x > r.right || y < r.top || y > r.bottom) return;
      if (getComputedStyle(el).visibility === 'hidden') return;
      var area = r.width * r.height;
      if (area < bestArea) { best = el; bestArea = area; }
    });
    return best;
  }
  function wordingOrChip(t) {
    return t.closest && t.closest('[data-edit],.scofis-chip');
  }
  document.addEventListener('mousemove', function (e) {
    if (wordingOrChip(e.target)) { hideTip(); document.documentElement.style.cursor = ''; return; }
    var img = photoAt(e.clientX, e.clientY);
    if (img) { showTip('Click to replace this photo', e); document.documentElement.style.cursor = 'pointer'; }
    else if (!e.target.closest('button,summary,label')) { hideTip(); document.documentElement.style.cursor = ''; }
  });
  document.addEventListener('mouseleave', hideTip);
  document.addEventListener(
    'click',
    function (e) {
      if (wordingOrChip(e.target)) return;
      var img = photoAt(e.clientX, e.clientY);
      if (!img) return;
      e.preventDefault();
      e.stopPropagation();
      post({ type: 'pick-image', id: img.getAttribute('data-edit-img') });
    },
    true,
  );

  /* ---- link addresses: a chip above the link ---- */
  var chip = document.createElement('div');
  chip.className = 'scofis-chip';
  chip.innerHTML = '<span></span><button type="button">Change link</button>';
  document.body.appendChild(chip);
  var chipFor = null;
  function placeChip() {
    if (!chipFor) return;
    var r = chipFor.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) { chip.style.display = 'none'; return; }
    chip.style.display = 'flex';
    var top = r.top - chip.offsetHeight - 8;
    chip.style.top = (top < 4 ? r.bottom + 8 : top) + 'px';
    chip.style.left = Math.max(4, Math.min(r.left, innerWidth - chip.offsetWidth - 4)) + 'px';
  }
  function openChip(a) {
    chipFor = a;
    chip.querySelector('span').textContent = 'Goes to: ' + (a.getAttribute('href') || '(no link)');
    chip.style.display = 'flex';
    placeChip();
  }
  chip.querySelector('button').addEventListener('click', function (e) {
    e.preventDefault();
    if (chipFor) post({ type: 'edit-field', id: chipFor.getAttribute('data-edit-href') });
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-edit-href]');
    if (a) openChip(a);
    else if (!e.target.closest('.scofis-chip')) { chip.style.display = 'none'; chipFor = null; }
  });
  document.addEventListener('focusin', function (e) {
    var a = e.target.closest && e.target.closest('[data-edit-href]');
    if (a) openChip(a);
  });
  addEventListener('scroll', placeChip, { passive: true });
  addEventListener('resize', placeChip);

  /* ---- scroll position survives a canvas reload ---- */
  var sTimer = null;
  addEventListener(
    'scroll',
    function () {
      clearTimeout(sTimer);
      sTimer = setTimeout(function () { post({ type: 'scroll', y: scrollY }); }, 150);
    },
    { passive: true },
  );

  /* ---- messages from the dashboard ---- */
  function each(sel, fn) { document.querySelectorAll(sel).forEach(fn); }
  function attrSel(name, id) { return '[' + name + '="' + String(id).replace(/["\\]/g, '\\$&') + '"]'; }
  addEventListener('message', function (e) {
    if (e.origin !== ORIGIN || e.source !== parentWin || !e.data || e.data.source !== 'scofis-admin') return;
    var m = e.data;
    if (m.type === 'start' && m.y) {
      document.documentElement.style.scrollBehavior = 'auto';
      scrollTo(0, m.y);
    }
    if (m.type === 'set-image') {
      each(attrSel('data-edit-img', m.id), function (img) {
        img.removeAttribute('srcset');
        img.src = m.src;
        if (m.alt != null) img.alt = m.alt;
      });
    }
    if (m.type === 'set-href') {
      each(attrSel('data-edit-href', m.id), function (a) { a.setAttribute('href', m.href); });
      if (chipFor) openChip(chipFor);
    }
    if (m.type === 'set-text') {
      each(attrSel('data-edit', m.id), function (el) { el.innerHTML = m.html; });
    }
    if (m.type === 'scroll-to') {
      var el = document.querySelector(attrSel('data-edit-section', m.id)) || document.querySelector(attrSel('data-edit-img', m.id)) || document.querySelector(attrSel('data-edit', m.id));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: m.block || 'start' });
        el.classList.remove('scofis-flash');
        void el.offsetWidth;
        el.classList.add('scofis-flash');
      }
    }
  });

  post({ type: 'ready', editable: document.querySelectorAll('[data-edit]').length, images: document.querySelectorAll('[data-edit-img]').length });
})();
