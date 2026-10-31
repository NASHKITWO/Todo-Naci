'use strict';
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers.js');
const { task: T, day: D, TODAY } = h;

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(); });

const titles = page => page.evaluate("Array.from(document.querySelectorAll('#list .row .title')).map(e => e.textContent)");
const rows = page => h.rowCount(page);

test('subtugas inline: buka, centang, progres, tambah, dan geser tidak menyelesaikan induk', async () => {
  const page = await h.open(env, { seed: [T(1, 'Induk', { deadline: TODAY }), T(2, 'Anak 1', { parent_id: 1 }), T(3, 'Anak 2', { parent_id: 1 })] });
  const sel = '.row[data-id="1"]';
  await h.until(page, `document.querySelector('${sel} .chip.subtoggle')`);
  assert.strictEqual(await page.getAttribute(sel + ' .chip.subtoggle', 'aria-expanded'), 'false');
  await page.locator(sel + ' .chip.subtoggle').click();
  await h.until(page, `document.querySelectorAll('${sel} .isub').length === 2`);
  assert.strictEqual(await page.evaluate("document.querySelector('#drawer.open')"), null); // tidak membuka panel
  await page.locator(sel + ' .isub .check').first().click();
  await h.until(page, `document.querySelector('${sel} .chip.subtoggle').textContent.includes('1/2')`);
  await h.until(page, `document.querySelector('${sel} .mini span').style.width === '50%'`);
  const box = page.locator(sel + ' .isub-add input');
  await box.fill('Anak 3');
  await box.press('Enter');
  await h.waitStored(page, d => d.tasks.some(t => t.title === 'Anak 3' && t.parent_id === 1));
  await h.until(page, `document.querySelectorAll('${sel} .isub').length === 3`);
  await h.until(page, "document.activeElement && document.activeElement.closest('.isub-add')");
  await page.evaluate(s => {
    const t = document.querySelector(s + ' .isub .st'), r = t.getBoundingClientRect();
    const f = (ty, x) => t.dispatchEvent(new PointerEvent(ty, { pointerId: 3, pointerType: 'touch', bubbles: true, clientX: x, clientY: r.top + 5 }));
    f('pointerdown', r.left); for (let i = 1; i <= 8; i++) f('pointermove', r.left + 25 * i); f('pointerup', r.left + 200);
  }, sel);
  await page.waitForTimeout(500);
  assert.strictEqual((await h.stored(page)).tasks.find(t => t.id === 1).done, false);
  await page.locator(sel + ' .chip.subtoggle').click();
  await h.until(page, `!document.querySelector('${sel} .subs-inline')`);
  await h.finish([page]);
});

async function pickDay(page, iso) {
  const sel = `.wday[data-day="${iso}"]`;
  if (await page.locator(sel).count() === 0) { await page.click('#week-next'); await h.until(page, `document.querySelector('${sel}')`); }
  await page.locator(sel).click();
}

test('kalender: jalur 7 hari, pilih hari, tambah tugas ke hari terpilih, ganti pekan', async () => {
  const page = await h.open(env, { view: 'Kalender', seed: [T(1, 'Hari ini A', { deadline: D(0) }), T(2, 'Besok A', { deadline: D(1), priority: 1 }), T(3, 'Besok B', { deadline: D(1) }), T(4, 'Tanpa tanggal'), T(5, 'Minggu depan', { deadline: D(7) })] });
  await h.until(page, "!document.querySelector('#week').hidden && document.querySelectorAll('.wday').length === 7");
  await h.until(page, `document.querySelector('.wday.sel').dataset.day === '${D(0)}'`);
  await h.until(page, "document.querySelectorAll('#list .row').length === 1");
  const first = await page.textContent('#week-title');
  await pickDay(page, D(1));
  await h.until(page, "document.querySelectorAll('#list .row').length === 2");
  assert.strictEqual(await page.locator(`.wday[data-day="${D(1)}"] .dots i`).count(), 2);
  await h.typeAdd(page, 'Dari kalender');
  await h.waitStored(page, d => d.tasks.some(t => t.title === 'Dari kalender' && t.deadline === D(1)));
  await h.until(page, "document.querySelectorAll('#list .row').length === 3");
  // pekan: maju, mundur, kembali ke hari ini
  await page.click('#week-today');
  await h.until(page, `document.querySelector('#week-title').textContent === ${JSON.stringify(first)}`);
  await page.click('#week-next');
  await h.until(page, `document.querySelector('#week-title').textContent !== ${JSON.stringify(first)}`);
  await page.click('#week-prev');
  await h.until(page, `document.querySelector('#week-title').textContent === ${JSON.stringify(first)}`);
  await h.finish([page]);
});

test('filter: prioritas tinggi, ber-jam, berulang, dan keadaan kosong', async () => {
  const page = await h.open(env, { seed: [T(1, 'Biasa', { deadline: D(0) }), T(2, 'Penting', { deadline: D(0), priority: 1 }), T(3, 'Jam', { deadline: D(0), due_time: '23:30' }), T(4, 'Ulang', { deadline: D(0), repeat: '1w' })] });
  await h.until(page, "document.querySelectorAll('#list .row').length === 4");
  for (const [f, want] of [['high', 'Penting'], ['timed', 'Jam'], ['repeat', 'Ulang']]) {
    await page.click(`#filters [data-filter="${f}"]`);
    await h.until(page, "document.querySelectorAll('#list .row').length === 1");
    assert.deepStrictEqual(await titles(page), [want]);
    assert.strictEqual(await page.getAttribute(`#filters [data-filter="${f}"]`, 'aria-pressed'), 'true');
  }
  await page.click('#filters [data-filter="all"]');
  await h.until(page, "document.querySelectorAll('#list .row').length === 4");
  await page.click('#filters [data-filter="high"]');
  await page.fill('#search', 'zzz');
  await h.until(page, "document.querySelector('#list .empty')");
  await h.finish([page]);
});

test('urutan: A–Z, prioritas, waktu, terbaru, dan diingat setelah muat ulang', async () => {
  const page = await h.open(env, { view: 'Semua tugas', seed: [T(1, 'Cc', { deadline: D(3), priority: 3 }), T(2, 'Aa', { deadline: D(2), priority: 2 }), T(3, 'Bb', { deadline: D(5), priority: 1 })] });
  await h.until(page, "document.querySelectorAll('#list .row').length === 3");
  for (const [v, want] of [['az', ['Aa', 'Bb', 'Cc']], ['prio', ['Bb', 'Aa', 'Cc']], ['time', ['Aa', 'Cc', 'Bb']], ['new', ['Bb', 'Aa', 'Cc']]]) {
    await page.selectOption('#sort-sel', v);
    await h.until(page, `document.querySelector('#sort-sel').value === '${v}'`);
    assert.deepStrictEqual(await titles(page), want, v);
  }
  await page.selectOption('#sort-sel', 'az');
  await page.reload();
  await page.waitForSelector('#nav-views button');
  await h.view(page, 'Semua tugas');
  await h.until(page, "document.querySelector('#sort-sel').value === 'az'");
  await h.finish([page]);
});

test('wawasan: angka benar (termasuk selesai tepat di hari deadline) dan keadaan kosong', async () => {
  const now = new Date().toISOString().slice(0, 19);
  const done = (id, title, over) => T(id, title, Object.assign({ done: true, completed_at: h.TODAY + 'T09:00:00' }, over));
  const page = await h.open(env, { view: 'Wawasan', seed: [done(1, 'Tepat', { deadline: D(1), project: 'kerja' }), done(2, 'Telat', { deadline: D(-1), project: 'kerja' }), done(3, 'Hari H', { deadline: D(0) }),
    T(4, 'Aktif', { deadline: D(2), priority: 1 }), T(5, 'Merah', { deadline: D(-3), priority: 1 })] });
  await h.until(page, "document.querySelector('#insights')");
  assert.strictEqual(await page.textContent('#kpi-week .v'), '3');
  assert.strictEqual(await page.textContent('#kpi-ontime .v'), '67%');
  assert.strictEqual(await page.textContent('#kpi-overdue .v'), '1');
  assert.strictEqual(await page.locator('#vbars .vcol').count(), 7);
  assert.ok((await page.textContent('#insights')).includes('@kerja'));
  assert.ok(await page.locator('#filters').isHidden());
  const empty = await h.open(env, { view: 'Wawasan' });
  await h.until(empty, "document.querySelector('#kpi-ontime .v')");
  assert.strictEqual(await empty.textContent('#kpi-ontime .v'), '–');
  await h.finish([page, empty]);
});

test('pilih banyak: selesai, tunda, hapus (ke sampah + urungkan), batal, Esc, tekan lama', async () => {
  const page = await h.open(env, { seed: [1, 2, 3, 4].map(i => T(i, 'T' + i, { deadline: D(0) })) });
  await h.until(page, "document.querySelectorAll('#list .row').length === 4");
  const enter = async () => { await page.click('#select-btn'); await h.until(page, "document.body.classList.contains('select-mode') && document.querySelector('#bulkbar')"); };
  await enter();
  assert.ok(await page.locator('#bulk-done').isDisabled());
  await page.click('.row[data-id="1"]'); await page.click('.row[data-id="2"]');
  await h.until(page, "document.querySelector('#bulk-count').textContent === '2 dipilih'");
  assert.strictEqual(await page.evaluate("document.querySelector('#drawer.open')"), null);
  await page.click('#bulk-done');
  await h.waitStored(page, d => d.tasks.filter(t => [1, 2].includes(t.id)).every(t => t.done));
  await h.until(page, "!document.querySelector('#bulkbar') && !document.body.classList.contains('select-mode')");
  await enter();
  await page.click('.row[data-id="3"]'); await page.click('#bulk-tomorrow');
  await h.waitStored(page, d => d.tasks.find(t => t.id === 3).deadline === D(1));
  await enter();
  await page.click('.row[data-id="4"]'); await page.click('#bulk-delete');
  await h.waitStored(page, d => !d.tasks.some(t => t.id === 4));
  // tanpa dialog konfirmasi: masuk sampah, dan bisa diurungkan dari toast
  assert.strictEqual((await h.stored(page)).trash.length, 1);
  await page.click('#toasts button');
  await h.waitStored(page, d => d.tasks.some(t => t.title === 'T4') && d.trash.length === 0);
  const back = (await h.stored(page)).tasks.find(t => t.title === 'T4').id;
  await h.until(page, "document.querySelector('.row[data-id=\"" + back + "\"]')");
  await enter();
  await page.click('.row[data-id="' + back + '"]'); await page.click('#bulk-delete');
  await h.waitStored(page, d => !d.tasks.some(t => t.title === 'T4'));
  // tekan lama masuk mode pilih; Esc keluar
  await h.view(page, 'Semua tugas');
  await h.until(page, "document.querySelector('.row[data-id=\"3\"]')");
  await h.longpress(page, '.row[data-id="3"]');
  await h.until(page, "document.body.classList.contains('select-mode')");
  await page.keyboard.press('Escape');
  await h.until(page, "!document.body.classList.contains('select-mode') && !document.querySelector('#bulkbar')");
  await h.finish([page]);
});

test('keyboard: j/k/x/e/v, dan diabaikan saat mengetik', async () => {
  const page = await h.open(env, { seed: [T(1, 'Satu', { deadline: D(0), priority: 1 }), T(2, 'Dua', { deadline: D(0) }), T(3, 'Tiga', { deadline: D(0), priority: 3 })] });
  await h.until(page, "document.querySelectorAll('#list .row').length === 3");
  await page.keyboard.press('j'); await h.until(page, "document.activeElement.dataset.id === '1'");
  await page.keyboard.press('j'); await h.until(page, "document.activeElement.dataset.id === '2'");
  await page.keyboard.press('k'); await h.until(page, "document.activeElement.dataset.id === '1'");
  await page.keyboard.press('j');
  await page.keyboard.press('x');
  await h.waitStored(page, d => d.tasks.find(t => t.id === 2).done);
  await h.until(page, "document.activeElement && document.activeElement.classList.contains('row')");
  await page.keyboard.press('e');
  await h.until(page, "document.querySelector('#drawer.open')");
  await page.keyboard.press('Escape');
  await h.until(page, "!document.querySelector('#drawer.open')");
  await page.keyboard.press('v'); await h.until(page, "document.body.classList.contains('select-mode')");
  await page.keyboard.press('v'); await h.until(page, "!document.body.classList.contains('select-mode')");
  await page.click('#quick-input');
  await page.keyboard.type('jxkev');
  assert.strictEqual(await page.inputValue('#quick-input'), 'jxkev');
  assert.strictEqual(await page.evaluate("document.body.classList.contains('select-mode')"), false);
  await h.finish([page]);
});

test('duplikat membawa semua isian dan subtugas, asli tetap utuh', async () => {
  const page = await h.open(env, { view: 'Semua tugas', seed: [T(1, 'Asli', { deadline: D(1), due_time: '10:30', priority: 1, project: 'rumah', tags: ['x', 'y'], notes: 'catatan', repeat: '1w' }), T(2, 'Anak', { parent_id: 1 })] });
  await page.locator('.row[data-id="1"] .title').click();
  await h.until(page, "document.querySelector('#drawer.open')");
  await page.click('#f-dup');
  const d = await h.waitStored(page, d => d.tasks.some(t => t.title === 'Asli (salinan)') && d.tasks.some(t => t.title === 'Anak' && t.parent_id !== 1));
  const copy = d.tasks.find(t => t.title === 'Asli (salinan)');
  assert.deepStrictEqual([copy.deadline, copy.due_time, copy.priority, copy.project, copy.repeat, copy.notes], [D(1), '10:30', 1, 'rumah', '1w', 'catatan']);
  assert.deepStrictEqual(copy.tags.slice().sort(), ['x', 'y']);
  assert.strictEqual(d.tasks.filter(t => t.title === 'Asli').length, 1);
  assert.notStrictEqual(copy.uid, d.tasks.find(t => t.title === 'Asli').uid);
  await h.until(page, "document.querySelector('#f-title').value === 'Asli (salinan)'");
  await h.finish([page]);
});
