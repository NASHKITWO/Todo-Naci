/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Lihat LICENSE dan NOTICE. */
/* Inti logika todo-cli (tanpa dependensi, tanpa DOM): tanggal, aturan ulang, penulisan cepat, penyimpanan,
 * sinkronisasi, rencana pengingat. Port dari paket Python (dates.py, recurrence.py, quick.py, db.py, server.py) dan diuji
 * terhadap hasil acuan agar perilakunya tetap sama. Kode ada di src/core/*.js (modul CommonJS dengan impor eksplisit);
 * build.js menggabungkannya menjadi satu berkas untuk peramban (global TodoCore).
 *
 * Tanggal disimpan sebagai teks "YYYY-MM-DD", jam "HH:MM" (waktu setempat), sehingga tidak tergantung zona waktu
 * dan bisa dibandingkan sebagai teks. */
'use strict';
module.exports = require('./core/index.js');
