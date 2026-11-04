'use strict';
// Regresi keamanan: serangan data ke inti logika (pencemaran prototipe, DoS penguraian, batas ukuran, masukan aneh).
const test = require('node:test');
const assert = require('node:assert');
const core = require('../src/todo-core.js');

const mkStore = () => new core.Store({ load: () => null, save() {} }, { today: () => '2026-11-03', now: () => '2026-11-03T10:00:00' });

test('pencemaran prototipe lewat berkas sinkron/impor/pengaturan tidak berhasil', () => {
  const evil = JSON.parse('{"version":1,"tasks":[{"uid":"a1b2c3d4e5f60718","title":"x","__proto__":{"polluted":"ya"},"constructor":{"prototype":{"polluted2":"ya"}}}],"deleted":[],"settings":{"__proto__":{"polluted3":"ya"},"lead":5}}');
  try { core.validateSyncFile(evil); } catch (e) { /* ditolak juga boleh */ }
  try { mkStore().applySync({ upsert: evil.tasks, delete: [] }); } catch (e) { /* idem */ }
  try { core.cleanSettings(evil.settings); } catch (e) { /* idem */ }
  assert.strictEqual(({}).polluted, undefined);
  assert.strictEqual(({}).polluted2, undefined);
  assert.strictEqual(({}).polluted3, undefined);
});

test('penguraian masukan raksasa/jahat selesai cepat (tanpa ReDoS atau waktu kuadratik)', () => {
  const nasty = ['a'.repeat(100000), ' '.repeat(100000) + 'x', '!'.repeat(50000), '^'.repeat(50000), '@'.repeat(50000) + '#'.repeat(50000),
    'besok '.repeat(20000), '1'.repeat(100000) + ':' + '9'.repeat(100000), '\n'.repeat(100000), '  - '.repeat(30000), '2026-'.repeat(20000),
    'tiap '.repeat(20000) + 'hari', 'dow:' + '1,'.repeat(50000)];
  const fns = [s => core.parseQuick(s, '2026-11-03'), s => core.parseBulk(s, '2026-11-03'), s => core.parseDue(s, '2026-11-03'), s => core.normalizeRule && core.normalizeRule(s)];
  for (const s of nasty) for (const fn of fns) {
    const t = Date.now();
    try { fn(s); } catch (e) { /* galat yang rapi boleh */ }
    assert.ok(Date.now() - t < 800, 'terlalu lambat: ' + (Date.now() - t) + ' ms untuk masukan ' + s.slice(0, 12));
  }
});

test('API tidak pernah melempar untuk body/rute aneh', () => {
  const store = mkStore();
  const bodies = [null, [], 'str', 1, { title: ['a'] }, { title: 'ok', tags: 'a'.repeat(1000) }, { title: 'ok', parent_id: '1; DROP' }, { title: 'ok', deadline: { a: 1 } }];
  for (const b of bodies) {
    const r = core.handle(store, 'POST', '/api/tasks', b);
    assert.strictEqual(typeof r.status, 'number');
  }
  for (const p of ['/api/tasks/../../x', '/api/tasks/__proto__', '/api/tasks/constructor', '/api/tasks/%00', '//api//tasks', '/api/tasks/1e999', '/api/tasks/-1', '/api/tasks/NaN'])
    for (const m of ['GET', 'PATCH', 'DELETE', 'POST']) assert.strictEqual(typeof core.handle(store, m, p, {}).status, 'number');
});

test('batas ukuran: judul/catatan 1 MB dan tambah-massal 5000 baris ditolak', () => {
  const store = mkStore();
  assert.ok(core.handle(store, 'POST', '/api/tasks', { title: 'x'.repeat(1e6) }).status >= 400);
  assert.ok(core.handle(store, 'POST', '/api/tasks', { title: 't', notes: 'n'.repeat(1e6) }).status >= 400);
  assert.ok(core.handle(store, 'POST', '/api/tasks/bulk', { text: 'a\n'.repeat(5000) }).status >= 400);
});
