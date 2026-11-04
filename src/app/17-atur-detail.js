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
  DET.rc = repeatControl('det-repeat', rule => { DET.v.repeat = rule; });
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
      h('div', { class: 'two' }, field('Tag (pisahkan dengan koma)', DET.tags, 'det-tags'), field('Ulangi', DET.rc.el, 'det-repeat')),
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
  DET.rc.set(v.repeat);
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
