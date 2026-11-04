'use strict';
// Sampah 30 hari + pulihkan (v0.12): inti Store dan API, termasuk interaksi dengan sinkron.
const test = require('node:test');
const assert = require('node:assert');
const core = require('../src/todo-core.js');

const clone = v => JSON.parse(JSON.stringify(v));
let tick = 0;
const stampNext = () => new Date(Date.UTC(2026, 5, 1, 10, 0, 0) + (tick++) * 1000).toISOString();

function phone(opts) {
  opts = opts || {};
  let data = opts.data || null;
  const day = { v: opts.today || '2026-06-10' };
  const clock = { today: () => day.v, now: () => day.v + 'T09:00:00', stamp: opts.fixedStamp ? () => opts.fixedStamp : opts.byDay ? () => day.v + 'T10:00:' + String(tick++ % 60).padStart(2, '0') + 'Z' : stampNext };
  const mk = () => new core.Store({ load: () => data, save: o => { data = clone(o); } }, clock);
  let store = mk();
  const self = {
    get store() { return store; }, day, clock,
    reopen() { store = mk(); return self; },
    api: (m, p, b) => core.handle(store, m, p, b || {}),
    add: (title, extra) => self.api('POST', '/api/tasks', Object.assign({ title }, extra)).body.task,
    titles: () => store.listAll().map(t => t.title).sort(),
  };
  return self;
}

test('hapus → masuk sampah → pulihkan: tugas kembali lengkap dengan subtugas dan isinya', () => {
  const p = phone();
  const a = p.add('Laporan', { deadline: '2026-06-12', priority: 'high', project: 'kuliah', tags: ['x'], notes: 'catatan' });
  p.add('Bab 1', { parent_id: a.id });
  p.add('Bab 2', { parent_id: a.id });
  p.add('lain');
  assert.strictEqual(p.api('DELETE', '/api/tasks/' + a.id).status, 200);
  assert.deepStrictEqual(p.titles(), ['lain']);
  const tr = p.api('GET', '/api/trash').body;
  assert.strictEqual(tr.entries.length, 1);
  assert.strictEqual(tr.entries[0].title, 'Laporan');
  assert.strictEqual(tr.entries[0].subs, 2);
  const r = p.api('POST', '/api/trash/restore', { batch: tr.latest });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.restored, 3);
  assert.deepStrictEqual(p.titles(), ['Bab 1', 'Bab 2', 'Laporan', 'lain']);
  const back = p.store.listAll().find(t => t.title === 'Laporan');
  assert.strictEqual(back.sub_total, 2);
  assert.strictEqual(back.deadline, '2026-06-12');
  assert.strictEqual(back.notes, 'catatan');
  assert.deepStrictEqual(back.tags, ['x']);
  assert.strictEqual(back.project, 'kuliah');
  assert.strictEqual(p.api('GET', '/api/trash').body.entries.length, 0);
});

test('hapus semua yang selesai: satu batch, bisa dipulihkan sekaligus', () => {
  const p = phone();
  const a = p.add('a'), b = p.add('b'), c = p.add('c');
  p.api('POST', '/api/tasks/' + a.id + '/done'); p.api('POST', '/api/tasks/' + b.id + '/done');
  p.api('DELETE', '/api/tasks/' + c.id);
  const cBatch = p.api('GET', '/api/trash').body.latest;
  p.api('POST', '/api/clear');
  const tr = p.api('GET', '/api/trash').body;
  assert.strictEqual(tr.entries.length, 3);
  const last = tr.latest;
  assert.notStrictEqual(last, cBatch);
  assert.strictEqual(tr.entries.filter(e => e.batch === last).length, 2);
  assert.strictEqual(p.api('POST', '/api/trash/restore', { batch: last }).body.restored, 2);
  assert.deepStrictEqual(p.titles(), ['a', 'b']);
  assert.ok(p.store.listAll().every(t => t.done), 'status selesai ikut kembali');
  assert.strictEqual(p.api('GET', '/api/trash').body.entries.length, 1, 'yang dihapus terpisah tetap di sampah');
});

test('pulihkan memakai id entri; id/batch tidak dikenal → 404; masukan salah → 400', () => {
  const p = phone();
  const a = p.add('a'), b = p.add('b');
  p.api('DELETE', '/api/tasks/' + a.id); p.api('DELETE', '/api/tasks/' + b.id);
  const ids = p.api('GET', '/api/trash').body.entries;
  assert.strictEqual(p.api('POST', '/api/trash/restore', { ids: [ids.find(e => e.title === 'a').id] }).body.restored, 1);
  assert.deepStrictEqual(p.titles(), ['a']);
  assert.strictEqual(p.api('POST', '/api/trash/restore', { ids: [9999] }).status, 404);
  assert.strictEqual(p.api('POST', '/api/trash/restore', {}).status, 404);
  assert.strictEqual(p.api('POST', '/api/trash/restore', { ids: 'x' }).status, 400);
  assert.strictEqual(p.api('POST', '/api/trash/restore', { batch: 'x' }).status, 400);
});

test('subtugas yang dihapus kembali ke induknya; bila induk sudah tiada, jadi tugas biasa', () => {
  const p = phone();
  const a = p.add('induk'); const k = p.add('anak', { parent_id: a.id });
  p.api('DELETE', '/api/tasks/' + k.id);
  p.api('POST', '/api/trash/restore', { batch: p.store.latestBatch() });
  let back = p.store.listAll().find(t => t.title === 'anak');
  assert.strictEqual(back.parent_id, a.id);
  p.api('DELETE', '/api/tasks/' + back.id);
  p.api('DELETE', '/api/tasks/' + a.id);
  const anak = p.api('GET', '/api/trash').body.entries.find(e => e.title === 'anak');
  p.api('POST', '/api/trash/restore', { ids: [anak.id] });
  back = p.store.listAll().find(t => t.title === 'anak');
  assert.strictEqual(back.parent_id, null);
});

test('hapus permanen satu entri dan kosongkan sampah', () => {
  const p = phone();
  for (const t of ['a', 'b', 'c']) p.api('DELETE', '/api/tasks/' + p.add(t).id);
  const [first] = p.api('GET', '/api/trash').body.entries;
  assert.strictEqual(p.api('DELETE', '/api/trash/' + first.id).body.purged, 1);
  assert.strictEqual(p.api('DELETE', '/api/trash/' + first.id).status, 404);
  assert.strictEqual(p.api('GET', '/api/trash').body.entries.length, 2);
  assert.strictEqual(p.api('DELETE', '/api/trash').body.purged, 2);
  assert.strictEqual(p.api('GET', '/api/trash').body.entries.length, 0);
  assert.strictEqual(p.api('POST', '/api/trash/restore', {}).status, 404);
});

test('sampah bertahan setelah aplikasi dibuka ulang, dan dibuang setelah 30 hari', () => {
  const p = phone({ today: '2026-06-10', byDay: true });
  p.api('DELETE', '/api/tasks/' + p.add('lama').id);
  p.day.v = '2026-06-25';
  p.api('DELETE', '/api/tasks/' + p.add('baru').id);
  p.reopen();
  assert.strictEqual(p.api('GET', '/api/trash').body.entries.length, 2);
  p.day.v = '2026-07-10'; // 30 hari sesudah "lama"
  p.reopen();
  assert.strictEqual(p.api('GET', '/api/trash').body.entries.length, 2, 'tepat 30 hari: masih ada');
  p.day.v = '2026-07-11';
  p.reopen();
  assert.deepStrictEqual(p.api('GET', '/api/trash').body.entries.map(e => e.title), ['baru']);
  p.day.v = '2026-07-26';
  p.reopen();
  assert.strictEqual(p.api('GET', '/api/trash').body.entries.length, 0);
});

test('sampah dibatasi 200 entri (yang tertua dibuang)', () => {
  const p = phone();
  for (let i = 0; i < 205; i++) p.api('DELETE', '/api/tasks/' + p.add('t' + i).id);
  p.reopen();
  const e = p.api('GET', '/api/trash').body.entries;
  assert.strictEqual(e.length, 200);
  assert.ok(!e.some(x => x.title === 't0') && e.some(x => x.title === 't204'));
});

test('sampah tidak ikut ekspor/sinkron, dan data lama tanpa sampah tetap terbaca', () => {
  const p = phone();
  p.api('DELETE', '/api/tasks/' + p.add('x').id);
  assert.ok(!JSON.stringify(p.store.exportData()).includes('"trash"'));
  assert.ok(!JSON.stringify(p.store.syncFile('d')).includes('"rows"'));
  const old = phone({ data: { version: 4, nextId: 1, tasks: [], tombs: [] } });
  assert.deepStrictEqual(old.api('GET', '/api/trash').body, { entries: [], latest: 0 });
});

test('sinkron: pulihkan di HP A mengalahkan nisan hapus, dan sampai ke HP B', () => {
  const A = phone(), B = phone();
  const t = A.add('rapat', { deadline: '2026-06-11' });
  B.store.syncWith(A.store.syncFile('a'));
  assert.deepStrictEqual(B.titles(), ['rapat']);
  A.api('DELETE', '/api/tasks/' + t.id);
  B.store.syncWith(A.store.syncFile('a'));
  assert.deepStrictEqual(B.titles(), [], 'penghapusan menyebar');
  A.api('POST', '/api/trash/restore', { batch: A.store.latestBatch() });
  assert.deepStrictEqual(A.titles(), ['rapat']);
  A.store.syncWith(B.store.syncFile('b')); // B masih membawa nisan lama
  assert.deepStrictEqual(A.titles(), ['rapat'], 'nisan lama tidak menghapus tugas yang dipulihkan');
  B.store.syncWith(A.store.syncFile('a'));
  assert.deepStrictEqual(B.titles(), ['rapat'], 'pemulihan menyebar ke HP B');
  assert.strictEqual(B.store.listAll()[0].deadline, '2026-06-11');
});

test('pulihkan menang atas nisan walau cap waktu jam sama persis (tidak jatuh di "<=")', () => {
  const fixed = '2026-06-01T10:00:00.000Z';
  const A = phone({ fixedStamp: fixed });
  const t = A.add('sama');
  A.api('DELETE', '/api/tasks/' + t.id);
  A.api('POST', '/api/trash/restore', { batch: A.store.latestBatch() });
  const back = A.store.syncState().records[0];
  assert.ok(back.updated_at > fixed, 'cap waktu pemulihan lebih baru dari nisan');
  const B = phone({ fixedStamp: fixed });
  B.store.syncWith({ app: 'todo-cli', kind: 'sync', format: 1, device: 'b', exported_at: fixed, tasks: [], deleted: [{ uid: back.uid, deleted_at: fixed }] });
  A.store.syncWith(B.store.syncFile('b'));
  assert.deepStrictEqual(A.titles(), ['sama']);
});

test('pulihkan tidak menggandakan tugas yang sudah kembali lewat sinkron', () => {
  const A = phone(), B = phone();
  const t = A.add('dobel');
  B.store.syncWith(A.store.syncFile('a'));
  A.api('DELETE', '/api/tasks/' + t.id);
  // B mengubah tugas itu setelah A menghapus -> sinkron memunculkannya lagi di A
  B.api('PATCH', '/api/tasks/' + B.store.listAll()[0].id, { notes: 'edit' });
  A.store.syncWith(B.store.syncFile('b'));
  assert.deepStrictEqual(A.titles(), ['dobel']);
  A.api('POST', '/api/trash/restore', { batch: A.store.latestBatch() });
  assert.deepStrictEqual(A.titles(), ['dobel'], 'tidak ada salinan kedua');
  assert.strictEqual(A.api('GET', '/api/trash').body.entries.length, 0);
});

test('templat lama bersimbol diubah sekali menjadi judul biasa, lalu tidak disentuh lagi', () => {
  const { Store } = require('../src/todo-core.js');
  let saved = null;
  const mk = data => new Store({ load: () => data, save: d => { saved = d; } }, { now: () => '2026-10-29T10:00:00', today: () => '2026-10-29' });
  const s1 = mk({ version: 4, nextId: 1, tasks: [], tombs: [], templates: [{ id: 1, name: 'Rutin', text: 'Cek surat !1 ^besok @rumah #a\n  buka kotak pos\n- [x] Beres' }] });
  assert.strictEqual(s1.templates[0].text, 'Cek surat\n  buka kotak pos\n- [x] Beres');
  s1.save();
  assert.strictEqual(saved.tplPlain, true);
  const s2 = mk(saved);
  s2.templates[0].text = 'Tugas #1 selesai';
  s2.save();
  assert.strictEqual(mk(saved).templates[0].text, 'Tugas #1 selesai');
});
