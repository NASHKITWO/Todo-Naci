/* ================= kunci aplikasi ================= */
const LCK = { built: false };
const LOCK_AUTO = [[0, 'Segera'], [30, '30 detik'], [60, '1 menit'], [300, '5 menit']];
function buildLockSettings() {
  if (LCK.built) return;
  LCK.built = true;
  LCK.pin = h('input', { class: 'input', id: 'lk-pin', type: 'password', inputmode: 'numeric', maxlength: '8', autocomplete: 'off', 'aria-label': 'PIN baru (4 sampai 8 angka)' });
  LCK.pin2 = h('input', { class: 'input', id: 'lk-pin2', type: 'password', inputmode: 'numeric', maxlength: '8', autocomplete: 'off', 'aria-label': 'Ulangi PIN' });
  LCK.cur = h('input', { class: 'input', id: 'lk-cur', type: 'password', inputmode: 'numeric', maxlength: '8', autocomplete: 'off', 'aria-label': 'PIN saat ini' });
  LCK.auto = h('select', { id: 'lk-auto', 'aria-label': 'Kunci otomatis', onchange: () => window.TodoLock.setAuto(Number(LCK.auto.value)) },
    LOCK_AUTO.map(o => h('option', { value: String(o[0]) }, T(o[1]))));
  LCK.msg = h('div', { class: 'login-err', id: 'lk-msg', role: 'status' });
  LCK.on = h('button', { class: 'btn primary', type: 'button', id: 'lk-enable', onclick: enableLock }, 'Aktifkan kunci');
  LCK.now = h('button', { class: 'btn', type: 'button', id: 'lk-now', onclick: () => { closeLockSettings(); window.TodoLock.lockNow(); } }, 'Kunci sekarang');
  LCK.off = h('button', { class: 'btn danger', type: 'button', id: 'lk-disable', onclick: disableLock }, 'Matikan kunci');
  LCK.offBox = h('div', { class: 'field' }, h('label', { for: 'lk-cur' }, 'PIN saat ini (untuk mematikan)'), LCK.cur, LCK.off);
  LCK.newBox = h('div', { class: 'field' }, h('label', { for: 'lk-pin' }, 'PIN baru (4 sampai 8 angka)'), LCK.pin, h('label', { for: 'lk-pin2' }, 'Ulangi PIN'), LCK.pin2, LCK.on);
  LCK.el = h('div', { class: 'login', id: 'lock-settings', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lk-title', hidden: '' },
    h('div', { class: 'login-card' },
      h('h2', { id: 'lk-title', tabindex: '-1' }, 'Kunci aplikasi'),
      h('p', { class: 'sub' }, 'Saat kunci aktif di Android, tangkapan layar dan pratinjau di daftar aplikasi terbaru diblokir.'),
      h('p', { class: 'sub' }, 'PIN hanya mengunci tampilan aplikasi; data di perangkat tidak dienkripsi. Jika lupa PIN, satu-satunya jalan adalah menghapus data aplikasi di perangkat ini, lalu memulihkan dari cadangan atau sinkron.'),
      LCK.newBox, field('Kunci otomatis setelah ditinggalkan', LCK.auto, 'lk-auto'), LCK.now, LCK.offBox, LCK.msg,
      h('button', { class: 'btn', type: 'button', id: 'lk-close', onclick: closeLockSettings }, 'Selesai')));
  document.body.append(LCK.el);
  LCK.el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeLockSettings(); } }, true);
}
function paintLockSettings() {
  const on = window.TodoLock.enabled();
  LCK.newBox.hidden = on; LCK.offBox.hidden = !on; LCK.now.hidden = !on;
  LCK.auto.closest('.field').hidden = !on;
  if (on) LCK.auto.value = String(window.TodoLock.auto());
  LCK.pin.value = LCK.pin2.value = LCK.cur.value = '';
  LCK.msg.textContent = '';
}
function openLockSettings() {
  if (!window.TodoLock) return;
  buildLockSettings(); paintLockSettings();
  LCK.el.hidden = false;
  window.TodoA11y.open(LCK.el, { focus: window.TodoLock.enabled() ? '#lk-auto' : '#lk-pin', returnTo: () => $('#lock-btn') });
}
function closeLockSettings() {
  if (!LCK.built || LCK.el.hidden) return;
  LCK.el.hidden = true;
  window.TodoA11y.close(LCK.el);
}
async function enableLock() {
  const a = LCK.pin.value, b = LCK.pin2.value;
  LCK.msg.classList.remove('ok');
  if (!/^\d{4,8}$/.test(a)) { LCK.msg.textContent = T('PIN harus 4 sampai 8 angka.'); LCK.pin.focus(); return; }
  if (a !== b) { LCK.msg.textContent = T('Kedua PIN tidak sama.'); LCK.pin2.focus(); return; }
  try { await window.TodoLock.setPin(a, 30); } catch (e) { LCK.msg.textContent = T(e.message); return; }
  paintLockSettings();
  LCK.msg.classList.add('ok'); LCK.msg.textContent = T('Kunci aktif. Aplikasi terkunci saat ditinggalkan lebih dari 30 detik.');
}
async function disableLock() {
  const r = await window.TodoLock.disable(LCK.cur.value);
  LCK.cur.value = '';
  if (!r.ok) { LCK.msg.classList.remove('ok'); LCK.msg.textContent = r.wait ? T('Terlalu banyak percobaan. Coba lagi dalam {n} detik.', { n: r.wait }) : T('PIN salah.'); return; }
  paintLockSettings();
  LCK.msg.classList.add('ok'); LCK.msg.textContent = T('Kunci dimatikan.');
}
$('#lock-btn').addEventListener('click', openLockSettings);
