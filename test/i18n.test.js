'use strict';
// Kelengkapan & konsistensi kamus Inggris.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
global.localStorage = { getItem: () => 'en', setItem() {} };
const I = require('../src/i18n.js');
require('../src/i18n-en.js');
const D = I.DICT.en;

const src = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const unq = (q, body) => body.replace(/\\(['"n\\])/g, (m, c) => (c === 'n' ? '\n' : c));

/* Semua literal di dalam T(...) satu panggilan (mis. T(a ? 'x' : 'y')) harus ada di kamus. */
function keysIn(file) {
  const text = src(file), keys = new Set();
  const re = /\bT\(/g;
  let m;
  while ((m = re.exec(text))) {
    let depth = 1, i = m.index + 2, start = i;
    while (i < text.length && depth) { const c = text[i]; if (c === '(') depth++; else if (c === ')') depth--; else if (c === "'" || c === '"') { const q = c; i++; while (text[i] !== q) { if (text[i] === '\\') i++; i++; } } i++; }
    const call = text.slice(start, i - 1);
    const args = call.split(/,\s*\{/)[0]; // buang objek variabel
    for (const lit of args.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)) {
      const k = unq("'", lit[1] !== undefined ? lit[1] : lit[2]);
      if (/[A-Za-z]{2,}/.test(k)) keys.add(k);
    }
  }
  return keys;
}

test('setiap kunci T() statis di app.js dan local-api.js ada di kamus Inggris', () => {
  const missing = [];
  for (const f of ['app.js', 'local-api.js']) for (const k of keysIn(f)) {
    if (/^(Tiap|Setiap) (\{n\} )?$/.test(k) || k === 'done') continue; // 'done' = pembanding nama tampilan; "Tiap {n} " disusun dengan satuan (lihat tes berikutnya)
    if (!(k in D)) missing.push(f + ': ' + k);
  }
  assert.deepStrictEqual(missing, []);
});

test('kunci turunan (aturan ulang, nama hari/bulan, label tabel) ada di kamus', () => {
  const need = ['Tiap hari', 'Tiap minggu', 'Tiap bulan', 'Tiap tahun', 'Setiap hari', 'Setiap minggu', 'Setiap bulan', 'Setiap tahun',
    'Tiap {n} hari', 'Tiap {n} minggu', 'Tiap {n} bulan', 'Tiap {n} tahun', 'Setiap {n} hari', 'Setiap {n} minggu', 'Setiap {n} bulan', 'Setiap {n} tahun',
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des', 'Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab',
    'Terlambat', 'Hari ini', 'Besok', 'Minggu ini', 'Nanti', 'Tanpa deadline', 'Otomatis', 'Prioritas', 'Waktu', 'Terbaru', 'A–Z',
    'Semua', 'Prioritas tinggi', 'Ber-jam', 'Berulang', 'Mendatang', 'Kalender', 'Semua tugas', 'Selesai', 'Wawasan', 'Sampah',
    '1 jam lagi', 'sore ini (17:00)', 'besok', 'minggu depan', 'Biru tinta', 'Hijau daun', 'Merah bata', 'Cokelat kopi', 'Arang',
    'Tidak berulang', 'Minggu depan', 'Akhir pekan', 'Penting', 'Harian', 'Mingguan', 'Pagi 08:00', 'Siang 12:00', 'Sore 17:00'];
  const same = new Set(['Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Sep', 'Nov', 'A–Z']); // sama di kedua bahasa
  const missing = need.filter(k => !(k in D) && !same.has(k));
  assert.deepStrictEqual(missing, []);
});

test('placeholder {x} kunci dan nilai sama; larik jamak berisi dua bentuk', () => {
  const bad = [];
  for (const [k, v] of Object.entries(D)) {
    const ph = s => (s.match(/\{\w+\}/g) || []).sort().join(',');
    const vals = Array.isArray(v) ? v : [v];
    if (Array.isArray(v) && (v.length !== 2 || !k.includes('{n}'))) bad.push('larik: ' + k);
    for (const x of vals) if (ph(x) !== ph(k)) bad.push(k + ' ≠ ' + x);
  }
  assert.deepStrictEqual(bad, []);
});

test('T(): jamak menurut n, interpolasi, bahasa Indonesia mengembalikan sumber apa adanya', () => {
  assert.strictEqual(I.T('{n} tugas', { n: 1 }), '1 task');
  assert.strictEqual(I.T('{n} tugas', { n: 2 }), '2 tasks');
  assert.strictEqual(I.T('{n} tugas', { n: 0 }), '0 tasks');
  assert.strictEqual(I.T('Teks yang belum ada di kamus'), 'Teks yang belum ada di kamus');
  assert.strictEqual(I.T('Dibuat {date}', { date: 'Mon' }), 'Created Mon');
  assert.strictEqual(I.T('{x} dan {y}', { x: 1 }), '1 dan {y}', 'variabel hilang dibiarkan');
  I.state.lang = 'id';
  assert.strictEqual(I.T('{n} tugas', { n: 2 }), '2 tugas');
  assert.strictEqual(I.T('Hapus {title}', { title: 'x' }), 'Hapus x');
  I.state.lang = 'en';
});

test('galat inti yang dinamis diterjemahkan lewat pola, termasuk yang bersarang', () => {
  const core = require('../src/todo-core.js');
  const grab = fn => { try { fn(); } catch (e) { return e.message; } };
  const today = '2026-10-28';
  const cases = [
    [() => core.parseBulk('ok\n!1', today), /^Line 2: Task title cannot be empty\. Markers: /],
    [() => core.parseBulk('', today), /^No task lines/],
    [() => core.parseQuick('x ^tanggalngawur', today), /^Deadline 'tanggalngawur' not recognised\. Supported formats/],
    [() => core.parseQuick('x ^31/02', today), /^Invalid date: '31\/02'\./],
    [() => core.parseQuick('', today), /^Task title cannot be empty\. Markers:/],
    [() => core.parseBulk('x'.repeat(20001), today), /^The text is too long \(at most 20000 characters\)\./],
    [() => core.parseBulk(Array.from({ length: 201 }, () => 'a').join('\n'), today), /^Too many lines \(at most 200\)\./],
    [() => core.parsePriority('zzz'), /^Priority 'zzz' is not valid/],
  ];
  for (const [fn, re] of cases) {
    const msg = grab(fn);
    assert.ok(msg, 'harus melempar galat');
    assert.match(I.T(msg), re, msg);
  }
  assert.strictEqual(I.T('GitHub membalas kesalahan 502.'), 'GitHub replied with error 502.');
  assert.strictEqual(I.T('Isi todo-sync-a.json bukan JSON yang valid.'), 'The contents of todo-sync-a.json are not valid JSON.');
  assert.strictEqual(I.T('Isi f.json bukan berkas sinkron yang valid: Ini bukan berkas sinkron todo-cli.'), 'The contents of f.json are not a valid sync file: This is not a todo-cli sync file.');
});

test('semua pesan galat statis di todo-core.js dan autosync.js punya terjemahan atau sengaja internal', () => {
  const internal = /^(bukan objek|uid tidak valid|parent_uid tidak valid|updated_at tidak valid|tanggal tidak valid|jam tanpa deadline|created_at tidak valid|completed_at tidak valid|parent_id harus berupa angka\.|luar jangkauan)$/;
  const missing = [];
  for (const f of ['todo-core.js', 'autosync.js']) {
    for (const m of src(f).matchAll(/(?:TodoError|SyncError)\((?:'[a-z]+', )?(['"])((?:(?!\1)[^\\]|\\.)*)\1\s*[,)]/g)) {
      const msg = unq(m[1], m[2]);
      if (internal.test(msg) || /^(config|network|auth|limit|notfound|http|size|format|password|crypto)$/.test(msg)) continue;
      if (I.T(msg) === msg) missing.push(msg);
    }
  }
  assert.deepStrictEqual(missing, []);
});

test('inti: kata waktu Inggris dan am/pm dikenali; alasan galat sinkron diterjemahkan', () => {
  const core = require('../src/todo-core.js');
  const due = t => core.parseDue(t, '2026-10-30');
  assert.deepStrictEqual(due('tomorrow 3pm'), ['2026-10-31', '15:00']);
  assert.deepStrictEqual(due('tomorrow 3:30 pm'), ['2026-10-31', '15:30']);
  assert.deepStrictEqual(due('tomorrow 12am'), ['2026-10-31', '00:00']);
  assert.deepStrictEqual(due('tomorrow 12pm'), ['2026-10-31', '12:00']);
  assert.deepStrictEqual(due('tomorrow morning'), ['2026-10-31', '08:00']);
  assert.deepStrictEqual(due('tomorrow noon'), ['2026-10-31', '12:00']);
  assert.deepStrictEqual(due('tomorrow evening'), ['2026-10-31', '20:00']);
  assert.deepStrictEqual(due('tomorrow jam 3 afternoon'), ['2026-10-31', '15:00']);
  assert.throws(() => due('tomorrow 13pm'), /tidak valid/);
  assert.strictEqual(core.parseQuick('Call mom ^tomorrow 3pm', '2026-10-30').due_time, '15:00');
  const I = require('../src/i18n.js'); require('../src/i18n-en.js');
  const prev = I.state.lang; I.state.lang = 'en';
  try {
    assert.strictEqual(I.T('Tugas ke-2 di berkas sinkron tidak valid: uid tidak valid'), 'Task #2 in the sync file is invalid: invalid uid');
    assert.strictEqual(I.T('Tugas ke-3 tidak valid: jam tanpa deadline'), 'Task #3 is invalid: time without a deadline');
  } finally { I.state.lang = prev; }
});
