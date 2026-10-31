'use strict';
// Aksesibilitas: audit otomatis (nama, kontras AA, area ketuk 44px di ponsel) di semua tampilan dan tema,
// ditambah perilaku dialog/menu: fokus masuk dan kembali, Tab terjebak, Esc, latar inert, aria-expanded.
// Catatan: ini audit buatan sendiri (axe-core tidak bisa diunduh) dan BUKAN pengganti uji dengan TalkBack.
const test = require('node:test');
const assert = require('node:assert');
const h = require('./helpers.js');

let env;
test.before(async () => { env = await h.start(); });
test.after(async () => { await h.stop(); });

const seed = () => [
  h.task(1, 'Bayar listrik', { deadline: h.day(-1), priority: 1, project: 'rumah', tags: ['tagihan'] }),
  h.task(2, 'Rapat tim', { deadline: h.TODAY, due_time: '15:00' }),
  h.task(3, 'Olahraga', { repeat: '1d', deadline: h.TODAY }),
  h.task(4, 'Sudah beres', { done: true, completed_at: h.TODAY + 'T08:00:00' }),
  h.task(5, 'Induk', { deadline: h.day(2) }),
  h.task(6, 'Anak', { parent_id: 5 }),
];
const active = page => page.evaluate("document.activeElement ? document.activeElement.tagName + '#' + document.activeElement.id + '.' + (document.activeElement.className || '') : ''");

for (const [name, opts, phone] of [
  ['ponsel terang', { width: 390, height: 844 }, true],
  ['ponsel gelap', { width: 390, height: 844, scheme: 'dark' }, true],
  ['desktop terang', { width: 1280, height: 860 }, false],
  ['desktop gelap', { width: 1280, height: 860, scheme: 'dark' }, false],
]) {
  test('audit aksesibilitas (' + name + '): nama, kontras AA' + (phone ? ', area ketuk 44px' : ''), async () => {
    const page = await h.open(env, Object.assign({ seed: seed() }, opts));
    const problems = [];
    const audit = async what => {
      const r = await page.evaluate(h.A11Y_AUDIT);
      for (const k of ['noName', 'contrast'].concat(phone ? ['small'] : [])) for (const x of r[k]) problems.push(what + ' [' + k + '] ' + x);
    };
    await page.waitForTimeout(400);
    await audit('hari ini');
    for (const v of ['Kalender', 'Wawasan', 'Semua tugas']) {
      if (phone) await page.click('#menu-btn');
      await page.locator('#nav-views button', { hasText: v }).click();
      await page.waitForTimeout(300);
      await audit(v);
    }
    await page.locator('#list .row').first().click({ position: { x: 100, y: 10 } });
    await page.waitForTimeout(400);
    await audit('detail');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    if (phone) { await page.click('#menu-btn'); await page.waitForTimeout(300); await audit('menu'); }
    await page.click('#backup-btn');
    await page.waitForTimeout(300);
    await audit('panel cadangan');
    assert.deepStrictEqual(problems, []);
    await h.finish([page]);
  });
}

test('dasar halaman: bahasa, zoom tidak dikunci, satu h1, daftar tidak ber-aria-live, toast diumumkan', async () => {
  const page = await h.open(env, { seed: seed() });
  assert.strictEqual(await page.evaluate('document.documentElement.lang'), 'id');
  const viewport = await page.getAttribute('meta[name=viewport]', 'content');
  assert.ok(!/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(viewport), viewport);
  assert.strictEqual(await page.locator('h1').count(), 1);
  assert.strictEqual(await page.getAttribute('#list', 'aria-live'), null);
  assert.strictEqual(await page.getAttribute('#toasts', 'aria-live'), 'polite');
  const row = page.locator('#list .row').first();
  assert.strictEqual(await row.getAttribute('role'), 'group');
  assert.match(await row.getAttribute('aria-label'), /\S/);
  assert.match(await page.locator('#list .row', { hasText: 'Sudah beres' }).first().getAttribute('aria-label').catch(() => ''), /^$|\(selesai\)/);
  await h.finish([page]);
});

test('panel detail: dialog modal, fokus masuk, Tab terjebak, latar inert, Esc menutup dan fokus kembali ke baris', async () => {
  const page = await h.open(env, { seed: seed(), width: 1280, height: 860 });
  const row = page.locator('#list .row', { hasText: 'Rapat tim' });
  const id = await row.getAttribute('data-id');
  assert.strictEqual(await page.evaluate("document.getElementById('drawer').inert"), true); // tertutup: tidak bisa difokus
  await row.focus();
  await page.keyboard.press('Enter');
  await h.until(page, "document.getElementById('drawer').classList.contains('open')");
  assert.strictEqual(await page.getAttribute('#drawer', 'role'), 'dialog');
  assert.strictEqual(await page.getAttribute('#drawer', 'aria-modal'), 'true');
  assert.match(await page.getAttribute('#drawer', 'aria-label'), /Detail tugas/);
  assert.strictEqual(await page.evaluate("document.getElementById('drawer').inert"), false);
  assert.strictEqual(await page.evaluate("document.querySelector('main.main').inert"), true);
  assert.strictEqual(await page.evaluate("document.getElementById('sidebar').inert"), true);
  assert.strictEqual(await page.evaluate("document.getElementById('drawer').contains(document.activeElement)"), true);
  for (let i = 0; i < 45; i++) {
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate("document.getElementById('drawer').contains(document.activeElement)"), 'Tab keluar dari dialog pada langkah ' + i);
  }
  for (let i = 0; i < 45; i++) {
    await page.keyboard.press('Shift+Tab');
    assert.ok(await page.evaluate("document.getElementById('drawer').contains(document.activeElement)"), 'Shift+Tab keluar dari dialog pada langkah ' + i);
  }
  await page.keyboard.press('Escape');
  await h.until(page, "!document.getElementById('drawer').classList.contains('open')");
  assert.strictEqual(await page.evaluate("document.querySelector('main.main').inert"), false);
  assert.strictEqual(await page.evaluate("document.getElementById('drawer').inert"), true);
  assert.strictEqual(await page.evaluate("document.activeElement.dataset.id"), id);
  await h.finish([page]);
});

test('panel cadangan: dialog modal, Esc menutup, fokus kembali ke tombol (desktop) atau tombol menu (ponsel)', async () => {
  const desktop = await h.open(env, { seed: seed(), width: 1280, height: 860 });
  await desktop.click('#backup-btn');
  assert.strictEqual(await desktop.getAttribute('#backup', 'role'), 'dialog');
  assert.strictEqual(await desktop.getAttribute('#backup', 'aria-modal'), 'true');
  assert.strictEqual(await desktop.getAttribute('#backup', 'aria-labelledby'), 'backup-title');
  assert.strictEqual(await desktop.evaluate("document.activeElement.id"), 'backup-title');
  assert.strictEqual(await desktop.evaluate("document.querySelector('main.main').inert && document.getElementById('sidebar').inert"), true);
  for (let i = 0; i < 70; i++) {
    await desktop.keyboard.press('Tab');
    assert.ok(await desktop.evaluate("document.getElementById('backup').contains(document.activeElement)"), 'Tab keluar pada langkah ' + i);
  }
  await desktop.keyboard.press('Escape');
  assert.strictEqual(await desktop.evaluate("document.getElementById('backup').hidden"), true);
  assert.strictEqual(await desktop.evaluate("document.activeElement.id"), 'backup-btn');
  assert.strictEqual(await desktop.evaluate("document.querySelector('main.main').inert"), false);

  const phone = await h.open(env, { seed: seed(), width: 390, height: 844 });
  await phone.click('#menu-btn');
  await phone.click('#backup-btn');
  assert.strictEqual(await phone.evaluate("document.body.classList.contains('nav-open')"), false); // menu ditutup, tidak tertinggal di belakang
  assert.strictEqual(await phone.evaluate("document.activeElement.id"), 'backup-title');
  await phone.click('#backup-close');
  assert.strictEqual(await phone.evaluate("document.activeElement.id"), 'menu-btn');
  await h.finish([desktop, phone]);
});

test('menu samping di ponsel: tertutup tidak bisa difokus, aria-expanded, fokus masuk, Esc menutup dan fokus kembali', async () => {
  const page = await h.open(env, { seed: seed(), width: 390, height: 844 });
  assert.strictEqual(await page.getAttribute('#menu-btn', 'aria-expanded'), 'false');
  assert.strictEqual(await page.getAttribute('#menu-btn', 'aria-controls'), 'sidebar');
  assert.strictEqual(await page.evaluate("document.getElementById('sidebar').inert"), true);
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    assert.ok(!(await page.evaluate("!!document.activeElement.closest('#sidebar')")), 'fokus masuk ke menu yang tertutup');
  }
  await page.click('#menu-btn');
  assert.strictEqual(await page.getAttribute('#menu-btn', 'aria-expanded'), 'true');
  assert.strictEqual(await page.evaluate("document.getElementById('sidebar').inert"), false);
  assert.strictEqual(await page.evaluate("document.querySelector('main.main').inert"), true);
  assert.strictEqual(await page.evaluate("!!document.activeElement.closest('#sidebar')"), true);
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate("!!document.activeElement.closest('#sidebar')"), 'Tab keluar dari menu terbuka pada langkah ' + i);
  }
  await page.keyboard.press('Escape');
  await h.until(page, "!document.body.classList.contains('nav-open')");
  assert.strictEqual(await page.evaluate("document.activeElement.id"), 'menu-btn');
  assert.strictEqual(await page.getAttribute('#menu-btn', 'aria-expanded'), 'false');
  assert.strictEqual(await page.evaluate("document.getElementById('sidebar').inert"), true);
  await h.finish([page]);
});

test('menu samping di desktop: selalu bisa dipakai (tidak inert)', async () => {
  const page = await h.open(env, { seed: seed(), width: 1280, height: 860 });
  assert.strictEqual(await page.evaluate("document.getElementById('sidebar').inert"), false);
  assert.strictEqual(await page.evaluate("document.querySelector('main.main').inert"), false);
  await h.finish([page]);
});

test('gerak berkurang: animasi dan transisi dimatikan', async () => {
  const ctx = await require('playwright').chromium.launch().then(async b => ({ b, c: await b.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } }) }));
  try {
    const page = await h.open(env, { context: ctx.c, seed: seed() });
    const row = await page.evaluate("(() => { const cs = getComputedStyle(document.querySelector('#list .row')); return [cs.animationName, cs.transitionDuration] })()");
    assert.strictEqual(row[0], 'none');
    assert.match(row[1], /^0s/);
    await h.finish([page]);
  } finally { await ctx.b.close(); }
});
