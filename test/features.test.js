'use strict';
// Fitur v0.10: daftar widget, snapshot harian + pemulihan, dan sinkron otomatis (Gist palsu, dua "ponsel").
const test = require('node:test');
const assert = require('node:assert');
const core = require('../src/todo-core.js');
const auto = require('../src/autosync.js');

const clone = v => JSON.parse(JSON.stringify(v));
let tick = 0; // satu garis waktu bersama: stempel selalu naik, di perangkat mana pun
const stampNext = () => new Date(Date.UTC(2026, 5, 1, 10, 0, 0) + (tick++) * 1000).toISOString();

function phone(today) {
  let data = null;
  const clock = { today: () => today || '2026-06-10', now: () => (today || '2026-06-10') + 'T09:00:00', stamp: stampNext };
  const store = new core.Store({ load: () => data, save: o => { data = clone(o); } }, clock);
  const api = (m, p, b) => core.handle(store, m, p, b || {});
  const add = (title, extra) => api('POST', '/api/tasks', Object.assign({ title }, extra)).body.task;
  const titles = () => store.listAll().map(t => t.title).sort();
  return { store, api, add, titles };
}

// ---------------- widget ----------------
test('widget: hanya tugas induk aktif yang jatuh tempo ≤ 3 hari, urut tanggal → jam → prioritas', () => {
  const p = phone('2026-06-10');
  p.add('besok', { deadline: '2026-06-11' });
  p.add('kemarin', { deadline: '2026-06-09', priority: 'low' });
  p.add('hari ini siang', { deadline: '2026-06-10', due_time: '13:00' });
  p.add('hari ini pagi', { deadline: '2026-06-10', due_time: '08:00' });
  p.add('hari ini tanpa jam tinggi', { deadline: '2026-06-10', priority: 'high' });
  p.add('hari ini tanpa jam rendah', { deadline: '2026-06-10', priority: 'low' });
  p.add('tanpa tanggal');
  p.add('jauh', { deadline: '2026-06-20' });
  const selesai = p.add('selesai', { deadline: '2026-06-10' });
  p.api('POST', '/api/tasks/' + selesai.id + '/done');
  const induk = p.add('induk', { deadline: '2026-06-10', due_time: '23:00' });
  p.add('anak', { parent_id: induk.id, deadline: '2026-06-10' });
  const got = p.store.widgetItems();
  assert.deepStrictEqual(got.map(i => i.t), ['kemarin', 'hari ini pagi', 'hari ini siang', 'induk',
    'hari ini tanpa jam tinggi', 'hari ini tanpa jam rendah', 'besok']);
  assert.deepStrictEqual(got[0], { t: 'kemarin', u: p.store.listAll().length ? got[0].u : '', d: '2026-06-09', h: '', p: 3 });
  assert.match(got[0].u, /^[0-9a-f]{16}$/);
  assert.deepStrictEqual(Object.assign({}, got[1], { u: 'x' }), { t: 'hari ini pagi', u: 'x', d: '2026-06-10', h: '08:00', p: 2 });
  assert.strictEqual(p.store.widgetItems(0).length, 6); // horizon 0: tanpa "besok"
});

test('widget: batas jumlah dan judul panjang dipotong', () => {
  const p = phone('2026-06-10');
  for (let i = 0; i < 40; i++) p.add('t' + i, { deadline: '2026-06-10' });
  assert.strictEqual(p.store.widgetItems().length, 30);
  assert.strictEqual(p.store.widgetItems(3, 5).length, 5);
  const q = phone('2026-06-10');
  q.add('x'.repeat(200), { deadline: '2026-06-10' }).id;
  assert.strictEqual(Array.from(q.store.widgetItems()[0].t).length, 80);
});

// ---------------- snapshot ----------------
const state = (...titles) => ({ tasks: titles.map(t => ({ uid: t, title: t })), deleted: [] });

test('snapshot: satu per hari, tidak untuk data kosong atau yang sama persis, simpan 7 terbaru', () => {
  let r = core.rotateSnapshots([], state(), '2026-06-01T08:00:00', 7);
  assert.deepStrictEqual(r, { list: [], created: false }); // kosong
  r = core.rotateSnapshots(r.list, state('a'), '2026-06-01T08:00:00', 7);
  assert.strictEqual(r.created, true);
  assert.strictEqual(r.list[0].day, '2026-06-01');
  const again = core.rotateSnapshots(r.list, state('a', 'b'), '2026-06-01T20:00:00', 7);
  assert.strictEqual(again.created, false); // sudah ada untuk hari itu
  const same = core.rotateSnapshots(r.list, state('a'), '2026-06-02T08:00:00', 7);
  assert.strictEqual(same.created, false); // sama dengan yang terakhir
  let list = r.list;
  for (let d = 2; d <= 12; d++) {
    const x = core.rotateSnapshots(list, state('a', 'v' + d), '2026-06-' + String(d).padStart(2, '0') + 'T08:00:00', 7);
    assert.strictEqual(x.created, true); list = x.list;
  }
  assert.strictEqual(list.length, 7);
  assert.strictEqual(list[0].day, '2026-06-06');
  assert.strictEqual(list[6].day, '2026-06-12');
});

test('snapshot: urutan tugas tidak dianggap perubahan', () => {
  const a = { tasks: [{ uid: 'b' }, { uid: 'a' }], deleted: [] }, b = { tasks: [{ uid: 'a' }, { uid: 'b' }], deleted: [] };
  const r = core.rotateSnapshots([], a, '2026-06-01T00:00:00');
  assert.strictEqual(core.rotateSnapshots(r.list, b, '2026-06-02T00:00:00').created, false);
});

test('pulihkan snapshot: daftar persis sama, termasuk tugas yang sudah dihapus dan perubahan yang dibatalkan', () => {
  const p = phone();
  const a = p.add('susu'), b = p.add('roti', { deadline: '2026-06-12' });
  const snap = clone(p.store.syncFile('snapshot'));
  p.api('DELETE', '/api/tasks/' + a.id);
  p.api('PATCH', '/api/tasks/' + b.id, { title: 'roti gandum' });
  p.add('baru');
  assert.deepStrictEqual(p.titles(), ['baru', 'roti gandum']);
  assert.deepStrictEqual(p.store.restoreSnapshot(snap), { restored: 2, removed: 1 });
  assert.deepStrictEqual(p.titles(), ['roti', 'susu']);
  assert.strictEqual(p.store.listAll().find(t => t.title === 'roti').deadline, '2026-06-12');
  // tombstone tugas yang dibuang, dan tugas yang dipulihkan tidak lagi punya nisan
  const f = p.store.syncFile('x');
  assert.strictEqual(f.deleted.length, 1);
  assert.ok(!f.deleted.some(d => f.tasks.some(t => t.uid === d.uid)));
});

test('pulihkan snapshot menang atas perangkat lain saat sinkron (tugas yang dihapus hidup lagi)', () => {
  const a = phone(), b = phone();
  const t = a.add('penting');
  const snap = clone(a.store.syncFile('s'));
  b.store.syncWith(a.store.syncFile('a'));
  a.api('DELETE', '/api/tasks/' + t.id);
  b.store.syncWith(a.store.syncFile('a'));
  assert.deepStrictEqual(b.titles(), []);
  a.store.restoreSnapshot(snap);
  b.store.syncWith(a.store.syncFile('a'));
  assert.deepStrictEqual(b.titles(), ['penting']);
  a.store.syncWith(b.store.syncFile('b'));
  assert.deepStrictEqual(a.titles(), ['penting']);
});

test('pulihkan snapshot rusak ditolak dan data tidak berubah', () => {
  const p = phone();
  p.add('tetap');
  assert.throws(() => p.store.restoreSnapshot({ app: 'todo-cli', tasks: [] }), /bukan berkas sinkron/);
  assert.deepStrictEqual(p.titles(), ['tetap']);
});

// ---------------- sinkron otomatis (Gist palsu) ----------------
function fakeGithub(opts) {
  opts = opts || {};
  const gists = []; // {id, files:{name:{content}}}
  const calls = [];
  let n = 0;
  const reply = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => clone(body) });
  const fetchFn = async (url, init) => {
    calls.push((init.method || 'GET') + ' ' + url.replace('https://api.github.com', ''));
    if (opts.delay) await new Promise(r => setTimeout(r, Math.floor(Math.random() * opts.delay)));
    if (opts.offline) throw new TypeError('Failed to fetch');
    assert.ok(url.startsWith('https://api.github.com/'), url);
    if (init.headers.Authorization !== 'Bearer ' + (opts.token || 'tok')) return reply(401, {});
    const path = url.replace('https://api.github.com', '');
    const body = init.body ? JSON.parse(init.body) : null;
    const applyFiles = (g, files) => { for (const [k, v] of Object.entries(files)) { if (v === null) delete g.files[k]; else g.files[k] = v; } };
    if (init.method === 'GET' && path.startsWith('/gists?')) return reply(200, gists.slice().reverse().map(g => ({ id: g.id, files: Object.fromEntries(Object.keys(g.files).map(k => [k, {}])) })));
    if (init.method === 'POST' && path === '/gists') {
      assert.strictEqual(body.public, false);
      const g = { id: 'g' + (++n), files: {} }; applyFiles(g, body.files); gists.push(g); return reply(201, { id: g.id });
    }
    const m = /^\/gists\/(\w+)$/.exec(path);
    const g = m && gists.find(x => x.id === m[1]);
    if (!g) return reply(404, {});
    if (init.method === 'GET') return reply(200, { id: g.id, files: Object.fromEntries(Object.entries(g.files).map(([k, v]) => [k, { content: v.content, truncated: !!opts.truncated }])) });
    if (init.method === 'PATCH') { applyFiles(g, body.files); return reply(200, { id: g.id }); }
    return reply(405, {});
  };
  return { fetchFn, gists, calls };
}
const PASS = 'kata sandi uji';
const cfgOf = (id, extra) => Object.assign({ token: 'tok', deviceId: id, passphrase: PASS }, extra);
const run = (store, cfg, gh) => auto.run(store, cfg, gh.fetchFn);

test('sinkron otomatis: gist dibuat, perangkat kedua menemukannya hanya dengan token, perubahan & hapus menyebar', async () => {
  const gh = fakeGithub();
  const a = phone(), b = phone();
  const cfgA = cfgOf('aaaa'), cfgB = cfgOf('bbbb');
  a.add('susu'); a.add('roti');
  let r = await run(a.store, cfgA, gh);
  assert.strictEqual(r.created, true); assert.strictEqual(r.pushed, true);
  cfgA.gistId = r.gistId;
  assert.deepStrictEqual(Object.keys(gh.gists[0].files), ['todo-sync-aaaa.json']);
  // perangkat kedua tidak tahu id gist
  r = await run(b.store, cfgB, gh);
  assert.deepStrictEqual(r.summary, { added: 2, updated: 0, deleted: 0 });
  assert.strictEqual(r.gistId, cfgA.gistId);
  assert.strictEqual(r.pushed, true); // menulis berkasnya sendiri
  cfgB.gistId = r.gistId;
  assert.deepStrictEqual(Object.keys(gh.gists[0].files).sort(), ['todo-sync-aaaa.json', 'todo-sync-bbbb.json']);
  assert.deepStrictEqual(b.titles(), ['roti', 'susu']);
  // B mengubah dan menambah → A menerima
  b.api('PATCH', '/api/tasks/' + b.store.listAll().find(t => t.title === 'roti').id, { title: 'roti gandum' });
  b.add('dari b');
  await run(b.store, cfgB, gh);
  r = await run(a.store, cfgA, gh);
  assert.deepStrictEqual(r.summary, { added: 1, updated: 1, deleted: 0 });
  assert.deepStrictEqual(a.titles(), ['dari b', 'roti gandum', 'susu']);
  // A menghapus → B ikut terhapus
  a.api('DELETE', '/api/tasks/' + a.store.listAll().find(t => t.title === 'susu').id);
  await run(a.store, cfgA, gh);
  r = await run(b.store, cfgB, gh);
  assert.strictEqual(r.summary.deleted, 1);
  assert.deepStrictEqual(b.titles(), ['dari b', 'roti gandum']);
});

test('sinkron otomatis: isi di gist terenkripsi — judul tugas dan token tidak terbaca, kata sandi salah ditolak', async () => {
  const gh = fakeGithub();
  const a = phone(), b = phone();
  a.add('Rahasia: hasil lab dokter');
  const cfgA = cfgOf('aaaa');
  cfgA.gistId = (await run(a.store, cfgA, gh)).gistId;
  const dump = JSON.stringify(gh.gists);
  assert.ok(!dump.includes('Rahasia') && !dump.includes('hasil lab') && !dump.includes('"tok"') && !dump.includes('Bearer') && !dump.includes(PASS), 'isi gist harus terenkripsi');
  const env = JSON.parse(gh.gists[0].files['todo-sync-aaaa.json'].content);
  assert.strictEqual(env.kind, 'sync-enc');
  // kata sandi salah: ditolak, data lokal tidak tersentuh, dan tidak menulis berkas apa pun
  b.add('milik b');
  await assert.rejects(run(b.store, cfgOf('bbbb', { passphrase: 'salah' }), gh), e => e.code === 'password');
  assert.deepStrictEqual(b.titles(), ['milik b']);
  assert.deepStrictEqual(Object.keys(gh.gists[0].files), ['todo-sync-aaaa.json']);
  // tanpa kata sandi juga ditolak
  await assert.rejects(run(b.store, cfgOf('bbbb', { passphrase: '' }), gh), e => e.code === 'password');
  // kata sandi benar
  await run(b.store, cfgOf('bbbb'), gh);
  assert.deepStrictEqual(b.titles(), ['Rahasia: hasil lab dokter', 'milik b']);
});

test('sinkron otomatis: berkas terenkripsi yang diubah (dirusak) ditolak oleh GCM', async () => {
  const gh = fakeGithub();
  const a = phone(), b = phone();
  a.add('x');
  await run(a.store, cfgOf('aaaa'), gh);
  const f = gh.gists[0].files['todo-sync-aaaa.json'];
  const env = JSON.parse(f.content);
  const raw = Buffer.from(env.data, 'base64'); raw[3] ^= 1; env.data = raw.toString('base64');
  f.content = JSON.stringify(env);
  await assert.rejects(run(b.store, cfgOf('bbbb'), gh), e => e.code === 'password');
  assert.deepStrictEqual(b.titles(), []);
});

test('sinkron otomatis: berkas teks polos lama (todo-sync.json) digabung lalu dihapus saat memakai kata sandi', async () => {
  const gh = fakeGithub();
  const old = phone(); old.add('dari versi lama');
  gh.gists.push({ id: 'g7', files: { 'todo-sync.json': { content: JSON.stringify(old.store.syncFile('lama')) } } });
  const p = phone();
  await run(p.store, cfgOf('cccc', { gistId: 'g7' }), gh);
  assert.deepStrictEqual(p.titles(), ['dari versi lama']);
  assert.deepStrictEqual(Object.keys(gh.gists[0].files), ['todo-sync-cccc.json']);
});

test('sinkron otomatis: tanpa kata sandi tetap bisa (teks polos), tapi tidak membaca berkas terenkripsi', async () => {
  const gh = fakeGithub();
  const a = phone(); a.add('polos');
  const cfg = { token: 'tok', deviceId: 'aaaa' };
  await run(a.store, cfg, gh);
  assert.ok(JSON.parse(gh.gists[0].files['todo-sync-aaaa.json'].content).tasks[0].title === 'polos');
  const b = phone(); b.add('b');
  await run(b.store, cfgOf('bbbb', { gistId: gh.gists[0].id }), gh); // b memakai kata sandi: gabung berkas polos a, tulis terenkripsi
  const c = phone();
  await assert.rejects(run(c.store, { token: 'tok', deviceId: 'cccc' }, gh), e => e.code === 'password');
});

test('sinkron otomatis: putaran berulang tanpa perubahan tidak menulis ke GitHub (idempoten)', async () => {
  const gh = fakeGithub();
  const a = phone(), b = phone();
  a.add('satu');
  const gistId = (await run(a.store, cfgOf('aaaa'), gh)).gistId;
  await run(b.store, cfgOf('bbbb', { gistId }), gh);
  await run(a.store, cfgOf('aaaa', { gistId }), gh);
  gh.calls.length = 0;
  for (const [s, id] of [[a, 'aaaa'], [b, 'bbbb'], [a, 'aaaa'], [b, 'bbbb']]) {
    const r = await run(s.store, cfgOf(id, { gistId }), gh);
    assert.strictEqual(r.pushed, false, id);
    assert.deepStrictEqual(r.summary, { added: 0, updated: 0, deleted: 0 });
  }
  assert.ok(gh.calls.every(c => c.startsWith('GET ')), gh.calls.join(', '));
});

test('sinkron otomatis: dua perangkat menulis BERSAMAAN tidak saling menimpa (berkas terpisah) dan konvergen', async () => {
  for (let round = 0; round < 8; round++) {
    const gh = fakeGithub({ delay: 6 });
    const a = phone(), b = phone();
    a.add('awal');
    const gistId = (await run(a.store, cfgOf('aaaa'), gh)).gistId;
    await run(b.store, cfgOf('bbbb', { gistId }), gh);
    a.add('dari a ' + round); b.add('dari b ' + round);
    await Promise.all([run(a.store, cfgOf('aaaa', { gistId }), gh), run(b.store, cfgOf('bbbb', { gistId }), gh)]);
    // kedua tulisan selamat di gist walau berjalan bersamaan: tiap perangkat punya berkasnya sendiri
    assert.deepStrictEqual(Object.keys(gh.gists[0].files).sort(), ['todo-sync-aaaa.json', 'todo-sync-bbbb.json']);
    for (const [s, id] of [[a, 'aaaa'], [b, 'bbbb'], [a, 'aaaa']]) await run(s.store, cfgOf(id, { gistId }), gh);
    assert.deepStrictEqual(a.titles(), ['awal', 'dari a ' + round, 'dari b ' + round]);
    assert.deepStrictEqual(b.titles(), a.titles());
  }
});

test('tugas berulang diselesaikan di dua perangkat sebelum sinkron: tugas berikutnya tidak ganda', () => {
  const a = phone(), b = phone();
  const t = a.add('siram tanaman', { deadline: '2026-06-10', repeat: 'daily' });
  b.store.syncWith(a.store.syncFile('a'));
  a.api('POST', '/api/tasks/' + t.id + '/done');
  const bid = b.store.listAll().find(x => x.title === 'siram tanaman').id;
  b.api('POST', '/api/tasks/' + bid + '/done');
  a.store.syncWith(b.store.syncFile('b')); b.store.syncWith(a.store.syncFile('a'));
  a.store.syncWith(b.store.syncFile('b'));
  const open = x => x.store.listAll().filter(k => !k.done);
  assert.strictEqual(open(a).length, 1);
  assert.strictEqual(open(b).length, 1);
  assert.strictEqual(a.store.listAll().length, 2);
  assert.deepStrictEqual(a.store.syncFile('x').tasks.map(r => r.uid).sort(), b.store.syncFile('x').tasks.map(r => r.uid).sort());
  assert.ok(open(a)[0].repeat); // yang berikutnya tetap berulang
});

test('uid turunan: stabil, berbeda antar tugas, dan rantai berulang tetap unik', () => {
  assert.strictEqual(core.derivedUid('abc', 'next'), core.derivedUid('abc', 'next'));
  assert.notStrictEqual(core.derivedUid('abc', 'next'), core.derivedUid('abd', 'next'));
  assert.match(core.derivedUid('abc', 'next'), /^[0-9a-f]{16}$/);
  const p = phone();
  const t = p.add('rutin', { deadline: '2026-06-10', repeat: 'daily' });
  const seen = new Set([p.store.row(t.id).uid]);
  let id = t.id;
  for (let i = 0; i < 5; i++) {
    const r = p.api('POST', '/api/tasks/' + id + '/done').body;
    id = r.next && r.next.id;
    assert.ok(id, 'tugas berikutnya dibuat');
    const uid = p.store.row(id).uid;
    assert.ok(!seen.has(uid)); seen.add(uid);
  }
});

test('sinkron otomatis: kesalahan dikenali (token salah, offline, gist hilang, isi rusak, terlalu besar, tanpa token)', async () => {
  const p = phone(); p.add('x');
  const code = async (cfg, gh) => { try { await run(p.store, cfg, gh); } catch (e) { assert.ok(e instanceof auto.SyncError); return e.code; } return 'ok'; };
  assert.strictEqual(await code(cfgOf('p', { token: 'salah' }), fakeGithub()), 'auth');
  assert.strictEqual(await code(cfgOf('p'), fakeGithub({ offline: true })), 'network');
  assert.strictEqual(await code(cfgOf('p', { gistId: 'tidakada' }), fakeGithub()), 'notfound');
  assert.strictEqual(await code({ deviceId: 'p' }, fakeGithub()), 'config');
  const bad = fakeGithub(); bad.gists.push({ id: 'g9', files: { 'todo-sync-zzzz.json': { content: '{bukan json' } } });
  assert.strictEqual(await code(cfgOf('p', { gistId: 'g9' }), bad), 'format');
  const wrong = fakeGithub(); wrong.gists.push({ id: 'g9', files: { 'todo-sync-zzzz.json': { content: '{"app":"lain"}' } } });
  assert.strictEqual(await code(cfgOf('p', { gistId: 'g9' }), wrong), 'format');
  const broken = fakeGithub(); broken.gists.push({ id: 'g9', files: { 'todo-sync-zzzz.json': { content: '{"kind":"sync-enc","iter":5}' } } });
  assert.strictEqual(await code(cfgOf('p', { gistId: 'g9' }), broken), 'format');
  for (const iter of [0, 5000000, 'banyak']) {
    const dos = fakeGithub(); dos.gists.push({ id: 'g9', files: { 'todo-sync-zzzz.json': { content: JSON.stringify({ kind: 'sync-enc', iter, salt: 'AAAA', iv: 'AAAA', data: 'AAAA' }) } } });
    assert.strictEqual(await code(cfgOf('p', { gistId: 'g9' }), dos), 'format', 'iter ' + iter);
  }
  const big = fakeGithub({ truncated: true }); big.gists.push({ id: 'g9', files: { 'todo-sync-zzzz.json': { content: '{}' } } });
  assert.strictEqual(await code(cfgOf('p', { gistId: 'g9' }), big), 'size');
  assert.deepStrictEqual(p.titles(), ['x']); // data lokal utuh setelah semua kegagalan
});

test('sinkron otomatis: gist berisi berkas lain tidak disentuh; atur ulang menghapus hanya berkas sinkron', async () => {
  const gh = fakeGithub(); gh.gists.push({ id: 'g1', files: { 'catatan.txt': { content: 'hai' } } });
  const p = phone(); p.add('x');
  const r = await run(p.store, cfgOf('aaaa', { gistId: 'g1' }), gh);
  assert.strictEqual(r.pushed, true);
  assert.deepStrictEqual(Object.keys(gh.gists[0].files).sort(), ['catatan.txt', 'todo-sync-aaaa.json']);
  assert.strictEqual(await auto.reset(cfgOf('aaaa', { gistId: 'g1' }), gh.fetchFn), 1);
  assert.deepStrictEqual(Object.keys(gh.gists[0].files), ['catatan.txt']);
  assert.strictEqual(await auto.reset(cfgOf('aaaa', { gistId: 'g1' }), gh.fetchFn), 0);
  // setelah diatur ulang, kata sandi baru bisa dipakai di perangkat lain
  await run(p.store, cfgOf('aaaa', { gistId: 'g1', passphrase: 'baru' }), gh);
  const q = phone();
  await run(q.store, cfgOf('bbbb', { gistId: 'g1', passphrase: 'baru' }), gh);
  assert.deepStrictEqual(q.titles(), ['x']);
});
