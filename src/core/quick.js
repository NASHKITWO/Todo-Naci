/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Lihat LICENSE dan NOTICE. */
/* Penulisan cepat (satu baris) dan tambah massal. */
'use strict';
const { TodoError, has } = require('./base');
const { DAYPART_DEFAULT, parseClockWords, parseDeadline, parseTime } = require('./dates');
const { normalizeRule } = require('./recurrence');
const { MAX_TITLE, len, parsePriority } = require('./validate');

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

module.exports = { QUICK_SYNTAX, W, RE_PRIO, RE_DEAD, RE_PROJ, RE_TAG, RE_REP, parseQuick, MAX_BULK_LINES, MAX_BULK_CHARS, BULLET_RE, parseBulk };
