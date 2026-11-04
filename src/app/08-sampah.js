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
