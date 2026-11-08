/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Lihat LICENSE dan NOTICE. */
/* Format berkas sinkron, penggabungan dua perangkat, validasi, pengaturan yang ikut disinkronkan. */
'use strict';
const { TodoError, has } = require('./base');
const { mk } = require('./dates');
const { normalizeRule } = require('./recurrence');
const { checkPriority, cleanDueTime, cleanNotes, cleanProject, cleanTags, cleanTitle } = require('./validate');

const SYNC_FIELDS = ['uid', 'parent_uid', 'title', 'notes', 'priority', 'deadline', 'due_time', 'done', 'project',
  'repeat', 'tags', 'created_at', 'completed_at', 'updated_at'];

const UID_RE = /^[0-9a-f]{8,32}$/;

const STAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;

const MAX_SYNC_TASKS = 20000;

/* Cap waktu dari perangkat dengan jam salah (jauh di masa depan) akan menang atas semua suntingan sah, jadi dijepit ke batas wajar. */
const MAX_FUTURE_MS = 36 * 3600 * 1000;
function clampStamp(s) {
  const limit = Date.now() + MAX_FUTURE_MS;
  const t = Date.parse(s);
  return Number.isFinite(t) && t > limit ? new Date(limit).toISOString() : s;
}

const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function cleanSyncRecord(rawIn, index) {
  let raw = rawIn;
  try {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TodoError('bukan objek');
    const uid = raw.uid, parent = has(raw, 'parent_uid') ? raw.parent_uid : null;
    if (typeof uid !== 'string' || !UID_RE.test(uid)) throw new TodoError('uid tidak valid');
    if (parent !== null && (typeof parent !== 'string' || !UID_RE.test(parent) || parent === uid)) throw new TodoError('parent_uid tidak valid');
    if (typeof raw.updated_at !== 'string' || !STAMP_RE.test(raw.updated_at)) throw new TodoError('updated_at tidak valid');
    raw = Object.assign({}, raw, { updated_at: clampStamp(raw.updated_at) });
    const deadline = raw.deadline == null ? null : raw.deadline;
    if (deadline !== null) {
      const m = typeof deadline === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(deadline);
      if (!m || !mk(+m[1], +m[2], +m[3])) throw new TodoError('tanggal tidak valid');
    }
    const dueTime = cleanDueTime(raw.due_time);
    if (dueTime && !deadline) throw new TodoError('jam tanpa deadline');
    const done = !!raw.done;
    if (typeof raw.created_at !== 'string' || !raw.created_at) throw new TodoError('created_at tidak valid');
    if (done && !(typeof raw.completed_at === 'string' && raw.completed_at)) throw new TodoError('completed_at tidak valid');
    let repeat = raw.repeat;
    if (repeat && parent) repeat = null;
    return { uid, parent_uid: parent, title: cleanTitle(raw.title), notes: cleanNotes(raw.notes),
      priority: checkPriority('priority' in raw ? raw.priority : 2), deadline, due_time: dueTime, done,
      project: cleanProject(raw.project), repeat: repeat ? normalizeRule(repeat) : null,
      tags: cleanTags(raw.tags).slice().sort(), created_at: raw.created_at,
      completed_at: done ? raw.completed_at : null, updated_at: raw.updated_at };
  } catch (e) {
    if (e instanceof TodoError || e instanceof TypeError || e instanceof RangeError) throw new TodoError('Tugas ke-' + index + ' di berkas sinkron tidak valid: ' + e.message);
    throw e;
  }
}

/* Pengaturan pengingat yang ikut disinkronkan (opsional; yang tidak valid diabaikan, tidak menggagalkan sinkron).
 * {at, remind: {lead, evening: {on, hour}, per: {uid: lead}}}. Versi lama aplikasi mengabaikan bidang ini. */
const REMIND_LEADS = [-1, 0, 5, 15, 30, 60, 1440];

function cleanSettings(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.at !== 'string' || !STAMP_RE.test(raw.at)) return null;
  const r = raw.remind;
  if (!r || typeof r !== 'object' || !REMIND_LEADS.includes(r.lead)) return null;
  const ev = r.evening;
  if (!ev || typeof ev.on !== 'boolean' || !Number.isInteger(ev.hour) || ev.hour < 0 || ev.hour > 23) return null;
  const per = {};
  if (r.per && typeof r.per === 'object') {
    for (const k of Object.keys(r.per).slice(0, MAX_SYNC_TASKS)) if (UID_RE.test(k) && REMIND_LEADS.includes(r.per[k])) per[k] = r.per[k];
  }
  return { at: raw.at, remind: { lead: r.lead, evening: { on: ev.on, hour: ev.hour }, per } };
}

function validateSyncFile(data) {
  if (!data || typeof data !== 'object' || data.app !== 'todo-cli' || data.kind !== 'sync') throw new TodoError('Ini bukan berkas sinkron todo-cli.');
  if (data.format !== 1) throw new TodoError('Versi format berkas sinkron tidak didukung.');
  const tasks = data.tasks, deleted = has(data, 'deleted') ? data.deleted : [];
  if (!Array.isArray(tasks) || !Array.isArray(deleted)) throw new TodoError("Berkas sinkron rusak: 'tasks' dan 'deleted' harus berupa daftar.");
  if (tasks.length > MAX_SYNC_TASKS || deleted.length > MAX_SYNC_TASKS * 5) throw new TodoError('Berkas sinkron terlalu besar.');
  const records = tasks.map((raw, i) => cleanSyncRecord(raw, i + 1));
  if (new Set(records.map(r => r.uid)).size !== records.length) throw new TodoError('Berkas sinkron berisi uid ganda.');
  const tombs = deleted.map((raw, i) => {
    if (!raw || typeof raw !== 'object' || typeof raw.uid !== 'string' || !UID_RE.test(raw.uid) ||
        typeof raw.deleted_at !== 'string' || !STAMP_RE.test(raw.deleted_at)) throw new TodoError('Penanda hapus ke-' + (i + 1) + ' di berkas sinkron tidak valid.');
    return { uid: raw.uid, deleted_at: clampStamp(raw.deleted_at) };
  });
  const out = { records, tombs }, settings = cleanSettings(data.settings);
  if (settings) out.settings = settings;
  return out;
}

function normSync(rec) {
  const o = {}; for (const k of SYNC_FIELDS) o[k] = rec[k] === undefined ? null : rec[k];
  o.tags = (o.tags || []).slice().sort(); o.done = !!o.done; return o;
}

function canonSync(rec) {
  const o = {}; for (const k of SYNC_FIELDS.slice().sort()) o[k] = rec[k];
  return JSON.stringify(o);
}

function mergeSync(localRecords, localTombs, remoteRecords, remoteTombs) {
  const L = new Map(localRecords.map(r => [r.uid, normSync(r)]));
  const R = new Map(remoteRecords.map(r => [r.uid, normSync(r)]));
  const tombs = new Map();
  for (const t of localTombs.concat(remoteTombs)) if (t.deleted_at > (tombs.get(t.uid) || '')) tombs.set(t.uid, t.deleted_at);
  const final = new Map();
  const all = new Set(Array.from(L.keys()).concat(Array.from(R.keys())));
  for (const uid of all) {
    let rec;
    if (L.has(uid) && R.has(uid)) {
      const a = L.get(uid), b = R.get(uid);
      const c = cmpStr(a.updated_at, b.updated_at) || cmpStr(canonSync(a), canonSync(b));
      rec = c >= 0 ? a : b;
    } else rec = L.get(uid) || R.get(uid);
    if (tombs.has(uid) && tombs.get(uid) >= rec.updated_at) continue;
    final.set(uid, rec);
  }
  for (const uid of Array.from(final.keys()).sort()) {
    const parent = final.get(uid).parent_uid;
    if (parent !== null && (!final.has(parent) || final.get(parent).parent_uid !== null)) {
      if (!final.has(parent) && tombs.has(parent)) {
        // Induk dihapus di perangkat lain, tetapi subtugas ini dibuat/diubah sesudahnya: angkat jadi tugas biasa, jangan buang
        // isinya diam-diam. Cap waktu diturunkan dari data (bukan jam), jadi semua perangkat menghitung hasil yang sama, dan
        // rekaman ini lebih baru daripada versi lamanya sehingga menang saat digabung ulang.
        const rec = final.get(uid), base = Math.max(Date.parse(rec.updated_at), Date.parse(tombs.get(parent)));
        final.set(uid, Object.assign({}, rec, { parent_uid: null, updated_at: new Date(base + 1).toISOString() }));
        continue;
      }
      final.delete(uid); // induk tidak dikenal / bertingkat: dibuang tanpa penanda hapus (sama dengan sync.py)
    }
  }
  const same = (a, b) => canonSync(a) === canonSync(b);
  const uids = Array.from(final.keys()).sort();
  return {
    tasks: uids.map(u => final.get(u)),
    deleted: Array.from(tombs.keys()).sort().map(u => ({ uid: u, deleted_at: tombs.get(u) })),
    upsert: uids.filter(u => !L.has(u) || !same(L.get(u), final.get(u))).map(u => final.get(u)),
    delete: Array.from(L.keys()).filter(u => !final.has(u)).sort(),
  };
}

module.exports = { SYNC_FIELDS, UID_RE, STAMP_RE, MAX_SYNC_TASKS, cmpStr, cleanSyncRecord, REMIND_LEADS, cleanSettings, validateSyncFile, normSync, canonSync, mergeSync };
