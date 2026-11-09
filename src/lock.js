/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Program ini perangkat lunak bebas di bawah GNU GPL v3 atau yang lebih baru, TANPA JAMINAN; lihat LICENSE dan NOTICE. */
/* Kunci aplikasi (PIN), opsional. Secara bawaan hanya mengunci TAMPILAN: melindungi dari orang yang meminjam atau mengintip
 * layar HP, bukan dari pihak yang bisa membaca penyimpanan perangkat. Untuk itu ada enkripsi data opsional (vault.js) yang
 * memakai PIN yang sama; saat aktif, PIN yang benar juga membuka data (lihat submit).
 *  - PIN 4-16 digit disimpan sebagai hash PBKDF2-SHA256 (garam acak, 150.000 putaran), bukan teks.
 *  - Salah PIN berulang: jeda makin lama (mulai dari 5 kali salah).
 *  - Terkunci saat dibuka dan saat kembali dari latar belakang lebih lama dari batas yang dipilih.
 *  - Lupa PIN: satu-satunya jalan adalah menghapus data aplikasi di perangkat ini (pulihkan dari cadangan/sinkron). */
(function () {
  'use strict';
  const KEY = 'todo-cli.lock', ITER = 150000;
  const T = (s, v) => (window.T ? window.T(s, v) : s);
  const read = () => { try { const c = JSON.parse(localStorage.getItem(KEY)); return c && c.hash && c.salt ? c : null; } catch (e) { return null; } };
  const write = c => { try { if (c) localStorage.setItem(KEY, JSON.stringify(c)); else localStorage.removeItem(KEY); return true; } catch (e) { return false; } };
  let cfg = read();
  // Android: blokir screenshot/pratinjau aplikasi terbaru selama kunci aktif (FLAG_SECURE lewat plugin TodoWidget)
  const syncSecure = () => {
    try {
      const C = window.Capacitor, P = (C && C.Plugins) || {};
      let S = P.TodoSecure || P.TodoWidget; // plugin terpisah (tetap ada tanpa widget); TodoWidget untuk build lama
      if (!S && C && typeof C.registerPlugin === 'function') { try { S = C.registerPlugin('TodoSecure'); } catch (e) { S = null; } }
      if (S && typeof S.secure === 'function') Promise.resolve(S.secure({ on: !!cfg })).catch(() => {});
    } catch (e) { /* bukan Android */ }
  };
  let isLocked = false, hiddenAt = 0;
  const waiters = [];

  const hex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  const unhex = s => Uint8Array.from((s.match(/../g) || []).map(h => parseInt(h, 16)));
  async function derive(pin, saltHex, iter) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(saltHex), iterations: iter }, key, 256));
  }
  const same = (a, b) => { let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0; };
  const validPin = pin => /^\d{4,16}$/.test(pin);
  const wait = fails => (fails >= 5 ? Math.min(900, 30 * Math.pow(2, fails - 5)) : 0); // detik

  let verifying = false;
  async function verify(pin) {
    if (!cfg) return { ok: true };
    if (verifying) return { ok: false, wait: 0, busy: true }; // satu pemeriksaan sekali jalan: tidak ada tebakan paralel
    verifying = true;
    try { return await verifyNow(pin); } finally { verifying = false; }
  }
  async function verifyNow(pin) {
    const now = Date.now();
    if (cfg.until && cfg.until > now) return { ok: false, wait: Math.ceil((cfg.until - now) / 1000) };
    const ok = validPin(pin) && same(await derive(pin, cfg.salt, cfg.iter || ITER), cfg.hash);
    if (ok) { cfg = Object.assign({}, cfg, { fails: 0, until: 0 }); write(cfg); return { ok: true }; }
    const fails = (cfg.fails || 0) + 1, w = wait(fails);
    cfg = Object.assign({}, cfg, { fails, until: w ? now + w * 1000 : 0 });
    write(cfg);
    return { ok: false, wait: w };
  }
  async function setPin(pin, auto) {
    if (!validPin(pin)) throw new Error('PIN harus 4 sampai 16 angka.');
    if (window.TodoVault && window.TodoVault.enabled()) throw new Error('Gunakan Ganti PIN saat enkripsi data aktif.');
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    cfg = { salt, iter: ITER, hash: await derive(pin, salt, ITER), auto: Number.isFinite(auto) ? auto : 30, fails: 0, until: 0 };
    if (!write(cfg)) { cfg = null; throw new Error('Penyimpanan di perangkat gagal (penuh atau diblokir).'); }
    syncSecure();
    window.dispatchEvent(new Event('todo-lock-changed'));
  }
  function setAuto(sec) { if (cfg) { cfg = Object.assign({}, cfg, { auto: sec }); write(cfg); } }

  /* ---------- tampilan ---------- */
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const k of Object.keys(attrs || {})) { if (k === 'class') n.className = attrs[k]; else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]); else n.setAttribute(k, attrs[k]); }
    n.append(...kids.filter(x => x != null));
    return n;
  };
  let root, pinInput, msg, openBtn, forgot, confirmBox, recBox, recBtn;
  let tick = null;

  function build() {
    if (root) return;
    pinInput = el('input', { class: 'input', id: 'lock-pin', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '16', 'aria-label': T('PIN') });
    msg = el('div', { class: 'login-err', id: 'lock-msg', role: 'alert' });
    openBtn = el('button', { class: 'btn primary', type: 'button', id: 'lock-open', onclick: submit }, T('Buka'));
    confirmBox = el('div', { class: 'lock-forgot', id: 'lock-forgot', hidden: '' },
      el('p', { class: 'sub' }, T('Menghapus data di perangkat ini tidak bisa dibatalkan. Tugas yang sudah dicadangkan atau disinkronkan bisa dipulihkan lagi.')),
      el('button', { class: 'btn danger', type: 'button', id: 'lock-wipe', onclick: wipe }, T('Hapus data di perangkat ini')),
      el('button', { class: 'btn', type: 'button', onclick: () => { confirmBox.hidden = true; forgot.hidden = false; pinInput.focus(); } }, T('Batal')));
    const recPin = el('input', { class: 'input', id: 'lock-rec-pin', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '16', 'aria-label': T('PIN baru (4 sampai 16 angka)') });
    const recKey = el('input', { class: 'input', id: 'lock-rec-key', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': T('Kunci pemulihan') });
    const recMsg = el('div', { class: 'login-err', id: 'lock-rec-msg', role: 'alert' });
    recBox = el('div', { class: 'lock-forgot', id: 'lock-recover', hidden: '' },
      el('p', { class: 'sub' }, T('Masukkan kunci pemulihan yang ditampilkan saat enkripsi dinyalakan, lalu pilih PIN baru.')),
      recKey, recPin, recMsg,
      el('button', { class: 'btn primary', type: 'button', id: 'lock-rec-go', onclick: async () => {
        recMsg.textContent = '';
        try { if (!(await window.TodoLock.recover(recKey.value, recPin.value))) recMsg.textContent = T('Kunci pemulihan salah.'); else { recKey.value = ''; recPin.value = ''; } }
        catch (e) { recMsg.textContent = T(e.message); }
      } }, T('Pulihkan dan ganti PIN')),
      el('button', { class: 'btn', type: 'button', onclick: () => { recBox.hidden = true; forgot.hidden = false; recBtn.hidden = false; pinInput.focus(); } }, T('Batal')));
    recBtn = el('button', { class: 'btn small', type: 'button', id: 'lock-rec-btn', hidden: '', onclick: () => { recBox.hidden = false; forgot.hidden = true; recBtn.hidden = true; recKey.focus(); } }, T('Pakai kunci pemulihan'));
    forgot = el('button', { class: 'btn small', type: 'button', id: 'lock-forgot-btn', onclick: () => { confirmBox.hidden = false; forgot.hidden = true; } }, T('Lupa PIN?'));
    root = el('div', { class: 'login lock', id: 'lock', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lock-title', hidden: '' },
      el('div', { class: 'login-card' },
        el('div', { class: 'lock-mark', 'aria-hidden': 'true' }, '✓'),
        el('h2', { id: 'lock-title', tabindex: '-1' }, T('Tuntas Harian terkunci')),
        el('p', { class: 'sub' }, T('Masukkan PIN untuk membuka.')),
        pinInput, msg, openBtn, forgot, recBtn, confirmBox, recBox));
    document.body.append(root);
    pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  }
  async function submit() {
    const pin = pinInput.value;
    openBtn.disabled = true;
    let r;
    try { r = await verify(pin); } finally { openBtn.disabled = false; }
    if (r.ok) {
      const V = window.TodoVault;
      if (V && V.enabled() && !V.ready()) {
        let opened = false;
        openBtn.disabled = true;
        try { opened = await V.unlock(pin); } catch (e) { opened = false; } finally { openBtn.disabled = false; }
        if (!opened) { pinInput.value = ''; msg.textContent = T('Data terenkripsi tidak bisa dibuka dengan PIN ini.'); pinInput.focus(); return; }
      }
      pinInput.value = ''; msg.textContent = ''; unlock(); return;
    }
    pinInput.value = '';
    if (r.wait) countdown(); else msg.textContent = T('PIN salah.');
    pinInput.focus();
  }
  function countdown() {
    clearInterval(tick);
    const draw = () => {
      const left = cfg && cfg.until ? Math.ceil((cfg.until - Date.now()) / 1000) : 0;
      if (left <= 0) { clearInterval(tick); msg.textContent = ''; openBtn.disabled = false; return; }
      openBtn.disabled = true;
      msg.textContent = T('Terlalu banyak percobaan. Coba lagi dalam {n} detik.', { n: left });
    };
    draw(); tick = setInterval(draw, 1000);
  }
  function wipe() {
    try {
      const gone = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('todo-') === 0) gone.push(k); }
      for (const k of gone) localStorage.removeItem(k);
    } catch (e) { /* abaikan */ }
    cfg = null;
    location.reload();
  }
  function lock() {
    if (!cfg || isLocked) return;
    build();
    isLocked = true;
    root.hidden = false;
    confirmBox.hidden = true; forgot.hidden = false;
    recBox.hidden = true; recBtn.hidden = !(window.TodoVault && window.TodoVault.enabled() && window.TodoVault.recoverable());
    pinInput.value = '';
    window.TodoA11y.open(root, { focus: '#lock-pin', returnTo: null });
    if (cfg.until && cfg.until > Date.now()) countdown();
  }
  function unlock() {
    if (!isLocked) return;
    isLocked = false;
    root.hidden = true;
    window.TodoA11y.close(root, false);
    for (const fn of waiters.splice(0)) { try { fn(); } catch (e) { /* abaikan */ } }
  }

  document.addEventListener('visibilitychange', () => {
    if (!cfg) return;
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt >= (cfg.auto || 0) * 1000) lock();
    hiddenAt = 0;
  });

  window.TodoLock = {
    enabled: () => !!cfg,
    locked: () => isLocked,
    auto: () => (cfg ? cfg.auto : 30),
    setPin, setAuto, verify,
    lockNow: lock,
    /* Ganti PIN (PIN lama wajib benar). Enkripsi aktif: data dienkripsi ulang dulu; bila PIN layar gagal disimpan, kunci lama dipulihkan. */
    changePin: async (oldPin, newPin) => {
      const r = await verify(oldPin);
      if (!r.ok) return r;
      if (!validPin(newPin)) throw new Error('PIN harus 4 sampai 16 angka.');
      const V = window.TodoVault, enc = !!(V && V.enabled());
      if (enc) await V.rekey(newPin);
      const prev = cfg;
      try {
        const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
        const next = { salt, iter: ITER, hash: await derive(newPin, salt, ITER), auto: prev.auto, fails: 0, until: 0 };
        if (!write(next)) throw new Error('Penyimpanan di perangkat gagal (penuh atau diblokir).');
        cfg = next;
      } catch (e) {
        if (enc) { try { await V.rekey(oldPin); } catch (e2) { /* kunci lama gagal dipulihkan: kabari lewat galat asli */ } }
        throw e;
      }
      return { ok: true };
    },
    vaultOn: () => !!(window.TodoVault && window.TodoVault.enabled()),
    /* Nyalakan/matikan enkripsi data: PIN diperiksa dulu; PIN yang sama menurunkan kunci. */
    enableVault: async pin => { const r = await verify(pin); if (r.ok) r.recovery = await window.TodoVault.enable(pin); return r; },
    newRecovery: async pin => { const r = await verify(pin); if (r.ok) r.recovery = await window.TodoVault.newRecovery(pin); return r; },
    /* Lupa PIN dengan enkripsi aktif: kunci pemulihan membuka data, lalu PIN layar dan kunci data dipasang ulang dengan PIN baru. */
    recover: async (rec, newPin) => {
      if (!validPin(newPin)) throw new Error('PIN harus 4 sampai 16 angka.');
      const V = window.TodoVault;
      if (!(V && V.enabled() && V.recoverable())) return false;
      if (!(await V.unlockWithRecovery(rec, newPin))) return false;
      const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
      cfg = { salt, iter: ITER, hash: await derive(newPin, salt, ITER), auto: cfg && Number.isFinite(cfg.auto) ? cfg.auto : 30, fails: 0, until: 0 };
      if (!write(cfg)) throw new Error('Penyimpanan di perangkat gagal (penuh atau diblokir).');
      if (isLocked) unlock();
      return true;
    },
    disableVault: async pin => { const r = await verify(pin); if (r.ok) await window.TodoVault.disable(); return r; },
    disable: async pin => { const r = await verify(pin); if (r.ok && window.TodoVault && window.TodoVault.enabled()) { try { await window.TodoVault.disable(); } catch (e) { return { ok: false, wait: 0, error: e.message }; } } if (r.ok) { cfg = null; write(null); syncSecure(); window.dispatchEvent(new Event('todo-lock-changed')); } return r; },
    afterUnlock: fn => { if (isLocked) waiters.push(fn); else fn(); },
  };
  syncSecure();
  if (cfg) lock();
})();
