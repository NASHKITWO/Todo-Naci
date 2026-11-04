'use strict';
// Pengaturan pengingat ikut berkas sinkron (opsional, yang lebih baru menang, versi lama mengabaikannya).
const test = require('node:test');
const assert = require('node:assert');
const core = require('../src/todo-core.js');
const sync = require('../src/autosync.js');

const mem = () => { let d = null; return { load: () => d, save: o => { d = JSON.parse(JSON.stringify(o)); } }; };
const hook = (init) => {
  let cur = init || null;
  return { get: () => cur, apply: s => { if (!cur || s.at > cur.at) cur = s; }, now: () => cur };
};
const S = (at, lead) => ({ at, remind: { lead, evening: { on: false, hour: 21 }, per: {} } });

test('tanpa pengaturan: berkas sinkron persis seperti dulu (tanpa bidang settings)', () => {
  const st = new core.Store(mem());
  st.add({ title: 'A' });
  assert.ok(!('settings' in st.syncFile('x')));
  st.settingsHook = hook(null);
  assert.ok(!('settings' in st.syncFile('x')));
});

test('pengaturan dikirim dan diterima; yang lebih lama diabaikan; yang lebih baru menang', () => {
  const a = new core.Store(mem()), b = new core.Store(mem());
  const ha = hook(S('2026-10-20T10:00:00Z', 15)), hb = hook(null);
  a.settingsHook = ha; b.settingsHook = hb;
  a.add({ title: 'A' });
  b.syncWith(a.syncFile('hp-a'));
  assert.deepStrictEqual(hb.now(), S('2026-10-20T10:00:00Z', 15));
  // B mengubah lebih baru, lalu menerima berkas lama dari A: tetap milik B
  hb.apply(S('2026-10-21T10:00:00Z', 60));
  b.syncWith(a.syncFile('hp-a'));
  assert.strictEqual(hb.now().remind.lead, 60);
  // A menerima yang lebih baru dari B
  a.syncWith(b.syncFile('hp-b'));
  assert.strictEqual(ha.now().remind.lead, 60);
});

test('pengaturan rusak diabaikan tanpa menggagalkan sinkron', () => {
  const a = new core.Store(mem()), b = new core.Store(mem());
  a.add({ title: 'A' });
  const f = a.syncFile('x');
  const hb = hook(null); b.settingsHook = hb;
  for (const bad of [{ at: 'kemarin', remind: {} }, { at: '2026-10-20T10:00:00Z', remind: { lead: 7, evening: { on: true, hour: 20 } } },
    { at: '2026-10-20T10:00:00Z', remind: { lead: 5, evening: { on: true, hour: 25 } } }, 'x', 5]) {
    b.syncWith(Object.assign({}, f, { settings: bad }));
  }
  assert.strictEqual(hb.now(), null);
  assert.strictEqual(b.tasks.length, 1);
  // uid per tugas yang tidak valid dibuang, yang valid dipertahankan
  const s = core.cleanSettings({ at: '2026-10-20T10:00:00Z', remind: { lead: 5, evening: { on: true, hour: 20 }, per: { deadbeef: 0, 'bukan-uid': 5, cafef00d: 99 } } });
  assert.deepStrictEqual(s.remind.per, { deadbeef: 0 });
});

test('sinkron otomatis menganggap perubahan pengaturan sebagai perubahan (essence)', () => {
  const base = { tasks: [], deleted: [] };
  assert.notStrictEqual(sync.essence(base), sync.essence(Object.assign({ settings: S('2026-10-20T10:00:00Z', 5) }, base)));
  assert.strictEqual(sync.essence(base), sync.essence({ tasks: [], deleted: [], device: 'lain' }));
});
