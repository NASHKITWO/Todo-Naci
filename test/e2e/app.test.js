'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const h = require('./helpers.js');

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(); });

const tmpFile = (name, text) => { const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-')), name); fs.writeFileSync(p, text); return p; };

test('tambah, selesaikan, dan bertahan setelah muat ulang (tanpa server)', async () => {
  const page = await h.open(env, { view: 'Semua tugas' });
  await h.quickAdd(page, 'Bayar listrik !1 ^besok @rumah #tagihan');
  await h.until(page, "document.querySelectorAll('.row').length === 1");
  await h.quickAdd(page, 'Olahraga ^hariini *daily');
  await h.until(page, "document.querySelectorAll('.row').length === 2");
  await page.reload();
  await page.waitForSelector('#nav-views button');
  await h.view(page, 'Semua tugas');
  await h.until(page, "document.querySelectorAll('.row').length === 2");
  await page.locator('.row', { hasText: 'Olahraga' }).locator('.check').click();
  await h.until(page, "document.querySelectorAll('.row').length === 2"); // yang selesai pergi, yang baru (besok) muncul
  const data = await h.waitStored(page, d => d.tasks.filter(t => t.title === 'Olahraga').length === 2, 'tugas berulang');
  assert.strictEqual(data.tasks.filter(t => t.title === 'Olahraga' && t.done).length, 1);
  await h.finish([page]);
});

test('jam di panel detail dan chip', async () => {
  const page = await h.open(env, { view: 'Semua tugas' });
  await h.quickAdd(page, 'Rapat ^besok');
  await h.until(page, "document.querySelectorAll('.row').length === 1");
  await page.locator('.row .title').first().click();
  await h.until(page, "document.querySelector('#drawer').classList.contains('open')");
  await page.fill('#f-time', '14:30');
  await page.locator('#f-time').dispatchEvent('change');
  await h.until(page, "document.querySelector('.row .chip').textContent.includes('14:30')");
  assert.strictEqual((await h.stored(page)).tasks[0].due_time, '14:30');
  await h.finish([page]);
});

test('kata waktu bahasa sehari-hari dan chip jam', async () => {
  const page = await h.open(env, { view: 'Semua tugas' });
  await h.quickAdd(page, 'Telepon ^besok sore');
  await h.quickAdd(page, 'Minum obat ^jumat jam 3 sore');
  await h.until(page, "document.querySelectorAll('.row').length === 2");
  const t = (await h.stored(page)).tasks;
  assert.strictEqual(t.find(x => x.title === 'Telepon').due_time, '17:00');
  assert.strictEqual(t.find(x => x.title === 'Minum obat').due_time, '15:00');
  await page.fill('#quick-input', 'Rapat');
  await page.click('#qchip-more');
  const siang = page.locator('#quick-chips .qchip', { hasText: 'Siang 12:00' });
  await siang.click();
  assert.strictEqual(await siang.getAttribute('aria-pressed'), 'true');
  await siang.click();
  assert.strictEqual(await page.locator('#quick-chips .qchip', { hasText: 'Siang 12:00' }).getAttribute('aria-pressed'), 'false');
  await page.locator('#quick-chips .qchip', { hasText: 'Siang 12:00' }).click();
  await page.keyboard.press('Enter');
  await h.waitStored(page, d => d.tasks.some(x => x.title === 'Rapat'));
  const r = (await h.stored(page)).tasks.find(x => x.title === 'Rapat');
  assert.strictEqual(r.due_time, '12:00'); assert.strictEqual(r.deadline, h.TODAY);
  await h.finish([page]);
});

test('notifikasi dijadwalkan lalu dibatalkan saat selesai', async () => {
  const page = await h.open(env, { native: true, view: 'Semua tugas' });
  await h.quickAdd(page, 'Rapat klien ^+3d 14:00');
  await h.until(page, 'window.__scheduled.length >= 2');
  const sched = await page.evaluate('window.__scheduled');
  const timed = sched.filter(n => n.id < 1e9).sort((a, b) => a.id - b.id);
  assert.deepStrictEqual(timed.map(n => n.id), [2, 3]);
  assert.deepStrictEqual(timed.map(n => n.title), ['Jatuh tempo sekarang', 'Dalam 30 menit']);
  assert.ok(timed.every(n => n.idle && n.body === 'Rapat klien'));
  assert.ok(sched.some(n => n.id >= 1e9)); // ringkasan harian
  const before = sched.length;
  await page.locator('.row .check').first().click();
  await h.until(page, 'window.__cancelled.length >= 2');
  await page.waitForTimeout(700);
  assert.strictEqual((await page.evaluate('window.__scheduled')).length, before);
  await h.finish([page]);
});

test('cadangan: bagikan lalu pulihkan di perangkat baru', async () => {
  const a = await h.open(env, { native: true, view: 'Semua tugas' });
  await h.quickAdd(a, 'Tugas penting !1');
  await h.until(a, "document.querySelectorAll('.row').length === 1");
  await a.click('#backup-btn');
  await a.click('#backup-share');
  await h.until(a, 'window.__shared !== null');
  const shared = await a.evaluate('window.__shared');
  assert.deepStrictEqual(JSON.parse(shared.text).tasks.map(t => t.title), ['Tugas penting']);
  const b = await h.open(env, { view: 'Semua tugas' });
  assert.strictEqual(await b.locator('.row').count(), 0);
  b.on('dialog', d => d.accept());
  await b.click('#backup-btn');
  await b.fill('#backup-text', shared.text);
  await b.click('#backup-restore');
  await h.until(b, "document.querySelectorAll('.row').length === 1");
  assert.match(await b.locator('#backup-msg').textContent(), /1 tugas dipulihkan/);
  await b.fill('#backup-text', 'bukan json');
  await b.click('#backup-restore');
  assert.match(await b.locator('#backup-msg').textContent(), /bukan JSON/);
  await h.finish([a, b]);
});

test('sinkron: berkas dibagikan (native) lalu digabung di ponsel kedua; berkas salah ditolak', async () => {
  const a = await h.open(env, { native: true, view: 'Semua tugas' });
  await h.quickAdd(a, 'Beli susu !1 ^besok #belanja');
  await h.until(a, "document.querySelectorAll('.row').length === 1");
  await a.click('#backup-btn');
  await a.click('#sync-send');
  await h.until(a, 'window.__shared && window.__shared.files');
  assert.strictEqual(await a.evaluate('window.__shared.files[0]'), 'file:///cache/todo-sync.json');
  assert.strictEqual(await a.evaluate('window.__written.directory'), 'CACHE');
  const text = await a.evaluate('window.__written.data');
  const data = JSON.parse(text);
  assert.deepStrictEqual([data.kind, data.format, data.tasks.length], ['sync', 1, 1]);
  const file = tmpFile('todo-sync.json', text);
  const b = await h.open(env, { view: 'Semua tugas' });
  await b.click('#backup-btn');
  await b.setInputFiles('#sync-file', file);
  await h.until(b, "document.querySelector('#sync-msg').textContent.includes('1 baru')");
  await b.click('#backup-close');
  await h.until(b, "document.querySelectorAll('.row').length === 1");
  assert.match(await b.locator('.row .title').first().textContent(), /Beli susu/);
  await b.click('#backup-btn');
  await b.setInputFiles('#sync-file', file);
  await h.until(b, "document.querySelector('#sync-msg').textContent.includes('0 baru, 0 diperbarui, 0 dihapus')");
  await b.setInputFiles('#sync-file', tmpFile('rusak.json', '{bukan json'));
  await h.until(b, "document.querySelector('#sync-msg').textContent.includes('bukan JSON')");
  await b.setInputFiles('#sync-file', tmpFile('lain.json', '{"app": "todo-cli", "tasks": []}'));
  await h.until(b, "document.querySelector('#sync-msg').textContent.includes('bukan berkas sinkron')");
  await b.click('#backup-close');
  assert.strictEqual(await b.locator('.row').count(), 1);
  await h.finish([a, b]);
});

test('sinkron: di browser biasa berkas diunduh', async () => {
  const page = await h.open(env, { view: 'Semua tugas' });
  await h.quickAdd(page, 'Satu');
  await h.until(page, "document.querySelectorAll('.row').length === 1");
  await page.click('#backup-btn');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#sync-send')]);
  assert.strictEqual(download.suggestedFilename(), 'todo-sync.json');
  assert.strictEqual(JSON.parse(fs.readFileSync(await download.path(), 'utf8')).tasks.length, 1);
  await h.finish([page]);
});

test('tentang: nama pengembang dan versi tampil di panel cadangan', async () => {
  const page = await h.open(env, {});
  await page.click('#backup-btn');
  const text = await page.textContent('#about');
  assert.match(text, /Muhammad Ikhsan, Teknik Informatika, Universitas Pamulang/);
  assert.match(text, new RegExp('v' + require('../../package.json').version.replace(/\./g, '\\.')));
  await h.finish([page]);
});

test('kredit pengembang tampil di layar daftar tugas (lengkap dengan email)', async () => {
  const page = await h.open(env, { width: 390, height: 844, seed: [h.task(1, 'Satu')] });
  const foot = page.locator('#about-foot');
  await foot.scrollIntoViewIfNeeded();
  assert.ok(await foot.isVisible());
  const text = await foot.textContent();
  assert.match(text, /Pendiri dan Pengembang: Muhammad Ikhsan/);
  assert.match(text, /Teknik Informatika, Universitas Pamulang/);
  assert.match(text, /ican3192@gmail\.com/);
  assert.strictEqual(await foot.locator('a[href^="mailto:"]').getAttribute('href'), 'mailto:ican3192@gmail.com');
  const don = foot.locator('#donate-link');
  assert.strictEqual(await don.getAttribute('href'), 'https://sociabuzz.com/nacitwo/tribe');
  assert.strictEqual(await don.getAttribute('target'), '_blank');
  assert.match(await don.getAttribute('rel'), /noopener/);
  assert.match(await don.getAttribute('rel'), /noreferrer/);
  assert.ok(await page.evaluate("document.querySelector('#about-foot').getBoundingClientRect().bottom <= window.innerHeight"));
  await page.click('#menu-btn'); await page.click('#backup-btn');
  assert.match(await page.textContent('#about'), /ican3192@gmail\.com/);
  await h.finish([page]);
});

test('panel cadangan & sinkron tetap terjangkau di layar kecil (bisa digulir)', async () => {
  const page = await h.open(env, { width: 360, height: 520 });
  await page.click('#menu-btn');
  await page.click('#backup-btn');
  await page.locator('#backup-close').scrollIntoViewIfNeeded();
  assert.ok(await page.locator('#backup-close').isVisible());
  assert.ok(await page.evaluate("document.querySelector('#backup').scrollHeight > document.querySelector('#backup').clientHeight"));
  await page.click('#backup-close');
  await h.until(page, "document.querySelector('#backup').hidden");
  await h.finish([page]);
});

test('teks berbahaya hanya tampil sebagai teks', async () => {
  const page = await h.open(env, { view: 'Semua tugas' });
  await h.quickAdd(page, '<img src=x onerror=window.__pwned=1> <script>window.__pwned=2</script>');
  await h.until(page, "document.querySelectorAll('.row').length === 1");
  await page.waitForTimeout(200);
  assert.strictEqual(await page.evaluate('window.__pwned'), undefined);
  assert.strictEqual(await page.locator('.row img').count(), 0);
  await h.finish([page]);
});

test('masukan salah menampilkan pesan, tidak menambah tugas', async () => {
  const page = await h.open(env, { view: 'Semua tugas' });
  await h.typeAdd(page, '   '); // hanya spasi: tidak ada yang ditambahkan
  await page.waitForTimeout(200);
  const err = await page.evaluate(async () => { try { await window.todoLocalApi('POST', '/api/quick', { text: 'Salah ^tanggalngawur' }); return ''; } catch (e) { return e.message; } });
  assert.ok(err.length > 0, 'inti tetap menolak tanggal salah');
  assert.strictEqual(await page.locator('.row').count(), 0);
  const saved = await h.stored(page);
  assert.ok(!saved || saved.tasks.length === 0);
  await h.finish([page]);
});

test('tata letak ponsel: menu tampil, tanpa gulir mendatar', async () => {
  const page = await h.open(env, { width: 390, height: 760, view: null, seed: [h.task(1, 'Satu', { deadline: h.TODAY })] });
  await h.until(page, "document.querySelectorAll('#list .row').length === 1");
  assert.ok(await page.locator('#menu-btn').isVisible());
  assert.ok(await page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'));
  await page.click('#menu-btn');
  await h.until(page, "document.body.classList.contains('nav-open')");
  assert.ok(await page.locator('#nav-views button', { hasText: 'Kalender' }).isVisible());
  await h.finish([page]);
});

test('geser: kanan selesai, kiri tunda ke besok; pendek dan mouse diabaikan', async () => {
  const page = await h.open(env, { seed: [h.task(1, 'Selesaikan aku', { deadline: h.TODAY }), h.task(2, 'Tunda aku', { deadline: h.TODAY, due_time: '09:15' }), h.task(3, 'Tetap', { deadline: h.TODAY })] });
  await h.until(page, "document.querySelectorAll('.row').length === 3");
  await h.swipe(page, '.row[data-id="3"]', 40);
  await h.swipe(page, '.row[data-id="3"]', 200, 'mouse');
  await page.waitForTimeout(500);
  assert.strictEqual((await h.stored(page)).tasks.find(t => t.id === 3).done, false);
  await h.swipe(page, '.row[data-id="1"]', 150);
  await h.waitStored(page, d => d.tasks.find(t => t.id === 1).done, 'selesai');
  await h.swipe(page, '.row[data-id="2"]', -150);
  const d = await h.waitStored(page, d => d.tasks.find(t => t.id === 2).deadline === h.day(1), 'ditunda');
  assert.strictEqual(d.tasks.find(t => t.id === 2).due_time, '09:15');
  await h.until(page, "document.querySelector('#toasts').textContent.includes('Ditunda ke besok')");
  await page.locator('#toasts button', { hasText: 'Urungkan' }).last().click();
  await h.waitStored(page, d => d.tasks.find(t => t.id === 2).deadline === h.TODAY, 'urung');
  await h.finish([page]);
});

test('sapaan, cincin progres, dan konfeti saat semua beres', async () => {
  const page = await h.open(env, { seed: [h.task(1, 'Satu', { deadline: h.TODAY }), h.task(2, 'Dua', { deadline: h.TODAY })] });
  await h.until(page, "document.querySelector('#hero-label').textContent === '0/2'");
  assert.match(await page.textContent('#hero-title'), /^Selamat (pagi|siang|sore|malam)$/);
  await page.locator('.row[data-id="1"] .check').click();
  await h.until(page, "document.querySelector('#hero-label').textContent === '1/2'");
  await page.locator('.row[data-id="2"] .check').click();
  await h.until(page, "document.querySelector('.confetti')");
  await h.until(page, "document.querySelector('#hero .ring').classList.contains('full')");
  await h.until(page, '!document.querySelector(".confetti")', 4000);
  await h.finish([page]);
});
