/* ================= sidebar mobile, tema, pintasan ================= */
function toggleNav(open) {
  document.body.classList.toggle('nav-open', open);
  $('#scrim').classList.toggle('on', open || ui.openId !== null);
}
/* Dipanggil dari ketukan notifikasi: buka panel tugas (coba lagi sekali bila data belum selesai dimuat). */
window.openTaskById = id => {
  const go = () => { if (taskById(id)) { openDrawer(id); return true; } return false; };
  const run = () => { if (!go()) setTimeout(go, 800); };
  if (window.TodoLock) window.TodoLock.afterUnlock(run); else run(); // terkunci: buka setelah PIN benar
};
/* Tombol kembali Android: tutup lapisan teratas; dari layar mana pun kembali ke Hari ini; baru keluar dari aplikasi. */
window.todoHandleBack = () => {
  if (window.TodoLock && window.TodoLock.locked()) return false; // layar kunci: kembali = keluar dari aplikasi
  const dialogs = Array.from(document.querySelectorAll('.login:not([hidden])'));
  if (dialogs.length) { dialogs[dialogs.length - 1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); return true; }
  if (ui.openId !== null) { closeDrawer(); return true; }
  if (ui.select) { toggleSelectMode(false); return true; }
  if (document.body.classList.contains('nav-open')) { toggleNav(false); return true; }
  if ($('#search-box').classList.contains('open') || ui.q) { $('#search').value = ''; ui.q = ''; openSearch(false); renderList(); return true; }
  if (ui.project || ui.tag || ui.view !== 'today') { selectView('today'); return true; }
  return false;
};
window.closeNav = () => toggleNav(false); // dipakai panel cadangan agar menu tidak tertinggal terbuka di belakangnya
function applyThemeIcon() {
  const dark = document.documentElement.dataset.theme === 'dark';
  $('#theme-btn').replaceChildren(icon(dark ? 'sun' : 'moon', 18), h('span', { class: 'lbl' }, T(dark ? 'Tema terang' : 'Tema gelap')));
}
function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('todo-theme', next); } catch (e) {}
  applyThemeIcon();
}
/* ---- tombol pilihan untuk tugas baru (tanpa simbol) ---- */
let qMore = null; // null = otomatis (terbuka bila jam/ulangi/proyek terpilih); true/false = pilihan pengguna
const OPT = { priority: 0, deadline: '', time: '', project: '', tags: [], repeat: '' };
function resetOpt() { qMore = null; Object.assign(OPT, { priority: 0, deadline: '', time: '', project: '', tags: [], repeat: '' }); }
function weekendIso() { const d = new Date(state.today + 'T00:00:00').getDay(); return addDaysIso(d === 6 ? 0 : (6 - d + 7) % 7); }
const Q_DATES = [['Hari ini', () => state.today], ['Besok', () => addDaysIso(1)], ['Akhir pekan', weekendIso], ['Minggu depan', () => addDaysIso(7)]];
const Q_TIMES = [['Pagi', '08:00'], ['Siang', '12:00'], ['Sore', '17:00'], ['Malam', '20:00']];
const Q_PRIOS = [['Tinggi', 1], ['Sedang', 2], ['Rendah', 3]];
const Q_REPEATS = [['Harian', '1d'], ['Hari kerja', 'wd'], ['Mingguan', '1w'], ['Bulanan', '1m']];
function toggleOpt(key, val) {
  OPT[key] = OPT[key] === val ? (typeof val === 'number' ? 0 : '') : val;
  if (key === 'deadline' && !OPT.deadline) OPT.time = '';
  renderQuickChips();
}
function setTime(t) {
  if (OPT.time === t) OPT.time = '';
  else {
    OPT.time = t;
    if (!OPT.deadline) { const d = quickDefaults().deadline; OPT.deadline = d === 'hari ini' ? state.today : (d || state.today); } // jam ikut tanggal tampilan (mis. hari terpilih di Kalender)
  }
  renderQuickChips();
}
function optBody(title) {
  const d = quickDefaults();
  const deadline = OPT.deadline || (d.deadline === 'hari ini' ? state.today : d.deadline) || '';
  const body = { title, priority: OPT.priority || 2 };
  if (deadline) body.deadline = deadline;
  if (deadline && OPT.time) body.due_time = OPT.time;
  const project = OPT.project || d.project;
  if (project) body.project = project;
  const tags = OPT.tags.length ? OPT.tags : (d.tags || []);
  if (tags.length) body.tags = tags;
  if (OPT.repeat) body.repeat = OPT.repeat;
  return body;
}
function renderQuickChips() {
  const box = $('#quick-chips');
  const input = $('#quick-input');
  const show = document.activeElement === input || input.value.trim() !== '' || box.contains(document.activeElement);
  box.hidden = !show;
  if (!show) return;
  const mk = (label, on, fn, extra) => h('button', Object.assign({ class: 'qchip' + (on ? ' on' : ''), type: 'button', 'aria-pressed': String(on), onmousedown: e => e.preventDefault(), onclick: fn }, extra || {}), label);
  const act = (label, fn, extra) => h('button', Object.assign({ class: 'qchip act', type: 'button', onmousedown: e => e.preventDefault(), onclick: fn }, extra || {}), label);
  const kids = [];
  let known = false;
  for (const [label, fn] of Q_DATES) {
    const iso = fn();
    if (label === 'Akhir pekan' && (iso === state.today || iso === addDaysIso(1))) continue; // sudah terwakili Hari ini / Besok
    const on = OPT.deadline === iso; known = known || on; kids.push(mk(label, on, () => toggleOpt('deadline', iso)));
  }
  if (OPT.deadline && !known) kids.push(mk(raw(OPT.deadline), true, () => toggleOpt('deadline', OPT.deadline)));
  for (const [label, v] of Q_PRIOS) kids.push(mk(label, OPT.priority === v, () => toggleOpt('priority', v), { 'data-prio': v }));
  const open = qMore !== null ? qMore : !!(OPT.time || OPT.repeat || OPT.project);
  kids.push(act(open ? 'Lebih sedikit' : 'Lainnya…', () => { qMore = !open; renderQuickChips(); }, { id: 'qchip-more', 'aria-expanded': String(open) }));
  if (open) {
    for (const [label, t] of Q_TIMES) kids.push(mk(raw(T(label) + ' ' + t), OPT.time === t, () => setTime(t)));
    if (OPT.time && !Q_TIMES.some(x => x[1] === OPT.time)) kids.push(mk(raw(OPT.time), true, () => setTime(OPT.time)));
    for (const [label, v] of Q_REPEATS) kids.push(mk(label, OPT.repeat === v, () => toggleOpt('repeat', v)));
    const projs = state.projects.slice(0, 3).map(x => x.name);
    if (OPT.project && !projs.includes(OPT.project)) projs.push(OPT.project);
    for (const name of projs) kids.push(mk(raw(name), OPT.project === name, () => toggleOpt('project', name), { 'data-project': name }));
    kids.push(act('Tambah banyak…', () => openBulk($('#quick-input').value.trim() ? $('#quick-input').value : undefined), { id: 'qchip-bulk' }));
    kids.push(act('Detail lengkap…', () => openDetail(), { id: 'qchip-detail' }));
  }
  box.replaceChildren(...kids);
}
$('#quick-input').addEventListener('focus', renderQuickChips);
$('#quick-input').addEventListener('input', renderQuickChips);
$('#quick-input').addEventListener('blur', () => setTimeout(renderQuickChips, 120));

/* ---- aksen warna ---- */
const ACCENTS = [['teal', 'Hijau daun'], ['indigo', 'Biru tinta'], ['rose', 'Merah bata'], ['amber', 'Cokelat kopi'], ['ocean', 'Arang']];
function cycleAccent() {
  const cur = document.documentElement.dataset.accent || 'teal';
  const i = ACCENTS.findIndex(a => a[0] === cur);
  const next = ACCENTS[(i + 1) % ACCENTS.length];
  document.documentElement.dataset.accent = next[0];
  try { localStorage.setItem('todo-accent', next[0]); } catch (e) {}
  for (const el of document.querySelectorAll('#toasts .toast')) if (el.textContent.startsWith(T('Warna aksen'))) el.remove();
  toast(T('Warna aksen: {name}', { name: T(next[1]) }));
}
/* ---- bagikan daftar sebagai teks (mis. ke WhatsApp) ---- */
function listAsText() {
  const kids = kidsMap();
  const top = visibleTasks().filter(t => t.parent_id === null);
  const lines = [];
  for (const t of top) {
    let meta = '';
    if (!t.done && t.deadline) meta = ' (' + relLabel(t.deadline) + (t.due_time ? ' ' + t.due_time : '') + ')';
    lines.push((t.done ? '✅ ' : '☐ ') + t.title + meta);
    for (const s of (kids[t.id] || [])) lines.push('    ' + (s.done ? '✅ ' : '☐ ') + s.title);
  }
  return { count: top.length, lines };
}
async function shareList() {
  toggleNav(false);
  const { count, lines } = listAsText();
  if (ui.view === 'insights' || ui.view === 'trash' || !count) { toast(T('Tidak ada tugas untuk dibagikan.'), 'error'); return; }
  const heading = $('#view-title').textContent;
  const title = 'Tuntas Harian · ' + heading + ' · ' + fmtDate(state.today);
  const res = await window.todoShareText(title, [title, ''].concat(lines).join('\n'));
  if (res === 'shared') toast(T('Daftar dibagikan.'), 'ok');
  else if (res === 'copied') toast(T('Daftar disalin ke papan klip.'), 'ok');
  else if (res === 'failed') toast(T('Gagal membagikan daftar.'), 'error');
}
$('#share-btn').prepend(icon('share', 18));
$('#remind-btn').prepend(icon('clock', 18));
$('#lock-btn').prepend(icon('lock', 18));
$('#share-btn').addEventListener('click', shareList);

$('#accent-btn').prepend(icon('palette', 18));
$('#accent-btn').addEventListener('click', cycleAccent);

function fitPlaceholder() {
  $('#quick-input').placeholder = window.innerWidth < 640
    ? T('Tambah tugas…')
    : T('Tambah tugas…  contoh: Bayar listrik');
}
fitPlaceholder();
window.addEventListener('resize', fitPlaceholder);

$('#brand-mark').append(icon('tuntas', 22)); // matahari bercentang = logo
$('#menu-btn').append(icon('menu', 18));
$('#menu-btn').addEventListener('click', () => toggleNav(true));
$('#scrim').addEventListener('click', () => { toggleNav(false); if (ui.openId !== null) closeDrawer(); });
$('#theme-btn').addEventListener('click', toggleTheme);
let searchTimer = 0;
$('#search').addEventListener('input', e => { ui.q = e.target.value; clearTimeout(searchTimer); searchTimer = setTimeout(renderList, 120); }); // tunda sedikit agar mengetik tetap lancar pada data besar
$('#search-btn').append(icon('search', 18));
function openSearch(open) {
  $('#search-box').classList.toggle('open', open);
  $('#search-btn').setAttribute('aria-expanded', String(open));
  if (open) $('#search').focus();
}
$('#search-btn').addEventListener('click', () => openSearch(!$('#search-box').classList.contains('open')));
$('#search').addEventListener('blur', () => { if (!$('#search').value) openSearch(false); });
applyThemeIcon();

function bulkDefaults() { const b = optBody(''); delete b.title; return b; }
function quickDefaults() {
  const defaults = {};
  if (ui.project) defaults.project = ui.project;
  if (ui.tag) defaults.tags = [ui.tag];
  if (ui.view === 'today' && !ui.project && !ui.tag) defaults.deadline = 'hari ini';
  if (ui.view === 'calendar' && !ui.project && !ui.tag) defaults.deadline = curDay();
  return defaults;
}

$('#quick').addEventListener('submit', async e => {
  e.preventDefault();
  const input = $('#quick-input');
  const text = input.value.trim();
  if (!text) return;
  const r = await guarded(async () => api('POST', '/api/tasks', optBody(text.replace(/\s+/g, ' '))));
  if (!r) return;
  input.value = '';
  resetOpt();
  renderQuickChips();
  await refresh();
  const visible = visibleTasks().some(t => t.id === r.task.id);
  toast(T('Ditambahkan: {title}', { title: r.task.title }), 'ok',
    visible ? null : { label: 'Lihat', fn: () => { ui.q = ''; $('#search').value = ''; selectView('all'); } });
});
