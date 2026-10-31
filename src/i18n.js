/* Terjemahan sederhana. Kunci = teks sumber berbahasa Indonesia; kamus bahasa lain ada di i18n-en.js.
 *   T('Teks {n}', {n: 3})  → teks sesuai bahasa aktif, {n} diganti. Nilai kamus boleh berupa larik [satu, banyak]
 *   yang dipilih menurut vars.n (=== 1 → bentuk pertama).
 * Teks yang belum ada di kamus tampil apa adanya (Indonesia), jadi terjemahan yang belum lengkap tidak merusak apa pun.
 * Pesan galat dari todo-core.js yang berisi nilai dinamis diterjemahkan lewat PATTERNS (regex → fungsi).
 * Bahasa tersimpan di localStorage 'todo-lang'; mengganti bahasa memuat ulang aplikasi. Bawaan: Indonesia. */
(function (root) {
  'use strict';
  const LANGS = { id: 'Bahasa Indonesia', en: 'English' };
  const KEY = 'todo-lang';
  const DICT = { en: {} };
  const PATTERNS = { en: [] };
  const state = { lang: 'id' };
  try { const v = localStorage.getItem(KEY); if (v && LANGS[v]) state.lang = v; } catch (e) { /* tanpa penyimpanan: tetap Indonesia */ }
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  function lookup(text) {
    const d = DICT[state.lang];
    if (!d) return text;
    if (has(d, text)) return d[text];
    for (const [re, fn] of PATTERNS[state.lang] || []) { const m = re.exec(text); if (m) return fn.apply(null, m.slice(1)); }
    return text;
  }
  function T(text, vars) {
    let out = state.lang === 'id' ? text : lookup(text);
    if (Array.isArray(out)) out = vars && vars.n === 1 ? out[0] : out[1];
    if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (has(vars, k) ? String(vars[k]) : m));
    return out;
  }
  function setLang(lang) {
    if (!LANGS[lang]) return false;
    try { localStorage.setItem(KEY, lang); } catch (e) { return false; }
    state.lang = lang;
    return true;
  }
  /* Terjemahkan teks & atribut statis di index.html (satu kali saat dimuat; ganti bahasa = muat ulang). */
  function translateStatic(rootEl) {
    if (state.lang === 'id' || typeof document === 'undefined') return;
    const walker = document.createTreeWalker(rootEl || document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    for (const n of nodes) {
      if (!n.parentNode || /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)) continue;
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(n.nodeValue);
      if (m[2]) n.nodeValue = m[1] + T(m[2].replace(/\s+/g, ' ')) + m[3];
    }
    for (const el of (rootEl || document.body).querySelectorAll('[aria-label],[title],[placeholder]')) {
      for (const a of ['aria-label', 'title', 'placeholder']) if (el.hasAttribute(a)) el.setAttribute(a, T(el.getAttribute(a)));
    }
    document.documentElement.lang = state.lang;
  }
  /* Penanda "teks pengguna": h()/el() tidak menerjemahkan nilai ini (judul tugas, nama proyek, dsb.). */
  const raw = s => { const o = new String(s); o.raw = true; return o; };

  const api = { T, DICT, PATTERNS, LANGS, state, setLang, translateStatic, raw };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TodoI18n = api; root.T = T; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
