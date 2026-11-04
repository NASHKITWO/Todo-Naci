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
  text.addEventListener('input', () => { bulkSay(''); clearTimeout(BULK.timer); BULK.timer = setTimeout(refreshBulkPreview, 150); });
  BULK.el.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeBulk(); }
  }, true);
}
function bulkSay(t, bad, mine) { BULK.mine = !!mine && !!t; BULK.msg.textContent = t; BULK.msg.classList.toggle('ok', !bad && !!t); }

async function refreshBulkPreview() {
  const my = ++BULK.seq;
  const value = BULK.text.value;
  if (!value.trim()) { BULK.preview.replaceChildren(); if (BULK.mine) bulkSay(''); BULK.add.disabled = true; BULK.add.textContent = T('Tambahkan'); return; }
  let r = null, err = null;
  try { r = await api('POST', '/api/tasks/bulk', { text: value, dry_run: true, plain: true, defaults: bulkDefaults() }); } catch (e) { err = e; }
  if (my !== BULK.seq) return; // jawaban usang
  if (err) { BULK.preview.replaceChildren(); bulkSay(T(err.message), true, true); BULK.add.disabled = true; BULK.add.textContent = T('Tambahkan'); return; }
  if (BULK.mine) bulkSay('');
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
