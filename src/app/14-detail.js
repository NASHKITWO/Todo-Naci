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

const REPEAT_OPTIONS = [['', 'Tidak berulang'], ['1d', 'Setiap hari'], ['wd', 'Hari kerja (Sen–Jum)'], ['dow', 'Hari tertentu…'],
  ['1w', 'Setiap minggu'], ['2w', 'Setiap 2 minggu'], ['1m', 'Setiap bulan'], ['1y', 'Setiap tahun']];
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]; // tampil Senin dulu; nilai = Date.getDay()

/* Pilihan ulangi: <select> + deretan hari (muncul untuk "Hari tertentu"). onChange(rule) dipanggil dengan aturan baru. */
function repeatControl(id, onChange) {
  let days = [];
  const sel = h('select', { id, 'aria-label': 'Ulangi', onchange: () => {
    if (sel.value === 'dow') {
      if (!days.length) days = [new Date().getDay()];
      paint(); onChange(rule());
    } else { paint(); onChange(sel.value); }
  } }, REPEAT_OPTIONS.map(o => h('option', { value: o[0] }, T(o[1]))));
  const rule = () => 'dow:' + days.slice().sort((a, b) => a - b).join(',');
  const chips = h('div', { class: 'quick-dates', id: id + '-days', role: 'group', 'aria-label': 'Hari pengulangan', hidden: '' },
    DOW_ORDER.map(d => h('button', { class: 'btn small', type: 'button', 'data-dow': d, onclick: () => {
      const on = days.includes(d);
      if (on && days.length === 1) return; // minimal satu hari
      days = on ? days.filter(x => x !== d) : days.concat(d);
      paint(); onChange(rule());
    } }, T(DAYS[d]))));
  function paint() {
    chips.hidden = sel.value !== 'dow';
    Array.prototype.forEach.call(chips.children, b => b.setAttribute('aria-pressed', String(days.includes(Number(b.dataset.dow)))));
  }
  function set(value) {
    const v = value || '';
    const m = /^dow:([0-6](?:,[0-6])*)$/.exec(v);
    if (m) { days = m[1].split(',').map(Number); sel.value = 'dow'; }
    else if (Array.prototype.some.call(sel.options, o => o.value === v)) sel.value = v;
    else { sel.append(h('option', { value: v }, ruleLabel(v))); sel.value = v; }
    paint();
  }
  return { el: h('div', {}, sel, chips), sel, set };
}

function field(label, control, forId) {
  return h('div', { class: 'field' }, h('label', { for: forId || null }, label), control);
}

let DRC = null;
function buildDrawer(t) {
  const root = $('#drawer');
  root.replaceChildren();

  const fit = el => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
  const titleInput = h('textarea', { class: 't-input', id: 'f-title', rows: '1', maxlength: '300', 'aria-label': 'Judul tugas',
    onchange: e => patchTask(t.id, { title: e.target.value.replace(/\s+/g, ' ').trim() }),
    oninput: e => fit(e.target),
    onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } } });
  titleInput.value = t.title;
  requestAnimationFrame(() => fit(titleInput));

  const prio = h('div', { class: 'seg', id: 'f-prio', role: 'group', 'aria-label': 'Prioritas' },
    [[1, 'Tinggi'], [2, 'Sedang'], [3, 'Rendah']].map(p =>
      h('button', { type: 'button', class: 'p' + p[0], 'aria-pressed': String(t.priority === p[0]), onclick: () => patchTask(t.id, { priority: p[0] }) }, p[1])));

  const dateInput = h('input', { class: 'input', id: 'f-deadline', type: 'date', value: t.deadline || '', onchange: e => patchTask(t.id, { deadline: e.target.value || null }) });
  const timeInput = h('input', { class: 'input', id: 'f-time', type: 'time', value: t.due_time || '', disabled: !t.deadline, 'aria-label': 'Jam batas waktu',
    onchange: e => patchTask(t.id, { due_time: e.target.value || null }) });
  const readoutText = x => x.deadline ? fmtDate(x.deadline) + (x.due_time ? ', ' + x.due_time : '') : T('Belum ada tanggal');
  const dateReadout = h('p', { class: 'date-readout', id: 'f-readout' }, readoutText(t));
  const quickDates = h('div', { class: 'quick-dates' },
    [['Hari ini', 0], ['Besok', 1], ['Minggu depan', 7]].map(q => h('button', { class: 'btn small', type: 'button', onclick: () => patchTask(t.id, { deadline: addDaysIso(q[1]) }) }, q[0])),
    h('button', { class: 'btn small', id: 'f-clear-date', type: 'button', hidden: !t.deadline, onclick: () => patchTask(t.id, { deadline: null }) }, 'Hapus tanggal'));

  const projectList = h('datalist', { id: 'project-list' }, state.projects.map(p => h('option', { value: p.name })));
  const projectInput = h('input', { class: 'input', id: 'f-project', list: 'project-list', value: t.project || '', placeholder: 'mis. rumah', maxlength: '60', onchange: e => patchTask(t.id, { project: e.target.value.trim() || null }) });
  const tagsInput = h('input', { class: 'input', id: 'f-tags', value: t.tags.join(', '), placeholder: 'tagihan, penting',
    onchange: e => patchTask(t.id, { tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }) });

  DRC = repeatControl('f-repeat', rule => patchTask(t.id, { repeat: rule || null }));
  DRC.set(t.repeat);

  const remindSel = h('select', { id: 'f-remind', 'aria-label': 'Pengingat', disabled: !t.deadline,
    onchange: e => { if (window.todoRemind) window.todoRemind.setLead(t.id, e.target.value === '' ? null : Number(e.target.value)); } },
    [['', 'Ikuti bawaan']].concat(REMIND_LABELS).map(o => h('option', { value: String(o[0]) }, T(o[1]))));
  remindSel.value = window.todoRemind && window.todoRemind.leadOf(t.id) !== null ? String(window.todoRemind.leadOf(t.id)) : '';
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
    h('div', { class: 'field' }, h('label', { for: 'f-deadline' }, 'Batas waktu'), h('div', { class: 'det-row' }, dateInput, timeInput), dateReadout, quickDates),
    h('details', { class: 'snooze-box', open: false },
      h('summary', {}, icon('clock', 14), 'Jadwalkan ulang'),
      h('div', { class: 'snooze', id: 'f-snooze' },
        [['hour', '+1 jam'], ['evening', 'Sore ini'], ['tomorrow', 'Besok'], ['nextweek', 'Minggu depan']].map(q =>
          h('button', { class: 'btn small', type: 'button', 'data-snooze': q[0], disabled: t.done, onclick: () => snooze(taskById(t.id) || t, q[0]) }, icon('clock', 12), q[1])))),
    h('div', { class: 'two' },
      field('Proyek', h('div', {}, projectInput, projectList), 'f-project'),
      field('Ulangi', DRC.el, 'f-repeat')),
    field('Pengingat', h('div', {}, remindSel, h('p', { class: 'field-hint', id: 'f-remind-hint', hidden: !!t.due_time },
      T('Pengingat berlaku untuk tugas yang punya tanggal dan jam. Tanpa jam, hanya "1 hari sebelumnya" yang berbunyi.'))), 'f-remind'),
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
  if ($('#f-readout')) $('#f-readout').textContent = t.deadline ? fmtDate(t.deadline) + (t.due_time ? ', ' + t.due_time : '') : T('Belum ada tanggal');
  if (idle($('#f-project'))) $('#f-project').value = t.project || '';
  if (idle($('#f-tags'))) $('#f-tags').value = t.tags.join(', ');
  if (idle($('#f-notes'))) $('#f-notes').value = t.notes;
  if (DRC && idle($('#f-repeat'))) DRC.set(t.repeat);
  if ($('#f-remind')) { $('#f-remind').disabled = !t.deadline; $('#f-remind-hint').hidden = !!t.due_time; }
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
