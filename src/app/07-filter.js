/* ================= filter + urutan ================= */
const FILT = { built: false };
function renderFilters() {
  const box = $('#filters');
  const on = ['today', 'upcoming', 'calendar', 'all'].indexOf(ui.view) !== -1 && state.loaded && state.tasks.length > 0;
  box.hidden = !on;
  if (!on) return;
  if (!FILT.built) {
    FILT.chips = FILTERS.map(f => h('button', { class: 'qchip', type: 'button', 'data-filter': f[0], onclick: () => { ui.filter = f[0]; ui.fade = true; render(); } }, f[1]));
    FILT.sel = h('select', { id: 'sort-sel', 'aria-label': 'Urutkan',
      onchange: e => { ui.sort = e.target.value; try { localStorage.setItem('todo-sort', ui.sort); } catch (err) {} ui.fade = true; render(); } },
      SORTS.map(o => h('option', { value: o[0] }, T('Urut: {name}', { name: T(o[1]) }))));
    box.replaceChildren(h('div', { class: 'tabs' }, ...FILT.chips), FILT.sel);
    FILT.built = true;
  }
  FILT.chips.forEach(c => { const a = c.dataset.filter === ui.filter; c.classList.toggle('on', a); c.setAttribute('aria-pressed', String(a)); });
  FILT.sel.value = ui.sort;
}
