'use strict';
// v0.10: widget layar utama, snapshot harian + salinan Dokumen, dan sinkron otomatis (GitHub Gist palsu).
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers.js');

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(); });

const seed = () => [
  h.task(1, 'Bayar listrik', { deadline: h.day(-1), priority: 1 }),
  h.task(2, 'Rapat tim', { deadline: h.TODAY, due_time: '15:00' }),
  h.task(3, 'Nanti saja', { deadline: h.day(2), priority: 3 }),
  h.task(4, 'Tanpa tanggal'),
];

test('widget: daftar didorong ke plugin native, mengikuti tambah dan selesai', async () => {
  const page = await h.open(env, { native: true, seed: seed() });
  await h.until(page, 'window.__widget.length >= 1');
  const last = () => page.evaluate('window.__widget[window.__widget.length - 1]');
  assert.deepStrictEqual((await last()).map(i => i.t), ['Bayar listrik', 'Rapat tim', 'Nanti saja']);
  const first = (await last())[0];
  assert.match(first.u, /^[0-9a-f]{16}$/);
  assert.deepStrictEqual(Object.assign({}, first, { u: 'x' }), { t: 'Bayar listrik', u: 'x', d: h.day(-1), h: '', p: 1 });
  await h.quickAdd(page, 'Telepon ibu ^+0d 08:00');
  await h.until(page, "window.__widget[window.__widget.length - 1].some(i => i.t === 'Telepon ibu')");
  assert.deepStrictEqual((await last()).map(i => i.t).slice(0, 3), ['Bayar listrik', 'Telepon ibu', 'Rapat tim']);
  await page.evaluate("window.todoLocalApi('POST', '/api/tasks/1/done')");
  await page.evaluate('window.refresh()');
  await h.until(page, "!window.__widget[window.__widget.length - 1].some(i => i.t === 'Bayar listrik')");
  await h.finish([page]);
});

test('widget: tugas yang dicentang di widget diselesaikan saat aplikasi dibuka, lalu antreannya dibersihkan', async () => {
  const page = await h.open(env, { native: true, seed: seed() });
  await h.until(page, 'window.__widget.length >= 1');
  const uid = await page.evaluate('window.__widget[0][1].u'); // "Rapat tim"
  await page.evaluate('window.__widgetDone = [' + JSON.stringify(uid) + ', "uidtidakada"]');
  await page.evaluate("document.dispatchEvent(new Event('visibilitychange'))");
  const data = await h.waitStored(page, d => d.tasks.find(t => t.title === 'Rapat tim').done === true);
  assert.strictEqual(data.tasks.filter(t => t.done).length, 1);
  await h.until(page, 'window.__widgetCleared.length === 2'); // uid yang sudah tak ada pun dibersihkan, tidak menggantung
  await h.until(page, "!window.__widget[window.__widget.length - 1].some(i => i.t === 'Rapat tim')");
  // diterapkan dua kali tidak berpengaruh (idempoten)
  await page.evaluate('window.__widgetDone = [' + JSON.stringify(uid) + ']');
  await page.evaluate("document.dispatchEvent(new Event('visibilitychange'))");
  await h.until(page, 'window.__widgetDone.length === 0');
  assert.strictEqual((await h.stored(page)).tasks.filter(t => t.done).length, 1);
  await h.finish([page]);
});

test('widget: tombol "+" memfokuskan kolom tambah tugas, sekali saja', async () => {
  const page = await h.open(env, { native: true, seed: seed(), width: 390, height: 844 });
  await page.evaluate("document.activeElement && document.activeElement.blur()");
  assert.notStrictEqual(await page.evaluate('document.activeElement.id'), 'quick-input');
  await page.evaluate("window.__widgetAction = 'add'; document.dispatchEvent(new Event('visibilitychange'))");
  await h.until(page, "document.activeElement.id === 'quick-input'");
  assert.strictEqual(await page.evaluate('window.__widgetAction'), ''); // dibaca sekali
  await h.finish([page]);
});

test('widget: tidak ada panggilan di browser biasa (tanpa plugin native)', async () => {
  const page = await h.open(env, { seed: seed() });
  await page.waitForTimeout(700);
  assert.strictEqual(await page.evaluate('typeof window.__widget'), 'undefined');
  await h.finish([page]);
});

test('snapshot harian dibuat, dan pemulihan mengembalikan tugas yang terhapus (kondisi lama disimpan dulu)', async () => {
  const page = await h.open(env, { seed: seed(), view: 'Semua tugas' });
  await h.until(page, "JSON.parse(localStorage.getItem('todo-cli.snapshots') || '[]').length === 1");
  const snaps = JSON.parse(await page.evaluate("localStorage.getItem('todo-cli.snapshots')"));
  assert.strictEqual(snaps[0].state.tasks.length, 4);
  await page.evaluate("window.todoLocalApi('DELETE', '/api/tasks/1')");
  await page.evaluate("window.todoLocalApi('PATCH', '/api/tasks/2', {title: 'Rapat diubah'})");
  await page.evaluate('window.refresh()');
  await h.waitStored(page, d => d.tasks.length === 3 && d.tasks.some(t => t.title === 'Rapat diubah'));
  page.on('dialog', d => d.accept());
  await page.click('#backup-btn');
  assert.strictEqual(await page.locator('#snap-list .snap-row').count(), 1);
  assert.match(await page.locator('#snap-list .snap-row').textContent(), /4 tugas/);
  await page.click('#snap-list .snap-row button');
  await h.until(page, "document.querySelector('#snap-msg').textContent.includes('4 tugas dipulihkan')");
  const data = await h.waitStored(page, d => d.tasks.length === 4 && d.tasks.some(t => t.title === 'Bayar listrik'));
  assert.ok(data.tasks.some(t => t.title === 'Rapat tim') && !data.tasks.some(t => t.title === 'Rapat diubah'));
  // kondisi sebelum pemulihan tersimpan sebagai salinan sendiri, dan bisa dipulihkan balik
  assert.strictEqual(await page.locator('#snap-list .snap-row').count(), 2);
  assert.match(await page.locator('#snap-list .snap-row').first().textContent(), /\(sebelum pemulihan\) · 3 tugas/);
  await page.locator('#snap-list .snap-row').first().locator('button').click();
  await h.waitStored(page, d => d.tasks.length === 3 && d.tasks.some(t => t.title === 'Rapat diubah'));
  await h.finish([page]);
});

test('snapshot: data kosong tidak membuat salinan', async () => {
  const page = await h.open(env, {});
  await page.waitForTimeout(900);
  assert.strictEqual(await page.evaluate("localStorage.getItem('todo-cli.snapshots')"), null);
  await h.finish([page]);
});

test('salinan Dokumen/Todo ditulis di Android; data kosong tidak menimpa; kegagalan dilaporkan', async () => {
  const a = await h.open(env, { native: true, seed: seed() });
  await h.until(a, 'window.__writes.length >= 1');
  const w = await a.evaluate('window.__writes[0]');
  assert.strictEqual(w.path, 'Todo/todo-cadangan.json');
  assert.strictEqual(w.directory, 'DOCUMENTS');
  assert.strictEqual(w.recursive, true);
  assert.strictEqual(JSON.parse(w.data).tasks.length, 4);
  await a.click('#backup-btn');
  assert.match(await a.locator('#doc-status').textContent(), /diperbarui pukul \d\d:\d\d/);
  const empty = await h.open(env, { native: true });
  await empty.waitForTimeout(900);
  assert.strictEqual(await empty.evaluate('window.__writes.length'), 0);
  const bad = await h.open(env, { native: true, seed: seed(), fsFail: true });
  await h.until(bad, "JSON.parse(localStorage.getItem('todo-cli.status') || '{}').doc");
  await bad.click('#backup-btn');
  assert.match(await bad.locator('#doc-status').textContent(), /gagal \(Permission denied\)/);
  assert.ok(await bad.evaluate("JSON.parse(localStorage.getItem('todo-cli.snapshots')).length === 1")); // salinan dalam aplikasi tetap dibuat
  await h.finish([a, empty, bad]);
});

const PASS = 'sandi-rahasia-1';
async function enable(page, token, pass) {
  await page.click('#backup-btn');
  await page.fill('#auto-token', token);
  await page.fill('#auto-pass', pass);
  await page.click('#auto-on');
}

test('sinkron otomatis: dua ponsel lewat Gist, isi terenkripsi, kata sandi salah ditolak, matikan menghapus rahasia', async () => {
  const gh = h.fakeGithub('ghp_rahasia');
  const a = await h.open(env, { github: gh, seed: [h.task(1, 'Dari A rahasia')], view: 'Semua tugas' });
  const b = await h.open(env, { github: gh, view: 'Semua tugas' });
  const c = await h.open(env, { github: gh, view: 'Semua tugas' });
  for (const p of [a, b, c]) p.on('dialog', d => d.accept());
  // kata sandi pendek ditolak sebelum menghubungi GitHub
  await a.click('#backup-btn');
  await a.fill('#auto-token', 'ghp_rahasia'); await a.fill('#auto-pass', 'pendek');
  await a.click('#auto-on');
  assert.match(await a.locator('#auto-msg').textContent(), /minimal 8 karakter/);
  assert.strictEqual(gh.calls.length, 0);
  await a.fill('#auto-pass', PASS);
  await a.click('#auto-on');
  await h.until(a, "document.querySelector('#auto-msg').textContent.includes('Terakhir sinkron')");
  assert.strictEqual(gh.gists.length, 1);
  assert.ok(await a.locator('#auto-token').isHidden() && await a.locator('#auto-pass').isHidden() && await a.locator('#auto-now').isVisible());
  const names = Object.keys(gh.gists[0].files);
  assert.strictEqual(names.length, 1);
  assert.match(names[0], /^todo-sync-[0-9a-f]{8}\.json$/);
  const dump = JSON.stringify(gh.gists);
  for (const secret of ['Dari A', 'rahasia', 'ghp_', PASS]) assert.ok(!dump.includes(secret), 'bocor di gist: ' + secret);
  assert.ok(!(await a.evaluate("localStorage.getItem('todo-cli.data.v1')")).includes(PASS));
  // ponsel dengan kata sandi salah: ditolak, tidak menulis apa pun
  await enable(c, 'ghp_rahasia', 'sandi-yang-salah');
  await h.until(c, "document.querySelector('#auto-msg').textContent.includes('Kata sandi sinkron salah')");
  assert.strictEqual(Object.keys(gh.gists[0].files).length, 1);
  assert.strictEqual(await c.locator('#list .row').count(), 0);
  // ponsel B hanya punya token + kata sandi: menemukan gist dan mendapat tugas A
  await enable(b, 'ghp_rahasia', PASS);
  await h.until(b, "document.querySelector('#auto-msg').textContent.includes('1 baru')");
  await b.click('#backup-close');
  await h.until(b, "document.querySelectorAll('#list .row').length === 1");
  assert.strictEqual(Object.keys(gh.gists[0].files).length, 2); // berkas milik masing-masing
  // B menambah tugas (terkirim otomatis); A menarik lewat "Sinkron sekarang"
  await h.quickAdd(b, 'Dari B');
  await h.until(b, "document.querySelectorAll('#list .row').length === 2");
  const end = Date.now() + 15000;
  for (;;) {
    await a.click('#auto-now');
    await a.waitForTimeout(700);
    if (await a.evaluate("document.querySelector('#auto-msg').textContent.includes('1 baru')")) break;
    if (Date.now() > end) throw new Error('A tidak menerima tugas dari B');
  }
  await a.click('#backup-close');
  await h.until(a, "document.querySelectorAll('#list .row').length === 2");
  assert.ok(!JSON.stringify(gh.gists).includes('Dari B'));
  // matikan: token & kata sandi hilang, gist tetap
  await a.click('#backup-btn');
  await a.click('#auto-off');
  assert.strictEqual(await a.evaluate("localStorage.getItem('todo-cli.autosync')"), null);
  assert.ok(await a.locator('#auto-token').isVisible() && await a.locator('#auto-pass').isVisible());
  assert.strictEqual(gh.gists.length, 1);
  // atur ulang: aktifkan lagi lalu hapus semua berkas sinkron di gist
  await a.fill('#auto-token', 'ghp_rahasia'); await a.fill('#auto-pass', PASS);
  await a.click('#auto-on');
  await h.until(a, "document.querySelector('#auto-msg').textContent.includes('Terakhir sinkron')");
  await a.click('#auto-reset');
  await h.until(a, "document.querySelector('#auto-msg').textContent.includes('berkas sinkron dihapus')");
  assert.deepStrictEqual(Object.keys(gh.gists[0].files), []);
  await h.finish([a, b, c]);
});

test('sinkron otomatis: token salah dan jaringan putus menampilkan pesan, data tetap utuh', async () => {
  const gh = h.fakeGithub('ghp_benar');
  const page = await h.open(env, { github: gh, seed: [h.task(1, 'Tetap ada')], view: 'Semua tugas' });
  page.on('dialog', d => d.accept());
  await enable(page, 'ghp_salah', PASS);
  await h.until(page, "document.querySelector('#auto-msg').textContent.includes('Token ditolak')");
  assert.ok(!(await page.locator('#auto-msg').getAttribute('class')).split(' ').includes('ok'));
  gh.offline = true;
  await page.click('#auto-now');
  await h.until(page, "document.querySelector('#auto-msg').textContent.includes('Tidak ada koneksi')");
  await page.click('#backup-close');
  assert.strictEqual(await page.locator('#list .row').count(), 1);
  assert.strictEqual(gh.gists.length, 0);
  const consoleErrors = page.problems.filter(p => !/Failed to load resource|net::ERR/.test(p));
  page.problems.length = 0;
  assert.deepStrictEqual(consoleErrors, []);
  await h.finish([page]);
});
