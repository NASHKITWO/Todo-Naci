/* ================= kunci aplikasi ================= */
const LCK = { built: false };
const LOCK_AUTO = [[0, 'Segera'], [30, '30 detik'], [60, '1 menit'], [300, '5 menit']];
function buildLockSettings() {
  if (LCK.built) return;
  LCK.built = true;
  LCK.pin = h('input', { class: 'input', id: 'lk-pin', type: 'password', inputmode: 'numeric', maxlength: '16', autocomplete: 'off', 'aria-label': 'PIN baru (4 sampai 16 angka)' });
  LCK.pin2 = h('input', { class: 'input', id: 'lk-pin2', type: 'password', inputmode: 'numeric', maxlength: '16', autocomplete: 'off', 'aria-label': 'Ulangi PIN' });
  LCK.cur = h('input', { class: 'input', id: 'lk-cur', type: 'password', inputmode: 'numeric', maxlength: '16', autocomplete: 'off', 'aria-label': 'PIN saat ini' });
  LCK.auto = h('select', { id: 'lk-auto', 'aria-label': 'Kunci otomatis', onchange: () => window.TodoLock.setAuto(Number(LCK.auto.value)) },
    LOCK_AUTO.map(o => h('option', { value: String(o[0]) }, T(o[1]))));
  LCK.msg = h('div', { class: 'login-err', id: 'lk-msg', role: 'status' });
  LCK.on = h('button', { class: 'btn primary', type: 'button', id: 'lk-enable', onclick: enableLock }, 'Aktifkan kunci');
  LCK.newLabel = null;
  LCK.now = h('button', { class: 'btn', type: 'button', id: 'lk-now', onclick: () => { closeLockSettings(); window.TodoLock.lockNow(); } }, 'Kunci sekarang');
  LCK.off = h('button', { class: 'btn danger', type: 'button', id: 'lk-disable', onclick: disableLock }, 'Matikan kunci');
  LCK.encState = h('p', { class: 'sub', id: 'lk-enc-state' });
  LCK.recKey = h('input', { class: 'input', id: 'lk-rec', type: 'text', readonly: '', 'aria-label': 'Kunci pemulihan' });
  LCK.recCopy = h('button', { class: 'btn small', type: 'button', id: 'lk-rec-copy', onclick: async () => { try { await navigator.clipboard.writeText(LCK.recKey.value); LCK.msg.classList.add('ok'); LCK.msg.textContent = T('Kunci pemulihan disalin.'); } catch (e) { LCK.recKey.select(); } } }, 'Salin');
  LCK.recBox = h('div', { class: 'field', id: 'lk-rec-box', hidden: '' },
    h('p', { class: 'sub' }, 'Kunci pemulihan (ditampilkan sekali). Catat atau simpan di tempat aman di luar HP. Dengan kunci ini PIN yang lupa bisa diganti tanpa kehilangan data; tanpa PIN dan kunci ini data tak bisa dibuka.'),
    LCK.recKey, LCK.recCopy);
  LCK.newRec = h('button', { class: 'btn', type: 'button', id: 'lk-newrec', onclick: makeRecovery }, 'Buat kunci pemulihan baru');
  LCK.enc = h('button', { class: 'btn', type: 'button', id: 'lk-enc', onclick: toggleVault }, 'Enkripsi data');
  LCK.offBox = h('div', { class: 'field' }, h('label', { for: 'lk-cur' }, 'PIN saat ini (untuk mengganti atau mematikan)'), LCK.cur, LCK.enc, LCK.newRec, LCK.off);
  LCK.newBox = h('div', { class: 'field' }, h('label', { for: 'lk-pin' }, 'PIN baru (4 sampai 16 angka)'), LCK.pin, h('label', { for: 'lk-pin2' }, 'Ulangi PIN'), LCK.pin2, LCK.on);
  LCK.el = h('div', { class: 'login', id: 'lock-settings', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lk-title', hidden: '' },
    h('div', { class: 'login-card' },
      h('h2', { id: 'lk-title', tabindex: '-1' }, 'Kunci aplikasi'),
      h('p', { class: 'sub' }, 'Saat kunci aktif di Android, tangkapan layar dan pratinjau di daftar aplikasi terbaru diblokir.'),
      h('p', { class: 'sub' }, 'Secara bawaan PIN hanya mengunci tampilan. Nyalakan enkripsi data bila ingin isi penyimpanan HP ikut diacak dengan PIN yang sama. Jika lupa PIN, satu-satunya jalan adalah menghapus data aplikasi di perangkat ini, lalu memulihkan dari cadangan atau sinkron.'),
      LCK.encState, LCK.recBox, LCK.offBox, LCK.newBox, field('Kunci otomatis setelah ditinggalkan', LCK.auto, 'lk-auto'), LCK.now, LCK.msg,
      h('button', { class: 'btn', type: 'button', id: 'lk-close', onclick: closeLockSettings }, 'Selesai')));
  document.body.append(LCK.el);
  LCK.el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeLockSettings(); } }, true);
}
function paintLockSettings() {
  const on = window.TodoLock.enabled();
  LCK.newBox.hidden = false; LCK.offBox.hidden = !on;
  LCK.on.textContent = T(on ? 'Ganti PIN' : 'Aktifkan kunci'); LCK.now.hidden = !on;
  LCK.auto.closest('.field').hidden = !on;
  if (on) LCK.auto.value = String(window.TodoLock.auto());
  LCK.pin.value = LCK.pin2.value = LCK.cur.value = '';
  LCK.msg.textContent = '';
  const enc = window.TodoLock.vaultOn();
  LCK.encState.hidden = !on;
  LCK.encState.textContent = enc ? T('Enkripsi data: aktif. Tugas, snapshot, dan salinan di folder Dokumen hanya disimpan terenkripsi.') : T('Enkripsi data: mati. PIN hanya mengunci tampilan.');
  LCK.enc.textContent = enc ? T('Matikan enkripsi data') : T('Nyalakan enkripsi data');
  LCK.newRec.hidden = !enc;
  LCK.recBox.hidden = true; LCK.recKey.value = '';
  // Tombol yang baru ditekan bisa ikut tersembunyi (mis. "Matikan kunci"): fokus jatuh ke body dan Esc tak lagi menutup dialog.
  const a = document.activeElement;
  if (!LCK.el.hidden && (!a || a === document.body || a.closest('[hidden]'))) $('#lk-close').focus({ preventScroll: true });
}
function openLockSettings() {
  if (!window.TodoLock) return;
  window.closeNav(); // dibuka dari menu samping: jangan biarkan menu terbuka di belakang dialog / layar kunci
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
  if (!/^\d{4,16}$/.test(a)) { LCK.msg.textContent = T('PIN harus 4 sampai 16 angka.'); LCK.pin.focus(); return; }
  if (a !== b) { LCK.msg.textContent = T('Kedua PIN tidak sama.'); LCK.pin2.focus(); return; }
  if (window.TodoLock.enabled()) {
    const old = LCK.cur.value;
    if (!old) { LCK.msg.textContent = T('Isi PIN saat ini dulu.'); LCK.cur.focus(); return; }
    LCK.on.disabled = true;
    let r;
    try { r = await window.TodoLock.changePin(old, a); } catch (e) { LCK.msg.textContent = T(e.message); return; } finally { LCK.on.disabled = false; }
    if (!r.ok) { LCK.msg.textContent = r.wait ? T('Terlalu banyak percobaan. Coba lagi dalam {n} detik.', { n: r.wait }) : T('PIN salah.'); return; }
    paintLockSettings();
    LCK.msg.classList.add('ok'); LCK.msg.textContent = T('PIN diganti.');
    return;
  }
  try { await window.TodoLock.setPin(a, 30); } catch (e) { LCK.msg.textContent = T(e.message); return; }
  paintLockSettings();
  LCK.msg.classList.add('ok'); LCK.msg.textContent = T('Kunci aktif. Aplikasi terkunci saat ditinggalkan lebih dari 30 detik.');
}
function showRecovery(rec) { LCK.recKey.value = rec; LCK.recBox.hidden = false; LCK.recKey.focus(); }
async function makeRecovery() {
  const pin = LCK.cur.value;
  LCK.msg.classList.remove('ok');
  if (!pin) { LCK.msg.textContent = T('Isi PIN saat ini dulu.'); LCK.cur.focus(); return; }
  if (!window.confirm(T('Kunci pemulihan lama tidak berlaku lagi. Lanjutkan?'))) return;
  LCK.newRec.disabled = true;
  let r;
  try { r = await window.TodoLock.newRecovery(pin); } catch (e) { LCK.msg.textContent = T(e.message); return; } finally { LCK.newRec.disabled = false; LCK.cur.value = ''; }
  if (!r.ok) { LCK.msg.textContent = r.wait ? T('Terlalu banyak percobaan. Coba lagi dalam {n} detik.', { n: r.wait }) : T('PIN salah.'); return; }
  showRecovery(r.recovery);
  LCK.msg.classList.add('ok'); LCK.msg.textContent = T('Kunci pemulihan baru dibuat. Catat sekarang.');
}
async function toggleVault() {
  const L = window.TodoLock, enc = L.vaultOn();
  LCK.msg.classList.remove('ok');
  const pin = LCK.cur.value;
  if (!pin) { LCK.msg.textContent = T('Isi PIN saat ini dulu.'); LCK.cur.focus(); return; }
  if (!enc && !window.confirm(T('Data tugas di HP akan dienkripsi dengan PIN ini. Lupa PIN = data di HP tidak bisa dibuka (pulihkan dari cadangan atau sinkron). Lanjutkan?'))) return;
  LCK.enc.disabled = true;
  let r;
  try { r = await (enc ? L.disableVault(pin) : L.enableVault(pin)); }
  catch (e) { LCK.msg.textContent = T(e.message); return; }
  finally { LCK.enc.disabled = false; LCK.cur.value = ''; }
  if (!r.ok) { LCK.msg.textContent = r.wait ? T('Terlalu banyak percobaan. Coba lagi dalam {n} detik.', { n: r.wait }) : T('PIN salah.'); return; }
  paintLockSettings();
  LCK.msg.classList.add('ok'); LCK.msg.textContent = enc ? T('Enkripsi data dimatikan.') : T('Enkripsi data aktif.');
  if (r.recovery) showRecovery(r.recovery);
}
async function disableLock() {
  const r = await window.TodoLock.disable(LCK.cur.value);
  LCK.cur.value = '';
  if (r.error) { LCK.msg.classList.remove('ok'); LCK.msg.textContent = T(r.error); return; }
  if (!r.ok) { LCK.msg.classList.remove('ok'); LCK.msg.textContent = r.wait ? T('Terlalu banyak percobaan. Coba lagi dalam {n} detik.', { n: r.wait }) : T('PIN salah.'); return; }
  paintLockSettings();
  LCK.msg.classList.add('ok'); LCK.msg.textContent = T('Kunci dimatikan.');
}
$('#lock-btn').addEventListener('click', openLockSettings);

window.addEventListener('todo-vault-error', () => toast(T('Penyimpanan terenkripsi gagal ditulis (penuh atau diblokir). Perubahan terakhir mungkin belum tersimpan.'), 'error'));
