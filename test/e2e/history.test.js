'use strict';
// Riwayat hari tuntas di Wawasan.
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers');
const { task: T, TODAY, day: D } = h;

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(); });

test('kalender hari tuntas: 35 sel, hari tuntas ditandai, rekor dan streak > 7 hari', async () => {
  const seed = [];
  for (let i = 1; i <= 9; i++) seed.push(T(i, 'Rutin ' + i, { done: true, completed_at: D(-i) + 'T09:00:00', deadline: D(-i) }));
  seed.push(T(20, 'Hari ini', { deadline: TODAY }));
  const page = await h.open(env, { seed, view: 'Wawasan' });
  await h.until(page, "document.querySelector('#tcal')");
  assert.strictEqual(await page.evaluate("document.querySelectorAll('#tcal .tc').length"), 35);
  assert.strictEqual(await page.evaluate("document.querySelectorAll('#tcal .tc.full').length"), 9);
  assert.ok(await page.evaluate(`document.querySelector('#tcal [data-day="${D(-3)}"]').classList.contains('full')`));
  assert.ok(await page.evaluate("document.querySelector('#tcal .tc.today')"));
  assert.strictEqual(await page.textContent('#kpi-streak .v'), '9'); // lebih dari 7 hari
  assert.ok((await page.textContent('#insights')).includes('9'));
  await h.finish([page]);
});
