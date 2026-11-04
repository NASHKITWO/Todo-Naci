'use strict';
const test = require('node:test');
const assert = require('node:assert');
const core = require('../src/todo-core.js');

const T = (id, over) => Object.assign({ id, title: 'Tugas ' + id, done: false, deadline: null, due_time: null }, over);
const NOW = new Date(2026, 9, 22, 10, 0, 0); // 22 Okt 2026 10:00 lokal

test('tugas ber-jam: tepat waktu dan 30 menit sebelumnya', () => {
  const plan = core.planReminders([T(1, { deadline: '2026-10-22', due_time: '14:00' })], NOW);
  const timed = plan.filter(p => p.id < 1000000000);
  assert.deepStrictEqual(timed.map(p => p.id), [3, 2]);
  assert.strictEqual(timed[0].at.getHours() * 60 + timed[0].at.getMinutes(), 13 * 60 + 30);
  assert.strictEqual(timed[1].at.getHours(), 14);
  assert.strictEqual(timed[1].title, 'Jatuh tempo sekarang');
  assert.strictEqual(timed[1].body, 'Tugas 1');
});

test('yang sudah lewat, selesai, atau tanpa jam tidak dijadwalkan (selain ringkasan)', () => {
  const plan = core.planReminders([
    T(1, { deadline: '2026-10-22', due_time: '09:00' }),
    T(2, { deadline: '2026-10-22', due_time: '14:00', done: true }),
    T(3, { deadline: '2026-10-22' }),
    T(4, { due_time: '14:00' }),
  ], NOW);
  assert.deepStrictEqual(plan.filter(p => p.id < 1000000000), []);
});

test('hanya 30 menit sebelumnya bila tinggal 20 menit lagi: cuma yang tepat waktu', () => {
  const plan = core.planReminders([T(1, { deadline: '2026-10-22', due_time: '10:20' })], NOW);
  assert.deepStrictEqual(plan.filter(p => p.id < 1000000000).map(p => p.id), [2]);
});

test('ringkasan harian 08:00: lewati hari ini bila sudah lewat jam 8, gabung banyak tugas', () => {
  const tasks = [1, 2, 3, 4, 5].map(i => T(i, { deadline: '2026-10-23' })).concat([T(9, { deadline: '2026-10-22' })]);
  const plan = core.planReminders(tasks, NOW);
  const digests = plan.filter(p => p.id >= 1000000000);
  assert.strictEqual(digests.length, 1); // hari ini 08:00 sudah lewat
  assert.strictEqual(digests[0].id, 1000000001);
  assert.strictEqual(digests[0].at.getHours(), 8);
  assert.match(digests[0].title, /^5 tugas pada 2026-10-23$/);
  assert.match(digests[0].body, /Tugas 1, Tugas 2, Tugas 3, dan 2 lainnya/);
});

test('ringkasan hari ini dijadwalkan bila sekarang sebelum 08:00', () => {
  const early = new Date(2026, 9, 22, 6, 0, 0);
  const plan = core.planReminders([T(1, { deadline: '2026-10-22' })], early);
  assert.strictEqual(plan[0].id, 1000000000);
  assert.strictEqual(plan[0].title, '1 tugas hari ini');
});

test('dibatasi 60 dan terurut menurut waktu', () => {
  const tasks = [];
  for (let i = 1; i <= 80; i++) tasks.push(T(i, { deadline: '2026-10-25', due_time: String(8 + (i % 10)).padStart(2, '0') + ':00' }));
  const plan = core.planReminders(tasks, NOW);
  assert.strictEqual(plan.length, 60);
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i - 1].at <= plan[i].at);
});

test('ID tidak bertabrakan antara jenis notifikasi', () => {
  const plan = core.planReminders([T(1, { deadline: '2026-10-23', due_time: '12:00' }), T(2, { deadline: '2026-10-23', due_time: '13:00' })], NOW);
  assert.strictEqual(new Set(plan.map(p => p.id)).size, plan.length);
});

test('pengingat per tugas: -1 mati, 0 hanya tepat waktu, 1440 sehari sebelumnya', () => {
  const tasks = [T(1, { deadline: '2026-10-24', due_time: '14:00' }), T(2, { deadline: '2026-10-24', due_time: '14:00' }),
    T(3, { deadline: '2026-10-24', due_time: '14:00' }), T(4, { deadline: '2026-10-24' })];
  const lead = { 1: -1, 2: 0, 3: 1440, 4: 1440 };
  const plan = core.planReminders(tasks, NOW, { leadFor: t => lead[t.id] }).filter(p => p.id < 1000000000);
  assert.deepStrictEqual(plan.map(p => p.id).sort((a, b) => a - b), [4, 6, 7, 9]);
  const p7 = plan.find(p => p.id === 7), p9 = plan.find(p => p.id === 9);
  assert.strictEqual(p7.at.getDate(), 23); assert.strictEqual(p7.at.getHours(), 14); assert.strictEqual(p7.title, 'Besok jatuh tempo');
  assert.strictEqual(p9.at.getDate(), 23); assert.strictEqual(p9.at.getHours(), 8);
});

test('ringkasan malam: hanya bila ada yang belum tuntas, menghitung yang terlambat, id 1000000100+n', () => {
  const tasks = [T(1, { deadline: '2026-10-21' }), T(2, { deadline: '2026-10-22' }), T(3, { deadline: '2026-10-22', done: true })];
  const plan = core.planReminders(tasks, NOW, { evening: { on: true, hour: 20 } }).filter(p => p.evening);
  assert.strictEqual(plan[0].id, 1000000100);
  assert.strictEqual(plan[0].at.getHours(), 20);
  assert.deepStrictEqual(plan[0].bvars.n, 2);
  assert.ok(plan.length >= 2); // hari berikutnya: yang terlambat masih tersisa
  assert.deepStrictEqual(core.planReminders(tasks, NOW, { evening: { on: false, hour: 20 } }).filter(p => p.evening), []);
  assert.deepStrictEqual(core.planReminders([T(1, { deadline: '2026-10-22', done: true })], NOW, { evening: { on: true, hour: 20 } }).filter(p => p.evening), []);
});

test('pengulangan hari kerja dan hari tertentu: normalisasi dan kemunculan berikutnya', () => {
  const n = core.normalizeRule;
  assert.strictEqual(n('hari kerja'), 'wd');
  assert.strictEqual(n('wd'), 'wd');
  assert.strictEqual(n('Setiap Senin dan Kamis'), 'dow:1,4');
  assert.strictEqual(n('dow:4,1,4'), 'dow:1,4');
  assert.strictEqual(n('mon,tue,wed,thu,fri'), 'wd');
  assert.strictEqual(n('sen,sel,rab,kam,jum,sab,min'), '1d');
  assert.throws(() => n('senin,foo'));
  assert.throws(() => n('dow:7'));
  // 2026-10-30 = Jumat -> hari kerja berikutnya Senin
  assert.strictEqual(core.nextOccurrence('2026-10-30', 'wd', '2026-10-30'), '2026-11-02');
  // terlambat berminggu-minggu: lompat ke hari yang cocok setelah hari ini (Sabtu 31 Okt)
  assert.strictEqual(core.nextOccurrence('2026-10-01', 'dow:1,4', '2026-10-31'), '2026-11-02');
  assert.strictEqual(core.nextOccurrence('2026-11-02', 'dow:1', '2026-10-31'), '2026-11-09');
});

test('hari tuntas: streak lebih dari 7 hari, hari ini belum selesai tidak memutus, sisa tugas memutus', () => {
  const mk = (id, over) => Object.assign({ id, title: 't' + id, done: true, parent_id: null, deadline: null, completed_at: null }, over);
  const tasks = [];
  for (let i = 0; i < 10; i++) tasks.push(mk(i + 1, { completed_at: core.addDays('2026-10-21', -i) + 'T10:00:00' })); // 12..21 Okt
  const st = core.tuntasStats(tasks, '2026-10-22'); // hari ini (22) kosong tapi tidak memutus
  assert.strictEqual(st.streak, 10);
  assert.strictEqual(st.best, 10);
  assert.ok(st.tuntas('2026-10-15') && !st.tuntas('2026-10-22'));
  // tugas masih terbuka dengan deadline 18 Okt: hari itu tidak tuntas, streak dari kemarin hanya 3 hari (19-21)
  const st2 = core.tuntasStats(tasks.concat([mk(99, { done: false, deadline: '2026-10-18' })]), '2026-10-22');
  assert.strictEqual(st2.streak, 3);
  assert.strictEqual(st2.best, 6); // 12-17
  // subtugas tidak dihitung
  assert.strictEqual(core.tuntasStats([mk(1, { parent_id: 5, completed_at: '2026-10-21T10:00:00' })], '2026-10-22').streak, 0);
  // hari ini: selesai satu tapi masih ada yang terlambat -> belum tuntas
  const st3 = core.tuntasStats([mk(1, { completed_at: '2026-10-22T09:00:00' }), mk(2, { done: false, deadline: '2026-10-20' })], '2026-10-22');
  assert.ok(!st3.tuntas('2026-10-22'));
});

test('slot terbatas: ringkasan dijatah, pengingat tugas terdekat mengisi sisanya', () => {
  const tasks = [];
  for (let i = 1; i <= 80; i++) tasks.push(T(i, { deadline: '2026-10-23', due_time: '12:00' })); // 80 tugas berjam
  tasks.push(T(900, { deadline: '2026-10-30' })); // ringkasan hari jauh
  const plan = core.planReminders(tasks, NOW, { limit: 60, evening: { on: true, hour: 20 } });
  assert.strictEqual(plan.length, 60);
  assert.ok(plan.some(p => p.id >= 1000000100), 'ringkasan malam tetap ada');
  assert.ok(plan.some(p => p.id === 1000000008), 'ringkasan pagi hari jauh tetap ada');
  assert.ok(plan.filter(p => p.id < 1000000000).length >= 38);
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i - 1].at <= plan[i].at); // tetap urut waktu
  // tanpa persaingan: perilaku lama
  assert.strictEqual(core.planReminders([T(1, { deadline: '2026-10-22', due_time: '14:00' })], NOW).filter(p => p.id < 1e9).length, 2);
});
