'use strict';
// Uji acak berurutan: rangkaian operasi sembarang tidak boleh melempar galat tak terduga atau merusak invarian data.
const test = require('node:test');
const assert = require('node:assert');
const core = require('../src/todo-core.js');

function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const words = ['beli susu', 'tugas kuliah', 'a', 'x'.repeat(299), '  spasi  ', 'emoji 😀 ok', '#tag @proj', 'besok 9:30 !1', 'tiap hari', 'rapat senin'];
const dates = [null, '2026-11-03', '2026-11-04', '2026-02-29', '2027-02-28', '2026-13-01', 'besok', '+3d'];

function check(store, ctx) {
  const ids = new Set(), uids = new Set();
  for (const t of store.tasks) {
    assert.ok(!ids.has(t.id), ctx + ': id ganda ' + t.id); ids.add(t.id);
    assert.ok(!uids.has(t.uid), ctx + ': uid ganda'); uids.add(t.uid);
  }
  for (const t of store.tasks) {
    if (t.parent_id != null) {
      const p = store.tasks.find(x => x.id === t.parent_id);
      assert.ok(p, ctx + ': induk hilang untuk ' + t.id);
      assert.strictEqual(p.parent_id, null, ctx + ': sub-sub-tugas');
      assert.strictEqual(t.repeat, null, ctx + ': subtugas berulang');
    }
    assert.ok([1, 2, 3].includes(t.priority), ctx + ': prioritas');
    assert.ok(typeof t.title === 'string' && t.title.length > 0 && t.title.length <= 300, ctx + ': judul');
    if (t.due_time) assert.ok(t.deadline, ctx + ': jam tanpa deadline');
    if (t.done) assert.ok(t.completed_at, ctx + ': selesai tanpa completed_at');
  }
  const tomb = new Set(store.tombs.map(t => t.uid));
  for (const u of uids) assert.ok(!tomb.has(u), ctx + ': uid hidup sekaligus tombstone');
}

test('fuzz: 300 rangkaian x 60 operasi menjaga invarian', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const r = rng(seed);
    const pick = a => a[Math.floor(r() * a.length)];
    const store = new core.Store({ load: () => null, save() {} }, { today: () => '2026-11-03', now: () => '2026-11-03T10:00:00' });
    for (let step = 0; step < 60; step++) {
      const ids = store.tasks.map(t => t.id);
      const id = ids.length && r() < .9 ? pick(ids) : Math.floor(r() * 50);
      const op = Math.floor(r() * 12);
      let res, desc;
      try {
        switch (op) {
          case 0: desc = 'add'; res = core.handle(store, 'POST', '/api/tasks', { title: pick(words), deadline: pick(dates), priority: pick([1, 2, 3, 4, 'high']), repeat: pick([null, 'daily', 'weekly', 'bogus']) }); break;
          case 1: desc = 'sub'; res = core.handle(store, 'POST', '/api/tasks', { title: pick(words), parent_id: id }); break;
          case 2: desc = 'quick'; res = core.handle(store, 'POST', '/api/quick', { text: pick(words) }); break;
          case 3: desc = 'done'; res = core.handle(store, 'POST', '/api/tasks/' + id + '/done', { done: r() < .7 }); break;
          case 4: desc = 'patch'; res = core.handle(store, 'PATCH', '/api/tasks/' + id, { title: pick(words), deadline: pick(dates), due_time: pick([null, '09:00', '25:00', '']), repeat: pick([null, 'daily']), parent_id: pick([null, id, ids[0]]) }); break;
          case 5: desc = 'delete'; res = core.handle(store, 'DELETE', '/api/tasks/' + id, { permanent: r() < .3 }); break;
          case 6: desc = 'restore'; res = core.handle(store, 'POST', '/api/trash/restore', r() < .5 ? {} : { ids: [id] }); break;
          case 7: desc = 'clear'; res = core.handle(store, 'POST', '/api/clear', {}); break;
          case 8: desc = 'bulk'; res = core.handle(store, 'POST', '/api/tasks/bulk', { text: pick(words) + '\n  - ' + pick(words) }); break;
          case 9: desc = 'purge'; res = core.handle(store, 'DELETE', '/api/trash', {}); break;
          case 10: desc = 'export-import'; { const ex = core.handle(store, 'GET', '/api/export').body; store.importData(JSON.parse(JSON.stringify(ex))); } break;
          default: desc = 'state'; res = core.handle(store, 'GET', '/api/state'); JSON.stringify(res.body);
        }
      } catch (e) { assert.fail('seed ' + seed + ' langkah ' + step + ' (' + desc + ') melempar: ' + (e && e.stack || e)); }
      if (res) assert.ok(res.status < 500, 'seed ' + seed + ' ' + desc + ' status ' + res.status);
      check(store, 'seed ' + seed + ' langkah ' + step + ' ' + desc);
    }
  }
});
