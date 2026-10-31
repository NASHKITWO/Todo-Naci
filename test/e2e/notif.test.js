'use strict';
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers.js');
const { task: T, TODAY, day: D } = h;

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(); });

const fire = (page, actionId, uid, id) => page.evaluate(`window.__lnListeners.localNotificationActionPerformed({ actionId: ${JSON.stringify(actionId)}, notification: { id: ${id || 2}, extra: { uid: ${JSON.stringify(uid)} } } })`);
const seed = () => [T(1, 'Rapat', { deadline: TODAY, due_time: '23:59' }), T(2, 'Lain', { deadline: TODAY }), T(3, 'Besok', { deadline: D(1) })];
const uidOf = async (page, title) => (await h.stored(page)).tasks.find(t => t.title === title).uid;

test('notifikasi: jenis aksi terdaftar, pengingat tugas membawa tombol Selesai/Tunda + uid, ringkasan harian tidak', async () => {
  const page = await h.open(env, { native: true, seed: seed() });
  await h.until(page, 'window.__scheduled.length >= 2');
  const types = await page.evaluate('window.__actionTypes');
  assert.deepStrictEqual(types[0].actions.map(a => [a.id, a.title]), [['done', 'Selesai'], ['snooze', 'Tunda 1 jam']]);
  const sched = await page.evaluate('window.__scheduled');
  const uid = await uidOf(page, 'Rapat');
  const perTask = sched.filter(n => n.id < 1000000000), digest = sched.filter(n => n.id >= 1000000000);
  assert.ok(perTask.length >= 1 && digest.length >= 1);
  for (const n of perTask) { assert.strictEqual(n.actionTypeId, types[0].id); assert.deepStrictEqual(n.extra, { uid }); }
  for (const n of digest) { assert.strictEqual(n.actionTypeId, undefined); assert.strictEqual(n.extra, undefined); }
  await h.finish([page]);
});

test('aksi "Selesai" dari notifikasi menyelesaikan tugas, membersihkan notifikasi, dan tidak mengulang bila sudah selesai', async () => {
  const page = await h.open(env, { native: true, seed: seed() });
  await h.until(page, 'window.__scheduled.length >= 2');
  await fire(page, 'done', await uidOf(page, 'Rapat'), 2);
  await h.waitStored(page, d => d.tasks.find(t => t.title === 'Rapat').done);
  assert.deepStrictEqual(await page.evaluate('window.__removed'), [2]);
  await h.until(page, "!document.querySelector('.row[data-id=\"1\"]')"); // layar ikut diperbarui
  // dipicu dua kali: tetap selesai, tidak galat
  await fire(page, 'done', await uidOf(page, 'Rapat'));
  assert.ok((await h.stored(page)).tasks.find(t => t.title === 'Rapat').done);
  await h.finish([page]);
});

test('aksi "Selesai" pada tugas berulang menghasilkan kemunculan berikutnya', async () => {
  const page = await h.open(env, { native: true, seed: [T(1, 'Minum obat', { deadline: TODAY, due_time: '23:59', repeat: '1d' })] });
  await h.until(page, 'window.__scheduled.length >= 1');
  await fire(page, 'done', await uidOf(page, 'Minum obat'));
  await h.waitStored(page, d => d.tasks.length === 2);
  const d = await h.stored(page);
  assert.ok(d.tasks.some(t => !t.done && t.deadline > TODAY));
  await h.finish([page]);
});

test('aksi "Tunda 1 jam" memajukan jam (dibulatkan 5 menit) dan menjadwal ulang pengingat', async () => {
  const page = await h.open(env, { native: true, seed: seed() });
  await h.until(page, 'window.__scheduled.length >= 2');
  const before = await page.evaluate('window.__scheduled.length');
  const t0 = Date.now();
  await fire(page, 'snooze', await uidOf(page, 'Rapat'));
  const d = await h.waitStored(page, x => x.tasks.find(t => t.title === 'Rapat').due_time !== '23:59');
  const t = d.tasks.find(x => x.title === 'Rapat');
  const [hh, mm] = t.due_time.split(':').map(Number);
  const when = new Date(t.deadline + 'T00:00:00'); when.setHours(hh, mm, 0, 0);
  const diffMin = (when.getTime() - t0) / 60000;
  assert.ok(diffMin >= 58.9 && diffMin <= 72, 'sekitar satu jam dari sekarang, dibulatkan ke atas: ' + diffMin);
  assert.strictEqual(mm % 5, 0);
  assert.ok(!t.done);
  await h.until(page, `window.__scheduled.length > ${before}`, 20000); // jadwal dibuat ulang
  await h.finish([page]);
});

test('aksi untuk tugas yang sudah dihapus / tanpa uid diabaikan tanpa galat; ketukan biasa membuka panel tugas', async () => {
  const page = await h.open(env, { native: true, seed: seed() });
  await h.until(page, 'window.__scheduled.length >= 2');
  const before = JSON.stringify((await h.stored(page)).tasks);
  await fire(page, 'done', 'uidtakada0000000');
  await page.evaluate(`window.__lnListeners.localNotificationActionPerformed({ actionId: 'done', notification: { id: 1 } })`);
  await page.evaluate(`window.__lnListeners.localNotificationActionPerformed({ actionId: 'snooze' })`);
  await page.waitForTimeout(300);
  assert.strictEqual(JSON.stringify((await h.stored(page)).tasks), before);
  await fire(page, 'tap', await uidOf(page, 'Rapat'));
  await h.until(page, "document.querySelector('#drawer.open')");
  assert.strictEqual(await page.inputValue('#f-title'), 'Rapat');
  await h.finish([page]);
});

test('di browser biasa (bukan native) tidak ada pendaftaran aksi dan tidak ada galat', async () => {
  const page = await h.open(env, { seed: seed() });
  await page.waitForTimeout(500);
  assert.strictEqual(await page.evaluate('window.__actionTypes'), undefined);
  await h.finish([page]);
});
