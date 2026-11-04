'use strict';
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers.js');
const { task: T, TODAY, day: D } = h;

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(); });

const open = async (page) => { await page.click('#detail-btn'); await h.until(page, "!document.querySelector('#detail').hidden"); };

test('tambah tugas hanya dengan memilih opsi (tanpa simbol): semua isian tersimpan', async () => {
  const page = await h.open(env, { width: 390, height: 844, seed: [T(1, 'Awal', { deadline: TODAY, project: 'rumah' })] });
  await h.until(page, "document.querySelector('.row')");
  await open(page);
  assert.strictEqual(await page.evaluate('document.activeElement.id'), 'det-title');
  assert.ok(await page.evaluate("document.querySelector('main.main').inert"));
  assert.strictEqual(await page.inputValue('#det-date'), TODAY, 'di tampilan Hari ini, tanggal terisi hari ini');
  await page.click('#det-nodate');
  assert.ok(await page.locator('#det-time').isDisabled(), 'jam menunggu tanggal');
  await page.fill('#det-title', 'Bayar listrik');
  await page.click('#det-prio [data-p="1"]');
  await page.click('#det-dates [data-days="1"]');
  assert.ok(await page.locator('#det-time').isEnabled());
  await page.click('#det-times [data-time="17:00"]');
  await page.click('#det-projects button');
  await page.fill('#det-tags', 'tagihan, #penting');
  await page.selectOption('#det-repeat', '1m');
  await page.click('#det-add');
  await h.waitStored(page, d => d.tasks.some(t => t.title === 'Bayar listrik'));
  const t = (await h.stored(page)).tasks.find(x => x.title === 'Bayar listrik');
  assert.strictEqual(t.priority, 1); assert.strictEqual(t.deadline, D(1)); assert.strictEqual(t.due_time, '17:00');
  assert.strictEqual(t.project, 'rumah'); assert.deepStrictEqual(t.tags.sort(), ['penting', 'tagihan']); assert.strictEqual(t.repeat, '1m');
  await h.until(page, "document.querySelector('#detail').hidden");
  assert.strictEqual(await page.evaluate("document.querySelector('main.main').inert"), false);
  assert.match(await page.textContent('#toasts'), /Ditambahkan: Bayar listrik/);
  await h.finish([page]);
});

test('judul dan tombol pilihan di kolom tambah terbawa ke lembar, bisa diubah, lalu kolom dikosongkan', async () => {
  const page = await h.open(env, { width: 390, height: 844, seed: [] });
  await h.until(page, "document.querySelector('#quick-input')");
  await page.fill('#quick-input', 'Beli susu');
  for (const label of ['Tinggi', 'Besok']) await page.locator('#quick-chips .qchip', { hasText: label }).click();
  await page.click('#qchip-more');
  for (const label of ['Pagi 08:00', 'Mingguan']) await page.locator('#quick-chips .qchip', { hasText: label }).click();
  await page.click('#qchip-detail');
  await h.until(page, "!document.querySelector('#detail').hidden");
  assert.strictEqual(await page.inputValue('#det-title'), 'Beli susu');
  assert.strictEqual(await page.getAttribute('#det-prio [data-p="1"]', 'aria-pressed'), 'true');
  assert.strictEqual(await page.inputValue('#det-date'), D(1));
  assert.strictEqual(await page.inputValue('#det-time'), '08:00');
  assert.strictEqual(await page.inputValue('#det-repeat'), '1w');
  await page.click('#det-prio [data-p="3"]');
  await page.click('#det-nodate');
  assert.ok(await page.locator('#det-time').isDisabled());
  await page.click('#det-add');
  await h.waitStored(page, d => d.tasks.length === 1);
  const t = (await h.stored(page)).tasks[0];
  assert.strictEqual(t.priority, 3); assert.strictEqual(t.deadline, null); assert.strictEqual(t.due_time, null);
  assert.strictEqual(await page.inputValue('#quick-input'), '');
  await h.finish([page]);
});

test('judul kosong ditolak dengan pesan; galat dari inti tampil di lembar; Esc menutup dan fokus kembali', async () => {
  const page = await h.open(env, { width: 390, height: 844, seed: [] });
  await h.until(page, "document.querySelector('#detail-btn')");
  await open(page);
  await page.click('#det-add');
  await h.until(page, "document.querySelector('#det-msg').textContent === 'Judul tugas wajib diisi.'");
  assert.strictEqual(await page.evaluate('document.activeElement.id'), 'det-title');
  await page.fill('#det-title', 'Rutin');
  await page.selectOption('#det-repeat', '1d'); // berulang tanpa tanggal
  await page.click('#det-add');
  await h.until(page, "document.querySelector('#det-msg').textContent.length > 0 && document.querySelector('#det-msg').textContent !== 'Judul tugas wajib diisi.' || document.querySelector('#detail').hidden");
  if (!(await page.evaluate("document.querySelector('#detail').hidden"))) {
    assert.strictEqual((await h.stored(page)).tasks.length, 0, 'galat: tidak ada yang dibuat');
    await page.keyboard.press('Escape');
  }
  await h.until(page, "document.querySelector('#detail').hidden");
  await h.finish([page]);
});

test('Enter di judul menambahkan; jam cepat tanpa tanggal memakai hari ini; di tampilan proyek, proyek terisi otomatis', async () => {
  const page = await h.open(env, { width: 390, height: 844, seed: [T(1, 'Awal', { deadline: TODAY, project: 'kuliah' })] });
  await h.until(page, "document.querySelector('#nav-projects .nav-item') || document.querySelector('.row')");
  await page.evaluate("document.querySelector('#nav-projects .nav-item').click()");
  await h.until(page, "document.querySelector('#view-title').textContent === '@kuliah'");
  await open(page);
  assert.strictEqual(await page.inputValue('#det-project'), 'kuliah');
  await page.fill('#det-title', 'Belajar');
  await page.click('#det-times [data-time="08:00"]');
  assert.strictEqual(await page.inputValue('#det-date'), TODAY);
  await page.press('#det-title', 'Enter');
  await h.waitStored(page, d => d.tasks.some(t => t.title === 'Belajar'));
  const t = (await h.stored(page)).tasks.find(x => x.title === 'Belajar');
  assert.strictEqual(t.project, 'kuliah'); assert.strictEqual(t.deadline, TODAY); assert.strictEqual(t.due_time, '08:00');
  await h.finish([page]);
});

test('Esc menutup tanpa menambah; fokus kembali ke tombol; mode Inggris tanpa sisa kata Indonesia', async () => {
  const page = await h.open(env, { width: 390, height: 844, lang: 'en', seed: [] });
  await h.until(page, "document.querySelector('#detail-btn')");
  await open(page);
  const text = await page.evaluate("Array.from(document.querySelectorAll('#detail *')).flatMap(e => [e.getAttribute('aria-label'), e.getAttribute('placeholder'), ...Array.from(e.childNodes).filter(n => n.nodeType === 3).map(n => n.nodeValue)]).filter(Boolean).join(' ').toLowerCase()");
  for (const w of ['tugas', 'tanggal', 'proyek', 'simbol', 'pilih', 'tambahkan', 'batal', 'prioritas', 'besok', 'ulangi']) assert.ok(!new RegExp('\\b' + w + '\\b').test(text), 'sisa kata Indonesia: ' + w);
  assert.match(text, /new task/); assert.match(text, /add task/);
  await page.keyboard.press('Escape');
  await h.until(page, "document.querySelector('#detail').hidden");
  assert.strictEqual(await page.evaluate('document.activeElement.id'), 'detail-btn');
  assert.strictEqual((await h.stored(page)).tasks.length, 0);
  await h.finish([page]);
});
