/* Kamus Inggris. Kunci = teks sumber Indonesia (persis seperti di kode). Nilai larik = [bentuk tunggal, jamak] menurut {n}.
 * Kuncinya tidak boleh mengandung data pengguna; teks pengguna dibungkus raw() di app.js. */
(function () {
  'use strict';
  const I = (typeof window !== 'undefined' && window.TodoI18n) || require('./i18n.js');
  const D = I.DICT.en;
  const add = o => Object.assign(D, o);
  const syntaxEn = '!priority (1/2/3 or high/medium/low)  ^deadline [time] (tomorrow 14:00, +3d, 31/12)  @project  #tag  *repeat (weekly, 2w)';
  const formatEn = 'Supported formats: YYYY-MM-DD, DD/MM/YYYY, DD/MM, today, tomorrow, day after tomorrow, next week, +3d (3 days), +2w (2 weeks), +1m (1 month), or a weekday name (e.g. friday).';
  const timeEn = 'Time must be HH:MM or HH.MM (00:00-23:59), e.g. 14:30.';
  const T = I.T;

  // ---- tanggal ----
  add({
    Mei: 'May', Agu: 'Aug', Okt: 'Oct', Des: 'Dec',
    Min: 'Sun', Sen: 'Mon', Sel: 'Tue', Rab: 'Wed', Kam: 'Thu', Jum: 'Fri', Sab: 'Sat',
    Terlambat: 'Overdue', 'Hari ini': 'Today', Besok: 'Tomorrow', Kemarin: 'Yesterday', 'Minggu ini': 'This week', Nanti: 'Later', 'Tanpa deadline': 'No deadline',
    'Terlambat {n} hari': ['Overdue by {n} day', 'Overdue by {n} days'],
    'Tiap hari': 'Daily', 'Tiap minggu': 'Weekly', 'Tiap bulan': 'Monthly', 'Tiap tahun': 'Yearly',
    'Tiap {n} hari': 'Every {n} days', 'Tiap {n} minggu': 'Every {n} weeks', 'Tiap {n} bulan': 'Every {n} months', 'Tiap {n} tahun': 'Every {n} years',
    'Setiap hari': 'Every day', 'Setiap minggu': 'Every week', 'Setiap bulan': 'Every month', 'Setiap tahun': 'Every year',
    'Setiap {n} hari': 'Every {n} days', 'Setiap {n} minggu': 'Every {n} weeks', 'Setiap {n} bulan': 'Every {n} months', 'Setiap {n} tahun': 'Every {n} years',
  });

  // ---- navigasi & tampilan ----
  add({
    Navigasi: 'Navigation', Tampilan: 'Views', 'Tampilan dan data': 'Appearance and data',
    Proyek: 'Projects', Tag: 'Tags', 'Warna aksen': 'Accent color', Tema: 'Theme', Bahasa: 'Language',
    'Ganti warna aksen': 'Change accent color', 'Ganti tema (t)': 'Change theme (t)', 'Ganti bahasa': 'Switch language',
    'Bahasa: {name}': 'Language: {name}', 'Tidak bisa menyimpan pilihan bahasa.': 'Could not save the language choice.',
    'Warna aksen: {name}': 'Accent color: {name}',
    'Biru tinta': 'Ink blue', 'Hijau daun': 'Leaf green', 'Merah bata': 'Brick red', 'Cokelat kopi': 'Coffee brown', Arang: 'Charcoal',
    'Tema terang': 'Light theme', 'Tema gelap': 'Dark theme',
    Mendatang: 'Upcoming', Kalender: 'Calendar', 'Semua tugas': 'All tasks', Selesai: 'Done', Wawasan: 'Insights', Sampah: 'Trash',
    'Buka menu': 'Open menu', 'Cari tugas…  ( / )': 'Search tasks…  ( / )', 'Cari tugas': 'Search tasks',
    'Pilih banyak tugas': 'Select multiple tasks', 'Pilih banyak (v)': 'Select multiple (v)',
    'Tambah tugas baru': 'Add a new task', 'Tambah tugas…': 'Add task…',
    'Tambah tugas…  contoh: Bayar listrik !1 ^besok @rumah #tagihan *monthly': 'Add task…  e.g. Pay rent !1 ^tomorrow @home #bills *monthly',
    Tambah: 'Add', 'Tambah banyak tugas dan templat': 'Add many tasks and templates', 'Tambah banyak / templat': 'Add many / templates',
    'Bantuan penulisan cepat': 'Quick-entry help', 'Bantuan (?)': 'Help (?)', 'Penulisan cepat': 'Quick entry',
    'Ringkasan hari ini': "Today's summary", Pekan: 'Week', 'Daftar tugas': 'Task list', 'Detail tugas': 'Task details',
    'Pekan sebelumnya': 'Previous week', 'Pekan berikutnya': 'Next week', 'Tutup panel': 'Close panel',
    Otomatis: 'Automatic', Prioritas: 'Priority', Waktu: 'Time', Terbaru: 'Newest', Urutkan: 'Sort',
    'Urut: {name}': 'Sort: {name}', 'Diurutkan: {name}': 'Sorted by: {name}',
    Semua: 'All', 'Prioritas tinggi': 'High priority', 'Ber-jam': 'With time', Berulang: 'Recurring',
    'Tugas selesai': 'Task done',
  });

  // ---- bantuan penulisan cepat (teks statis di index.html) ----
  add({
    'Tulis judul, lalu sisipkan penanda di mana saja:': 'Write a title, then add markers anywhere:',
    atau: 'or', '— prioritas': '— priority', '— deadline; tambah jam:': '— deadline; add a time:',
    '— proyek': '— project', '— tag (boleh banyak)': '— tag (as many as you like)', '— ulangi otomatis setelah selesai': '— repeat automatically after completion',
    'Pintasan:': 'Shortcuts:', 'tugas baru,': 'new task,', 'cari,': 'search,', 'tema,': 'theme,', 'pindah tugas,': 'move between tasks,',
    'selesai,': 'done,', 'buka,': 'open,', 'pilih banyak,': 'select multiple,', 'tutup.': 'close.',
    '^besok': '^tomorrow', '^jumat': '^friday', '^besok 14:00': '^tomorrow 14:00', '^besok sore': '^tomorrow 17:00', '^jumat jam 3 sore': '^friday 15:00', '@proyek': '@project',
  });

  // ---- keadaan kosong ----
  add({
    'Semua beres': 'All clear', 'Tidak ada tugas yang jatuh tempo hari ini. Nikmati harimu.': 'Nothing is due today. Enjoy your day.',
    'Belum ada rencana': 'Nothing planned yet', 'Tambahkan tugas dengan deadline untuk melihatnya di sini.': 'Add tasks with a deadline to see them here.',
    'Belum ada tugas': 'No tasks yet', 'Ketik di kolom atas, mis. “Beli susu !2 ^besok #belanja”.': 'Type in the box above, e.g. “Buy milk !2 ^tomorrow #groceries”.',
    'Belum ada yang selesai': 'Nothing done yet', 'Tugas yang kamu centang akan muncul di sini.': 'Tasks you check off will show up here.',
    'Sampah kosong': 'Trash is empty', 'Tugas yang kamu hapus muncul di sini selama 30 hari sebelum hilang permanen.': 'Tasks you delete stay here for 30 days before they are gone for good.',
    'Hari ini lengang': 'A quiet day', 'Tidak ada tugas di tanggal ini. Ketik di kolom atas untuk menambah.': 'No tasks on this date. Type in the box above to add one.',
    'Tidak ada hasil': 'No results', 'Tidak ada tugas yang cocok dengan filter ini.': 'No tasks match this filter.', 'Tidak ada tugas yang cocok dengan pencarian.': 'No tasks match your search.',
    'Hapus semua yang selesai': 'Delete all completed', 'Mencoba lagi otomatis…': 'Retrying automatically…',
  });

  // ---- baris tugas ----
  add({
    'Buka lagi': 'Reopen', 'Tunda ke besok': 'Snooze to tomorrow', 'Lihat proyek': 'View project', 'Lihat tag': 'View tag',
    'Sembunyikan subtugas': 'Hide subtasks', 'Tampilkan subtugas': 'Show subtasks', 'Ada catatan': 'Has notes',
    'Progres subtugas': 'Subtask progress', 'Tambah subtugas…': 'Add subtask…',
    '{title} (selesai)': '{title} (done)', 'Subtugas baru untuk {title}': 'New subtask for {title}',
    'Buka kembali: {title}': 'Reopen: {title}', 'Selesaikan: {title}': 'Complete: {title}',
    '{n} tugas': ['{n} task', '{n} tasks'], '{n} subtugas': ['{n} subtask', '{n} subtasks'],
  });

  // ---- sidebar, hero, wawasan ----
  add({
    'Progres keseluruhan': 'Overall progress', '{done} dari {total} selesai': '{done} of {total} done', '{n} terlambat': '{n} overdue',
    '{n} selesai': '{n} done', 'Selesai 7 hari terakhir': 'Done in the last 7 days', 'Selesai 7 hari terakhir: {n}': 'Done in the last 7 days: {n}',
    'Selamat malam': 'Good night', 'Selamat pagi': 'Good morning', 'Selamat siang': 'Good afternoon', 'Selamat sore': 'Good evening',
    'Hari ini masih kosong. Tambahkan tugas, atau nikmati waktu luangmu.': 'Nothing planned for today. Add a task, or enjoy the free time.',
    'Semua tugas hari ini selesai. Kerja bagus!': 'Everything for today is done. Nice work!',
    '{n} tugas menunggu': ['{n} task waiting', '{n} tasks waiting'], '{n} di antaranya terlambat': ['{n} of them overdue', '{n} of them overdue'],
    '{done} dari {total} tugas hari ini selesai': '{done} of {total} tasks today done',
    'Berikutnya {time}': 'Next at {time}', 'Beruntun {n} hari': ['{n}-day streak', '{n}-day streak'],
    'Ringkasan produktivitasmu': 'Your productivity summary', 'Dihapus otomatis setelah 30 hari': 'Deleted automatically after 30 days', 'Tugas aktif': 'Active tasks',
    Tinggi: 'High', Sedang: 'Medium', Rendah: 'Low',
    'Selesai 7 hari': 'Done in 7 days', 'Tepat waktu': 'On time', 'Hari beruntun': 'Day streak',
    'Tugas selesai per hari': 'Tasks done per day', 'Tugas aktif menurut prioritas': 'Active tasks by priority', 'Progres per proyek': 'Progress per project',
    'Belum ada proyek. Tambahkan dengan @nama saat menulis tugas.': 'No projects yet. Add one with @name when writing a task.',
    'Persentase tepat waktu muncul setelah ada tugas ber-deadline yang selesai.': 'The on-time percentage appears once a task with a deadline has been completed.',
    '{done} dari {total} tugas ber-deadline selesai pada atau sebelum tanggalnya.': '{done} of {total} tasks with a deadline were completed on or before their date.',
  });

  // ---- sampah, pilih banyak, duplikat, aksi ----
  add({
    'Dihapus {date}': 'Deleted {date}', 'Pulihkan': 'Restore', 'Pulihkan semua': 'Restore all', 'Pulihkan: {title}': 'Restore: {title}',
    'Hapus permanen': 'Delete permanently', 'Hapus permanen: {title}': 'Delete permanently: {title}', 'Kosongkan sampah': 'Empty trash',
    'Tugas dipulihkan': 'Task restored', '{n} entri dipulihkan': ['{n} item restored', '{n} items restored'], Dikembalikan: 'Restored',
    'Hapus "{title}" secara permanen? Tidak bisa dipulihkan lagi.': 'Permanently delete "{title}"? This cannot be undone.',
    'Kosongkan sampah? {n} entri akan hilang permanen.': ['Empty the trash? {n} item will be gone for good.', 'Empty the trash? {n} items will be gone for good.'],
    'Sampah dikosongkan': 'Trash emptied', Urungkan: 'Undo',
    'Aksi untuk tugas terpilih': 'Actions for selected tasks', '{n} dipilih': '{n} selected', 'Pilih tugas': 'Select tasks', Hapus: 'Delete', Batal: 'Cancel',
    '{n} tugas selesai': ['{n} task done', '{n} tasks done'], '{n} tugas dibuka lagi': ['{n} task reopened', '{n} tasks reopened'],
    '{n} tugas ditunda ke besok': ['{n} task snoozed to tomorrow', '{n} tasks snoozed to tomorrow'],
    '{n} tugas dipindah ke sampah': ['{n} task moved to trash', '{n} tasks moved to trash'],
    '{n} tugas selesai dipindah ke sampah': ['{n} completed task moved to trash', '{n} completed tasks moved to trash'],
    '"{title}" dipindah ke sampah': '"{title}" moved to trash',
    '(salinan)': '(copy)', 'Tugas diduplikasi': 'Task duplicated', 'Selesai · berikutnya {when}': 'Done · next {when}',
    '1 jam lagi': '1 hour from now', 'sore ini (17:00)': 'this evening (17:00)', 'minggu depan': 'next week', besok: 'tomorrow',
    'Ditunda ke {when}': 'Snoozed: {when}', 'Ditambahkan: {title}': 'Added: {title}', Lihat: 'View',
  });

  // ---- panel detail ----
  add({
    'Judul tugas': 'Task title', 'Tidak berulang': 'Does not repeat', 'Jam deadline': 'Deadline time', 'Minggu depan': 'Next week',
    'Hapus tanggal': 'Clear date', 'mis. rumah': 'e.g. home', 'tagihan, penting': 'bills, important',
    'Catatan, tautan, atau detail lain…': 'Notes, links, or other details…', 'Tambah subtugas lalu tekan Enter': 'Add a subtask and press Enter',
    Deadline: 'Deadline', Tunda: 'Snooze', '+1 jam': '+1 hour', 'Sore ini': 'This evening', Ulangi: 'Repeat',
    'Tag (pisahkan dengan koma)': 'Tags (comma-separated)', Catatan: 'Notes', Subtugas: 'Subtasks', Duplikat: 'Duplicate', 'Hapus tugas': 'Delete task',
    'Hapus subtugas {title}': 'Delete subtask {title}', 'Belum selesai': 'Not done yet', '{done} dari {total} subtugas': '{done} of {total} subtasks',
    'Dibuat {date}': 'Created {date}', 'Selesai {date}': 'Done {date}',
  });

  // ---- chip penulisan cepat ----
  add({
    'Akhir pekan': 'Weekend', Penting: 'Important', Harian: 'Daily', Mingguan: 'Weekly',
    'Pagi 08:00': 'Morning 08:00', 'Siang 12:00': 'Noon 12:00', 'Sore 17:00': 'Evening 17:00',
  });


  // ---- sambutan & keadaan kosong ----
  add({
    'Selamat datang di Tuntas Harian': 'Welcome to Tuntas Harian', 'Mulai dari yang kecil. Tiga hal yang perlu kamu tahu:': 'Start small. Three things worth knowing:',
    'Ketik di kolom bawah, mis. “Beli susu !2 ^besok”. Penanda ! ^ @ # * mengatur prioritas, tanggal, proyek, tag, dan pengulangan.': 'Type in the box below, e.g. “Buy milk !2 ^tomorrow”. The markers ! ^ @ # * set priority, date, project, tag and repeat.',
    'Geser tugas ke kanan untuk menyelesaikan, ke kiri untuk menunda. Tekan lama untuk memilih banyak.': 'Swipe a task right to complete it, left to snooze it. Long-press to select several.',
    'Punya daftar di catatan atau chat? Tempel saja, satu baris satu tugas.': 'Have a list in your notes or chat? Just paste it, one task per line.',
    'Tulis tugas pertama': 'Write your first task', 'Coba dengan contoh': 'Try with examples', 'Tempel daftar': 'Paste a list',
    'Tulis tugas': 'Write a task', 'Lihat tugas mendatang': 'See upcoming tasks',
    'Contoh ditambahkan. Coba geser, buka, dan centang.': 'Examples added. Try swiping, opening and checking them off.',
    'Geser tugas ini ke kanan untuk menyelesaikannya ^hariini !2\nTulis tugas sendiri di kolom bawah ^besok @contoh #pemula\nBuka tugas ini untuk melihat detailnya ^hariini 17:00 @contoh\n  Tambahkan subtugas di sini\n  Centang subtugas kalau sudah':
      'Swipe this task right to complete it ^today !2\nWrite your own task in the box below ^tomorrow @examples #beginner\nOpen this task to see its details ^today 17:00 @examples\n  Add a subtask here\n  Check off subtasks when done',
  });


  // ---- lembar atur detail ----
  add({
    'Atur detail tugas (prioritas, tanggal, proyek)': 'Set task details (priority, date, project)', 'Atur detail tugas': 'Set task details',
    'Tugas baru': 'New task', 'Pilih saja opsinya, tanpa perlu menghafal simbol. Yang tidak diisi dibiarkan kosong.': 'Just pick the options, no symbols to memorise. Anything you leave empty stays empty.',
    Judul: 'Title', 'Apa yang perlu dikerjakan?': 'What needs doing?', 'Tanggal deadline': 'Deadline date', Lusa: 'Day after tomorrow', 'Tanpa tanggal': 'No date',
    'Tambahkan tugas': 'Add task', 'Tambah banyak sekaligus atau pakai templat': 'Add many at once or use a template',
  });

  // ---- tambah banyak + templat ----
  add({
    'Siapkan presentasi !1 ^besok 09:00 @kuliah\n  Susun slide\n  Latihan bicara\nBeli kertas #belanja\n- [x] Kirim tugas kemarin':
      'Prepare presentation !1 ^tomorrow 09:00 @school\n  Draft slides\n  Practice talk\nBuy paper #shopping\n- [x] Send yesterday\'s assignment',
    'Daftar tugas, satu per baris': 'Task list, one per line', Tambahkan: 'Add', 'Tambahkan {n} tugas': ['Add {n} task', 'Add {n} tasks'],
    'Nama templat': 'Template name', 'Nama templat, mis. Rapat mingguan': 'Template name, e.g. Weekly meeting', 'Simpan sebagai templat': 'Save as template',
    Tutup: 'Close', 'Tambah banyak tugas': 'Add many tasks',
    'Tempel atau ketik satu tugas per baris. Baris yang menjorok menjadi subtugas. Penanda !1 ^besok @proyek #tag *ulang tetap berlaku, dan butir seperti "- ", "1." atau "- [x]" dikenali.':
      'Paste or type one task per line. Indented lines become subtasks. The !1 ^tomorrow @project #tag *repeat markers still work, and bullets like "- ", "1." or "- [x]" are recognised.',
    Templat: 'Templates',
    'Simpan teks di atas sebagai templat untuk dipakai lagi. Tanggal seperti ^besok dihitung dari hari pemakaian. Templat hanya ada di HP ini.':
      'Save the text above as a template to reuse. Dates like ^tomorrow are calculated on the day you use it. Templates exist only on this phone.',
    'prioritas tinggi': 'high priority', 'prioritas rendah': 'low priority',
    'Pakai templat: {name}': 'Use template: {name}', Pakai: 'Use', 'Ubah templat: {name}': 'Edit template: {name}', Ubah: 'Edit',
    'Hapus templat: {name}': 'Delete template: {name}', 'Belum ada templat.': 'No templates yet.',
    '{n} tugas ditambahkan': ['{n} task added', '{n} tasks added'], 'Templat "{name}" tersimpan.': 'Template "{name}" saved.', 'Hapus templat "{name}"?': 'Delete template "{name}"?',
  });

  // ---- local-api: notifikasi, cadangan, sinkron ----
  add({
    'Tunda 1 jam': 'Snooze 1 hour',
    'Pendiri dan Pengembang: Muhammad Ikhsan': 'Founder and Developer: Muhammad Ikhsan', 'Teknik Informatika, Universitas Pamulang': 'Informatics Engineering, Universitas Pamulang',
    'Dukung pengembang (donasi)': 'Support the developer (donate)',
    'Teks cadangan': 'Backup text', 'Tempel teks cadangan di sini untuk memulihkan…': 'Paste backup text here to restore…',
    'Cadangan Tuntas Harian': 'Tuntas Harian backup', 'Simpan cadangan ke…': 'Save backup to…',
    'Cadangan dibagikan. Simpan di tempat aman (mis. kirim ke diri sendiri).': 'Backup shared. Keep it somewhere safe (e.g. send it to yourself).',
    'Cadangan disalin ke papan klip.': 'Backup copied to the clipboard.', 'Salin teks di bawah ini dan simpan.': 'Copy the text below and keep it.',
    'Tidak bisa membagikan; salin teks di bawah ini secara manual.': 'Could not share; copy the text below manually.',
    'Bagikan cadangan': 'Share backup', 'Teks bukan JSON yang valid.': 'The text is not valid JSON.',
    'Tugas dari cadangan akan DITAMBAHKAN ke daftar sekarang. Lanjutkan?': 'Tasks from the backup will be ADDED to the current list. Continue?',
    '{n} tugas dipulihkan.': ['{n} task restored.', '{n} tasks restored.'], 'Pulihkan dari teks': 'Restore from text',
    'Berkas sinkron Tuntas Harian': 'Tuntas Harian sync file', 'Simpan berkas sinkron ke…': 'Save sync file to…',
    'Berkas dibagikan. Simpan ke Drive/Dropbox yang sama dengan perangkat lain.': 'File shared. Save it to the same Drive/Dropbox as your other devices.',
    'Berkas {name} diunduh.': 'File {name} downloaded.', 'Tidak bisa membagikan berkas: {msg}': 'Could not share the file: {msg}',
    'Kirim berkas sinkron': 'Send sync file', 'Berkas sinkron': 'Sync file',
    'Selesai: {added} baru, {updated} diperbarui, {deleted} dihapus.': 'Done: {added} new, {updated} updated, {deleted} deleted.',
    'Berkas bukan JSON yang valid.': 'The file is not valid JSON.', 'Gabungkan dari berkas…': 'Merge from file…',
    'Belum ada salinan. Salinan pertama dibuat otomatis begitu ada tugas.': 'No snapshots yet. The first one is created automatically once you have tasks.',
    '(sebelum pemulihan)': '(before restore)',
    'Salinan berkas di folder Dokumen/Todo: belum ditulis.': 'File copy in the Documents/Todo folder: not written yet.',
    'Salinan berkas di Dokumen/Todo/todo-cadangan.json diperbarui pukul {at}. Pulihkan lewat "Gabungkan dari berkas…".': 'File copy at Documents/Todo/todo-cadangan.json updated at {at}. Restore it via "Merge from file…".',
    'Salinan ke folder Dokumen gagal ({msg}). Salinan di dalam aplikasi tetap dibuat.': 'Copying to the Documents folder failed ({msg}). The in-app snapshot is still made.',
    'Daftar tugas akan DIGANTI persis seperti pada {label}. Tugas yang dibuat/diubah sesudahnya hilang (kondisi sekarang disimpan dulu sebagai salinan). Lanjutkan?':
      'Your task list will be REPLACED to match exactly {label}. Tasks created or changed since then will be lost (the current state is saved as a snapshot first). Continue?',
    '{restored} tugas dipulihkan, {removed} dihapus.': '{restored} tasks restored, {removed} removed.',
    'Token GitHub (izin: gist)': 'GitHub token (scope: gist)', 'Token GitHub': 'GitHub token',
    'Kata sandi sinkron (sama di semua perangkat)': 'Sync password (same on all devices)', 'Kata sandi sinkron': 'Sync password',
    'Isi token dulu.': 'Enter the token first.', 'Kata sandi sinkron minimal 8 karakter.': 'The sync password must be at least 8 characters.',
    'Data tugas dienkripsi dengan kata sandi ini di HP, lalu dikirim ke gist rahasia di akun GitHub Anda. Token dan kata sandi disimpan hanya di HP ini. LUPA kata sandi = data di gist tidak bisa dibuka (data di HP tetap aman). Lanjutkan?':
      'Your tasks are encrypted on this phone with this password, then sent to a secret gist in your GitHub account. The token and password are stored only on this phone. FORGET the password = the gist data cannot be opened (data on the phone stays safe). Continue?',
    'Menyambungkan…': 'Connecting…', 'Aktifkan sinkron otomatis': 'Enable auto sync', 'Menyinkronkan…': 'Syncing…', 'Sinkron sekarang': 'Sync now',
    'Matikan sinkron otomatis di HP ini? Token dan kata sandi dihapus dari HP; gist di GitHub tidak dihapus.': 'Turn off auto sync on this phone? The token and password are removed from the phone; the gist on GitHub is not deleted.',
    Matikan: 'Turn off',
    'Hapus SEMUA berkas sinkron di gist (milik semua perangkat)? Data di HP tidak berubah dan akan dikirim ulang. Berguna bila lupa kata sandi: setelah ini matikan, lalu aktifkan lagi dengan kata sandi baru di tiap perangkat.':
      'Delete ALL sync files in the gist (belonging to every device)? Data on this phone is unchanged and will be uploaded again. Useful if you forgot the password: afterwards turn sync off, then enable it again with a new password on each device.',
    '{n} berkas sinkron dihapus dari gist.': ['{n} sync file deleted from the gist.', '{n} sync files deleted from the gist.'], 'Atur ulang gist': 'Reset gist',
    'Aktif (gist {id}).': 'Active (gist {id}).', 'Aktif.': 'Active.',
    'Terakhir sinkron pukul {at}: {added} baru, {updated} diperbarui, {deleted} dihapus.': 'Last synced at {at}: {added} new, {updated} updated, {deleted} deleted.',
    'Terakhir sinkron pukul {at}, tidak ada perubahan.': 'Last synced at {at}, no changes.', 'Gagal pukul {at}: {msg}': 'Failed at {at}: {msg}',
    'Cadangan & sinkron': 'Backup & sync',
    'Data tugas hanya ada di HP ini. Jika aplikasi dihapus, data ikut hilang, jadi simpan cadangan secara berkala.': 'Your tasks exist only on this phone. If the app is uninstalled the data goes with it, so keep backups regularly.',
    'Cadangan otomatis di perangkat': 'Automatic backups on this device',
    'Salinan harian (7 terakhir) disimpan di dalam aplikasi. Di Android, berkas todo-cadangan.json juga ditulis ke folder Dokumen/Todo, dan cadangan otomatis Google (bila aktif di HP) memulihkan data saat ganti HP.':
      'Daily snapshots (the last 7) are kept inside the app. On Android, todo-cadangan.json is also written to the Documents/Todo folder, and Google auto-backup (if enabled on the phone) restores your data when you switch phones.',
    'Sinkron antar perangkat': 'Sync between devices',
    'Lewat berkas: simpan di Drive/Dropbox, lalu gabungkan dari perangkat lain. Versi yang lebih baru menang; tugas yang dihapus ikut terhapus. Pakai jam yang benar di semua perangkat.':
      'Via file: save it to Drive/Dropbox, then merge it on another device. The newer version wins; deleted tasks are deleted everywhere. Keep the clock correct on all devices.',
    'Sinkron otomatis': 'Auto sync',
    'Opsional. Memakai gist rahasia di akun GitHub Anda: buat token klasik dengan izin "gist" saja, lalu tentukan kata sandi sinkron. Di perangkat lain isi token dan kata sandi yang sama. Isi tugas dienkripsi di HP sebelum dikirim, jadi tidak terbaca di GitHub; token dan kata sandi hanya disimpan di HP ini.':
      'Optional. Uses a secret gist in your GitHub account: create a classic token with the "gist" scope only, then choose a sync password. On other devices enter the same token and password. Task contents are encrypted on the phone before upload, so they are unreadable on GitHub; the token and password are stored only on this phone.',
    'Penyimpanan di perangkat gagal (penuh atau diblokir).': 'Saving on the device failed (full or blocked).',
  });

  // ---- galat dari inti & sinkron (pesan tetap) ----
  add({
    'Tugas tidak ditemukan.': 'Task not found.', 'Tidak ditemukan.': 'Not found.', 'Tidak ada yang bisa dipulihkan.': 'Nothing to restore.',
    'Tidak ditemukan di sampah.': 'Not found in the trash.', 'Templat tidak ditemukan.': 'Template not found.',
    'Judul tugas wajib diisi.': 'A task title is required.', 'Judul tugas tidak boleh kosong.': 'Task title cannot be empty.',
    'Nama templat wajib diisi.': 'A template name is required.', 'Nama templat maksimal 60 karakter.': 'Template names can be at most 60 characters.',
    'Tidak ada baris tugas. Tulis satu tugas per baris.': 'No task lines. Write one task per line.',
    'Jam butuh tanggal deadline. Isi deadline-nya juga.': 'A time needs a deadline date. Set the deadline too.',
    'Subtugas tidak bisa memiliki subtugas lagi.': 'A subtask cannot have subtasks.', 'Subtugas tidak bisa berulang.': 'A subtask cannot repeat.',
    'Tidak ada yang diubah.': 'Nothing was changed.', 'Prioritas harus 1, 2, atau 3.': 'Priority must be 1, 2 or 3.',
    'Tanggal berikutnya di luar jangkauan.': 'The next date is out of range.',
    'Ini bukan berkas sinkron todo-cli.': 'This is not a todo-cli sync file.', 'Versi format berkas sinkron tidak didukung.': 'This sync file format version is not supported.',
    "Berkas sinkron rusak: 'tasks' dan 'deleted' harus berupa daftar.": "The sync file is corrupted: 'tasks' and 'deleted' must be lists.",
    'Berkas sinkron terlalu besar.': 'The sync file is too large.', 'Berkas sinkron berisi uid ganda.': 'The sync file contains duplicate uids.',
    "Format impor tidak valid: harus berisi daftar 'tasks'.": "Invalid import format: it must contain a 'tasks' list.",
    'Enkripsi tidak tersedia di perangkat ini.': 'Encryption is not available on this device.',
    'Data sinkron terenkripsi: isi kata sandi sinkron.': 'The sync data is encrypted: enter the sync password.',
    'Kata sandi sinkron salah (atau berkas dibuat dengan kata sandi lain).': 'Wrong sync password (or the file was made with another password).',
    'Berkas sinkron terenkripsi rusak.': 'The encrypted sync file is corrupted.', 'Tidak ada koneksi ke GitHub.': 'No connection to GitHub.',
    'Token ditolak GitHub (salah atau kedaluwarsa).': 'GitHub rejected the token (wrong or expired).',
    'GitHub menolak permintaan (izin token kurang atau terlalu sering). Coba lagi nanti.': 'GitHub refused the request (token lacks permission, or too many requests). Try again later.',
    'Gist tidak ditemukan.': 'Gist not found.', 'Berkas sinkron di gist terlalu besar untuk dibaca.': 'The sync file in the gist is too large to read.',
    'Token belum diisi.': 'The token has not been entered.',
    'Pengulangan tidak dikenali. Gunakan daily/weekly/monthly/yearly (atau harian/mingguan/bulanan/tahunan), atau bentuk 3d, 2w, 1m, 1y.': 'Repeat rule not recognised. Use daily/weekly/monthly/yearly, or a form like 3d, 2w, 1m, 1y.',
    'Bidang \'done\' harus true atau false.': "The 'done' field must be true or false.", "'defaults' harus berupa objek.": "'defaults' must be an object.",
    "'ids' harus berupa daftar angka.": "'ids' must be a list of numbers.", "'batch' harus berupa angka.": "'batch' must be a number.",
    'Subtugas tidak bisa berulang': 'A subtask cannot repeat',
    'Subtugas tidak bisa berulang; atur pengulangan di tugas induknya.': 'A subtask cannot repeat; set the repeat on its parent task.',
  });
  const tr = s => T(s);
  add({
    'Tambah tugas…  contoh: Bayar listrik': 'Add task…  e.g. Pay rent',
    'Ketik di kolom atas, mis. “Beli susu”, lalu pilih tombol tanggalnya.': 'Type in the box above, e.g. “Buy milk”, then pick a date button.',
    'Belum ada proyek. Pilih atau isi proyek lewat tombol “Lainnya…” saat menambah tugas.': 'No projects yet. Pick or enter one with the “More…” button when adding a task.',
    'Ketik di kolom bawah, mis. “Beli susu”, lalu pilih tombol tanggal, prioritas, atau proyek di bawahnya.': 'Type in the box below, e.g. “Buy milk”, then tap a date, priority or project button under it.',
    'Geser tugas ini ke kanan untuk menyelesaikannya': 'Swipe this task right to complete it',
    'Tulis tugas sendiri di kolom bawah': 'Write your own task in the box below',
    'Buka tugas ini untuk melihat detailnya': 'Open this task to see its details',
    'Tambahkan subtugas di sini': 'Add subtasks here',
    'Centang subtugas kalau sudah': 'Tick a subtask when it is done',
    'Pilih opsinya. Yang tidak diisi dibiarkan kosong.': 'Pick the options. Anything you leave empty stays empty.',
    'Tempel atau ketik satu tugas per baris. Baris yang menjorok menjadi subtugas. Tanggal, prioritas, dan proyek yang kamu pilih di tombol pilihan berlaku untuk semuanya.': 'Paste or type one task per line. Indented lines become subtasks. The date, priority and project you picked with the option buttons apply to all of them.',
    'Simpan daftar di atas sebagai templat untuk dipakai lagi. Pilihan tanggal diambil saat templat dipakai. Templat hanya ada di HP ini.': 'Save the list above as a template to reuse. The date options are taken when you use the template. Templates stay on this phone only.',
    'Siapkan presentasi\n  Susun slide\n  Latihan bicara\nBeli kertas\n- [x] Kirim tugas kemarin': 'Prepare presentation\n  Draft slides\n  Practise talking\nBuy paper\n- [x] Send yesterday’s assignment',
    'Akhir pekan': 'Weekend', Pagi: 'Morning', Siang: 'Noon', Sore: 'Afternoon', Malam: 'Evening',
    Harian: 'Daily', Mingguan: 'Weekly', Bulanan: 'Monthly', 'Lainnya…': 'More…',
    'Pilihan cepat tugas baru': 'Quick options for a new task',
    'bukan objek': 'not an object', 'uid tidak valid': 'invalid uid', 'parent_uid tidak valid': 'invalid parent_uid',
    'updated_at tidak valid': 'invalid updated_at', 'created_at tidak valid': 'invalid created_at', 'completed_at tidak valid': 'invalid completed_at',
    'tanggal tidak valid': 'invalid date', 'jam tanpa deadline': 'time without a deadline', 'parent_id harus berupa angka.': 'parent_id must be a number.',
    'Bagikan daftar': 'Share list', 'Bagikan daftar yang sedang tampil': 'Share the list on screen',
    'Tidak ada tugas untuk dibagikan.': 'There are no tasks to share.', 'Daftar dibagikan.': 'List shared.',
    'Daftar disalin ke papan klip.': 'List copied to the clipboard.', 'Gagal membagikan daftar.': 'Could not share the list.',
    'Pindah ke hari ini': 'Move to today', '{n} tugas dipindah ke hari ini': ['{n} task moved to today', '{n} tasks moved to today'],
    'Ubah nama proyek': 'Rename project', 'Nama baru proyek': 'New project name', 'Simpan': 'Save',
    'Semua tugas di proyek ini ikut berganti nama. Memakai nama proyek lain akan menggabungkannya.': 'Every task in this project is renamed with it. Using another project’s name merges them.',
    'Nama proyek tidak boleh kosong.': 'The project name cannot be empty.', 'Proyek diganti nama menjadi {name}': 'Project renamed to {name}',
    'Lebih sedikit': 'Fewer', 'Tambah banyak…': 'Add many…', 'Detail lengkap…': 'Full details…',
  });
  I.PATTERNS.en.push(
    [/^Baris (\d+): ([\s\S]*)$/, (n, rest) => 'Line ' + n + ': ' + tr(rest)],
    [/^Judul tugas tidak boleh kosong\. Penanda: [\s\S]*$/, () => 'Task title cannot be empty. Markers: ' + syntaxEn],
    [/^Deadline kosong\. [\s\S]*$/, () => 'The deadline is empty. ' + formatEn],
    [/^Tanggal tidak valid: '([\s\S]*)'\.$/, v => "Invalid date: '" + v + "'."],
    [/^Deadline '([\s\S]*)' tidak dikenali\. [\s\S]*$/, v => "Deadline '" + v + "' not recognised. " + formatEn],
    [/^Jam '([\s\S]*)' tidak dikenali\. [\s\S]*$/, v => "Time '" + v + "' not recognised. " + timeEn],
    [/^Jam '([\s\S]*)' tidak valid\. [\s\S]*$/, v => "Time '" + v + "' is not valid. " + timeEn],
    [/^Jam harus berformat HH:MM \(00:00-23:59\), mis\. 14:30\.$/, () => 'Time must be HH:MM (00:00-23:59), e.g. 14:30.'],
    [/^Prioritas '([\s\S]*)' tidak valid\. [\s\S]*$/, v => "Priority '" + v + "' is not valid. Use high/medium/low (or 1/2/3)."],
    [/^Judul terlalu panjang \(maksimal (\d+) karakter\)\.$/, n => 'The title is too long (at most ' + n + ' characters).'],
    [/^Catatan terlalu panjang \(maksimal (\d+) karakter\)\.$/, n => 'The notes are too long (at most ' + n + ' characters).'],
    [/^Nama proyek terlalu panjang \(maksimal (\d+) karakter\)\.$/, n => 'The project name is too long (at most ' + n + ' characters).'],
    [/^Tag terlalu panjang \(maksimal (\d+) karakter\)\.$/, n => 'The tag is too long (at most ' + n + ' characters).'],
    [/^Teks terlalu panjang \(maksimal (\d+) karakter\)\.$/, n => 'The text is too long (at most ' + n + ' characters).'],
    [/^Terlalu banyak baris \(maksimal (\d+)\)\.$/, n => 'Too many lines (at most ' + n + ').'],
    [/^Templat sudah terlalu banyak \(maksimal (\d+)\)\.$/, n => 'Too many templates (at most ' + n + ').'],
    [/^Tugas induk #(\d+) tidak ditemukan\.$/, n => 'Parent task #' + n + ' not found.'],
    [/^Bidang tidak dikenal: ([\s\S]*)$/, v => 'Unknown field: ' + v],
    [/^Bidang '([\s\S]*)' harus berupa teks\.$/, v => "The field '" + v + "' must be text."],
    [/^Bidang 'tags' harus berupa daftar teks\.$/, () => "The field 'tags' must be a list of text."],
    [/^Tugas ke-(\d+) di berkas sinkron tidak valid: ([\s\S]*)$/, (n, m) => 'Task #' + n + ' in the sync file is invalid: ' + tr(m)],
    [/^Tugas ke-(\d+) tidak valid: ([\s\S]*)$/, (n, m) => 'Task #' + n + ' is invalid: ' + tr(m)],
    [/^Penanda hapus ke-(\d+) di berkas sinkron tidak valid\.$/, n => 'Deletion marker #' + n + ' in the sync file is invalid.'],
    [/^GitHub membalas kesalahan (\d+)\.$/, n => 'GitHub replied with error ' + n + '.'],
    [/^Isi ([\s\S]*) bukan JSON yang valid\.$/, f => 'The contents of ' + f + ' are not valid JSON.'],
    [/^Isi ([\s\S]*) bukan berkas sinkron yang valid: ([\s\S]*)$/, (f, m) => 'The contents of ' + f + ' are not a valid sync file: ' + tr(m)],
    [/^Invalid isoformat string: '([\s\S]*)'$/, v => "Invalid date/time: '" + v + "'"],
    [/^Kesalahan (\d+)$/, n => 'Error ' + n],
  );
})();
