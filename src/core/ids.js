/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Lihat LICENSE dan NOTICE. */
/* Waktu sekarang dan UID tugas. */
'use strict';
const { pad2 } = require('./base');

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

module.exports = { nowIso, todayIso, EXPORT_KEYS, SCHEMA_VERSION, TRASH_DAYS, TRASH_MAX, MAX_TEMPLATES, EPOCH, stampNow, randomUid, derivedUid };
