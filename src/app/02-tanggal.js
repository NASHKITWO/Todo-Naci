/* ================= tanggal ================= */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BUCKETS = [['overdue', 'Terlambat'], ['today', 'Hari ini'], ['tomorrow', 'Besok'],
                 ['week', 'Minggu ini'], ['later', 'Nanti'], ['none', 'Tanpa deadline']];

function dayNum(iso) {
  const p = iso.split('-').map(Number);
  return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000);
}
function isoFromDayNum(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }
function diffDays(iso) { return dayNum(iso) - dayNum(state.today); }
function addDaysIso(n) { return isoFromDayNum(dayNum(state.today) + n); }
function fmtDate(iso) {
  const p = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  let s = T(DAYS[dt.getUTCDay()]) + ', ' + p[2] + ' ' + T(MONTHS[p[1] - 1]);
  if (String(p[0]) !== state.today.slice(0, 4)) s += ' ' + p[0];
  return s;
}
function relLabel(iso) {
  const d = diffDays(iso);
  if (d === 0) return 'Hari ini';
  if (d === 1) return 'Besok';
  if (d === -1) return 'Kemarin';
  if (d < 0) return T('Terlambat {n} hari', { n: -d });
  return fmtDate(iso);
}
function bucketOf(t) {
  if (!t.deadline) return 'none';
  const d = diffDays(t.deadline);
  if (d < 0) return 'overdue';
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d <= 6) return 'week';
  return 'later';
}
function pad2(n) { return String(n).padStart(2, '0'); }
function localIso(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function hhmm(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
function ruleLabel(rule, short) {
  if (rule === 'wd') return T(short ? 'Hari kerja' : 'Setiap hari kerja');
  if (/^dow:/.test(rule || '')) {
    const names = rule.slice(4).split(',').map(n => T(DAYS[Number(n)])).join(', ');
    return short ? names : T('Setiap') + ' ' + names;
  }
  const m = /^(\d+)([dwmy])$/.exec(rule || '');
  if (!m) return rule || '';
  const unit = { d: 'hari', w: 'minggu', m: 'bulan', y: 'tahun' }[m[2]];
  if (short) return m[1] === '1' ? T('Tiap ' + unit) : T('Tiap {n} ' + unit, { n: m[1] });
  return m[1] === '1' ? T('Setiap ' + unit) : T('Setiap {n} ' + unit, { n: m[1] });
}
