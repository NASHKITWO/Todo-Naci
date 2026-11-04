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
