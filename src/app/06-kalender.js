/* ================= kalender mingguan ================= */
const WEEKDAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
function weekStart() {
  const n = dayNum(state.today);
  const dow = (new Date(n * 86400000).getUTCDay() + 6) % 7; // Senin = 0
  return n - dow + 7 * ui.weekOff;
}
function renderWeek() {
  const box = $('#week');
  const on = ui.view === 'calendar' && !ui.project && !ui.tag && state.loaded;
  box.hidden = !on;
  if (!on) return;
  const start = weekStart();
  const active = state.tasks.filter(t => t.parent_id === null && !t.done && t.deadline);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const iso = isoFromDayNum(start + i);
    const items = active.filter(t => t.deadline === iso).sort((a, b) => a.priority - b.priority);
    const dots = items.slice(0, 3).map(t => h('i', { class: 'p' + t.priority }));
    days.push(h('button', {
      class: 'wday' + (iso === state.today ? ' today' : '') + (iso === curDay() ? ' sel' : ''), type: 'button', 'data-day': iso,
      'aria-pressed': String(iso === curDay()), 'aria-label': fmtDate(iso) + ', ' + T('{n} tugas', { n: items.length }),
      onclick: () => { ui.day = iso; ui.fade = true; render(); },
    }, h('span', { class: 'dn' }, T(WEEKDAY_SHORT[new Date((start + i) * 86400000).getUTCDay()])),
      h('span', { class: 'dd' }, String(Number(iso.slice(8)))),
      h('span', { class: 'dots' }, dots),
      h('span', { class: 'more' }, items.length > 3 ? '+' + (items.length - 3) : '')));
  }
  const first = isoFromDayNum(start), last = isoFromDayNum(start + 6);
  box.replaceChildren(
    h('div', { class: 'week-head' },
      h('h3', { id: 'week-title' }, fmtDate(first) + ' – ' + fmtDate(last)),
      h('button', { class: 'btn small', id: 'week-today', type: 'button', onclick: () => { ui.weekOff = 0; ui.day = state.today; ui.fade = true; render(); } }, 'Hari ini'),
      h('button', { class: 'icon-btn', id: 'week-prev', type: 'button', 'aria-label': 'Pekan sebelumnya', onclick: () => { ui.weekOff -= 1; render(); } }, icon('left', 18)),
      h('button', { class: 'icon-btn', id: 'week-next', type: 'button', 'aria-label': 'Pekan berikutnya', onclick: () => { ui.weekOff += 1; render(); } }, icon('chevron', 18))),
    h('div', { class: 'week-days' }, days));
}
