#!/usr/bin/env node
'use strict';
/* Menyesuaikan proyek Android hasil `npx cap add android`: izin, versi, ikon adaptif, splash, dan widget layar utama.
 * Pakai: node tools/patch_android.js <folder android> <versi> [--no-widget]   (aman dijalankan berulang kali) */
const fs = require('fs');
const path = require('path');
const { icon } = require('./make_icons.js');
const widget = require('./android_widget.js');

const PERMISSIONS = [
  'android.permission.POST_NOTIFICATIONS', 'android.permission.USE_EXACT_ALARM',
  'android.permission.SCHEDULE_EXACT_ALARM', 'android.permission.RECEIVE_BOOT_COMPLETED', 'android.permission.VIBRATE',
];
const LAUNCHER = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const FOREGROUND = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

/* opts.receiverPackage: bila diisi, daftarkan receiver widget untuk paket itu. */
function patchManifest(text, opts) {
  opts = opts || {};
  if (!text.includes('</manifest>')) throw new Error('AndroidManifest.xml tidak valid: tidak ada </manifest>');
  let out = text;
  const missing = PERMISSIONS.filter(p => !out.includes('android:name="' + p + '"'));
  if (missing.length) {
    const lines = missing.map(p => '    <uses-permission android:name="' + p + '" />\n').join('');
    out = out.replace('</manifest>', () => lines + '</manifest>');
  }
  // Cadangan otomatis Android (Google) harus aktif agar data ikut pulih saat ganti HP.
  out = out.replace(/<application\b[^>]*>/, tag => {
    if (/android:allowBackup=/.test(tag)) return tag.replace(/android:allowBackup="[^"]*"/, 'android:allowBackup="true"');
    return tag.replace('<application', '<application android:allowBackup="true"');
  });
  if (opts.receiverPackage && !out.includes('TodoWidgetProvider')) {
    if (!out.includes('</application>')) throw new Error('AndroidManifest.xml tidak valid: tidak ada </application>');
    out = out.replace('</application>', () => widget.receiver(opts.receiverPackage) + '    </application>');
  }
  return out;
}

function patchGradle(text, version) {
  const parts = (version.match(/\d+/g) || []).slice(0, 3).map(Number);
  while (parts.length < 3) parts.push(0);
  const code = parts[0] * 10000 + parts[1] * 100 + parts[2];
  let hits = 0;
  let out = text.replace(/versionCode\s+\d+/, () => { hits++; return 'versionCode ' + code; });
  out = out.replace(/versionName\s+"[^"]*"/, () => { hits++; return 'versionName "' + version + '"'; });
  if (hits !== 2) throw new Error('versionCode/versionName tidak ditemukan di build.gradle');
  return out;
}

const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };

const ADAPTIVE = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_gradient" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
`;
const GRADIENT = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#1B2F66" />
</shape>
`;
const SPLASH = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <shape android:shape="rectangle">
            <solid android:color="#1B2F66" />
        </shape>
    </item>
    <item>
        <bitmap android:gravity="center" android:src="@drawable/splash_glyph" />
    </item>
</layer-list>
`;

function writeIcons(resDir) {
  const cache = new Map();
  const get = (kind, size) => { const k = kind + size; if (!cache.has(k)) cache.set(k, icon(kind, size)); return cache.get(k); };
  for (const [density, size] of Object.entries(LAUNCHER)) {
    const dir = path.join(resDir, 'mipmap-' + density);
    if (fs.existsSync(dir)) {
      write(path.join(dir, 'ic_launcher.png'), get('legacy', size));
      write(path.join(dir, 'ic_launcher_round.png'), get('round', size));
    }
  }
  for (const [density, size] of Object.entries(FOREGROUND)) {
    const dir = path.join(resDir, 'mipmap-' + density);
    if (fs.existsSync(dir)) {
      write(path.join(dir, 'ic_launcher_foreground.png'), get('foreground', size));
      write(path.join(dir, 'ic_launcher_monochrome.png'), get('monochrome', size));
    }
  }
  write(path.join(resDir, 'drawable', 'ic_launcher_gradient.xml'), GRADIENT);
  for (const n of ['ic_launcher.xml', 'ic_launcher_round.xml']) write(path.join(resDir, 'mipmap-anydpi-v26', n), ADAPTIVE);
  // warna latar lama yang dirujuk template Capacitor: samakan dengan warna awal gradien
  const colors = path.join(resDir, 'values', 'ic_launcher_background.xml');
  if (fs.existsSync(colors)) write(colors, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1B2F66</color>\n</resources>\n');
}

/* Splash: satu layer-list (gradien + glyph di tengah) menggantikan splash.png bawaan di semua kualifikasi. */
function writeSplash(resDir) {
  if (!fs.existsSync(resDir)) return;
  for (const d of fs.readdirSync(resDir)) {
    if (!/^drawable(-|$)/.test(d)) continue;
    const old = path.join(resDir, d, 'splash.png');
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }
  write(path.join(resDir, 'drawable', 'splash.xml'), SPLASH);
  write(path.join(resDir, 'drawable-nodpi', 'splash_glyph.png'), icon('foreground', 576));
}

function findMainActivity(javaDir) {
  const stack = [javaDir];
  while (stack.length) {
    const dir = stack.pop();
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name === 'MainActivity.java') return p;
    }
  }
  return null;
}

function packageOf(javaFile) {
  const m = /^\s*package\s+([\w.]+)\s*;/m.exec(fs.readFileSync(javaFile, 'utf8'));
  if (!m) throw new Error('paket tidak ditemukan di ' + javaFile);
  return m[1];
}

function writeWidget(mainDir, pkg) {
  for (const f of widget.files(pkg)) write(path.join(mainDir, f.path), f.content);
}

function main(androidDir, version, opts) {
  opts = opts || {};
  const mainDir = path.join(androidDir, 'app', 'src', 'main');
  const manifest = path.join(mainDir, 'AndroidManifest.xml');
  let pkg = null;
  if (opts.widget !== false) {
    const activity = findMainActivity(path.join(mainDir, 'java'));
    if (!activity) throw new Error('MainActivity.java tidak ditemukan (jalankan `npx cap add android` dulu), atau pakai --no-widget');
    pkg = packageOf(activity);
  }
  fs.writeFileSync(manifest, patchManifest(fs.readFileSync(manifest, 'utf8'), { receiverPackage: pkg }));
  const gradle = path.join(androidDir, 'app', 'build.gradle');
  fs.writeFileSync(gradle, patchGradle(fs.readFileSync(gradle, 'utf8'), version));
  writeIcons(path.join(mainDir, 'res'));
  writeSplash(path.join(mainDir, 'res'));
  if (pkg) writeWidget(mainDir, pkg);
  console.log('Android dipatch: izin, versi ' + version + ', ikon, splash' + (pkg ? ', widget (' + pkg + ')' : ', tanpa widget') + '.');
}

module.exports = { patchManifest, patchGradle, writeIcons, writeSplash, writeWidget, main, PERMISSIONS };
if (require.main === module) {
  const args = process.argv.slice(2);
  const noWidget = args.includes('--no-widget');
  const rest = args.filter(a => a !== '--no-widget');
  if (rest.length !== 2) { console.error('pakai: patch_android.js <folder android> <versi> [--no-widget]'); process.exit(1); }
  main(rest[0], rest[1], { widget: !noWidget });
}
