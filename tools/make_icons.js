'use strict';
/* Ikon & splash (PNG RGBA) tanpa dependensi.
 * Rancangan: latar biru sampul rata, matahari putih (cincin + 8 sinar) dengan tanda centang merah-jingga (tinta guru) di tengahnya. Semua koordinat memakai satuan kanvas 0..1 (kanvas ikon adaptif 108dp);
 * glyph berada di dalam zona aman (lingkaran berjari-jari ≈0,306 dari pusat). */
const zlib = require('zlib');

const C1 = [0x1b, 0x2f, 0x66], C2 = [0x1b, 0x2f, 0x66]; // latar rata: biru sampul buku tulis
const WHITE = [255, 255, 255], AMBER = [0xff, 0x6f, 0x59];

// Logo "Tuntas Harian": matahari (cincin + 8 sinar, putih) dengan tanda centang merah-jingga (tinta guru) di tengahnya = tugas hari ini tuntas.
const RING = { r: 0.19, half: 0.017 };
const RAYS = { n: 8, r0: 0.235, r1: 0.287, half: 0.018 };
const CHECK = { pts: [[0.425, 0.515], [0.48, 0.575], [0.585, 0.435]], half: 0.032 };

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const distToCheck = (u, v) => Math.min(
  distToSegment(u, v, CHECK.pts[0][0], CHECK.pts[0][1], CHECK.pts[1][0], CHECK.pts[1][1]),
  distToSegment(u, v, CHECK.pts[1][0], CHECK.pts[1][1], CHECK.pts[2][0], CHECK.pts[2][1]));

/* Glyph di titik (u,v): 'ring' | 'ray' | 'check' | null */
function glyph(u, v) {
  if (distToCheck(u, v) < CHECK.half) return 'check';
  const dx = u - 0.5, dy = v - 0.5, r = Math.hypot(dx, dy);
  if (Math.abs(r - RING.r) < RING.half) return 'ring';
  if (r >= RAYS.r0 && r <= RAYS.r1) {
    const step = Math.PI * 2 / RAYS.n;
    const a = Math.atan2(dy, dx);
    const d = Math.abs(((a % step) + step * 1.5) % step - step / 2); // sudut ke sinar terdekat
    if (r * Math.sin(Math.min(d, Math.PI / 2)) < RAYS.half) return 'ray';
  }
  return null;
}

const gradient = t => [0, 1, 2].map(i => C1[i] + (C2[i] - C1[i]) * t);

/* Satu sampel: mengembalikan [r,g,b,a] (a 0..1) untuk jenis lapisan pada koordinat kanvas (u,v). */
function sample(kind, u, v) {
  switch (kind) {
    case 'background': { const t = (u + v) / 2; return gradient(t).concat(1); }
    case 'foreground': { const g = glyph(u, v); return g ? (g === 'check' ? AMBER : WHITE).concat(1) : [0, 0, 0, 0]; }
    case 'monochrome': return glyph(u, v) ? [255, 255, 255, 1] : [0, 0, 0, 0];
    default: throw new Error('jenis tidak dikenal: ' + kind);
  }
}

/* Ikon peluncur lama (legacy): latar + glyph diperbesar, dipotong persegi bulat atau lingkaran. */
function legacySample(shape, u, v) {
  const gx = (u - 0.5) / 1.32 + 0.5, gy = (v - 0.5) / 1.32 + 0.5;
  const inside = shape === 'round'
    ? Math.hypot(u - 0.5, v - 0.5) <= 0.5
    : (() => { const r = 0.22, qx = Math.abs(u - 0.5) - 0.5 + r, qy = Math.abs(v - 0.5) - 0.5 + r;
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r <= 0; })();
  if (!inside) return [0, 0, 0, 0];
  const fg = sample('foreground', gx, gy);
  return fg[3] ? fg : sample('background', u, v);
}

function splashSample(w, h, x, y) {
  const m = Math.min(w, h), L = m * 1.25;
  const u = (x - w / 2) / L + 0.5, v = (y - h / 2) / L + 0.5;
  const fg = sample('foreground', u, v);
  if (fg[3]) return fg;
  return gradient(Math.max(0, Math.min(1, 0.15 + 0.7 * (y / h)))).concat(1);
}

function rasterize(w, h, ss, fn) { // fn(x,y) dalam piksel; hasil RGBA 8-bit tidak-premultiplied
  const raw = Buffer.alloc(h * (w * 4 + 1));
  let o = 0;
  const n = ss * ss;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = fn(x + (sx + 0.5) / ss, y + (sy + 0.5) / ss);
        r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
      }
      raw[o++] = a ? Math.round(r / a) : 0; raw[o++] = a ? Math.round(g / a) : 0; raw[o++] = a ? Math.round(b / a) : 0;
      raw[o++] = Math.round(255 * a / n);
    }
  }
  return raw;
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(tag, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(tag, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encode(w, h, raw) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0); header.writeUInt32BE(h, 4); header[8] = 8; header[9] = 6; // 8-bit RGBA
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* kind: 'legacy' | 'round' | 'background' | 'foreground' | 'monochrome' (persegi, size×size) atau 'splash' (size = [lebar, tinggi]) */
function icon(kind, size, ss) {
  const q = ss || 3;
  if (kind === 'splash') {
    const [w, h] = size;
    return encode(w, h, rasterize(w, h, Math.min(q, 2), (x, y) => splashSample(w, h, x, y)));
  }
  const fn = kind === 'legacy' || kind === 'round'
    ? (x, y) => legacySample(kind, x / size, y / size)
    : (x, y) => sample(kind, x / size, y / size);
  return encode(size, size, rasterize(size, size, q, fn));
}

module.exports = { icon, sample, glyph, CHECK, RING, RAYS };
