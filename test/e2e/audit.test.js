'use strict';
// Regresi dari audit 0.35 (bug yang ditemukan peninjau kode independen).
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers.js');
const { task: T, TODAY } = h;

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(); });

test('Duplikat lalu tutup panel: aplikasi tetap bisa disentuh (tumpukan dialog tidak ganda)', async () => {
  const page = await h.open(env, { width: 390, height: 844, seed: [T(1, 'Asli', { deadline: TODAY })] });
  await h.until(page, "document.querySelector('.row')");
  await page.click('#list .row .title');
  await h.until(page, "document.querySelector('#f-dup')");
  await page.click('#f-dup');
  await h.waitStored(page, d => d.tasks.length === 2);
  await page.click('button[aria-label="Tutup panel"]');
  await h.until(page, "!document.querySelector('main.main').inert");
  assert.strictEqual(await page.evaluate("document.querySelector('main.main').inert"), false);
  await page.fill('#quick-input', 'Masih bisa mengetik');
  assert.strictEqual(await page.inputValue('#quick-input'), 'Masih bisa mengetik');
  await h.finish([page]);
});

test('ketuk ganda centang tugas berulang: hanya satu tugas berikutnya', async () => {
  const page = await h.open(env, { width: 390, height: 844, seed: [T(1, 'Harian', { deadline: TODAY, repeat: '1d' })] });
  await h.until(page, "document.querySelector('.row .check')");
  await page.evaluate("(() => { const c = document.querySelector('.row .check'); c.click(); c.click(); })()");
  await h.waitStored(page, d => d.tasks.length >= 2);
  await page.waitForTimeout(600);
  assert.strictEqual((await h.stored(page)).tasks.length, 2);
  await h.finish([page]);
});

test('penyimpanan penuh: layar kembali ke data yang tersimpan, bukan data yang hilang saat ditutup', async () => {
  const page = await h.open(env, { width: 390, height: 844, seed: [T(1, 'Ada', { deadline: TODAY })] });
  await h.until(page, "document.querySelector('.row')");
  await page.evaluate(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'todo-cli.data.v1') throw new Error('quota'); return o.apply(this, arguments); }; });
  await page.fill('#quick-input', 'Tidak akan tersimpan');
  await page.keyboard.press('Enter');
  await h.until(page, "document.querySelector('.toast.error')");
  assert.strictEqual(await page.evaluate('window.todoLocalStore.tasks.length'), 1, 'memori kembali ke 1 tugas');
  assert.strictEqual(await page.locator('#list .row').count(), 1, 'daftar tidak menampilkan tugas yang gagal disimpan');
  await h.finish([page]);
});

test('Android: token dan kata sandi sinkron disimpan di penyimpanan native (bukan localStorage yang ikut cadangan), tetap berfungsi setelah dibuka ulang, dan terhapus saat dimatikan', async () => {
  const gh = h.fakeGithub('ghp_rahasia_native');
  const page = await h.open(env, { github: gh, native: true, seed: [T(1, 'Tugas sinkron')], view: 'Semua tugas' });
  page.on('dialog', d => d.accept());
  await page.click('#backup-btn');
  await page.fill('#auto-token', 'ghp_rahasia_native');
  await page.fill('#auto-pass', 'sandi-rahasia-1');
  await page.click('#auto-on');
  await h.until(page, "JSON.parse(localStorage.getItem('todo-cli.autosync') || '{}').gistId", 8000);
  const ls = await page.evaluate("localStorage.getItem('todo-cli.autosync')");
  assert.ok(!ls.includes('ghp_rahasia_native') && !ls.includes('sandi-rahasia-1'), 'rahasia tidak boleh ada di localStorage: ' + ls);
  assert.ok(JSON.parse(ls).secure === true);
  const sec = await page.evaluate("JSON.parse(sessionStorage.getItem('__secrets'))");
  assert.strictEqual(sec.token, 'ghp_rahasia_native'); assert.strictEqual(sec.passphrase, 'sandi-rahasia-1');
  // buka ulang: sinkron tetap tersambung (rahasia dimuat dari native)
  await page.reload();
  await page.waitForSelector('#nav-views button');
  await page.click('#backup-btn');
  await h.until(page, "!document.querySelector('#auto-now').hidden", 8000);
  assert.ok(await page.locator('#auto-token').isHidden(), 'masih tersambung setelah dibuka ulang');
  // matikan: semuanya hilang
  await page.click('#auto-off');
  await h.until(page, "!JSON.parse(sessionStorage.getItem('__secrets') || '{}').token", 4000);
  assert.strictEqual(await page.evaluate("localStorage.getItem('todo-cli.autosync')"), null);
  await h.finish([page]);
});

test('izin "Alarm & pengingat" dicabut: spanduk muncul dengan tombol pengaturan; jadwal pengingat mencakup 45 hari', async () => {
  const page = await h.open(env, { native: true, width: 390, height: 844, seed: [T(1, 'Berjam', { deadline: TODAY, due_time: '23:59' }), T(2, 'Jauh', { deadline: h.day(40), due_time: '09:00' })] });
  await h.until(page, "window.__scheduled.length > 0");
  assert.ok(await page.evaluate("window.__scheduled.some(n => n.id === 4)"), 'tugas 40 hari lagi ikut dijadwalkan (id 4 = tugas 2)');
  assert.ok(await page.locator('#notif-banner').isHidden());
  await page.evaluate("window.__exact = 'denied'");
  await page.fill('#quick-input', 'Tambah memicu jadwal ulang');
  await page.keyboard.press('Enter');
  await h.until(page, "!document.querySelector('#notif-banner').hidden", 8000);
  assert.match(await page.textContent('#notif-banner'), /Alarm & pengingat/);
  await page.click('#exact-open');
  assert.ok(await page.evaluate('window.__exactOpened === true'));
  await h.finish([page]);
});
