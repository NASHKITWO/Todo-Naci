/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Program ini perangkat lunak bebas di bawah GNU GPL v3 atau yang lebih baru, TANPA JAMINAN; lihat LICENSE dan NOTICE. */
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
  /* Kunci data (tugas, snapshot, salinan rusak) lewat TodoVault: localStorage biasa, atau blob terenkripsi bila enkripsi PIN aktif. */
  const V = window.TodoVault || { enabled: () => false, ready: () => true, get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }, del: k => { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } }, failed: () => false, onUnlock() {}, onEnable() {} };
  const vReady = () => V.ready();
  const pad2 = n => String(n).padStart(2, '0');
  const hhmm = d => pad2(d.getHours()) + ':' + pad2(d.getMinutes());

  /* Data tugas rusak (JSON tak terbaca / bentuk tak sesuai): jangan diam-diam mulai kosong lalu menimpanya. Salinan mentahnya
   * disimpan di CORRUPT_KEY (yang pertama saja), dan tampilan menawarkan pemulihan dari snapshot harian. */
  const CORRUPT_KEY = 'todo-cli.data.corrupt';
  const looksValid = o => o && typeof o === 'object' && Array.isArray(o.tasks) && o.tasks.every(t => t && typeof t === 'object' && Number.isInteger(t.id) && typeof t.title === 'string');
  const persist = {
    load() {
      let raw = null;
      if (!vReady()) return null; // data terenkripsi belum dibuka
      raw = V.get(KEY);
      if (raw === null) return null;
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { /* rusak */ }
      if (looksValid(parsed)) return parsed;
      // Satu baris cacat tidak boleh membuang seluruh daftar: simpan baris yang sehat, salinan mentah tetap diamankan.
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.tasks)) {
        const good = parsed.tasks.filter(t => t && typeof t === 'object' && Number.isInteger(t.id) && typeof t.title === 'string');
        if (good.length) {
          if (V.get(CORRUPT_KEY) === null) V.set(CORRUPT_KEY, raw);
          return Object.assign({}, parsed, { tasks: good });
        }
      }
      let saved = false;
      if (V.get(CORRUPT_KEY) === null) V.set(CORRUPT_KEY, raw);
      saved = V.get(CORRUPT_KEY) !== null;
      if (!saved) persist.blocked = true; // salinan mentah tak bisa diamankan: jangan menimpa data asli dengan data kosong
      return null;
    },
    save(obj) {
      if (persist.blocked) throw new Error('Data lama rusak dan salinannya belum bisa diamankan (penyimpanan penuh). Kosongkan ruang lalu buka ulang aplikasi.');
      if (!vReady()) throw new Error('Data terkunci. Buka dengan PIN dulu.');
      if (V.enabled() && V.failed()) throw new Error('Penyimpanan terenkripsi gagal ditulis (penuh atau diblokir).');
      if (!V.set(KEY, JSON.stringify(obj))) throw new Error('Penyimpanan di perangkat gagal (penuh atau diblokir).');
    },
  };
  const store = new core.Store(persist);
  const clone = v => JSON.parse(JSON.stringify(v));

  /* ---------- notifikasi ---------- */
  const plugin = name => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name];
  const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  let permissionAsked = false;
  let timer = null;

  /* Android 12/12L: izin "Alarm & pengingat" bisa dicabut; tanpa itu alarm jatuh ke mode tidak presisi dan terlambat. */
  function exactState(denied) {
    if (window.__exactDenied === denied) return;
    window.__exactDenied = denied;
    window.dispatchEvent(new Event('todo-notif-state'));
  }
  window.todoOpenExactSettings = async () => {
    const LN = plugin('LocalNotifications');
    try { if (LN && typeof LN.changeExactNotificationSetting === 'function') await LN.changeExactNotificationSetting(); } catch (e) { /* abaikan */ }
  };
  /* Beri tahu tampilan bila izin notifikasi ditolak (pengingat tidak akan berbunyi). */
  function notifState(denied) {
    if (window.__notifDenied === denied) return;
    window.__notifDenied = denied;
    window.dispatchEvent(new Event('todo-notif-state'));
  }
  async function ensurePermission(LN) {
    const cur = await LN.checkPermissions();
    if (cur.display === 'granted') return true;
    if (permissionAsked) return false;
    permissionAsked = true;
    return (await LN.requestPermissions()).display === 'granted';
  }

  /* Aksi di notifikasi (tombol "Selesai" / "Tunda 1 jam"). Di Android, menekan tombol membuka aplikasi lalu event
   * `localNotificationActionPerformed` sampai ke sini (Capacitor menahan event itu sampai ada pendengar). */
  const ACTION_TYPE = 'TASK', EVENING_TYPE = 'EVENING';
  const localIso = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  let backReady = false;

  /* Pengaturan pengingat: lead bawaan (menit; -1 = mati), ringkasan malam, dan pengganti per tugas (kunci = uid tugas).
   * `at` diisi saat pengguna mengubahnya; ikut berkas sinkron, yang lebih baru menang. */
  const REMIND_KEY = 'todo-remind';
  const LEADS = [-1, 0, 5, 15, 30, 60, 1440];
  function remindPrefs() {
    const r = lsGet(REMIND_KEY) || {};
    const ev = r.evening || {};
    const per = {};
    if (r.per && typeof r.per === 'object') {
      for (const k of Object.keys(r.per)) {
        if (!LEADS.includes(r.per[k])) continue;
        if (/^\d+$/.test(k)) { const t = store.tasks.find(x => String(x.id) === k); if (t) per[t.uid] = r.per[k]; } // kunci lama (id) -> uid
        else per[k] = r.per[k];
      }
    }
    return {
      lead: LEADS.includes(r.lead) ? r.lead : 30,
      evening: { on: ev.on !== false, hour: Number.isInteger(ev.hour) && ev.hour >= 0 && ev.hour <= 23 ? ev.hour : 20 },
      per, at: typeof r.at === 'string' ? r.at : null,
    };
  }
  const saveRemind = p => { p.at = store.clock.now(); lsSet(REMIND_KEY, p); scheduleSoon(); autoSyncSoon(); };
  const uidOfId = id => { const t = store.tasks.find(x => x.id === id); return t ? t.uid : null; };
  window.todoRemind = {
    LEADS,
    get: remindPrefs,
    set(patch) {
      const p = remindPrefs();
      if (patch.lead !== undefined && LEADS.includes(patch.lead)) p.lead = patch.lead;
      if (patch.evening) Object.assign(p.evening, patch.evening);
      saveRemind(p);
    },
    leadOf(id) { const u = uidOfId(id); const v = u ? remindPrefs().per[u] : undefined; return LEADS.includes(v) ? v : null; }, // null = ikut bawaan
    setLead(id, v) {
      const u = uidOfId(id);
      if (!u) return;
      const p = remindPrefs();
      if (v === null || v === undefined) delete p.per[u]; else if (LEADS.includes(v)) p.per[u] = v;
      saveRemind(p);
    },
  };
  /* Hubungkan ke sinkronisasi: kirim pengaturan (bila pernah diubah), terima yang lebih baru dari perangkat lain. */
  store.settingsHook = {
    get() {
      const p = remindPrefs();
      if (!p.at) return null;
      const live = new Set(store.tasks.map(t => t.uid));
      const per = {};
      for (const k of Object.keys(p.per)) if (live.has(k)) per[k] = p.per[k];
      return { at: p.at, remind: { lead: p.lead, evening: p.evening, per } };
    },
    apply(remote) {
      const cur = remindPrefs();
      if (cur.at && remote.at <= cur.at) return;
      lsSet(REMIND_KEY, { lead: remote.remind.lead, evening: remote.remind.evening, per: remote.remind.per, at: remote.at });
      scheduleSoon();
      window.dispatchEvent(new Event('todo-remind-changed'));
    },
  };
  /* Tugas utama yang belum selesai dan jatuh tempo hari ini/terlambat -> besok. Mengembalikan keadaan awal (untuk Urungkan). */
  window.todoMoveRemaining = async function () {
    const today = localIso(new Date());
    const nd = new Date(); nd.setDate(nd.getDate() + 1);
    const tomorrow = localIso(nd);
    const list = store.tasks.filter(t => !t.done && t.parent_id == null && t.deadline && t.deadline <= today)
      .map(t => ({ id: t.id, deadline: t.deadline, due_time: t.due_time }));
    for (const o of list) await window.todoLocalApi('PATCH', '/api/tasks/' + o.id, { deadline: tomorrow });
    return list;
  };
  function setupBackButton() {
    const App = plugin('App');
    if (backReady || !isNative() || !App || !App.addListener) return;
    backReady = true;
    App.addListener('backButton', () => {
      if (typeof window.todoHandleBack === 'function' && window.todoHandleBack()) return;
      if (App.exitApp) App.exitApp(); else window.history.back();
    });
  }
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
        ] }, { id: EVENING_TYPE, actions: [
          { id: 'tomorrow', title: window.T ? window.T('Pindah ke besok') : 'Pindah ke besok' },
        ] }] });
      }
      if (typeof LN.addListener === 'function') await LN.addListener('localNotificationActionPerformed', onNotificationAction);
    } catch (e) {
      actionsReady = false;
      console.error('Aksi notifikasi gagal disiapkan: ' + (e && e.message));
    }
  }
  const lockOn = () => !!(window.TodoLock && window.TodoLock.enabled());
  async function onNotificationAction(ev) {
    // Aplikasi terkunci PIN: aksi (Selesai/Tunda) ditahan sampai PIN dimasukkan, bukan langsung mengubah data.
    if (window.TodoLock && window.TodoLock.locked()) { window.TodoLock.afterUnlock(() => onNotificationAction(ev)); return; }
    try {
      if (ev && ev.actionId === 'tomorrow') {
        await window.todoMoveRemaining();
        const LN0 = plugin('LocalNotifications');
        if (LN0 && LN0.removeDeliveredNotifications && ev.notification && ev.notification.id != null) {
          try { await LN0.removeDeliveredNotifications({ notifications: [{ id: ev.notification.id }] }); } catch (e) { /* tidak penting */ }
        }
        if (typeof window.refresh === 'function') window.refresh();
        return;
      }
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
    const tr = window.T || (x => x);
    const n = { id: p.id, title: p.tkey ? tr(p.tkey, p.tvars) : p.title, body: p.bkey ? tr(p.bkey, p.bvars) : p.body, schedule: { at: p.at, allowWhileIdle: true } };
    if (p.evening) n.actionTypeId = EVENING_TYPE;
    else if (p.id < 1000000000) {
      const t = store.tasks.find(x => x.id === Math.floor(p.id / 2));
      if (t) { n.actionTypeId = ACTION_TYPE; n.extra = { uid: t.uid }; }
    }
    return n;
  }

  /* Bersihkan notifikasi yang sudah terkirim tapi kini basi: pengingat untuk tugas yang selesai/dihapus, dan ringkasan malam
   * atau pagi (hari ini) saat tidak ada lagi yang tersisa. Tidak penting: gagal diabaikan. */
  async function cleanDelivered(LN) {
    if (typeof LN.getDeliveredNotifications !== 'function' || typeof LN.removeDeliveredNotifications !== 'function') return;
    const res = await LN.getDeliveredNotifications();
    const list = (res && res.notifications) || [];
    if (!list.length) return;
    const today = localIso(new Date());
    const open = store.tasks.filter(t => !t.done && t.parent_id == null && t.deadline);
    const gone = list.filter(n => {
      if (n.id < 1000000000) { const t = store.tasks.find(x => x.id === Math.floor(n.id / 2)); return !t || t.done; }
      if (n.id >= 1000000100 && n.id < 1000000200) return !open.some(t => t.deadline <= today);
      if (n.id === 1000000000) return !open.some(t => t.deadline === today);
      return false;
    });
    if (gone.length) await LN.removeDeliveredNotifications({ notifications: gone.map(n => ({ id: n.id })) });
  }

  async function reschedule() {
    const LN = plugin('LocalNotifications');
    if (!isNative() || !LN) return;
    try {
      const allowed = await ensurePermission(LN);
      notifState(!allowed);
      if (!allowed) return;
      try {
        if (typeof LN.checkExactNotificationSetting === 'function') { const ex = await LN.checkExactNotificationSetting(); exactState(!!ex && ex.exact_alarm === 'denied'); }
      } catch (e) { /* plugin lama / bukan Android 12+: abaikan */ }
      const pending = await LN.getPending();
      if (pending.notifications && pending.notifications.length) {
        await LN.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
      }
      try { await cleanDelivered(LN); } catch (e) { /* tidak penting */ }
      const rp = remindPrefs();
      const plan = core.planReminders(store.upcoming(), new Date(), {
        lead: rp.lead < 0 ? 30 : rp.lead,
        days: 45, limit: 150, // jangkauan lebih panjang: pengingat tetap ada walau aplikasi lama tidak dibuka (batas sistem Android 500 alarm)
        leadFor: t => { const u = uidOfId(t.id), v = u ? rp.per[u] : undefined; return LEADS.includes(v) ? v : (rp.lead < 0 ? -1 : undefined); },
        evening: rp.evening,
      });
      if (!plan.length) return;
      await setupNotificationActions();
      // PIN aktif: layar kunci tidak boleh membocorkan judul tugas, jadi isi notifikasi dibuat umum.
      const privacy = n => lockOn() ? Object.assign({}, n, { title: 'Tuntas Harian', body: window.T ? window.T('Ada tugas yang perlu dilihat.') : 'Ada tugas yang perlu dilihat.' }) : n;
      await LN.schedule({ notifications: plan.map(withActions).map(privacy) });
    } catch (e) {
      console.error('Gagal menjadwalkan notifikasi: ' + (e && e.message));
    }
  }
  function scheduleSoon() { clearTimeout(timer); timer = setTimeout(afterChange, 400); }
  let afterRunning = false, afterAgain = false;
  async function afterChange() {
    if (!vReady()) return; // data terenkripsi belum dibuka: jangan jadwalkan/dorong dari data kosong
    if (afterRunning) { afterAgain = true; return; } // jadwal ulang tidak boleh tumpang tindih (saling membatalkan)
    afterRunning = true;
    try {
      do {
        afterAgain = false;
        for (const job of [reschedule, pushWidget, maybeSnapshot]) {
          try { await job(); } catch (e) { console.error('Tugas latar gagal: ' + (e && e.message)); }
        }
      } while (afterAgain);
    } finally { afterRunning = false; }
  }
  /* Zona waktu berubah saat aplikasi terbuka/kembali dibuka: waktu pengingat dihitung dari jam dinding, jadi jadwal dihitung ulang. */
  let lastOffset = new Date().getTimezoneOffset();
  const checkZone = () => { const o = new Date().getTimezoneOffset(); if (o !== lastOffset) { lastOffset = o; scheduleSoon(); } };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkZone(); });
  setInterval(checkZone, 60000);
  window.addEventListener('todo-lock-changed', () => { lastWidget = null; scheduleSoon(); });

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
    const items = JSON.stringify(lockOn() ? [] : store.widgetItems()); // PIN aktif: widget tidak menampilkan judul
    if (items === lastWidget) return;
    await W.update({ items });
    lastWidget = items;
  }

  /* Tugas yang dicentang di widget (uid) diterapkan di sini; tombol "+" widget memfokuskan kolom tambah tugas. */
  async function applyWidgetActions() {
    if (!isNative()) return;
    const W = widgetBridge();
    if (!W) return;
    if (window.TodoLock && window.TodoLock.locked()) { window.TodoLock.afterUnlock(applyWidgetActions); return; } // tunggu PIN
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
      if (typeof W.shared === 'function') {
        const res = await W.shared();
        const text = res && typeof res.text === 'string' ? res.text.trim() : '';
        if (text && typeof window.openBulk === 'function') window.openBulk(text);
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
  const loadSnaps = () => { let v = null; try { v = JSON.parse(V.get(SNAP_KEY)); } catch (e) { /* kosong */ } return Array.isArray(v) ? v : []; };
  const saveSnaps = list => V.set(SNAP_KEY, JSON.stringify(list));
  const asSyncFile = state => ({ app: 'todo-cli', kind: 'sync', format: 1, device: 'snapshot', exported_at: '', tasks: state.tasks, deleted: state.deleted });
  const status = Object.assign({ doc: null, auto: null }, lsGet(STATUS_KEY));
  const saveStatus = () => lsSet(STATUS_KEY, status);

  async function maybeSnapshot() {
    const f = store.syncFile('snapshot');
    const r = core.rotateSnapshots(loadSnaps(), { tasks: f.tasks, deleted: f.deleted }, store.clock.now(), 7);
    if (!r.created) return;
    let list = r.list;
    while (!saveSnaps(list) && list.length > 1) list = list.slice(1); // kuota penuh: buang salinan terlama, jangan gagal diam-diam
    await writeDocuments(true);
  }

  let lastDoc = null, docAt = 0;
  async function writeDocuments(force) {
    const FS = plugin('Filesystem');
    if (!isNative() || !FS || !vReady()) return;
    if (V.enabled()) { // enkripsi aktif: yang ditulis ke Dokumen hanya blob terenkripsi yang sama (dibuka dengan PIN atau kunci pemulihan)
      if (!store.tasks.length) return;
      const blob = await V.rawBlob();
      if (!blob || (!force && (blob === lastDoc || (docAt && Date.now() - docAt < 600000)))) return;
      try {
        await FS.writeFile({ path: 'Todo/todo-cadangan.terenkripsi.txt', data: blob, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
        lastDoc = blob; docAt = Date.now();
        status.doc = { ok: true, at: hhmm(new Date()), enc: true };
      } catch (e) { status.doc = { ok: false, at: hhmm(new Date()), msg: String((e && e.message) || e) }; }
      saveStatus();
      return;
    }
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
  /* Token dan kata sandi sinkron disimpan di penyimpanan native Android (SharedPreferences todo_secrets) yang DIKECUALIKAN dari cadangan
   * Google/adb, sehingga tidak ikut keluar dari HP. Tanpa plugin (peramban, build lama) tetap di localStorage seperti sebelumnya. */
  let secretCache = null, secretPluginRef;
  const secretPlugin = () => {
    if (secretPluginRef !== undefined) return secretPluginRef;
    let p = plugin('TodoSecure');
    if (!p && window.Capacitor && typeof window.Capacitor.registerPlugin === 'function' && isNative()) { try { p = window.Capacitor.registerPlugin('TodoSecure'); } catch (e) { p = null; } }
    return (secretPluginRef = p && typeof p.secretGet === 'function' ? p : null);
  };
  const loadCfg = () => {
    const c = lsGet(AUTO_KEY);
    if (!c) return null;
    if (c.secure && secretCache && secretCache.token) return Object.assign({}, c, { token: secretCache.token, passphrase: secretCache.passphrase });
    return c.token ? c : null; // belum dimuat dari native, atau cfg lama/tanpa plugin
  };
  async function storeCfg(cfg) {
    const sp = secretPlugin();
    const pub = Object.assign({}, cfg);
    if (sp && cfg.token) {
      try {
        await sp.secretSet({ key: 'token', value: cfg.token });
        await sp.secretSet({ key: 'passphrase', value: cfg.passphrase || '' });
        const back = await sp.secretGet({ key: 'token' });
        if (back && back.value === cfg.token) { secretCache = { token: cfg.token, passphrase: cfg.passphrase || '' }; delete pub.token; delete pub.passphrase; pub.secure = true; }
      } catch (e) { /* gagal: tetap di localStorage agar sinkron tidak putus */ }
    }
    return lsSet(AUTO_KEY, pub);
  }
  async function clearCfg() {
    const sp = secretPlugin();
    secretCache = null;
    try { localStorage.removeItem(AUTO_KEY); } catch (e) { /* abaikan */ }
    if (sp) { try { await sp.secretRemove({ key: 'token' }); await sp.secretRemove({ key: 'passphrase' }); } catch (e) { /* abaikan */ } }
  }
  /* Saat start: muat rahasia dari native; bila token lama masih di localStorage, pindahkan (migrasi sekali). */
  async function initSecrets() {
    const sp = secretPlugin();
    const c = lsGet(AUTO_KEY);
    if (!sp || !c) return;
    try {
      if (c.secure) {
        const t = await sp.secretGet({ key: 'token' }), p = await sp.secretGet({ key: 'passphrase' });
        if (t && t.value) secretCache = { token: t.value, passphrase: (p && p.value) || '' };
      } else if (c.token) await storeCfg(c);
    } catch (e) { /* tetap berjalan dengan yang ada */ }
  }
  let syncing = false, again = false, autoTimer = null, onAutoStatus = () => {};
  function autoSyncSoon(ms) { if (!loadCfg()) return; clearTimeout(autoTimer); autoTimer = setTimeout(autoSyncNow, ms == null ? 4000 : ms); }
  async function autoSyncNow() {
    const cfg = loadCfg();
    if (!cfg || !window.TodoAutoSync || !vReady()) return;
    if (syncing) { again = true; return; }
    syncing = true;
    try {
      const r = await window.TodoAutoSync.run(store, cfg, window.fetch.bind(window));
      if (r.gistId !== cfg.gistId) await storeCfg(Object.assign({}, cfg, { gistId: r.gistId }));
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
    const mutating = method !== 'GET';
    const before = mutating ? store.snapshotState() : null;
    let result;
    try { result = core.handle(store, method, path, body === undefined ? {} : clone(body)); }
    catch (e) { if (mutating) store.restoreState(before); throw e; } // gagal menyimpan: layar kembali ke data yang benar-benar tersimpan
    if (result.status >= 400 && mutating) store.restoreState(before); // perubahan setengah jalan tidak boleh tersisa
    if (result.status >= 400) throw new Error((result.body && result.body.error) || ('Kesalahan ' + result.status));
    if (method !== 'GET') { scheduleSoon(); autoSyncSoon(); }
    return clone(result.body);
  };
  window.todoLocalStore = store; // untuk tes

  /* Enkripsi PIN: setelah blob terbuka, isi ulang store dari data yang baru terbaca lalu segarkan tampilan dan jadwal. */
  V.onUnlock(async () => {
    store.init(persist.load());
    scheduleSoon(); autoSyncSoon(800);
    if (typeof window.refresh === 'function') { try { await window.refresh(); } catch (e) { /* tampilan menyusul */ } }
  });
  // Enkripsi baru dinyalakan: hapus salinan teks biasa di folder Dokumen (bila ada) dan jangan tulis lagi.
  V.onEnable(async () => {
    const FS = plugin('Filesystem');
    lastDoc = null; status.doc = null; saveStatus();
    if (isNative() && FS && typeof FS.deleteFile === 'function') { try { await FS.deleteFile({ path: 'Todo/todo-cadangan.json', directory: 'DOCUMENTS' }); } catch (e) { /* tidak ada */ } }
  });

  /* Status data rusak untuk spanduk: {raw: ada salinan rusak?, snapshot: ada snapshot untuk dipulihkan?}. */
  window.todoDataIssue = function () {
    let raw = null;
    raw = V.get(CORRUPT_KEY);
    if (raw === null) return null;
    return { snapshot: loadSnaps().length > 0, empty: store.tasks.length === 0 };
  };
  window.todoRecoverLatest = function () {
    const snaps = loadSnaps();
    const last = snaps[snaps.length - 1];
    if (!last) return false;
    store.restoreSnapshot(asSyncFile(last.state));
    V.del(CORRUPT_KEY);
    scheduleSoon(); autoSyncSoon();
    return true;
  };
  window.todoShareCorrupt = function () {
    let raw = '';
    raw = V.get(CORRUPT_KEY) || '';
    return window.todoShareText('Data tugas rusak', raw);
  };
  window.todoDropCorrupt = function () { V.del(CORRUPT_KEY); };

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
        const text = await file.text();
        let data;
        if (window.TodoVault && window.TodoVault.looksEncrypted(text)) { // cadangan terenkripsi dari Dokumen/Todo
          const secret = window.prompt(T('Berkas ini terenkripsi. Masukkan PIN atau kunci pemulihan saat berkas dibuat:'));
          if (!secret) { saySync('Dibatalkan.', true); return; }
          const map = await window.TodoVault.decryptExternal(text, secret.trim());
          if (!map) { saySync('PIN atau kunci pemulihan salah, atau berkas rusak.', true); return; }
          const inner = JSON.parse(map['todo-cli.data.v1'] || 'null');
          if (!inner || !Array.isArray(inner.tasks)) { saySync('Berkas tidak berisi data tugas.', true); return; }
          data = new core.Store({ load: () => inner, save() {} }).syncFile('cadangan'); // bentuk sama dengan berkas sinkron biasa
        } else data = JSON.parse(text);
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
      docStatus.textContent = d && d.ok && d.enc ? T('Cadangan terenkripsi di Dokumen/Todo/todo-cadangan.terenkripsi.txt diperbarui pukul {at}. Pulihkan lewat "Gabungkan dari berkas…" dengan PIN atau kunci pemulihan.', { at: d.at }) : !d ? (isNative() ? T('Salinan berkas di folder Dokumen/Todo: belum ditulis.') : '')
        : d.ok ? T('Salinan berkas di Dokumen/Todo/todo-cadangan.json diperbarui pukul {at}. Pulihkan lewat "Gabungkan dari berkas…".', { at: d.at })
          : T('Salinan ke folder Dokumen gagal ({msg}). Salinan di dalam aplikasi tetap dibuat.', { msg: d.msg });
    }
    function restoreSnap(snap, label) {
      if (!window.confirm(T('Daftar tugas akan DIGANTI persis seperti pada {label}. Tugas yang dibuat/diubah sesudahnya hilang (kondisi sekarang disimpan dulu sebagai salinan). Lanjutkan?', { label }))) return;
      try {
        const now = store.clock.now(), cur = store.syncFile('snapshot');
        saveSnaps(loadSnaps().concat([{ day: now.slice(0, 10), at: now, pre: true, state: { tasks: cur.tasks, deleted: cur.deleted } }]).slice(-8));
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
      await storeCfg({ token: value, passphrase: secret, deviceId: randomHex(4) });
      token.value = ''; pass.value = '';
      status.auto = null; sayAuto('Menyambungkan…'); renderAuto();
      await autoSyncNow();
    } }, 'Aktifkan sinkron otomatis');
    const autoNow = el('button', { class: 'btn primary', type: 'button', id: 'auto-now', onclick: () => { sayAuto('Menyinkronkan…'); autoSyncNow(); } }, 'Sinkron sekarang');
    const autoOff = el('button', { class: 'btn', type: 'button', id: 'auto-off', onclick: () => {
      if (!window.confirm('Matikan sinkron otomatis di HP ini? Token dan kata sandi dihapus dari HP; gist di GitHub tidak dihapus.')) return;
      clearCfg();
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
        el('p', { class: 'sub', id: 'auto-secret-note' }, 'Token dan kata sandi disimpan di penyimpanan privat aplikasi di HP ini tanpa enkripsi tambahan, dan tidak ikut cadangan Google. Jika HP hilang atau berpindah tangan, cabut token di GitHub (Settings > Developer settings > Tokens).'),
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
    setupNotificationActions();
    setupBackButton();
    applyWidgetActions().then(scheduleSoon);
    initSecrets().then(() => autoSyncSoon(800));
    setInterval(() => { if (!document.hidden) autoSyncSoon(0); }, 300000);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { writeDocuments(false); return; }
    applyWidgetActions().then(scheduleSoon);
    autoSyncSoon(300);
  });
})();
