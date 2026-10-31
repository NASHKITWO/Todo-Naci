'use strict';

/* ================= util ================= */
const $ = (sel, el) => (el || document).querySelector(sel);
const SVG_NS = 'http://www.w3.org/2000/svg';

const TRANSLATED_ATTRS = new Set(['aria-label', 'title', 'placeholder']);
const raw = window.TodoI18n.raw;
function h(tag, attrs) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') {
      // Atribut style inline diblokir CSP; gunakan objek (CSSOM) atau kelas CSS.
      if (typeof v === 'object') Object.assign(el.style, v);
      else console.error('h(): style harus berupa objek, bukan string');
    }
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, typeof v === 'string' && TRANSLATED_ATTRS.has(k) ? T(v) : v);
  }
  for (const kid of Array.prototype.slice.call(arguments, 2).flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(typeof kid === 'string' ? T(kid) : String(kid)));
  }
  return el;
}

const ICONS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12|M18 6L6 18',
  trash: 'M4 7h16|M10 11v6|M14 11v6|M6 7l1 13h10l1-13|M9 7V4h6v3',
  repeat: 'M17 2l4 4-4 4|M3 11V9a3 3 0 013-3h15|M7 22l-4-4 4-4|M21 13v2a3 3 0 01-3 3H3',
  note: 'M5 4h14v16H5z|M8 9h8|M8 13h8|M8 17h5',
  menu: 'M4 6h16|M4 12h16|M4 18h16',
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  sun: 'M12 8a4 4 0 100 8 4 4 0 000-8z|M12 2v2|M12 20v2|M2 12h2|M20 12h2|M4.9 4.9l1.4 1.4|M17.7 17.7l1.4 1.4|M19.1 4.9l-1.4 1.4|M6.3 17.7l-1.4 1.4',
  calendar: 'M4 6h16v14H4z|M4 10h16|M8 3v4|M16 3v4',
  upcoming: 'M5 12h14|M13 6l6 6-6 6',
  all: 'M8 6h13|M8 12h13|M8 18h13|M3 6h.01|M3 12h.01|M3 18h.01',
  done: 'M12 21a9 9 0 100-18 9 9 0 000 18z|M8 12.5l3 3 5-6',
  list: 'M4 6h16|M4 12h10|M4 18h6',
  sparkle: 'M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 1 0 0-11zM9.6 12.2l1.8 1.9 3.2-3.8M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4', // matahari bercentang (logo)
  share: 'M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13',
  palette: 'M12 3a9 9 0 100 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A3.7 3.7 0 0021 10.7C21 6.4 17 3 12 3z|M7.5 11h.01|M10 7.5h.01|M14 7.5h.01',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18z|M12 7v5l3 2',
  flame: 'M12 3c1 3 4 4.5 4 8.5a4 4 0 01-8 0c0-1.5.6-2.6 1.5-3.5C9.7 9.8 11 7 12 3z',
  insights: 'M4 20V11|M10 20V4|M16 20v-6|M22 20H2',
  select: 'M9 11l3 3 8-8|M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h9',
  copy: 'M8 8h12v12H8z|M4 16V4h12',
  chevron: 'M9 6l6 6-6 6',
  left: 'M15 6l-6 6 6 6',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14z|M21 21l-4.3-4.3',
};
function icon(name, size) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size || 16);
  svg.setAttribute('height', size || 16);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ICONS[name].split('|')) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  }
  return svg;
}

async function api(method, path, body) {
  return window.todoLocalApi(method, path, body); // semua data lokal di HP (lihat local-api.js)
}

const motionOK = () => !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const wait = ms => new Promise(r => setTimeout(r, ms));
const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };

/* ================= tanggal ================= */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BUCKETS = [['overdue', 'Terlambat'], ['today', 'Hari ini'], ['tomorrow', 'Besok'],
                 ['week', 'Minggu ini'], ['later', 'Nanti'], ['none', 'Tanpa deadline']];

function dayNum(iso) {
  const p = iso.split('-').map(Number);
  return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000);
}
function isoFromDayNum(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }
function diffDays(iso) { return dayNum(iso) - dayNum(state.today); }
function addDaysIso(n) { return isoFromDayNum(dayNum(state.today) + n); }
function fmtDate(iso) {
  const p = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  let s = T(DAYS[dt.getUTCDay()]) + ', ' + p[2] + ' ' + T(MONTHS[p[1] - 1]);
  if (String(p[0]) !== state.today.slice(0, 4)) s += ' ' + p[0];
  return s;
}
function relLabel(iso) {
  const d = diffDays(iso);
  if (d === 0) return 'Hari ini';
  if (d === 1) return 'Besok';
  if (d === -1) return 'Kemarin';
  if (d < 0) return T('Terlambat {n} hari', { n: -d });
  return fmtDate(iso);
}
function bucketOf(t) {
  if (!t.deadline) return 'none';
  const d = diffDays(t.deadline);
  if (d < 0) return 'overdue';
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d <= 6) return 'week';
  return 'later';
}
function pad2(n) { return String(n).padStart(2, '0'); }
function localIso(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function hhmm(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
function ruleLabel(rule, short) {
  const m = /^(\d+)([dwmy])$/.exec(rule || '');
  if (!m) return rule || '';
  const unit = { d: 'hari', w: 'minggu', m: 'bulan', y: 'tahun' }[m[2]];
  if (short) return m[1] === '1' ? T('Tiap ' + unit) : T('Tiap {n} ' + unit, { n: m[1] });
  return m[1] === '1' ? T('Setiap ' + unit) : T('Setiap {n} ' + unit, { n: m[1] });
}

/* ================= state ================= */
const state = { tasks: [], projects: [], tags: [], stats: null, today: '1970-01-01', trash: [] };
const ui = { view: 'today', project: null, tag: null, q: '', openId: null, newIds: new Set(), fade: false,
  expanded: new Set(), filter: 'all', sort: 'auto', day: null, weekOff: 0, select: false, picked: new Set() };
try { const sv = localStorage.getItem('todo-sort'); if (sv) ui.sort = sv; } catch (e) {}
const SORTS = [['auto', 'Otomatis'], ['prio', 'Prioritas'], ['time', 'Waktu'], ['new', 'Terbaru'], ['az', 'A–Z']];
const FILTERS = [['all', 'Semua'], ['high', 'Prioritas tinggi'], ['timed', 'Ber-jam'], ['repeat', 'Berulang']];
const curDay = () => ui.day || state.today;
let suppressClick = false;
const SWIPE_AT = 80;

function kidsMap() {
  const m = {};
  for (const t of state.tasks) {
    if (t.parent_id !== null) (m[t.parent_id] = m[t.parent_id] || []).push(t);
  }
  return m;
}
function taskById(id) { return state.tasks.find(t => t.id === id) || null; }
function cmpTask(a, b) {
  if (a.priority !== b.priority) return a.priority - b.priority;
  const da = a.deadline || '9999', db = b.deadline || '9999';
  if (da !== db) return da < db ? -1 : 1;
  return a.id - b.id;
}

function sorter() {
  const byId = (a, b) => a.id - b.id;
  if (ui.sort === 'prio') return (a, b) => a.priority - b.priority || byId(a, b);
  if (ui.sort === 'time') return (a, b) => ((a.deadline || '9999') + (a.due_time || '99:99')).localeCompare((b.deadline || '9999') + (b.due_time || '99:99')) || byId(a, b);
  if (ui.sort === 'new') return (a, b) => b.id - a.id;
  if (ui.sort === 'az') return (a, b) => a.title.localeCompare(b.title, TodoI18n.state.lang) || byId(a, b);
  return cmpTask;
}

async function refresh() {
  try {
    const data = await api('GET', '/api/state');
    try { data.trash = (await api('GET', '/api/trash')).entries; } catch (e) { data.trash = state.trash; }
    const before = new Set(state.tasks.map(t => t.id));
    ui.newIds = state.loaded ? new Set(data.tasks.filter(t => !before.has(t.id)).map(t => t.id)) : new Set();
    Object.assign(state, data);
    state.loaded = true;
    $('#banner').hidden = true;
  } catch (e) {
    $('#banner').textContent = T(e.message) + ' ' + T('Mencoba lagi otomatis…');
    $('#banner').hidden = false;
    return;
  }
  if (ui.openId !== null && !taskById(ui.openId)) closeDrawer();
  for (const id of Array.from(ui.picked)) if (!taskById(id)) ui.picked.delete(id);
  render();
}

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
    chips.push(chip(relLabel(t.deadline) + (t.due_time ? ' ' + t.due_time : ''), late ? 'overdue' : d === 0 ? 'today' : d <= 2 ? 'soon' : '', 'calendar'));
  }
  if (t.project) chips.push(chip('@' + t.project, 'project plain ' + projectClass(t.project), null, e => { e.stopPropagation(); selectProject(t.project); }, 'Lihat proyek'));
  for (const g of t.tags) chips.push(chip('#' + g, 'plain', null, e => { e.stopPropagation(); selectTag(g); }, 'Lihat tag'));
  if (t.repeat) chips.push(chip(ruleLabel(t.repeat, true), '', 'repeat', null, ruleLabel(t.repeat)));
  const open = ui.expanded.has(t.id);
  if (t.sub_total) {
    const c = chip(t.sub_done + '/' + t.sub_total, 'subtoggle', 'chevron', e => { e.stopPropagation(); toggleSubs(t.id); }, open ? 'Sembunyikan subtugas' : 'Tampilkan subtugas');
    c.setAttribute('aria-expanded', String(open));
    chips.push(c);
  }
  if (t.notes) chips.push(chip('', '', 'note', null, 'Ada catatan'));
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
      h('div', { class: 'row-main' }, h('div', { class: 'title' }, raw(t.title)), h('div', { class: 'meta' }, chips),
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
    return h('div', { class: 'empty welcome', id: 'welcome' }, icon('sparkle', 40),
      h('h2', {}, 'Selamat datang di Tuntas Harian'),
      h('p', {}, 'Mulai dari yang kecil. Tiga hal yang perlu kamu tahu:'),
      h('ol', { class: 'tips' },
        h('li', {}, 'Ketik di kolom bawah, mis. “Beli susu”, lalu pilih tombol tanggal, prioritas, atau proyek di bawahnya.'),
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
  return h('div', { class: 'empty' }, icon('sparkle', 40), h('h2', {}, text[0]), h('p', {}, text[1]), acts.length ? h('div', { class: 'empty-actions' }, acts) : null);
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
    root.append(h('div', { class: 'group' }, h('div', { class: 'group-head' }, T('Diurutkan: {name}', { name: T(SORTS.find(x => x[0] === ui.sort)[1]) }), h('span', { class: 'n' }, '· ' + tasks.length)),
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
      h('div', { class: 'group-head ' + key }, label, h('span', { class: 'n' }, '· ' + items.length),
        key === 'overdue' ? h('button', { class: 'btn small head-act', type: 'button', id: 'resched-overdue', onclick: () => reschedOverdue(items) }, 'Pindah ke hari ini') : null),
      h('div', { class: 'card' }, items.map(taskRow))));
  }
}

/* ================= sidebar ================= */
function renderSidebar() {
  const top = state.tasks.filter(t => t.parent_id === null);
  const active = top.filter(t => !t.done);
  const counts = {
    today: active.filter(t => t.deadline && diffDays(t.deadline) <= 0).length,
    upcoming: active.filter(t => t.deadline && diffDays(t.deadline) > 0).length,
    all: active.length,
    done: top.filter(t => t.done).length,
    calendar: active.filter(t => t.deadline === curDay()).length,
    trash: state.trash.length,
  };
  const nav = $('#nav-views');
  nav.replaceChildren();
  for (const [key, ico] of [['today', 'calendar'], ['upcoming', 'upcoming'], ['calendar', 'calendar'], ['all', 'all'], ['done', 'done'], ['insights', 'insights'], ['trash', 'trash']]) {
    const on = !ui.project && !ui.tag && ui.view === key;
    nav.append(h('button', { class: 'nav-item' + (on ? ' active' : ''), type: 'button', 'aria-current': on ? 'page' : null, onclick: () => selectView(key) },
      icon(ico, 18), VIEW_TITLES[key], h('span', { class: 'count' }, key === 'insights' ? '' : (counts[key] || ''))));
  }
  const pr = $('#nav-projects');
  pr.replaceChildren();
  $('#sec-projects').hidden = !state.projects.length;
  for (const p of state.projects) {
    const on = ui.project && ui.project.toLowerCase() === p.name.toLowerCase();
    pr.append(h('button', { class: 'nav-item' + (on ? ' active' : ''), type: 'button', onclick: () => selectProject(p.name) },
      h('span', { class: 'dot ' + projectClass(p.name) }), raw(p.name), h('span', { class: 'count' }, p.active || '')));
  }
  const tg = $('#nav-tags');
  tg.replaceChildren();
  $('#sec-tags').hidden = !state.tags.length;
  for (const g of state.tags) {
    tg.append(h('button', { class: 'tag-pill' + (ui.tag === g.name ? ' active' : ''), type: 'button', onclick: () => selectTag(g.name) }, '#' + g.name));
  }
  renderStatsCard();
}

function renderStatsCard() {
  const s = state.stats;
  const card = $('#side-stats');
  card.replaceChildren();
  if (!s) return;
  const pct = Math.round((s.completion_rate || 0) * 100);
  const week = s.completed_week || [];
  const max = Math.max.apply(null, week.map(w => w[1]).concat([1]));
  card.append(
    h('div', { class: 'small' }, 'Progres keseluruhan'),
    h('div', { class: 'big' }, pct + '%'),
    h('div', { class: 'meter', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('span', { style: { width: pct + '%' } })),
    h('div', { class: 'small' }, T('{done} dari {total} selesai', { done: s.done, total: s.total }) + (s.overdue ? ' · ' + T('{n} terlambat', { n: s.overdue }) : '')),
    h('div', { class: 'bars', title: 'Selesai 7 hari terakhir' },
      week.map((w, i) => h('i', { class: (w[1] ? 'has' : '') + (i === week.length - 1 ? ' now' : ''), style: { height: Math.max(10, Math.round(w[1] / max * 100)) + '%' }, title: fmtDate(w[0]) + ': ' + T('{n} selesai', { n: w[1] }) }))),
    h('div', { class: 'small mt6' }, T('Selesai 7 hari terakhir: {n}', { n: week.reduce((a, w) => a + w[1], 0) })));
}

const HERO = { built: false };
function greeting() {
  const h24 = new Date().getHours();
  return T(h24 < 4 ? 'Selamat malam' : h24 < 11 ? 'Selamat pagi' : h24 < 15 ? 'Selamat siang' : h24 < 18 ? 'Selamat sore' : 'Selamat malam');
}
function streakDays() {
  const week = (state.stats && state.stats.completed_week) || [];
  let i = week.length - 1, n = 0;
  if (i >= 0 && !week[i][1]) i -= 1; // hari ini belum ada yang selesai: hitung dari kemarin
  for (; i >= 0 && week[i][1] > 0; i--) n++;
  return n;
}
function renderHero() {
  const box = $('#hero');
  const on = ui.view === 'today' && !ui.project && !ui.tag && !ui.q.trim() && state.loaded && state.tasks.length > 0;
  box.hidden = !on;
  if (!on) return;
  const R = 26, C = 2 * Math.PI * R;
  if (!HERO.built) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%'); svg.setAttribute('viewBox', '0 0 64 64');
    for (const cls of ['track', 'bar']) {
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', '32'); c.setAttribute('cy', '32'); c.setAttribute('r', String(R)); c.setAttribute('fill', 'none');
      c.setAttribute('stroke-width', '6'); c.setAttribute('stroke-linecap', 'round'); c.setAttribute('class', cls);
      if (cls === 'bar') { c.setAttribute('stroke-dasharray', String(C)); c.setAttribute('stroke-dashoffset', String(C)); }
      svg.append(c);
    }
    HERO.ring = h('div', { class: 'ring', role: 'img' }, svg, h('div', { class: 'label', id: 'hero-label' }));
    HERO.bar = svg.querySelector('.bar');
    HERO.title = h('h2', { id: 'hero-title' });
    HERO.sub = h('p', { id: 'hero-sub' });
    HERO.meta = h('div', { class: 'hero-meta', id: 'hero-meta' });
    HERO.dm = h('span', { class: 'dm' });
    HERO.dd = h('span', { class: 'dd' });
    HERO.dw = h('span', { class: 'dw' });
    HERO.date = h('div', { class: 'dateblock', 'aria-hidden': 'true' }, HERO.dm, HERO.dd, HERO.dw);
    box.replaceChildren(HERO.date, h('div', { class: 'hero-text' }, HERO.title, HERO.sub, HERO.meta), HERO.ring);
    HERO.built = true;
  }
  const top = state.tasks.filter(t => t.parent_id === null);
  const doneToday = top.filter(t => t.done && (t.completed_at || '').slice(0, 10) === state.today).length;
  const open = top.filter(t => !t.done && t.deadline && diffDays(t.deadline) <= 0);
  const total = doneToday + open.length;
  const late = open.filter(t => diffDays(t.deadline) < 0).length;
  { const [yy, mm, dd] = state.today.split('-').map(Number);
    HERO.dm.textContent = MONTHS[mm - 1]; HERO.dd.textContent = String(dd); HERO.dw.textContent = DAYS[new Date(yy, mm - 1, dd).getDay()]; }
  HERO.title.textContent = greeting();
  HERO.sub.textContent = total === 0 ? T('Hari ini masih kosong. Tambahkan tugas, atau nikmati waktu luangmu.')
    : open.length === 0 ? T('Semua tugas hari ini selesai. Kerja bagus!')
    : T('{n} tugas menunggu', { n: open.length }) + (late ? ', ' + T('{n} di antaranya terlambat', { n: late }) : '') + '.';
  const frac = total ? doneToday / total : 0;
  HERO.bar.setAttribute('stroke-dashoffset', String(C * (1 - frac)));
  HERO.ring.classList.toggle('full', total > 0 && open.length === 0);
  HERO.ring.setAttribute('aria-label', T('{done} dari {total} tugas hari ini selesai', { done: doneToday, total }));
  $('#hero-label').textContent = total ? doneToday + '/' + total : '0';
  const meta = [];
  const now = nowHHMM();
  const next = open.filter(t => t.due_time && t.deadline === state.today && t.due_time >= now)
    .sort((a, b) => a.due_time.localeCompare(b.due_time))[0];
  if (next) {
    meta.push(h('button', { class: 'chip', type: 'button', id: 'hero-next', onclick: () => openDrawer(next.id) },
      icon('clock', 12), h('span', { class: 'ell' }, T('Berikutnya {time}', { time: next.due_time }) + ' · ' + next.title)));
  }
  const streak = streakDays();
  if (streak >= 2) meta.push(h('span', { class: 'chip', id: 'hero-streak' }, icon('flame', 12), T('Beruntun {n} hari', { n: streak })));
  HERO.meta.replaceChildren(...meta);
}

function renderHeader() {
  let title = T(VIEW_TITLES[ui.view]), sub = '';
  if (ui.project) title = '@' + ui.project;
  else if (ui.tag) title = '#' + ui.tag;
  if (ui.view === 'today' && !ui.project && !ui.tag && state.today) sub = fmtDate(state.today);
  else if (ui.view === 'calendar' && !ui.project && !ui.tag) sub = fmtDate(curDay());
  else if (ui.view === 'insights' && !ui.project && !ui.tag) sub = T('Ringkasan produktivitasmu');
  else if (ui.view === 'trash' && !ui.project && !ui.tag) sub = T('Dihapus otomatis setelah 30 hari');
  else if (ui.project || ui.tag) sub = T(ui.view === 'done' ? 'Selesai' : 'Tugas aktif');
  $('#view-title').textContent = title;
  $('#view-sub').textContent = sub;
  $('#rename-btn').hidden = !ui.project;
  document.title = title + ' · Tuntas Harian';
}

function render() {
  renderHeader();
  renderSidebar();
  renderHero();
  renderWeek();
  renderFilters();
  document.body.classList.toggle('select-mode', ui.select);
  $('#select-btn').setAttribute('aria-pressed', String(ui.select));
  renderList();
  renderBulk();
  renderQuickChips();
  if (ui.openId !== null) syncDrawer();
}

function selectView(key) { ui.fade = true; endSelect(); if (key === 'calendar' && !ui.day) ui.day = state.today; ui.view = key; ui.project = null; ui.tag = null; toggleNav(false); render(); }
function selectProject(name) { ui.fade = true; endSelect(); ui.project = name; ui.tag = null; if (ui.view === 'today' || ui.view === 'upcoming') ui.view = 'all'; toggleNav(false); render(); }
function selectTag(name) { ui.fade = true; endSelect(); ui.tag = ui.tag === name ? null : name; ui.project = null; if (ui.view === 'today' || ui.view === 'upcoming') ui.view = 'all'; toggleNav(false); render(); }

/* ================= kalender mingguan ================= */
const WEEKDAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
function weekStart() {
  const n = dayNum(state.today);
  const dow = (new Date(n * 86400000).getUTCDay() + 6) % 7; // Senin = 0
  return n - dow + 7 * ui.weekOff;
}
function renderWeek() {
  const box = $('#week');
  const on = ui.view === 'calendar' && !ui.project && !ui.tag && state.loaded;
  box.hidden = !on;
  if (!on) return;
  const start = weekStart();
  const active = state.tasks.filter(t => t.parent_id === null && !t.done && t.deadline);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const iso = isoFromDayNum(start + i);
    const items = active.filter(t => t.deadline === iso).sort((a, b) => a.priority - b.priority);
    const dots = items.slice(0, 3).map(t => h('i', { class: 'p' + t.priority }));
    days.push(h('button', {
      class: 'wday' + (iso === state.today ? ' today' : '') + (iso === curDay() ? ' sel' : ''), type: 'button', 'data-day': iso,
      'aria-pressed': String(iso === curDay()), 'aria-label': fmtDate(iso) + ', ' + T('{n} tugas', { n: items.length }),
      onclick: () => { ui.day = iso; ui.fade = true; render(); },
    }, h('span', { class: 'dn' }, T(WEEKDAY_SHORT[new Date((start + i) * 86400000).getUTCDay()])),
      h('span', { class: 'dd' }, String(Number(iso.slice(8)))),
      h('span', { class: 'dots' }, dots),
      h('span', { class: 'more' }, items.length > 3 ? '+' + (items.length - 3) : '')));
  }
  const first = isoFromDayNum(start), last = isoFromDayNum(start + 6);
  box.replaceChildren(
    h('div', { class: 'week-head' },
      h('h3', { id: 'week-title' }, fmtDate(first) + ' – ' + fmtDate(last)),
      h('button', { class: 'btn small', id: 'week-today', type: 'button', onclick: () => { ui.weekOff = 0; ui.day = state.today; ui.fade = true; render(); } }, 'Hari ini'),
      h('button', { class: 'icon-btn', id: 'week-prev', type: 'button', 'aria-label': 'Pekan sebelumnya', onclick: () => { ui.weekOff -= 1; render(); } }, icon('left', 18)),
      h('button', { class: 'icon-btn', id: 'week-next', type: 'button', 'aria-label': 'Pekan berikutnya', onclick: () => { ui.weekOff += 1; render(); } }, icon('chevron', 18))),
    h('div', { class: 'week-days' }, days));
}

/* ================= filter + urutan ================= */
const FILT = { built: false };
function renderFilters() {
  const box = $('#filters');
  const on = ['today', 'upcoming', 'calendar', 'all'].indexOf(ui.view) !== -1 && state.loaded && state.tasks.length > 0;
  box.hidden = !on;
  if (!on) return;
  if (!FILT.built) {
    FILT.chips = FILTERS.map(f => h('button', { class: 'qchip', type: 'button', 'data-filter': f[0], onclick: () => { ui.filter = f[0]; ui.fade = true; render(); } }, f[1]));
    FILT.sel = h('select', { id: 'sort-sel', 'aria-label': 'Urutkan',
      onchange: e => { ui.sort = e.target.value; try { localStorage.setItem('todo-sort', ui.sort); } catch (err) {} ui.fade = true; render(); } },
      SORTS.map(o => h('option', { value: o[0] }, T('Urut: {name}', { name: T(o[1]) }))));
    box.replaceChildren(...FILT.chips, h('span', { class: 'sp' }), FILT.sel);
    FILT.built = true;
  }
  FILT.chips.forEach(c => { const a = c.dataset.filter === ui.filter; c.classList.toggle('on', a); c.setAttribute('aria-pressed', String(a)); });
  FILT.sel.value = ui.sort;
}

/* ================= sampah ================= */
function renderTrash(root) {
  root.classList.remove('fade-in');
  ui.fade = false;
  const items = state.trash;
  if (!items.length) {
    root.append(h('div', { class: 'empty' }, icon('trash', 40), h('h2', {}, EMPTY.trash[0]), h('p', {}, EMPTY.trash[1])));
    return;
  }
  const rows = items.map(e => h('div', { class: 'trash-row', 'data-trash-id': e.id },
    h('div', { class: 'trash-main' },
      h('div', { class: 'trash-title' }, raw(e.title)),
      h('div', { class: 'trash-meta' }, T('Dihapus {date}', { date: fmtDate(e.deleted_at.slice(0, 10)) }) + (e.subs ? ' · ' + T('{n} subtugas', { n: e.subs }) : '') + (e.project ? ' · @' + e.project : ''))),
    h('div', { class: 'trash-acts' },
      h('button', { class: 'btn small', type: 'button', 'data-act': 'restore', 'aria-label': T('Pulihkan: {title}', { title: e.title }), onclick: () => restoreFromTrash([e.id], 'Tugas dipulihkan') }, 'Pulihkan'),
      h('button', { class: 'btn small danger', type: 'button', 'data-act': 'purge', 'aria-label': T('Hapus permanen: {title}', { title: e.title }), onclick: () => purgeOne(e) }, 'Hapus permanen'))));
  root.append(h('div', { class: 'group' },
    h('div', { class: 'card' }, rows),
    h('div', { class: 'group-actions' },
      h('button', { class: 'btn small', type: 'button', id: 'trash-restore-all', onclick: () => restoreFromTrash(items.map(e => e.id), '{n} entri dipulihkan') }, 'Pulihkan semua'),
      h('button', { class: 'btn small danger', type: 'button', id: 'trash-empty', onclick: emptyTrash }, 'Kosongkan sampah'))));
}
async function restoreFromTrash(ids, msg) {
  await guarded(async () => {
    await api('POST', '/api/trash/restore', { ids });
    toast(T(msg, { n: ids.length }));
    await refresh();
  });
}
async function purgeOne(e) {
  if (!confirm(T('Hapus "{title}" secara permanen? Tidak bisa dipulihkan lagi.', { title: e.title }))) return;
  await guarded(async () => { await api('DELETE', '/api/trash/' + e.id); await refresh(); });
}
async function emptyTrash() {
  if (!confirm(T('Kosongkan sampah? {n} entri akan hilang permanen.', { n: state.trash.length }))) return;
  await guarded(async () => { await api('DELETE', '/api/trash'); toast(T('Sampah dikosongkan')); await refresh(); });
}
/* Aksi "Urungkan" untuk penghapusan: pulihkan semua entri sampah yang lahir setelah `sinceId`. */
const maxTrashId = () => state.trash.reduce((a, e) => Math.max(a, e.id), 0);
function undoDelete(sinceId) {
  const ids = state.trash.filter(e => e.id > sinceId).map(e => e.id);
  if (!ids.length) return null;
  return { label: 'Urungkan', fn: () => restoreFromTrash(ids, 'Dikembalikan') };
}

/* ================= wawasan ================= */
function hbar(label, frac, text, cls) {
  return h('div', { class: 'hrow' }, h('span', { class: 'lbl', title: label }, label),
    h('span', { class: 'track' }, h('i', { class: 'fill ' + (cls || ''), style: { width: Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%' } })),
    h('span', { class: 'val' }, text));
}
function insightsData() {
  const top = state.tasks.filter(t => t.parent_id === null);
  const finished = top.filter(t => t.done && t.deadline && t.completed_at);
  const onTime = finished.filter(t => t.completed_at.slice(0, 10) <= t.deadline).length;
  const active = top.filter(t => !t.done);
  const prio = [1, 2, 3].map(p => active.filter(t => t.priority === p).length);
  const projects = {};
  for (const t of top) { if (!t.project) continue; const k = t.project; (projects[k] = projects[k] || { done: 0, total: 0 }); projects[k].total++; if (t.done) projects[k].done++; }
  return { finished: finished.length, onTime, pct: finished.length ? Math.round(onTime / finished.length * 100) : null, prio, projects };
}
function renderInsights(root) {
  const s = state.stats || {};
  const week = s.completed_week || [];
  const d = insightsData();
  const weekTotal = week.reduce((a, w) => a + w[1], 0);
  const max = Math.max.apply(null, week.map(w => w[1]).concat([1]));
  const kpi = (v, l, id) => h('div', { class: 'kpi', id }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l));
  const prioNames = ['Tinggi', 'Sedang', 'Rendah'].map(x => T(x));
  const pmax = Math.max.apply(null, d.prio.concat([1]));
  const projs = Object.keys(d.projects).sort((a, b) => d.projects[b].total - d.projects[a].total);
  root.append(h('div', { class: 'insights', id: 'insights' },
    h('div', { class: 'kpis' },
      kpi(String(weekTotal), 'Selesai 7 hari', 'kpi-week'),
      kpi(d.pct === null ? '–' : d.pct + '%', 'Tepat waktu', 'kpi-ontime'),
      kpi(String(streakDays()), 'Hari beruntun', 'kpi-streak'),
      kpi(String(s.overdue || 0), 'Terlambat', 'kpi-overdue')),
    h('div', { class: 'panel' }, h('h3', {}, 'Tugas selesai per hari'),
      h('div', { class: 'vbars', id: 'vbars' }, week.map(w => h('div', { class: 'vcol' },
        h('span', { class: 'n' }, String(w[1])),
        h('span', { class: 'bar' + (w[1] ? '' : ' zero'), style: { height: Math.max(4, Math.round(w[1] / max * 90)) + 'px' } }),
        h('span', { class: 'd' }, WEEKDAY_SHORT[new Date(dayNum(w[0]) * 86400000).getUTCDay()]))))),
    h('div', { class: 'panel' }, h('h3', {}, 'Tugas aktif menurut prioritas'),
      d.prio.map((n, i) => hbar(prioNames[i], n / pmax, String(n), 'p' + (i + 1)))),
    h('div', { class: 'panel' }, h('h3', {}, 'Progres per proyek'),
      projs.length ? projs.map(k => hbar('@' + k, d.projects[k].done / d.projects[k].total, d.projects[k].done + '/' + d.projects[k].total))
        : h('p', { class: 'insight-note' }, 'Belum ada proyek. Pilih atau isi proyek lewat tombol “Lainnya…” saat menambah tugas.')),
    h('p', { class: 'insight-note' }, d.pct === null ? T('Persentase tepat waktu muncul setelah ada tugas ber-deadline yang selesai.')
      : T('{done} dari {total} tugas ber-deadline selesai pada atau sebelum tanggalnya.', { done: d.onTime, total: d.finished }))));
}

/* ================= pilih banyak ================= */
function endSelect() { ui.select = false; ui.picked.clear(); }
function togglePick(id) {
  if (ui.picked.has(id)) ui.picked.delete(id); else ui.picked.add(id);
  const row = document.querySelector('.row[data-id="' + id + '"]');
  if (row) row.classList.toggle('picked', ui.picked.has(id));
  renderBulk();
}
function toggleSelectMode(force) {
  ui.select = force === undefined ? !ui.select : force;
  if (!ui.select) ui.picked.clear();
  render();
}
function renderBulk() {
  let bar = $('#bulkbar');
  if (!ui.select) { if (bar) bar.remove(); return; }
  const n = ui.picked.size;
  const doneView = ui.view === 'done';
  const act = (label, fn, cls, id) => h('button', { type: 'button', id, class: cls || '', disabled: n === 0, onclick: fn }, label);
  const fresh = h('div', { class: 'bulkbar', id: 'bulkbar', role: 'toolbar', 'aria-label': T('Aksi untuk tugas terpilih') },
    h('span', { class: 'cnt', id: 'bulk-count' }, n ? T('{n} dipilih', { n }) : 'Pilih tugas'),
    act(doneView ? 'Buka lagi' : 'Selesai', () => bulkDone(!doneView), '', 'bulk-done'),
    doneView ? null : act('Besok', bulkTomorrow, '', 'bulk-tomorrow'),
    act('Hapus', bulkDelete, 'danger', 'bulk-delete'),
    h('button', { type: 'button', id: 'bulk-cancel', onclick: () => toggleSelectMode(false) }, 'Batal'));
  if (bar) bar.replaceWith(fresh); else document.body.append(fresh);
}
async function bulkEach(label, fn, undo) {
  const ids = Array.from(ui.picked);
  if (!ids.length) return;
  const ok = await guarded(async () => { for (const id of ids) await fn(id); return true; });
  endSelect();
  await refresh();
  if (ok) toast(T(label, { n: ids.length }), undefined, undo ? undo() : undefined);
}
const bulkDone = done => bulkEach(done ? '{n} tugas selesai' : '{n} tugas dibuka lagi', id => api('POST', '/api/tasks/' + id + '/done', { done }));
const bulkTomorrow = () => bulkEach('{n} tugas ditunda ke besok', id => api('PATCH', '/api/tasks/' + id, { deadline: addDaysIso(1) }));
async function bulkDelete() {
  if (!ui.picked.size) return;
  const since = maxTrashId();
  await bulkEach('{n} tugas dipindah ke sampah', id => api('DELETE', '/api/tasks/' + id), () => undoDelete(since));
}
$('#select-btn').append(icon('select', 18));
$('#select-btn').addEventListener('click', () => toggleSelectMode());

/* ================= duplikat ================= */
async function duplicateTask(t) {
  const kids = (kidsMap()[t.id] || []).slice().sort((a, b) => a.id - b.id);
  const r = await guarded(async () => {
    const body = { title: (t.title + ' ' + T('(salinan)')).slice(0, 300), priority: t.priority, notes: t.notes, tags: t.tags };
    if (t.deadline) body.deadline = t.deadline;
    if (t.deadline && t.due_time) body.due_time = t.due_time;
    if (t.project) body.project = t.project;
    if (t.repeat) body.repeat = t.repeat;
    const created = await api('POST', '/api/tasks', body);
    for (const k of kids) await api('POST', '/api/tasks', { title: k.title, parent_id: created.task.id });
    await refresh();
    return created.task;
  });
  if (!r) return;
  toast(T('Tugas diduplikasi'), 'ok');
  openDrawer(r.id);
}

/* ================= aksi ================= */
function toast(message, kind, action) {
  const box = $('#toasts');
  const el = h('div', { class: 'toast' + (kind === 'error' ? ' error' : ''), role: kind === 'error' ? 'alert' : null }, h('span', {}, message));
  if (action) el.append(h('button', { type: 'button', onclick: () => { el.remove(); action.fn(); } }, action.label));
  box.append(el);
  setTimeout(() => el.remove(), action ? 7000 : 4500);
}
async function guarded(fn) {
  try { return await fn(); }
  catch (e) { toast(T(e.message), 'error'); await refresh(); return null; }
}

async function toggleDone(t) {
  const done = !t.done;
  const el = document.querySelector('.row[data-id="' + t.id + '"]');
  if (el && motionOK() && !el.classList.contains('leaving')) {
    const c = done && el.querySelector('.check');
    if (c) { c.classList.add('on', 'ticking'); await wait(170); } // centang digambar dulu, baru baris keluar
    el.classList.add('leaving'); await wait(190);
  }
  await guarded(async () => {
    const r = await api('POST', '/api/tasks/' + t.id + '/done', { done });
    await refresh();
    if (!done) return;
    buzz(12);
    const msg = r.next ? T('Selesai · berikutnya {when}', { when: relLabel(r.next.deadline).toLowerCase() }) : T('Tugas selesai');
    toast(msg, 'ok', { label: 'Urungkan', fn: () => undoDone(t, r.next) });
    if (ui.view === 'today' && !ui.project && !ui.tag && !ui.q.trim() && !visibleTasks().length) celebrate();
  });
}

function celebrate() {
  if (!motionOK()) return;
  const box = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  const colors = ['var(--accent)', 'var(--ok)', 'var(--p2)', 'var(--p1)', 'var(--p3)'];
  for (let i = 0; i < 30; i++) {
    const p = h('i');
    const angle = (Math.PI * 2 * i) / 30 + Math.random() * 0.4;
    const dist = 90 + Math.random() * 150;
    p.style.setProperty('--dx', Math.round(Math.cos(angle) * dist) + 'px');
    p.style.setProperty('--dy', Math.round(Math.sin(angle) * dist - 40 + Math.random() * 120) + 'px');
    p.style.setProperty('--rot', Math.round(Math.random() * 720 - 360) + 'deg');
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.round(Math.random() * 120) + 'ms';
    box.append(p);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 1700);
}

/* Tunda: ubah tanggal (dan jam bila perlu). Selalu bisa diurungkan. */
const SNOOZE_LABELS = { hour: '1 jam lagi', evening: 'sore ini (17:00)', tomorrow: 'besok', nextweek: 'minggu depan' };
async function snooze(t, kind) {
  const old = { deadline: t.deadline, due_time: t.due_time };
  let body;
  if (kind === 'hour') {
    const d = new Date(Date.now() + 3600000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    body = { deadline: localIso(d), due_time: hhmm(d) };
  } else if (kind === 'evening') {
    body = { deadline: state.today, due_time: '17:00' };
  } else if (kind === 'tomorrow') {
    body = { deadline: addDaysIso(1) };
  } else {
    body = { deadline: addDaysIso(7) };
  }
  const ok = await guarded(async () => { await api('PATCH', '/api/tasks/' + t.id, body); await refresh(); return true; });
  if (!ok) return;
  toast(T('Ditunda ke {when}', { when: T(SNOOZE_LABELS[kind]) }), 'ok', { label: 'Urungkan', fn: () => patchTask(t.id, { deadline: old.deadline, due_time: old.due_time }) });
}

/* Tugas terlambat -> hari ini. Jam yang sudah lewat dikosongkan agar tidak langsung terlambat lagi; Urungkan memulihkan keduanya. */
async function reschedOverdue(items) {
  const now = nowHHMM();
  const list = items.filter(t => t.parent_id === null && !t.done).map(t => ({ id: t.id, deadline: t.deadline, due_time: t.due_time }));
  if (!list.length) return;
  const ok = await guarded(async () => {
    for (const o of list) await api('PATCH', '/api/tasks/' + o.id, o.due_time && o.due_time < now ? { deadline: state.today, due_time: null } : { deadline: state.today });
    await refresh();
    return true;
  });
  if (!ok) return;
  toast(T('{n} tugas dipindah ke hari ini', { n: list.length }), 'ok', { label: 'Urungkan', fn: () => guarded(async () => {
    for (const o of list) await api('PATCH', '/api/tasks/' + o.id, { deadline: o.deadline, due_time: o.due_time });
    await refresh();
  }) });
}

async function undoDone(t, next) {
  await guarded(async () => {
    await api('POST', '/api/tasks/' + t.id + '/done', { done: false });
    if (next) {
      await api('DELETE', '/api/tasks/' + next.id, { permanent: true });
      await api('PATCH', '/api/tasks/' + t.id, { repeat: t.repeat });
    }
    await refresh();
  });
}
async function clearDone() {
  const since = maxTrashId();
  await guarded(async () => {
    const r = await api('POST', '/api/clear', {});
    await refresh();
    toast(T('{n} tugas selesai dipindah ke sampah', { n: r.cleared }), undefined, undoDelete(since) || undefined);
  });
}
async function deleteTask(t) {
  const since = maxTrashId();
  await guarded(async () => {
    await api('DELETE', '/api/tasks/' + t.id);
    if (t.id === ui.openId) closeDrawer();
    await refresh();
    toast(T('"{title}" dipindah ke sampah', { title: t.title }), undefined, undoDelete(since) || undefined);
  });
}
async function patchTask(id, body) {
  const ok = await guarded(async () => { await api('PATCH', '/api/tasks/' + id, body); await refresh(); return true; });
  if (!ok && ui.openId === id) buildDrawer(taskById(id));
}

/* ================= ubah nama proyek ================= */
const REN = { built: false };
function buildRename() {
  if (REN.built) return;
  REN.built = true;
  REN.input = h('input', { class: 'input', id: 'ren-name', maxlength: '60', autocomplete: 'off', 'aria-label': 'Nama baru proyek' });
  REN.msg = h('div', { class: 'login-err', id: 'ren-msg', role: 'status' });
  REN.el = h('div', { class: 'login', id: 'rename', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ren-title', hidden: '' },
    h('div', { class: 'login-card' },
      h('h2', { id: 'ren-title', tabindex: '-1' }, 'Ubah nama proyek'),
      h('p', { class: 'sub' }, 'Semua tugas di proyek ini ikut berganti nama. Memakai nama proyek lain akan menggabungkannya.'),
      REN.input, REN.msg,
      h('button', { class: 'btn primary', type: 'button', id: 'ren-save', onclick: () => submitRename() }, 'Simpan'),
      h('button', { class: 'btn', type: 'button', id: 'ren-cancel', onclick: closeRename }, 'Batal')));
  document.body.append(REN.el);
  REN.el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeRename(); } }, true);
  REN.input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitRename(); } });
}
function openRename() {
  if (!ui.project) return;
  buildRename();
  REN.old = ui.project;
  REN.input.value = ui.project;
  REN.msg.textContent = '';
  REN.el.hidden = false;
  window.TodoA11y.open(REN.el, { focus: '#ren-name', returnTo: () => $('#rename-btn') });
  REN.input.select();
}
function closeRename() {
  if (!REN.built || REN.el.hidden) return;
  REN.el.hidden = true;
  window.TodoA11y.close(REN.el);
}
async function submitRename() {
  const next = REN.input.value.replace(/\s+/g, ' ').trim();
  const old = REN.old;
  if (!next) { REN.msg.textContent = T('Nama proyek tidak boleh kosong.'); REN.msg.classList.remove('ok'); REN.input.focus(); return; }
  if (next === old) { closeRename(); return; }
  const ids = state.tasks.filter(t => (t.project || '').toLowerCase() === old.toLowerCase()).map(t => t.id);
  let failed = null;
  try { for (const id of ids) await api('PATCH', '/api/tasks/' + id, { project: next }); }
  catch (e) { failed = e; }
  if (!failed && Object.prototype.hasOwnProperty.call(pcMap, old.toLowerCase()) && !Object.prototype.hasOwnProperty.call(pcMap, next.toLowerCase())) {
    pcMap[next.toLowerCase()] = pcMap[old.toLowerCase()]; // warna ikut pindah
    try { localStorage.setItem(PC_KEY, JSON.stringify(pcMap)); } catch (e) { /* abaikan */ }
  }
  if (failed) { REN.msg.textContent = T(failed.message); REN.msg.classList.remove('ok'); await refresh(); return; }
  closeRename();
  ui.project = next;
  await refresh();
  toast(T('Proyek diganti nama menjadi {name}', { name: next }), 'ok');
}
$('#rename-btn').addEventListener('click', openRename);

/* ================= panel detail ================= */
function openDrawer(id) {
  const t = taskById(id);
  if (!t) return;
  ui.openId = id;
  buildDrawer(t);
  $('#drawer').classList.add('open');
  $('#drawer').setAttribute('aria-hidden', 'false');
  $('#scrim').classList.add('on');
  const trigger = document.activeElement;
  renderList();
  window.TodoA11y.open($('#drawer'), {
    returnTo: () => document.querySelector('#list .row[data-id="' + id + '"]') || (trigger && trigger.isConnected ? trigger : null),
  });
}
function closeDrawer() {
  ui.openId = null;
  $('#drawer').classList.remove('open');
  $('#drawer').setAttribute('aria-hidden', 'true');
  if (!document.body.classList.contains('nav-open')) $('#scrim').classList.remove('on');
  if (state.tasks.length) renderList();
  window.TodoA11y.close($('#drawer'));
}

const REPEAT_OPTIONS = [['', 'Tidak berulang'], ['1d', 'Setiap hari'], ['1w', 'Setiap minggu'], ['1m', 'Setiap bulan'], ['1y', 'Setiap tahun']];

function field(label, control, forId) {
  return h('div', { class: 'field' }, h('label', { for: forId || null }, label), control);
}

function buildDrawer(t) {
  const root = $('#drawer');
  root.replaceChildren();

  const titleInput = h('input', { class: 't-input', id: 'f-title', value: t.title, maxlength: '300', 'aria-label': 'Judul tugas',
    onchange: e => patchTask(t.id, { title: e.target.value }),
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); } });

  const prio = h('div', { class: 'seg', id: 'f-prio', role: 'group', 'aria-label': 'Prioritas' },
    [[1, 'Tinggi'], [2, 'Sedang'], [3, 'Rendah']].map(p =>
      h('button', { type: 'button', class: 'p' + p[0], 'aria-pressed': String(t.priority === p[0]), onclick: () => patchTask(t.id, { priority: p[0] }) }, p[1])));

  const dateInput = h('input', { class: 'input', id: 'f-deadline', type: 'date', value: t.deadline || '', onchange: e => patchTask(t.id, { deadline: e.target.value || null }) });
  const timeInput = h('input', { class: 'input', id: 'f-time', type: 'time', value: t.due_time || '', disabled: !t.deadline, 'aria-label': 'Jam deadline',
    onchange: e => patchTask(t.id, { due_time: e.target.value || null }) });
  const quickDates = h('div', { class: 'quick-dates' },
    [['Hari ini', 0], ['Besok', 1], ['Minggu depan', 7]].map(q => h('button', { class: 'btn small', type: 'button', onclick: () => patchTask(t.id, { deadline: addDaysIso(q[1]) }) }, q[0])),
    h('button', { class: 'btn small', id: 'f-clear-date', type: 'button', hidden: !t.deadline, onclick: () => patchTask(t.id, { deadline: null }) }, 'Hapus tanggal'));

  const projectList = h('datalist', { id: 'project-list' }, state.projects.map(p => h('option', { value: p.name })));
  const projectInput = h('input', { class: 'input', id: 'f-project', list: 'project-list', value: t.project || '', placeholder: 'mis. rumah', maxlength: '60', onchange: e => patchTask(t.id, { project: e.target.value.trim() || null }) });
  const tagsInput = h('input', { class: 'input', id: 'f-tags', value: t.tags.join(', '), placeholder: 'tagihan, penting',
    onchange: e => patchTask(t.id, { tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }) });

  const options = REPEAT_OPTIONS.slice();
  if (t.repeat && !options.some(o => o[0] === t.repeat)) options.push([t.repeat, ruleLabel(t.repeat)]);
  const repeatSel = h('select', { id: 'f-repeat', onchange: e => patchTask(t.id, { repeat: e.target.value || null }) },
    options.map(o => h('option', { value: o[0], selected: o[0] === (t.repeat || '') }, o[1])));

  const notes = h('textarea', { id: 'f-notes', maxlength: '5000', placeholder: 'Catatan, tautan, atau detail lain…', onchange: e => patchTask(t.id, { notes: e.target.value }) });
  notes.value = t.notes;

  const subInput = h('input', { class: 'input', id: 'f-sub', placeholder: 'Tambah subtugas lalu tekan Enter', maxlength: '300', autocomplete: 'off',
    onkeydown: async e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const text = e.target.value.trim();
      if (!text) return;
      e.target.value = '';
      await guarded(async () => { await api('POST', '/api/tasks', { title: text, parent_id: t.id }); await refresh(); });
      const again = $('#f-sub');
      if (again) again.focus();
    } });

  root.append(
    h('div', { class: 'drawer-head' },
      checkButton(t),
      h('span', { class: 'sub', id: 'drawer-status' }, ''),
      h('div', { class: 'spacer' }),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Tutup panel', onclick: closeDrawer }, icon('x', 18))),
    titleInput,
    field('Prioritas', prio),
    h('div', { class: 'field' }, h('label', { for: 'f-deadline' }, 'Deadline'), dateInput, timeInput, quickDates),
    field('Tunda', h('div', { class: 'snooze', id: 'f-snooze' },
      [['hour', '+1 jam'], ['evening', 'Sore ini'], ['tomorrow', 'Besok'], ['nextweek', 'Minggu depan']].map(q =>
        h('button', { class: 'btn small', type: 'button', 'data-snooze': q[0], disabled: t.done, onclick: () => snooze(taskById(t.id) || t, q[0]) }, icon('clock', 12), q[1])))),
    h('div', { class: 'two' },
      field('Proyek', h('div', {}, projectInput, projectList), 'f-project'),
      field('Ulangi', repeatSel, 'f-repeat')),
    field('Tag (pisahkan dengan koma)', tagsInput, 'f-tags'),
    field('Catatan', notes, 'f-notes'),
    h('div', { class: 'field' }, h('div', { class: 'label' }, 'Subtugas'), h('div', { class: 'subs', id: 'subs' }), h('div', { class: 'mt8' }, subInput)),
    h('div', { class: 'foot-note', id: 'foot-note' }),
    h('div', { class: 'drawer-actions' },
      h('button', { class: 'btn', id: 'f-dup', type: 'button', onclick: () => duplicateTask(taskById(t.id) || t) }, icon('copy', 14), 'Duplikat'),
      h('button', { class: 'btn danger', type: 'button', onclick: () => deleteTask(t) }, 'Hapus tugas')));
  renderSubs();
}

/* Samakan isi panel dengan data terbaru tanpa membangun ulang (supaya fokus ketikan tidak hilang). */
function syncDrawer() {
  const t = taskById(ui.openId);
  if (!t || !$('#f-title')) return;
  const idle = el => el && document.activeElement !== el;
  if (idle($('#f-title'))) $('#f-title').value = t.title;
  if (idle($('#f-deadline'))) $('#f-deadline').value = t.deadline || '';
  if (idle($('#f-time'))) $('#f-time').value = t.due_time || '';
  $('#f-time').disabled = !t.deadline;
  if (idle($('#f-project'))) $('#f-project').value = t.project || '';
  if (idle($('#f-tags'))) $('#f-tags').value = t.tags.join(', ');
  if (idle($('#f-notes'))) $('#f-notes').value = t.notes;
  const repeat = $('#f-repeat');
  if (idle(repeat) && Array.prototype.some.call(repeat.options, o => o.value === (t.repeat || ''))) repeat.value = t.repeat || '';
  $('#f-clear-date').hidden = !t.deadline;
  Array.prototype.forEach.call($('#f-prio').children, (btn, i) => btn.setAttribute('aria-pressed', String(t.priority === i + 1)));
  renderSubs();
}

function renderSubs() {
  const t = taskById(ui.openId);
  const box = $('#subs');
  if (!t || !box) return;
  const subs = (kidsMap()[t.id] || []).slice().sort((a, b) => a.id - b.id);
  box.replaceChildren(...subs.map(s => h('div', { class: 'sub-row' + (s.done ? ' done' : '') },
    checkButton(s), h('span', { class: 'st' }, raw(s.title)),
    h('button', { class: 'x', type: 'button', 'aria-label': T('Hapus subtugas {title}', { title: s.title }), onclick: () => guarded(async () => { await api('DELETE', '/api/tasks/' + s.id); await refresh(); }) }, icon('x', 14)))));
  const status = $('#drawer-status');
  if (status) status.textContent = t.done ? T('Selesai') : (t.sub_total ? T('{done} dari {total} subtugas', { done: t.sub_done, total: t.sub_total }) : T('Belum selesai'));
  const foot = $('#foot-note');
  if (foot) foot.textContent = T('Dibuat {date}', { date: fmtDate(t.created_at.slice(0, 10)) }) + (t.completed_at ? ' · ' + T('Selesai {date}', { date: fmtDate(t.completed_at.slice(0, 10)) }) : '');
  const check = $('.drawer-head .check');
  if (check) {
    check.className = 'check p' + t.priority + (t.done ? ' on' : '');
    check.setAttribute('aria-checked', String(t.done));
    check.onclick = e => { e.stopPropagation(); toggleDone(t); };
  }
}

/* ================= sidebar mobile, tema, pintasan ================= */
function toggleNav(open) {
  document.body.classList.toggle('nav-open', open);
  $('#scrim').classList.toggle('on', open || ui.openId !== null);
}
/* Dipanggil dari ketukan notifikasi: buka panel tugas (coba lagi sekali bila data belum selesai dimuat). */
window.openTaskById = id => {
  const go = () => { if (taskById(id)) { openDrawer(id); return true; } return false; };
  if (!go()) setTimeout(go, 800);
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
const Q_REPEATS = [['Harian', '1d'], ['Mingguan', '1w'], ['Bulanan', '1m']];
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
const ACCENTS = [['indigo', 'Biru tinta'], ['teal', 'Hijau daun'], ['rose', 'Merah bata'], ['amber', 'Cokelat kopi'], ['ocean', 'Arang']];
function cycleAccent() {
  const cur = document.documentElement.dataset.accent || 'indigo';
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

$('#brand-mark').append(icon('sparkle', 20)); // matahari bercentang = logo
$('#menu-btn').append(icon('menu', 18));
$('#menu-btn').addEventListener('click', () => toggleNav(true));
$('#scrim').addEventListener('click', () => { toggleNav(false); if (ui.openId !== null) closeDrawer(); });
$('#theme-btn').addEventListener('click', toggleTheme);
$('#search').addEventListener('input', e => { ui.q = e.target.value; renderList(); });
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

/* ================= tambah banyak + templat ================= */
const BULK = { built: false, timer: 0, seq: 0 };
const BULK_EXAMPLE = 'Siapkan presentasi\n  Susun slide\n  Latihan bicara\nBeli kertas\n- [x] Kirim tugas kemarin';

function buildBulk() {
  if (BULK.built) return;
  BULK.built = true;
  const text = h('textarea', { class: 'input', id: 'bulk-text', rows: '7', 'aria-label': T('Daftar tugas, satu per baris'), placeholder: T(BULK_EXAMPLE), maxlength: '20000' });
  const msg = h('div', { class: 'login-err', id: 'bulk-msg', role: 'status' });
  const preview = h('div', { class: 'bulk-preview', id: 'bulk-preview', 'aria-live': 'polite' });
  const add = h('button', { class: 'btn primary', type: 'button', id: 'bulk-add', disabled: true, onclick: () => bulkAdd() }, 'Tambahkan');
  const name = h('input', { class: 'input', id: 'bulk-tpl-name', maxlength: '60', 'aria-label': T('Nama templat'), placeholder: 'Nama templat, mis. Rapat mingguan' });
  const save = h('button', { class: 'btn', type: 'button', id: 'bulk-save-tpl', onclick: () => saveTemplate() }, 'Simpan sebagai templat');
  const tpls = h('div', { class: 'tpl-list', id: 'tpl-list' });
  const close = h('button', { class: 'btn', type: 'button', id: 'bulk-close', onclick: closeBulk }, 'Tutup');
  BULK.el = h('div', { class: 'login', id: 'bulk', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'bulk-title', hidden: '' },
    h('div', { class: 'login-card bulk-card' },
      h('h2', { id: 'bulk-title', tabindex: '-1' }, 'Tambah banyak tugas'),
      h('p', { class: 'sub' }, 'Tempel atau ketik satu tugas per baris. Baris yang menjorok menjadi subtugas. Tanggal, prioritas, dan proyek yang kamu pilih di tombol pilihan berlaku untuk semuanya.'),
      text, msg, preview, add,
      h('h3', {}, 'Templat'),
      h('p', { class: 'sub' }, 'Simpan daftar di atas sebagai templat untuk dipakai lagi. Pilihan tanggal diambil saat templat dipakai. Templat hanya ada di HP ini.'),
      name, save, tpls, close));
  document.body.append(BULK.el);
  BULK.text = text; BULK.msg = msg; BULK.preview = preview; BULK.add = add; BULK.name = name; BULK.tpls = tpls;
  text.addEventListener('input', () => { clearTimeout(BULK.timer); BULK.timer = setTimeout(refreshBulkPreview, 150); });
  BULK.el.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeBulk(); }
  }, true);
}
function bulkSay(t, bad) { BULK.msg.textContent = t; BULK.msg.classList.toggle('ok', !bad && !!t); }

async function refreshBulkPreview() {
  const my = ++BULK.seq;
  const value = BULK.text.value;
  if (!value.trim()) { BULK.preview.replaceChildren(); bulkSay(''); BULK.add.disabled = true; BULK.add.textContent = T('Tambahkan'); return; }
  let r = null, err = null;
  try { r = await api('POST', '/api/tasks/bulk', { text: value, dry_run: true, plain: true, defaults: bulkDefaults() }); } catch (e) { err = e; }
  if (my !== BULK.seq) return; // jawaban usang
  if (err) { BULK.preview.replaceChildren(); bulkSay(T(err.message), true); BULK.add.disabled = true; BULK.add.textContent = T('Tambahkan'); return; }
  bulkSay('');
  BULK.add.disabled = false;
  BULK.add.textContent = T('Tambahkan {n} tugas', { n: r.count });
  BULK.preview.replaceChildren(h('ul', { class: 'bulk-list' }, r.preview.map(p => h('li', { class: p.sub ? 'sub' : '' },
    h('span', { class: 'bt' }, raw((p.done ? '✓ ' : '') + p.title)),
    h('span', { class: 'bm' }, [p.deadline ? fmtDate(p.deadline) + (p.due_time ? ' ' + p.due_time : '') : '', p.priority === 1 ? T('prioritas tinggi') : p.priority === 3 ? T('prioritas rendah') : '',
      p.project ? '@' + p.project : '', p.tags.map(t => '#' + t).join(' '), p.repeat ? '↻ ' + p.repeat : ''].filter(Boolean).join(' · ')))))); 
}

async function renderTemplates() {
  let list = [];
  try { list = (await api('GET', '/api/templates')).templates; } catch (e) { list = []; }
  BULK.tpls.replaceChildren(...(list.length ? list.map(t => h('div', { class: 'tpl-row', 'data-tpl-id': t.id },
    h('div', { class: 'tpl-main' }, h('div', { class: 'tpl-name' }, raw(t.name)), h('div', { class: 'tpl-meta' }, T('{n} tugas', { n: t.count }))),
    h('button', { class: 'btn small', type: 'button', 'data-act': 'use', 'aria-label': T('Pakai templat: {name}', { name: t.name }), onclick: () => useTemplate(t) }, 'Pakai'),
    h('button', { class: 'btn small', type: 'button', 'data-act': 'edit', 'aria-label': T('Ubah templat: {name}', { name: t.name }), onclick: () => { BULK.text.value = t.text; BULK.name.value = t.name; refreshBulkPreview(); BULK.text.focus(); } }, 'Ubah'),
    h('button', { class: 'btn small danger', type: 'button', 'data-act': 'del', 'aria-label': T('Hapus templat: {name}', { name: t.name }), onclick: () => deleteTemplate(t) }, 'Hapus')))
    : [h('p', { class: 'sub', id: 'tpl-empty' }, 'Belum ada templat.')]));
}

function openBulk(prefill) {
  buildBulk();
  if (typeof window.closeNav === 'function') window.closeNav();
  if (typeof prefill === 'string') BULK.text.value = prefill;
  bulkSay('');
  BULK.el.hidden = false;
  window.TodoA11y.open(BULK.el, { focus: '#bulk-text', returnTo: () => { const b = $('#bulk-btn'); return b && !b.closest('[inert]') ? b : $('#quick-input'); } });
  renderTemplates();
  refreshBulkPreview();
}
function closeBulk() {
  if (!BULK.built || BULK.el.hidden) return;
  BULK.el.hidden = true;
  window.TodoA11y.close(BULK.el);
}

/* Tugas hasil pembuatan massal: tampilkan ringkasan + "Urungkan" (hapus permanen, karena baru dibuat). */
async function afterBulkCreate(r) {
  closeBulk();
  await refresh();
  const roots = r.created.filter(t => t.parent_id === null).map(t => t.id);
  toast(T('{n} tugas ditambahkan', { n: r.count }), 'ok', { label: 'Urungkan', fn: () => guarded(async () => {
    for (const id of roots) await api('DELETE', '/api/tasks/' + id, { permanent: true });
    await refresh();
  }) });
}
async function bulkAdd() {
  const value = BULK.text.value;
  const r = await guarded(async () => api('POST', '/api/tasks/bulk', { text: value, plain: true, defaults: bulkDefaults() }));
  if (!r) return;
  BULK.text.value = '';
  $('#quick-input').value = '';
  await afterBulkCreate(r);
}
async function saveTemplate() {
  const nameV = BULK.name.value.trim();
  try {
    const r = await api('POST', '/api/templates', { name: nameV, text: BULK.text.value, plain: true });
    bulkSay(T('Templat "{name}" tersimpan.', { name: r.template.name }));
    BULK.name.value = '';
    await renderTemplates();
  } catch (e) { bulkSay(T(e.message), true); }
}
async function useTemplate(t) {
  const r = await guarded(async () => api('POST', '/api/templates/' + t.id + '/use', { plain: true, defaults: bulkDefaults() }));
  if (r) await afterBulkCreate(r);
}
async function deleteTemplate(t) {
  if (!confirm(T('Hapus templat "{name}"?', { name: t.name }))) return;
  try { await api('DELETE', '/api/templates/' + t.id); await renderTemplates(); bulkSay(''); } catch (e) { bulkSay(T(e.message), true); }
}

/* ================= lembar "Atur detail": tambah tugas tanpa simbol, cukup pilih opsi ================= */
const DET = { built: false, v: null };
const DET_DATES = [['Hari ini', 0], ['Besok', 1], ['Lusa', 2], ['Minggu depan', 7]];
const DET_TIMES = [['Pagi 08:00', '08:00'], ['Siang 12:00', '12:00'], ['Sore 17:00', '17:00']];

function buildDetail() {
  if (DET.built) return;
  DET.built = true;
  const msg = h('div', { class: 'login-err', id: 'det-msg', role: 'status' });
  DET.title = h('input', { class: 'input', id: 'det-title', maxlength: '300', autocomplete: 'off', placeholder: 'Apa yang perlu dikerjakan?', 'aria-label': 'Judul tugas',
    oninput: e => { DET.v.title = e.target.value; } });
  DET.prio = h('div', { class: 'seg', id: 'det-prio', role: 'group', 'aria-label': 'Prioritas' },
    [[1, 'Tinggi'], [2, 'Sedang'], [3, 'Rendah']].map(p => h('button', { type: 'button', class: 'p' + p[0], 'data-p': p[0], onclick: () => { DET.v.priority = p[0]; paintDetail(); } }, p[1])));
  DET.dates = h('div', { class: 'quick-dates', id: 'det-dates' },
    DET_DATES.map(d => h('button', { class: 'btn small', type: 'button', 'data-days': d[1], onclick: () => { DET.v.deadline = addDaysIso(d[1]); paintDetail(); } }, d[0])),
    h('button', { class: 'btn small', type: 'button', id: 'det-nodate', onclick: () => { DET.v.deadline = ''; DET.v.time = ''; paintDetail(); } }, 'Tanpa tanggal'));
  DET.date = h('input', { class: 'input', id: 'det-date', type: 'date', 'aria-label': 'Tanggal deadline', onchange: e => { DET.v.deadline = e.target.value; if (!e.target.value) DET.v.time = ''; paintDetail(); } });
  DET.time = h('input', { class: 'input', id: 'det-time', type: 'time', 'aria-label': 'Jam deadline', onchange: e => { DET.v.time = e.target.value; paintDetail(); } });
  DET.times = h('div', { class: 'quick-dates', id: 'det-times' },
    DET_TIMES.map(t => h('button', { class: 'btn small', type: 'button', 'data-time': t[1], onclick: () => { if (!DET.v.deadline) DET.v.deadline = state.today; DET.v.time = t[1]; paintDetail(); } }, t[0])));
  DET.project = h('input', { class: 'input', id: 'det-project', list: 'det-project-list', maxlength: '60', placeholder: 'mis. rumah', 'aria-label': 'Proyek', oninput: e => { DET.v.project = e.target.value.trim(); paintDetail(true); } });
  DET.projChips = h('div', { class: 'quick-dates', id: 'det-projects' });
  DET.tags = h('input', { class: 'input', id: 'det-tags', placeholder: 'tagihan, penting', 'aria-label': 'Tag (pisahkan dengan koma)', oninput: e => { DET.v.tags = e.target.value; } });
  DET.repeat = h('select', { id: 'det-repeat', 'aria-label': 'Ulangi', onchange: e => { DET.v.repeat = e.target.value; } },
    REPEAT_OPTIONS.map(o => h('option', { value: o[0] }, o[1])));
  DET.add = h('button', { class: 'btn primary', type: 'button', id: 'det-add', onclick: () => submitDetail() }, 'Tambahkan tugas');
  DET.msg = msg;
  DET.el = h('div', { class: 'login', id: 'detail', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'det-heading', hidden: '' },
    h('div', { class: 'login-card bulk-card' },
      h('h2', { id: 'det-heading', tabindex: '-1' }, 'Tugas baru'),
      h('p', { class: 'sub' }, 'Pilih opsinya. Yang tidak diisi dibiarkan kosong.'),
      field('Judul', DET.title, 'det-title'),
      field('Prioritas', DET.prio),
      h('div', { class: 'field' }, h('label', { for: 'det-date' }, 'Deadline'), DET.dates, h('div', { class: 'det-row' }, DET.date, DET.time), DET.times),
      field('Proyek', h('div', {}, DET.project, h('datalist', { id: 'det-project-list' }, state.projects.map(p => h('option', { value: p.name }))), DET.projChips), 'det-project'),
      h('div', { class: 'two' }, field('Tag (pisahkan dengan koma)', DET.tags, 'det-tags'), field('Ulangi', DET.repeat, 'det-repeat')),
      msg, DET.add,
      h('button', { class: 'btn', type: 'button', id: 'det-bulk', onclick: () => { closeDetail(); openBulk(); } }, 'Tambah banyak sekaligus atau pakai templat'),
      h('button', { class: 'btn', type: 'button', id: 'det-close', onclick: closeDetail }, 'Batal')));
  document.body.append(DET.el);
  DET.el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeDetail(); } }, true);
  DET.el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === DET.title) { e.preventDefault(); submitDetail(); } });
}
function paintDetail(keepFocus) {
  const v = DET.v;
  if (DET.title.value !== v.title) DET.title.value = v.title;
  Array.prototype.forEach.call(DET.prio.children, b => b.setAttribute('aria-pressed', String(Number(b.dataset.p) === v.priority)));
  DET.date.value = v.deadline; DET.time.value = v.time; DET.time.disabled = !v.deadline;
  Array.prototype.forEach.call(DET.dates.querySelectorAll('[data-days]'), b => b.setAttribute('aria-pressed', String(!!v.deadline && v.deadline === addDaysIso(Number(b.dataset.days)))));
  DET.dates.querySelector('#det-nodate').setAttribute('aria-pressed', String(!v.deadline));
  Array.prototype.forEach.call(DET.times.children, b => b.setAttribute('aria-pressed', String(v.time === b.dataset.time)));
  if (!keepFocus && DET.project.value !== v.project) DET.project.value = v.project;
  DET.projChips.replaceChildren(...state.projects.slice(0, 6).map(p => h('button', { class: 'btn small', type: 'button', 'aria-pressed': String(v.project.toLowerCase() === p.name.toLowerCase()),
    onclick: () => { v.project = v.project.toLowerCase() === p.name.toLowerCase() ? '' : p.name; paintDetail(); } }, raw('@' + p.name))));
  if (DET.tags.value !== v.tags) DET.tags.value = v.tags;
  if (DET.repeat.value !== v.repeat && Array.prototype.some.call(DET.repeat.options, o => o.value === v.repeat)) DET.repeat.value = v.repeat;
}
async function openDetail() {
  buildDetail();
  if (typeof window.closeNav === 'function') window.closeNav();
  const v = { title: $('#quick-input').value.trim(), priority: OPT.priority || 2, deadline: OPT.deadline, time: OPT.time, project: OPT.project, tags: OPT.tags.join(', '), repeat: OPT.repeat };
  const d = quickDefaults();
  if (!v.project && d.project) v.project = d.project;
  if (!v.tags && d.tags) v.tags = d.tags.join(', ');
  if (!v.deadline && d.deadline) v.deadline = d.deadline === 'hari ini' ? state.today : d.deadline;
  DET.v = v;
  DET.msg.textContent = '';
  paintDetail();
  DET.el.hidden = false;
  window.TodoA11y.open(DET.el, { focus: '#det-title', returnTo: () => $('#detail-btn') });
}
function closeDetail() {
  if (!DET.built || DET.el.hidden) return;
  DET.el.hidden = true;
  window.TodoA11y.close(DET.el);
}
async function submitDetail() {
  const v = DET.v;
  const title = v.title.trim();
  if (!title) { DET.msg.textContent = T('Judul tugas wajib diisi.'); DET.msg.classList.remove('ok'); DET.title.focus(); return; }
  const body = { title, priority: v.priority };
  if (v.deadline) body.deadline = v.deadline;
  if (v.deadline && v.time) body.due_time = v.time;
  if (v.project) body.project = v.project;
  const tags = v.tags.split(',').map(x => x.trim().replace(/^#/, '')).filter(Boolean);
  if (tags.length) body.tags = tags;
  if (v.repeat) body.repeat = v.repeat;
  let r;
  try { r = await api('POST', '/api/tasks', body); }
  catch (e) { DET.msg.textContent = T(e.message); DET.msg.classList.remove('ok'); return; }
  closeDetail();
  $('#quick-input').value = '';
  resetOpt();
  renderQuickChips();
  await refresh();
  const visible = visibleTasks().some(t => t.id === r.task.id);
  toast(T('Ditambahkan: {title}', { title: r.task.title }), 'ok',
    visible ? null : { label: 'Lihat', fn: () => { ui.q = ''; $('#search').value = ''; selectView('all'); } });
}
$('#detail-btn').addEventListener('click', () => openDetail());

$('#bulk-btn').addEventListener('click', () => openBulk($('#quick-input').value.trim() ? $('#quick-input').value : undefined));
$('#quick-input').addEventListener('paste', e => {
  const data = e.clipboardData ? e.clipboardData.getData('text') : '';
  if (data && data.split(/\r\n?|\n/).filter(l => l.trim()).length > 1) { e.preventDefault(); openBulk(data); }
});

document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
  if (e.key === 'Escape') {
    if (ui.openId !== null) closeDrawer();
    else if (ui.select) toggleSelectMode(false);
    else if (document.body.classList.contains('nav-open')) toggleNav(false);
    else if (typing) e.target.blur();
    return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'n') { e.preventDefault(); $('#quick-input').focus(); }
  else if (e.key === '/') { e.preventDefault(); openSearch(true); }
  else if (e.key === 't') toggleTheme();
  else if (e.key === 'v') toggleSelectMode();
  else if (e.key === 'j' || e.key === 'k') {
    const rows = Array.from(document.querySelectorAll('#list .row'));
    if (!rows.length) return;
    const cur = rows.indexOf(document.activeElement);
    const next = cur === -1 ? 0 : Math.max(0, Math.min(rows.length - 1, cur + (e.key === 'j' ? 1 : -1)));
    e.preventDefault();
    rows[next].focus();
    rows[next].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'x' || e.key === 'e') {
    const row = document.activeElement && document.activeElement.closest && document.activeElement.closest('#list .row');
    const t = row && taskById(Number(row.dataset.id));
    if (!t) return;
    e.preventDefault();
    if (e.key === 'e') { openDrawer(t.id); return; }
    const rows = Array.from(document.querySelectorAll('#list .row'));
    const idx = rows.indexOf(row);
    toggleDone(t).then(() => {
      const rs = Array.from(document.querySelectorAll('#list .row'));
      if (rs.length) rs[Math.min(idx, rs.length - 1)].focus();
    });
  }
});

document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
setInterval(() => {
  const el = document.activeElement;
  const editing = el && el.closest && el.closest('#drawer, .subs-inline') && el.tagName !== 'BUTTON';
  if (!document.hidden && !editing) refresh();
}, 20000);

/* ---- bahasa ---- */
function applyLangButton() {
  const L = TodoI18n.state.lang;
  $('#lang-btn .lbl').textContent = T('Bahasa: {name}', { name: L === 'id' ? 'Indonesia' : 'English' });
}
$('#lang-btn').addEventListener('click', () => {
  const next = TodoI18n.state.lang === 'id' ? 'en' : 'id';
  if (TodoI18n.setLang(next)) location.reload();
  else toast(T('Tidak bisa menyimpan pilihan bahasa.'), 'error');
});
TodoI18n.translateStatic();
applyLangButton();

refresh();
