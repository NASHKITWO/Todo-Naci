/* Aksesibilitas dialog: satu tempat untuk panel detail, panel cadangan, dan menu samping di ponsel.
 *  - latar belakang dibuat `inert` (tidak bisa difokus/dibaca pembaca layar) selama dialog terbuka,
 *  - fokus pindah masuk saat dibuka dan kembali ke pemicunya saat ditutup,
 *  - Tab berputar di dalam dialog,
 *  - menu samping yang tertutup di ponsel tidak bisa difokus (inert), tombol menu memakai aria-expanded. */
(function () {
  'use strict';
  const FOCUSABLE = 'button:not([disabled]), a[href], input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const stack = []; // {root, returnTo}
  const mq = window.matchMedia ? window.matchMedia('(max-width: 860px)') : { matches: false, addEventListener() {} };
  let navWasOpen = false;

  const top = () => (stack.length ? stack[stack.length - 1].root : null);
  const phoneNavOpen = () => mq.matches && document.body.classList.contains('nav-open');

  function apply() {
    const side = document.getElementById('sidebar'), main = document.querySelector('main.main'), menu = document.getElementById('menu-btn');
    const modal = top();
    if (side) side.inert = !!modal || (mq.matches && !phoneNavOpen());
    if (main) main.inert = !!modal || phoneNavOpen();
    for (const m of stack) m.root.inert = m.root !== modal;
    if (menu) menu.setAttribute('aria-expanded', String(phoneNavOpen()));
  }

  const visible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

  function open(root, opts) {
    opts = opts || {};
    stack.push({ root, returnTo: opts.returnTo || document.activeElement });
    apply();
    root.inert = false;
    const target = (opts.focus && root.querySelector(opts.focus)) || root;
    if (target === root && !root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  function close(root, restore) {
    const i = stack.findIndex(m => m.root === root);
    if (i < 0) return;
    const [m] = stack.splice(i, 1);
    root.inert = true;
    apply();
    if (restore === false) return;
    const back = typeof m.returnTo === 'function' ? m.returnTo() : m.returnTo;
    if (back && back.isConnected && !back.closest('[inert]') && typeof back.focus === 'function') back.focus({ preventScroll: true });
  }

  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const root = top() || (phoneNavOpen() ? document.getElementById('sidebar') : null);
    if (!root) return;
    const items = Array.from(root.querySelectorAll(FOCUSABLE)).filter(visible);
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1], active = document.activeElement;
    if (!root.contains(active)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && (active === first || active === root)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }, true);

  function watchNav() {
    new MutationObserver(() => {
      const isOpen = phoneNavOpen();
      apply();
      if (isOpen && !top()) {
        const first = document.querySelector('#sidebar .nav-item.active, #sidebar .nav-item');
        if (first) first.focus({ preventScroll: true });
      } else if (!isOpen && navWasOpen && !top()) {
        const a = document.activeElement, menu = document.getElementById('menu-btn');
        if ((a === document.body || !a || (a.closest && a.closest('#sidebar'))) && menu) menu.focus({ preventScroll: true });
      }
      navWasOpen = isOpen;
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    if (mq.addEventListener) mq.addEventListener('change', apply);
    apply();
  }

  window.TodoA11y = { open, close, apply };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchNav); else watchNav();
})();
