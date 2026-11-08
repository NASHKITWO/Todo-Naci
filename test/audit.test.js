'use strict';
// Regresi dari audit 0.35: impor bertingkat, cap waktu masa depan, pembatalan saat penyimpanan gagal.
const test = require('node:test');
const assert = require('node:assert');
const core = require('../src/todo-core.js');
const mk = (persist) => new core.Store(persist || { load: () => null, save() {} }, { today: () => '2026-11-03', now: () => '2026-11-03T10:00:00' });

test('impor: induk subtugas harus tugas tingkat atas (tidak ada tingkat 3)', () => {
  const s = mk();
  s.importData({ tasks: [{ id: 1, title: 'A' }, { id: 2, title: 'B', parent_id: 1 }, { id: 3, title: 'C', parent_id: 2 }] });
  const byTitle = Object.fromEntries(s.tasks.map(t => [t.title, t]));
  assert.strictEqual(byTitle.B.parent_id, byTitle.A.id);
  assert.strictEqual(byTitle.C.parent_id, null, 'C tidak boleh jadi cucu');
  for (const t of s.tasks) if (t.parent_id != null) assert.strictEqual(s.tasks.find(x => x.id === t.parent_id).parent_id, null);
});

test('impor: terlalu banyak tugas ditolak sebelum mengubah apa pun', () => {
  const s = mk();
  const tasks = Array.from({ length: 20001 }, (_, i) => ({ id: i + 1, title: 't' + i }));
  assert.throws(() => s.importData({ tasks }), /terlalu besar/);
  assert.strictEqual(s.tasks.length, 0);
});

test('sinkron: cap waktu jauh di masa depan dijepit (jam perangkat salah tidak menang selamanya)', () => {
  const far = '2090-01-01T00:00:00.000Z';
  const file = { app: 'todo-cli', kind: 'sync', format: 1,
    tasks: [{ uid: 'a1b2c3d4e5f60718', title: 'x', created_at: '2026-11-03T10:00:00', updated_at: far }],
    deleted: [{ uid: 'b1b2c3d4e5f60718', deleted_at: far }] };
  const v = core.validateSyncFile(file);
  const limit = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  assert.ok(v.records[0].updated_at < limit, 'updated_at dijepit');
  assert.ok(v.tombs[0].deleted_at < limit, 'deleted_at dijepit');
});

test('Store: restoreState mengembalikan keadaan sebelum perubahan', () => {
  const s = mk();
  s.add({ title: 'satu' });
  const before = s.snapshotState();
  s.add({ title: 'dua' }); s.delete(s.tasks[0].id);
  s.restoreState(before);
  assert.deepStrictEqual(s.tasks.map(t => t.title), ['satu']);
  assert.strictEqual(s.nextId, 2);
});

test('sinkron: subtugas lebih baru yang induknya dihapus di perangkat lain diangkat jadi tugas biasa (tidak dibuang diam-diam)', () => {
  const rec = (uid, parent, at) => ({ uid, parent_uid: parent, title: uid, notes: '', priority: 2, deadline: null, due_time: null, done: false,
    project: null, repeat: null, tags: [], created_at: '2026-11-01T00:00:00.000Z', completed_at: null, updated_at: at });
  const local = [rec('aaaaaaaaaaaaaaa1', null, '2026-11-01T00:00:00.000Z'), rec('aaaaaaaaaaaaaaa2', 'aaaaaaaaaaaaaaa1', '2026-11-05T00:00:00.000Z')];
  const tombs = [{ uid: 'aaaaaaaaaaaaaaa1', deleted_at: '2026-11-04T00:00:00.000Z' }];
  const r1 = core.mergeSync(local, [], [], tombs);
  const child = r1.tasks.find(t => t.uid === 'aaaaaaaaaaaaaaa2');
  assert.ok(child, 'subtugas tidak boleh hilang');
  assert.strictEqual(child.parent_uid, null);
  assert.ok(!r1.tasks.some(t => t.uid === 'aaaaaaaaaaaaaaa1'), 'induk tetap terhapus');
  // konvergen: digabung ulang (dan dari arah sebaliknya) hasilnya sama
  const r2 = core.mergeSync(r1.tasks, r1.deleted, local, tombs);
  assert.deepStrictEqual(r2.tasks, r1.tasks);
  const r3 = core.mergeSync([], tombs, local, []);
  assert.deepStrictEqual(r3.tasks, r1.tasks);
});
