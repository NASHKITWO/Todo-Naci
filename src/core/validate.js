/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Lihat LICENSE dan NOTICE. */
/* Pembersihan dan validasi bidang tugas. */
'use strict';
const { TodoError, has, pad2 } = require('./base');

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

module.exports = { MAX_TITLE, MAX_NOTES, MAX_NAME, PRIORITY_ALIASES, len, parsePriority, cleanTitle, cleanNotes, cleanProject, cleanTag, cleanTags, checkPriority, cleanDueTime };
