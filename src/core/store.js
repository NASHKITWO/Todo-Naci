/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Lihat LICENSE dan NOTICE. */
/* Penyimpanan tugas (kelas Store): CRUD, subtugas, sampah, templat, pengingat. */
'use strict';
const { TodoError } = require('./base');
const { addDays, mk } = require('./dates');
const { nextOccurrence, normalizeRule } = require('./recurrence');
const { checkPriority, cleanDueTime, cleanNotes, cleanProject, cleanTags, cleanTitle } = require('./validate');
const { parseBulk } = require('./quick');
const { EPOCH, EXPORT_KEYS, MAX_TEMPLATES, SCHEMA_VERSION, TRASH_DAYS, TRASH_MAX, derivedUid, nowIso, randomUid, stampNow, todayIso } = require('./ids');
const { MAX_SYNC_TASKS, cmpStr, mergeSync, validateSyncFile } = require('./sync');

class Store {
  /* persist: {load(): objek|null, save(objek)}; clock: {today(), now()} (untuk tes). */
  constructor(persist, clock) {
    this.persist = persist || { load: () => null, save: () => {} };
    this.clock = clock || { today: todayIso, now: nowIso };
    const data = this.persist.load();
    this.tasks = data && Array.isArray(data.tasks) ? data.tasks : [];
    this.tombs = data && Array.isArray(data.tombs) ? data.tombs : [];
    for (const t of this.tasks) { // data dari versi lama: beri identitas sinkron
      if (!t.uid) t.uid = randomUid();
      if (!t.updated_at) t.updated_at = EPOCH;
    }
    this.nextId = data && Number.isInteger(data.nextId) ? data.nextId : 1 + this.tasks.reduce((a, t) => Math.max(a, t.id), 0);
    // Sampah lokal (tidak ikut sinkron): [{id, batch, at, parent_uid, rows:[baris tugas]}]
    this.trash = data && Array.isArray(data.trash) ? data.trash.filter(e => e && Array.isArray(e.rows) && e.rows.length && typeof e.at === 'string') : [];
    this.trashSeq = data && Number.isInteger(data.trashSeq) ? data.trashSeq : 1 + this.trash.reduce((a, e) => Math.max(a, e.id || 0, e.batch || 0), 0);
    this.purgeOldTrash();
    // Templat tugas (lokal, tidak ikut sinkron): [{id, name, text}]
    this.templates = data && Array.isArray(data.templates) ? data.templates.filter(x => x && typeof x.name === 'string' && typeof x.text === 'string' && Number.isInteger(x.id)) : [];
    // v0.13: templat tanpa simbol. Sekali jalan, templat lama diubah jadi judul biasa (tanggal relatif dibuang); ditandai agar tidak diulang.
    this.tplPlain = !!(data && data.tplPlain);
    if (!this.tplPlain) {
      for (const t of this.templates) {
        if (!/(^|\s)[!^@#*]\S/.test(t.text)) continue;
        try {
          t.text = parseBulk(t.text, '2000-01-01').map(p => (p.sub ? '  ' : '') + (p.done ? '- [x] ' : '') + p.title).join('\n');
        } catch (e) { /* teks tak terurai: biarkan apa adanya */ }
      }
      this.tplPlain = true;
    }
  }
  /* Salinan keadaan untuk membatalkan perubahan bila penyimpanan gagal (memori tidak boleh berbeda dari yang tersimpan). */
  snapshotState() { return JSON.stringify({ nextId: this.nextId, tasks: this.tasks, tombs: this.tombs, trash: this.trash, trashSeq: this.trashSeq, templates: this.templates, tplPlain: this.tplPlain }); }
  restoreState(s) { const d = JSON.parse(s); this.nextId = d.nextId; this.tasks = d.tasks; this.tombs = d.tombs; this.trash = d.trash; this.trashSeq = d.trashSeq; this.templates = d.templates; this.tplPlain = d.tplPlain; }
  save() { this.persist.save({ version: SCHEMA_VERSION, nextId: this.nextId, tasks: this.tasks, tombs: this.tombs, trash: this.trash, trashSeq: this.trashSeq, templates: this.templates, tplPlain: this.tplPlain }); }

  // ---- templat ----
  saveTemplate(name, text) {
    const old = this.templates.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (old) { old.text = text; old.name = name; this.save(); return { template: old, created: false }; }
    if (this.templates.length >= MAX_TEMPLATES) throw new TodoError('Templat sudah terlalu banyak (maksimal ' + MAX_TEMPLATES + ').');
    const t = { id: 1 + this.templates.reduce((a, x) => Math.max(a, x.id), 0), name, text };
    this.templates.push(t); this.save();
    return { template: t, created: true };
  }
  deleteTemplate(id) {
    const n = this.templates.length;
    this.templates = this.templates.filter(x => x.id !== id);
    if (this.templates.length === n) return false;
    this.save(); return true;
  }
  /* Buat tugas dari hasil parseBulk. `df`: bawaan (deadline/project/tags) untuk baris tingkat atas. */
  addPlan(plan, df) {
    df = df || {};
    const ids = [];
    let parent = null;
    for (const p of plan) {
      const top = !p.sub;
      const tags = top ? p.tags.concat((df.tags || []).filter(t => !p.tags.includes(t))) : p.tags;
      const deadline = p.deadline || (top ? df.deadline : null) || null;
      const id = this.add({
        title: p.title, priority: p.priority || (top ? df.priority : null) || 2, deadline,
        due_time: p.due_time || (top && deadline ? df.due_time : null) || null,
        project: p.project || (top ? df.project : null) || null, tags, repeat: p.repeat || (top ? df.repeat : null) || null, parent_id: top ? null : parent,
      });
      if (top) parent = id;
      if (p.done) this.setDone(id, true, this.clock.today());
      ids.push(id);
    }
    return ids;
  }

  // ---- sampah (30 hari) ----
  purgeOldTrash() {
    const cutoff = addDays(this.clock.today(), -TRASH_DAYS);
    this.trash = this.trash.filter(e => e.at.slice(0, 10) >= cutoff);
    if (this.trash.length > TRASH_MAX) this.trash = this.trash.slice(this.trash.length - TRASH_MAX);
  }
  /* Simpan tugas `root` beserta subtugasnya ke sampah. Mengembalikan jumlah baris. */
  toTrash(root, batch) {
    const rows = this.tasks.filter(t => t.id === root.id || t.parent_id === root.id).map(t => JSON.parse(JSON.stringify(t)));
    const parent = root.parent_id == null ? null : this.row(root.parent_id);
    this.trash.push({ id: this.trashSeq++, batch, at: this.stamp(), parent_uid: parent ? parent.uid : null, rows });
    return rows.length;
  }
  trashList() {
    return this.trash.slice().sort((a, b) => b.id - a.id).map(e => {
      const root = e.rows[0];
      return { id: e.id, batch: e.batch, title: root.title, deleted_at: e.at, subs: e.rows.length - 1,
        project: root.project, priority: root.priority, deadline: root.deadline, done: !!root.done };
    });
  }
  latestBatch() { return this.trash.reduce((a, e) => Math.max(a, e.batch), 0); }
  /* Pulihkan entri sampah (menurut id atau batch). Mengembalikan jumlah tugas yang kembali. */
  restoreTrash(sel) {
    const ids = new Set(sel.ids || []);
    const picked = this.trash.filter(e => ids.has(e.id) || (sel.batch != null && e.batch === sel.batch)).sort((a, b) => a.id - b.id);
    if (!picked.length) return 0;
    const have = new Set(this.tasks.map(t => t.uid));
    let count = 0;
    for (const e of picked) {
      const root = e.rows[0];
      if (have.has(root.uid)) continue;
      const parent = e.parent_uid ? this.tasks.find(t => t.uid === e.parent_uid) : null;
      const newRoot = this.reinstate(root, parent ? parent.id : null);
      have.add(root.uid); count++;
      for (const k of e.rows.slice(1)) { if (have.has(k.uid)) continue; this.reinstate(k, newRoot.id); have.add(k.uid); count++; }
    }
    const gone = new Set(picked.map(e => e.id));
    this.trash = this.trash.filter(e => !gone.has(e.id));
    this.save();
    return count;
  }
  reinstate(row, parentId) {
    const t = JSON.parse(JSON.stringify(row));
    t.id = this.nextId++; t.parent_id = parentId; t.reminded_for = null;
    const tomb = this.tombs.find(x => x.uid === t.uid);
    let stamp = this.stamp();
    if (tomb && stamp <= tomb.deleted_at) stamp = new Date(Date.parse(tomb.deleted_at) + 1).toISOString(); // harus menang atas nisan
    t.updated_at = stamp;
    this.tombs = this.tombs.filter(x => x.uid !== t.uid);
    this.tasks.push(t);
    return t;
  }
  purgeTrash(ids) {
    const before = this.trash.length;
    if (ids) { const s = new Set(ids); this.trash = this.trash.filter(e => !s.has(e.id)); } else this.trash = [];
    this.save();
    return before - this.trash.length;
  }
  stamp() { return this.clock.stamp ? this.clock.stamp() : stampNow(); }
  touch(t) { t.updated_at = this.stamp(); }
  bury(t) { this.tombs = this.tombs.filter(x => x.uid !== t.uid); this.tombs.push({ uid: t.uid, deleted_at: this.stamp() }); }
  row(id) { return this.tasks.find(t => t.id === id) || null; }

  hydrate(t) {
    const kids = this.tasks.filter(k => k.parent_id === t.id);
    return {
      id: t.id, parent_id: t.parent_id, title: t.title, notes: t.notes, priority: t.priority,
      deadline: t.deadline, due_time: t.due_time, done: !!t.done, project: t.project, repeat: t.repeat,
      tags: t.tags.slice().sort(), created_at: t.created_at, completed_at: t.completed_at,
      sub_total: kids.length, sub_done: kids.filter(k => k.done).length,
    };
  }
  insert(f) {
    const t = {
      id: this.nextId++, parent_id: f.parent_id == null ? null : f.parent_id, title: f.title, notes: f.notes || '',
      priority: f.priority == null ? 2 : f.priority, deadline: f.deadline || null, due_time: f.due_time || null,
      done: !!f.done, project: f.project || null, repeat: f.repeat || null, tags: (f.tags || []).slice(),
      created_at: f.created_at || this.clock.now(), completed_at: f.completed_at || null, reminded_for: null,
      uid: f.uid || randomUid(), updated_at: this.stamp(),
    };
    this.tasks.push(t);
    return t.id;
  }
  spawnNext(row, today) {
    const uid = derivedUid(row.uid, 'next');
    const existing = this.tasks.find(t => t.uid === uid);
    if (existing) { row.repeat = null; this.touch(row); return existing.id; } // sudah dibuat (mis. dari perangkat lain)
    const nid = this.insert({
      uid,
      title: row.title, notes: row.notes, priority: row.priority,
      deadline: nextOccurrence(row.deadline, row.repeat, today), due_time: row.due_time,
      project: row.project, repeat: row.repeat, tags: row.tags,
    });
    row.repeat = null; this.touch(row);
    return nid;
  }

  add(o) {
    const title = cleanTitle(o.title);
    const dueTime = cleanDueTime(o.due_time);
    const deadline = o.deadline || null;
    if (dueTime && !deadline) throw new TodoError('Jam butuh tanggal deadline. Isi deadline-nya juga.');
    const notes = cleanNotes(o.notes);
    const project = cleanProject(o.project);
    const tags = cleanTags(o.tags);
    const priority = checkPriority(o.priority == null ? 2 : o.priority);
    const rule = o.repeat ? normalizeRule(o.repeat) : null;
    let parent = null;
    if (o.parent_id != null) {
      parent = this.row(o.parent_id);
      if (!parent) throw new TodoError('Tugas induk #' + o.parent_id + ' tidak ditemukan.');
      if (parent.parent_id !== null) throw new TodoError('Subtugas tidak bisa memiliki subtugas lagi.');
      if (rule) throw new TodoError('Subtugas tidak bisa berulang; atur pengulangan di tugas induknya.');
    }
    const id = this.insert({ title, notes, priority, deadline, due_time: dueTime, project, repeat: rule,
      parent_id: o.parent_id, tags });
    if (parent && parent.done) { parent.done = false; parent.completed_at = null; this.touch(parent); }
    this.save();
    return id;
  }

  update(id, changes) {
    const allowed = ['title', 'notes', 'priority', 'deadline', 'due_time', 'project', 'repeat', 'tags', 'add_tags', 'remove_tags'];
    const unknown = Object.keys(changes).filter(k => !allowed.includes(k));
    if (unknown.length) throw new TodoError('Bidang tidak dikenal: ' + unknown.sort().join(', '));
    if (!Object.keys(changes).length) throw new TodoError('Tidak ada yang diubah.');
    const row = this.row(id);
    if (!row) return false;
    const next = {};
    if ('title' in changes) next.title = cleanTitle(changes.title);
    if ('notes' in changes) next.notes = cleanNotes(changes.notes);
    if ('priority' in changes) next.priority = checkPriority(changes.priority);
    if ('deadline' in changes || 'due_time' in changes) {
      const newDeadline = 'deadline' in changes ? changes.deadline : row.deadline;
      let newTime = 'due_time' in changes ? cleanDueTime(changes.due_time) : row.due_time;
      if (!newDeadline) {
        if ('due_time' in changes && newTime) throw new TodoError('Jam butuh tanggal deadline. Isi deadline-nya juga.');
        newTime = null;
      }
      next.deadline = newDeadline || null;
      next.due_time = newTime;
      if (next.deadline !== row.deadline || next.due_time !== row.due_time) next.reminded_for = null;
    }
    if ('project' in changes) next.project = cleanProject(changes.project);
    if ('repeat' in changes) {
      const rule = changes.repeat ? normalizeRule(changes.repeat) : null;
      if (rule && row.parent_id !== null) throw new TodoError('Subtugas tidak bisa berulang.');
      next.repeat = rule;
    }
    let tags = row.tags.slice();
    if ('tags' in changes) tags = cleanTags(changes.tags);
    for (const t of cleanTags(changes.add_tags)) if (!tags.includes(t)) tags.push(t);
    const removing = cleanTags(changes.remove_tags);
    tags = tags.filter(t => !removing.includes(t));
    Object.assign(row, next, { tags });
    this.touch(row);
    this.save();
    return true;
  }

  setDone(id, done, today) {
    const row = this.row(id);
    if (!row) return null;
    const result = { id, changed: false, next_id: null };
    if (!!row.done === !!done) return result;
    result.changed = true;
    const now = this.clock.now();
    if (done) {
      row.done = true; row.completed_at = now; this.touch(row);
      for (const k of this.tasks) if (k.parent_id === id && !k.done) { k.done = true; k.completed_at = now; this.touch(k); }
      if (row.repeat && row.parent_id === null) result.next_id = this.spawnNext(row, today);
    } else {
      row.done = false; row.completed_at = null; this.touch(row);
      if (row.parent_id !== null) {
        const parent = this.row(row.parent_id);
        if (parent && parent.done) { parent.done = false; parent.completed_at = null; this.touch(parent); }
      }
    }
    if (done && row.parent_id !== null) {
      const left = this.tasks.filter(k => k.parent_id === row.parent_id && !k.done).length;
      if (left === 0) result.next_id = this.setDone(row.parent_id, true, today).next_id;
    }
    this.save();
    return result;
  }

  /* opts.permanent: lewati sampah (dipakai saat membatalkan tugas berulang yang baru dibuat otomatis). */
  delete(id, opts) {
    const root = this.row(id);
    if (!root) return false;
    if (!(opts && opts.permanent)) this.toTrash(root, this.trashSeq++);
    for (const t of this.tasks) if (t.id === id || t.parent_id === id) this.bury(t);
    this.tasks = this.tasks.filter(t => t.id !== id && t.parent_id !== id);
    this.save();
    return true;
  }
  clearDone() {
    const gone = new Set(this.tasks.filter(t => t.done && t.parent_id === null).map(t => t.id));
    if (gone.size) { const batch = this.trashSeq++; for (const t of this.tasks) if (gone.has(t.id)) this.toTrash(t, batch); }
    for (const t of this.tasks) if (gone.has(t.id) || gone.has(t.parent_id)) this.bury(t);
    this.tasks = this.tasks.filter(t => !gone.has(t.id) && !gone.has(t.parent_id));
    this.save();
    return gone.size;
  }

  get(id) { const t = this.row(id); return t ? this.hydrate(t) : null; }
  listAll() { return this.tasks.slice().sort((a, b) => a.id - b.id).map(t => this.hydrate(t)); }

  projects() {
    const groups = new Map();
    for (const t of this.tasks) {
      if (t.project == null || t.parent_id !== null) continue;
      const key = t.project.replace(/[A-Z]/g, c => c.toLowerCase());
      const g = groups.get(key) || { name: t.project, active: 0, total: 0 };
      if (t.project < g.name) g.name = t.project;
      g.total += 1; if (!t.done) g.active += 1;
      groups.set(key, g);
    }
    return Array.from(groups.entries()).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(e => e[1]);
  }
  tagList() {
    const groups = new Map();
    for (const t of this.tasks) for (const tag of t.tags) {
      const g = groups.get(tag) || { name: tag, active: 0, total: 0 };
      g.total += 1; if (!t.done) g.active += 1;
      groups.set(tag, g);
    }
    return Array.from(groups.values()).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
  stats(today) {
    const weekEnd = addDays(today, 6);
    const top = this.tasks.filter(t => t.parent_id === null);
    const open = top.filter(t => !t.done);
    const s = {
      total: top.length, done: top.length - open.length, active: open.length,
      overdue: open.filter(t => t.deadline && t.deadline < today).length,
      due_today: open.filter(t => t.deadline === today).length,
      due_week: open.filter(t => t.deadline && t.deadline >= today && t.deadline <= weekEnd).length,
      high: open.filter(t => t.priority === 1).length,
    };
    s.by_priority = { 1: 0, 2: 0, 3: 0 };
    for (const t of open) s.by_priority[t.priority] += 1;
    const first = addDays(today, -6);
    const perDay = {};
    for (const t of top) {
      if (t.done && t.completed_at && t.completed_at >= first) {
        const day = t.completed_at.slice(0, 10);
        perDay[day] = (perDay[day] || 0) + 1;
      }
    }
    s.completed_week = [];
    for (let i = 0; i < 7; i++) { const d = addDays(first, i); s.completed_week.push([d, perDay[d] || 0]); }
    s.completion_rate = s.total ? s.done / s.total : 0.0;
    return s;
  }

  exportData() {
    return { app: 'todo-cli', version: SCHEMA_VERSION, exported_at: this.clock.now(),
      tasks: this.listAll().map(t => { const o = {}; for (const k of EXPORT_KEYS) o[k] = t[k]; return o; }) };
  }
  importData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.tasks)) {
      throw new TodoError("Format impor tidak valid: harus berisi daftar 'tasks'.");
    }
    const items = data.tasks.map((raw, index) => {
      try { return this.coerceImport(raw); }
      catch (e) { if (e instanceof TodoError || e instanceof TypeError || e instanceof RangeError) throw new TodoError('Tugas ke-' + (index + 1) + ' tidak valid: ' + e.message); throw e; }
    });
    if (this.tasks.length + items.length > MAX_SYNC_TASKS) throw new TodoError('Impor terlalu besar: total tugas tidak boleh lebih dari ' + MAX_SYNC_TASKS + '.');
    const idMap = new Map(); // hanya tugas tingkat atas yang boleh jadi induk (subtugas tidak punya subtugas)
    for (const it of items.filter(i => i.old_parent == null)) idMap.set(it.old_id, this.insert(it.fields));
    for (const it of items.filter(i => i.old_parent != null)) {
      const f = Object.assign({}, it.fields);
      f.parent_id = idMap.has(it.old_parent) ? idMap.get(it.old_parent) : null;
      if (f.parent_id !== null) f.repeat = null;
      this.insert(f);
    }
    this.save();
    return items.length;
  }
  coerceImport(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TodoError('bukan objek');
    const done = !!raw.done;
    const dueTime = cleanDueTime(raw.due_time);
    if (dueTime && !raw.deadline) throw new TodoError('jam tanpa deadline');
    if (raw.deadline) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw.deadline));
      if (!m || !mk(+m[1], +m[2], +m[3])) throw new TodoError("Invalid isoformat string: '" + raw.deadline + "'");
    }
    const priority = 'priority' in raw ? raw.priority : 2;
    return { old_id: raw.id, old_parent: raw.parent_id, fields: {
      title: cleanTitle(raw.title), notes: cleanNotes(raw.notes), priority: checkPriority(priority),
      deadline: raw.deadline || null, due_time: dueTime, project: cleanProject(raw.project),
      repeat: raw.repeat ? normalizeRule(raw.repeat) : null, tags: cleanTags(raw.tags), done,
      created_at: String(raw.created_at || this.clock.now()),
      completed_at: done ? String(raw.completed_at || this.clock.now()) : null,
    } };
  }

  // ---- sinkronisasi lewat berkas (padanan todo/sync.py) ----
  syncState() {
    const byId = new Map(this.tasks.map(t => [t.id, t]));
    const records = this.tasks.slice().sort((a, b) => a.id - b.id).map(t => ({
      uid: t.uid, parent_uid: t.parent_id == null ? null : (byId.get(t.parent_id) || {}).uid || null,
      title: t.title, notes: t.notes, priority: t.priority, deadline: t.deadline, due_time: t.due_time,
      done: !!t.done, project: t.project, repeat: t.repeat, tags: t.tags.slice().sort(),
      created_at: t.created_at, completed_at: t.completed_at, updated_at: t.updated_at }));
    const tombs = this.tombs.slice().sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)).map(t => ({ uid: t.uid, deleted_at: t.deleted_at }));
    return { records, tombs };
  }
  applySync(result) {
    const byUid = new Map(this.tasks.map(t => [t.uid, t]));
    const gone = new Set(result.delete);
    this.tasks = this.tasks.filter(t => !gone.has(t.uid));
    byUid.clear(); for (const t of this.tasks) byUid.set(t.uid, t);
    const byAge = result.upsert.slice().sort((a, b) => cmpStr(a.created_at, b.created_at) || cmpStr(a.uid, b.uid));
    const ordered = byAge.filter(r => r.parent_uid === null).concat(byAge.filter(r => r.parent_uid !== null));
    for (const rec of ordered) {
      const parent = rec.parent_uid ? byUid.get(rec.parent_uid) : null;
      let t = byUid.get(rec.uid);
      if (!t) {
        t = { id: this.nextId++, uid: rec.uid, reminded_for: null };
        this.tasks.push(t); byUid.set(rec.uid, t);
      } else if (t.deadline !== rec.deadline || t.due_time !== rec.due_time) t.reminded_for = null;
      Object.assign(t, { parent_id: parent ? parent.id : null, title: rec.title, notes: rec.notes, priority: rec.priority,
        deadline: rec.deadline, due_time: rec.due_time, done: rec.done, project: rec.project, repeat: rec.repeat,
        tags: rec.tags.slice(), created_at: rec.created_at, completed_at: rec.completed_at, updated_at: rec.updated_at });
    }
    this.tombs = result.deleted.map(d => ({ uid: d.uid, deleted_at: d.deleted_at }));
    this.save();
  }
  /* Gabungkan isi berkas sinkron. Mengembalikan ringkasan {added, updated, deleted}. */
  syncWith(data) {
    const remote = validateSyncFile(data);
    const local = this.syncState();
    const result = mergeSync(local.records, local.tombs, remote.records, remote.tombs);
    const have = new Set(local.records.map(r => r.uid));
    const summary = { added: result.upsert.filter(r => !have.has(r.uid)).length,
      updated: result.upsert.filter(r => have.has(r.uid)).length, deleted: result.delete.length };
    this.applySync(result);
    if (remote.settings && this.settingsHook) this.settingsHook.apply(remote.settings);
    return summary;
  }
  syncFile(device) {
    const s = this.syncState();
    const f = { app: 'todo-cli', kind: 'sync', format: 1, device: device || '', exported_at: this.clock.now(), tasks: s.records, deleted: s.tombs };
    const settings = this.settingsHook ? this.settingsHook.get() : null;
    if (settings) f.settings = settings; // hanya bila pernah diubah pengguna: berkas tanpa pengaturan tetap sama seperti dulu
    return f;
  }

  /* Daftar ringkas untuk widget layar utama: tugas induk yang belum selesai dan jatuh tempo paling lambat
   * `horizon` hari lagi, urut tanggal, jam (yang berjam dulu), lalu prioritas. */
  widgetItems(horizon, limit) {
    const last = addDays(this.clock.today(), horizon == null ? 3 : horizon);
    return this.tasks
      .filter(t => !t.done && t.parent_id == null && t.deadline && t.deadline <= last)
      .sort((a, b) => cmpStr(a.deadline, b.deadline) || cmpStr(a.due_time || '99:99', b.due_time || '99:99') || a.priority - b.priority || a.id - b.id)
      .slice(0, limit || 30)
      .map(t => ({ t: Array.from(t.title).slice(0, 80).join(''), u: t.uid, i: t.id, d: t.deadline, h: t.due_time || '', p: t.priority }));
  }

  /* Jadikan daftar PERSIS sama dengan isi snapshot: tugas yang tidak ada di snapshot dihapus (dengan nisan agar
   * ikut terhapus saat sinkron), tugas yang ada dipulihkan dengan cap waktu baru agar menang atas nisan lama. */
  restoreSnapshot(data) {
    const remote = validateSyncFile(data);
    const keep = new Set(remote.records.map(r => r.uid));
    const gone = this.tasks.filter(t => !keep.has(t.uid));
    for (const t of gone) this.bury(t);
    this.tombs = this.tombs.filter(x => !keep.has(x.uid));
    const stamp = this.stamp();
    this.applySync({ upsert: remote.records.map(r => Object.assign({}, r, { updated_at: stamp })),
      delete: gone.map(t => t.uid), deleted: this.tombs });
    return { restored: remote.records.length, removed: gone.length };
  }

  /* Tugas aktif yang punya jam, untuk penjadwalan notifikasi. */
  upcoming() {
    return this.tasks.filter(t => !t.done && t.deadline).map(t => this.hydrate(t));
  }
}

module.exports = { Store };
