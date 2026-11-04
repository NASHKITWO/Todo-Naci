/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Lihat LICENSE dan NOTICE. */
/* Pintu masuk modul inti: menggabungkan semua modul dan mengekspor API publik. */
'use strict';
const base = require('./base');
const dates = require('./dates');
const recurrence = require('./recurrence');
const validate = require('./validate');
const quick = require('./quick');
const ids = require('./ids');
const sync = require('./sync');
const store = require('./store');
const routes = require('./routes');
const reminders = require('./reminders');
const history = require('./history');

const all = Object.assign({}, base, dates, recurrence, validate, quick, ids, sync, store, routes, reminders, history);
const KEYS = ['derivedUid', 'rotateSnapshots', 'planReminders', 'tuntasStats', 'cleanSettings', 'TodoError', 'Store', 'handle', 'mergeSync', 'validateSyncFile', 'parseDeadline', 'parseTime', 'parseDue', 'parseClockWords', 'parseQuick', 'normalizeRule', 'parseBulk', 'nextOccurrence', 'ruleDays', 'addDays', 'addMonths', 'diffDays', 'weekday', 'parsePriority', 'cleanDueTime', 'todayIso', 'nowIso', 'SCHEMA_VERSION'];
const api = {};
for (const k of KEYS) { if (!(k in all)) throw new Error('Modul inti tidak mengekspor: ' + k); api[k] = all[k]; }
module.exports = api;
