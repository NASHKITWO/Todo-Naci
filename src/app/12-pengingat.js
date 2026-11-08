/* ================= pengingat ================= */
const REMIND_LABELS = [[-1, 'Tanpa pengingat'], [0, 'Tepat waktu saja'], [5, '5 menit sebelumnya'], [15, '15 menit sebelumnya'],
  [30, '30 menit sebelumnya'], [60, '1 jam sebelumnya'], [1440, '1 hari sebelumnya']];

async function moveRemainingTomorrow() {
  if (typeof window.todoMoveRemaining !== 'function') return;
  const list = await guarded(async () => { const l = await window.todoMoveRemaining(); await refresh(); return l; });
  if (!list) return;
  if (!list.length) { toast(T('Tidak ada tugas tersisa untuk dipindah.'), 'ok'); return; }
  toast(T('{n} tugas dipindah ke besok', { n: list.length }), 'ok', { label: 'Urungkan', fn: () => guarded(async () => {
    for (const o of list) await api('PATCH', '/api/tasks/' + o.id, { deadline: o.deadline, due_time: o.due_time });
    await refresh();
  }) });
}

const REM = { built: false };
function buildRemind() {
  if (REM.built) return;
  REM.built = true;
  REM.evOn = h('input', { type: 'checkbox', id: 'rem-ev-on', onchange: () => { paintRemind(); saveRemind(); } });
  REM.evHour = h('select', { id: 'rem-ev-hour', 'aria-label': 'Jam ringkasan malam', onchange: () => saveRemind() },
    [17, 18, 19, 20, 21, 22].map(x => h('option', { value: String(x) }, String(x).padStart(2, '0') + ':00')));
  REM.lead = h('select', { id: 'rem-lead', 'aria-label': 'Pengingat bawaan', onchange: () => saveRemind() },
    REMIND_LABELS.map(o => h('option', { value: String(o[0]) }, T(o[1]))));
  REM.el = h('div', { class: 'login', id: 'remind', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rem-title', hidden: '' },
    h('div', { class: 'login-card' },
      h('h2', { id: 'rem-title', tabindex: '-1' }, 'Pengingat'),
      h('p', { class: 'sub' }, 'Berlaku untuk tugas yang punya jam. Tiap tugas bisa punya pengingat sendiri di panel detailnya. Pengaturan ikut tersinkron bersama tugas bila sinkronisasi aktif.'),
      field('Pengingat bawaan', REM.lead, 'rem-lead'),
      h('label', { class: 'switch-row', for: 'rem-ev-on' }, REM.evOn,
        h('span', {}, h('b', {}, T('Ringkasan malam')), h('small', {}, T('Ringkasan malam memberi tahu tugas yang belum tuntas, dengan tombol "Pindah ke besok".')))),
      field('Kirim pukul', REM.evHour, 'rem-ev-hour'),
      h('button', { class: 'btn primary', type: 'button', id: 'rem-close', onclick: closeRemind }, 'Selesai')));
  document.body.append(REM.el);
  REM.el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeRemind(); } }, true);
}
function paintRemind() { REM.evHour.disabled = !REM.evOn.checked; }
function saveRemind() {
  if (!window.todoRemind) return;
  window.todoRemind.set({ lead: Number(REM.lead.value), evening: { on: REM.evOn.checked, hour: Number(REM.evHour.value) } });
}
function openRemind() {
  window.closeNav(); // dibuka dari menu samping: jangan biarkan menu terbuka di belakang dialog
  buildRemind();
  const p = window.todoRemind ? window.todoRemind.get() : { lead: 30, evening: { on: true, hour: 20 } };
  REM.lead.value = String(p.lead); REM.evOn.checked = p.evening.on; REM.evHour.value = String(p.evening.hour);
  paintRemind();
  REM.el.hidden = false;
  window.TodoA11y.open(REM.el, { focus: '#rem-lead', returnTo: () => $('#remind-btn') });
}
function closeRemind() {
  if (!REM.built || REM.el.hidden) return;
  REM.el.hidden = true;
  window.TodoA11y.close(REM.el);
}
$('#remind-btn').addEventListener('click', openRemind);
/* Pengaturan baru dari perangkat lain (sinkron): samakan dialog/panel yang sedang terbuka. */
window.addEventListener('todo-remind-changed', () => {
  if (REM.built && !REM.el.hidden) {
    const p = window.todoRemind.get();
    REM.lead.value = String(p.lead); REM.evOn.checked = p.evening.on; REM.evHour.value = String(p.evening.hour); paintRemind();
  }
  const sel = $('#f-remind');
  if (sel && ui.openId != null) { const v = window.todoRemind.leadOf(ui.openId); sel.value = v === null ? '' : String(v); }
});
