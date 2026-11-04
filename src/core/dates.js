/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Lihat LICENSE dan NOTICE. */
/* Tanggal dan jam: penguraian teks ("besok", "+3d", "jumat"), aritmetika hari/bulan. */
'use strict';
const { TodoError, has, pad2 } = require('./base');

const KEYWORDS = { 'hari ini': 0, 'hariini': 0, 'today': 0, 'besok': 1, 'tomorrow': 1, 'lusa': 2,
  'minggu depan': 7, 'next week': 7 };

const WEEKDAYS = { senin: 0, selasa: 1, rabu: 2, kamis: 3, jumat: 4, "jum'at": 4, sabtu: 5, minggu: 6,
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };

const FORMAT_HINT = 'Format yang didukung: YYYY-MM-DD, DD/MM/YYYY, DD/MM, hari ini, besok, ' +
  'lusa, minggu depan, +3d (3 hari), +2w (2 minggu), +1m (1 bulan), atau nama hari (mis. jumat).';

const TIME_HINT = 'Jam harus berformat HH:MM atau HH.MM (00:00-23:59), mis. 14:30.';

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
  // Masukan wajar pendek; batas ini mencegah penguraian kuadratik pada teks raksasa (DoS)
  if (raw.length > 100) throw new TodoError("Deadline '" + raw.slice(0, 20) + "…' tidak dikenali. " + FORMAT_HINT);
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

module.exports = { KEYWORDS, WEEKDAYS, FORMAT_HINT, TIME_HINT, mk, split, toDate, fromDate, addDays, addMonths, weekday, diffDays, parseDeadline, parseTime, DAYPART_DEFAULT, CLOCK_HM, ENG_PART, partOf, AMPM_ATTACHED, AMPM_BARE, ampmTime, applyDaypart, parseClockWords, parseDue };
