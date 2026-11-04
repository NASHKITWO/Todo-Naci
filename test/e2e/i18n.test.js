'use strict';
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers.js');
const { task: T, TODAY, day: D } = h;

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(); });

/* Kata yang hanya ada di bahasa Indonesia: kalau muncul di mode Inggris berarti ada teks yang belum diterjemahkan. */
const ID_WORDS = ['yang', 'dan', 'tidak', 'untuk', 'dengan', 'atau', 'belum', 'sudah', 'dari', 'pada', 'akan', 'bisa', 'tugas', 'hapus', 'tambah', 'simpan',
  'pulihkan', 'selesai', 'besok', 'minggu', 'hari', 'bulan', 'tahun', 'catatan', 'proyek', 'subtugas', 'cadangan', 'sinkron', 'sandi', 'berkas', 'perangkat',
  'aplikasi', 'saat', 'jika', 'semua', 'kosong', 'sampah', 'pilih', 'buka', 'tutup', 'batal', 'urungkan', 'tunda', 'ulangi', 'judul', 'pagi', 'siang', 'sore',
  'malam', 'tampilan', 'bahasa', 'ini', 'itu', 'mis', 'lagi', 'sekarang', 'terakhir', 'gagal', 'aktif', 'matikan', 'kirim', 'gabungkan', 'bagikan', 'dukung',
  'donasi', 'pendiri', 'teknik', 'informatika', 'ketik', 'tempel', 'baris', 'templat', 'ubah', 'pakai', 'kata', 'muncul', 'sini', 'kamu', 'nikmati', 'kerja', 'bagus',
  'terlambat', 'mendatang', 'kalender', 'wawasan', 'prioritas', 'tinggi', 'sedang', 'rendah', 'waktu', 'urut', 'berulang', 'setiap', 'tiap', 'tanggal', 'ada', 'cari'];
const SCAN = `(() => {
  const SKIP = '.title, .st, .trash-title, .bt, .tpl-name, .nav-item .dot + *';
  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && !el.closest('[hidden]'); };
  const parts = [];
  const walk = root => {
    for (const el of root.querySelectorAll('*')) {
      if (!vis(el) || el.closest('script,style,svg')) continue;
      if (el.closest('#toasts')) continue;
      if (el.matches(SKIP) || el.closest('.title, .st, .trash-title, .bt, .tpl-name')) continue;
      for (const a of ['aria-label', 'title', 'placeholder']) {
        if (!el.hasAttribute(a)) continue;
        const v = el.getAttribute(a);
        if (a === 'aria-label' && (el.classList.contains('row') || /^(Complete|Reopen|Restore|Delete permanently|Delete subtask|New subtask for|Use template|Edit template|Delete template): /.test(v))) continue; // memuat judul pengguna
        parts.push(v);
      }
      for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) parts.push(n.nodeValue);
    }
  };
  walk(document.body);
  return parts.join(' \\n ');
})()`;
const leftovers = async page => {
  const text = (await page.evaluate(SCAN)).replace(/todo-cadangan\.json|Universitas Pamulang|Muhammad Ikhsan|ican3192@gmail\.com/g, ' ');
  const words = new Set(text.toLowerCase().match(/[a-zà-ÿ]+/g) || []);
  const hits = ID_WORDS.filter(w => words.has(w));
  if (hits.length) console.log('SISA:', hits.join(','), '\n', text.split('\n').filter(l => hits.some(w => new RegExp('\\b' + w + '\\b', 'i').test(l))).join('\n'));
  return hits;
};

test('mode Inggris: semua layar utama tanpa sisa kata Indonesia, judul tugas pengguna tidak ikut diterjemahkan', async () => {
  const seed = [T(1, 'Selesai', { deadline: TODAY, project: 'kuliah', tags: ['x'], notes: 'catatan' }), T(2, 'Besok', { deadline: D(1), priority: 1 }), T(3, 'Hapus', { deadline: D(-2), due_time: '09:30', repeat: '2w' }),
    T(4, 'Sampah', { parent_id: 1 }), T(6, 'Tanpa tanggal'), T(5, 'Urungkan', { done: true, completed_at: TODAY + 'T09:00:00', deadline: D(-1) })];
  const page = await h.open(env, { lang: 'en', seed });
  await h.until(page, "document.querySelector('.row[data-id=\"1\"]')");
  assert.strictEqual(await page.evaluate('document.documentElement.lang'), 'en');
  assert.deepStrictEqual(await leftovers(page), [], 'layar Hari ini');
  // judul pengguna tetap persis
  assert.deepStrictEqual(await page.evaluate("Array.from(document.querySelectorAll('.row .title')).map(e => e.textContent).sort()"), ['Hapus', 'Selesai']);
  assert.match(await page.textContent('#view-title'), /^Today$/);
  assert.match(await page.textContent('#hero-title'), /Good (morning|afternoon|evening|night)/);
  for (const [name, title] of [['Upcoming', 'Upcoming'], ['Calendar', 'Calendar'], ['All tasks', 'All tasks'], ['Done', 'Done'], ['Insights', 'Insights'], ['Trash', 'Trash']]) {
    await h.view(page, name);
    await h.until(page, `document.querySelector('#view-title').textContent === ${JSON.stringify(title)}`);
    assert.deepStrictEqual(await leftovers(page), [], 'layar ' + name);
  }
  // tugas dihapus → sampah (judul pengguna tetap), toast Inggris
  await h.view(page, 'All tasks');
  await page.click('.row[data-id="2"] .title');
  await h.until(page, "document.querySelector('#drawer.open')");
  assert.deepStrictEqual(await leftovers(page), [], 'panel detail');
  await page.getByRole('button', { name: 'Delete task' }).click();
  await h.until(page, "document.querySelector('#toasts button')");
  assert.strictEqual((await page.textContent('#toasts')).trim(), '"Besok" moved to trashUndo');
  await h.view(page, 'Trash');
  await h.until(page, "document.querySelector('.trash-row')");
  assert.strictEqual(await page.textContent('.trash-title'), 'Besok');
  assert.deepStrictEqual(await leftovers(page), [], 'sampah berisi');
  await h.finish([page]);
});

test('mode Inggris: dialog tambah banyak, panel cadangan, bantuan penulisan cepat, dan galat', async () => {
  const page = await h.open(env, { lang: 'en', width: 390, height: 844, seed: [T(1, 'Contoh', { deadline: TODAY })] });
  await h.until(page, "document.querySelector('.row')");
  await page.focus('#quick-input');
  await h.until(page, "!document.querySelector('#quick-chips').hidden");
  assert.deepStrictEqual(await leftovers(page), [], 'tombol pilihan cepat');
  await page.click('#detail-btn');
  await h.until(page, "!document.querySelector('#detail').hidden");
  assert.deepStrictEqual(await leftovers(page), [], 'lembar atur detail');
  await page.click('#det-bulk');
  await h.until(page, "!document.querySelector('#bulk').hidden");
  await page.fill('#bulk-text', 'Rapat\n  slide\nBeli kopi');
  await h.until(page, "document.querySelectorAll('#bulk-preview li').length === 3");
  assert.match(await page.textContent('#bulk-add'), /^Add 3 tasks$/);
  assert.deepStrictEqual(await leftovers(page), [], 'dialog tambah banyak');
  await page.fill('#bulk-text', 'ok\n' + 'a'.repeat(400));
  await h.until(page, "document.querySelector('#bulk-msg').textContent.startsWith('Line 2: The title is too long')");
  assert.deepStrictEqual(await leftovers(page), [], 'galat baris (Inggris)');
  await page.fill('#bulk-text', 'Cek surat');
  await page.fill('#bulk-tpl-name', 'Rutin');
  await page.click('#bulk-save-tpl');
  await h.until(page, "document.querySelector('.tpl-row')");
  assert.strictEqual(await page.textContent('.tpl-meta'), '1 task');
  assert.deepStrictEqual(await leftovers(page), [], 'daftar templat');
  await page.keyboard.press('Escape');
  await page.click('#menu-btn'); await page.click('#backup-btn');
  await h.until(page, "!document.querySelector('#backup').hidden");
  assert.deepStrictEqual(await leftovers(page), [], 'panel cadangan');
  assert.match(await page.textContent('#about'), /Founder and Developer: Muhammad Ikhsan/);
  assert.match(await page.textContent('#donate-link'), /Support the developer/);
  await h.finish([page]);
});

test('pengalih bahasa: Indonesia ⇄ Inggris tersimpan setelah muat ulang, bawaan tetap Indonesia', async () => {
  const page = await h.open(env, { seed: [T(1, 'Contoh', { deadline: TODAY })] });
  await h.until(page, "document.querySelector('.row')");
  assert.strictEqual(await page.evaluate('document.documentElement.lang'), 'id');
  assert.match(await page.textContent('#lang-btn'), /Bahasa: Indonesia/);
  assert.strictEqual(await page.textContent('#view-title'), 'Hari ini');
  await page.click('#menu-btn').catch(() => {});
  await Promise.all([page.waitForNavigation(), page.evaluate("document.querySelector('#lang-btn').click()")]);
  await page.waitForSelector('#nav-views button');
  assert.strictEqual(await page.textContent('#view-title'), 'Today');
  assert.match(await page.textContent('#lang-btn'), /Language: English/);
  assert.strictEqual(await page.evaluate("localStorage.getItem('todo-lang')"), 'en');
  await Promise.all([page.waitForNavigation(), page.evaluate("document.querySelector('#lang-btn').click()")]);
  await page.waitForSelector('#nav-views button');
  assert.strictEqual(await page.textContent('#view-title'), 'Hari ini');
  assert.strictEqual(await page.evaluate("localStorage.getItem('todo-lang')"), 'id');
  await h.finish([page]);
});
