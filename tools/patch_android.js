#!/usr/bin/env node
/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Program ini perangkat lunak bebas di bawah GNU GPL v3 atau yang lebih baru, TANPA JAMINAN; lihat LICENSE dan NOTICE. */
'use strict';
/* Menyesuaikan proyek Android hasil `npx cap add android`: izin, versi, ikon adaptif, splash, dan widget layar utama.
 * Pakai: node tools/patch_android.js <folder android> <versi> [--no-widget] [--signing]   (aman dijalankan berulang kali) */
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
    const lines = missing.map(p => '    <uses-permission android:name="' + p + '"' + (p === 'android.permission.SCHEDULE_EXACT_ALARM' ? ' android:maxSdkVersion="32"' : '') + ' />\n').join('');
    out = out.replace('</manifest>', () => lines + '</manifest>');
  }
  // Tidak ada lalu lintas tanpa enkripsi (token GitHub hanya lewat HTTPS).
  out = out.replace(/<application\b[^>]*>/, tag => /android:usesCleartextTraffic=/.test(tag) ? tag.replace(/android:usesCleartextTraffic="[^"]*"/, 'android:usesCleartextTraffic="false"') : tag.replace('<application', '<application android:usesCleartextTraffic="false"'));
  // Cadangan otomatis Android (Google) harus aktif agar data ikut pulih saat ganti HP.
  out = out.replace(/<application\b[^>]*>/, tag => {
    if (/android:allowBackup=/.test(tag)) return tag.replace(/android:allowBackup="[^"]*"/, 'android:allowBackup="true"');
    return tag.replace('<application', '<application android:allowBackup="true"');
  });
  // Rahasia sinkron (SharedPreferences todo_secrets) dikecualikan dari cadangan Google/adb dan transfer perangkat.
  if (opts.receiverPackage || opts.timePackage) {
    out = out.replace(/<application\b[^>]*>/, tag => {
      let t = tag;
      if (!/android:fullBackupContent=/.test(t)) t = t.replace('<application', '<application android:fullBackupContent="@xml/todo_backup_rules"');
      if (!/android:dataExtractionRules=/.test(t)) t = t.replace('<application', '<application android:dataExtractionRules="@xml/todo_data_extraction_rules"');
      return t;
    });
  }
  // Menu Bagikan Android: teks dari aplikasi lain masuk sebagai tugas (ditangani MainActivity + plugin TodoWidget).
  if (opts.receiverPackage && !out.includes('android.intent.action.SEND')) {
    const selfClosed = /<activity\b[^>]*?\s*\/>/.exec(out);
    const i = out.indexOf('</activity>');
    if (selfClosed) {
      const open = selfClosed[0].replace(/\s*\/>$/, '>');
      out = out.replace(selfClosed[0], () => open + '\n' + widget.SHARE_FILTER + '        </activity>');
    } else if (i >= 0) {
      out = out.slice(0, i) + widget.SHARE_FILTER + '        ' + out.slice(i);
    } // tanpa <activity> (manifest tak lazim): menu Bagikan dilewati
  }
  const pkgForTime = opts.timePackage || opts.receiverPackage;
  if (pkgForTime && !out.includes('TodoTimeReceiver')) {
    if (!out.includes('</application>')) throw new Error('AndroidManifest.xml tidak valid: tidak ada </application>');
    out = out.replace('</application>', () => widget.timeReceiver(pkgForTime) + '    </application>');
  }
  if (opts.receiverPackage && !out.includes('TodoWidgetProvider')) {
    if (!out.includes('</application>')) throw new Error('AndroidManifest.xml tidak valid: tidak ada </application>');
    out = out.replace('</application>', () => widget.receiver(opts.receiverPackage) + '    </application>');
  }
  return out;
}

function patchGradle(text, version, opts) {
  opts = opts || {};
  const parts = (version.match(/\d+/g) || []).slice(0, 3).map(Number);
  while (parts.length < 3) parts.push(0);
  const code = parts[0] * 10000 + parts[1] * 100 + parts[2];
  let hits = 0;
  let out = text.replace(/versionCode\s+\d+/, () => { hits++; return 'versionCode ' + code; });
  out = out.replace(/versionName\s+"[^"]*"/, () => { hits++; return 'versionName "' + version + '"'; });
  if (hits !== 2) throw new Error('versionCode/versionName tidak ditemukan di build.gradle');
  // APK yang dibagikan dibangun dari varian debug: tanpa ini ia "debuggable" sehingga siapa pun dengan akses adb/USB bisa
  // `run-as` membaca seluruh data aplikasi (token sinkron, PIN hash, tugas) dan menempel debugger WebView. Matikan.
  if (!/debuggable\s+false/.test(out)) {
    if (/buildTypes\s*\{\s*debug\s*\{/.test(out)) out = out.replace(/(buildTypes\s*\{\s*debug\s*\{)/, '$1\n            debuggable false');
    else if (/buildTypes\s*\{/.test(out)) out = out.replace(/buildTypes\s*\{/, 'buildTypes {\n        debug {\n            debuggable false\n        }');
    else throw new Error('buildTypes tidak ditemukan di build.gradle (tidak bisa mematikan debuggable)');
  }
  // Penandatanganan rilis dengan keystore TETAP (dari GitHub Secret lewat variabel lingkungan). Tanpa ini tiap build CI
  // memakai keystore debug yang dibuat ulang di runner baru: tanda tangan berubah, APK baru tidak bisa menimpa yang lama.
  if (opts.signing && !/signingConfigs\s*\{/.test(out)) {
    const cfg = `    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_FILE") ?: "release.keystore")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
`;
    if (!/\n\s*buildTypes\s*\{/.test(out)) throw new Error('buildTypes tidak ditemukan di build.gradle (tidak bisa memasang signingConfig)');
    out = out.replace(/\n(\s*)buildTypes\s*\{/, (m) => '\n' + cfg + m.slice(1));
    if (!/release\s*\{/.test(out.slice(out.indexOf('buildTypes')))) throw new Error('blok release tidak ditemukan di build.gradle');
    out = out.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{)/, '$1\n            signingConfig signingConfigs.release');
  }
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
    <solid android:color="#0B2A5B" />
</shape>
`;
const SPLASH = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <shape android:shape="rectangle">
            <solid android:color="#0B2A5B" />
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
  if (fs.existsSync(colors)) write(colors, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0B2A5B</color>\n</resources>\n');
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

function writeMinimal(mainDir, pkg) {
  for (const f of widget.minimalFiles(pkg)) write(path.join(mainDir, f.path), f.content);
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
  // --no-widget tetap memasang plugin layar aman + penerima zona waktu bila MainActivity ditemukan.
  let minPkg = null;
  if (opts.widget === false) {
    const activity = findMainActivity(path.join(mainDir, 'java'));
    if (activity) minPkg = packageOf(activity);
  }
  fs.writeFileSync(manifest, patchManifest(fs.readFileSync(manifest, 'utf8'), { receiverPackage: pkg, timePackage: minPkg }));
  const gradle = path.join(androidDir, 'app', 'build.gradle');
  fs.writeFileSync(gradle, patchGradle(fs.readFileSync(gradle, 'utf8'), version, { signing: !!opts.signing }));
  writeIcons(path.join(mainDir, 'res'));
  writeSplash(path.join(mainDir, 'res'));
  if (pkg) writeWidget(mainDir, pkg);
  else if (minPkg) writeMinimal(mainDir, minPkg);
  console.log('Android dipatch: izin, versi ' + version + ', ikon, splash' + (pkg ? ', widget (' + pkg + ')' : ', tanpa widget') + '.');
}

module.exports = { patchManifest, patchGradle, writeIcons, writeSplash, writeWidget, main, PERMISSIONS };
if (require.main === module) {
  const args = process.argv.slice(2);
  const noWidget = args.includes('--no-widget');
  const signing = args.includes('--signing');
  const rest = args.filter(a => a !== '--no-widget' && a !== '--signing');
  if (rest.length !== 2) { console.error('pakai: patch_android.js <folder android> <versi> [--no-widget] [--signing]'); process.exit(1); }
  main(rest[0], rest[1], { widget: !noWidget, signing });
}
