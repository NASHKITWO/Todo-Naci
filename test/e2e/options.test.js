'use strict';
// Tambah tugas tanpa simbol: judul biasa + tombol pilihan. Tidak ada bantuan/penanda ! ^ @ # * di antarmuka.
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers');
const { TODAY } = h;

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(env); });

test('antarmuka tidak lagi menampilkan simbol atau tombol bantuan simbol', async () => {
  const page = await h.open(env, { width: 390, height: 844, seed: [] });
  await h.until(page, "document.querySelector('#quick-input')");
  assert.strictEqual(await page.locator('#help-btn').count(), 0);
  assert.strictEqual(await page.locator('#quick-help').count(), 0);
  assert.doesNotMatch(await page.getAttribute('#quick-input', 'placeholder'), /[!^@#*]/);
  await page.focus('#quick-input');
  const first = await page.locator('#quick-chips .qchip').allTextContents();
  assert.ok(first.length <= 8, 'awalnya ringkas: ' + first.length);
  assert.ok(first.includes('Lainnya…'));
  assert.strictEqual(await page.locator('#qchip-bulk').count(), 0);
  await page.click('#qchip-more');
  const chips = await page.locator('#quick-chips .qchip').allTextContents();
  for (const want of ['Hari ini', 'Besok', 'Minggu depan', 'Pagi 08:00', 'Siang 12:00', 'Sore 17:00', 'Malam 20:00', 'Tinggi', 'Sedang', 'Rendah', 'Harian', 'Mingguan', 'Bulanan', 'Lebih sedikit', 'Tambah banyak…', 'Detail lengkap…']) assert.ok(chips.includes(want), 'tombol ada: ' + want);
  assert.doesNotMatch(await page.evaluate('document.body.innerText'), /\^besok|!1|\*weekly/);
  // "Akhir pekan" hanya ada bila Sabtu bukan hari ini atau besok (kalau tidak, dobel dengan tombol lain)
  const dow = new Date(h.TODAY + 'T00:00:00').getDay();
  assert.strictEqual(chips.includes('Akhir pekan'), !(dow === 6 || dow === 5));
  await h.finish([page]);
});

test('judul + tombol: tanggal, jam, prioritas, ulangi, proyek dipakai, lalu pilihan dikosongkan', async () => {
  const page = await h.open(env, { view: 'Semua tugas', seed: [h.task(1, 'Lama', { deadline: TODAY, project: 'kuliah' })] });
  await h.until(page, "document.querySelectorAll('#list .row').length === 1");
  await page.fill('#quick-input', 'Bayar listrik');
  for (const label of ['Besok', 'Tinggi']) await page.locator('#quick-chips .qchip', { hasText: label }).click();
  await page.click('#qchip-more');
  for (const label of ['Sore 17:00', 'Bulanan', 'kuliah']) await page.locator('#quick-chips .qchip', { hasText: label }).click();
  // "Akhir pekan" ikut menyala bila jatuh di hari yang sama dengan Besok (mis. hari Jumat), jadi hitung yang kita pilih saja.
  for (const label of ['Besok', 'Sore 17:00', 'Tinggi', 'Bulanan', 'kuliah']) assert.strictEqual(await page.locator('#quick-chips .qchip', { hasText: label }).first().getAttribute('aria-pressed'), 'true', label);
  await page.keyboard.press('Enter');
  await h.waitStored(page, d => d.tasks.some(t => t.title === 'Bayar listrik'));
  const t = (await h.stored(page)).tasks.find(x => x.title === 'Bayar listrik');
  assert.strictEqual(t.priority, 1); assert.strictEqual(t.due_time, '17:00'); assert.strictEqual(t.project, 'kuliah');
  assert.ok(t.deadline > TODAY); assert.ok(t.repeat);
  // setelah terkirim, pilihan kosong lagi
  await page.fill('#quick-input', 'Polos');
  assert.strictEqual(await page.locator('#quick-chips .qchip[aria-pressed="true"]').count(), 0);
  await page.keyboard.press('Enter');
  await h.waitStored(page, d => d.tasks.some(x => x.title === 'Polos'));
  const p = (await h.stored(page)).tasks.find(x => x.title === 'Polos');
  assert.strictEqual(p.priority, 2); assert.strictEqual(p.deadline, null); assert.strictEqual(p.project, null);
  // simbol yang diketik tetap menjadi judul biasa, tidak dibaca sebagai penanda
  await h.typeAdd(page, 'Beli susu !1 ^besok');
  await h.waitStored(page, d => d.tasks.some(x => x.title === 'Beli susu !1 ^besok'));
  const l = (await h.stored(page)).tasks.find(x => x.title === 'Beli susu !1 ^besok');
  assert.strictEqual(l.priority, 2); assert.strictEqual(l.deadline, null);
  await h.finish([page]);
});

test('tombol yang sama ditekan lagi membatalkan pilihan; jam tanpa tanggal memakai hari ini', async () => {
  const page = await h.open(env, { view: 'Semua tugas', seed: [] });
  await page.focus('#quick-input');
  const besok = page.locator('#quick-chips .qchip', { hasText: 'Besok' });
  await besok.click();
  assert.strictEqual(await besok.getAttribute('aria-pressed'), 'true');
  await besok.click();
  assert.strictEqual(await page.locator('#quick-chips .qchip', { hasText: 'Besok' }).getAttribute('aria-pressed'), 'false');
  await page.click('#qchip-more');
  await page.locator('#quick-chips .qchip', { hasText: 'Pagi 08:00' }).click();
  await page.fill('#quick-input', 'Olahraga');
  await page.keyboard.press('Enter');
  await h.waitStored(page, d => d.tasks.some(x => x.title === 'Olahraga'));
  const t = (await h.stored(page)).tasks[0];
  assert.strictEqual(t.deadline, TODAY); assert.strictEqual(t.due_time, '08:00');
  await h.finish([page]);
});

test('di ponsel, tambah banyak dan detail lengkap terjangkau lewat Lainnya…', async () => {
  const page = await h.open(env, { width: 390, height: 844, seed: [] });
  await page.focus('#quick-input');
  assert.ok(!(await page.locator('#bulk-btn').isVisible()), 'tombol ikon disembunyikan di ponsel');
  await page.click('#qchip-more');
  await page.click('#qchip-bulk');
  await h.until(page, "!document.querySelector('#bulk').hidden");
  await page.keyboard.press('Escape');
  await h.until(page, "document.querySelector('#bulk').hidden");
  await page.focus('#quick-input');
  await page.click('#qchip-detail');
  await h.until(page, "!document.querySelector('#detail').hidden");
  await h.finish([page]);
});

test('"Lebih sedikit" benar-benar menutup, meski jam sudah dipilih; jam ikut hari terpilih di Kalender', async () => {
  const page = await h.open(env, { view: 'Kalender', seed: [] });
  await h.until(page, "document.querySelectorAll('.wday').length === 7");
  const target = h.day(2);
  const sel = `.wday[data-day="${target}"]`;
  if (await page.locator(sel).count() === 0) { await page.click('#week-next'); await h.until(page, `document.querySelector('${sel}')`); }
  await page.locator(sel).click();
  await page.focus('#quick-input');
  await page.click('#qchip-more');
  await page.locator('#quick-chips .qchip', { hasText: 'Siang 12:00' }).click();
  await page.click('#qchip-more'); // menutup walau jam terpilih
  assert.strictEqual(await page.locator('#qchip-bulk').count(), 0);
  assert.strictEqual(await page.locator('#qchip-more').getAttribute('aria-expanded'), 'false');
  await page.fill('#quick-input', 'Kerja kelompok');
  await page.keyboard.press('Enter');
  await h.waitStored(page, d => d.tasks.some(x => x.title === 'Kerja kelompok'));
  const t = (await h.stored(page)).tasks[0];
  assert.strictEqual(t.deadline, target, 'tanggal = hari terpilih, bukan hari ini');
  assert.strictEqual(t.due_time, '12:00');
  await h.finish([page]);
});
