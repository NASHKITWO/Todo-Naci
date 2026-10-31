/* Penghubung aplikasi mobile: menggantikan server REST dengan logika lokal (todo-core.js).
 *  - data disimpan di localStorage WebView (privat untuk aplikasi),
 *  - notifikasi lokal lewat plugin Capacitor LocalNotifications (bila berjalan di Android),
 *  - cadangan/pemulihan data sebagai teks JSON,
 *  - sinkronisasi antar perangkat lewat berkas JSON (dibagikan ke Drive/Dropbox, digabung dari berkas),
 *  - sinkron otomatis lewat GitHub Gist (opsional, lihat autosync.js),
 *  - snapshot harian di perangkat + salinan berkas di folder Dokumen (Android),
 *  - data untuk widget layar utama (plugin native TodoWidget, Android).
 * Di browser biasa (tanpa Capacitor) semuanya tetap jalan, hanya notifikasi yang dilewati. */
(function () {
  'use strict';
  const core = window.TodoCore;
  const KEY = 'todo-cli.data.v1';
  const SNAP_KEY = 'todo-cli.snapshots', AUTO_KEY = 'todo-cli.autosync', STATUS_KEY = 'todo-cli.status';
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const pad2 = n => String(n).padStart(2, '0');
  const hhmm = d => pad2(d.getHours()) + ':' + pad2(d.getMinutes());

  const persist = {
    load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } },
    save(obj) {
      try { localStorage.setItem(KEY, JSON.stringify(obj)); }
      catch (e) { throw new Error('Penyimpanan di perangkat gagal (penuh atau diblokir).'); }
    },
  };
  const store = new core.Store(persist);
  const clone = v => JSON.parse(JSON.stringify(v));

  /* ---------- notifikasi ---------- */
  const plugin = name => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name];
  const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  let permissionAsked = false;
  let timer = null;

  async function ensurePermission(LN) {
    const cur = await LN.checkPermissions();
    if (cur.display === 'granted') return true;
    if (permissionAsked) return false;
    permissionAsked = true;
    return (await LN.requestPermissions()).display === 'granted';
  }

  /* Aksi di notifikasi (tombol "Selesai" / "Tunda 1 jam"). Di Android, menekan tombol membuka aplikasi lalu event
   * `localNotificationActionPerformed` sampai ke sini (Capacitor menahan event itu sampai ada pendengar). */
  const ACTION_TYPE = 'TASK';
  const localIso = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  let actionsReady = false;
  async function setupNotificationActions() {
    const LN = plugin('LocalNotifications');
    if (actionsReady || !isNative() || !LN) return;
    actionsReady = true;
    try {
      if (typeof LN.registerActionTypes === 'function') {
        await LN.registerActionTypes({ types: [{ id: ACTION_TYPE, actions: [
          { id: 'done', title: window.T ? window.T('Selesai') : 'Selesai' },
          { id: 'snooze', title: window.T ? window.T('Tunda 1 jam') : 'Tunda 1 jam' },
        ] }] });
      }
      if (typeof LN.addListener === 'function') await LN.addListener('localNotificationActionPerformed', onNotificationAction);
    } catch (e) {
      actionsReady = false;
      console.error('Aksi notifikasi gagal disiapkan: ' + (e && e.message));
    }
  }
  async function onNotificationAction(ev) {
    try {
      const uid = ev && ev.notification && ev.notification.extra && ev.notification.extra.uid;
      const t = uid && store.tasks.find(x => x.uid === uid);
      if (!t) return; // tugas sudah dihapus: tidak ada yang dilakukan
      if (ev.actionId === 'done') {
        if (!t.done) await window.todoLocalApi('POST', '/api/tasks/' + t.id + '/done');
      } else if (ev.actionId === 'snooze') {
        const d = new Date(Date.now() + 3600000);
        d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
        await window.todoLocalApi('PATCH', '/api/tasks/' + t.id, { deadline: localIso(d), due_time: hhmm(d) });
      } else if (typeof window.openTaskById === 'function') { window.openTaskById(t.id); return; }
      const LN = plugin('LocalNotifications');
      if (LN && typeof LN.removeDeliveredNotifications === 'function' && ev.notification && ev.notification.id != null) {
        try { await LN.removeDeliveredNotifications({ notifications: [{ id: ev.notification.id }] }); } catch (e) { /* tidak penting */ }
      }
      if (typeof window.refresh === 'function') window.refresh();
    } catch (e) {
      console.error('Aksi notifikasi gagal: ' + (e && e.message));
    }
  }
  /* Pengingat tugas (id < 1e9) mendapat tombol aksi + uid tugas; ringkasan harian hanya bisa diketuk. */
  function withActions(p) {
    const n = { id: p.id, title: p.title, body: p.body, schedule: { at: p.at, allowWhileIdle: true } };
    if (p.id < 1000000000) {
      const t = store.tasks.find(x => x.id === Math.floor(p.id / 2));
      if (t) { n.actionTypeId = ACTION_TYPE; n.extra = { uid: t.uid }; }
    }
    return n;
  }

  async function reschedule() {
    const LN = plugin('LocalNotifications');
    if (!isNative() || !LN) return;
    try {
      if (!(await ensurePermission(LN))) return;
      const pending = await LN.getPending();
      if (pending.notifications && pending.notifications.length) {
        await LN.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
      }
      const plan = core.planReminders(store.upcoming(), new Date());
      if (!plan.length) return;
      await setupNotificationActions();
      await LN.schedule({ notifications: plan.map(withActions) });
    } catch (e) {
      console.error('Gagal menjadwalkan notifikasi: ' + (e && e.message));
    }
  }
  function scheduleSoon() { clearTimeout(timer); timer = setTimeout(afterChange, 400); }
  async function afterChange() {
    for (const job of [reschedule, pushWidget, maybeSnapshot]) {
      try { await job(); } catch (e) { console.error('Tugas latar gagal: ' + (e && e.message)); }
    }
  }

  /* ---------- widget layar utama (Android) ---------- */
  let widgetPlugin, lastWidget = null;
  function widgetBridge() {
    if (widgetPlugin !== undefined) return widgetPlugin;
    let p = plugin('TodoWidget');
    if (!p && window.Capacitor && typeof window.Capacitor.registerPlugin === 'function') {
      try { p = window.Capacitor.registerPlugin('TodoWidget'); } catch (e) { p = null; }
    }
    return (widgetPlugin = p || null);
  }
  async function pushWidget() {
    if (!isNative()) return;
    const W = widgetBridge();
    if (!W || typeof W.update !== 'function') return;
    const items = JSON.stringify(store.widgetItems());
    if (items === lastWidget) return;
    await W.update({ items });
    lastWidget = items;
  }

  /* Tugas yang dicentang di widget (uid) diterapkan di sini; tombol "+" widget memfokuskan kolom tambah tugas. */
  async function applyWidgetActions() {
    if (!isNative()) return;
    const W = widgetBridge();
    if (!W) return;
    try {
      if (typeof W.completed === 'function') {
        const res = await W.completed();
        const uids = (res && res.uids) || [];
        let changed = false;
        for (const uid of uids) {
          const t = store.tasks.find(x => x.uid === uid);
          if (t && !t.done) { await window.todoLocalApi('POST', '/api/tasks/' + t.id + '/done'); changed = true; }
        }
        if (uids.length) await W.clearCompleted({ uids });
        if (changed && typeof window.refresh === 'function') window.refresh();
      }
      if (typeof W.action === 'function') {
        const res = await W.action();
        if (res && res.action === 'add') {
          const q = document.getElementById('quick-input');
          if (q) { window.scrollTo(0, 0); q.focus(); }
        }
      }
    } catch (e) {
      console.error('Aksi widget gagal: ' + (e && e.message));
    }
  }

  /* ---------- snapshot harian & salinan di folder Dokumen ---------- */
  const loadSnaps = () => { const v = lsGet(SNAP_KEY); return Array.isArray(v) ? v : []; };
  const asSyncFile = state => ({ app: 'todo-cli', kind: 'sync', format: 1, device: 'snapshot', exported_at: '', tasks: state.tasks, deleted: state.deleted });
  const status = Object.assign({ doc: null, auto: null }, lsGet(STATUS_KEY));
  const saveStatus = () => lsSet(STATUS_KEY, status);

  async function maybeSnapshot() {
    const f = store.syncFile('snapshot');
    const r = core.rotateSnapshots(loadSnaps(), { tasks: f.tasks, deleted: f.deleted }, store.clock.now(), 7);
    if (!r.created) return;
    lsSet(SNAP_KEY, r.list);
    await writeDocuments(true);
  }

  let lastDoc = null, docAt = 0;
  async function writeDocuments(force) {
    const FS = plugin('Filesystem');
    if (!isNative() || !FS) return;
    const f = store.syncFile('Android');
    if (!f.tasks.length) return; // jangan menimpa salinan lama dengan data kosong
    const sig = JSON.stringify([f.tasks, f.deleted]);
    if (!force && (sig === lastDoc || (docAt && Date.now() - docAt < 600000))) return;
    try {
      await FS.writeFile({ path: 'Todo/todo-cadangan.json', data: JSON.stringify(f), directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
      lastDoc = sig; docAt = Date.now();
      status.doc = { ok: true, at: hhmm(new Date()) };
    } catch (e) {
      status.doc = { ok: false, at: hhmm(new Date()), msg: String((e && e.message) || e) };
    }
    saveStatus();
  }

  /* ---------- sinkron otomatis (GitHub Gist) ---------- */
  const loadCfg = () => { const c = lsGet(AUTO_KEY); return c && c.token ? c : null; };
  let syncing = false, again = false, autoTimer = null, onAutoStatus = () => {};
  function autoSyncSoon(ms) { if (!loadCfg()) return; clearTimeout(autoTimer); autoTimer = setTimeout(autoSyncNow, ms == null ? 4000 : ms); }
  async function autoSyncNow() {
    const cfg = loadCfg();
    if (!cfg || !window.TodoAutoSync) return;
    if (syncing) { again = true; return; }
    syncing = true;
    try {
      const r = await window.TodoAutoSync.run(store, cfg, window.fetch.bind(window));
      if (r.gistId !== cfg.gistId) lsSet(AUTO_KEY, Object.assign({}, cfg, { gistId: r.gistId }));
      const d = r.summary;
      status.auto = { ok: true, at: hhmm(new Date()), summary: d, pushed: r.pushed };
      if (d.added || d.updated || d.deleted) {
        scheduleSoon();
        if (typeof window.refresh === 'function') window.refresh();
      }
    } catch (e) {
      status.auto = { ok: false, at: hhmm(new Date()), msg: String((e && e.message) || e) };
    } finally {
      syncing = false;
      saveStatus();
      onAutoStatus();
      if (again) { again = false; autoSyncSoon(); }
    }
  }

  /* ---------- API yang dipanggil app.js ---------- */
  /* Bagikan teks (lembar bagikan Android, atau salin ke papan klip). Hasil: 'shared' | 'copied' | 'cancelled' | 'failed'. */
  window.todoShareText = async function (title, text) {
    const Share = plugin('Share');
    try {
      if (Share) { await Share.share({ title, text, dialogTitle: title }); return 'shared'; }
      if (navigator.share) { await navigator.share({ title, text }); return 'shared'; }
      if (navigator.clipboard) { await navigator.clipboard.writeText(text); return 'copied'; }
    } catch (e) { return /cancel|abort/i.test(String(e && (e.message || e.name))) ? 'cancelled' : 'failed'; }
    return 'failed';
  };

  window.todoLocalApi = async function (method, path, body) {
    const result = core.handle(store, method, path, body === undefined ? {} : clone(body));
    if (result.status >= 400) throw new Error((result.body && result.body.error) || ('Kesalahan ' + result.status));
    if (method !== 'GET') { scheduleSoon(); autoSyncSoon(); }
    return clone(result.body);
  };
  window.todoLocalStore = store; // untuk tes

  /* ---------- cadangan & pemulihan ---------- */
  const T = window.T;
  function el(tag, attrs, ...kids) {
    const node = document.createElement(tag);
    for (const k of Object.keys(attrs || {})) {
      if (k === 'class') node.className = attrs[k];
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, typeof attrs[k] === 'string' && (k === 'aria-label' || k === 'placeholder' || k === 'title') ? T(attrs[k]) : attrs[k]);
    }
    for (const kid of kids) node.append(typeof kid === 'string' ? T(kid) : kid);
    return node;
  }

  const aboutText = () => 'Tuntas Harian v' + (window.TODO_VERSION || '') + ' · ' + T('Pendiri dan Pengembang: Muhammad Ikhsan') + ', ' + T('Teknik Informatika, Universitas Pamulang') + ', ican3192@gmail.com';
  function buildAbout() {
    const foot = document.getElementById('about-foot');
    if (!foot) return;
    foot.append(el('div', { class: 'about-title' }, 'Tuntas Harian v' + (window.TODO_VERSION || '')),
      el('div', {}, 'Pendiri dan Pengembang: Muhammad Ikhsan'),
      el('div', {}, 'Teknik Informatika, Universitas Pamulang'),
      el('a', { href: 'mailto:ican3192@gmail.com' }, 'ican3192@gmail.com'),
      el('a', { class: 'donate', id: 'donate-link', href: 'https://sociabuzz.com/nacitwo/tribe', target: '_blank', rel: 'noopener noreferrer' }, '\u2665 ' + T('Dukung pengembang (donasi)')));
  }

  function buildBackupUi() {
    const msg = el('div', { class: 'login-err', id: 'backup-msg', role: 'status' });
    const text = el('textarea', { class: 'input', id: 'backup-text', rows: '6', 'aria-label': 'Teks cadangan', placeholder: 'Tempel teks cadangan di sini untuk memulihkan…' });
    const say = (t, bad) => { msg.textContent = T(t); msg.classList.toggle('ok', !bad); };

    const share = el('button', { class: 'btn primary', type: 'button', id: 'backup-share', onclick: async () => {
      const json = JSON.stringify(store.exportData());
      const Share = plugin('Share');
      try {
        if (Share) { await Share.share({ title: T('Cadangan Tuntas Harian'), text: json, dialogTitle: T('Simpan cadangan ke…') }); say('Cadangan dibagikan. Simpan di tempat aman (mis. kirim ke diri sendiri).'); }
        else if (navigator.clipboard) { await navigator.clipboard.writeText(json); say('Cadangan disalin ke papan klip.'); }
        else { text.value = json; text.select(); say('Salin teks di bawah ini dan simpan.'); }
      } catch (e) {
        if (!/cancel/i.test(String(e && e.message))) { text.value = json; say('Tidak bisa membagikan; salin teks di bawah ini secara manual.', true); }
      }
    } }, 'Bagikan cadangan');

    const restore = el('button', { class: 'btn', type: 'button', id: 'backup-restore', onclick: () => {
      let data;
      try { data = JSON.parse(text.value); } catch (e) { say('Teks bukan JSON yang valid.', true); return; }
      if (!window.confirm('Tugas dari cadangan akan DITAMBAHKAN ke daftar sekarang. Lanjutkan?')) return;
      try {
        const n = store.importData(data);
        text.value = '';
        say(T('{n} tugas dipulihkan.', { n }));
        scheduleSoon();
        if (typeof window.refresh === 'function') window.refresh();
      } catch (e) { say(e.message, true); }
    } }, 'Pulihkan dari teks');

    // ---- sinkronisasi lewat berkas ----
    const syncMsg = el('div', { class: 'login-err', id: 'sync-msg', role: 'status' });
    const saySync = (t, bad) => { syncMsg.textContent = T(t); syncMsg.classList.toggle('ok', !bad); };
    const SYNC_NAME = 'todo-sync.json';
    const syncSend = el('button', { class: 'btn primary', type: 'button', id: 'sync-send', onclick: async () => {
      const json = JSON.stringify(store.syncFile('Android'));
      const Share = plugin('Share'), FS = plugin('Filesystem');
      try {
        if (isNative() && Share && FS) {
          const written = await FS.writeFile({ path: SYNC_NAME, data: json, directory: 'CACHE', encoding: 'utf8' });
          await Share.share({ title: T('Berkas sinkron Tuntas Harian'), files: [written.uri], dialogTitle: T('Simpan berkas sinkron ke…') });
          saySync('Berkas dibagikan. Simpan ke Drive/Dropbox yang sama dengan perangkat lain.');
        } else {
          const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
          const a = el('a', { href: url, download: SYNC_NAME });
          document.body.append(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          saySync(T('Berkas {name} diunduh.', { name: SYNC_NAME }));
        }
      } catch (e) {
        if (!/cancel/i.test(String(e && e.message))) saySync(T('Tidak bisa membagikan berkas: {msg}', { msg: T(String(e && e.message)) }), true);
      }
    } }, 'Kirim berkas sinkron');
    const picker = el('input', { type: 'file', id: 'sync-file', accept: 'application/json,.json', hidden: '', 'aria-label': 'Berkas sinkron' });
    picker.addEventListener('change', async () => {
      const file = picker.files && picker.files[0];
      picker.value = '';
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const r = store.syncWith(data);
        saySync(T('Selesai: {added} baru, {updated} diperbarui, {deleted} dihapus.', r));
        scheduleSoon();
        if (typeof window.refresh === 'function') window.refresh();
      } catch (e) {
        saySync(e instanceof SyntaxError ? 'Berkas bukan JSON yang valid.' : e.message, true);
      }
    });
    const syncMerge = el('button', { class: 'btn', type: 'button', id: 'sync-merge', onclick: () => picker.click() }, 'Gabungkan dari berkas…');

    // ---- cadangan otomatis di perangkat (snapshot harian) ----
    const snapMsg = el('div', { class: 'login-err', id: 'snap-msg', role: 'status' });
    const saySnap = (t, bad) => { snapMsg.textContent = T(t); snapMsg.classList.toggle('ok', !bad); };
    const snapList = el('div', { id: 'snap-list' });
    const docStatus = el('p', { class: 'sub', id: 'doc-status' });
    const dayLabel = day => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(window.TodoI18n.state.lang === 'en' ? 'en-US' : 'id-ID', { weekday: 'short', day: 'numeric', month: 'short' }); };
    function renderSnaps() {
      snapList.replaceChildren();
      const list = loadSnaps().slice().reverse();
      if (!list.length) snapList.append(el('p', { class: 'sub' }, 'Belum ada salinan. Salinan pertama dibuat otomatis begitu ada tugas.'));
      for (const snap of list) {
        const label = dayLabel(snap.day) + (snap.pre ? ' ' + T('(sebelum pemulihan)') : '') + ' · ' + T('{n} tugas', { n: snap.state.tasks.length });
        snapList.append(el('div', { class: 'snap-row' }, el('span', {}, label),
          el('button', { class: 'btn', type: 'button', 'data-day': snap.day, onclick: () => restoreSnap(snap, label) }, 'Pulihkan')));
      }
      const d = status.doc;
      docStatus.textContent = !d ? (isNative() ? T('Salinan berkas di folder Dokumen/Todo: belum ditulis.') : '')
        : d.ok ? T('Salinan berkas di Dokumen/Todo/todo-cadangan.json diperbarui pukul {at}. Pulihkan lewat "Gabungkan dari berkas…".', { at: d.at })
          : T('Salinan ke folder Dokumen gagal ({msg}). Salinan di dalam aplikasi tetap dibuat.', { msg: d.msg });
    }
    function restoreSnap(snap, label) {
      if (!window.confirm(T('Daftar tugas akan DIGANTI persis seperti pada {label}. Tugas yang dibuat/diubah sesudahnya hilang (kondisi sekarang disimpan dulu sebagai salinan). Lanjutkan?', { label }))) return;
      try {
        const now = store.clock.now(), cur = store.syncFile('snapshot');
        lsSet(SNAP_KEY, loadSnaps().concat([{ day: now.slice(0, 10), at: now, pre: true, state: { tasks: cur.tasks, deleted: cur.deleted } }]).slice(-8));
        const r = store.restoreSnapshot(asSyncFile(snap.state));
        saySnap(T('{restored} tugas dipulihkan, {removed} dihapus.', r));
        scheduleSoon(); autoSyncSoon();
        if (typeof window.refresh === 'function') window.refresh();
        renderSnaps();
      } catch (e) { saySnap(e.message, true); }
    }

    // ---- sinkron otomatis (GitHub Gist) ----
    const autoMsg = el('div', { class: 'login-err', id: 'auto-msg', role: 'status' });
    const sayAuto = (t, bad) => { autoMsg.textContent = T(t); autoMsg.classList.toggle('ok', !bad); };
    const token = el('input', { class: 'input', id: 'auto-token', type: 'password', autocomplete: 'off', placeholder: 'Token GitHub (izin: gist)', 'aria-label': 'Token GitHub' });
    const pass = el('input', { class: 'input', id: 'auto-pass', type: 'password', autocomplete: 'off', placeholder: 'Kata sandi sinkron (sama di semua perangkat)', 'aria-label': 'Kata sandi sinkron' });
    const randomHex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');
    const autoOn = el('button', { class: 'btn primary', type: 'button', id: 'auto-on', onclick: async () => {
      const value = token.value.trim(), secret = pass.value;
      if (!value) { sayAuto('Isi token dulu.', true); return; }
      if (secret.length < 8) { sayAuto('Kata sandi sinkron minimal 8 karakter.', true); return; }
      if (!window.confirm('Data tugas dienkripsi dengan kata sandi ini di HP, lalu dikirim ke gist rahasia di akun GitHub Anda. Token dan kata sandi disimpan hanya di HP ini. LUPA kata sandi = data di gist tidak bisa dibuka (data di HP tetap aman). Lanjutkan?')) return;
      lsSet(AUTO_KEY, { token: value, passphrase: secret, deviceId: randomHex(4) });
      token.value = ''; pass.value = '';
      status.auto = null; sayAuto('Menyambungkan…'); renderAuto();
      await autoSyncNow();
    } }, 'Aktifkan sinkron otomatis');
    const autoNow = el('button', { class: 'btn primary', type: 'button', id: 'auto-now', onclick: () => { sayAuto('Menyinkronkan…'); autoSyncNow(); } }, 'Sinkron sekarang');
    const autoOff = el('button', { class: 'btn', type: 'button', id: 'auto-off', onclick: () => {
      if (!window.confirm('Matikan sinkron otomatis di HP ini? Token dan kata sandi dihapus dari HP; gist di GitHub tidak dihapus.')) return;
      try { localStorage.removeItem(AUTO_KEY); } catch (e) { /* abaikan */ }
      status.auto = null; saveStatus(); sayAuto(''); renderAuto();
    } }, 'Matikan');
    const autoReset = el('button', { class: 'btn', type: 'button', id: 'auto-reset', onclick: async () => {
      const cfg = loadCfg();
      if (!cfg || !window.TodoAutoSync) return;
      if (!window.confirm('Hapus SEMUA berkas sinkron di gist (milik semua perangkat)? Data di HP tidak berubah dan akan dikirim ulang. Berguna bila lupa kata sandi: setelah ini matikan, lalu aktifkan lagi dengan kata sandi baru di tiap perangkat.')) return;
      try { const n = await window.TodoAutoSync.reset(cfg, window.fetch.bind(window)); sayAuto(T('{n} berkas sinkron dihapus dari gist.', { n })); }
      catch (e) { sayAuto(e.message, true); }
    } }, 'Atur ulang gist');
    function renderAuto() {
      const cfg = loadCfg(), a = status.auto;
      token.hidden = pass.hidden = autoOn.hidden = !!cfg;
      autoNow.hidden = autoOff.hidden = autoReset.hidden = !cfg;
      if (!cfg) return;
      if (!a) { sayAuto(cfg.gistId ? T('Aktif (gist {id}).', { id: cfg.gistId.slice(0, 7) }) : T('Aktif.')); return; }
      if (a.ok) {
        const d = a.summary, ch = d.added + d.updated + d.deleted;
        sayAuto(ch ? T('Terakhir sinkron pukul {at}: {added} baru, {updated} diperbarui, {deleted} dihapus.', { at: a.at, added: d.added, updated: d.updated, deleted: d.deleted })
          : T('Terakhir sinkron pukul {at}, tidak ada perubahan.', { at: a.at }));
      } else sayAuto(T('Gagal pukul {at}: {msg}', { at: a.at, msg: T(a.msg) }), true);
    }
    onAutoStatus = renderAuto;

    const closeOverlay = () => { overlay.hidden = true; window.TodoA11y.close(overlay); };
    const close = el('button', { class: 'btn', type: 'button', id: 'backup-close', onclick: closeOverlay }, 'Tutup');
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !overlay.hidden) { e.preventDefault(); e.stopImmediatePropagation(); closeOverlay(); }
    }, true);
    const overlay = el('div', { class: 'login', id: 'backup', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'backup-title', hidden: '' },
      el('div', { class: 'login-card' },
        el('h2', { id: 'backup-title', tabindex: '-1' }, 'Cadangan & sinkron'),
        el('p', { class: 'sub' }, 'Data tugas hanya ada di HP ini. Jika aplikasi dihapus, data ikut hilang, jadi simpan cadangan secara berkala.'),
        share, text, restore, msg,
        el('h3', {}, 'Cadangan otomatis di perangkat'),
        el('p', { class: 'sub' }, 'Salinan harian (7 terakhir) disimpan di dalam aplikasi. Di Android, berkas todo-cadangan.json juga ditulis ke folder Dokumen/Todo, dan cadangan otomatis Google (bila aktif di HP) memulihkan data saat ganti HP.'),
        snapList, snapMsg, docStatus,
        el('h3', {}, 'Sinkron antar perangkat'),
        el('p', { class: 'sub' }, 'Lewat berkas: simpan di Drive/Dropbox, lalu gabungkan dari perangkat lain. Versi yang lebih baru menang; tugas yang dihapus ikut terhapus. Pakai jam yang benar di semua perangkat.'),
        syncSend, syncMerge, picker, syncMsg,
        el('h3', {}, 'Sinkron otomatis'),
        el('p', { class: 'sub' }, 'Opsional. Memakai gist rahasia di akun GitHub Anda: buat token klasik dengan izin "gist" saja, lalu tentukan kata sandi sinkron. Di perangkat lain isi token dan kata sandi yang sama. Isi tugas dienkripsi di HP sebelum dikirim, jadi tidak terbaca di GitHub; token dan kata sandi hanya disimpan di HP ini.'),
        token, pass, autoOn, autoNow, autoOff, autoReset, autoMsg,
        el('p', { class: 'sub', id: 'about' }, aboutText()),
        close));
    document.body.append(overlay);

    const btn = el('button', { class: 'nav-item', type: 'button', id: 'backup-btn', onclick: () => {
        msg.textContent = ''; snapMsg.textContent = ''; renderSnaps(); renderAuto();
        if (typeof window.closeNav === 'function') window.closeNav();
        overlay.hidden = false;
        window.TodoA11y.open(overlay, { focus: '#backup-title', returnTo: () => {
          const b = document.getElementById('backup-btn');
          return b && !b.closest('[inert]') ? b : document.getElementById('menu-btn');
        } });
      } },
      el('span', { class: 'lbl' }, 'Cadangan & sinkron'));
    const settings = document.getElementById('side-settings');
    if (settings) settings.append(btn); else document.body.append(btn);
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildBackupUi();
    buildAbout();
    setupNotificationActions();
    applyWidgetActions().then(scheduleSoon);
    autoSyncSoon(800);
    setInterval(() => { if (!document.hidden) autoSyncSoon(0); }, 300000);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { writeDocuments(false); return; }
    applyWidgetActions().then(scheduleSoon);
    autoSyncSoon(300);
  });
})();
