/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Lihat LICENSE dan NOTICE. */
/* Rencana notifikasi lokal (fungsi murni). */
'use strict';
const { addDays, split } = require('./dates');
const { nowLocalIso } = require('./history');

/* Daftar notifikasi lokal yang perlu dijadwalkan dari tugas aktif (fungsi murni, mudah diuji):
 *  - tugas ber-jam: satu notifikasi tepat waktu dan satu `lead` menit sebelumnya,
 *  - ringkasan harian pukul `digestHour` untuk tiap hari (sampai `days` ke depan) yang punya tugas.
 * ID notifikasi: 2*id (tepat waktu), 2*id+1 (sebelumnya), 1_000_000_000+n (ringkasan hari ke-n). */
/* opts: lead (menit, bawaan), leadFor(t) -> menit | -1 (tanpa pengingat) | undefined (pakai bawaan),
 * digestHour, evening {on, hour}. lead 0 = hanya tepat waktu; 1440 = sehari sebelumnya. */
function planReminders(tasks, now, opts) {
  const o = Object.assign({ lead: 30, digestHour: 8, days: 14, limit: 60, evening: { on: false, hour: 20 } }, opts || {});
  const at = (iso, h, m) => { const [y, mo, d] = split(iso); return new Date(y, mo - 1, d, h, m, 0, 0); };
  const out = [], sums = [];
  for (const t of tasks) {
    if (t.done || !t.deadline) continue;
    let L = typeof o.leadFor === 'function' ? o.leadFor(t) : undefined;
    if (L === undefined || L === null) L = o.lead;
    if (L < 0) continue;
    if (!t.due_time) {
      if (L === 1440) {
        const when = at(addDays(t.deadline, -1), o.digestHour, 0);
        if (when > now) out.push({ id: 2 * t.id + 1, at: when, title: 'Besok jatuh tempo', tkey: 'Besok jatuh tempo', body: t.title });
      }
      continue;
    }
    const [h, m] = t.due_time.split(':').map(Number);
    const due = at(t.deadline, h, m);
    if (due > now) out.push({ id: 2 * t.id, at: due, title: 'Jatuh tempo sekarang', tkey: 'Jatuh tempo sekarang', body: t.title });
    if (L > 0) {
      const early = new Date(due.getTime() - L * 60000);
      if (early > now) {
        out.push(L === 1440
          ? { id: 2 * t.id + 1, at: early, title: 'Besok jatuh tempo', tkey: 'Besok jatuh tempo', body: t.title }
          : { id: 2 * t.id + 1, at: early, title: 'Dalam ' + L + ' menit', tkey: 'Dalam {n} menit', tvars: { n: L }, body: t.title });
      }
    }
  }
  const todayStr = nowLocalIso(now).slice(0, 10);
  for (let n = 0; n < o.days; n++) {
    const day = addDays(todayStr, n);
    const when = at(day, o.digestHour, 0);
    if (when <= now) continue;
    const list = tasks.filter(t => !t.done && t.deadline === day);
    if (!list.length) continue;
    const names = list.slice(0, 3).map(t => t.title).join(', ');
    const more = list.length > 3 ? ', dan ' + (list.length - 3) + ' lainnya' : '';
    sums.push({ id: 1000000000 + n, at: when, title: list.length + ' tugas ' + (n === 0 ? 'hari ini' : 'pada ' + day), body: names + more });
  }
  if (o.evening && o.evening.on) {
    for (let n = 0; n < o.days; n++) {
      const day = addDays(todayStr, n);
      const when = at(day, o.evening.hour, 0);
      if (when <= now) continue;
      const list = tasks.filter(t => !t.done && t.parent_id == null && t.deadline && t.deadline <= day);
      if (!list.length) continue;
      const names = list.slice(0, 3).map(t => t.title).join(', ');
      const more = list.length > 3 ? ', dan ' + (list.length - 3) + ' lainnya' : '';
      sums.push({ id: 1000000100 + n, at: when, evening: true, title: 'Ringkasan malam', tkey: 'Ringkasan malam',
        body: list.length + ' tugas belum tuntas: ' + names + more, bkey: '{n} tugas belum tuntas: {names}', bvars: { n: list.length, names: names + more } });
    }
  }
  /* Slot terbatas: ringkasan (pagi + malam) dijatah dulu, paling banyak 20 yang terdekat, sisanya untuk pengingat tugas
   * yang terdekat. Dengan begitu banyak tugas berjam tidak menggeser ringkasan, dan ringkasan tidak menghabiskan slot tugas. */
  const byTime = (a, b) => a.at - b.at || a.id - b.id;
  sums.sort(byTime); out.sort(byTime);
  const keepSums = sums.slice(0, Math.min(20, Math.floor(o.limit / 2)));
  return keepSums.concat(out.slice(0, Math.max(0, o.limit - keepSums.length))).sort(byTime);
}

module.exports = { planReminders };
