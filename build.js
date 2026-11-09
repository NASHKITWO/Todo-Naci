#!/usr/bin/env node
/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Program ini perangkat lunak bebas di bawah GNU GPL v3 atau yang lebih baru, TANPA JAMINAN; lihat LICENSE dan NOTICE. */
/* Menyusun www/ dari src/ (tanpa dependensi). Jalankan: node build.js */
'use strict';
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'src');
const out = path.join(__dirname, 'www');

const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; " +
  "connect-src 'self' https://api.github.com; base-uri 'none'; form-action 'none'; object-src 'none'";

function replaceOnce(text, from, to) {
  if (text.split(from).length !== 2) throw new Error('Tidak menemukan tepat satu kecocokan untuk: ' + from.slice(0, 60));
  return text.replace(from, () => to);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(src, out, { recursive: true });
// app.js dan style.css disusun dari potongan berurutan (src/app/*.js, src/css/*.css): urutan nama berkas = urutan cascade/eksekusi
const parts = (dir, ext) => fs.readdirSync(path.join(src, dir)).filter(f => f.endsWith(ext)).sort()
  .map(f => fs.readFileSync(path.join(src, dir, f), 'utf8').replace(/\n*$/, '\n')).join('\n');
fs.rmSync(path.join(out, 'app'), { recursive: true });
// inti logika: modul CommonJS di src/core/ digabung jadi satu berkas peramban (pemuat require mini, global TodoCore)
const coreMods = fs.readdirSync(path.join(src, 'core')).filter(f => f.endsWith('.js')).sort();
const coreDefs = coreMods.map(f => JSON.stringify(f.slice(0, -3)) + ': function (module, exports, require) {\n' +
  fs.readFileSync(path.join(src, 'core', f), 'utf8') + '\n}').join(',\n');
fs.rmSync(path.join(out, 'core'), { recursive: true });
fs.writeFileSync(path.join(out, 'todo-core.js'), "/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Gabungan src/core/*.js (dibuat oleh build.js). */\n" +
  "(function (root) {\n'use strict';\nconst defs = {\n" + coreDefs + "\n};\nconst cache = {};\n" +
  "function load(id) { id = id.replace(/^\\.\\//, '').replace(/\\.js$/, ''); if (!cache[id]) { const m = { exports: {} }; cache[id] = m; defs[id](m, m.exports, load); } return cache[id].exports; }\n" +
  "root.TodoCore = load('index');\n})(typeof globalThis !== 'undefined' ? globalThis : this);\n");
fs.rmSync(path.join(out, 'css'), { recursive: true });
fs.writeFileSync(path.join(out, 'app.js'), parts('app', '.js'));
fs.writeFileSync(path.join(out, 'style.css'), parts('css', '.css'));
// berkas lisensi ikut dikemas ke APK (syarat GPL/OFL: pemberitahuan menyertai salinan)
fs.mkdirSync(path.join(out, 'legal'), { recursive: true });
for (const f of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md']) fs.copyFileSync(path.join(__dirname, f), path.join(out, 'legal', f));
fs.rmSync(path.join(out, 'index.html'));

fs.writeFileSync(path.join(out, 'version.js'), "window.TODO_VERSION = '" + require('./package.json').version + "';\n");

let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
html = replaceOnce(html, 'width=device-width, initial-scale=1"', 'width=device-width, initial-scale=1, viewport-fit=cover"');
html = replaceOnce(html, '<meta charset="utf-8">\n', '<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="' + CSP + '">\n');
html = replaceOnce(html, '<script src="/app.js" defer></script>',
  '<script src="/version.js"></script>\n<script src="/i18n.js"></script>\n<script src="/i18n-en.js"></script>\n<script src="/todo-core.js"></script>\n<script src="/autosync.js"></script>\n<script src="/a11y.js"></script>\n<script src="/vault.js"></script>\n<script src="/lock.js"></script>\n<script src="/local-api.js"></script>\n<script src="/app.js" defer></script>');
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('www siap: ' + fs.readdirSync(out).sort().join(', '));
