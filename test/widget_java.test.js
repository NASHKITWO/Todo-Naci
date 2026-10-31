'use strict';
// Kode Java widget dikompilasi terhadap kelas Android tiruan (test/android-stubs) lalu dijalankan dengan Harness
// yang memeriksa perilaku build(): urutan, hitungan, centang, tombol +, keadaan kosong. Dilewati bila JDK tidak ada.
// Ini menangkap salah ketik/tipe dan salah logika, BUKAN pengganti uji di Android sungguhan.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const pa = require('../tools/patch_android.js');

const have = cmd => { const r = spawnSync(cmd, ['-version'], { encoding: 'utf8' }); return !r.error; };
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

test('widget Java: kompilasi dan perilaku build()', { skip: !have('javac') && 'javac tidak tersedia' }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-'));
  const main = path.join(tmp, 'android', 'app', 'src', 'main');
  const pkgDir = path.join(main, 'java', 'io', 'github', 'nashkitwo', 'todo');
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(path.join(pkgDir, 'MainActivity.java'), 'package io.github.nashkitwo.todo;\npublic class MainActivity extends com.getcapacitor.BridgeActivity {}\n');
  fs.writeFileSync(path.join(main, 'AndroidManifest.xml'), '<manifest><application></application></manifest>');
  fs.writeFileSync(path.join(tmp, 'android', 'app', 'build.gradle'), 'versionCode 1\nversionName "1"\n');
  pa.main(path.join(tmp, 'android'), '0.16.0');
  const sources = walk(path.join(main, 'java')).concat(walk(path.join(__dirname, 'android-stubs')).filter(f => f.endsWith('.java')),
    [path.join(__dirname, 'android-harness', 'Harness.java')]);
  const out = path.join(tmp, 'out');
  const javac = spawnSync('javac', ['-Xlint:-serial', '-d', out, ...sources], { encoding: 'utf8' });
  assert.strictEqual(javac.status, 0, javac.stderr);
  const run = spawnSync('java', ['-cp', out, 'io.github.nashkitwo.todo.Harness'], { encoding: 'utf8' });
  assert.strictEqual(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /OK \d+/);
});
