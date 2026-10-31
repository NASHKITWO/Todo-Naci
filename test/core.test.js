'use strict';
// Perilaku todo-core.js dikunci terhadap hasil acuan (test/golden/core.json) yang dulu dihasilkan
// implementasi Python aslinya: parser tanggal/jam/quick-add, aturan ulang, dan seluruh rute REST lokal.
const test = require('node:test');
const assert = require('node:assert');
const core = require('../src/todo-core.js');
const golden = require('./golden/core.json');

const roundtrip = v => JSON.parse(JSON.stringify(v));
function call(fn) { try { return { ok: roundtrip(fn()) }; } catch (e) { if (e instanceof core.TodoError) return { error: e.message }; throw e; } }

const FNS = {
  parseDeadline: a => core.parseDeadline(a[0], a[1]),
  parseTime: a => core.parseTime(a[0]),
  parseDue: a => core.parseDue(a[0], a[1]),
  parseQuick: a => core.parseQuick(a[0], a[1]),
  normalizeRule: a => core.normalizeRule(a[0]),
  nextOccurrence: a => core.nextOccurrence(a[0], a[1], a[2]),
  cleanDueTime: a => core.cleanDueTime(a[0]),
};

test('fungsi murni sama dengan hasil acuan (' + golden.cases.length + ' kasus)', () => {
  const bad = [];
  for (const c of golden.cases) {
    const got = call(() => FNS[c.fn](c.args));
    try { assert.deepStrictEqual(got, c.want); } catch (e) { bad.push(c.fn + JSON.stringify(c.args) + '\n  want ' + JSON.stringify(c.want) + '\n  got  ' + JSON.stringify(got)); }
  }
  assert.deepStrictEqual(bad, []);
});

test('skenario REST lokal sama dengan hasil acuan (' + golden.scenario.length + ' langkah)', () => {
  const store = new core.Store(null, { today: () => golden.today, now: () => golden.now });
  const bad = [];
  golden.scenario.forEach((step, i) => {
    const [method, path, body] = step.req;
    const r = core.handle(store, method, path, roundtrip(body));
    let b = roundtrip(r.body);
    if (b && b.exported_at) b.exported_at = 'X';
    try { assert.deepStrictEqual([r.status, b], step.want); } catch (e) { bad.push('#' + i + ' ' + method + ' ' + path + ' ' + JSON.stringify(body)); }
  });
  assert.deepStrictEqual(bad, []);
});

test('skenario tidak kosong: ada status 200, 201, 400, 404 dan data akhir', () => {
  const statuses = new Set(golden.scenario.map(s => s.want[0]));
  assert.deepStrictEqual([...statuses].sort(), [200, 201, 400, 404]);
});

test('ekspor lalu impor menghasilkan data yang sama (tanpa id)', () => {
  const store = new core.Store(null, { today: () => golden.today, now: () => golden.now });
  for (const step of golden.scenario) core.handle(store, step.req[0], step.req[1], roundtrip(step.req[2]));
  const exported = store.exportData();
  const copy = new core.Store(null, { today: () => golden.today, now: () => golden.now });
  copy.importData(roundtrip(exported));
  const strip = s => s.tasks.map(t => { const o = Object.assign({}, t); delete o.id; delete o.parent_id; return JSON.stringify(o, Object.keys(o).sort()); }).sort();
  assert.deepStrictEqual(strip(copy.exportData()), strip(exported));
});
