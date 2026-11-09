/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Program ini perangkat lunak bebas di bawah GNU GPL v3 atau yang lebih baru, TANPA JAMINAN; lihat LICENSE dan NOTICE. */
/* Enkripsi data di perangkat (opsional, butuh kunci PIN aktif).
 *  - Kunci AES-256-GCM diturunkan dari PIN: PBKDF2-SHA256, 300.000 putaran, garam acak terpisah dari garam kunci layar.
 *  - Kunci hanya ada di memori (tidak pernah ditulis); data tugas, snapshot, dan salinan data rusak disimpan sebagai satu blob terenkripsi.
 *  - Selama dibuka, data ada di memori; tulis ke penyimpanan berjalan asinkron berurutan (versi terbaru menang).
 *  - Batas yang jujur: PIN pendek (mis. 4 angka) punya ruang tebakan kecil. Penyerang yang menyalin penyimpanan bisa mencoba semua PIN secara
 *    luring (kira-kira 10^8 tebakan x 300.000 putaran), jadi ini menghalangi pembacaan santai, bukan penyerang berdaya besar.
 *  - Lupa PIN = data di perangkat tak bisa dibuka (pulihkan dari cadangan atau sinkron). */
(function () {
  'use strict';
  const META = 'todo-cli.vault', BLOB = 'todo-cli.vault.blob', ITER = 300000;
  const GUARDED = ['todo-cli.data.v1', 'todo-cli.snapshots', 'todo-cli.data.corrupt'];
  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: k => { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } },
  };
  const b64 = buf => { let s = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const readMeta = () => { try { const m = JSON.parse(ls.get(META)); return m && m.salt && m.iter ? m : null; } catch (e) { return null; } };

  let meta = readMeta(), cur = meta ? { salt: meta.salt, iter: meta.iter } : null, key = null, mem = null, dirty = false, pumping = null, failed = false;
  const unlockHooks = [], enableHooks = [];

  async function derive(pin, saltB64, iter) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  /* Format v2 memuat garam dan putaran di kepala blob, jadi ganti PIN cukup SATU penulisan atomik. v1 (0.40.0) masih terbaca. */
  async function seal(k, text, c) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(text));
    return 'v2.' + c.iter + '.' + c.salt + '.' + b64(iv) + '.' + b64(ct);
  }
  const head = blob => { const p = String(blob).split('.'); return p[0] === 'v2' && p.length === 5 ? { salt: p[2], iter: Number(p[1]) } : null; };
  async function open(k, blob) {
    const p = String(blob).split('.');
    let iv, ct;
    if (p[0] === 'v2' && p.length === 5) { iv = p[3]; ct = p[4]; } else if (p[0] === 'v1' && p.length === 3) { iv = p[1]; ct = p[2]; } else throw new Error('format');
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, k, unb64(ct)));
  }

  /* Tulis blob: satu penulis sekali jalan; perubahan yang masuk saat menulis ditulis pada putaran berikutnya. */
  function pump() {
    if (pumping) return pumping;
    pumping = (async () => {
      try {
        while (dirty && key && mem) {
          dirty = false;
          let blob;
          try { blob = await seal(key, JSON.stringify(mem), cur); } catch (e) { failed = true; continue; }
          if (ls.set(BLOB, blob)) failed = false; else { failed = true; window.dispatchEvent(new Event('todo-vault-error')); }
        }
      } finally { pumping = null; }
    })();
    return pumping;
  }

  const enabled = () => !!meta;
  const ready = () => !meta || !!(key && mem);
  const api = {
    enabled, ready,
    failed: () => failed,
    /* Akses sinkron untuk kunci data. Tanpa enkripsi: langsung ke localStorage. Terkunci: kosong dan tolak tulis. */
    get(k) { if (!meta) return ls.get(k); return ready() && Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    set(k, v) {
      if (!meta) return ls.set(k, v);
      if (!ready()) return false;
      if (failed) { failed = false; } // beri kesempatan menulis ulang
      mem[k] = String(v); dirty = true; pump();
      return true;
    },
    del(k) { if (!meta) { ls.del(k); return; } if (ready() && k in mem) { delete mem[k]; dirty = true; pump(); } },
    flush() { return pump() || Promise.resolve(); },
    onUnlock(fn) { unlockHooks.push(fn); },
    onEnable(fn) { enableHooks.push(fn); },

    /* Buka dengan PIN (dipanggil setelah PIN layar terverifikasi). Salah kunci = false, tidak ada yang berubah. */
    async unlock(pin) {
      if (!meta) return true;
      if (ready()) return true;
      const blob = ls.get(BLOB);
      const c = (blob && head(blob)) || { salt: meta.salt, iter: meta.iter };
      const k = await derive(pin, c.salt, c.iter);
      let data = {};
      if (blob) { try { data = JSON.parse(await open(k, blob)); } catch (e) { return false; } }
      key = k; cur = c; mem = data && typeof data === 'object' ? data : {};
      for (const fn of unlockHooks) { try { await fn(); } catch (e) { console.error('Hook buka gagal: ' + (e && e.message)); } }
      return true;
    },

    /* Nyalakan: pindahkan kunci data dari localStorage ke blob. Plaintext baru dihapus setelah blob terbukti bisa dibaca kembali. */
    async enable(pin) {
      if (meta) throw new Error('Enkripsi sudah aktif.');
      const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
      const k = await derive(pin, salt, ITER);
      const data = {};
      for (const g of GUARDED) { const v = ls.get(g); if (v !== null) data[g] = v; }
      const blob = await seal(k, JSON.stringify(data), { salt, iter: ITER });
      if (!ls.set(BLOB, blob)) throw new Error('Penyimpanan di perangkat gagal (penuh atau diblokir).');
      let back;
      try { back = JSON.parse(await open(k, ls.get(BLOB))); } catch (e) { ls.del(BLOB); throw new Error('Pemeriksaan hasil enkripsi gagal; data tidak diubah.'); }
      if (JSON.stringify(back) !== JSON.stringify(data)) { ls.del(BLOB); throw new Error('Pemeriksaan hasil enkripsi gagal; data tidak diubah.'); }
      const m = { v: 1, salt, iter: ITER };
      if (!ls.set(META, JSON.stringify(m))) { ls.del(BLOB); throw new Error('Penyimpanan di perangkat gagal (penuh atau diblokir).'); }
      meta = m; cur = { salt, iter: ITER }; key = k; mem = data; dirty = false;
      for (const g of GUARDED) ls.del(g);
      for (const fn of enableHooks) { try { await fn(); } catch (e) { /* abaikan */ } }
    },

    /* Matikan: tulis kembali sebagai teks biasa, baru hapus blob. Wajib sudah terbuka. */
    async disable() {
      if (!meta) return;
      if (!ready()) throw new Error('Buka kunci dulu.');
      await api.flush();
      for (const g of GUARDED) { if (Object.prototype.hasOwnProperty.call(mem, g)) { if (!ls.set(g, mem[g])) { throw new Error('Penyimpanan di perangkat gagal (penuh atau diblokir).'); } } }
      ls.del(BLOB); ls.del(META);
      meta = null; cur = null; key = null; mem = null; dirty = false;
    },

    /* Ganti PIN: data dienkripsi ulang dengan kunci baru dan ditulis dalam satu penulisan atomik (garam baru ada di kepala blob). */
    async rekey(newPin) {
      if (!meta || !ready()) throw new Error('Buka kunci dulu.');
      await api.flush();
      const c = { salt: b64(crypto.getRandomValues(new Uint8Array(16))), iter: ITER };
      const k = await derive(newPin, c.salt, c.iter);
      const blob = await seal(k, JSON.stringify(mem), c);
      let back;
      try { back = await open(k, blob); } catch (e) { throw new Error('Pemeriksaan hasil enkripsi gagal; data tidak diubah.'); }
      if (back !== JSON.stringify(mem)) throw new Error('Pemeriksaan hasil enkripsi gagal; data tidak diubah.');
      if (!ls.set(BLOB, blob)) throw new Error('Penyimpanan di perangkat gagal (penuh atau diblokir).');
      key = k; cur = c;
    },
  };
  window.TodoVault = api;
})();
