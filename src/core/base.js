/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Lihat LICENSE dan NOTICE. */
/* Galat dasar dan pembantu kecil yang dipakai semua modul inti. */
'use strict';

class TodoError extends Error {}

const pad2 = n => String(n).padStart(2, '0');

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

module.exports = { TodoError, pad2, has };
