'use strict';
// Ringkasan malam, pindah sisa ke besok, dan pengingat yang bisa diatur per tugas.
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers');
const { task: T, TODAY, day: D } = h;

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(); });

const fire = (page, actionId, id) => page.evaluate(`window.__lnListeners.localNotificationActionPerformed({ actionId: ${JSON.stringify(actionId)}, notification: { id: ${id} } })`);
const seed = () => [T(1, 'A', { deadline: TODAY }), T(2, 'B', { deadline: D(-2) }), T(3, 'C', { deadline: D(3) }), T(4, 'D', { deadline: TODAY, done: true })];
const dl = async (page, title) => (await h.stored(page)).tasks.find(t => t.title === title).deadline;

test('tombol di Hari ini memindahkan sisa tugas ke besok, Urungkan memulihkan', async () => {
  const page = await h.open(env, { seed: seed() });
  await h.until(page, "document.querySelector('#hero-tomorrow')");
  await page.click('#hero-tomorrow');
  await h.waitStored(page, d => d.tasks.find(t => t.title === 'A').deadline === D(1));
  assert.strictEqual(await dl(page, 'B'), D(1));
  assert.strictEqual(await dl(page, 'C'), D(3)); // di masa depan: tidak disentuh
  assert.strictEqual(await dl(page, 'D'), TODAY); // sudah selesai: tidak disentuh
  await h.until(page, "!document.querySelector('#hero-tomorrow')");
  await page.click('.toast button');
  await h.waitStored(page, d => d.tasks.find(t => t.title === 'B').deadline === D(-2));
  assert.strictEqual(await dl(page, 'A'), TODAY);
  await h.finish([page]);
});

test('notifikasi ringkasan malam: tombol "Pindah ke besok" terdaftar dan berfungsi', async () => {
  const page = await h.open(env, { native: true, seed: seed() });
  await h.until(page, 'window.__scheduled.length >= 1 && window.__actionTypes');
  const types = await page.evaluate('window.__actionTypes');
  const ev = types.find(t => t.id === 'EVENING');
  assert.deepStrictEqual(ev.actions.map(a => a.id), ['tomorrow']);
  const sched = await page.evaluate('window.__scheduled');
  for (const n of sched.filter(n => n.id >= 1000000100)) assert.strictEqual(n.actionTypeId, 'EVENING');
  await fire(page, 'tomorrow', 1000000100);
  await h.waitStored(page, d => d.tasks.find(t => t.title === 'A').deadline === D(1));
  assert.strictEqual(await dl(page, 'B'), D(1));
  assert.strictEqual(await dl(page, 'C'), D(3));
  await h.finish([page]);
});

test('dialog Pengingat: ringkasan malam bisa dimatikan dan jamnya diganti', async () => {
  const page = await h.open(env, { native: true, seed: [T(1, 'A', { deadline: D(1) })] });
  await h.until(page, 'window.__scheduled.some(n => n.id >= 1000000100)');
  const at0 = await page.evaluate("window.__scheduled.find(n => n.id >= 1000000100).at");
  await page.evaluate("document.querySelector('#remind-btn').click()");
  await h.until(page, "!document.querySelector('#remind').hidden");
  await page.selectOption('#rem-ev-hour', '21');
  await h.until(page, "window.__scheduled.some(n => n.id >= 1000000100 && new Date(n.at).getHours() === 21)");
  assert.notStrictEqual(at0, await page.evaluate("window.__scheduled.filter(n => n.id >= 1000000100).pop().at"));
  await page.evaluate("document.querySelector('#rem-ev-on').click()");
  await h.until(page, "JSON.parse(localStorage.getItem('todo-remind')).evening.on === false");
  await page.evaluate('window.__scheduled.length = 0');
  await page.evaluate("window.todoLocalApi('PATCH', '/api/tasks/1', { priority: 1 })");
  await h.until(page, 'window.__scheduled.length >= 1');
  assert.ok(!(await page.evaluate('window.__scheduled')).some(n => n.id >= 1000000100));
  await h.finish([page]);
});

test('pengingat per tugas di panel: tanpa pengingat meniadakan jadwalnya; bawaan 1 jam mengubah yang lain', async () => {
  const page = await h.open(env, { native: true, view: 'Semua tugas', seed: [T(1, 'A', { deadline: D(2), due_time: '10:00' }), T(2, 'B', { deadline: D(2), due_time: '12:00' })] });
  await h.until(page, 'window.__scheduled.filter(n => n.id < 1000000000).length === 4');
  await page.click('.row[data-id="1"] .title');
  await h.until(page, "document.querySelector('#f-remind')");
  await page.evaluate('window.__scheduled.length = 0');
  await page.selectOption('#f-remind', '-1');
  await h.until(page, 'window.__scheduled.length >= 1');
  const ids = (await page.evaluate('window.__scheduled')).map(n => n.id).filter(i => i < 1000000000).sort();
  assert.deepStrictEqual(ids, [4, 5]); // hanya tugas B
  await page.evaluate("document.querySelector('#remind-btn').click()");
  await page.selectOption('#rem-lead', '60');
  await page.evaluate('window.__scheduled.length = 0');
  await page.evaluate("window.todoLocalApi('PATCH', '/api/tasks/2', { priority: 1 })");
  await h.until(page, 'window.__scheduled.length >= 1');
  const early = (await page.evaluate('window.__scheduled')).find(n => n.id === 5);
  assert.ok(early && /60/.test(early.title), early && early.title);
  const prefs = await page.evaluate("JSON.parse(localStorage.getItem('todo-remind'))");
  const uid1 = (await h.stored(page)).tasks.find(t => t.title === 'A').uid;
  assert.strictEqual(prefs.per[uid1], -1);
  assert.ok(prefs.at);
  await h.finish([page]);
});

test('notifikasi terkirim yang basi dibersihkan: tugas selesai dan ringkasan malam bila tak ada sisa', async () => {
  const page = await h.open(env, { native: true, seed: [T(1, 'A', { deadline: TODAY, due_time: '23:59' }), T(2, 'B', { deadline: TODAY, due_time: '23:58' })] });
  await h.until(page, 'window.__scheduled.length >= 1');
  // seolah-olah sudah terkirim: pengingat A (id 2), pengingat B (id 4), ringkasan malam (1000000100), ringkasan pagi (1000000000)
  await page.evaluate('window.__delivered = [2, 4, 1000000100, 1000000000]; window.__removed = []');
  await page.evaluate("window.todoLocalApi('POST', '/api/tasks/1/done')");
  await h.until(page, 'window.__removed && window.__removed.length >= 1');
  assert.deepStrictEqual(await page.evaluate('window.__removed.slice().sort((a, b) => a - b)'), [2]); // A selesai; B dan ringkasan masih relevan
  await page.evaluate('window.__removed = []');
  await page.evaluate("window.todoLocalApi('POST', '/api/tasks/2/done')");
  await h.until(page, 'window.__removed && window.__removed.length >= 3');
  assert.deepStrictEqual(await page.evaluate('window.__removed.slice().sort((a, b) => a - b)'), [2, 4, 1000000000, 1000000100]);
  await h.finish([page]);
});

test('dialog Pengingat: jam dikunci saat ringkasan mati; petunjuk di panel hanya untuk tugas tanpa jam; sinkron memperbarui dialog', async () => {
  const page = await h.open(env, { native: true, view: 'Semua tugas', seed: [T(1, 'Tanpa jam', { deadline: D(2) }), T(2, 'Berjam', { deadline: D(2), due_time: '10:00' })] });
  await page.click('.row[data-id="1"] .title');
  await h.until(page, "document.querySelector('#f-remind-hint')");
  assert.ok(!(await page.evaluate("document.querySelector('#f-remind-hint').hidden")));
  await page.evaluate("document.querySelector('#drawer [aria-label=\"Tutup panel\"]').click()");
  await page.click('.row[data-id="2"] .title');
  await h.until(page, "document.querySelector('#f-remind-hint')");
  assert.ok(await page.evaluate("document.querySelector('#f-remind-hint').hidden"));
  await page.evaluate("document.querySelector('#drawer [aria-label=\"Tutup panel\"]').click()");
  await page.evaluate("document.querySelector('#remind-btn').click()");
  await h.until(page, "!document.querySelector('#remind').hidden");
  assert.ok(!(await page.evaluate("document.querySelector('#rem-ev-hour').disabled")));
  await page.evaluate("document.querySelector('#rem-ev-on').click()");
  assert.ok(await page.evaluate("document.querySelector('#rem-ev-hour').disabled"));
  // pengaturan dari perangkat lain tiba lewat sinkron
  await page.evaluate(`window.todoLocalStore.settingsHook.apply({ at: '2999-01-01T00:00:00Z', remind: { lead: 60, evening: { on: true, hour: 19 }, per: {} } })`);
  await h.until(page, "document.querySelector('#rem-lead').value === '60' && document.querySelector('#rem-ev-hour').value === '19' && document.querySelector('#rem-ev-on').checked");
  await h.finish([page]);
});
