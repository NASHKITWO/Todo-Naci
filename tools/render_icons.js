'use strict';
/* Sumber tunggal logo Tuntas Harian (kalender sobek kaca) dan pembuat PNG ikon Android.
 * Dijalankan manual saat logo berubah: `node tools/render_icons.js` (butuh Playwright + Chromium).
 * Hasil (assets/logo.svg, assets/logo-reversed.svg, assets/android/*.png) dikomit, sehingga CI tidak perlu Playwright:
 * tools/make_icons.js hanya membaca PNG itu. Ukuran ikon mengikuti LAUNCHER/FOREGROUND di tools/patch_android.js. */
const fs = require('fs');
const path = require('path');

const FRONT = 'M26 30C26 16 36 10 50 10H80C94 10 102 20 100 34C98 50 104 66 99 82C97 92 93 98 86 99L79 93L71 102L63 94L55 101L47 95L38 100C28 100 24 92 24 80C23 62 26 46 26 30Z';
const T_BAR = 'M35 45C49 40 67 40 85 43C88 44 87 51 84 52C68 51 52 51 38 54C33 55 31 47 35 45Z';
const T_STEM = 'M53 48C58 47 65 47 68 49C66 62 66 74 64 87C63 91 56 91 55 87C55 75 54 61 53 48Z';
const SHINE = 'M33 24C40 15 62 13 78 15';

/* Isi svg (viewBox 0 0 120 120). dark: kaca lebih redup, huruf putih. id: awalan id gradien agar tidak bentrok antar-salinan. */
function mark(dark, id) {
  const t = dark ? '#FFFFFF' : '#0B2A5B', g1 = dark ? '.34' : '.8', g2 = dark ? '.08' : '.3', mid = dark ? '#FFFFFF' : '#7FA6D9';
  return `<defs>
<linearGradient id="${id}b1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8CC0FF"/><stop offset="1" stop-color="#1E78E6"/></linearGradient>
<linearGradient id="${id}b2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#0B2A5B"/><stop offset="1" stop-color="#3B8DEB"/></linearGradient>
<linearGradient id="${id}gl" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${g1}"/><stop offset="1" stop-color="#fff" stop-opacity="${g2}"/></linearGradient>
<linearGradient id="${id}ed" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".55" stop-color="${mid}" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity=".8"/></linearGradient></defs>
<g transform="rotate(-13 60 108)"><rect x="24" y="8" width="72" height="100" rx="20" fill="url(#${id}b2)"/></g>
<g transform="rotate(-6 60 108)"><rect x="24" y="8" width="72" height="100" rx="20" fill="url(#${id}b1)"/></g>
<g transform="translate(-2 2)"><path d="${FRONT}" fill="url(#${id}gl)" stroke="url(#${id}ed)" stroke-width="2.2" stroke-linejoin="round"/>
<path d="${SHINE}" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round" fill="none"/>
<path d="${T_BAR}" fill="${t}"/><path d="${T_STEM}" fill="${t}"/></g>`;
}
const svg = (inner, vb) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb || '0 0 120 120'}">${inner}</svg>\n`;

/* Siluet satu warna untuk ikon monokrom Android: lembar-lembar jadi putih, huruf T berlubang. */
function mono() {
  return `<defs><mask id="m"><rect width="120" height="120" fill="#fff"/><g transform="translate(-2 2)" fill="#000"><path d="${T_BAR}"/><path d="${T_STEM}"/></g></mask></defs>
<g mask="url(#m)" fill="#fff"><g transform="rotate(-13 60 108)"><rect x="24" y="8" width="72" height="100" rx="20"/></g>
<g transform="rotate(-6 60 108)"><rect x="24" y="8" width="72" height="100" rx="20"/></g><g transform="translate(-2 2)"><path d="${FRONT}"/></g></g>`;
}

/* Kanvas px×px; tanda diskalakan ke `frac` tinggi kanvas dan dipusatkan (pusat visual tanda ≈ (58,58)). */
function canvas(px, body, frac) {
  const s = (px * frac) / 100, ox = px / 2 - 62 * s, oy = px / 2 - 57 * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}">${body.replace('%G%', `<g transform="translate(${ox} ${oy}) scale(${s})">`)}</svg>`;
}
const NAVY = '#0B2A5B';
const legacy = (px, round) => canvas(px, `<${round ? `circle cx="${px / 2}" cy="${px / 2}" r="${px / 2}"` : `rect width="${px}" height="${px}" rx="${px * 0.22}"`} fill="${NAVY}"/>%G%${mark(true, 'l')}</g>`, 0.66);
const foreground = px => canvas(px, `%G%${mark(true, 'f')}</g>`, 0.5);
const monochrome = px => canvas(px, `%G%${mono()}</g>`, 0.5);

async function main() {
  const { chromium } = require('playwright');
  const root = path.join(__dirname, '..');
  const out = path.join(root, 'assets', 'android');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(root, 'assets', 'logo.svg'), svg(mark(false, 'x')));
  fs.writeFileSync(path.join(root, 'assets', 'logo-reversed.svg'), svg(`<rect width="120" height="120" fill="${NAVY}"/>` + mark(true, 'y')));
  const jobs = [];
  for (const s of [48, 72, 96, 144, 192]) jobs.push(['legacy-' + s, s, legacy(s, false)], ['round-' + s, s, legacy(s, true)]);
  for (const s of [108, 162, 216, 324, 432, 576]) jobs.push(['foreground-' + s, s, foreground(s)]);
  for (const s of [108, 162, 216, 324, 432]) jobs.push(['monochrome-' + s, s, monochrome(s)]);
  jobs.push(['logo-1024', 1024, canvas(1024, `<rect width="1024" height="1024" rx="225" fill="${NAVY}"/>%G%${mark(true, 'z')}</g>`, 0.66)]);
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 1 });
  for (const [name, px, markup] of jobs) {
    await p.setViewportSize({ width: px, height: px });
    await p.setContent(`<body style="margin:0;background:transparent">${markup}</body>`);
    const file = name === 'logo-1024' ? path.join(root, 'assets', 'logo-1024.png') : path.join(out, name + '.png');
    await p.screenshot({ path: file, omitBackground: true });
  }
  await b.close();
  console.log(jobs.length + ' PNG ditulis.');
}
module.exports = { mark, FRONT, T_BAR, T_STEM, SHINE, svg };
if (require.main === module) main();
