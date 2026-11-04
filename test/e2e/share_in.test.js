'use strict';
// Teks yang dibagikan dari aplikasi lain (menu Bagikan Android) membuka lembar "Tambah banyak" yang sudah terisi.
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers');
const { task: T } = h;

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(); });

test('teks bagikan membuka lembar tambah banyak berisi teks itu; tidak muncul lagi setelah dibaca', async () => {
  const page = await h.open(env, { native: true, seed: [T(1, 'A')] });
  await h.until(page, 'window.__scheduled !== undefined');
  await page.evaluate("window.__shared_in = 'Beli beras\\nBayar listrik'");
  await page.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); // memicu pembacaan seperti saat aplikasi dibuka lagi
  await h.until(page, "!document.querySelector('#bulk').hidden && document.querySelector('#bulk-text').value.includes('Bayar listrik')");
  assert.ok((await page.inputValue('#bulk-text')).startsWith('Beli beras'));
  await page.keyboard.press('Escape');
  await h.until(page, "document.querySelector('#bulk').hidden");
  await page.evaluate("document.dispatchEvent(new Event('visibilitychange'))");
  await page.waitForTimeout(400);
  assert.ok(await page.evaluate("document.querySelector('#bulk').hidden"));
  await h.finish([page]);
});
