/* ================= tampilan daftar ================= */
function visibleTasks() {
  const q = ui.q.trim().toLowerCase();
  const kids = kidsMap();
  let list = state.tasks.filter(t => t.parent_id === null);
  list = list.filter(t => ui.view === 'done' ? t.done : !t.done);
  if (ui.view === 'calendar' && !ui.project && !ui.tag) list = list.filter(t => t.deadline === curDay());
  if (ui.view !== 'done') {
    if (ui.filter === 'high') list = list.filter(t => t.priority === 1);
    else if (ui.filter === 'timed') list = list.filter(t => t.due_time);
    else if (ui.filter === 'repeat') list = list.filter(t => t.repeat);
  }
  if (ui.project) list = list.filter(t => (t.project || '').toLowerCase() === ui.project.toLowerCase());
  if (ui.tag) list = list.filter(t => t.tags.indexOf(ui.tag) !== -1);
  if (!ui.project && !ui.tag) {
    if (ui.view === 'today') list = list.filter(t => t.deadline && diffDays(t.deadline) <= 0);
    if (ui.view === 'upcoming') list = list.filter(t => t.deadline && diffDays(t.deadline) > 0);
  }
  if (q) {
    list = list.filter(t =>
      t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q) ||
      (t.project || '').toLowerCase().includes(q) || t.tags.some(g => g.includes(q)) ||
      (kids[t.id] || []).some(k => k.title.toLowerCase().includes(q)));
  }
  return list;
}

/* Warna proyek: enam tinta. Tiap nama mendapat warna dari hash-nya; bila bentrok dengan proyek lain, ambil warna kosong berikutnya.
 * Pilihan diingat di perangkat (localStorage) supaya warna tidak berubah ketika proyek bertambah. */
const PC_KEY = 'todo-pcolors';
const pcMap = (() => { try { const v = JSON.parse(localStorage.getItem(PC_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } })();
function pcHash(name) {
  let n = 0x811c9dc5; // FNV-1a
  for (const ch of String(name).toLowerCase()) { n ^= ch.codePointAt(0); n = Math.imul(n, 16777619) >>> 0; }
  return (n >>> 8) % 6;
}
function projectClass(name) {
  const key = String(name).toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(pcMap, key)) {
    const used = new Set(Object.values(pcMap));
    let slot = pcHash(key);
    for (let k = 0; k < 6 && used.has(slot); k++) slot = (slot + 1) % 6; // semua terpakai: biarkan berbagi
    pcMap[key] = slot;
    try { localStorage.setItem(PC_KEY, JSON.stringify(pcMap)); } catch (e) { /* tanpa penyimpanan: tetap konsisten selama sesi */ }
  }
  return 'pc' + pcMap[key];
}
function chip(text, cls, ico, onclick, title) {
  const tag = onclick ? 'button' : 'span';
  return h(tag, { class: 'chip' + (cls ? ' ' + cls : ''), type: onclick ? 'button' : null, onclick, title }, ico ? icon(ico, 12) : null, text);
}

function nowHHMM() {
  const n = new Date();
  return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
}

function taskRow(t) {
  const subs = (kidsMap()[t.id] || []);
  const chips = [];
  if (t.deadline && !t.done) {
    const d = diffDays(t.deadline);
    const late = d < 0 || (d === 0 && t.due_time && t.due_time < nowHHMM());
    chips.push(chip(relLabel(t.deadline) + (t.due_time ? ' ' + t.due_time : ''), late ? 'overdue' : d === 0 ? 'today' : d <= 2 ? 'soon' : '', t.repeat ? 'repeat' : 'calendar', null, t.repeat ? ruleLabel(t.repeat) : undefined));
  }
  if (t.project) chips.push(chip('@' + t.project, 'project plain ' + projectClass(t.project), null, e => { e.stopPropagation(); selectProject(t.project); }, 'Lihat proyek'));
  /* Paling banyak satu tag di baris; sisanya "+N" (semua tag ada di panel detail). Pengulangan menyatu dengan chip tanggal. */
  t.tags.slice(0, 1).forEach(g => chips.push(chip('#' + g, 'plain', null, e => { e.stopPropagation(); selectTag(g); }, 'Lihat tag')));
  if (t.tags.length > 1) chips.push(chip('+' + (t.tags.length - 1), 'plain more', null, null, t.tags.slice(1).map(g => '#' + g).join(' ')));
  if (t.repeat && !(t.deadline && !t.done)) chips.push(chip(ruleLabel(t.repeat, true), '', 'repeat', null, ruleLabel(t.repeat)));
  const open = ui.expanded.has(t.id);
  if (t.sub_total) {
    const c = chip(t.sub_done + '/' + t.sub_total, 'subtoggle', 'chevron', e => { e.stopPropagation(); toggleSubs(t.id); }, open ? 'Sembunyikan subtugas' : 'Tampilkan subtugas');
    c.setAttribute('aria-expanded', String(open));
    chips.push(c);
  }
  const row = h('div', {
      class: 'row' + (t.done ? ' done' : '') + (ui.openId === t.id ? ' selected' : '') + (ui.newIds.has(t.id) && motionOK() ? ' enter' : '') + (ui.picked.has(t.id) ? ' picked' : ''),
      tabindex: '0', 'data-id': t.id, role: 'group', 'aria-label': t.done ? T('{title} (selesai)', { title: t.title }) : raw(t.title),
      onclick: () => { if (suppressClick) return; if (ui.select) togglePick(t.id); else openDrawer(t.id); },
      onkeydown: e => { if (e.key === 'Enter' && e.target === e.currentTarget) openDrawer(t.id); },
    },
    h('div', { class: 'swipe-hint', 'aria-hidden': 'true' },
      icon(t.done ? 'repeat' : 'check', 18), h('span', {}, t.done ? 'Buka lagi' : 'Selesai')),
    h('div', { class: 'row-body' },
      h('span', { class: 'pick', 'aria-hidden': 'true' }, icon('check', 14)),
      checkButton(t, true),
      h('div', { class: 'row-main' }, h('div', { class: 'title' }, raw(t.title), t.notes ? h('span', { class: 'has-note', title: T('Ada catatan'), role: 'img', 'aria-label': T('Ada catatan') }, icon('note', 13)) : null), h('div', { class: 'meta' }, chips),
        t.sub_total ? h('div', { class: 'mini', role: 'progressbar', 'aria-valuenow': t.sub_done, 'aria-valuemax': t.sub_total, 'aria-label': 'Progres subtugas' },
          h('span', { style: { width: Math.round(t.sub_done / t.sub_total * 100) + '%' } })) : null,
        open ? inlineSubs(t, subs) : null)));
  attachSwipe(row, t);
  attachLongPress(row, t);
  return row;
}

/* Geser (layar sentuh): kanan = selesai, kiri = tunda ke besok. Mouse tetap memakai klik biasa. */
function attachSwipe(row, t) {
  const body = row.querySelector('.row-body');
  const hint = row.querySelector('.swipe-hint');
  let sx = 0, sy = 0, dx = 0, active = false, dragging = false, pid = null;
  if (!t.done) {
    // petunjuk sisi kiri (tunda) hanya untuk tugas aktif
    hint.dataset.left = '1';
  }
  row.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || e.target.closest('button, .subs-inline') || ui.select) return;
    sx = e.clientX; sy = e.clientY; dx = 0; active = true; dragging = false; pid = e.pointerId;
  });
  row.addEventListener('pointermove', e => {
    if (!active || e.pointerId !== pid) return;
    const mx = e.clientX - sx, my = e.clientY - sy;
    if (!dragging) {
      if (Math.abs(my) > 12 && Math.abs(my) > Math.abs(mx)) { active = false; return; }
      if (Math.abs(mx) < 10 || Math.abs(mx) < Math.abs(my) * 1.5) return;
      dragging = true;
      row.classList.add('swiping');
      try { row.setPointerCapture(pid); } catch (err) {}
    }
    dx = Math.max(t.done ? 0 : -160, Math.min(160, mx));
    body.style.transform = 'translateX(' + dx + 'px)';
    const dir = dx >= 0 ? 'right' : 'left';
    if (row.dataset.dir !== dir) {
      row.dataset.dir = dir;
      hint.replaceChildren(dir === 'right' ? icon(t.done ? 'repeat' : 'check', 18) : icon('clock', 18), h('span', {}, dir === 'right' ? (t.done ? 'Buka lagi' : 'Selesai') : 'Tunda ke besok'));
    }
    const armed = Math.abs(dx) >= SWIPE_AT;
    if (armed && !row.classList.contains('armed')) buzz(8);
    row.classList.toggle('armed', armed);
  });
  const end = e => {
    if (!active || e.pointerId !== pid) return;
    active = false;
    if (!dragging) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 350);
    const fire = e.type === 'pointerup' && Math.abs(dx) >= SWIPE_AT, dir = dx > 0 ? 'right' : 'left';
    row.classList.remove('swiping', 'armed');
    body.style.transform = '';
    if (fire) { buzz(15); if (dir === 'right') toggleDone(t); else snooze(t, 'tomorrow'); }
  };
  row.addEventListener('pointerup', end);
  row.addEventListener('pointercancel', end);
}

function toggleSubs(id) {
  if (ui.expanded.has(id)) ui.expanded.delete(id); else ui.expanded.add(id);
  renderList();
  const c = document.querySelector('.row[data-id="' + id + '"] .chip.subtoggle');
  if (c) c.focus();
}
function inlineSubs(t, subs) {
  const kids = subs.slice().sort((a, b) => a.id - b.id);
  const input = h('input', { placeholder: 'Tambah subtugas…', maxlength: '300', autocomplete: 'off', 'aria-label': T('Subtugas baru untuk {title}', { title: t.title }),
    onkeydown: async e => {
      e.stopPropagation();
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const text = e.target.value.trim();
      if (!text) return;
      e.target.value = '';
      await guarded(async () => { await api('POST', '/api/tasks', { title: text, parent_id: t.id }); await refresh(); });
      const again = document.querySelector('.row[data-id="' + t.id + '"] .isub-add input');
      if (again) again.focus();
    } });
  return h('div', { class: 'subs-inline', onclick: e => e.stopPropagation() },
    kids.map(k => h('div', { class: 'isub' + (k.done ? ' done' : ''), 'data-sub': k.id }, checkButton(k), h('span', { class: 'st' }, raw(k.title)))),
    h('div', { class: 'isub-add' }, input));
}

/* Tekan lama (layar sentuh) masuk ke mode pilih banyak. */
function attachLongPress(row, t) {
  let timer = null, sx = 0, sy = 0;
  const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };
  row.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || e.target.closest('button, .subs-inline, input')) return;
    sx = e.clientX; sy = e.clientY; stop();
    timer = setTimeout(() => {
      timer = null;
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 350);
      buzz(20);
      ui.select = true;
      ui.picked.add(t.id);
      render();
    }, 480);
  });
  row.addEventListener('pointermove', e => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) stop(); });
  row.addEventListener('pointerup', stop);
  row.addEventListener('pointercancel', stop);
}

function checkButton(t) {
  return h('button', {
    class: 'check p' + t.priority + (t.done ? ' on' : ''), type: 'button', role: 'checkbox',
    'aria-checked': String(t.done), 'aria-label': T(t.done ? 'Buka kembali: {title}' : 'Selesaikan: {title}', { title: t.title }),
    onclick: e => { e.stopPropagation(); toggleDone(t); },
  }, icon('check', t.parent_id === null ? 14 : 12));
}

const VIEW_TITLES = { today: 'Hari ini', upcoming: 'Mendatang', calendar: 'Kalender', all: 'Semua tugas', done: 'Selesai', insights: 'Wawasan', trash: 'Sampah' };
const EMPTY = {
  today: ['Semua beres', 'Tidak ada tugas yang jatuh tempo hari ini. Nikmati harimu.'],
  upcoming: ['Belum ada rencana', 'Tambahkan tugas dengan deadline untuk melihatnya di sini.'],
  all: ['Belum ada tugas', 'Ketik di kolom atas, mis. “Beli susu”, lalu pilih tombol tanggalnya.'],
  done: ['Belum ada yang selesai', 'Tugas yang kamu centang akan muncul di sini.'],
  trash: ['Sampah kosong', 'Tugas yang kamu hapus muncul di sini selama 30 hari sebelum hilang permanen.'],
  calendar: ['Hari ini lengang', 'Tidak ada tugas di tanggal ini. Ketik di kolom atas untuk menambah.'],
};

function renderList() {
  const root = $('#list');
  const ae = document.activeElement;
  const keepFocus = ae && ae.classList && ae.classList.contains('row') ? ae.dataset.id : null;
  renderListInner(root);
  if (keepFocus) { const r = root.querySelector('.row[data-id="' + keepFocus + '"]'); if (r) r.focus({ preventScroll: true }); }
}
const SAMPLES = [
  ['Geser tugas ini ke kanan untuk menyelesaikannya', { deadline: 0 }],
  ['Tulis tugas sendiri di kolom bawah', { deadline: 1, project: 'contoh', tags: ['pemula'] }],
  ['Buka tugas ini untuk melihat detailnya', { deadline: 0, due_time: '17:00', project: 'contoh', subs: ['Tambahkan subtugas di sini', 'Centang subtugas kalau sudah'] }],
];
function focusQuick() {
  const i = $('#quick-input');
  i.scrollIntoView({ block: 'center' });
  i.focus();
}
async function addSamples() {
  const r = await guarded(async () => {
    for (const [title, o] of SAMPLES) {
      const text = [T(title)].concat((o.subs || []).map(x => '  ' + T(x))).join('\n');
      const defaults = { deadline: addDaysIso(o.deadline) };
      if (o.due_time) defaults.due_time = o.due_time;
      if (o.project) defaults.project = o.project;
      if (o.tags) defaults.tags = o.tags;
      await api('POST', '/api/tasks/bulk', { text, plain: true, defaults });
    }
    return true;
  });
  if (!r) return;
  await refresh();
  toast(T('Contoh ditambahkan. Coba geser, buka, dan centang.'), 'ok');
}
/* Keadaan kosong yang mengajak bertindak. Saat belum ada tugas sama sekali: sambutan + tiga tips + tombol. */
function emptyState(key, text) {
  const brandNew = !state.tasks.length && ['today', 'all', 'upcoming', 'calendar'].indexOf(key) !== -1;
  if (brandNew) {
    return h('div', { class: 'empty welcome', id: 'welcome' },
      h('h2', {}, 'Selamat datang di Tuntas Harian'),
      h('p', {}, 'Mulai dari yang kecil.'),
      h('ul', { class: 'tips' },
        h('li', {}, 'Ketik di kolom tambah tugas, mis. “Beli susu”, lalu pilih tombol tanggal, prioritas, atau proyek di sebelahnya.'),
        h('li', {}, 'Geser tugas ke kanan untuk menyelesaikan, ke kiri untuk menunda. Tekan lama untuk memilih banyak.'),
        h('li', {}, 'Punya daftar di catatan atau chat? Tempel saja, satu baris satu tugas.')),
      h('div', { class: 'empty-actions' },
        h('button', { class: 'btn primary', type: 'button', id: 'welcome-write', onclick: focusQuick }, 'Tulis tugas pertama'),
        h('button', { class: 'btn', type: 'button', id: 'welcome-sample', onclick: addSamples }, 'Coba dengan contoh'),
        h('button', { class: 'btn', type: 'button', id: 'welcome-paste', onclick: () => openBulk() }, 'Tempel daftar')));
  }
  const acts = [];
  if (key === 'today' || key === 'all' || key === 'upcoming' || key === 'calendar') acts.push(h('button', { class: 'btn primary', type: 'button', id: 'empty-write', onclick: focusQuick }, 'Tulis tugas'));
  if (key === 'today' && state.tasks.some(t => !t.done && t.parent_id === null)) acts.push(h('button', { class: 'btn', type: 'button', id: 'empty-upcoming', onclick: () => selectView('upcoming') }, 'Lihat tugas mendatang'));
  return h('div', { class: 'empty' }, icon('tuntas', 40), h('h2', {}, text[0]), h('p', {}, text[1]), acts.length ? h('div', { class: 'empty-actions' }, acts) : null);
}
function renderListInner(root) {
  root.replaceChildren();
  if (ui.view === 'insights' && !ui.project && !ui.tag) { renderInsights(root); return; }
  if (ui.view === 'trash' && !ui.project && !ui.tag) { renderTrash(root); return; }
  root.classList.remove('fade-in');
  if (ui.fade && motionOK()) { void root.offsetWidth; root.classList.add('fade-in'); }
  ui.fade = false;
  const tasks = visibleTasks();
  if (!tasks.length) {
    const filtered = ui.filter !== 'all' && ui.view !== 'done';
    const key = ui.q || filtered ? null : ui.view;
    const text = key ? EMPTY[key] : ['Tidak ada hasil', filtered && !ui.q ? 'Tidak ada tugas yang cocok dengan filter ini.' : 'Tidak ada tugas yang cocok dengan pencarian.'];
    root.append(emptyState(key, text));
    return;
  }
  if (ui.view === 'done') {
    tasks.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
    root.append(h('div', { class: 'group' },
      h('div', { class: 'card' }, tasks.map(taskRow)),
      h('div', { class: 'group-actions' }, h('button', { class: 'btn small danger', type: 'button', onclick: clearDone }, 'Hapus semua yang selesai'))));
    return;
  }
  if (ui.sort !== 'auto') {
    tasks.sort(sorter());
    root.append(h('div', { class: 'group' }, h('div', { class: 'group-head' }, T('Diurutkan: {name}', { name: T(SORTS.find(x => x[0] === ui.sort)[1]) }), h('span', { class: 'n' }, String(tasks.length))),
      h('div', { class: 'card' }, tasks.map(taskRow))));
    return;
  }
  const groups = {};
  for (const t of tasks) (groups[bucketOf(t)] = groups[bucketOf(t)] || []).push(t);
  for (const [key, label] of BUCKETS) {
    const items = groups[key];
    if (!items) continue;
    items.sort(cmpTask);
    root.append(h('div', { class: 'group' },
      h('div', { class: 'group-head ' + key }, label, h('span', { class: 'n' }, String(items.length)),
        key === 'overdue' ? h('button', { class: 'btn small head-act', type: 'button', id: 'resched-overdue', onclick: () => reschedOverdue(items) }, 'Pindah ke hari ini') : null),
      h('div', { class: 'card' }, items.map(taskRow))));
  }
}
