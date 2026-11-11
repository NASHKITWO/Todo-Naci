/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Program ini perangkat lunak bebas di bawah GNU GPL v3 atau yang lebih baru, TANPA JAMINAN; lihat LICENSE dan NOTICE. */
'use strict';

/* ================= util ================= */
const $ = (sel, el) => (el || document).querySelector(sel);
const SVG_NS = 'http://www.w3.org/2000/svg';

const TRANSLATED_ATTRS = new Set(['aria-label', 'title', 'placeholder']);
const raw = window.TodoI18n.raw;
function h(tag, attrs) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') {
      // Atribut style inline diblokir CSP; gunakan objek (CSSOM) atau kelas CSS.
      if (typeof v === 'object') Object.assign(el.style, v);
      else console.error('h(): style harus berupa objek, bukan string');
    }
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, typeof v === 'string' && TRANSLATED_ATTRS.has(k) ? T(v) : v);
  }
  for (const kid of Array.prototype.slice.call(arguments, 2).flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(typeof kid === 'string' ? T(kid) : String(kid)));
  }
  return el;
}

const ICONS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12|M18 6L6 18',
  lock: 'M6 11h12v9H6z|M8 11V8a4 4 0 018 0v3',
  trash: 'M4 7h16|M10 11v6|M14 11v6|M6 7l1 13h10l1-13|M9 7V4h6v3',
  repeat: 'M17 2l4 4-4 4|M3 11V9a3 3 0 013-3h15|M7 22l-4-4 4-4|M21 13v2a3 3 0 01-3 3H3',
  note: 'M5 4h14v16H5z|M8 9h8|M8 13h8|M8 17h5',
  menu: 'M4 6h16|M4 12h16|M4 18h16',
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  sun: 'M12 8a4 4 0 100 8 4 4 0 000-8z|M12 2v2|M12 20v2|M2 12h2|M20 12h2|M4.9 4.9l1.4 1.4|M17.7 17.7l1.4 1.4|M19.1 4.9l-1.4 1.4|M6.3 17.7l-1.4 1.4',
  calendar: 'M4 6h16v14H4z|M4 10h16|M8 3v4|M16 3v4',
  upcoming: 'M5 12h14|M13 6l6 6-6 6',
  all: 'M8 6h13|M8 12h13|M8 18h13|M3 6h.01|M3 12h.01|M3 18h.01',
  done: 'M12 21a9 9 0 100-18 9 9 0 000 18z|M8 12.5l3 3 5-6',
  list: 'M4 6h16|M4 12h10|M4 18h6',
  sparkle: 'M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 1 0 0-11zM9.6 12.2l1.8 1.9 3.2-3.8M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4', // matahari bercentang (logo)
  share: 'M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13',
  palette: 'M12 3a9 9 0 100 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A3.7 3.7 0 0021 10.7C21 6.4 17 3 12 3z|M7.5 11h.01|M10 7.5h.01|M14 7.5h.01',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18z|M12 7v5l3 2',
  flame: 'M12 3c1 3 4 4.5 4 8.5a4 4 0 01-8 0c0-1.5.6-2.6 1.5-3.5C9.7 9.8 11 7 12 3z',
  insights: 'M4 20V11|M10 20V4|M16 20v-6|M22 20H2',
  select: 'M9 11l3 3 8-8|M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h9',
  copy: 'M8 8h12v12H8z|M4 16V4h12',
  chevron: 'M9 6l6 6-6 6',
  left: 'M15 6l-6 6 6 6',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14z|M21 21l-4.3-4.3',
  tuntas: 'M12 3a9 9 0 100 18 9 9 0 000-18z|M7.8 12.4l3 3 5.6-6',
};
function icon(name, size) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size || 16);
  svg.setAttribute('height', size || 16);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ICONS[name].split('|')) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  }
  return svg;
}

async function api(method, path, body) {
  return window.todoLocalApi(method, path, body); // semua data lokal di HP (lihat local-api.js)
}

const motionOK = () => !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const wait = ms => new Promise(r => setTimeout(r, ms));
const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };

/* Kotak pilih tanggal/jam: tampil sebagai tombol berisi teks terformat ("Kam, 5 Nov", "19:00"); input asli (tak terlihat) menutupi
 * tombol sehingga ketukan membuka pemilih bawaan sistem. Nilai, label aksesibel, dan acara input tidak berubah. */
function pickBox(input, kind) {
  const txt = h('span', { class: 'pick-text' });
  const box = h('label', { class: 'pick pick-' + kind }, icon(kind === 'date' ? 'calendar' : 'clock', 16), txt, input);
  box.sync = () => {
    const v = input.value;
    let shown = v;
    if (v && kind === 'date') { try { shown = fmtDate(v); } catch (e) { shown = v; } }
    txt.textContent = v ? shown : (kind === 'date' ? T('Pilih tanggal') : T('Pilih jam'));
    box.classList.toggle('blank', !v);
    box.classList.toggle('off', !!input.disabled);
  };
  input.classList.add('pick-input');
  input.addEventListener('input', box.sync);
  input.addEventListener('change', box.sync);
  input.addEventListener('click', () => { try { if (!input.disabled && input.showPicker) input.showPicker(); } catch (e) { /* butuh gestur; abaikan */ } });
  box.sync();
  return box;
}
function refreshPicks() { document.querySelectorAll('.pick').forEach(b => { if (b.sync) b.sync(); }); }

/* Ilustrasi khas Tuntas Harian: kartu tugas bertumpuk, satu sudah dicentang (cincin-centang = motif merek), dengan percikan. Dekoratif. */
function scene(done) {
  const mk = (n, a) => { const e = document.createElementNS(SVG_NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const svg = mk('svg', { viewBox: '0 0 220 150', width: 220, height: 150, class: 'scene', 'aria-hidden': 'true', focusable: 'false' });
  svg.append(
    mk('ellipse', { cx: 110, cy: 136, rx: 78, ry: 7, class: 'sc-shadow' }),
    mk('rect', { x: 44, y: 34, width: 132, height: 38, rx: 12, class: 'sc-card sc-back', transform: 'rotate(-5 110 53)' }),
    mk('rect', { x: 40, y: 60, width: 140, height: 40, rx: 12, class: 'sc-card sc-mid', transform: 'rotate(3 110 80)' }),
    mk('rect', { x: 34, y: 86, width: 152, height: 42, rx: 13, class: 'sc-card sc-front' }),
    mk('circle', { cx: 58, cy: 107, r: 11, class: done === false ? 'sc-ring' : 'sc-ring on' }),
    mk('path', { d: 'M52.5 107.5l4 4 7-8', class: 'sc-tick' }),
    mk('rect', { x: 78, y: 98, width: 70, height: 6, rx: 3, class: 'sc-line' }),
    mk('rect', { x: 78, y: 111, width: 44, height: 6, rx: 3, class: 'sc-line short' }),
    mk('path', { d: 'M176 30v14M169 37h14', class: 'sc-spark' }),
    mk('path', { d: 'M40 44v8M36 48h8', class: 'sc-spark small' }),
    mk('circle', { cx: 190, cy: 74, r: 3, class: 'sc-dot' })
  );
  return svg;
}

/* Logo Tuntas Harian: huruf T bergaris miring dengan centang biru. Warna mengikuti tema (--logo-t, --logo-c), jadi versi terang dan gelap
 * memakai berkas yang sama dengan assets/logo.svg dan assets/logo-reversed.svg. Dekoratif; nama merek ada di teks sebelahnya. */
function logoMark(width) {
  const mk = (n, a) => { const e = document.createElementNS(SVG_NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const svg = mk('svg', { viewBox: '12 40 232 176', width: width || 40, height: Math.round((width || 40) * 176 / 232), class: 'logo-mark', 'aria-hidden': 'true', focusable: 'false' });
  svg.append(
    mk('path', { class: 'lg-c', d: 'M78.1 178.0L190.0 79.9L240.0 79.9L90.1 211.4L73.4 211.4Z' }),
    mk('path', { class: 'lg-t', d: 'M62.4 79.9L102.7 44.6L79.3 211.4L43.9 211.4ZM21.0 95.6L119.1 95.6L114.1 130.9L16.0 130.9Z' }));
  return svg;
}
