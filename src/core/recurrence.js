/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Lihat LICENSE dan NOTICE. */
/* Aturan ulang (1d/1w/wd/dow:...) dan tanggal kejadian berikutnya. */
'use strict';
const { TodoError, has } = require('./base');
const { addDays, addMonths, split } = require('./dates');

const RULE_HINT = 'Pengulangan tidak dikenali. Gunakan daily/weekly/monthly/yearly ' +
  '(atau harian/mingguan/bulanan/tahunan), bentuk 3d, 2w, 1m, 1y, "hari kerja", atau nama hari seperti senin,kamis.';

const RULE_ALIASES = { daily: '1d', harian: '1d', weekly: '1w', mingguan: '1w', monthly: '1m',
  bulanan: '1m', yearly: '1y', annually: '1y', tahunan: '1y',
  weekdays: 'wd', weekday: 'wd', 'hari kerja': 'wd', harikerja: 'wd', 'hari-kerja': 'wd' };

const DOW_NAMES = { min: 0, minggu: 0, sun: 0, sunday: 0, sen: 1, senin: 1, mon: 1, monday: 1, sel: 2, selasa: 2, tue: 2, tuesday: 2,
  rab: 3, rabu: 3, wed: 3, wednesday: 3, kam: 4, kamis: 4, thu: 4, thursday: 4, jum: 5, jumat: 5, fri: 5, friday: 5,
  sab: 6, sabtu: 6, sat: 6, saturday: 6 };

const dowRule = days => {
  const u = Array.from(new Set(days)).sort((a, b) => a - b);
  return u.length === 7 ? '1d' : u.length === 5 && u.join() === '1,2,3,4,5' ? 'wd' : 'dow:' + u.join(',');
};

/* Hari dalam aturan "wd" (Senin-Jumat) atau "dow:1,4" (0 = Minggu ... 6 = Sabtu); null bila bukan aturan hari. */
function ruleDays(rule) {
  if (rule === 'wd') return [1, 2, 3, 4, 5];
  const m = /^dow:([0-6](?:,[0-6])*)$/.exec(rule || '');
  return m ? m[1].split(',').map(Number) : null;
}

function normalizeRule(text) {
  let raw = String(text == null ? '' : text).trim().toLowerCase();
  for (const prefix of ['every ', 'setiap ']) if (raw.startsWith(prefix)) raw = raw.slice(prefix.length).trim();
  if (raw === 'wd') return 'wd';
  if (has(RULE_ALIASES, raw)) return RULE_ALIASES[raw];
  const m = /^(\d{1,3})\s*([dwmy])$/.exec(raw);
  if (m) {
    if (parseInt(m[1], 10) < 1) throw new TodoError(RULE_HINT);
    return parseInt(m[1], 10) + m[2];
  }
  const dm = /^dow:([0-6](?:,[0-6])*)$/.exec(raw);
  if (dm) return dowRule(dm[1].split(',').map(Number));
  const names = raw.split(/[,\s]+/).filter(x => x && x !== 'dan' && x !== 'and');
  if (names.length && names.every(x => has(DOW_NAMES, x))) return dowRule(names.map(x => DOW_NAMES[x]));
  throw new TodoError(RULE_HINT);
}

function shift(base, n, unit) {
  if (unit === 'd') return addDays(base, n);
  if (unit === 'w') return addDays(base, 7 * n);
  if (unit === 'm') return addMonths(base, n);
  return addMonths(base, 12 * n);
}

function nextOccurrence(deadline, rule, today) {
  const base = deadline || today;
  try {
    const days = ruleDays(rule);
    if (days) {
      let c = base > today ? base : today;
      for (let i = 0; i < 8; i++) {
        c = addDays(c, 1);
        const [y, mo, d] = split(c);
        if (days.includes(new Date(y, mo - 1, d).getDay())) return c;
      }
    }
    const n = parseInt(rule.slice(0, -1), 10), unit = rule.slice(-1);
    for (let k = 1; ; k++) {
      const candidate = shift(base, n * k, unit);
      if (candidate > today) return candidate;
    }
  } catch (e) {
    if (e instanceof RangeError) throw new TodoError('Tanggal berikutnya di luar jangkauan.');
    throw e;
  }
}

module.exports = { RULE_HINT, RULE_ALIASES, DOW_NAMES, dowRule, ruleDays, normalizeRule, shift, nextOccurrence };
