'use strict';
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers.js');
const { task: T, TODAY } = h;

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(); });

test('hapus dari panel: tanpa dialog, ke sampah, "Urungkan" mengembalikan lengkap dengan subtugas', async () => {
  const page = await h.open(env, { seed: [T(1, 'Induk', { deadline: TODAY, notes: 'isi' }), T(2, 'Anak', { parent_id: 1 }), T(3, 'Lain', { deadline: TODAY })] });
  let dialogs = 0; page.on('dialog', d => { dialogs++; d.dismiss(); });
  await h.until(page, "document.querySelector('.row[data-id=\"1\"]')");
  await page.click('.row[data-id="1"] .title');
  await h.until(page, "document.querySelector('#drawer.open')");
  await page.getByRole('button', { name: 'Hapus tugas' }).click();
  await h.waitStored(page, d => !d.tasks.some(t => t.title === 'Induk' || t.title === 'Anak'));
  assert.strictEqual(dialogs, 0);
  await h.until(page, "document.querySelector('#toasts button')");
  assert.match(await page.textContent('#toasts'), /dipindah ke sampah/);
  await page.click('#toasts button');
  await h.waitStored(page, d => d.tasks.length === 3 && d.trash.length === 0);
  const d = await h.stored(page);
  const induk = d.tasks.find(t => t.title === 'Induk'), anak = d.tasks.find(t => t.title === 'Anak');
  assert.strictEqual(induk.notes, 'isi');
  assert.strictEqual(anak.parent_id, induk.id);
  await h.finish([page]);
});

test('tampilan Sampah: daftar, pulihkan satu, hapus permanen (konfirmasi), kosongkan', async () => {
  const page = await h.open(env, { seed: [1, 2, 3].map(i => T(i, 'Tugas' + i, { deadline: TODAY })) });
  await h.until(page, "document.querySelectorAll('#list .row').length === 3");
  for (const i of [1, 2, 3]) {
    await page.click('.row[data-id="' + i + '"] .title');
    await h.until(page, "document.querySelector('#drawer.open')");
    await page.getByRole('button', { name: 'Hapus tugas' }).click();
    await h.waitStored(page, d => !d.tasks.some(t => t.id === i));
    await h.until(page, "!document.querySelector('#drawer.open')");
  }
  await h.view(page, 'Sampah');
  await h.until(page, "document.querySelectorAll('.trash-row').length === 3");
  assert.match(await page.textContent('#side-stats, body'), /Sampah/);
  assert.match(await page.textContent('#view-sub'), /30 hari/);
  // pulihkan satu
  await page.click('.trash-row:has-text("Tugas2") [data-act="restore"]');
  await h.waitStored(page, d => d.tasks.some(t => t.title === 'Tugas2'));
  await h.until(page, "document.querySelectorAll('.trash-row').length === 2");
  // hapus permanen: batal dulu, lalu setuju
  page.once('dialog', d => d.dismiss());
  await page.click('.trash-row:has-text("Tugas1") [data-act="purge"]');
  await page.waitForTimeout(300);
  assert.strictEqual(await page.locator('.trash-row').count(), 2);
  page.once('dialog', d => d.accept());
  await page.click('.trash-row:has-text("Tugas1") [data-act="purge"]');
  await h.until(page, "document.querySelectorAll('.trash-row').length === 1");
  assert.strictEqual((await h.stored(page)).trash.length, 1);
  // kosongkan
  page.once('dialog', d => d.accept());
  await page.click('#trash-empty');
  await h.until(page, "document.querySelector('#list .empty')");
  assert.strictEqual((await h.stored(page)).trash.length, 0);
  assert.match(await page.textContent('#list'), /Sampah kosong/);
  await h.finish([page]);
});

test('"Hapus semua yang selesai" tanpa dialog, bisa diurungkan sekaligus', async () => {
  const done = (id, title) => T(id, title, { done: true, completed_at: TODAY + 'T09:00:00' });
  const page = await h.open(env, { view: 'Selesai', seed: [done(1, 'A'), done(2, 'B'), T(3, 'Aktif', { deadline: TODAY })] });
  let dialogs = 0; page.on('dialog', d => { dialogs++; d.dismiss(); });
  await h.until(page, "document.querySelectorAll('#list .row').length === 2");
  await page.getByRole('button', { name: 'Hapus semua yang selesai' }).click();
  await h.waitStored(page, d => d.tasks.length === 1 && d.trash.length === 2);
  assert.strictEqual(dialogs, 0);
  await h.until(page, "document.querySelector('#toasts button')");
  await page.click('#toasts button');
  await h.waitStored(page, d => d.tasks.length === 3 && d.trash.length === 0);
  assert.ok((await h.stored(page)).tasks.filter(t => t.done).length === 2);
  await h.finish([page]);
});

test('membatalkan selesai pada tugas berulang tidak mengotori sampah', async () => {
  const page = await h.open(env, { seed: [T(1, 'Rutin', { deadline: TODAY, repeat: '1d' })] });
  await h.until(page, "document.querySelector('.row[data-id=\"1\"] .check')");
  await page.click('.row[data-id="1"] .check');
  await h.waitStored(page, d => d.tasks.length === 2);
  await h.until(page, "document.querySelector('#toasts button')");
  await page.click('#toasts button');
  await h.waitStored(page, d => d.tasks.length === 1 && !d.tasks[0].done);
  assert.strictEqual((await h.stored(page)).trash.length, 0);
  await h.finish([page]);
});
