/* Sinkron otomatis antar perangkat lewat GitHub Gist rahasia (opsional, mati secara bawaan).
 *
 * Rancangan:
 *  - Setiap perangkat hanya MENULIS berkasnya sendiri (todo-sync-<id>.json) dan MEMBACA berkas semua perangkat.
 *    Tidak ada dua penulis ke satu berkas, jadi perangkat tidak bisa saling menimpa.
 *  - Isi berkas dienkripsi di perangkat (AES-GCM, kunci PBKDF2 dari kata sandi sinkron) sebelum dikirim, jadi isi tugas
 *    tidak terbaca walau alamat gist bocor.
 *  - Penggabungan memakai Store.syncWith (sama dengan sinkron berkas): idempoten, tidak bergantung urutan.
 * `fetchFn` disuntikkan agar modul ini bisa diuji tanpa jaringan. */
(function (root) {
  'use strict';
  const API = 'https://api.github.com';
  const DESCRIPTION = 'Todo sync (jangan dihapus)';
  const LEGACY = 'todo-sync.json'; // berkas tunggal versi awal (teks polos)
  const FILE_RE = /^todo-sync(-[0-9a-z]+)?\.json$/;
  const ITERATIONS = 200000;
  const MAX_ITERATIONS = 1000000;

  class SyncError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }

  const fileFor = deviceId => 'todo-sync-' + String(deviceId || 'x').toLowerCase().replace(/[^0-9a-z]/g, '') + '.json';

  // ---------- enkripsi ----------
  const subtle = () => {
    const c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (!c || !c.subtle) throw new SyncError('crypto', 'Enkripsi tidak tersedia di perangkat ini.');
    return c;
  };
  function b64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const unb64 = text => Uint8Array.from(atob(text), ch => ch.charCodeAt(0));

  const keyCache = new Map();
  async function deriveKey(pass, salt, iterations) {
    const id = pass + '|' + b64(salt) + '|' + iterations;
    if (keyCache.has(id)) return keyCache.get(id);
    const c = subtle();
    const base = await c.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    const key = await c.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    if (keyCache.size > 32) keyCache.clear();
    keyCache.set(id, key);
    return key;
  }

  let mySalt = null; // satu garam per proses agar kunci tidak diturunkan ulang di tiap penulisan
  async function encrypt(obj, pass) {
    const c = subtle();
    if (!mySalt) mySalt = c.getRandomValues(new Uint8Array(16));
    const iv = c.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(pass, mySalt, ITERATIONS);
    const data = new Uint8Array(await c.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj))));
    return { app: 'todo-cli', kind: 'sync-enc', format: 1, kdf: 'PBKDF2-SHA256', iter: ITERATIONS, salt: b64(mySalt), iv: b64(iv), data: b64(data) };
  }
  async function decrypt(env, pass) {
    if (!pass) throw new SyncError('password', 'Data sinkron terenkripsi: isi kata sandi sinkron.');
    const bad = () => new SyncError('password', 'Kata sandi sinkron salah (atau berkas dibuat dengan kata sandi lain).');
    if (!env || typeof env.salt !== 'string' || typeof env.iv !== 'string' || typeof env.data !== 'string' ||
        !Number.isInteger(env.iter) || env.iter < 1 || env.iter > MAX_ITERATIONS) throw new SyncError('format', 'Berkas sinkron terenkripsi rusak.');
    try {
      const key = await deriveKey(pass, unb64(env.salt), env.iter);
      const plain = await subtle().subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, key, unb64(env.data));
      return JSON.parse(new TextDecoder().decode(plain));
    } catch (e) {
      if (e instanceof SyncError) throw e;
      throw bad(); // GCM menolak: kata sandi salah atau data diubah
    }
  }

  // ---------- GitHub ----------
  const headers = token => ({
    Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28',
  });

  async function call(fetchFn, method, path, token, body) {
    let res;
    try {
      res = await fetchFn(API + path, {
        method, cache: 'no-store', headers: Object.assign({}, headers(token), body ? { 'Content-Type': 'application/json' } : {}),
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new SyncError('network', 'Tidak ada koneksi ke GitHub.');
    }
    if (res.status === 401) throw new SyncError('auth', 'Token ditolak GitHub (salah atau kedaluwarsa).');
    if (res.status === 403 || res.status === 429) throw new SyncError('limit', 'GitHub menolak permintaan (izin token kurang atau terlalu sering). Coba lagi nanti.');
    if (res.status === 404) throw new SyncError('notfound', 'Gist tidak ditemukan.');
    if (!res.ok) throw new SyncError('http', 'GitHub membalas kesalahan ' + res.status + '.');
    return res.json();
  }

  /* Cari gist milik pengguna yang berisi berkas sinkron (untuk perangkat kedua yang hanya punya token). */
  async function findGist(fetchFn, token) {
    for (let page = 1; page <= 3; page++) {
      const list = await call(fetchFn, 'GET', '/gists?per_page=100&page=' + page, token);
      if (!Array.isArray(list) || !list.length) return null;
      const hit = list.find(g => g && g.files && Object.keys(g.files).some(n => FILE_RE.test(n)));
      if (hit) return hit.id;
      if (list.length < 100) return null;
    }
    return null;
  }

  const byUid = (a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0);
  /* Isi berkas tanpa urutan, perangkat, dan waktu ekspor — untuk menilai "sudah sama atau belum". */
  function essence(file) {
    return JSON.stringify([(file.tasks || []).slice().sort(byUid), (file.deleted || []).slice().sort(byUid)]);
  }

  async function readFiles(gist, pass) {
    const out = [];
    for (const [name, file] of Object.entries(gist.files || {})) {
      if (!FILE_RE.test(name) || !file) continue;
      if (file.truncated) throw new SyncError('size', 'Berkas sinkron di gist terlalu besar untuk dibaca.');
      let data;
      try { data = JSON.parse(file.content); }
      catch (e) { throw new SyncError('format', 'Isi ' + name + ' bukan JSON yang valid.'); }
      const encrypted = !!data && data.kind === 'sync-enc';
      if (encrypted) data = await decrypt(data, pass);
      out.push({ name, data, encrypted });
    }
    return out;
  }

  /* cfg: {token, gistId?, deviceId, passphrase?}. Mengembalikan {gistId, summary, pushed, created, devices}. */
  async function run(store, cfg, fetchFn) {
    if (!cfg || !cfg.token) throw new SyncError('config', 'Token belum diisi.');
    const own = fileFor(cfg.deviceId);
    let gistId = cfg.gistId || null;
    if (!gistId) gistId = await findGist(fetchFn, cfg.token);

    let files = [];
    if (gistId) files = await readFiles(await call(fetchFn, 'GET', '/gists/' + encodeURIComponent(gistId), cfg.token), cfg.passphrase);

    const summary = { added: 0, updated: 0, deleted: 0 };
    for (const f of files) {
      let r;
      try { r = store.syncWith(f.data); }
      catch (e) { throw new SyncError('format', 'Isi ' + f.name + ' bukan berkas sinkron yang valid: ' + e.message); }
      summary.added += r.added; summary.updated += r.updated; summary.deleted += r.deleted;
    }

    const local = store.syncFile(cfg.deviceId);
    const mine = files.find(f => f.name === own);
    const wantEncrypted = !!cfg.passphrase;
    const legacy = wantEncrypted && files.some(f => f.name === LEGACY && !f.encrypted); // teks polos lama: hapus setelah digabung
    let pushed = false, created = false;
    if (!mine || mine.encrypted !== wantEncrypted || essence(mine.data) !== essence(local) || legacy) {
      const body = wantEncrypted ? await encrypt(local, cfg.passphrase) : local;
      const payload = { [own]: { content: JSON.stringify(body) } };
      if (legacy) payload[LEGACY] = null;
      if (gistId) await call(fetchFn, 'PATCH', '/gists/' + encodeURIComponent(gistId), cfg.token, { files: payload });
      else {
        const made = await call(fetchFn, 'POST', '/gists', cfg.token, { description: DESCRIPTION, public: false, files: payload });
        gistId = made.id; created = true;
      }
      pushed = true;
    }
    return { gistId, summary, pushed, created, devices: files.filter(f => f.name !== own).length };
  }

  /* Hapus semua berkas sinkron di gist (untuk memulai ulang, mis. lupa kata sandi). Mengembalikan jumlah berkas yang dihapus. */
  async function reset(cfg, fetchFn) {
    if (!cfg || !cfg.token) throw new SyncError('config', 'Token belum diisi.');
    const gistId = cfg.gistId || await findGist(fetchFn, cfg.token);
    if (!gistId) return 0;
    const gist = await call(fetchFn, 'GET', '/gists/' + encodeURIComponent(gistId), cfg.token);
    const names = Object.keys(gist.files || {}).filter(n => FILE_RE.test(n));
    if (!names.length) return 0;
    await call(fetchFn, 'PATCH', '/gists/' + encodeURIComponent(gistId), cfg.token, { files: Object.fromEntries(names.map(n => [n, null])) });
    return names.length;
  }

  const api = { run, reset, findGist, essence, encrypt, decrypt, fileFor, SyncError, FILE_RE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TodoAutoSync = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
