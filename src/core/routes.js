/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Lihat LICENSE dan NOTICE. */
/* Rute API gaya REST: masukan -> operasi Store. */
'use strict';
const { TodoError, has } = require('./base');
const { parseDeadline, parseTime } = require('./dates');
const { parsePriority } = require('./validate');
const { parseBulk, parseQuick } = require('./quick');

const parseBulkCount = text => { try { return parseBulk(text, '2000-01-01').length; } catch (e) { return 0; } };

const textOf = (body, key, allowNone) => {
  const v = body[key];
  if (v == null && allowNone) return null;
  if (typeof v !== 'string') throw new TodoError("Bidang '" + key + "' harus berupa teks.");
  return v;
};

function coerce(body, today, keys) {
  const out = {};
  const k = name => keys.includes(name) && name in body;
  if (k('title')) out.title = textOf(body, 'title');
  if (k('notes')) out.notes = textOf(body, 'notes', true) || '';
  if (k('priority')) out.priority = parsePriority(body.priority);
  if (k('deadline')) { const v = textOf(body, 'deadline', true); out.deadline = v && v.trim() ? parseDeadline(v, today) : null; }
  if (k('due_time')) { const v = textOf(body, 'due_time', true); out.due_time = v && v.trim() ? parseTime(v) : null; }
  if (k('project')) out.project = textOf(body, 'project', true) || null;
  if (k('repeat')) out.repeat = textOf(body, 'repeat', true) || null;
  if (k('tags')) {
    if (!Array.isArray(body.tags) || !body.tags.every(t => typeof t === 'string')) throw new TodoError("Bidang 'tags' harus berupa daftar teks.");
    out.tags = body.tags;
  }
  return out;
}

function parentId(body) {
  const v = body.parent_id;
  if (v == null) return null;
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new TodoError('parent_id harus berupa angka.');
  return v;
}

// Kebenaran ala Python: [], {}, 0, '', null, false dianggap kosong.
const pyTruthy = v => !(v == null || v === false || v === 0 || v === '' ||
  (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0));

const TASK_KEYS = ['title', 'notes', 'priority', 'deadline', 'due_time', 'project', 'repeat', 'tags'];

/* Mengembalikan {status, body} seperti server HTTP. Tidak pernah melempar. */
function handle(store, method, path, body) {
  body = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const today = store.clock.today();
  try {
    const route = path.split('?')[0].split('/').filter(Boolean);
    if (route[0] !== 'api') return { status: 404, body: { error: 'Tidak ditemukan.' } };
    const r = route.slice(1);
    const ok = (status, payload) => ({ status, body: payload });
    const notFound = msg => ({ status: 404, body: { error: msg || 'Tidak ditemukan.' } });

    if (method === 'GET' && r.length === 1 && r[0] === 'session') return ok(200, { auth_required: false, authenticated: true });
    if (method === 'GET' && r.length === 1 && r[0] === 'state') {
      return ok(200, { today, tasks: store.listAll(), projects: store.projects(), tags: store.tagList(), stats: store.stats(today) });
    }
    if (method === 'GET' && r.length === 1 && r[0] === 'export') return ok(200, store.exportData());
    if (method === 'POST' && r.length === 1 && r[0] === 'tasks') {
      const f = coerce(body, today, TASK_KEYS);
      if (!('title' in f)) throw new TodoError('Judul tugas wajib diisi.');
      const id = store.add(Object.assign({}, f, { parent_id: parentId(body) }));
      return ok(201, { task: store.get(id) });
    }
    const planFor = (text, b) => {
      const plan = parseBulk(text, today, { plain: pyTruthy(b.plain) });
      const defaults = pyTruthy(b.defaults) ? b.defaults : {};
      if (typeof defaults !== 'object' || Array.isArray(defaults)) throw new TodoError("'defaults' harus berupa objek.");
      return { plan, df: coerce(defaults, today, ['deadline', 'project', 'tags', 'priority', 'due_time', 'repeat']) };
    };
    const previewOf = plan => plan.map(p => ({ title: p.title, priority: p.priority || 2, deadline: p.deadline, due_time: p.due_time,
      project: p.project, tags: p.tags, repeat: p.repeat, done: p.done, sub: p.sub }));
    if (method === 'POST' && r.length === 2 && r[0] === 'tasks' && r[1] === 'bulk') {
      const { plan, df } = planFor('text' in body ? body.text : '', body);
      if (pyTruthy(body.dry_run)) return ok(200, { preview: previewOf(plan), count: plan.length });
      const ids = store.addPlan(plan, df);
      return ok(201, { created: ids.map(i => store.get(i)), count: ids.length });
    }
    if (r[0] === 'templates') {
      const list = () => store.templates.map(x => ({ id: x.id, name: x.name, text: x.text, count: parseBulkCount(x.text) }));
      if (method === 'GET' && r.length === 1) return ok(200, { templates: list() });
      if (method === 'POST' && r.length === 1) {
        const name = textOf(body, 'name').trim(), text = textOf(body, 'text');
        if (!name) throw new TodoError('Nama templat wajib diisi.');
        if (Array.from(name).length > 60) throw new TodoError('Nama templat maksimal 60 karakter.');
        parseBulk(text, today, { plain: pyTruthy(body.plain) }); // menolak teks yang tidak bisa dipakai
        const res = store.saveTemplate(name, text);
        return ok(res.created ? 201 : 200, { template: res.template });
      }
      if (r.length >= 2 && /^\d+$/.test(r[1])) {
        const id = parseInt(r[1], 10);
        if (method === 'DELETE' && r.length === 2) return store.deleteTemplate(id) ? ok(200, { deleted: true }) : notFound('Templat tidak ditemukan.');
        if (method === 'POST' && r.length === 3 && r[2] === 'use') {
          const tpl = store.templates.find(x => x.id === id);
          if (!tpl) return notFound('Templat tidak ditemukan.');
          const { plan, df } = planFor(tpl.text, body);
          const ids = store.addPlan(plan, df);
          return ok(201, { created: ids.map(i => store.get(i)), count: ids.length });
        }
      }
      return notFound();
    }
    if (method === 'POST' && r.length === 1 && r[0] === 'quick') {
      const parsed = parseQuick('text' in body ? textOf(body, 'text') : '', today);
      const defaults = pyTruthy(body.defaults) ? body.defaults : {}; // seperti `or {}` di Python
      if (typeof defaults !== 'object' || Array.isArray(defaults)) throw new TodoError("'defaults' harus berupa objek.");
      const df = coerce(defaults, today, ['deadline', 'project', 'tags']);
      const tags = parsed.tags.concat((df.tags || []).filter(t => !parsed.tags.includes(t)));
      const id = store.add({
        title: parsed.title, priority: parsed.priority || 2, deadline: parsed.deadline || df.deadline || null,
        due_time: parsed.due_time, project: parsed.project || df.project || null, tags, repeat: parsed.repeat,
        parent_id: parentId(body),
      });
      return ok(201, { task: store.get(id) });
    }
    if (r[0] === 'trash') {
      if (method === 'GET' && r.length === 1) return ok(200, { entries: store.trashList(), latest: store.latestBatch() });
      if (method === 'POST' && r.length === 2 && r[1] === 'restore') {
        const sel = {};
        if (has(body, 'ids')) {
          if (!Array.isArray(body.ids) || !body.ids.every(Number.isInteger)) throw new TodoError("'ids' harus berupa daftar angka.");
          sel.ids = body.ids;
        }
        if (has(body, 'batch')) {
          if (!Number.isInteger(body.batch)) throw new TodoError("'batch' harus berupa angka.");
          sel.batch = body.batch;
        }
        const n = store.restoreTrash(sel);
        if (!n) return notFound('Tidak ada yang bisa dipulihkan.');
        return ok(200, { restored: n });
      }
      if (method === 'DELETE' && r.length === 1) return ok(200, { purged: store.purgeTrash(null) });
      if (method === 'DELETE' && r.length === 2 && /^\d+$/.test(r[1])) {
        const n = store.purgeTrash([parseInt(r[1], 10)]);
        return n ? ok(200, { purged: n }) : notFound('Tidak ditemukan di sampah.');
      }
      return notFound();
    }
    if (method === 'POST' && r.length === 1 && r[0] === 'clear') return ok(200, { cleared: store.clearDone() });
    if (r.length >= 2 && r[0] === 'tasks') {
      if (!/^\d+$/.test(r[1])) return notFound();
      const id = parseInt(r[1], 10);
      if (method === 'PATCH' && r.length === 2) {
        const f = coerce(body, today, TASK_KEYS);
        if (!store.update(id, f)) return notFound('Tugas tidak ditemukan.');
        return ok(200, { task: store.get(id) });
      }
      if (method === 'DELETE' && r.length === 2) {
        if (!store.delete(id, { permanent: pyTruthy(body.permanent) })) return notFound('Tugas tidak ditemukan.');
        return ok(200, { deleted: true });
      }
      if (method === 'POST' && r.length === 3 && r[2] === 'done') {
        const flag = 'done' in body ? body.done : true;
        if (typeof flag !== 'boolean') throw new TodoError("Bidang 'done' harus true atau false.");
        const res = store.setDone(id, flag, today);
        if (res === null) return notFound('Tugas tidak ditemukan.');
        return ok(200, { task: store.get(id), next: res.next_id ? store.get(res.next_id) : null });
      }
    }
    return notFound();
  } catch (e) {
    if (e instanceof TodoError) return { status: 400, body: { error: e.message } };
    throw e;
  }
}

module.exports = { parseBulkCount, textOf, coerce, parentId, pyTruthy, TASK_KEYS, handle };
