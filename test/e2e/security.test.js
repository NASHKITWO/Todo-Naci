'use strict';
// Kunci aplikasi (PIN) dan pengaman data rusak.
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers');
const { task: T, TODAY } = h;

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(); });

const seed = () => [T(1, 'Rahasia A', { deadline: TODAY }), T(2, 'Rahasia B', { deadline: TODAY })];
async function enable(page, pin) {
  await page.evaluate("document.querySelector('#lock-btn').click()");
  await h.until(page, "!document.querySelector('#lock-settings').hidden");
  await page.fill('#lk-pin', pin); await page.fill('#lk-pin2', pin);
  await page.click('#lk-enable');
  await h.until(page, "document.querySelector('#lk-msg').classList.contains('ok')");
  await page.click('#lk-close');
  await h.until(page, "document.querySelector('#lock-settings').hidden");
}

test('PIN: tersimpan sebagai hash, terkunci saat dibuka ulang, salah PIN ditolak, benar membuka', async () => {
  const page = await h.open(env, { seed: seed() });
  await enable(page, '4321');
  const stored = await page.evaluate("localStorage.getItem('todo-cli.lock')");
  assert.ok(!stored.includes('4321'));
  const cfg = JSON.parse(stored);
  assert.ok(/^[0-9a-f]{64}$/.test(cfg.hash) && /^[0-9a-f]{32}$/.test(cfg.salt) && cfg.iter >= 100000);
  await page.reload();
  await h.until(page, "!document.querySelector('#lock').hidden");
  assert.ok(await page.evaluate("document.querySelector('main.main').inert")); // isi tidak bisa difokus/dibaca
  await page.fill('#lock-pin', '1111'); await page.click('#lock-open');
  await h.until(page, "document.querySelector('#lock-msg').textContent.includes('salah')");
  assert.ok(!(await page.evaluate("document.querySelector('#lock').hidden")));
  await page.fill('#lock-pin', '4321'); await page.keyboard.press('Enter');
  await h.until(page, "document.querySelector('#lock').hidden");
  assert.ok(!(await page.evaluate("document.querySelector('main.main').inert")));
  await h.until(page, "document.querySelector('.row[data-id=\"1\"]')");
  await h.finish([page]);
});

test('kunci otomatis saat kembali dari latar belakang; dialog lain tidak bisa melewati layar kunci', async () => {
  const page = await h.open(env, { seed: seed() });
  await enable(page, '2468');
  await page.evaluate("window.TodoLock.setAuto(0)");
  await page.evaluate(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__hid });
    window.__hid = true; document.dispatchEvent(new Event('visibilitychange')); window.__hid = false; document.dispatchEvent(new Event('visibilitychange'));`);
  await h.until(page, "!document.querySelector('#lock').hidden");
  // upaya membuka dialog lain saat terkunci (mis. teks Bagikan masuk): tetap di balik layar kunci
  await page.evaluate("window.openBulk && window.openBulk('Beli beras')");
  assert.ok(await page.evaluate("document.querySelector('#bulk').inert"));
  assert.ok(!(await page.evaluate("document.querySelector('#lock').inert")));
  // tombol kembali Android saat terkunci = keluar (bukan membuka sesuatu)
  assert.strictEqual(await page.evaluate("window.todoHandleBack()"), false);
  await page.fill('#lock-pin', '2468'); await page.click('#lock-open');
  await h.until(page, "document.querySelector('#lock').hidden");
  await h.finish([page]);
});

test('salah PIN 5 kali: jeda; matikan kunci butuh PIN; lupa PIN menghapus data lokal', async () => {
  const page = await h.open(env, { seed: seed() });
  await enable(page, '1357');
  await page.reload();
  await h.until(page, "!document.querySelector('#lock').hidden");
  for (let i = 0; i < 5; i++) {
    await h.until(page, "!document.querySelector('#lock-open').disabled");
    await page.fill('#lock-pin', '0000'); await page.click('#lock-open');
    await h.until(page, "document.querySelector('#lock-msg').textContent !== ''");
    await page.waitForTimeout(100);
  }
  await h.until(page, "document.querySelector('#lock-msg').textContent.includes('detik')");
  assert.ok(await page.evaluate("document.querySelector('#lock-open').disabled"));
  // PIN benar pun ditolak selama jeda
  assert.strictEqual((await page.evaluate("window.TodoLock.verify('1357')")).ok, false);
  // lupa PIN
  await page.click('#lock-forgot-btn');
  await h.until(page, "!document.querySelector('#lock-forgot').hidden");
  await page.click('#lock-wipe');
  await page.waitForLoadState('load');
  await h.until(page, "!document.querySelector('#lock') || document.querySelector('#lock').hidden");
  assert.strictEqual(await page.evaluate("localStorage.getItem('todo-cli.lock')"), null);
  await h.finish([page]);
});

test('matikan kunci: butuh PIN saat ini', async () => {
  const page = await h.open(env, { seed: seed() });
  await enable(page, '9999');
  await page.evaluate("document.querySelector('#lock-btn').click()");
  await h.until(page, "!document.querySelector('#lock-settings').hidden");
  await page.fill('#lk-cur', '1234'); await page.click('#lk-disable');
  await h.until(page, "document.querySelector('#lk-msg').textContent.includes('salah')");
  assert.ok(await page.evaluate("window.TodoLock.enabled()"));
  await page.fill('#lk-cur', '9999'); await page.click('#lk-disable');
  await h.until(page, "!window.TodoLock.enabled()");
  assert.strictEqual(await page.evaluate("localStorage.getItem('todo-cli.lock')"), null);
  await h.finish([page]);
});

test('data rusak: salinan disimpan, tidak ditimpa diam-diam; pulih dari snapshot', async () => {
  const page = await h.open(env, { native: true, seed: seed() });
  await h.until(page, "localStorage.getItem('todo-cli.snapshots')");
  await page.evaluate("localStorage.setItem('todo-cli.data.v1', '{rusak: tidak json')");
  await page.reload();
  await h.until(page, "!document.querySelector('#data-banner').hidden");
  assert.strictEqual(await page.evaluate("localStorage.getItem('todo-cli.data.corrupt')"), '{rusak: tidak json');
  await page.click('#data-recover');
  await h.until(page, "document.querySelector('.row[data-id]')");
  assert.deepStrictEqual((await h.stored(page)).tasks.map(t => t.title).sort(), ['Rahasia A', 'Rahasia B']);
  assert.ok(await page.evaluate("document.querySelector('#data-banner').hidden"));
  assert.strictEqual(await page.evaluate("localStorage.getItem('todo-cli.data.corrupt')"), null);
  await h.finish([page]);
});

test('data rusak: bentuk tak sesuai (tugas tanpa id) juga dianggap rusak; salinan pertama dipertahankan', async () => {
  const page = await h.open(env, { seed: seed() });
  await page.evaluate("localStorage.setItem('todo-cli.data.v1', JSON.stringify({ tasks: [null] }))");
  await page.reload();
  await h.until(page, "!document.querySelector('#data-banner').hidden");
  const first = await page.evaluate("localStorage.getItem('todo-cli.data.corrupt')");
  assert.ok(first.includes('tasks'));
  await page.evaluate("localStorage.setItem('todo-cli.data.v1', '{lagi rusak')");
  await page.reload();
  assert.strictEqual(await page.evaluate("localStorage.getItem('todo-cli.data.corrupt')"), first); // bukti pertama tidak ditimpa
  await page.click('#data-drop');
  await h.until(page, "document.querySelector('#data-banner').hidden");
  await h.finish([page]);
});
