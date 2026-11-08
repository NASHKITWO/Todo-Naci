/* Tuntas Harian - Hak Cipta (c) 2026 Muhammad Ikhsan. SPDX-License-Identifier: GPL-3.0-or-later. Program ini perangkat lunak bebas di bawah GNU GPL v3 atau yang lebih baru, TANPA JAMINAN; lihat LICENSE dan NOTICE. */
(function () {
  var theme = 'light', accent = 'teal';
  try {
    theme = localStorage.getItem('todo-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    accent = localStorage.getItem('todo-accent') || 'teal';
  } catch (e) {}
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = accent;
})();
// Cegah kirim formulir bawaan peramban (CSP melarangnya, dan memuat ulang halaman) selama aplikasi belum selesai dimuat.
document.addEventListener('submit', function (e) { e.preventDefault(); }, true);
