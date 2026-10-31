/* Inti logika todo-cli dalam JavaScript (tanpa dependensi), port dari paket Python:
 * dates.py, recurrence.py, quick.py, db.py, dan routing REST di server.py.
 *
 * Dipakai oleh aplikasi mobile (data di HP) dan diuji terhadap versi Python
 * (tests/test_mobile_parity.py) supaya perilakunya tetap sama persis.
 *
 * Tanggal disimpan sebagai teks "YYYY-MM-DD", jam "HH:MM" (waktu setempat), sehingga
 * tidak tergantung zona waktu dan bisa dibandingkan sebagai teks.
 */
(function (root) {
  'use strict';

  class TodoError extends Error {}

  // ======================= tanggal =======================
  const pad2 = n => String(n).padStart(2, '0');
  const KEYWORDS = { 'hari ini': 0, 'hariini': 0, 'today': 0, 'besok': 1, 'tomorrow': 1, 'lusa': 2,
    'minggu depan': 7, 'next week': 7 };
  const WEEKDAYS = { senin: 0, selasa: 1, rabu: 2, kamis: 3, jumat: 4, "jum'at": 4, sabtu: 5, minggu: 6,
    monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };
  const FORMAT_HINT = 'Format yang didukung: YYYY-MM-DD, DD/MM/YYYY, DD/MM, hari ini, besok, ' +
    'lusa, minggu depan, +3d (3 hari), +2w (2 minggu), +1m (1 bulan), atau nama hari (mis. jumat).';
  const TIME_HINT = 'Jam harus berformat HH:MM atau HH.MM (00:00-23:59), mis. 14:30.';
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

  function mk(y, m, d) { // -> 'YYYY-MM-DD' atau null bila tanggal tidak ada
    if (y < 1 || y > 9999 || m < 1 || m > 12 || d < 1) return null;
    // Verifikasi komponen (menolak 31 Feb, 29 Feb tahun bukan kabisat, dst.).
    const check = new Date(Date.UTC(2000, 0, 1));
    check.setUTCFullYear(y, m - 1, d);
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
    return String(y).padStart(4, '0') + '-' + pad2(m) + '-' + pad2(d);
  }
  function split(iso) { const p = iso.split('-'); return [+p[0], +p[1], +p[2]]; }
  function toDate(iso) { const [y, m, d] = split(iso); const dt = new Date(Date.UTC(2000, 0, 1)); dt.setUTCFullYear(y, m - 1, d); return dt; }
  function fromDate(dt) { return mk(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()); }
  function addDays(iso, n) {
    const dt = toDate(iso); dt.setUTCDate(dt.getUTCDate() + n);
    const out = fromDate(dt);
    if (!out) throw new RangeError('luar jangkauan');
    return out;
  }
  function addMonths(iso, months) {
    const [y, m, d] = split(iso);
    const index = m - 1 + months;
    const year = y + Math.floor(index / 12), month = ((index % 12) + 12) % 12 + 1;
    const last = new Date(Date.UTC(2000, month, 0)); last.setUTCFullYear(year, month, 0);
    const out = mk(year, month, Math.min(d, last.getUTCDate()));
    if (!out) throw new RangeError('luar jangkauan');
    return out;
  }
  const weekday = iso => (toDate(iso).getUTCDay() + 6) % 7; // Senin = 0
  const diffDays = (a, b) => Math.round((toDate(a) - toDate(b)) / 86400000);

  function parseDeadline(text, today) {
    const raw = String(text == null ? '' : text).trim().toLowerCase();
    if (!raw) throw new TodoError('Deadline kosong. ' + FORMAT_HINT);
    if (has(KEYWORDS, raw)) return addDays(today, KEYWORDS[raw]);
    let m = /^\+?(\d{1,4})\s*([dwm])$/.exec(raw);
    try {
      if (m) {
        const amount = parseInt(m[1], 10);
        if (m[2] === 'm') return addMonths(today, amount);
        return addDays(today, amount * (m[2] === 'w' ? 7 : 1));
      }
      if (has(WEEKDAYS, raw)) {
        const delta = ((WEEKDAYS[raw] - weekday(today)) % 7 + 7) % 7 || 7;
        return addDays(today, delta);
      }
      m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
      if (m) { const out = mk(+m[1], +m[2], +m[3]); if (!out) throw new RangeError(); return out; }
      m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
      if (m) { const out = mk(+m[3], +m[2], +m[1]); if (!out) throw new RangeError(); return out; }
      m = /^(\d{1,2})\/(\d{1,2})$/.exec(raw);
      if (m) {
        const day = +m[1], month = +m[2], year = +today.slice(0, 4);
        let cand = mk(year, month, day);
        if (!cand) throw new RangeError();
        if (cand < today) { cand = mk(year + 1, month, day); if (!cand) throw new RangeError(); }
        return cand;
      }
    } catch (e) {
      if (e instanceof RangeError) throw new TodoError("Tanggal tidak valid: '" + text + "'.");
      throw e;
    }
    throw new TodoError("Deadline '" + text + "' tidak dikenali. " + FORMAT_HINT);
  }

  function parseTime(text) {
    const raw = String(text == null ? '' : text).trim().toLowerCase();
    const m = /^(?:jam|pukul)?\s*(\d{1,2})[:.](\d{2})$/.exec(raw);
    if (!m) throw new TodoError("Jam '" + text + "' tidak dikenali. " + TIME_HINT);
    const h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59) throw new TodoError("Jam '" + text + "' tidak valid. " + TIME_HINT);
    return pad2(h) + ':' + pad2(mi);
  }

  const DAYPART_DEFAULT = { pagi: '08:00', siang: '12:00', sore: '17:00', malam: '20:00' };
  const CLOCK_HM = /^(\d{1,2})[:.](\d{2})$/;
  // Kata waktu bahasa Inggris dipetakan ke padanannya (pagi/siang/sore/malam); am/pm ditangani di parseClockWords.
  const ENG_PART = { morning: 'pagi', noon: 'siang', afternoon: 'sore', evening: 'malam', night: 'malam' };
  const partOf = w => { const k = String(w).toLowerCase(); return has(DAYPART_DEFAULT, k) ? k : (has(ENG_PART, k) ? ENG_PART[k] : null); };
  const AMPM_ATTACHED = /^(\d{1,2})(?:[:.](\d{2}))?(am|pm)$/;
  const AMPM_BARE = /^(\d{1,2})(?:[:.](\d{2}))?$/;
  function ampmTime(hour, minute, mer) {
    if (hour < 1 || hour > 12 || minute > 59) throw new TodoError("Jam '" + hour + ':' + pad2(minute) + ' ' + mer + "' tidak valid. " + TIME_HINT);
    const h24 = mer === 'am' ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12);
    return pad2(h24) + ':' + pad2(minute);
  }

  function applyDaypart(hour, part) {
    if (hour === 0 || hour > 12) return hour;
    if (part === 'siang') return hour <= 6 ? hour + 12 : hour;
    if (part === 'sore') return hour < 12 ? hour + 12 : 12;
    if (part === 'malam') { if (hour === 12) return 0; return hour >= 6 ? hour + 12 : hour; }
    return hour; // pagi
  }

  /* Baca ekspresi jam dari awal daftar kata -> [HH:MM, jumlahKata] atau null. Lihat dates.py. */
  function parseClockWords(words, bareDot) {
    if (!words.length) return null;
    const first = String(words[0]).toLowerCase();
    if (partOf(first)) return [DAYPART_DEFAULT[partOf(first)], 1];
    const am = AMPM_ATTACHED.exec(first);
    if (am) return [ampmTime(+am[1], am[2] ? +am[2] : 0, am[3]), 1];
    const bare = AMPM_BARE.exec(first);
    if (bare && words.length > 1 && /^(am|pm)$/i.test(String(words[1]))) return [ampmTime(+bare[1], bare[2] ? +bare[2] : 0, String(words[1]).toLowerCase()), 2];
    let i = 0;
    const prefixed = first === 'jam' || first === 'pukul';
    if (prefixed) { i = 1; if (words.length < 2) return null; }
    const token = String(words[i]).toLowerCase();
    const hm = CLOCK_HM.exec(token);
    if (hm && !(prefixed || bareDot || token.includes(':'))) return null;
    let hour, minute;
    if (hm) {
      parseTime(token); // validasi rentang
      hour = +hm[1]; minute = +hm[2];
    } else if (prefixed && /^\d{1,2}$/.test(token)) {
      hour = +token; minute = 0;
      if (hour > 23) throw new TodoError("Jam '" + words[i] + "' tidak valid. " + TIME_HINT);
    } else return null;
    let used = i + 1;
    if (used < words.length && partOf(words[used])) {
      hour = applyDaypart(hour, partOf(words[used]));
      used += 1;
    }
    return [pad2(hour) + ':' + pad2(minute), used];
  }

  function parseDue(text, today) {
    const raw = String(text == null ? '' : text).trim().toLowerCase();
    if (!raw) throw new TodoError('Deadline kosong. ' + FORMAT_HINT);
    const words = raw.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const clock = parseClockWords(words.slice(i), true);
      if (clock && clock[1] === words.length - i) {
        return [i ? parseDeadline(words.slice(0, i).join(' '), today) : today, clock[0]];
      }
    }
    if (/^(?:jam|pukul)?\s*(\d{1,2})[:.](\d{2})$/.test(raw)) return [today, parseTime(raw)];
    const trailing = /\s+(?:jam\s+|pukul\s+)?(\d{1,2})[:.](\d{2})$/.exec(raw);
    if (trailing) return [parseDeadline(raw.slice(0, trailing.index), today), parseTime(trailing[0].trim())];
    return [parseDeadline(raw, today), null];
  }

  // ======================= pengulangan =======================
  const RULE_HINT = 'Pengulangan tidak dikenali. Gunakan daily/weekly/monthly/yearly ' +
    '(atau harian/mingguan/bulanan/tahunan), atau bentuk 3d, 2w, 1m, 1y.';
  const RULE_ALIASES = { daily: '1d', harian: '1d', weekly: '1w', mingguan: '1w', monthly: '1m',
    bulanan: '1m', yearly: '1y', annually: '1y', tahunan: '1y' };
  const UNIT_NAMES = { d: 'hari', w: 'minggu', m: 'bulan', y: 'tahun' };

  function normalizeRule(text) {
    let raw = String(text == null ? '' : text).trim().toLowerCase();
    for (const prefix of ['every ', 'setiap ']) if (raw.startsWith(prefix)) raw = raw.slice(prefix.length).trim();
    if (has(RULE_ALIASES, raw)) return RULE_ALIASES[raw];
    const m = /^(\d{1,3})\s*([dwmy])$/.exec(raw);
    if (!m || parseInt(m[1], 10) < 1) throw new TodoError(RULE_HINT);
    return parseInt(m[1], 10) + m[2];
  }

  function shift(base, n, unit) {
    if (unit === 'd') return addDays(base, n);
    if (unit === 'w') return addDays(base, 7 * n);
    if (unit === 'm') return addMonths(base, n);
    return addMonths(base, 12 * n);
  }

  function nextOccurrence(deadline, rule, today) {
    const n = parseInt(rule.slice(0, -1), 10), unit = rule.slice(-1);
    const base = deadline || today;
    try {
      for (let k = 1; ; k++) {
        const candidate = shift(base, n * k, unit);
        if (candidate > today) return candidate;
      }
    } catch (e) {
      if (e instanceof RangeError) throw new TodoError('Tanggal berikutnya di luar jangkauan.');
      throw e;
    }
  }

  // ======================= validasi =======================
  const MAX_TITLE = 300, MAX_NOTES = 5000, MAX_NAME = 60;
  const PRIORITY_ALIASES = { '1': 1, high: 1, h: 1, tinggi: 1, t: 1, '2': 2, medium: 2, med: 2, m: 2,
    sedang: 2, s: 2, '3': 3, low: 3, l: 3, rendah: 3, r: 3 };
  const len = s => Array.from(s).length; // jumlah karakter seperti Python (bukan unit UTF-16)

  function parsePriority(value) {
    const key = String(value).trim().toLowerCase();
    if (typeof value === 'boolean' || !has(PRIORITY_ALIASES, key)) {
      throw new TodoError("Prioritas '" + value + "' tidak valid. Gunakan high/medium/low " +
        '(atau tinggi/sedang/rendah, atau 1/2/3).');
    }
    return PRIORITY_ALIASES[key];
  }
  function cleanTitle(title) {
    const t = String(title == null ? '' : title).split(/\s+/).filter(Boolean).join(' ');
    if (!t) throw new TodoError('Judul tugas tidak boleh kosong.');
    if (len(t) > MAX_TITLE) throw new TodoError('Judul terlalu panjang (maksimal ' + MAX_TITLE + ' karakter).');
    return t;
  }
  function cleanNotes(notes) {
    const n = String(notes == null ? '' : notes).trim();
    if (len(n) > MAX_NOTES) throw new TodoError('Catatan terlalu panjang (maksimal ' + MAX_NOTES + ' karakter).');
    return n;
  }
  function cleanProject(project) {
    const p = String(project == null ? '' : project).trim().replace(/^@+/, '').trim();
    if (!p) return null;
    if (len(p) > MAX_NAME) throw new TodoError('Nama proyek terlalu panjang (maksimal ' + MAX_NAME + ' karakter).');
    return p;
  }
  function cleanTag(tag) {
    const t = String(tag == null ? '' : tag).trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-').replace(/^,+|,+$/g, '');
    if (!t) return null;
    if (len(t) > MAX_NAME) throw new TodoError('Tag terlalu panjang (maksimal ' + MAX_NAME + ' karakter).');
    return t;
  }
  function cleanTags(tags) {
    const out = [];
    for (const raw of tags || []) { const t = cleanTag(raw); if (t && !out.includes(t)) out.push(t); }
    return out;
  }
  function checkPriority(p) {
    if (typeof p !== 'number' || ![1, 2, 3].includes(p)) throw new TodoError('Prioritas harus 1, 2, atau 3.');
    return p;
  }
  function cleanDueTime(value) {
    if (value == null || (typeof value === 'string' && !value.trim())) return null;
    const m = typeof value === 'string' ? /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(value) : null;
    if (!m || +m[1] > 23 || +m[2] > 59) throw new TodoError('Jam harus berformat HH:MM (00:00-23:59), mis. 14:30.');
    return pad2(+m[1]) + ':' + pad2(+m[2]);
  }

  // ======================= quick add =======================
  const QUICK_SYNTAX = '!prioritas (1/2/3 atau high/medium/low)  ^deadline [jam] (besok 14:00, +3d, 31/12)  ' +
    '@proyek  #tag  *ulang (weekly, 2w)';
  const W = '[\\p{L}\\p{N}_]';
  const RE_PRIO = new RegExp('^!(' + W + '+)$', 'u');
  const RE_DEAD = /^\^(\S+)$/u;
  const RE_PROJ = new RegExp('^@((?:' + W + '|-)+)$', 'u');
  const RE_TAG = new RegExp('^#((?:' + W + '|-)+)$', 'u');
  const RE_REP = /^\*(\S+)$/u;

  function parseQuick(text, today) {
    const result = { title: '', priority: null, deadline: null, due_time: null, project: null, tags: [], repeat: null };
    const words = [];
    const tokens = String(text == null ? '' : text).split(/\s+/).filter(Boolean);
    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i++];
      let m = RE_PRIO.exec(token);
      if (m) { result.priority = parsePriority(m[1]); continue; }
      m = RE_DEAD.exec(token);
      if (m) {
        const raw = m[1];
        if (/^\d{1,2}[:.]\d{2}$/.test(raw) && parseInt(raw.slice(0, -3), 10) <= 23) {
          result.deadline = today; result.due_time = parseTime(raw); continue;
        }
        if (has(DAYPART_DEFAULT, raw.toLowerCase())) { result.deadline = today; result.due_time = DAYPART_DEFAULT[raw.toLowerCase()]; continue; }
        result.deadline = parseDeadline(raw, today);
        const clock = parseClockWords(tokens.slice(i, i + 3), false);
        if (clock) { result.due_time = clock[0]; i += clock[1]; }
        continue;
      }
      m = RE_PROJ.exec(token);
      if (m) { result.project = m[1]; continue; }
      m = RE_TAG.exec(token);
      if (m) { const tag = m[1].toLowerCase(); if (!result.tags.includes(tag)) result.tags.push(tag); continue; }
      m = RE_REP.exec(token);
      if (m) { result.repeat = normalizeRule(m[1]); continue; }
      words.push(token);
    }
    result.title = words.join(' ');
    if (!result.title) throw new TodoError('Judul tugas tidak boleh kosong. Penanda: ' + QUICK_SYNTAX);
    return result;
  }

  /* Banyak baris sekaligus (tempel dari catatan/chat). Tiap baris memakai sintaks penulisan cepat.
   * Penanda butir ("- ", "* ", "• ", "1. ", "- [ ] ", "[x] ") dibuang; "[x]" berarti sudah selesai.
   * Baris yang lebih menjorok dari baris induk di atasnya menjadi subtugas (hanya dua tingkat). */
  const MAX_BULK_LINES = 200, MAX_BULK_CHARS = 20000;
  const BULLET_RE = /^(?:(?:[-*\u2022\u2013]|\d{1,3}[.)])\s+)?(?:\[([ xX]?)\]\s+)?/;
  function parseBulk(text, today, opts) {
    const plain = !!(opts && opts.plain); // plain: tanpa penanda ! ^ @ # * — isi baris dipakai apa adanya sebagai judul
    if (typeof text !== 'string') throw new TodoError("Bidang 'text' harus berupa teks.");
    if (text.length > MAX_BULK_CHARS) throw new TodoError('Teks terlalu panjang (maksimal ' + MAX_BULK_CHARS + ' karakter).');
    const plan = [];
    let baseIndent = null, lineNo = 0;
    for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
      lineNo++;
      if (!raw.trim()) continue;
      const indent = raw.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
      const m = BULLET_RE.exec(raw.trim());
      const body = raw.trim().slice(m[0].length);
      let parsed;
      try {
        if (plain) {
          const title = body.replace(/\s+/g, ' ').trim();
          if (!title) throw new TodoError('Judul tugas tidak boleh kosong.');
          if (len(title) > MAX_TITLE) throw new TodoError('Judul terlalu panjang (maksimal ' + MAX_TITLE + ' karakter).');
          parsed = { title, priority: null, deadline: null, due_time: null, project: null, tags: [], repeat: null };
        } else parsed = parseQuick(body, today);
      }
      catch (e) { if (e instanceof TodoError) throw new TodoError('Baris ' + lineNo + ': ' + e.message); throw e; }
      const sub = plan.length > 0 && baseIndent !== null && indent > baseIndent;
      if (!sub) baseIndent = indent;
      parsed.done = m[1] !== undefined && m[1].toLowerCase() === 'x';
      parsed.sub = sub; parsed.line = lineNo;
      plan.push(parsed);
      if (plan.length > MAX_BULK_LINES) throw new TodoError('Terlalu banyak baris (maksimal ' + MAX_BULK_LINES + ').');
    }
    if (!plan.length) throw new TodoError('Tidak ada baris tugas. Tulis satu tugas per baris.');
    return plan;
  }

  // ======================= penyimpanan =======================
  const nowIso = () => {
    const d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' +
      pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  };
  const todayIso = () => nowIso().slice(0, 10);
  const EXPORT_KEYS = ['id', 'parent_id', 'title', 'notes', 'priority', 'deadline', 'due_time', 'done',
    'project', 'repeat', 'tags', 'created_at', 'completed_at'];
  const SCHEMA_VERSION = 4;
  const TRASH_DAYS = 30, TRASH_MAX = 200, MAX_TEMPLATES = 50;
  const EPOCH = '1970-01-01T00:00:00.000Z';
  const stampNow = () => new Date().toISOString();
  function randomUid() {
    const bytes = new Uint8Array(8);
    const c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (c && c.getRandomValues) c.getRandomValues(bytes); else for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  /* uid yang diturunkan dari uid lain (FNV-1a dua benih → 16 heks): perangkat mana pun yang menyelesaikan tugas berulang
   * yang sama menghasilkan tugas berikutnya dengan uid yang sama, sehingga sinkron tidak menggandakannya. */
  function derivedUid(base, label) {
    const text = String(base) + '|' + label;
    let a = 0x811c9dc5, b = 0x01000193 ^ 0x9e3779b9;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      a = Math.imul(a ^ c, 0x01000193) >>> 0;
      b = Math.imul(b ^ c, 0x85ebca6b) >>> 0; b = (b ^ (b >>> 13)) >>> 0;
    }
    return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
  }

  // ======================= sinkronisasi (padanan todo/sync.py) =======================
  const SYNC_FIELDS = ['uid', 'parent_uid', 'title', 'notes', 'priority', 'deadline', 'due_time', 'done', 'project',
    'repeat', 'tags', 'created_at', 'completed_at', 'updated_at'];
  const UID_RE = /^[0-9a-f]{8,32}$/;
  const STAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;
  const MAX_SYNC_TASKS = 20000;
  const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

  function cleanSyncRecord(raw, index) {
    try {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TodoError('bukan objek');
      const uid = raw.uid, parent = has(raw, 'parent_uid') ? raw.parent_uid : null;
      if (typeof uid !== 'string' || !UID_RE.test(uid)) throw new TodoError('uid tidak valid');
      if (parent !== null && (typeof parent !== 'string' || !UID_RE.test(parent) || parent === uid)) throw new TodoError('parent_uid tidak valid');
      if (typeof raw.updated_at !== 'string' || !STAMP_RE.test(raw.updated_at)) throw new TodoError('updated_at tidak valid');
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
      return { uid: raw.uid, deleted_at: raw.deleted_at };
    });
    return { records, tombs };
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
        final.delete(uid); // tanpa penanda hapus (sama dengan sync.py)
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
      const idMap = new Map();
      for (const it of items.filter(i => i.old_parent == null)) idMap.set(it.old_id, this.insert(it.fields));
      for (const it of items.filter(i => i.old_parent != null)) {
        const f = Object.assign({}, it.fields);
        f.parent_id = idMap.has(it.old_parent) ? idMap.get(it.old_parent) : null;
        if (f.parent_id !== null) f.repeat = null;
        idMap.set(it.old_id, this.insert(f));
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
      return summary;
    }
    syncFile(device) {
      const s = this.syncState();
      return { app: 'todo-cli', kind: 'sync', format: 1, device: device || '', exported_at: this.clock.now(), tasks: s.records, deleted: s.tombs };
    }

    /* Daftar ringkas untuk widget layar utama: tugas induk yang belum selesai dan jatuh tempo paling lambat
     * `horizon` hari lagi, urut tanggal, jam (yang berjam dulu), lalu prioritas. */
    widgetItems(horizon, limit) {
      const last = addDays(this.clock.today(), horizon == null ? 3 : horizon);
      return this.tasks
        .filter(t => !t.done && t.parent_id == null && t.deadline && t.deadline <= last)
        .sort((a, b) => cmpStr(a.deadline, b.deadline) || cmpStr(a.due_time || '99:99', b.due_time || '99:99') || a.priority - b.priority || a.id - b.id)
        .slice(0, limit || 30)
        .map(t => ({ t: Array.from(t.title).slice(0, 80).join(''), u: t.uid, d: t.deadline, h: t.due_time || '', p: t.priority }));
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

  // ======================= API (meniru REST server) =======================
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
    body = body || {};
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


  // ======================= rencana notifikasi =======================
  /* Daftar notifikasi lokal yang perlu dijadwalkan dari tugas aktif (fungsi murni, mudah diuji):
   *  - tugas ber-jam: satu notifikasi tepat waktu dan satu `lead` menit sebelumnya,
   *  - ringkasan harian pukul `digestHour` untuk tiap hari (sampai `days` ke depan) yang punya tugas.
   * ID notifikasi: 2*id (tepat waktu), 2*id+1 (sebelumnya), 1_000_000_000+n (ringkasan hari ke-n). */
  function planReminders(tasks, now, opts) {
    const o = Object.assign({ lead: 30, digestHour: 8, days: 14, limit: 60 }, opts || {});
    const at = (iso, h, m) => { const [y, mo, d] = split(iso); return new Date(y, mo - 1, d, h, m, 0, 0); };
    const out = [];
    for (const t of tasks) {
      if (t.done || !t.deadline || !t.due_time) continue;
      const [h, m] = t.due_time.split(':').map(Number);
      const due = at(t.deadline, h, m);
      if (due > now) out.push({ id: 2 * t.id, at: due, title: 'Jatuh tempo sekarang', body: t.title });
      const early = new Date(due.getTime() - o.lead * 60000);
      if (early > now) out.push({ id: 2 * t.id + 1, at: early, title: 'Dalam ' + o.lead + ' menit', body: t.title });
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
      out.push({ id: 1000000000 + n, at: when, title: list.length + ' tugas ' + (n === 0 ? 'hari ini' : 'pada ' + day), body: names + more });
    }
    out.sort((a, b) => a.at - b.at || a.id - b.id);
    return out.slice(0, o.limit);
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

  const api = { derivedUid, rotateSnapshots, planReminders, TodoError, Store, handle, mergeSync, validateSyncFile, parseDeadline, parseTime, parseDue, parseClockWords, parseQuick, normalizeRule,
    parseBulk, nextOccurrence, addDays, addMonths, diffDays, weekday, parsePriority, cleanDueTime, todayIso, nowIso, SCHEMA_VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TodoCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
