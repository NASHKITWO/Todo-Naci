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
function tuntasNow() { return window.TodoCore.tuntasStats(state.tasks, state.today); }
function streakDays() { return tuntasNow().streak; }
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
  if (open.length) {
    meta.push(h('button', { class: 'chip', type: 'button', id: 'hero-tomorrow', onclick: () => moveRemainingTomorrow() },
      icon('clock', 12), h('span', { class: 'ell' }, T('Pindah sisa ke besok'))));
  }
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

/* Pengingat butuh izin notifikasi. Bila ditolak dan ada tugas berjam, beri tahu cara mengaktifkannya. */
function renderNotifBanner() {
  const b = $('#notif-banner');
  const show = window.__notifDenied === true && !ui.notifDismissed && state.tasks.some(t => !t.done && t.deadline && t.due_time);
  b.hidden = !show;
  if (!show) return;
  b.replaceChildren(
    h('span', {}, 'Notifikasi dimatikan, jadi pengingat tidak akan berbunyi. Aktifkan di Setelan > Aplikasi > Tuntas Harian > Notifikasi.'),
    h('button', { class: 'btn small', type: 'button', id: 'notif-dismiss', onclick: () => { ui.notifDismissed = true; renderNotifBanner(); } }, 'Tutup'));
}
window.addEventListener('todo-notif-state', renderNotifBanner);

/* Data tugas di perangkat sempat rusak: tawarkan pemulihan dari snapshot, bagikan salinan rusak, atau buang salinannya. */
function renderDataBanner() {
  const b = $('#data-banner');
  const issue = typeof window.todoDataIssue === 'function' ? window.todoDataIssue() : null;
  b.hidden = !issue;
  if (!issue) return;
  b.replaceChildren(
    h('span', {}, T(issue.empty ? 'Data tugas di perangkat tidak terbaca, jadi aplikasi dimulai kosong. Salinan data yang rusak disimpan.' : 'Ada salinan data rusak yang disimpan di perangkat.')),
    issue.snapshot && issue.empty ? h('button', { class: 'btn small', type: 'button', id: 'data-recover', onclick: async () => { if (window.todoRecoverLatest()) { await refresh(); toast(T('Data dipulihkan dari snapshot terbaru.'), 'ok'); } } }, 'Pulihkan dari snapshot') : null,
    h('button', { class: 'btn small', type: 'button', id: 'data-share', onclick: () => window.todoShareCorrupt() }, 'Bagikan salinan'),
    h('button', { class: 'btn small', type: 'button', id: 'data-drop', onclick: () => { window.todoDropCorrupt(); renderDataBanner(); } }, 'Buang salinan'));
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
  renderNotifBanner();
  renderDataBanner();
  if (ui.openId !== null) syncDrawer();
}

function selectView(key) { ui.fade = true; endSelect(); if (key === 'calendar' && !ui.day) ui.day = state.today; ui.view = key; ui.project = null; ui.tag = null; toggleNav(false); render(); }
function selectProject(name) { ui.fade = true; endSelect(); ui.project = name; ui.tag = null; if (ui.view === 'today' || ui.view === 'upcoming') ui.view = 'all'; toggleNav(false); render(); }
function selectTag(name) { ui.fade = true; endSelect(); ui.tag = ui.tag === name ? null : name; ui.project = null; if (ui.view === 'today' || ui.view === 'upcoming') ui.view = 'all'; toggleNav(false); render(); }
