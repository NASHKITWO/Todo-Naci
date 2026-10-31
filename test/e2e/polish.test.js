'use strict';
// v0.14: warna proyek, blok tanggal, centang bergambar, bagikan daftar.
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers');
const { task: T, TODAY, day: D } = h;

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(env); });

test('warna proyek stabil menurut nama dan sama di chip dan sidebar', async () => {
  const page = await h.open(env, { seed: [T(1, 'A', { deadline: TODAY, project: 'kuliah' }), T(2, 'B', { deadline: TODAY, project: 'kuliah' }), T(3, 'C', { deadline: TODAY, project: 'rumah' })] });
  await h.until(page, "document.querySelectorAll('.row').length === 3");
  const cls = await page.evaluate(() => Array.from(document.querySelectorAll('.chip.project')).map(e => [e.textContent, (e.className.match(/pc\d/) || [])[0]]));
  assert.strictEqual(cls.length, 3);
  const kuliah = cls.filter(c => c[0] === '@kuliah').map(c => c[1]);
  assert.ok(kuliah[0] && kuliah[0] === kuliah[1], 'proyek sama = warna sama');
  const dots = await page.evaluate(() => Array.from(document.querySelectorAll('#nav-projects .nav-item')).map(b => [b.textContent, (b.querySelector('.dot').className.match(/pc\d/) || [])[0]]));
  const side = Object.fromEntries(dots.map(d => [d[0].replace(/\d+$/, ''), d[1]]));
  assert.strictEqual(side.kuliah, kuliah[0]);
  await h.finish([page]);
});

test('blok tanggal di sapaan menampilkan hari ini', async () => {
  const page = await h.open(env, { seed: [T(1, 'A', { deadline: TODAY })] });
  await h.until(page, "document.querySelector('.dateblock .dd')");
  const [y, m, d] = TODAY.split('-').map(Number);
  assert.strictEqual(await page.textContent('.dateblock .dd'), String(d));
  assert.strictEqual(await page.textContent('.dateblock .dm'), ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][m - 1]);
  assert.strictEqual(await page.getAttribute('.dateblock', 'aria-hidden'), 'true');
  await h.finish([page]);
});

test('selesai: centang bergambar dulu, lalu tugas tercatat selesai', async () => {
  const page = await h.open(env, { seed: [T(1, 'Satu', { deadline: TODAY }), T(2, 'Dua', { deadline: TODAY })] });
  await h.until(page, "document.querySelectorAll('.row').length === 2");
  await page.evaluate("document.querySelector('.row[data-id=\"1\"] .check').click()");
  await h.until(page, "document.querySelector('.row[data-id=\"1\"] .check.ticking')");
  await h.waitStored(page, d => d.tasks.find(t => t.id === 1).done === true);
  await h.finish([page]);
});

test('bagikan daftar: teks berisi judul, tanggal, tugas, subtugas; kosong ditolak', async () => {
  const page = await h.open(env, { view: 'Semua tugas', seed: [T(1, 'Beli susu', { deadline: D(1), due_time: '17:00' }), T(2, 'Laporan', { deadline: TODAY }), T(3, 'Bab 1', { parent_id: 2 }), T(4, 'Selesai', { done: true, completed_at: TODAY + 'T08:00:00' })] });
  await h.until(page, "document.querySelectorAll('.row').length >= 2");
  await page.evaluate("window.__shared = null; window.todoShareText = async (t, x) => { window.__shared = { t, x }; return 'copied'; }");
  await page.evaluate("document.querySelector('#share-btn').click()");
  await h.until(page, 'window.__shared');
  const { t, x } = await page.evaluate('window.__shared');
  assert.match(t, /^Tuntas Harian · Semua tugas · /);
  const lines = x.split('\n');
  assert.strictEqual(lines[0], t);
  assert.ok(lines.includes('☐ Beli susu (Besok 17:00)'), x);
  assert.ok(lines.includes('☐ Laporan (Hari ini)'), x);
  assert.ok(lines.includes('    ☐ Bab 1'), x);
  assert.ok(await page.textContent('#toasts').then(s => /disalin/.test(s)));
  // tampilan Wawasan: tidak ada yang dibagikan
  await h.view(page, 'Wawasan');
  await page.evaluate("window.__shared = null");
  await page.evaluate("document.querySelector('#share-btn').click()");
  await h.until(page, "/Tidak ada tugas untuk dibagikan/.test(document.querySelector('#toasts').textContent)");
  assert.strictEqual(await page.evaluate('window.__shared'), null);
  await h.finish([page]);
});

test('todoShareText: lembar bagikan native, batal, dan galat', async () => {
  const page = await h.open(env, { native: true, seed: [] });
  const r = await page.evaluate(async () => {
    const out = [];
    window.Capacitor.Plugins.Share = { share: async o => { out.push(o.title); } };
    out.push(await window.todoShareText('J', 'isi'));
    window.Capacitor.Plugins.Share = { share: async () => { throw new Error('Share canceled'); } };
    out.push(await window.todoShareText('J', 'isi'));
    window.Capacitor.Plugins.Share = { share: async () => { throw new Error('boom'); } };
    out.push(await window.todoShareText('J', 'isi'));
    return out;
  });
  assert.deepStrictEqual(r, ['J', 'shared', 'cancelled', 'failed']);
  await h.finish([page]);
});

test('formulir tidak pernah dikirim secara bawaan (mis. Enter sebelum skrip aplikasi siap)', async () => {
  const page = await h.open(env, { seed: [] });
  const prevented = await page.evaluate(() => {
    const f = document.createElement('form');
    document.body.append(f);
    const ev = new Event('submit', { bubbles: true, cancelable: true });
    f.dispatchEvent(ev);
    f.remove();
    return ev.defaultPrevented;
  });
  assert.strictEqual(prevented, true);
  await h.finish([page]);
});

test('warna proyek tidak kembar selama masih ada warna kosong, dan diingat setelah muat ulang', async () => {
  const names = ['kuliah', 'rumah', 'kerja', 'belanja', 'kantor', 'sekolah']; // enam nama: semua warna terpakai tepat sekali
  const seed = names.map((n, i) => T(i + 1, 'Tugas ' + n, { deadline: TODAY, project: n }));
  const page = await h.open(env, { seed });
  await h.until(page, "document.querySelectorAll('.chip.project').length === 6");
  const read = () => page.evaluate(() => Object.fromEntries(Array.from(document.querySelectorAll('.chip.project')).map(e => [e.textContent, (e.className.match(/pc\d/) || [])[0]])));
  const first = await read();
  assert.strictEqual(new Set(Object.values(first)).size, 6, JSON.stringify(first));
  await page.reload();
  await h.until(page, "document.querySelectorAll('.chip.project').length === 6");
  assert.deepStrictEqual(await read(), first, 'warna sama setelah muat ulang');
  await h.finish([page]);
});

test('tanda merek di pojok kiri atas memakai logo matahari bercentang', async () => {
  const page = await h.open(env, { seed: [] });
  assert.ok(await page.evaluate("document.querySelectorAll('#brand-mark svg circle, #brand-mark svg path').length > 0"));
  const d = await page.evaluate("document.querySelector('#brand-mark svg path').getAttribute('d')");
  assert.match(d, /a5\.5 5\.5/, 'lingkaran matahari ada');
  await h.finish([page]);
});
