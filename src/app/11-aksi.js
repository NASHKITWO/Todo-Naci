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
