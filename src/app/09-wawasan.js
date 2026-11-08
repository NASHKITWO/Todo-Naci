/* ================= wawasan ================= */
function hbar(label, frac, text, cls) {
  return h('div', { class: 'hrow' }, h('span', { class: 'lbl', title: label }, label),
    h('span', { class: 'track' }, h('i', { class: 'fill ' + (cls || ''), style: { width: Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%' } })),
    h('span', { class: 'val' }, text));
}
function insightsData() {
  const top = state.tasks.filter(t => t.parent_id === null);
  const finished = top.filter(t => t.done && t.deadline && t.completed_at);
  const onTime = finished.filter(t => t.completed_at.slice(0, 10) <= t.deadline).length;
  const active = top.filter(t => !t.done);
  const prio = [1, 2, 3].map(p => active.filter(t => t.priority === p).length);
  const projects = {};
  for (const t of top) { if (!t.project) continue; const k = t.project; (projects[k] = projects[k] || { done: 0, total: 0 }); projects[k].total++; if (t.done) projects[k].done++; }
  return { finished: finished.length, onTime, pct: finished.length ? Math.round(onTime / finished.length * 100) : null, prio, projects };
}
/* Kalender 5 minggu terakhir (Senin dulu). Sel: tuntas = penuh, ada yang selesai tapi tersisa = separuh, kosong = polos. */
function tuntasCalendar() {
  const st = tuntasNow();
  const [y, m, d] = state.today.split('-').map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // 0 = Senin
  const cells = [];
  for (let i = 0; i < 35; i++) {
    const day = addDaysIso(i - (dow + 28));
    const [, mm, dd] = day.split('-').map(Number);
    const future = day > state.today;
    const n = st.done[day] || 0;
    const kind = future ? 'future' : st.tuntas(day) ? 'full' : n ? 'part' : 'none';
    const label = dd + ' ' + T(MONTHS[mm - 1]) + ': ' + (future ? '' : kind === 'full' ? T('tuntas') : n ? T('ada yang tersisa') : T('kosong'))
      + (n ? ' (' + T('{n} selesai', { n }) + ')' : '');
    cells.push(h('div', { class: 'tc ' + kind + (day === state.today ? ' today' : ''), role: 'listitem', title: label, 'aria-label': label, 'data-day': day }, String(dd)));
  }
  return h('div', {}, h('div', { class: 'tcal-head', 'aria-hidden': 'true' }, [1, 2, 3, 4, 5, 6, 0].map(i => h('span', {}, T(WEEKDAY_SHORT[i])))),
    h('div', { class: 'tcal', id: 'tcal', role: 'list', 'aria-label': T('Riwayat hari tuntas') }, cells));
}
function renderInsights(root) {
  const s = state.stats || {};
  const week = s.completed_week || [];
  const d = insightsData();
  const weekTotal = week.reduce((a, w) => a + w[1], 0);
  const max = Math.max.apply(null, week.map(w => w[1]).concat([1]));
  const kpi = (v, l, id) => h('div', { class: 'kpi', id }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l));
  const prioNames = ['Tinggi', 'Sedang', 'Rendah'].map(x => T(x));
  const pmax = Math.max.apply(null, d.prio.concat([1]));
  const projs = Object.keys(d.projects).sort((a, b) => d.projects[b].total - d.projects[a].total);
  root.append(h('div', { class: 'insights', id: 'insights' },
    h('div', { class: 'kpis' },
      kpi(String(weekTotal), 'Selesai 7 hari', 'kpi-week'),
      kpi(d.pct === null ? '–' : d.pct + '%', 'Tepat waktu', 'kpi-ontime'),
      kpi(String(streakDays()), 'Hari beruntun', 'kpi-streak'),
      kpi(String(s.overdue || 0), 'Terlambat', 'kpi-overdue')),
    h('div', { class: 'panel' }, h('h3', {}, 'Tugas selesai per hari'),
      weekTotal === 0 ? h('p', { class: 'insight-note', id: 'vbars-empty' }, 'Belum ada tugas selesai dalam 7 hari terakhir. Centang satu tugas untuk memulai grafik ini.') :
      h('div', { class: 'vbars', id: 'vbars' }, week.map(w => h('div', { class: 'vcol' },
        h('span', { class: 'n' }, String(w[1])),
        h('span', { class: 'bar' + (w[1] ? '' : ' zero'), style: { height: Math.max(4, Math.round(w[1] / max * 90)) + 'px' } }),
        h('span', { class: 'd' }, WEEKDAY_SHORT[new Date(dayNum(w[0]) * 86400000).getUTCDay()]))))),
    h('div', { class: 'panel' }, h('h3', {}, 'Riwayat hari tuntas'), tuntasCalendar(),
      h('p', { class: 'insight-note' }, T('Rekor beruntun: {n} hari. Hari tuntas = ada tugas selesai dan tidak ada yang tertinggal di hari itu.', { n: tuntasNow().best }))),
    h('div', { class: 'panel' }, h('h3', {}, 'Tugas aktif menurut prioritas'),
      d.prio.map((n, i) => hbar(prioNames[i], n / pmax, String(n), 'p' + (i + 1)))),
    h('div', { class: 'panel' }, h('h3', {}, 'Progres per proyek'),
      projs.length ? projs.map(k => hbar('@' + k, d.projects[k].done / d.projects[k].total, d.projects[k].done + '/' + d.projects[k].total))
        : h('p', { class: 'insight-note' }, 'Belum ada proyek. Pilih atau isi proyek lewat tombol “Lainnya…” saat menambah tugas.')),
    h('p', { class: 'insight-note' }, d.pct === null ? T('Persentase tepat waktu muncul setelah ada tugas ber-deadline yang selesai.')
      : T('{done} dari {total} tugas ber-deadline selesai pada atau sebelum tanggalnya.', { done: d.onTime, total: d.finished }))));
}
