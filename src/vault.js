/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Program ini perangkat lunak bebas di bawah GNU GPL v3 atau yang lebih baru, TANPA JAMINAN; lihat LICENSE dan NOTICE. */
/* Enkripsi data di perangkat (opsional, butuh kunci PIN aktif).
 *  - Data (tugas, snapshot, salinan data rusak) disimpan sebagai satu blob AES-256-GCM dengan kunci data (DEK) acak.
 *  - DEK dibungkus dua kali di kepala blob: (1) kunci dari PIN (PBKDF2-SHA256, 300.000 putaran, garam acak),
 *    (2) kunci pemulihan acak 160-bit yang ditampilkan SEKALI. Ganti PIN = bungkus ulang DEK; lupa PIN = pakai kunci pemulihan.
 *  - Semua kunci hanya ada di memori. Blob yang sama disalin ke Dokumen/Todo sebagai cadangan terenkripsi.
 *  - Batas yang jujur: PIN pendek punya ruang tebakan kecil. Penyerang yang menyalin penyimpanan bisa menebak PIN secara luring,
 *    jadi ini menghalangi pembacaan santai, bukan penyerang berdaya besar. Tanpa PIN DAN tanpa kunci pemulihan, data tak bisa dibuka.
 *  - Format: v3 (DEK + pemulihan). v1/v2 (kunci langsung dari PIN, rilis 0.40-0.41) masih terbaca; "Buat kunci pemulihan" memperbaruinya ke v3. */
(function () {
  'use strict';
  const META = 'todo-cli.vault', BLOB = 'todo-cli.vault.blob', ITER = 300000;
  const GUARDED = ['todo-cli.data.v1', 'todo-cli.snapshots', 'todo-cli.data.corrupt'];
  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: k => { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ }  },
  };
  const b64 = buf => { let s = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  const enc = s => new TextEncoder().encode(s), dec = b => new TextDecoder().decode(b);
  const readMeta = () => { try { const m = JSON.parse(ls.get(META)); return m && m.salt && m.iter ? m : null; } catch (e) { return null; } };
  const ERR_STORE = 'Penyimpanan di perangkat gagal (penuh atau diblokir).', ERR_CHECK = 'Pemeriksaan hasil enkripsi gagal; data tidak diubah.';

  /* st: keadaan terbuka = {legacy, dek|pinKey, salt, iter, wp, wr}; meta: bendera "enkripsi aktif" + garam v1. */
  let meta = readMeta(), st = null, mem = null, dirty = false, pumping = null, failed = false;
  const unlockHooks = [], enableHooks = [];

  async function pinKey(pin, saltB64, iter, usage) {
    const base = await crypto.subtle.importKey('raw', enc(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, usage || ['encrypt', 'decrypt']);
  }
  /* Kunci pemulihan: 20 byte acak, tampil sebagai 32 karakter Crockford base32 berkelompok. Cukup acak sehingga SHA-256 saja memadai. */
  const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function newRecoveryString() {
    const b = rnd(20); let bits = 0, acc = 0, out = '';
    for (const x of b) { acc = (acc << 8) | x; bits += 8; while (bits >= 5) { out += ALPHA[(acc >> (bits - 5)) & 31]; bits -= 5; } }
    return out.match(/.{4}/g).join('-');
  }
  const normRecovery = s => String(s || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
  async function recoveryKey(str) {
    const n = normRecovery(str);
    if (n.length !== 32) throw new Error('format');
    return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', enc('tuntas-recovery:' + n)), 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  const gcmEnc = async (k, bytes) => { const iv = rnd(12); const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, bytes)); const o = new Uint8Array(12 + ct.length); o.set(iv); o.set(ct, 12); return o; };
  const gcmDec = async (k, packed) => new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: packed.slice(0, 12) }, k, packed.slice(12)));
  const newDek = () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

  /* Pembacaan blob: v1 "v1.iv.ct", v2 "v2.iter.salt.iv.ct", v3 "v3.iter.salt.wp.wr.iv.ct" (wp/wr = DEK terbungkus oleh PIN/pemulihan). */
  function parse(blob) {
    const p = String(blob || '').split('.');
    if (p[0] === 'v3' && p.length === 7) return { ver: 3, iter: Number(p[1]), salt: p[2], wp: p[3], wr: p[4], iv: p[5], ct: p[6] };
    if (p[0] === 'v2' && p.length === 5) return { ver: 2, iter: Number(p[1]), salt: p[2], iv: p[3], ct: p[4] };
    if (p[0] === 'v1' && p.length === 3) return { ver: 1, iv: p[1], ct: p[2] };
    throw new Error('format');
  }
  const openBody = async (k, pb) => dec(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(pb.iv) }, k, unb64(pb.ct)));
  async function sealBody(k, text) { const iv = rnd(12); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc(text)); return { iv: b64(iv), ct: b64(ct) }; }
  async function seal(text) {
    const k = st.legacy ? st.pinKey : st.dek, b = await sealBody(k, text);
    return st.legacy ? 'v2.' + st.iter + '.' + st.salt + '.' + b.iv + '.' + b.ct : 'v3.' + st.iter + '.' + st.salt + '.' + st.wp + '.' + st.wr + '.' + b.iv + '.' + b.ct;
  }

  function pump() {
    if (pumping) return pumping;
    pumping = (async () => {
      try {
        while (dirty && st && mem) {
          dirty = false;
          let blob;
          try { blob = await seal(JSON.stringify(mem)); } catch (e) { failed = true; continue; }
          if (ls.set(BLOB, blob)) failed = false; else { failed = true; window.dispatchEvent(new Event('todo-vault-error')); }
        }
      } finally { pumping = null; }
    })();
    return pumping;
  }
  async function writeNow(newSt) { // satu penulisan atomik: kepala + isi sekaligus
    const old = st; st = newSt;
    try {
      const blob = await seal(JSON.stringify(mem));
      const back = await openBody(st.legacy ? st.pinKey : st.dek, parse(blob));
      if (back !== JSON.stringify(mem)) throw new Error(ERR_CHECK);
      if (!ls.set(BLOB, blob)) throw new Error(ERR_STORE);
    } catch (e) { st = old; throw e; }
  }
  async function wrapAll(pin, recStr, dek, salt) {
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', dek));
    return { wp: b64(await gcmEnc(await pinKey(pin, salt, ITER), raw)), wr: b64(await gcmEnc(await recoveryKey(recStr), raw)) };
  }

  const enabled = () => !!meta;
  const ready = () => !meta || !!(st && mem);
  const api = {
    enabled, ready,
    failed: () => failed,
    hasRecovery: () => !!(st && !st.legacy),
    /* Blob terenkripsi apa adanya (untuk cadangan di Dokumen); sudah ditulis tuntas dulu. */
    async rawBlob() { await api.flush(); return ls.get(BLOB); },
    get(k) { if (!meta) return ls.get(k); return ready() && Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    set(k, v) {
      if (!meta) return ls.set(k, v);
      if (!ready()) return false;
      if (failed) failed = false;
      mem[k] = String(v); dirty = true; pump();
      return true;
    },
    del(k) { if (!meta) { ls.del(k); return; } if (ready() && k in mem) { delete mem[k]; dirty = true; pump(); } },
    flush() { return pump() || Promise.resolve(); },
    onUnlock(fn) { unlockHooks.push(fn); },
    onEnable(fn) { enableHooks.push(fn); },

    async unlock(pin) {
      if (!meta) return true;
      if (ready()) return true;
      const blob = ls.get(BLOB);
      let ns, data = {};
      try {
        if (!blob) {
          ns = { legacy: true, pinKey: await pinKey(pin, meta.salt, meta.iter), salt: meta.salt, iter: meta.iter };
        } else {
          const pb = parse(blob);
          if (pb.ver === 3) {
            const dek = await crypto.subtle.importKey('raw', await gcmDec(await pinKey(pin, pb.salt, pb.iter), unb64(pb.wp)), 'AES-GCM', true, ['encrypt', 'decrypt']);
            ns = { legacy: false, dek, salt: pb.salt, iter: pb.iter, wp: pb.wp, wr: pb.wr };
            data = JSON.parse(await openBody(dek, pb));
          } else {
            const salt = pb.ver === 2 ? pb.salt : meta.salt, iter = pb.ver === 2 ? pb.iter : meta.iter;
            ns = { legacy: true, pinKey: await pinKey(pin, salt, iter), salt, iter };
            data = JSON.parse(await openBody(ns.pinKey, pb));
          }
        }
      } catch (e) { return false; }
      st = ns; mem = data && typeof data === 'object' ? data : {};
      for (const fn of unlockHooks) { try { await fn(); } catch (e) { console.error('Hook buka gagal: ' + (e && e.message)); } }
      return true;
    },

    /* Lupa PIN: buka dengan kunci pemulihan lalu pasang PIN baru (PIN layar diganti oleh pemanggil). Salah kunci = false. */
    async unlockWithRecovery(recStr, newPin) {
      if (!meta) return false;
      const blob = ls.get(BLOB);
      let pb;
      try { pb = parse(blob); } catch (e) { return false; }
      if (pb.ver !== 3) return false;
      let dek, data;
      try {
        dek = await crypto.subtle.importKey('raw', await gcmDec(await recoveryKey(recStr), unb64(pb.wr)), 'AES-GCM', true, ['encrypt', 'decrypt']);
        data = JSON.parse(await openBody(dek, pb));
      } catch (e) { return false; }
      const salt = b64(rnd(16));
      const raw = new Uint8Array(await crypto.subtle.exportKey('raw', dek));
      const wp = b64(await gcmEnc(await pinKey(newPin, salt, ITER), raw));
      st = { legacy: false, dek, salt, iter: ITER, wp, wr: pb.wr }; mem = data && typeof data === 'object' ? data : {};
      await writeNow(st);
      for (const fn of unlockHooks) { try { await fn(); } catch (e) { console.error('Hook buka gagal: ' + (e && e.message)); } }
      return true;
    },

    /* Nyalakan: pindahkan kunci data dari localStorage ke blob v3. Plaintext dihapus setelah blob terbukti terbaca. Mengembalikan kunci pemulihan. */
    async enable(pin) {
      if (meta) throw new Error('Enkripsi sudah aktif.');
      const data = {};
      for (const g of GUARDED) { const v = ls.get(g); if (v !== null) data[g] = v; }
      const dek = await newDek(), rec = newRecoveryString(), salt = b64(rnd(16));
      const w = await wrapAll(pin, rec, dek, salt);
      const ns = { legacy: false, dek, salt, iter: ITER, wp: w.wp, wr: w.wr };
      const oldMem = mem; mem = data;
      try { await writeNow(ns); } catch (e) { mem = oldMem; st = null; ls.del(BLOB); throw e; }
      const m = { v: 3, salt, iter: ITER };
      if (!ls.set(META, JSON.stringify(m))) { ls.del(BLOB); mem = oldMem; st = null; throw new Error(ERR_STORE); }
      meta = m; dirty = false;
      for (const g of GUARDED) ls.del(g);
      for (const fn of enableHooks) { try { await fn(); } catch (e) { /* abaikan */ } }
      return rec;
    },

    async disable() {
      if (!meta) return;
      if (!ready()) throw new Error('Buka kunci dulu.');
      await api.flush();
      for (const g of GUARDED) { if (Object.prototype.hasOwnProperty.call(mem, g)) { if (!ls.set(g, mem[g])) throw new Error(ERR_STORE); } }
      ls.del(BLOB); ls.del(META);
      meta = null; st = null; mem = null; dirty = false;
    },

    /* Ganti PIN: v3 = bungkus ulang DEK (data tak berubah); v1/v2 = enkripsi ulang. Satu penulisan atomik. */
    async rekey(newPin) {
      if (!meta || !ready()) throw new Error('Buka kunci dulu.');
      await api.flush();
      const salt = b64(rnd(16));
      if (st.legacy) { await writeNow({ legacy: true, pinKey: await pinKey(newPin, salt, ITER), salt, iter: ITER }); return; }
      const raw = new Uint8Array(await crypto.subtle.exportKey('raw', st.dek));
      const wp = b64(await gcmEnc(await pinKey(newPin, salt, ITER), raw));
      await writeNow({ legacy: false, dek: st.dek, salt, iter: ITER, wp, wr: st.wr });
    },

    /* Kunci pemulihan baru (yang lama tak berlaku lagi). v1/v2: sekaligus naik ke v3 (butuh PIN). Mengembalikan kunci pemulihan. */
    async newRecovery(pin) {
      if (!meta || !ready()) throw new Error('Buka kunci dulu.');
      await api.flush();
      const rec = newRecoveryString();
      if (st.legacy) {
        const dek = await newDek(), salt = b64(rnd(16)), w = await wrapAll(pin, rec, dek, salt);
        await writeNow({ legacy: false, dek, salt, iter: ITER, wp: w.wp, wr: w.wr });
        return rec;
      }
      const raw = new Uint8Array(await crypto.subtle.exportKey('raw', st.dek));
      const wr = b64(await gcmEnc(await recoveryKey(rec), raw));
      await writeNow({ legacy: false, dek: st.dek, salt: st.salt, iter: st.iter, wp: st.wp, wr });
      return rec;
    },

    /* Baca blob dari berkas cadangan terenkripsi (PIN atau kunci pemulihan). Tidak mengubah apa pun. Mengembalikan peta kunci data atau null. */
    async decryptExternal(blobText, secret) {
      let pb;
      try { pb = parse(String(blobText).trim()); } catch (e) { return null; }
      try {
        if (pb.ver === 3) {
          let dekRaw = null;
          try { dekRaw = await gcmDec(await pinKey(secret, pb.salt, pb.iter), unb64(pb.wp)); } catch (e) { /* mungkin kunci pemulihan */ }
          if (!dekRaw) dekRaw = await gcmDec(await recoveryKey(secret), unb64(pb.wr));
          const dek = await crypto.subtle.importKey('raw', dekRaw, 'AES-GCM', false, ['decrypt']);
          return JSON.parse(await openBody(dek, pb));
        }
        if (pb.ver === 2) return JSON.parse(await openBody(await pinKey(secret, pb.salt, pb.iter), pb));
      } catch (e) { /* salah kunci */ }
      return null;
    },
    recoverable: () => /^v3\./.test(ls.get(BLOB) || ''),
    looksEncrypted: text => /^v[123]\./.test(String(text).trim()),
  };
  window.TodoVault = api;
})();
