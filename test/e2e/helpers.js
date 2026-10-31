'use strict';
// Pembantu tes browser: server statis untuk www/, Chromium (Playwright), pemantau pelanggaran CSP,
// Capacitor palsu (agar notifikasi/berbagi bisa diperiksa tanpa HP), dan data awal lewat localStorage.
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const WWW = path.join(ROOT, 'www');
const KEY = 'todo-cli.data.v1';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const CSP_WATCHER = `
window.__csp = [];
document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' <- ' + (e.blockedURI || 'inline')));`;

const FAKE_CAPACITOR = `
window.__scheduled = []; window.__cancelled = []; window.__pending = []; window.__shared = null; window.__written = null;
window.__writes = []; window.__widget = []; window.__fsFail = false;
window.__widgetDone = []; window.__widgetCleared = []; window.__widgetAction = '';
window.Capacitor = {
  isNativePlatform: () => true,
  Plugins: {
    LocalNotifications: {
      checkPermissions: async () => ({display: 'granted'}),
      requestPermissions: async () => ({display: 'granted'}),
      getPending: async () => ({notifications: window.__pending.map(id => ({id}))}),
      registerActionTypes: async (o) => { window.__actionTypes = (window.__actionTypes || []).concat(o.types); },
      addListener: async (name, fn) => { (window.__lnListeners = window.__lnListeners || {})[name] = fn; return {remove: async () => {}}; },
      removeDeliveredNotifications: async (o) => { window.__removed = (window.__removed || []).concat(o.notifications.map(n => n.id)); },
      cancel: async (o) => { window.__cancelled.push(...o.notifications.map(n => n.id)); window.__pending = []; },
      schedule: async (o) => {
        for (const n of o.notifications) window.__scheduled.push({id: n.id, title: n.title, body: n.body,
          at: new Date(n.schedule.at).toISOString(), idle: n.schedule.allowWhileIdle, actionTypeId: n.actionTypeId, extra: n.extra});
        window.__pending = o.notifications.map(n => n.id);
      },
    },
    Share: {share: async (o) => { window.__shared = o; }},
    Filesystem: {writeFile: async (o) => {
      if (window.__fsFail) throw new Error('Permission denied');
      window.__written = o; window.__writes.push(o); return {uri: 'file:///cache/' + o.path};
    }},
    TodoWidget: {
      update: async (o) => { window.__widget.push(JSON.parse(o.items)); },
      completed: async () => ({uids: window.__widgetDone.slice()}),
      clearCompleted: async (o) => { window.__widgetCleared.push(...o.uids); window.__widgetDone = window.__widgetDone.filter(u => !o.uids.includes(u)); },
      action: async () => { const a = window.__widgetAction; window.__widgetAction = ''; return {action: a}; },
    },
  },
};`;


/* Audit aksesibilitas (dijalankan di halaman): nama aksesibel, kontras WCAG AA, dan ukuran area ketuk sesungguhnya
 * (diukur dengan elementFromPoint, jadi area yang diperluas lewat ::after ikut dihitung). */
const A11Y_AUDIT = `(() => {
  const out = { noName: [], contrast: [], small: [], focusableHidden: [] };
  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]') && !el.closest('[inert]'); };
  const label = el => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''));
  const name = el => {
    const lb = el.getAttribute('aria-labelledby');
    if (lb) return lb.split(' ').map(i => (document.getElementById(i) || {}).textContent || '').join(' ').trim();
    const al = el.getAttribute('aria-label'); if (al && al.trim()) return al.trim();
    if (el.labels && el.labels.length) return Array.from(el.labels).map(l => l.textContent).join(' ').trim();
    const t = (el.textContent || '').trim(); if (t) return t;
    return (el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
  };
  const hit = el => {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const inside = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && (e === el || el.contains(e)); };
    const reach = (dx, dy) => { let n = 0; while (n < 40 && inside(cx + dx * (n + 1), cy + dy * (n + 1))) n++; return n; };
    return [reach(1, 0) + reach(-1, 0) + 1, reach(0, 1) + reach(0, -1) + 1];
  };
  const sel = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=checkbox], [role=tab]';
  for (const el of document.querySelectorAll(sel)) {
    if (!vis(el)) continue;
    if (!name(el)) out.noName.push(label(el));
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    const r = el.getBoundingClientRect();
    if (r.left + r.width / 2 > innerWidth || r.left + r.width / 2 < 0 || r.top + r.height / 2 > innerHeight || r.top + r.height / 2 < 0) continue;
    const [w, h] = hit(el);
    if (Math.min(w, h) < 44 && !el.closest('.sr-only')) out.small.push(label(el) + ' ' + w + 'x' + h);
  }
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const parse = s => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { c: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
  const bgOf = el => { const layers = []; for (let n = el; n; n = n.parentElement) { const b = parse(getComputedStyle(n).backgroundColor); if (b && b.a > 0) { layers.push(b); if (b.a >= 1) break; } } let base = [255, 255, 255]; if (!layers.length || layers[layers.length - 1].a < 1) { const b = parse(getComputedStyle(document.documentElement).backgroundColor); const bb = parse(getComputedStyle(document.body).backgroundColor); base = (bb && bb.a === 1 ? bb.c : (b && b.a === 1 ? b.c : [255, 255, 255])); } for (let i = layers.length - 1; i >= 0; i--) { const l = layers[i]; base = base.map((v, k) => v * (1 - l.a) + l.c[k] * l.a); } return base; };
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    const own = Array.from(el.childNodes).filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
    if (!own) continue;
    const cs = getComputedStyle(el); if (parseFloat(cs.opacity) < 1 && el.closest('.toast')) continue;
    const fg = parse(cs.color); if (!fg) continue;
    const bg = bgOf(el);
    const fc = fg.c.map((v, k) => v * fg.a + bg[k] * (1 - fg.a));
    const L1 = lum(fc), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700;
    const need = (px >= 24 || (px >= 18.66 && bold)) ? 3 : 4.5;
    const key = label(el) + '|' + cs.color + '|' + bg.join(',');
    if (ratio < need && !seen.has(key)) { seen.add(key); out.contrast.push(ratio.toFixed(2) + ' (<' + need + ') ' + label(el) + ' "' + own.slice(0, 24) + '"'); }
  }
  return out;
})()`;

const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const TODAY = day(0);

let server = null, browser = null;

/* GitHub Gist palsu (dipakai bersama beberapa konteks = beberapa "ponsel"). */
function fakeGithub(token) {
  const gists = [];
  let n = 0;
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  const gh = { gists, calls: [], async attach(ctx) {
    await ctx.route('https://api.github.com/**', async route => {
      const req = route.request();
      const json = (status, body) => route.fulfill({ status, headers: Object.assign({ 'content-type': 'application/json' }, cors), body: JSON.stringify(body) });
      if (gh.offline) return route.abort('failed');
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      gh.calls.push(req.method() + ' ' + req.url().replace('https://api.github.com', ''));
      if (req.headers().authorization !== 'Bearer ' + token) return json(401, { message: 'Bad credentials' });
      const url = new URL(req.url());
      const body = req.postData() ? JSON.parse(req.postData()) : null;
      if (req.method() === 'GET' && url.pathname === '/gists') return json(200, gists.slice().reverse().map(g => ({ id: g.id, files: Object.fromEntries(Object.keys(g.files).map(k => [k, {}])) })));
      const apply = (g, files) => { for (const [k, v] of Object.entries(files)) { if (v === null) delete g.files[k]; else g.files[k] = v; } };
      if (req.method() === 'POST' && url.pathname === '/gists') { const g = { id: 'g' + (++n), files: {} }; apply(g, body.files); gists.push(g); return json(201, { id: g.id }); }
      const g = gists.find(x => '/gists/' + x.id === url.pathname);
      if (!g) return json(404, {});
      if (req.method() === 'GET') return json(200, { id: g.id, files: g.files });
      apply(g, body.files); return json(200, { id: g.id });
    });
  } };
  return gh;
}

async function start() {
  execFileSync(process.execPath, [path.join(ROOT, 'build.js')]);
  server = http.createServer((req, res) => {
    const name = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
    const file = path.join(WWW, path.normalize(name));
    if (!file.startsWith(WWW) || !fs.existsSync(file)) { res.writeHead(404); res.end('tidak ada'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const { chromium } = require('playwright');
  browser = await chromium.launch();
  return { url: 'http://127.0.0.1:' + server.address().port + '/' };
}
async function stop() { if (browser) await browser.close(); if (server) server.close(); }

/* Catatan tugas lengkap seperti yang disimpan aplikasi. */
function task(id, title, over) {
  return Object.assign({ id, uid: ('00000000' + id.toString(16)).slice(-8) + 'abcdef01', updated_at: '1970-01-01T00:00:00.000Z',
    parent_id: null, title, notes: '', priority: 2, deadline: null, due_time: null, done: false, project: null,
    repeat: null, tags: [], created_at: '2026-01-01T00:00:00', completed_at: null, reminded_for: null }, over || {});
}
const seedData = tasks => ({ version: 4, nextId: tasks.reduce((a, t) => Math.max(a, t.id), 0) + 1, tasks, tombs: [] });

async function open(ctxInfo, opts) {
  opts = opts || {};
  const ctx = opts.context || await browser.newContext({ viewport: { width: opts.width || 1280, height: opts.height || 860 }, locale: 'id-ID',
    colorScheme: opts.scheme || 'light', acceptDownloads: true });
  if (opts.github) await opts.github.attach(ctx);
  const page = await ctx.newPage();
  const problems = [], apiCalls = [];
  page.problems = problems; page.apiCalls = apiCalls; page.ctx = ctx;
  await page.addInitScript(CSP_WATCHER);
  if (opts.lang) await page.addInitScript(l => { try { localStorage.setItem('todo-lang', l); } catch (e) {} }, opts.lang);
  if (opts.native) await page.addInitScript(FAKE_CAPACITOR);
  if (opts.native && opts.fsFail) await page.addInitScript('window.__fsFail = true;');
  if (opts.seed) await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [KEY, JSON.stringify(seedData(opts.seed))]);
  page.on('pageerror', e => problems.push('pageerror: ' + e));
  page.on('console', m => m.type() === 'error' && problems.push('console: ' + m.text()));
  page.on('request', r => r.url().includes('/api/') && apiCalls.push(r.url()));
  await page.goto(ctxInfo.url);
  await page.waitForSelector('#nav-views button');
  if (opts.view) await view(page, opts.view);
  return page;
}

const view = (page, name) => page.locator('#nav-views button', { hasText: name }).click();
async function until(page, expr, timeout) {
  const end = Date.now() + (timeout || 6000);
  for (;;) {
    if (await page.evaluate('Boolean(' + expr + ')')) return;
    if (Date.now() > end) throw new Error('Kondisi tidak terpenuhi: ' + expr);
    await page.waitForTimeout(40);
  }
}
const stored = async page => JSON.parse(await page.evaluate(k => localStorage.getItem(k), KEY));
async function waitStored(page, pred, label) {
  const end = Date.now() + 6000;
  for (;;) {
    const data = await stored(page);
    if (data && pred(data)) return data;
    if (Date.now() > end) throw new Error('Data tersimpan tidak sesuai: ' + (label || pred) + '\n' + JSON.stringify(data && data.tasks.map(t => [t.id, t.title, t.done, t.deadline])));
    await page.waitForTimeout(40);
  }
}
// Tes memakai sintaks teks lama lewat API lokal (UI sudah tanpa simbol); jalur UI diuji terpisah di test/e2e/options.test.js.
async function quickAdd(page, text) {
  await page.evaluate(async t => { await window.todoLocalApi('POST', '/api/quick', { text: t }); await window.refresh(); }, text);
}
async function typeAdd(page, text) { await page.fill('#quick-input', text); await page.keyboard.press('Enter'); }
const csp = page => page.evaluate('window.__csp');
const rowCount = page => page.evaluate("document.querySelectorAll('#list .row').length");

async function swipe(page, selector, dx, kind) {
  await page.evaluate(([sel, dx, kind]) => {
    const row = document.querySelector(sel), r = row.getBoundingClientRect();
    const x0 = r.left + 60, y0 = r.top + r.height / 2;
    const fire = (type, x, y) => row.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: kind, isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y }));
    fire('pointerdown', x0, y0);
    for (let i = 1; i <= 8; i++) fire('pointermove', x0 + dx * i / 8, y0 + 2 * i / 8);
    fire('pointerup', x0 + dx, y0 + 2);
  }, [selector, dx, kind || 'touch']);
}
async function longpress(page, selector) {
  await page.evaluate(sel => {
    const row = document.querySelector(sel), r = row.getBoundingClientRect();
    row.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: r.left + 60, clientY: r.top + r.height / 2 }));
  }, selector);
  await page.waitForTimeout(700);
}

/* Setiap tes memakai ini: tidak boleh ada galat halaman, pelanggaran CSP, atau panggilan ke /api. */
async function finish(pages) {
  const msgs = [];
  for (const p of pages) {
    msgs.push(...p.problems);
    if (p.apiCalls.length) msgs.push('aplikasi memanggil server: ' + p.apiCalls.join(','));
    try { const v = await csp(p); if (v.length) msgs.push('CSP: ' + v.join(';')); } catch (e) {}
    await p.ctx.close();
  }
  assert.deepStrictEqual(msgs, []);
}

module.exports = { A11Y_AUDIT, fakeGithub, start, stop, open, view, until, stored, waitStored, quickAdd, typeAdd, csp, rowCount, swipe, longpress, finish, task, day, TODAY, KEY };
