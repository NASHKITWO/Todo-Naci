'use strict';
// Pengulangan hari kerja / hari tertentu / 2 minggu lewat UI.
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers');
const { task: T, TODAY } = h;

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(); });

test('panel tugas: Hari kerja, Hari tertentu (pilih hari, minimal satu), 2 minggu', async () => {
  const page = await h.open(env, { seed: [T(1, 'Senam', { deadline: TODAY })] });
  await h.until(page, "document.querySelector('.row[data-id=\"1\"]')");
  await page.click('.row[data-id="1"] .title');
  await h.until(page, "document.querySelector('#f-repeat')");
  const rep = async () => (await h.stored(page)).tasks[0].repeat;
  await page.selectOption('#f-repeat', 'wd');
  await h.waitStored(page, d => d.tasks[0].repeat === 'wd');
  assert.ok(await page.evaluate("document.querySelector('#f-repeat-days').hidden"));
  await page.selectOption('#f-repeat', '2w');
  await h.waitStored(page, d => d.tasks[0].repeat === '2w');
  await page.selectOption('#f-repeat', 'dow');
  await h.until(page, "!document.querySelector('#f-repeat-days').hidden");
  await h.until(page, "(JSON.parse(localStorage.getItem('todo-cli.data.v1')).tasks[0].repeat || '').startsWith('dow:')");
  // pilih Senin dan Kamis saja: tambahkan dulu yang dimau, baru matikan sisanya
  await page.evaluate(`(() => { const want = ['1','4'], q = () => Array.from(document.querySelectorAll('#f-repeat-days button'));
    for (const b of q()) if (want.includes(b.dataset.dow) && b.getAttribute('aria-pressed') !== 'true') b.click();
    for (const b of q()) if (!want.includes(b.dataset.dow) && b.getAttribute('aria-pressed') === 'true') b.click();
  })()`);
  await h.waitStored(page, d => d.tasks[0].repeat === 'dow:1,4');
  // hari terakhir tidak bisa dimatikan
  await page.click('#f-repeat-days [data-dow="4"]');
  await h.waitStored(page, d => d.tasks[0].repeat === 'dow:1');
  await page.click('#f-repeat-days [data-dow="1"]');
  assert.strictEqual(await rep(), 'dow:1');
  // tampil di baris sebagai label
  await page.evaluate("document.querySelector('.drawer-head [aria-label=\"Tutup panel\"]').click()");
  await h.until(page, "document.querySelector('.row[data-id=\"1\"]').textContent.includes('Sen')");
  await h.finish([page]);
});

test('menyelesaikan tugas "hari kerja" memunculkan kemunculan di hari kerja berikutnya', async () => {
  const page = await h.open(env, { seed: [T(1, 'Absen', { deadline: TODAY, repeat: 'wd' })] });
  await h.until(page, "document.querySelector('.row[data-id=\"1\"]')");
  await page.evaluate("window.todoLocalApi('POST', '/api/tasks/1/done')");
  await h.waitStored(page, d => d.tasks.length === 2);
  const next = (await h.stored(page)).tasks.find(t => !t.done);
  const dow = new Date(next.deadline + 'T00:00:00').getDay();
  assert.ok(next.deadline > TODAY && dow >= 1 && dow <= 5, next.deadline);
  assert.strictEqual(next.repeat, 'wd');
  await h.finish([page]);
});
