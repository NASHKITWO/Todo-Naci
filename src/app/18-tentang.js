/* ================= tentang aplikasi ================= */
/* Kredit, lisensi, dan donasi ada di dialog ini (tombol di menu samping), bukan di bawah daftar tugas. */
const ABT = {};
function buildAbout() {
  ABT.el = h('div', { class: 'login', id: 'about-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'abt-title', hidden: '' },
    h('div', { class: 'login-card about-card', id: 'about-foot' },
      h('h2', { id: 'abt-title', tabindex: '-1' }, 'Tuntas Harian'),
      h('p', { class: 'sub' }, T('Versi {v}', { v: window.TODO_VERSION || '' })),
      h('div', { class: 'about-lines' },
        h('div', {}, 'Pendiri dan Pengembang: Muhammad Ikhsan'),
        h('div', {}, 'Teknik Informatika, Universitas Pamulang'),
        h('a', { href: 'mailto:ican3192@gmail.com' }, 'ican3192@gmail.com')),
      h('p', { class: 'sub' }, '© 2026 Muhammad Ikhsan. Perangkat lunak bebas di bawah GPL-3.0 atau yang lebih baru, tanpa jaminan. Turunannya wajib tetap terbuka.'),
      h('div', { class: 'about-links' },
        h('a', { href: 'legal/LICENSE', target: '_blank', rel: 'noopener noreferrer' }, 'Teks lisensi'),
        h('a', { href: 'legal/THIRD_PARTY_NOTICES.md', target: '_blank', rel: 'noopener noreferrer' }, 'Komponen pihak ketiga')),
      h('a', { class: 'btn about-donate', id: 'donate-link', href: 'https://sociabuzz.com/nacitwo/tribe', target: '_blank', rel: 'noopener noreferrer' }, '♥ ' + T('Dukung pengembang (donasi)')),
      h('button', { class: 'btn', type: 'button', id: 'abt-close', onclick: closeAbout }, 'Selesai')));
  document.body.append(ABT.el);
  ABT.el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeAbout(); } }, true);
}
function openAbout() {
  window.closeNav();
  ABT.el.hidden = false;
  window.TodoA11y.open(ABT.el, { focus: '#abt-close', returnTo: () => $('#about-btn') });
}
function closeAbout() {
  if (ABT.el.hidden) return;
  ABT.el.hidden = true;
  window.TodoA11y.close(ABT.el);
}
buildAbout();
$('#about-btn').addEventListener('click', openAbout);
