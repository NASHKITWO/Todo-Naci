'use strict';
// Sinkronisasi berkas: aturan penggabungan dikunci terhadap hasil acuan (golden/sync.json), ditambah sifat
// konvergen (komutatif, idempoten, tiga perangkat) dan alur dua penyimpanan yang saling bertukar berkas.
const test = require('node:test');
const assert = require('node:assert');
const core = require('../src/todo-core.js');
const golden = require('./golden/sync.json');

const clone = v => JSON.parse(JSON.stringify(v));

test('penggabungan sama dengan hasil acuan (' + golden.merge.length + ' kasus acak)', () => {
  let upserts = 0, deletes = 0;
  for (const c of golden.merge) {
    const got = core.mergeSync(clone(c.L), clone(c.LT), clone(c.R), clone(c.RT));
    assert.deepStrictEqual(got, c.want);
    upserts += got.upsert.length; deletes += got.delete.length;
  }
  assert.ok(upserts > 0 && deletes > 0, 'data uji tidak boleh kosong');
});

test('validasi berkas sinkron sama dengan hasil acuan', () => {
  for (const c of golden.validate) {
    let got;
    try { got = { ok: clone(core.validateSyncFile(clone(c.file))) }; } catch (e) { if (!(e instanceof core.TodoError)) throw e; got = { error: e.message }; }
    if (c.want.ok) assert.deepStrictEqual(got, { ok: { records: c.want.ok.records, tombs: c.want.ok.tombs } });
    else assert.deepStrictEqual(got, c.want);
  }
});

function rng(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function side(rnd, flat) {
  const stamps = [1, 2, 3, 4].map(d => '2026-01-0' + d + 'T00:00:00.000Z');
  const pick = a => a[Math.floor(rnd() * a.length)];
  const recs = [], tombs = [];
  for (let i = 1; i <= 6; i++) {
    const uid = ('00000000' + i).slice(-8), k = rnd();
    if (k < 0.55) recs.push({ uid, parent_uid: flat || i <= 3 ? null : ('00000000' + (i - 3)).slice(-8), title: pick('ABC'.split('')), notes: '', priority: 2,
      deadline: null, due_time: null, done: false, project: null, repeat: null, tags: [], created_at: 'x', completed_at: null, updated_at: pick(stamps) });
    else if (k < 0.75) tombs.push({ uid, deleted_at: pick(stamps) });
  }
  const have = new Set(recs.map(r => r.uid));
  return [recs.filter(r => !r.parent_uid || have.has(r.parent_uid)), tombs];
}

test('dua perangkat: komutatif dan idempoten', () => {
  const rnd = rng(7);
  for (let i = 0; i < 300; i++) {
    const [A, AT] = side(rnd, false), [B, BT] = side(rnd, false);
    const ab = core.mergeSync(A, AT, B, BT), ba = core.mergeSync(B, BT, A, AT);
    assert.deepStrictEqual(ab.tasks, ba.tasks);
    assert.deepStrictEqual(ab.deleted, ba.deleted);
    const again = core.mergeSync(ab.tasks, ab.deleted, B, BT);
    assert.deepStrictEqual([again.tasks, again.deleted, again.upsert, again.delete], [ab.tasks, ab.deleted, [], []]);
  }
});

test('tiga perangkat: urutan penggabungan tidak penting', () => {
  const rnd = rng(11);
  for (let i = 0; i < 300; i++) {
    const [A, AT] = side(rnd, true), [B, BT] = side(rnd, true), [C, CT] = side(rnd, true);
    const ab = core.mergeSync(A, AT, B, BT), x = core.mergeSync(ab.tasks, ab.deleted, C, CT);
    const bc = core.mergeSync(B, BT, C, CT), y = core.mergeSync(bc.tasks, bc.deleted, A, AT);
    assert.deepStrictEqual([x.tasks, x.deleted], [y.tasks, y.deleted]);
  }
});

function phone(day) {
  // Jam ponsel palsu: stempel selalu naik, dan hari bisa dimajukan (ph.day) untuk mengatur siapa yang "lebih baru".
  let n = 0, data = null;
  const ph = { day };
  const clock = { today: () => '2026-06-01', now: () => '2026-06-01T10:00:00',
    stamp: () => ph.day + 'T10:' + String(Math.floor(n / 1000)).padStart(2, '0') + ':' + String(n++ % 1000).padStart(2, '0') + '.000Z' };
  const store = new core.Store({ load: () => data, save: o => { data = clone(o); } }, clock);
  const api = (m, p, b) => core.handle(store, m, p, b || {});
  const titles = () => store.listAll().map(t => t.title).sort();
  return Object.assign(ph, { store, api, titles, send: () => clone(store.syncFile('x')), merge: f => store.syncWith(clone(f)) });
}

test('alur dua ponsel: tambah, ubah, hapus, subtugas', () => {
  const a = phone('2026-06-01'), b = phone('2026-06-02');
  a.api('POST', '/api/tasks', { title: 'beli susu', tags: ['x'] });
  const p = a.api('POST', '/api/tasks', { title: 'induk' }).body.task.id;
  a.api('POST', '/api/tasks', { title: 'anak', parent_id: p });
  assert.deepStrictEqual(b.merge(a.send()), { added: 3, updated: 0, deleted: 0 });
  assert.deepStrictEqual(b.titles(), a.titles());
  const kid = b.store.listAll().find(t => t.title === 'anak');
  assert.strictEqual(b.store.get(kid.parent_id).title, 'induk');
  // b mengubah dan menambah; a menerima
  const bid = b.store.listAll().find(t => t.title === 'beli susu').id;
  b.api('PATCH', '/api/tasks/' + bid, { title: 'beli susu UHT' });
  b.api('POST', '/api/tasks', { title: 'hanya di b' });
  assert.deepStrictEqual(a.merge(b.send()), { added: 1, updated: 1, deleted: 0 });
  assert.deepStrictEqual(a.titles(), ['anak', 'beli susu UHT', 'hanya di b', 'induk']);
  // a menghapus induk (anak ikut), b menerima
  a.day = '2026-06-03';
  a.api('DELETE', '/api/tasks/' + p);
  assert.deepStrictEqual(b.merge(a.send()), { added: 0, updated: 0, deleted: 2 });
  assert.deepStrictEqual(b.titles(), ['beli susu UHT', 'hanya di b']);
  // menggabung lagi dari dua sisi tidak mengubah apa pun
  for (const [x, y] of [[a, b], [b, a], [a, b]]) assert.deepStrictEqual(x.merge(y.send()), { added: 0, updated: 0, deleted: 0 });
});

test('hapus meninggalkan penanda, dan data lama versi sebelumnya mendapat identitas', () => {
  const a = phone('2026-06-01');
  const id = a.api('POST', '/api/tasks', { title: 'x' }).body.task.id;
  a.api('DELETE', '/api/tasks/' + id);
  assert.strictEqual(a.send().deleted.length, 1);
  const old = { version: 3, nextId: 2, tasks: [{ id: 1, parent_id: null, title: 'lama', notes: '', priority: 2, deadline: null, due_time: null,
    done: false, project: null, repeat: null, tags: [], created_at: '2026-01-01T00:00:00', completed_at: null, reminded_for: null }] };
  const s = new core.Store({ load: () => old, save: () => {} }, { today: () => '2026-06-01', now: () => 'x' });
  const f = s.syncFile('x');
  assert.strictEqual(f.tasks[0].updated_at, '1970-01-01T00:00:00.000Z');
  assert.match(f.tasks[0].uid, /^[0-9a-f]{16}$/);
});

test('berkas rusak ditolak dan data tidak berubah', () => {
  const a = phone('2026-06-01');
  a.api('POST', '/api/tasks', { title: 'tetap' });
  const f = a.send();
  f.tasks.push(Object.assign({}, f.tasks[0], { uid: 'bbbbbbbb', priority: 9 }));
  assert.throws(() => a.merge(f), /Tugas ke-2/);
  assert.deepStrictEqual(a.titles(), ['tetap']);
  assert.throws(() => a.merge({ app: 'todo-cli', tasks: [] }), /bukan berkas sinkron/);
});

test('perubahan jam/tanggal dari ponsel lain mereset penanda pengingat lokal', () => {
  const a = phone('2026-06-01'), b = phone('2026-06-01');
  a.api('POST', '/api/tasks', { title: 'rapat', deadline: '2026-07-01', due_time: '10:00' });
  b.merge(a.send());
  const id = b.store.listAll()[0].id;
  b.store.row(id).reminded_for = '2026-07-01 10:00';
  a.day = '2026-06-05';
  a.api('PATCH', '/api/tasks/1', { due_time: '11:00' });
  b.merge(a.send());
  assert.strictEqual(b.store.row(id).reminded_for, null);
  assert.strictEqual(b.store.get(id).due_time, '11:00');
});
