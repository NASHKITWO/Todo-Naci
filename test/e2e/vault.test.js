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
  assert.ok(ls['todo-cli.vault.blob'].startsWith('v3.'));
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

test('enkripsi: kunci pemulihan tampil sekali; lupa PIN dipulihkan dengan kunci itu; kunci salah ditolak; data utuh', async () => {
  const page = await h.open(env, { native: true });
  await h.typeAdd(page, 'Data Pemulihan');
  await h.waitStored(page, d => d.tasks.some(t => t.title === 'Data Pemulihan'));
  await lockOn(page, '1234');
  await page.fill('#lk-cur', '1234'); page.once('dialog', d => d.accept()); await page.click('#lk-enc');
  await h.until(page, "!document.querySelector('#lk-rec-box').hidden");
  const rec = await page.inputValue('#lk-rec');
  assert.ok(/^([0-9A-Z]{4}-){7}[0-9A-Z]{4}$/.test(rec), rec);
  assert.ok(!JSON.stringify(await page.evaluate(LS)).includes(rec), 'kunci pemulihan tidak disimpan');
  await page.reload();
  await h.until(page, "!document.querySelector('#lock').hidden");
  await page.click('#lock-rec-btn');
  await page.fill('#lock-rec-key', 'AAAA-BBBB'); await page.fill('#lock-rec-pin', '555555'); await page.click('#lock-rec-go');
  await h.until(page, "document.querySelector('#lock-rec-msg').textContent.includes('salah')");
  await page.fill('#lock-rec-key', rec.toLowerCase().replace(/-/g, '')); await page.click('#lock-rec-go');
  await h.until(page, "document.querySelector('#lock').hidden");
  await h.until(page, "document.body.textContent.includes('Data Pemulihan')");
  await page.reload();
  await h.until(page, "!document.querySelector('#lock').hidden");
  await page.fill('#lock-pin', '1234'); await page.click('#lock-open');
  await h.until(page, "document.querySelector('#lock-msg').textContent.includes('salah')");
  await page.fill('#lock-pin', '555555'); await page.keyboard.press('Enter');
  await h.until(page, "document.querySelector('#lock').hidden");
  await h.until(page, "document.body.textContent.includes('Data Pemulihan')");
  // kunci pemulihan baru membatalkan yang lama
  await openSettings(page);
  await page.fill('#lk-cur', '555555'); page.once('dialog', d => d.accept()); await page.click('#lk-newrec');
  await h.until(page, "document.querySelector('#lk-rec').value");
  const rec2 = await page.inputValue('#lk-rec');
  assert.notStrictEqual(rec2, rec);
  const old = await page.evaluate(([b, k]) => window.TodoVault.decryptExternal(b, k), [await page.evaluate("window.TodoVault.rawBlob()"), rec]);
  assert.strictEqual(old, null, 'kunci lama tak berlaku');
  await h.finish([page]);
});

test('enkripsi: cadangan Dokumen berupa blob terenkripsi (tanpa teks biasa) yang bisa dibuka dengan PIN atau kunci pemulihan', async () => {
  const page = await h.open(env, { native: true });
  await h.typeAdd(page, 'Isi Cadangan Rahasia');
  await h.waitStored(page, d => d.tasks.some(t => t.title === 'Isi Cadangan Rahasia'));
  await lockOn(page, '4321');
  await page.fill('#lk-cur', '4321'); page.once('dialog', d => d.accept()); await page.click('#lk-enc');
  await h.until(page, "!document.querySelector('#lk-rec-box').hidden");
  const rec = await page.inputValue('#lk-rec');
  await page.click('#lk-close');
  await h.typeAdd(page, 'Tugas Kedua');
  await page.evaluate("document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'))");
  await h.until(page, "(window.__writes || []).some(w => /terenkripsi/.test(w.path))", 8000);
  const w = await page.evaluate("window.__writes.filter(w => /terenkripsi/.test(w.path)).pop()");
  assert.ok(!(await page.evaluate("window.__writes.some(w => /todo-cadangan\\.json$/.test(w.path) && /Isi Cadangan/.test(w.data))")), 'tidak ada salinan teks biasa');
  assert.ok(!w.data.includes('Isi Cadangan Rahasia') && w.data.startsWith('v3.'));
  for (const secret of ['4321', rec]) {
    const map = await page.evaluate(([b, s]) => window.TodoVault.decryptExternal(b, s), [w.data, secret]);
    assert.ok(map && JSON.parse(map['todo-cli.data.v1']).tasks.some(t => t.title === 'Isi Cadangan Rahasia'));
  }
  assert.strictEqual(await page.evaluate(b => window.TodoVault.decryptExternal(b, '0000'), w.data), null);
  await h.finish([page]);
});

test('enkripsi: blob v2 dari 0.41 tetap terbuka, dan "kunci pemulihan baru" menaikkannya ke v3', async () => {
  const page = await h.open(env, { native: true });
  await lockOn(page, '2468');
  // pasang blob v2 seperti 0.41.0 (kunci langsung dari PIN) lalu muat ulang
  await page.evaluate(async () => {
    const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
    const salt = b64(crypto.getRandomValues(new Uint8Array(16))), iter = 300000;
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode('2468'), 'PBKDF2', false, ['deriveKey']);
    const k = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(atob(salt), c => c.charCodeAt(0)), iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const data = { 'todo-cli.data.v1': JSON.stringify({ version: 1, nextId: 2, tasks: [{ id: 1, uid: 'u1', updated_at: '2026-01-01T00:00:00.000Z', title: 'Warisan v2', notes: '', priority: 0, deadline: null, due_time: null, done: false, project: null, repeat: null, tags: [], parent_id: null, created_at: '2026-01-01T00:00:00.000Z', completed_at: null }], tombs: [], trash: [], trashSeq: 1, templates: [], tplPlain: true }) };
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify(data)));
    localStorage.setItem('todo-cli.vault', JSON.stringify({ v: 2, salt, iter }));
    localStorage.setItem('todo-cli.vault.blob', 'v2.' + iter + '.' + salt + '.' + b64(iv) + '.' + b64(ct));
    localStorage.removeItem('todo-cli.data.v1');
  });
  await page.reload();
  await h.until(page, "!document.querySelector('#lock').hidden");
  assert.ok(!(await page.evaluate("window.TodoVault.recoverable()")));
  await page.fill('#lock-pin', '2468'); await page.keyboard.press('Enter');
  await h.until(page, "document.querySelector('#lock').hidden");
  await h.until(page, "window.todoLocalStore.tasks.some(t => t.title === 'Warisan v2')");
  await openSettings(page);
  await page.fill('#lk-cur', '2468'); page.once('dialog', d => d.accept()); await page.click('#lk-newrec');
  await h.until(page, "document.querySelector('#lk-rec').value");
  assert.ok((await page.evaluate("localStorage.getItem('todo-cli.vault.blob')")).startsWith('v3.'));
  await page.reload();
  await h.until(page, "!document.querySelector('#lock').hidden");
  await page.fill('#lock-pin', '2468'); await page.keyboard.press('Enter');
  await h.until(page, "window.todoLocalStore.tasks.some(t => t.title === 'Warisan v2')");
  await h.finish([page]);
});
