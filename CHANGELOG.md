# Changelog

## [0.16.0] - 2026-10-31

### Ditambahkan
- **Pindah ke hari ini**: tombol di grup "Terlambat" memindahkan semua tugas terlambat (yang belum selesai) ke hari ini. Jam yang sudah lewat
  dikosongkan agar tidak langsung terlambat lagi. Ada Urungkan yang memulihkan tanggal dan jam semula.
- **Ubah nama proyek**: tombol di tampilan proyek mengganti nama semua tugasnya sekaligus (termasuk yang selesai). Memakai nama proyek lain
  menggabungkan keduanya; warna proyek ikut pindah.

## [0.15.1] - 2026-10-31

### Diperbaiki
- Warna proyek tidak lagi kembar selama masih ada warna kosong (bentrok hash digeser ke warna bebas berikutnya); pilihan diingat di perangkat.
- Tombol "Akhir pekan" disembunyikan bila Sabtu jatuh hari ini atau besok (sebelumnya menyala ganda dengan Hari ini/Besok).
- Tanda merek di pojok kiri atas kini memakai logo matahari bercentang.

## [0.15.0] - 2026-10-31

### Ditambahkan
- **Bagikan daftar** (menu samping): kirim daftar yang sedang tampil sebagai teks rapi (☐/✅, tanggal, subtugas) lewat lembar bagikan Android
  (mis. WhatsApp), atau salin ke papan klip di browser.
- **Warna proyek otomatis**: tiap proyek punya warna tinta tetap (dari namanya) di chip tugas dan sidebar.
- **Blok tanggal** bergaya kalender sobek di sapaan layar Hari ini.
- **Centang digambar** saat menyelesaikan tugas, baru barisnya keluar (hormati "kurangi gerakan").

### Diperbaiki
- Formulir tidak lagi bisa terkirim secara bawaan peramban saat aplikasi baru dimuat (ditemukan uji klik acak).

## [0.14.1] - 2026-10-31

### Diperbaiki
- Android: latar ikon adaptif dan splash masih gradien ungu lama (tidak serasi dengan logo baru); kini biru sampul rata. Warna widget
  (terang/gelap), ikon notifikasi, dan favicon ikut palet baru.
- Tombol "Lebih sedikit" tidak menutup baris tombol bila jam/ulangi/proyek sudah dipilih; kini menutup.
- Memilih jam tanpa tanggal di tampilan Kalender memakai hari hari terpilih, bukan hari ini.
- Menghapus variabel tak terpakai di kamus Inggris.

### Diperiksa
- Analisis statis (ESLint: tidak ada referensi tak terdefinisi, tak ada duplikat/kode mati) dan uji klik acak di 5 konfigurasi (ponsel, desktop,
  Inggris, native, gelap) dengan 5 seed: tidak ada galat halaman.

## [0.14.0] - 2026-10-30

### Diubah
- **Tema baru "buku tulis harian"**, menggantikan tampilan bergaya template (gradien indigo-ungu, kartu putih berbayang seragam, font sistem).
  Sidebar jadi sampul biru tinta; halaman kertas bergaris dengan garis margin merah; judul grup bergaris tinta; chip "terlambat" seperti cap merah;
  statistik dan kalender jadi bidang datar tanpa kartu; semua sudut kecil dan konsisten.
- Font: Carlito (teks) dan Caladea (judul), disertakan lokal (Lora dihapus). Lisensi di `src/fonts/LICENSES.txt`.
- Pilihan warna aksen diganti jadi warna tinta: Biru tinta, Hijau daun, Merah bata, Cokelat kopi, Arang. Pilihan lama tersimpan tetap dipakai.
- Logo dibuat datar (tanpa gradien): latar biru sampul, matahari putih, centang merah-jingga. Ikon sparkle di layar kosong diganti matahari bercentang.

## [0.13.5] - 2026-10-30

### Ditambahkan
- Parser jam mengenali am/pm (`3pm`, `3:30 pm`, `12am`) dan kata waktu Inggris (morning, noon, afternoon, evening, night), selain pagi/siang/sore/malam.
- Alasan galat berkas sinkron (mis. "uid tidak valid") dan beberapa pesan inti lain kini ikut diterjemahkan di mode Inggris.

## [0.13.4] - 2026-10-29

### Diubah
- Logo baru: matahari (cincin + 8 sinar) dengan tanda centang amber di tengahnya, di atas gradien indigo-ungu. Dipakai untuk ikon peluncur,
  ikon adaptif/monokrom, dan splash. Berkas sumber: `assets/logo.svg` dan `assets/logo-1024.png`.

## [0.13.3] - 2026-10-29

### Diubah
- Aplikasi diberi nama **Tuntas Harian** (judul, sambutan, label Android, tentang, README). ID paket, folder `Dokumen/Todo`, dan nama
  berkas cadangan sengaja tidak diganti agar data dan cadangan lama tetap terbaca.

## [0.13.2] - 2026-10-29

### Diubah
- Templat lama yang berisi simbol diubah sekali menjadi judul biasa saat data dimuat (tanggal relatif seperti ^besok dibuang; indentasi dan
  [x] dipertahankan). Ditandai di data agar tidak diulang.

## [0.13.1] - 2026-10-29

### Diubah
- Baris tombol pilihan kini ringkas: tanggal dan prioritas saja, ditambah "Lainnya…". Isinya membuka jam, ulangi, proyek, "Tambah banyak…"
  dan "Detail lengkap…" (jadi tambah banyak terjangkau di ponsel). Terbuka otomatis bila jam/ulangi/proyek sudah dipilih.

## [0.13.0] - 2026-10-29

### Diubah
- **Simbol `! ^ @ # *` dihapus dari antarmuka.** Kolom tambah kini menerima judul biasa; di bawahnya ada tombol pilihan lengkap: tanggal
  (Hari ini / Besok / Akhir pekan / Minggu depan), jam (Pagi / Siang / Sore / Malam), prioritas (Tinggi / Sedang / Rendah), ulangi
  (Harian / Mingguan / Bulanan), tiga proyek teratas, dan "Lainnya…" ke lembar lengkap. Ketuk lagi untuk membatalkan pilihan. Pilihan
  dikosongkan setelah tugas ditambahkan.
- Tambah banyak (tempel) dan templat memakai judul biasa; pilihan tombol berlaku untuk tugas tingkat atas. Subtugas lewat indentasi.
- Contoh di layar sambutan dibuat lewat panggilan langsung, bukan teks bersimbol.

### Dihapus
- Tombol bantuan `?`, panel bantuan simbol, dan pintasan `?`.

### Catatan
- Inti (`/api/quick`) masih mengerti sintaks lama untuk kompatibilitas; antarmuka tidak lagi memakainya. Templat lama yang berisi simbol
  akan menampilkan simbol itu sebagai bagian judul.

## [0.12.2] - 2026-10-29

### Ditambahkan
- **Lembar "Atur detail"** (tombol penyesuai di kolom tambah): membuat tugas hanya dengan memilih opsi, tanpa simbol. Judul, prioritas
  (3 tombol), deadline (Hari ini / Besok / Lusa / Minggu depan / kalender / Tanpa tanggal), jam (Pagi / Siang / Sore atau pilih sendiri),
  proyek (chip proyek yang sudah ada atau ketik), tag, dan ulangi. Teks yang sudah diketik di kolom tambah (termasuk simbol) diisikan
  ke lembar; di tampilan proyek/tag/kalender, nilainya terisi sesuai tampilan. Simbol tetap bisa dipakai bagi yang suka mengetik cepat.

### Diubah
- Di ponsel, tombol "tambah banyak" di kolom tambah disembunyikan (kolom ketik jadi lebih lega); aksesnya lewat lembar Atur detail, tempel
  daftar, atau tombol di sambutan.

## [0.12.1] - 2026-10-29

### Diubah
- **Sambutan pertama kali pakai**: saat belum ada tugas sama sekali, layar menampilkan sambutan, tiga tips (tulis cepat, geser, tempel daftar)
  dan tiga tombol: *Tulis tugas pertama*, *Coba dengan contoh* (membuat tugas + subtugas yang bisa langsung dicoba), *Tempel daftar*.
  Kartu sapaan dan filter disembunyikan selama belum ada tugas.
- **Keadaan kosong yang mengajak bertindak**: tombol *Tulis tugas*; di Hari ini yang kosong ada *Lihat tugas mendatang*.
- Umpan balik sentuhan: tombol mengecil sedikit saat ditekan, toast muncul dengan gerak halus.

## [0.12.0] - 2026-10-28

### Ditambahkan
- **Sampah 30 hari + Urungkan**: hapus tugas, hapus massal, dan "hapus semua yang selesai" tidak lagi memakai dialog konfirmasi;
  tugas (beserta subtugas) pindah ke tampilan **Sampah** dan toast punya tombol *Urungkan*. Dari Sampah bisa *Pulihkan*, *Hapus
  permanen*, *Pulihkan semua*, atau *Kosongkan sampah* (dengan konfirmasi). Entri dibuang otomatis setelah 30 hari (maks. 200).
  Sampah hanya ada di HP itu (tidak ikut ekspor/sinkron); pemulihan memakai cap waktu baru sehingga menang atas penanda hapus di perangkat lain.
- **Tempel banyak baris**: menempel teks berbaris ke kolom tambah membuka dialog pratinjau; satu baris = satu tugas dengan sintaks
  penulisan cepat, butir (`- `, `* `, `1.`, `- [x]`) dikenali, baris menjorok = subtugas. Semua-atau-tidak: satu baris salah
  menolak seluruhnya dengan nomor barisnya. Tombol daftar di kolom tambah membuka dialog yang sama.
- **Templat tugas**: simpan teks berbaris sebagai templat, pakai kapan saja (tanggal relatif seperti `^besok` dihitung saat dipakai),
  ubah, hapus. Templat hanya ada di HP itu.
- **Aksi di notifikasi**: pengingat tugas punya tombol *Selesai* dan *Tunda 1 jam*; mengetuk notifikasi membuka panel tugasnya.
  (Di Android, tombol aksi membuka aplikasi lebih dulu; belum diuji di perangkat nyata.)
- **Bahasa Inggris** + pengalih bahasa di menu samping (bawaan tetap Indonesia; mengganti bahasa memuat ulang aplikasi).
  Kamus diuji kelengkapannya (kunci `T()` di kode, pola galat inti, dan pemindai kata Indonesia di semua layar mode Inggris).
- **Tautan donasi** ke sociabuzz.com/nacitwo/tribe di bagian kredit pengembang.

### Diubah
- Membatalkan "selesai" pada tugas berulang menghapus tugas berikutnya secara permanen (tidak mengotori Sampah).

### Catatan
- Penulisan cepat tetap memakai kata kunci Indonesia/Inggris yang sudah ada (`^besok`/`^tomorrow`); kata bagian hari (`pagi`, `sore`)
  dan "pm/am" belum tersedia dalam bahasa Inggris.

## [0.11.0] - 2026-10-28

### Ditambahkan
- **Widget**: centang lingkaran untuk menyelesaikan tugas langsung dari widget (diterapkan saat aplikasi dibuka), tombol **+**
  membuka aplikasi dengan kolom tambah terfokus, warna mengikuti tema terang/gelap sistem, deskripsi untuk pembaca layar.
- **Sinkron otomatis terenkripsi**: isi dienkripsi di HP (AES-GCM + PBKDF2) dengan kata sandi sinkron; tombol *Atur ulang gist*.
- **Aksesibilitas**: dialog sungguhan (role, latar inert, fokus masuk/kembali, Tab terjebak, Esc), `aria-expanded` pada menu,
  menu tertutup tidak bisa difokus, baris tugas punya nama, daftar tidak lagi `aria-live`, kontras AA, area ketuk ≥44 px di ponsel.
- Tes: harness Java untuk widget (kompilasi + perilaku terhadap kelas Android tiruan), audit aksesibilitas, tes sinkron bersamaan.

### Diubah
- **Sinkron Gist**: tiap perangkat menulis berkasnya sendiri (`todo-sync-<id>.json`) sehingga tidak ada lagi saling menimpa;
  berkas teks polos versi awal digabung lalu dihapus. Mengaktifkan sinkron kini butuh kata sandi (min. 8 karakter).
- **Tugas berulang**: tugas berikutnya memakai uid turunan dari tugas asal, jadi diselesaikan di dua HP sebelum sinkron tidak lagi
  menghasilkan dua tugas.
- Warna teks sekunder sedikit lebih gelap (kontras), pilihan prioritas memakai warna teks berkontras.

## [0.10.0] - 2026-10-26

### Ditambahkan
- **Kredit pengembang tampil di layar daftar tugas** (nama, jurusan, universitas, email), bukan hanya di panel cadangan.
- **Widget layar utama** (Android): tugas terlambat + hari ini, maksimal 5 baris, titik warna menurut prioritas, ketuk untuk membuka
  aplikasi. Data didorong lewat plugin native `TodoWidget` yang dibuat `tools/patch_android.js`.
- **Sinkron otomatis lewat GitHub Gist** (opsional, mati secara bawaan): gabung-lalu-tulis, perangkat kedua menemukan gist hanya dari
  token, idempoten (tanpa perubahan tidak menulis), pesan kesalahan jelas (token, jaringan, format). CSP kini mengizinkan
  `connect-src https://api.github.com` dan tidak yang lain.
- **Cadangan otomatis**: salinan harian di dalam aplikasi (7 terakhir) dengan tombol Pulihkan (kondisi sebelumnya disimpan dulu;
  pemulihan menang atas perangkat lain saat sinkron), berkas `Dokumen/Todo/todo-cadangan.json`, dan `allowBackup` dipaksa aktif
  agar cadangan otomatis Google berlaku.
- **Ikon dan splash baru**: kotak centang dengan tanda centang amber, ikon adaptif + ikon bertema (monokrom, Android 13+), splash
  gradien dengan lambang di tengah (menggantikan splash.png bawaan).

### Diubah
- Workflow `android`: opsi **widget** (bawaan aktif); matikan bila build gagal di bagian widget.

## [0.9.0] - 2026-10-26

### Diubah (tampilan, fokus ponsel)
- Header ringkas; pencarian jadi ikon yang membuka kolom saat diketuk (tombol `/` di keyboard).
- Kolom tambah tugas menempel di bagian bawah layar agar terjangkau ibu jari.
- Judul memakai font Lora (dibundel lokal, tanpa jaringan); label memakai huruf biasa, bukan kapital.
- Baris tugas lebih lega dan area ketuk lebih besar; proyek/tag ditampilkan sebagai teks polos; chip "Prioritas tinggi" di baris dihapus (warna lingkaran sudah menandai prioritas).
- Panel detail tugas menjadi lembar dari bawah dengan pegangan geser.
- Warna aksen, tema, dan cadangan/sinkron dipindah ke bagian pengaturan di menu samping.

## [0.8.0] - 2026-10-25

### Diubah
- **Repo dipangkas menjadi khusus APK Android.** CLI Python, server web, pengingat Telegram, dan paket PyPI dihapus.
  Seluruh kode kini JavaScript (Node 20+). Antarmuka web hanya dipakai di dalam aplikasi.
- Tes Python diganti: logika dikunci ke hasil acuan (`test/golden/`) yang dihasilkan implementasi Python sebelumnya,
  tes UI ditulis ulang dengan Playwright untuk Node, alat ikon/patch Android ditulis ulang dalam Node.

### Ditambahkan
- **Sinkron antar perangkat lewat berkas** (Drive/Dropbox): versi lebih baru menang, penghapusan menyebar, subtugas ikut induk.
  Penggabungan komutatif dan idempoten (diuji acak).

## Riwayat sebelumnya (saat masih berupa CLI + web)

- 0.7.0: kata waktu sehari-hari (`^besok sore`), subtugas inline, kalender, filter + urutan, wawasan, pilih banyak,
  pintasan keyboard, duplikat tugas.
- 0.6.0: sapaan + cincin progres, animasi, geser sentuh, tunda cepat, chip tulis cepat, warna aksen.
- 0.5.0: aplikasi Android mandiri (Capacitor) dengan notifikasi lokal dan cadangan.
- 0.4.0 ke bawah: prioritas, deadline, jam, subtugas, tugas berulang, tag/proyek, login + HTTPS + PWA, ekspor/impor.
