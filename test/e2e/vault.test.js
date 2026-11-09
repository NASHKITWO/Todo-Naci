'use strict';
// Enkripsi data opsional berbasis PIN (vault.js).
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers');

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(); });

const LS = "Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('todo-')).map(k => [k, localStorage.getItem(k)]))";
async function openSettings(page) {
  await page.evaluate("document.querySelector('#lock-btn').click()");
  await h.until(page, "!document.querySelector('#lock-settings').hidden");
}
async function lockOn(page, pin) {
  await openSettings(page);
  await page.fill('#lk-pin', pin); await page.fill('#lk-pin2', pin); await page.click('#lk-enable');
  await h.until(page, "document.querySelector('#lk-msg').classList.contains('ok')");
}

test('enkripsi: nyalakan, data tidak ada sebagai teks biasa, muat ulang terkunci, PIN membuka, matikan mengembalikan', async () => {
  const page = await h.open(env, { native: true });
  await h.typeAdd(page, 'Rahasia Sangat Pribadi');
  await h.waitStored(page, d => d.tasks.some(t => t.title === 'Rahasia Sangat Pribadi'));
  await lockOn(page, '4321');
  assert.ok(await page.evaluate("document.querySelector('#lk-enc-state').textContent.includes('mati')"));
  await page.fill('#lk-cur', '9999'); page.once('dialog', d => d.accept()); await page.click('#lk-enc');
  await h.until(page, "document.querySelector('#lk-msg').textContent.includes('PIN salah')");
  await page.fill('#lk-cur', '4321'); page.once('dialog', d => d.accept()); await page.click('#lk-enc');
  await h.until(page, "document.querySelector('#lk-enc-state').textContent.includes('aktif')");
  let ls = await page.evaluate(LS);
  assert.strictEqual(ls['todo-cli.data.v1'], undefined, 'data teks biasa dihapus');
  assert.ok(ls['todo-cli.vault.blob'].startsWith('v2.'));
  assert.ok(!JSON.stringify(ls).includes('Rahasia Sangat Pribadi'), 'judul tugas tidak muncul di penyimpanan');
  // tugas baru saat enkripsi aktif juga tidak bocor
  await page.click('#lk-close');
  await h.typeAdd(page, 'Tugas Baru Rahasia');
  await h.until(page, "document.querySelector('.row')");
  await page.evaluate("window.TodoVault.flush()");
  ls = await page.evaluate(LS);
  assert.ok(!JSON.stringify(ls).includes('Tugas Baru Rahasia'));
  assert.strictEqual(ls['todo-cli.data.v1'], undefined);
  // muat ulang: terkunci, data belum terlihat; salah PIN tetap terkunci; benar membuka dan data kembali
  await page.reload();
  await h.until(page, "!document.querySelector('#lock').hidden");
  assert.strictEqual(await page.evaluate("document.querySelectorAll('.row').length"), 0);
  await page.fill('#lock-pin', '1111'); await page.click('#lock-open');
  await h.until(page, "document.querySelector('#lock-msg').textContent.includes('salah')");
  await page.fill('#lock-pin', '4321'); await page.keyboard.press('Enter');
  await h.until(page, "document.querySelector('#lock').hidden");
  await h.until(page, "document.body.textContent.includes('Tugas Baru Rahasia')");
  await h.until(page, "document.body.textContent.includes('Rahasia Sangat Pribadi')");
  // matikan kunci saat enkripsi aktif: data kembali sebagai teks biasa dan tetap utuh
  await openSettings(page);
  await page.fill('#lk-cur', '4321'); await page.click('#lk-disable');
  await h.until(page, "document.querySelector('#lk-msg').textContent.includes('dimatikan')");
  const d = await h.stored(page);
  assert.ok(d.tasks.some(t => t.title === 'Rahasia Sangat Pribadi') && d.tasks.some(t => t.title === 'Tugas Baru Rahasia'));
  ls = await page.evaluate(LS);
  assert.strictEqual(ls['todo-cli.vault.blob'], undefined); assert.strictEqual(ls['todo-cli.vault'], undefined);
  await h.finish([page]);
});

test('enkripsi: ganti PIN mengenkripsi ulang; PIN lama tak lagi membuka, PIN baru membuka, data utuh', async () => {
  const page = await h.open(env, { native: true });
  await h.typeAdd(page, 'Data Ganti PIN');
  await h.waitStored(page, d => d.tasks.some(t => t.title === 'Data Ganti PIN'));
  await lockOn(page, '1234');
  await page.fill('#lk-cur', '1234'); page.once('dialog', d => d.accept()); await page.click('#lk-enc');
  await h.until(page, "document.querySelector('#lk-enc-state').textContent.includes('aktif')");
  const blobBefore = (await page.evaluate(LS))['todo-cli.vault.blob'];
  await page.fill('#lk-cur', '0000'); await page.fill('#lk-pin', '987654321'); await page.fill('#lk-pin2', '987654321'); await page.click('#lk-enable');
  await h.until(page, "document.querySelector('#lk-msg').textContent.includes('PIN salah')");
  await page.fill('#lk-cur', '1234'); await page.click('#lk-enable');
  await h.until(page, "document.querySelector('#lk-msg').textContent.includes('PIN diganti')");
  assert.notStrictEqual((await page.evaluate(LS))['todo-cli.vault.blob'], blobBefore);
  await page.reload();
  await h.until(page, "!document.querySelector('#lock').hidden");
  await page.fill('#lock-pin', '1234'); await page.click('#lock-open');
  await h.until(page, "document.querySelector('#lock-msg').textContent.includes('salah')");
  await page.fill('#lock-pin', '987654321'); await page.keyboard.press('Enter');
  await h.until(page, "document.querySelector('#lock').hidden");
  await h.until(page, "document.body.textContent.includes('Data Ganti PIN')");
  await h.finish([page]);
});

test('enkripsi: saat terkunci tidak ada penulisan dari data kosong; PIN tak bisa diganti sebelum enkripsi dimatikan', async () => {
  const page = await h.open(env, { native: true });
  await h.typeAdd(page, 'Jangan Hilang');
  await lockOn(page, '2468');
  await page.fill('#lk-cur', '2468'); page.once('dialog', d => d.accept()); await page.click('#lk-enc');
  await h.until(page, "document.querySelector('#lk-enc-state').textContent.includes('aktif')");
  const err = await page.evaluate("window.TodoLock.setPin('1357', 30).then(() => 'ok', e => e.message)");
  assert.ok(err.includes('Ganti PIN'));
  const before = (await page.evaluate(LS))['todo-cli.vault.blob'];
  await page.reload();
  await h.until(page, "!document.querySelector('#lock').hidden");
  await page.waitForTimeout(800); // beri waktu tugas latar (jadwal, snapshot, sinkron) berjalan
  assert.strictEqual((await page.evaluate(LS))['todo-cli.vault.blob'], before, 'blob tidak berubah selama terkunci');
  await page.fill('#lock-pin', '2468'); await page.keyboard.press('Enter');
  await h.until(page, "document.body.textContent.includes('Jangan Hilang')");
  await h.finish([page]);
});
