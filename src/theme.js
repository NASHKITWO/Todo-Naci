(function () {
  var theme = 'light', accent = 'indigo';
  try {
    theme = localStorage.getItem('todo-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    accent = localStorage.getItem('todo-accent') || 'indigo';
  } catch (e) {}
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = accent;
})();
// Cegah kirim formulir bawaan peramban (CSP melarangnya, dan memuat ulang halaman) selama aplikasi belum selesai dimuat.
document.addEventListener('submit', function (e) { e.preventDefault(); }, true);
