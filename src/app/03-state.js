/* ================= state ================= */
const state = { tasks: [], projects: [], tags: [], stats: null, today: '1970-01-01', trash: [] };
const ui = { view: 'today', project: null, tag: null, q: '', openId: null, newIds: new Set(), fade: false,
  expanded: new Set(), filter: 'all', sort: 'auto', day: null, weekOff: 0, select: false, picked: new Set() };
try { const sv = localStorage.getItem('todo-sort'); if (sv) ui.sort = sv; } catch (e) {}
const SORTS = [['auto', 'Otomatis'], ['prio', 'Prioritas'], ['time', 'Waktu'], ['new', 'Terbaru'], ['az', 'A–Z']];
const FILTERS = [['all', 'Semua'], ['high', 'Prioritas tinggi'], ['timed', 'Ber-jam'], ['repeat', 'Berulang']];
const curDay = () => ui.day || state.today;
let suppressClick = false;
const SWIPE_AT = 80;

/* Peta turunan & indeks id dihitung sekali per daftar tugas (state.tasks diganti utuh oleh refresh),
 * bukan sekali per baris: dulu tiap baris memindai semua tugas sehingga biayanya kuadratik. */
let idx = { src: null, n: -1, kids: null, byId: null };
function index() {
  if (idx.src !== state.tasks || idx.n !== state.tasks.length) {
    const kids = {}, byId = new Map();
    for (const t of state.tasks) {
      byId.set(t.id, t);
      if (t.parent_id !== null) (kids[t.parent_id] = kids[t.parent_id] || []).push(t);
    }
    idx = { src: state.tasks, n: state.tasks.length, kids, byId };
  }
  return idx;
}
function kidsMap() { return index().kids; }
function taskById(id) { return index().byId.get(id) || null; }
function cmpTask(a, b) {
  if (a.priority !== b.priority) return a.priority - b.priority;
  const da = a.deadline || '9999', db = b.deadline || '9999';
  if (da !== db) return da < db ? -1 : 1;
  return a.id - b.id;
}

function sorter() {
  const byId = (a, b) => a.id - b.id;
  if (ui.sort === 'prio') return (a, b) => a.priority - b.priority || byId(a, b);
  if (ui.sort === 'time') return (a, b) => ((a.deadline || '9999') + (a.due_time || '99:99')).localeCompare((b.deadline || '9999') + (b.due_time || '99:99')) || byId(a, b);
  if (ui.sort === 'new') return (a, b) => b.id - a.id;
  if (ui.sort === 'az') return (a, b) => a.title.localeCompare(b.title, TodoI18n.state.lang) || byId(a, b);
  return cmpTask;
}

async function refresh() {
  try {
    const data = await api('GET', '/api/state');
    try { data.trash = (await api('GET', '/api/trash')).entries; } catch (e) { data.trash = state.trash; }
    const before = new Set(state.tasks.map(t => t.id));
    ui.newIds = state.loaded ? new Set(data.tasks.filter(t => !before.has(t.id)).map(t => t.id)) : new Set();
    Object.assign(state, data);
    state.loaded = true;
    $('#banner').hidden = true;
  } catch (e) {
    $('#banner').textContent = T(e.message) + ' ' + T('Mencoba lagi otomatis…');
    $('#banner').hidden = false;
    return;
  }
  if (ui.openId !== null && !taskById(ui.openId)) closeDrawer();
  for (const id of Array.from(ui.picked)) if (!taskById(id)) ui.picked.delete(id);
  render();
}
