'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const pa = require('../tools/patch_android.js');

const MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:allowBackup="false" android:label="Tuntas Harian"><activity android:name=".MainActivity" /></application>

    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
</manifest>
`;
const GRADLE = `android {
    defaultConfig {
        applicationId "io.github.nashkitwo.todo"
        versionCode 1
        versionName "1.0"
    }
}
`;
const PKG = 'io.github.nashkitwo.todo';

test('izin ditambahkan sekali saja', () => {
  const once = pa.patchManifest(MANIFEST);
  for (const p of pa.PERMISSIONS) assert.strictEqual(once.split('android:name="' + p + '"').length - 1, 1);
  assert.ok(once.includes('android.permission.INTERNET'));
  assert.strictEqual(pa.patchManifest(once), once);
  assert.ok(once.trimEnd().endsWith('</manifest>'));
  assert.throws(() => pa.patchManifest('bukan xml'));
});

test('cadangan otomatis Android dipaksa aktif; tanpa atribut pun ditambahkan', () => {
  assert.ok(pa.patchManifest(MANIFEST).includes('android:allowBackup="true"'));
  assert.ok(!pa.patchManifest(MANIFEST).includes('allowBackup="false"'));
  const bare = pa.patchManifest(MANIFEST.replace(' android:allowBackup="false"', ''));
  assert.strictEqual(bare.split('allowBackup').length - 1, 1);
  assert.ok(bare.includes('allowBackup="true"'));
});

test('receiver widget didaftarkan sekali, di dalam <application>', () => {
  const once = pa.patchManifest(MANIFEST, { receiverPackage: PKG });
  assert.strictEqual(once.split('TodoWidgetProvider').length - 1, 1);
  assert.ok(once.indexOf('TodoWidgetProvider') < once.indexOf('</application>'));
  assert.strictEqual(pa.patchManifest(once, { receiverPackage: PKG }), once);
  assert.ok(!pa.patchManifest(MANIFEST).includes('TodoWidgetProvider'));
});

test('versi gradle', () => {
  const out = pa.patchGradle(GRADLE, '0.8.0');
  assert.ok(out.includes('versionCode 800') && out.includes('versionName "0.8.0"') && out.includes('applicationId "io.github.nashkitwo.todo"'));
  assert.ok(pa.patchGradle(GRADLE, '1.2.3').includes('versionCode 10203'));
  assert.throws(() => pa.patchGradle('tanpa versi', '1.0.0'));
});

function fakeProject() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apk-'));
  const main = path.join(tmp, 'app', 'src', 'main');
  const res = path.join(main, 'res');
  for (const d of ['mipmap-mdpi', 'mipmap-xxxhdpi', 'drawable', 'drawable-land-hdpi', 'drawable-port-xhdpi', 'values'])
    fs.mkdirSync(path.join(res, d), { recursive: true });
  for (const d of ['drawable', 'drawable-land-hdpi', 'drawable-port-xhdpi']) fs.writeFileSync(path.join(res, d, 'splash.png'), 'lama');
  fs.writeFileSync(path.join(res, 'values', 'ic_launcher_background.xml'), '<resources><color name="ic_launcher_background">#FFFFFF</color></resources>');
  const java = path.join(main, 'java', ...PKG.split('.'));
  fs.mkdirSync(java, { recursive: true });
  fs.writeFileSync(path.join(java, 'MainActivity.java'), 'package ' + PKG + ';\n\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {}\n');
  fs.writeFileSync(path.join(main, 'AndroidManifest.xml'), MANIFEST);
  fs.writeFileSync(path.join(tmp, 'app', 'build.gradle'), GRADLE);
  return { tmp, main, res, java };
}
const pngInfo = buf => ({ sig: [...buf.subarray(0, 8)], w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), colorType: buf[25] });

test('proyek palsu: izin, versi, ikon RGBA, ikon adaptif, splash, dan widget', () => {
  const { tmp, main, res, java } = fakeProject();
  pa.main(tmp, '0.8.0');
  const legacy = pngInfo(fs.readFileSync(path.join(res, 'mipmap-mdpi', 'ic_launcher.png')));
  assert.deepStrictEqual(legacy.sig, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.strictEqual(legacy.w, 48);
  assert.strictEqual(legacy.colorType, 6); // RGBA
  const fg = pngInfo(fs.readFileSync(path.join(res, 'mipmap-xxxhdpi', 'ic_launcher_foreground.png')));
  assert.strictEqual(fg.w, 432);
  assert.ok(fs.existsSync(path.join(res, 'mipmap-xxxhdpi', 'ic_launcher_monochrome.png')));
  assert.ok(!fs.existsSync(path.join(res, 'mipmap-hdpi')));
  for (const n of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    const xml = fs.readFileSync(path.join(res, 'mipmap-anydpi-v26', n), 'utf8');
    assert.ok(xml.includes('<monochrome') && xml.includes('@mipmap/ic_launcher_foreground'));
  }
  assert.ok(fs.readFileSync(path.join(res, 'values', 'ic_launcher_background.xml'), 'utf8').includes('#1B2F66'));
  // splash: png lama hilang di semua kualifikasi, diganti satu layer-list + glyph
  for (const d of ['drawable', 'drawable-land-hdpi', 'drawable-port-xhdpi']) assert.ok(!fs.existsSync(path.join(res, d, 'splash.png')), d);
  assert.ok(fs.readFileSync(path.join(res, 'drawable', 'splash.xml'), 'utf8').includes('@drawable/splash_glyph'));
  assert.strictEqual(pngInfo(fs.readFileSync(path.join(res, 'drawable-nodpi', 'splash_glyph.png'))).w, 576);
  // widget
  for (const f of ['TodoWidgetProvider.java', 'TodoWidgetPlugin.java']) {
    assert.ok(fs.readFileSync(path.join(java, f), 'utf8').startsWith('package ' + PKG + ';'), f);
  }
  assert.ok(fs.readFileSync(path.join(java, 'MainActivity.java'), 'utf8').includes('registerPlugin(TodoWidgetPlugin.class)'));
  for (const f of ['layout/widget_todo.xml', 'drawable/widget_bg.xml', 'xml/todo_widget_info.xml', 'values/widget_colors.xml', 'values-night/widget_colors.xml']) assert.ok(fs.existsSync(path.join(res, f)), f);
  assert.notStrictEqual(fs.readFileSync(path.join(res, 'values', 'widget_colors.xml'), 'utf8'), fs.readFileSync(path.join(res, 'values-night', 'widget_colors.xml'), 'utf8'));
  const layout = fs.readFileSync(path.join(res, 'layout', 'widget_todo.xml'), 'utf8');
  assert.ok(layout.includes('@color/widget_text') && !/#[0-9A-Fa-f]{6}"/.test(layout.replace(/android:text="[^"]*"/g, '')), 'warna layout harus dari resource (agar mengikuti tema)');
  assert.ok(layout.includes('widget_add') && layout.includes('contentDescription="Tambah tugas"'));
  const manifest = fs.readFileSync(path.join(main, 'AndroidManifest.xml'), 'utf8');
  assert.ok(manifest.includes('POST_NOTIFICATIONS') && manifest.includes(PKG + '.TodoWidgetProvider') && manifest.includes('allowBackup="true"'));
  const before = manifest;
  pa.main(tmp, '0.8.0'); // aman diulang
  assert.strictEqual(fs.readFileSync(path.join(main, 'AndroidManifest.xml'), 'utf8'), before);
});

test('--no-widget: tanpa berkas dan receiver widget, MainActivity tak diubah', () => {
  const { tmp, main, res, java } = fakeProject();
  const original = fs.readFileSync(path.join(java, 'MainActivity.java'), 'utf8');
  pa.main(tmp, '0.8.0', { widget: false });
  assert.ok(!fs.existsSync(path.join(java, 'TodoWidgetProvider.java')));
  assert.ok(!fs.existsSync(path.join(res, 'layout', 'widget_todo.xml')));
  assert.ok(!fs.readFileSync(path.join(main, 'AndroidManifest.xml'), 'utf8').includes('TodoWidgetProvider'));
  assert.strictEqual(fs.readFileSync(path.join(java, 'MainActivity.java'), 'utf8'), original);
  assert.ok(fs.existsSync(path.join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml')));
});

test('widget tanpa MainActivity memberi pesan yang jelas', () => {
  const { tmp, java } = fakeProject();
  fs.rmSync(path.join(java, 'MainActivity.java'));
  assert.throws(() => pa.main(tmp, '0.8.0'), /MainActivity\.java tidak ditemukan/);
});

test('XML yang dihasilkan well-formed', () => {
  const { tmp, main, res } = fakeProject();
  pa.main(tmp, '0.8.0');
  const files = ['AndroidManifest.xml', 'res/layout/widget_todo.xml', 'res/drawable/widget_bg.xml', 'res/xml/todo_widget_info.xml',
    'res/drawable/splash.xml', 'res/drawable/ic_launcher_gradient.xml', 'res/values/widget_colors.xml', 'res/values-night/widget_colors.xml', 'res/mipmap-anydpi-v26/ic_launcher.xml'];
  for (const f of files) {
    const r = require('child_process').spawnSync('xmllint', ['--noout', path.join(main, f)]);
    if (r.error && r.error.code === 'ENOENT') return; // xmllint tidak ada: lewati
    assert.strictEqual(r.status, 0, f + ': ' + r.stderr);
  }
});

test('build.js menghasilkan www dengan CSP ketat dan tanpa referensi server', () => {
  require('child_process').execFileSync(process.execPath, [path.join(__dirname, '..', 'build.js')]);
  const html = fs.readFileSync(path.join(__dirname, '..', 'www', 'index.html'), 'utf8');
  assert.ok(html.includes("script-src 'self'"));
  assert.ok(html.indexOf('todo-core.js') < html.indexOf('local-api.js') && html.indexOf('local-api.js') < html.indexOf('app.js'));
  assert.ok(!/manifest|login|logout/i.test(html));
});
