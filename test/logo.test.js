'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { FRONT, T_BAR, T_STEM, SHINE } = require('../tools/render_icons.js');
const { icon } = require('../tools/make_icons.js');

test('bentuk logo di app sama dengan sumber pembuat ikon', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '01-util.js'), 'utf8');
  for (const d of [FRONT, T_BAR, T_STEM, SHINE]) assert.ok(js.includes("'" + d + "'"), 'path tidak sama: ' + d.slice(0, 20));
});

test('semua PNG ikon yang dibutuhkan patch_android ada dan berformat PNG', () => {
  for (const [kind, sizes] of [['legacy', [48, 72, 96, 144, 192]], ['round', [48, 72, 96, 144, 192]], ['foreground', [108, 162, 216, 324, 432, 576]], ['monochrome', [108, 162, 216, 324, 432]]]) {
    for (const s of sizes) assert.strictEqual(icon(kind, s).subarray(1, 4).toString(), 'PNG', kind + s);
  }
});
