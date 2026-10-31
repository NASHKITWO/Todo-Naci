'use strict';
// v0.16: pindahkan semua yang terlambat ke hari ini (dengan urungkan) dan ubah nama proyek.
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers');
const { task: T, TODAY, day: D } = h;

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(env); });

test('terlambat: pindah ke hari ini, jam lewat dikosongkan, bisa diurungkan', async () => {
  const seed = [T(1, 'Lama A', { deadline: D(-3), due_time: '00:00' }), T(2, 'Lama B', { deadline: D(-1) }), T(3, 'Besok', { deadline: D(1) }), T(4, 'Selesai lama', { deadline: D(-5), done: true, completed_at: D(-5) + 'T08:00:00' })];
  const page = await h.open(env, { view: 'Semua tugas', seed });
  await h.until(page, "document.querySelector('#resched-overdue')");
  assert.strictEqual(await page.locator('#resched-overdue').count(), 1);
  await page.click('#resched-overdue');
  await h.waitStored(page, d => d.tasks.find(t => t.id === 1).deadline === TODAY && d.tasks.find(t => t.id === 2).deadline === TODAY);
  let d = await h.stored(page);
  assert.strictEqual(d.tasks.find(t => t.id === 1).due_time, null, 'jam 00:00 pasti sudah lewat: dikosongkan');
  assert.strictEqual(d.tasks.find(t => t.id === 3).deadline, D(1), 'yang lain tidak tersentuh');
  assert.strictEqual(d.tasks.find(t => t.id === 4).deadline, D(-5), 'yang selesai tidak tersentuh');
  assert.match(await page.textContent('#toasts'), /2 tugas dipindah ke hari ini/);
  await page.click('#toasts button');
  await h.waitStored(page, x => x.tasks.find(t => t.id === 1).deadline === D(-3));
  d = await h.stored(page);
  assert.strictEqual(d.tasks.find(t => t.id === 1).due_time, '00:00', 'jam kembali');
  assert.strictEqual(d.tasks.find(t => t.id === 2).deadline, D(-1));
  await h.finish([page]);
});

test('terlambat: jam yang belum lewat hari ini tetap dipertahankan', async () => {
  // deadline kemarin dengan jam 23:59: setelah pindah ke hari ini jam 23:59 belum lewat (kecuali pukul 23:59), jadi dipertahankan
  const page = await h.open(env, { view: 'Semua tugas', seed: [T(1, 'Malam', { deadline: D(-1), due_time: '23:59' })] });
  await h.until(page, "document.querySelector('#resched-overdue')");
  await page.click('#resched-overdue');
  await h.waitStored(page, d => d.tasks[0].deadline === TODAY);
  assert.strictEqual((await h.stored(page)).tasks[0].due_time, '23:59');
  await h.finish([page]);
});

test('ubah nama proyek: semua tugas ikut, warna ikut, kosong ditolak, Esc menutup, nama sama menggabung', async () => {
  const seed = [T(1, 'A', { deadline: TODAY, project: 'kuliah' }), T(2, 'B', { project: 'Kuliah', done: true, completed_at: TODAY + 'T08:00:00' }), T(3, 'C', { deadline: TODAY, project: 'rumah' })];
  const page = await h.open(env, { view: 'Semua tugas', seed });
  await h.until(page, "document.querySelector('#nav-projects .nav-item')");
  assert.ok(await page.locator('#rename-btn').isHidden(), 'tombol hanya di tampilan proyek');
  await page.evaluate("Array.from(document.querySelectorAll('#nav-projects .nav-item')).find(b => /^kuliah/i.test(b.textContent)).click()");
  await h.until(page, "/^@kuliah$/i.test(document.querySelector('#view-title').textContent)");
  const before = await page.evaluate("(document.querySelector('.chip.project').className.match(/pc\\d/) || [])[0]");
  await page.click('#rename-btn');
  await h.until(page, "!document.querySelector('#rename').hidden");
  assert.strictEqual(await page.evaluate('document.activeElement.id'), 'ren-name');
  await page.fill('#ren-name', '   ');
  await page.click('#ren-save');
  await h.until(page, "document.querySelector('#ren-msg').textContent.includes('tidak boleh kosong')");
  await page.keyboard.press('Escape');
  await h.until(page, "document.querySelector('#rename').hidden");
  assert.strictEqual(await page.evaluate('document.activeElement.id'), 'rename-btn');
  assert.strictEqual((await h.stored(page)).tasks.filter(t => t.project === 'kuliah' || t.project === 'Kuliah').length, 2);
  await page.click('#rename-btn');
  await page.fill('#ren-name', 'Skripsi');
  await page.click('#ren-save');
  await h.waitStored(page, d => d.tasks.filter(t => t.project === 'Skripsi').length === 2);
  await h.until(page, "document.querySelector('#view-title').textContent === '@Skripsi'");
  assert.match(await page.textContent('#toasts'), /diganti nama menjadi Skripsi/);
  assert.strictEqual(await page.evaluate("(document.querySelector('.chip.project').className.match(/pc\\d/) || [])[0]"), before, 'warna ikut pindah');
  // gabung ke proyek lain
  await page.click('#rename-btn');
  await page.fill('#ren-name', 'rumah');
  await page.click('#ren-save');
  await h.waitStored(page, d => d.tasks.filter(t => (t.project || '').toLowerCase() === 'rumah').length === 3);
  await h.finish([page]);
});

test('mode Inggris: tombol dan dialog tanpa sisa kata Indonesia', async () => {
  const page = await h.open(env, { lang: 'en', view: 'All tasks', seed: [T(1, 'Old', { deadline: D(-2), project: 'kuliah' })] });
  await h.until(page, "document.querySelector('#resched-overdue')");
  assert.strictEqual(await page.textContent('#resched-overdue'), 'Move to today');
  await page.click('#resched-overdue');
  await h.until(page, "/1 task moved to today/.test(document.querySelector('#toasts').textContent)");
  await page.evaluate("Array.from(document.querySelectorAll('#nav-projects .nav-item')).find(b => /^kuliah/i.test(b.textContent)).click()");
  await page.click('#rename-btn');
  await h.until(page, "!document.querySelector('#rename').hidden");
  const text = await page.evaluate("document.querySelector('#rename').innerText");
  assert.match(text, /Rename project/); assert.match(text, /Cancel/);
  assert.doesNotMatch(text, /\bproyek\b|\bBatal\b|\bSimpan\b/);
  await h.finish([page]);
});
