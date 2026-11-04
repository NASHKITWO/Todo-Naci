'use strict';
// Tempel banyak baris + templat tugas (v0.12).
const test = require('node:test');
const assert = require('node:assert');
const core = require('../src/todo-core.js');

const clone = v => JSON.parse(JSON.stringify(v));
function phone(today) {
  let data = null;
  const day = { v: today || '2026-10-28' };
  const clock = { today: () => day.v, now: () => day.v + 'T09:00:00', stamp: () => new Date().toISOString() };
  const mk = () => new core.Store({ load: () => data, save: o => { data = clone(o); } }, clock);
  let store = mk();
  const self = {
    get store() { return store; }, day,
    reopen() { store = mk(); return self; },
    api: (m, p, b) => core.handle(store, m, p, b || {}),
    all: () => store.listAll(),
  };
  return self;
}
const plan = (text, today) => core.parseBulk(text, today || '2026-10-28');

test('parseBulk: penanda butir, kotak centang, nomor, dan baris kosong', () => {
  const p = plan('- satu\n* dua\n• tiga\n– empat\n1. lima\n2) enam\n\n   \n- [ ] tujuh\n- [x] delapan\n[X] sembilan\n[ ] sepuluh\nbiasa');
  assert.deepStrictEqual(p.map(x => x.title), ['satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'biasa']);
  assert.deepStrictEqual(p.map(x => x.done), [false, false, false, false, false, false, false, true, true, false, false]);
  assert.ok(p.every(x => !x.sub));
});

test('parseBulk: sintaks penulisan cepat berlaku per baris, dan *ulang tidak dikira butir', () => {
  const [a, b] = plan('Bayar listrik !1 ^besok 14:00 @rumah #tagihan *1w\n* Siram !3', '2026-10-28');
  assert.strictEqual(a.title, 'Bayar listrik'); assert.strictEqual(a.priority, 1);
  assert.strictEqual(a.deadline, '2026-10-29'); assert.strictEqual(a.due_time, '14:00');
  assert.strictEqual(a.project, 'rumah'); assert.deepStrictEqual(a.tags, ['tagihan']); assert.strictEqual(a.repeat, '1w');
  assert.strictEqual(b.title, 'Siram'); assert.strictEqual(b.priority, 3);
  assert.strictEqual(plan('*1w tugas')[0].repeat, '1w', 'tanpa spasi = ulang, bukan butir');
});

test('parseBulk: baris menjorok jadi subtugas (spasi atau tab); tingkat dalam diratakan; kembali ke tepi = induk baru', () => {
  const p = plan('A\n  a1\n  a2\n    a2x\nB\n\tb1\nC');
  assert.deepStrictEqual(p.map(x => [x.title, x.sub]), [['A', false], ['a1', true], ['a2', true], ['a2x', true], ['B', false], ['b1', true], ['C', false]]);
  // seluruh teks menjorok sama: tidak ada induk di atasnya, jadi tetap tingkat atas
  assert.ok(plan('  x\n  y').every(x => !x.sub));
  // butir bersarang gaya markdown
  assert.deepStrictEqual(plan('- A\n  - a1\n- B').map(x => x.sub), [false, true, false]);
});

test('parseBulk: CRLF/CR, nomor baris pada galat, batas baris dan karakter, masukan bukan teks', () => {
  assert.deepStrictEqual(plan('a\r\nb\rc').map(x => x.title), ['a', 'b', 'c']);
  assert.throws(() => plan('ok\n\n!1 ^besok'), /^Error: Baris 3: Judul tugas tidak boleh kosong/);
  assert.throws(() => plan('ok\nbad ^tanggalngawur'), /Baris 2:/);
  assert.throws(() => plan(''), /Tidak ada baris tugas/);
  assert.throws(() => plan('\n  \n'), /Tidak ada baris tugas/);
  assert.strictEqual(plan(Array.from({ length: 200 }, (_, i) => 't' + i).join('\n')).length, 200);
  assert.throws(() => plan(Array.from({ length: 201 }, (_, i) => 't' + i).join('\n')), /Terlalu banyak baris/);
  assert.throws(() => plan('x'.repeat(20001)), /terlalu panjang/);
  assert.throws(() => core.parseBulk(5, '2026-10-28'), /harus berupa teks/);
});

test('API bulk: membuat tugas + subtugas + status selesai; dry_run tidak mengubah apa pun', () => {
  const p = phone();
  const text = '- Rapat !1 ^besok 09:00 @kerja\n  - siapkan slide\n  - cetak agenda\n- [x] Kirim laporan\nBeli kopi';
  const dry = p.api('POST', '/api/tasks/bulk', { text, dry_run: true });
  assert.strictEqual(dry.status, 200); assert.strictEqual(dry.body.count, 5);
  assert.deepStrictEqual(dry.body.preview.map(x => x.sub), [false, true, true, false, false]);
  assert.strictEqual(p.all().length, 0);
  const r = p.api('POST', '/api/tasks/bulk', { text });
  assert.strictEqual(r.status, 201); assert.strictEqual(r.body.count, 5);
  const rapat = p.all().find(t => t.title === 'Rapat');
  assert.strictEqual(rapat.sub_total, 2); assert.strictEqual(rapat.deadline, '2026-10-29'); assert.strictEqual(rapat.project, 'kerja');
  const kids = p.all().filter(t => t.parent_id === rapat.id).map(t => t.title);
  assert.deepStrictEqual(kids, ['siapkan slide', 'cetak agenda']);
  assert.strictEqual(p.all().find(t => t.title === 'Kirim laporan').done, true);
  assert.strictEqual(p.all().find(t => t.title === 'Beli kopi').done, false);
});

test('API bulk: galat tidak membuat apa pun (semua-atau-tidak), defaults hanya untuk tingkat atas', () => {
  const p = phone();
  const bad = p.api('POST', '/api/tasks/bulk', { text: 'a\nb\n!1' });
  assert.strictEqual(bad.status, 400); assert.match(bad.body.error, /Baris 3/);
  assert.strictEqual(p.all().length, 0);
  assert.strictEqual(p.api('POST', '/api/tasks/bulk', { text: 5 }).status, 400);
  assert.strictEqual(p.api('POST', '/api/tasks/bulk', { text: 'a', defaults: [1] }).status, 400);
  p.api('POST', '/api/tasks/bulk', { text: 'induk\n  anak\nlain @sendiri', defaults: { deadline: '2026-11-01', project: 'proj', tags: ['t'] } });
  const by = n => p.all().find(t => t.title === n);
  assert.strictEqual(by('induk').deadline, '2026-11-01'); assert.strictEqual(by('induk').project, 'proj'); assert.deepStrictEqual(by('induk').tags, ['t']);
  assert.strictEqual(by('anak').deadline, null); assert.strictEqual(by('anak').project, null);
  assert.strictEqual(by('lain').project, 'sendiri', 'penanda di baris menang atas defaults');
});

test('templat: simpan, daftar, pakai (tanggal relatif dihitung saat dipakai), ganti nama sama = timpa, hapus', () => {
  const p = phone('2026-10-28');
  const r = p.api('POST', '/api/templates', { name: 'Rapat mingguan', text: 'Rapat tim ^besok 10:00\n  agenda\n  notulen' });
  assert.strictEqual(r.status, 201);
  const id = r.body.template.id;
  const list = p.api('GET', '/api/templates').body.templates;
  assert.deepStrictEqual(list.map(x => [x.name, x.count]), [['Rapat mingguan', 3]]);
  p.api('POST', '/api/templates/' + id + '/use');
  assert.strictEqual(p.all().find(t => t.title === 'Rapat tim').deadline, '2026-10-29');
  p.day.v = '2026-11-10';
  const used = p.api('POST', '/api/templates/' + id + '/use', { defaults: { project: 'kerja' } });
  assert.strictEqual(used.status, 201); assert.strictEqual(used.body.count, 3);
  const second = p.all().filter(t => t.title === 'Rapat tim')[1];
  assert.strictEqual(second.deadline, '2026-11-11', 'besok = relatif terhadap hari pemakaian');
  assert.strictEqual(second.project, 'kerja');
  const again = p.api('POST', '/api/templates', { name: 'RAPAT MINGGUAN', text: 'Versi baru' });
  assert.strictEqual(again.status, 200); assert.strictEqual(again.body.template.id, id);
  assert.strictEqual(p.api('GET', '/api/templates').body.templates.length, 1);
  assert.strictEqual(p.api('GET', '/api/templates').body.templates[0].text, 'Versi baru');
  assert.strictEqual(p.api('DELETE', '/api/templates/' + id).status, 200);
  assert.strictEqual(p.api('DELETE', '/api/templates/' + id).status, 404);
  assert.strictEqual(p.api('POST', '/api/templates/' + id + '/use').status, 404);
});

test('templat: validasi masukan dan batas jumlah; bertahan setelah dibuka ulang; tidak ikut ekspor/sinkron', () => {
  const p = phone();
  assert.strictEqual(p.api('POST', '/api/templates', { name: '  ', text: 'a' }).status, 400);
  assert.strictEqual(p.api('POST', '/api/templates', { name: 'x'.repeat(61), text: 'a' }).status, 400);
  assert.strictEqual(p.api('POST', '/api/templates', { name: 'x', text: '!1' }).status, 400);
  assert.strictEqual(p.api('POST', '/api/templates', { name: 'x' }).status, 400);
  assert.strictEqual(p.api('POST', '/api/templates', { name: 'x'.repeat(60), text: 'a' }).status, 201);
  p.api('POST', '/api/templates', { name: 'Simpan', text: 'a\n  b' });
  p.reopen();
  assert.deepStrictEqual(p.api('GET', '/api/templates').body.templates.map(x => x.name), ['x'.repeat(60), 'Simpan']);
  assert.ok(!JSON.stringify(p.store.exportData()).includes('Simpan'));
  assert.ok(!JSON.stringify(p.store.syncFile('d')).includes('Simpan'));
  for (let i = 0; i < 48; i++) assert.strictEqual(p.api('POST', '/api/templates', { name: 'n' + i, text: 'a' }).status, 201);
  assert.strictEqual(p.api('POST', '/api/templates', { name: 'terlalu', text: 'a' }).status, 400);
  assert.strictEqual(p.api('POST', '/api/templates', { name: 'n0', text: 'ganti' }).status, 200, 'menimpa tetap boleh saat penuh');
});
