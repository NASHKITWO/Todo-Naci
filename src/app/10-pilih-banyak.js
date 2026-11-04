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
