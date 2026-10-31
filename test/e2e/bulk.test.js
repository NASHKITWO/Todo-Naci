'use strict';
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers.js');
const { task: T, TODAY } = h;

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(); });

const paste = (page, text) => page.evaluate(`(() => {
  const dt = new DataTransfer(); dt.setData('text', ${JSON.stringify(text)});
  const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
  document.querySelector('#quick-input').dispatchEvent(ev);
  return ev.defaultPrevented;
})()`);

test('tempel banyak baris membuka sheet berpratinjau, lalu menambah tugas + subtugas dan bisa diurungkan', async () => {
  const page = await h.open(env, { seed: [] });
  await h.until(page, "document.querySelector('#quick-input')");
  assert.strictEqual(await paste(page, 'satu baris saja'), false, 'satu baris: tempel biasa');
  assert.ok(await page.locator('#bulk').count() === 0 || await page.locator('#bulk').isHidden());
  await page.focus('#quick-input');
  await page.locator('#quick-chips .qchip', { hasText: 'Tinggi' }).click();
  await page.locator('#quick-chips .qchip', { hasText: 'Besok' }).click();
  assert.strictEqual(await paste(page, '- Rapat\n  - slide\n  - agenda\n- [x] Kirim\n'), true);
  await h.until(page, "document.querySelector('#bulk') && !document.querySelector('#bulk').hidden");
  assert.strictEqual(await page.evaluate("document.activeElement.id"), 'bulk-text');
  await h.until(page, "document.querySelectorAll('#bulk-preview li').length === 4");
  assert.strictEqual(await page.locator('#bulk-preview li.sub').count(), 2);
  assert.match(await page.textContent('#bulk-add'), /Tambahkan 4 tugas/);
  assert.ok(await page.evaluate("document.querySelector('main.main').inert"), 'latar dikunci saat dialog terbuka');
  await page.click('#bulk-add');
  await h.waitStored(page, d => d.tasks.length === 4);
  const d = await h.stored(page);
  const rapat = d.tasks.find(t => t.title === 'Rapat');
  assert.strictEqual(rapat.priority, 1); assert.ok(rapat.deadline > TODAY, 'pilihan Besok berlaku');
  assert.strictEqual(d.tasks.find(t => t.title === 'slide').deadline, null, 'subtugas tidak ikut tanggal');
  assert.strictEqual(d.tasks.filter(t => t.parent_id === rapat.id).length, 2);
  assert.strictEqual(d.tasks.find(t => t.title === 'Kirim').done, true);
  await h.until(page, "document.querySelector('#bulk').hidden");
  assert.strictEqual(await page.evaluate("document.querySelector('main.main').inert"), false);
  assert.match(await page.textContent('#toasts'), /4 tugas ditambahkan/);
  await page.click('#toasts button');
  await h.waitStored(page, d2 => d2.tasks.length === 0);
  assert.strictEqual((await h.stored(page)).trash.length, 0, 'urungkan = hapus permanen, bukan sampah');
  await h.finish([page]);
});

test('galat baris ditampilkan di sheet, tombol Tambahkan nonaktif; Esc menutup dan mengembalikan fokus', async () => {
  const page = await h.open(env, { seed: [] });
  await page.click('#bulk-btn');
  await h.until(page, "!document.querySelector('#bulk').hidden");
  await page.fill('#bulk-text', 'ok\n' + 'a'.repeat(400));
  await h.until(page, "document.querySelector('#bulk-msg').textContent.includes('Baris 2')");
  assert.ok(await page.locator('#bulk-add').isDisabled());
  await page.fill('#bulk-text', '');
  await h.until(page, "document.querySelector('#bulk-msg').textContent === ''");
  assert.ok(await page.locator('#bulk-add').isDisabled());
  await page.keyboard.press('Escape');
  await h.until(page, "document.querySelector('#bulk').hidden");
  assert.strictEqual(await page.evaluate("document.activeElement.id"), 'bulk-btn');
  assert.strictEqual((await h.stored(page)).tasks.length, 0);
  await h.finish([page]);
});

test('templat: simpan dari sheet, pakai (hasil di tampilan), ubah, dan hapus dengan konfirmasi', async () => {
  const page = await h.open(env, { seed: [] });
  await page.click('#bulk-btn');
  await h.until(page, "!document.querySelector('#bulk').hidden");
  assert.match(await page.textContent('#tpl-list'), /Belum ada templat/);
  await page.fill('#bulk-text', 'Cek surat\n  buka kotak pos');
  await page.fill('#bulk-tpl-name', 'Rutin pagi');
  await page.click('#bulk-save-tpl');
  await h.until(page, "document.querySelector('.tpl-row')");
  assert.match(await page.textContent('#bulk-msg'), /Rutin pagi.*tersimpan/);
  assert.strictEqual((await h.stored(page)).templates.length, 1);
  // nama kosong ditolak
  await page.fill('#bulk-tpl-name', '');
  await page.click('#bulk-save-tpl');
  await h.until(page, "document.querySelector('#bulk-msg').textContent.includes('Nama templat')");
  // pakai
  await page.click('.tpl-row [data-act="use"]');
  await h.waitStored(page, d => d.tasks.length === 2);
  await h.until(page, "document.querySelector('#bulk').hidden");
  const d = await h.stored(page);
  assert.ok(d.tasks.find(t => t.title === 'Cek surat'));
  assert.ok(d.tasks.find(t => t.title === 'buka kotak pos').parent_id);
  // templat bertahan setelah muat ulang
  await page.reload();
  await page.click('#bulk-btn');
  await h.until(page, "document.querySelector('.tpl-row')");
  // ubah: isi dimuat ke editor
  await page.click('.tpl-row [data-act="edit"]');
  assert.strictEqual(await page.inputValue('#bulk-text'), 'Cek surat\n  buka kotak pos');
  assert.strictEqual(await page.inputValue('#bulk-tpl-name'), 'Rutin pagi');
  // hapus: batal lalu setuju
  page.once('dialog', dl => dl.dismiss());
  await page.click('.tpl-row [data-act="del"]');
  await page.waitForTimeout(300);
  assert.strictEqual(await page.locator('.tpl-row').count(), 1);
  page.once('dialog', dl => dl.accept());
  await page.click('.tpl-row [data-act="del"]');
  await h.until(page, "!document.querySelector('.tpl-row')");
  assert.strictEqual((await h.stored(page)).templates.length, 0);
  await h.finish([page]);
});

test('di tampilan proyek, tugas massal mewarisi proyek itu', async () => {
  const page = await h.open(env, { seed: [T(1, 'Awal', { deadline: TODAY, project: 'kuliah' })] });
  await h.until(page, "document.querySelector('#nav-projects .nav-item')");
  await page.evaluate("document.querySelector('#nav-projects .nav-item').click()");
  await h.until(page, "document.querySelector('#view-title').textContent === '@kuliah'");
  await paste(page, 'A\nB');
  await h.until(page, "document.querySelectorAll('#bulk-preview li').length === 2");
  await page.click('#bulk-add');
  await h.waitStored(page, d => d.tasks.filter(t => t.project === 'kuliah').length === 3);
  await h.finish([page]);
});
