/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Lihat LICENSE dan NOTICE. */
/* Riwayat hari tuntas dan snapshot harian. */
'use strict';
const { pad2 } = require('./base');
const { addDays } = require('./dates');
const { cmpStr } = require('./sync');

/* Riwayat "hari tuntas" dari data tugas (tanpa menambah bidang apa pun). Hari tuntas = ada tugas utama yang selesai hari itu
 * dan tidak ada tugas utama yang masih terbuka dengan deadline hari itu (untuk hari ini: juga tidak ada yang terlambat).
 * Hasil: {done: {hari: jumlah selesai}, left: {hari: jumlah terbuka}, tuntas(hari) -> bool, streak, best}. */
function tuntasStats(tasks, today) {
  const done = {}, left = {};
  let overdue = 0, first = null;
  for (const t of tasks) {
    if (t.parent_id != null) continue;
    if (t.done && t.completed_at) {
      const d = t.completed_at.slice(0, 10);
      done[d] = (done[d] || 0) + 1;
      if (!first || d < first) first = d;
    } else if (!t.done && t.deadline) {
      left[t.deadline] = (left[t.deadline] || 0) + 1;
      if (t.deadline < today) overdue++;
    }
  }
  const tuntas = d => !!done[d] && !left[d] && (d !== today || overdue === 0);
  let best = 0, run = 0;
  if (first) for (let d = first; d <= today; d = addDays(d, 1)) { run = tuntas(d) ? run + 1 : 0; if (run > best) best = run; }
  let streak = 0;
  for (let d = tuntas(today) ? today : addDays(today, -1); tuntas(d); d = addDays(d, -1)) streak++;
  return { done, left, tuntas, streak, best };
}

function nowLocalIso(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' +
    pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
}

/* Snapshot harian di perangkat. list: [{day, at, state}] (terlama dulu); state: {tasks, deleted} (isi berkas sinkron).
 * Dibuat paling banyak satu per hari, hanya bila ada isinya dan berbeda dari snapshot terakhir; simpan `keep` terbaru. */
function snapshotKey(state) {
  const byUid = (a, b) => cmpStr(a.uid, b.uid);
  return JSON.stringify([state.tasks.slice().sort(byUid), state.deleted.slice().sort(byUid)]);
}

function rotateSnapshots(list, state, now, keep) {
  const day = String(now).slice(0, 10);
  const empty = !state.tasks.length;
  const last = list.length ? list[list.length - 1] : null;
  if (empty || list.some(s => s.day === day) || (last && snapshotKey(last.state) === snapshotKey(state))) {
    return { list, created: false };
  }
  const next = list.concat([{ day, at: now, state: { tasks: state.tasks, deleted: state.deleted } }]);
  return { list: next.slice(-(keep || 7)), created: true };
}

module.exports = { tuntasStats, nowLocalIso, snapshotKey, rotateSnapshots };
