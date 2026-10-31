'use strict';
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers.js');
const { task: T, TODAY, day: D } = h;

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(); });

test('pertama kali pakai: sambutan + tiga tips + tiga tombol; "Tulis tugas pertama" memfokuskan kolom tambah', async () => {
  const page = await h.open(env, { width: 390, height: 844 });
  await h.until(page, "document.querySelector('#welcome')");
  assert.strictEqual(await page.locator('#welcome .tips li').count(), 3);
  await page.click('#welcome-write');
  assert.strictEqual(await page.evaluate('document.activeElement.id'), 'quick-input');
  await h.finish([page]);
});

test('"Coba dengan contoh" membuat tugas + subtugas yang bisa langsung dicoba, lalu sambutan hilang', async () => {
  const page = await h.open(env, { width: 390, height: 844 });
  await h.until(page, "document.querySelector('#welcome-sample')");
  await page.click('#welcome-sample');
  await h.waitStored(page, d => d.tasks.length === 5);
  const d = await h.stored(page);
  assert.strictEqual(d.tasks.filter(t => t.parent_id !== null).length, 2);
  assert.ok(d.tasks.some(t => t.deadline === TODAY) && d.tasks.some(t => t.deadline === D(1)));
  await h.until(page, "!document.querySelector('#welcome') && document.querySelector('.row')");
  assert.match(await page.textContent('#toasts'), /Contoh ditambahkan/);
  await h.finish([page]);
});

test('"Tempel daftar" membuka dialog tambah banyak', async () => {
  const page = await h.open(env, { width: 390, height: 844 });
  await h.until(page, "document.querySelector('#welcome-paste')");
  await page.click('#welcome-paste');
  await h.until(page, "!document.querySelector('#bulk').hidden");
  await h.finish([page]);
});

test('hari ini kosong tapi ada tugas lain: tombol menuju Mendatang; tanpa sambutan', async () => {
  const page = await h.open(env, { width: 390, height: 844, seed: [T(1, 'Nanti', { deadline: D(3) })] });
  await h.until(page, "document.querySelector('#empty-upcoming')");
  assert.strictEqual(await page.locator('#welcome').count(), 0);
  await page.click('#empty-upcoming');
  await h.until(page, "document.querySelector('#view-title').textContent === 'Mendatang' && document.querySelector('.row')");
  await h.finish([page]);
});

test('mode Inggris: sambutan dan contoh berbahasa Inggris, contoh memakai kata kunci yang dikenali', async () => {
  const page = await h.open(env, { width: 390, height: 844, lang: 'en' });
  await h.until(page, "document.querySelector('#welcome-sample')");
  assert.match(await page.textContent('#welcome h2'), /Welcome to Tuntas Harian/);
  await page.click('#welcome-sample');
  await h.waitStored(page, d => d.tasks.length === 5);
  const d = await h.stored(page);
  assert.ok(d.tasks.some(t => t.deadline === TODAY) && d.tasks.some(t => t.deadline === D(1)));
  assert.ok(d.tasks.some(t => t.title.startsWith('Swipe this task right')));
  await h.finish([page]);
});
