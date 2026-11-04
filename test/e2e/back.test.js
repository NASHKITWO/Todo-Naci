'use strict';
// Tombol kembali Android (plugin App): menutup lapisan teratas, lalu kembali ke Hari ini, baru keluar.
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers');
const { task: T, TODAY, day: D } = h;

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(env); });

const back = page => page.evaluate('window.__appListeners.backButton()');
const seed = [T(1, 'A', { deadline: TODAY, project: 'kuliah' }), T(2, 'B', { deadline: D(2) })];

test('kembali menutup lapisan satu per satu, lalu ke Hari ini, lalu keluar', async () => {
  const page = await h.open(env, { native: true, width: 390, height: 844, seed, view: null });
  await h.until(page, "window.__appListeners && window.__appListeners.backButton");
  await h.until(page, "document.querySelector('.row[data-id=\"1\"]')");
  // panel detail
  await page.click('.row[data-id="1"] .title');
  await h.until(page, "document.querySelector('#drawer.open')");
  await back(page);
  await h.until(page, "!document.querySelector('#drawer.open')");
  // dialog di atas panel
  await page.click('#detail-btn');
  await h.until(page, "!document.querySelector('#detail').hidden");
  await back(page);
  await h.until(page, "document.querySelector('#detail').hidden");
  assert.ok(!(await page.evaluate('window.__exited')));
  // menu samping
  await page.click('#menu-btn');
  await h.until(page, "document.body.classList.contains('nav-open')");
  await back(page);
  await h.until(page, "!document.body.classList.contains('nav-open')");
  // layar lain -> Hari ini
  await page.evaluate("Array.from(document.querySelectorAll('#nav-views button')).find(b => b.textContent.includes('Semua tugas')).click()");
  await h.until(page, "document.querySelector('#view-title').textContent === 'Semua tugas'");
  await back(page);
  await h.until(page, "document.querySelector('#view-title').textContent === 'Hari ini'");
  assert.ok(!(await page.evaluate('window.__exited')));
  // di Hari ini tanpa lapisan: keluar
  await back(page);
  await h.until(page, 'window.__exited === true');
  await h.finish([page]);
});

test('kembali menutup mode pilih, pencarian, dan filter proyek', async () => {
  const page = await h.open(env, { native: true, width: 390, height: 844, seed, view: null });
  await h.until(page, "window.__appListeners && document.querySelector('.row[data-id=\"1\"]')");
  await page.click('#select-btn');
  await h.until(page, "document.querySelector('#select-btn').getAttribute('aria-pressed') === 'true'");
  await back(page);
  await h.until(page, "document.querySelector('#select-btn').getAttribute('aria-pressed') === 'false'");
  await page.click('#search-btn');
  await page.fill('#search', 'zzz');
  await back(page);
  await h.until(page, "document.querySelector('#search').value === ''");
  assert.ok(!(await page.evaluate('window.__exited')));
  await h.finish([page]);
});

test('di browser biasa (tanpa plugin App) pendaftaran tombol kembali dilewati tanpa galat', async () => {
  const page = await h.open(env, { seed });
  assert.strictEqual(await page.evaluate('typeof window.todoHandleBack'), 'function');
  assert.strictEqual(await page.evaluate('window.todoHandleBack()'), false, 'di Hari ini tanpa lapisan: tidak menangani');
  await h.finish([page]);
});

test('izin notifikasi ditolak: spanduk petunjuk muncul bila ada tugas berjam, bisa ditutup, hilang saat diizinkan', async () => {
  const page = await h.open(env, { native: true, width: 390, height: 844, seed: [T(1, 'Rapat', { deadline: D(2), due_time: '10:00' })], view: null });
  await h.until(page, "document.querySelector('.row') || document.querySelector('#list')");
  assert.ok(await page.locator('#notif-banner').isHidden(), 'izin diberikan: tanpa spanduk');
  await page.evaluate("window.__perm = 'denied'; window.__notifDenied = undefined;");
  await page.evaluate("window.todoLocalApi('POST', '/api/tasks', { title: 'Baru', deadline: '" + D(3) + "', due_time: '11:00' }).then(() => window.refresh())");
  await h.until(page, "!document.querySelector('#notif-banner').hidden");
  assert.match(await page.textContent('#notif-banner'), /Notifikasi dimatikan/);
  await page.click('#notif-dismiss');
  await h.until(page, "document.querySelector('#notif-banner').hidden");
  await page.evaluate("window.__perm = 'granted'; window.__notifDenied = true; ui.notifDismissed = false;");
  await page.evaluate("window.todoLocalApi('POST', '/api/tasks', { title: 'Lagi', deadline: '" + D(4) + "', due_time: '12:00' }).then(() => window.refresh())");
  await h.until(page, "window.__notifDenied === false && document.querySelector('#notif-banner').hidden");
  await h.finish([page]);
});

test('izin ditolak tetapi tanpa tugas berjam: tanpa spanduk', async () => {
  const page = await h.open(env, { native: true, seed: [T(1, 'Polos', { deadline: D(2) })], view: null });
  await page.evaluate("window.__perm = 'denied'; window.__notifDenied = undefined;");
  await page.evaluate("window.todoLocalApi('POST', '/api/tasks', { title: 'Polos2' }).then(() => window.refresh())");
  await page.waitForTimeout(800);
  assert.ok(await page.locator('#notif-banner').isHidden());
  await h.finish([page]);
});
