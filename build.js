#!/usr/bin/env node
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
fs.rmSync(path.join(out, 'index.html'));

fs.writeFileSync(path.join(out, 'version.js'), "window.TODO_VERSION = '" + require('./package.json').version + "';\n");

let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
html = replaceOnce(html, 'width=device-width, initial-scale=1"', 'width=device-width, initial-scale=1, viewport-fit=cover"');
html = replaceOnce(html, '<meta charset="utf-8">\n', '<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="' + CSP + '">\n');
html = replaceOnce(html, '<link rel="stylesheet" href="/style.css">\n', '<link rel="stylesheet" href="/style.css">\n<link rel="stylesheet" href="/mobile.css">\n');
html = replaceOnce(html, '<script src="/app.js" defer></script>',
  '<script src="/version.js"></script>\n<script src="/i18n.js"></script>\n<script src="/i18n-en.js"></script>\n<script src="/todo-core.js"></script>\n<script src="/autosync.js"></script>\n<script src="/a11y.js"></script>\n<script src="/local-api.js"></script>\n<script src="/app.js" defer></script>');
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('www siap: ' + fs.readdirSync(out).sort().join(', '));
