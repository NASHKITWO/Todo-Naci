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
