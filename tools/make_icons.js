/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Program ini perangkat lunak bebas di bawah GNU GPL v3 atau yang lebih baru, TANPA JAMINAN; lihat LICENSE dan NOTICE. */
'use strict';
/* Ikon & splash Android: membaca PNG yang sudah dirender dari logo (assets/android/<jenis>-<ukuran>.png).
 * Sumber dan pembuatnya: tools/render_icons.js. Tidak ada rasterisasi saat build, jadi CI tidak butuh Playwright.
 * kind: 'legacy' | 'round' | 'foreground' | 'monochrome'; size: sisi persegi dalam piksel. */
const fs = require('fs');
const path = require('path');

function icon(kind, size) {
  const file = path.join(__dirname, '..', 'assets', 'android', kind + '-' + size + '.png');
  if (!fs.existsSync(file)) throw new Error('PNG ikon tidak ada: ' + path.basename(file) + ' (jalankan node tools/render_icons.js)');
  return fs.readFileSync(file);
}

module.exports = { icon };
