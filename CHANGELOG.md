# Changelog

## [0.43.0] - 2026-11-10

### Desain
- Pilihan "Ulangi" dan "Pengingat" di formulir tugas memakai gaya yang sama dengan kotak tanggal/jam (tinggi 48px, panah khas) alih-alih kontrol bawaan sistem.
- Kartu sapaan: tombol "Tunda sisa ke besok" kini berbingkai tipis di atas latar teal sehingga kartu "Berikutnya" tetap menjadi sorotan utama.
- Tombol "Pindah ke hari ini" di kepala grup Terlambat jadi tombol teks beraksen, bukan kotak kecil.

## [0.42.0] - 2026-11-10

### Keamanan: pemulihan dan cadangan terenkripsi
- Kunci pemulihan: saat enkripsi data dinyalakan, aplikasi menampilkan sekali sebuah kunci acak 160-bit. Lupa PIN? Di layar kunci pilih "Pakai kunci pemulihan", isi kunci itu dan PIN baru; data tetap utuh. "Buat kunci pemulihan baru" membatalkan yang lama.
- Format blob v3: data dienkripsi dengan kunci data acak, yang dibungkus terpisah oleh PIN dan oleh kunci pemulihan. Ganti PIN cukup membungkus ulang kunci data. Blob v1/v2 (0.40 dan 0.41) tetap terbuka; "Buat kunci pemulihan baru" menaikkannya ke v3.
- Cadangan otomatis ke Dokumen/Todo kembali berjalan saat enkripsi aktif, berupa blob terenkripsi (`todo-cadangan.terenkripsi.txt`, tanpa teks biasa). Pulihkan lewat "Gabungkan dari berkas…", lalu isi PIN atau kunci pemulihan saat berkas dibuat.
- Batas: kunci pemulihan yang hilang bersama PIN berarti data tak bisa dibuka. PIN pendek tetap bisa ditebak luring dari salinan penyimpanan; pakai PIN panjang.

## [0.41.0] - 2026-11-09

### Keamanan
- Ganti PIN di pengaturan Kunci aplikasi (PIN lama wajib benar). Saat enkripsi data aktif, data dienkripsi ulang dengan satu penulisan atomik; bila PIN layar gagal disimpan, kunci lama dipulihkan.
- Format blob terenkripsi v2 memuat garam dan putaran di kepala blob (blob v1 dari 0.40.0 tetap terbaca).
- PIN boleh sampai 16 angka (sebelumnya 8) supaya lebih sulit ditebak luring; PIN lama tetap berlaku.
- Kegagalan menulis penyimpanan terenkripsi kini memunculkan peringatan seketika.
- Tidak berubah: lupa PIN = data di HP tak bisa dibuka; salinan otomatis di Dokumen/Todo tetap mati saat enkripsi aktif; kegagalan simpan terenkripsi tidak membatalkan perubahan seperti mode biasa.

## [0.40.0] - 2026-11-09

### Keamanan: enkripsi data di perangkat (opsional)
- Pengaturan Kunci aplikasi: tombol "Nyalakan enkripsi data" (butuh PIN aktif). Tugas, snapshot harian, dan salinan data rusak disimpan sebagai satu blob AES-256-GCM; kuncinya diturunkan dari PIN (PBKDF2-SHA256, 300.000 putaran, garam terpisah) dan hanya ada di memori.
- Saat dinyalakan, data teks biasa dihapus hanya setelah blob terbukti bisa dibaca kembali; salinan lama di Dokumen/Todo dihapus dan tidak ditulis lagi. Mematikan enkripsi (atau mematikan kunci) mengembalikan data sebagai teks biasa.
- Saat terkunci, tidak ada jadwal notifikasi, dorongan widget, sinkron, atau penulisan yang berjalan dari data kosong.
- Batas: PIN 4 sampai 8 angka berarti ruang tebakan kecil; penyerang yang menyalin penyimpanan dapat menebak PIN secara luring. Ini menghalangi pembacaan santai, bukan penyerang berdaya besar. Lupa PIN = data di HP tak bisa dibuka (pulihkan dari cadangan/sinkron). Penulisan terenkripsi berjalan asinkron, jadi kegagalan simpan (penyimpanan penuh) baru terdeteksi pada perubahan berikutnya, tidak membatalkan perubahan seketika seperti mode biasa. Token sinkron tetap di penyimpanan native terpisah.
- Mengganti PIN saat enkripsi aktif ditolak; matikan enkripsi dulu.

## [0.39.0] - 2026-11-09

### Pengingat
- Jangkauan pengingat diperluas: 45 hari ke depan, hingga 150 notifikasi (sebelumnya 14 hari / 60).
- Spanduk di layar utama bila izin alarm tepat (exact alarm) ditolak, dengan tombol langsung ke pengaturannya.
- Batasan yang tetap ada: jadwal dihitung ulang saat aplikasi dibuka; tanpa kode native, aplikasi yang lama tidak dibuka tetap kehabisan jadwal setelah 45 hari.

### Desain
- Pemilih tanggal dan jam tampil sebagai tombol berisi teks terformat (mis. "Kam, 5 Nov", "19:00"); ketukan tetap membuka pemilih sistem.
- Ilustrasi khas (kartu tugas bertumpuk dengan cincin-centang) di sambutan dan semua layar kosong.

### Build
- Workflow `lockfile` (manual) untuk membuat dan meng-commit `package-lock.json`; tidak bisa dibuat di lingkungan pengembangan ini karena registry diblokir.

## [0.38.0] - 2026-11-08

### Desain: identitas, hierarki, keterbacaan (dari penilaian ulang)
- Identitas: kartu sapaan kini teal pekat bergradasi dengan motif cincin-centang besar yang samar; cincin progres putih, penuh jadi putih dengan centang hijau.
- Hierarki chip: hanya tanggal yang berlatar pil; proyek = titik warna + teks; tag = teks redup.
- Teks sekunder: warna muted lebih gelap (terang) / lebih terang (gelap), chip 14,5px.
- Tombol di kartu sapaan "Pindah sisa ke besok" -> "Tunda sisa ke besok", supaya tidak mirip "Pindah ke hari ini" di daftar terlambat.

## [0.37.0] - 2026-11-08

### Tiga sisa temuan audit
- Sinkron: subtugas yang dibuat/diubah SESUDAH induknya dihapus di perangkat lain kini diangkat menjadi tugas biasa (sebelumnya dibuang diam-diam). Cap waktunya diturunkan dari data (bukan jam), jadi semua perangkat menghitung hasil yang sama dan penggabungan tetap konvergen. 17 dari 150 kasus acuan di test/golden/sync.json diperbarui khusus untuk perilaku ini; kasus lain tidak berubah.
- Android, zona waktu: penerima TIMEZONE_CHANGED menampilkan notifikasi "Zona waktu berubah, buka Tuntas Harian agar jam pengingat disesuaikan"; aplikasi juga menghitung ulang jadwal saat zona waktu berubah selagi terbuka atau saat dibuka kembali.
- Android, layar aman: FLAG_SECURE (blokir screenshot/pratinjau saat PIN aktif) kini lewat plugin terpisah TodoSecure yang tetap terpasang walau build memakai --no-widget.
- Android, cadangan: token dan kata sandi sinkron disimpan di SharedPreferences native `todo_secrets` yang dikecualikan dari cadangan Google/adb dan transfer perangkat (fullBackupContent + dataExtractionRules). Token lama di localStorage dipindahkan otomatis sekali. Tanpa plugin (peramban) tetap di localStorage. HP baru hasil pemulihan Google perlu memasukkan token lagi.
- Tes: kompilasi Java varian tanpa widget + uji penerima zona waktu terhadap kelas Android tiruan, uji manifest/aturan cadangan, uji e2e penyimpanan rahasia native (dibuka ulang, dimatikan), uji penggabungan subtugas yatim.
Catatan jujur: bagian Android baru diuji dengan kompilator terhadap kelas Android tiruan, belum di HP sungguhan.

## [0.36.0] - 2026-11-08

### Perbaikan dari audit kode independen (3 peninjau: UI, keamanan/sinkron, Android)
Bug UI
- Setelah "Duplikat" lalu menutup panel detail, seluruh aplikasi tidak bisa disentuh (tumpukan dialog berisi entri ganda). Sekarang satu entri per dialog.
- "Urungkan" setelah menyelesaikan subtugas terakhir dari tugas berulang membuat induknya kehilangan aturan ulang. Sekarang aturan ulang induk dipulihkan.
- Ketuk ganda pada centang tugas berulang membuat dua toast dan "Urungkan" yang menyisakan duplikat. Ketukan kedua kini diabaikan.
- Hari berganti saat aplikasi terbuka: tanggal terpilih di Kalender ikut maju, dan segarkan tetap jalan saat mengetik di panel detail, sehingga "Hari ini/Besok/Tunda" tidak memakai tanggal kemarin.
- "Sore ini (17:00)" setelah jam 17:00 kini memindahkan ke besok 17:00 (sebelumnya langsung terlambat tanpa pengingat).
Data dan sinkron
- Penyimpanan penuh/diblokir: perubahan di memori dibatalkan sehingga layar tidak menampilkan tugas yang tidak tersimpan (dan hilang saat aplikasi ditutup). Perubahan setengah jalan akibat galat juga dibatalkan.
- Satu baris tugas cacat tidak lagi membuang seluruh daftar; baris sehat tetap dimuat, salinan mentah diamankan. Bila salinan tak bisa diamankan, penulisan ditahan agar data asli tidak tertimpa kosong.
- Impor cadangan: subtugas bertingkat 3 tidak lagi dibuat (sebelumnya hilang diam-diam saat sinkron berikutnya); impor di atas 20.000 tugas ditolak.
- Sinkron: cap waktu jauh di masa depan (jam perangkat salah) dijepit, sehingga tidak mengalahkan semua suntingan sah selamanya.
- Salinan harian (snapshot): bila kuota penuh, salinan terlama dibuang daripada gagal diam-diam.
Kunci PIN dan privasi
- Tebakan PIN diserialkan (tidak ada tebakan paralel yang melewati batas percobaan).
- Saat PIN aktif: isi notifikasi dibuat umum (judul tugas tidak muncul di layar kunci), widget tidak menampilkan tugas, dan aksi Selesai/Tunda dari notifikasi atau widget menunggu sampai PIN dimasukkan.
Android
- Jadwal ulang pengingat tidak lagi tumpang tindih; izin SCHEDULE_EXACT_ALARM dibatasi sampai Android 12L (API 32).
- Filter ponsel: "Prioritas tinggi" -> "Penting", "Ber-jam" -> "Berjam".
Tes baru: test/audit.test.js (unit), test/e2e/audit.test.js, test/fuzz.test.js.

Belum diperbaiki (disengaja atau butuh perangkat): subtugas yang induknya dihapus di perangkat lain masih dibuang saat sinkron (mengubahnya menyimpang dari aturan sinkron acuan); penjadwalan ulang pengingat saat zona waktu berubah dan FLAG_SECURE tanpa widget butuh kode Java dan uji di HP; token sinkron ikut cadangan Google (keputusan desain).

## [0.35.0] - 2026-11-07

### Audit dan perbaikan
- Tes baru `test/fuzz.test.js`: 300 rangkaian x 60 operasi acak (tambah, subtugas, selesai, ubah, hapus, pulihkan, bersihkan, bulk, ekspor-impor) menjaga invarian data (id/uid unik, induk ada, tanpa sub-subtugas, tanpa galat 5xx). Lolos tanpa temuan.
- Uji tepi UI: judul 240 karakter tanpa spasi, HTML/skrip di judul dan catatan, 300 tugas, lebar 320-768px: tanpa meluap ke samping dan tanpa injeksi.
- Filter di ponsel: label dipendekkan ("Prioritas tinggi" -> "Penting", "Ber-jam" -> "Berjam") dan jarak dirapatkan, sehingga hampir semuanya muat tanpa terpotong.

## [0.34.2] - 2026-11-06

### Identitas, chip, teks sekunder (dari penilaian ulang)
- Identitas: font judul khas Bricolage Grotesque (OFL) untuk judul, nama grup, dan angka besar; teks isi tetap Inter. Saat semua tugas hari ini selesai, cincin di kartu sapaan terisi hijau penuh dengan centang besar. Judul tugas selesai bergaris hijau.
- Chip per tugas dikurangi: pengulangan menyatu dengan chip tanggal (ikon ulang), maksimal satu tag + "+N", ikon catatan pindah kecil di samping judul.
- Teks sekunder diperbesar (chip 14px, keterangan KPI/kalender/hero 14.5-15px).

## [0.34.1] - 2026-11-06

### Sisa temuan peninjau desain
- Istilah: "Deadline" -> "Batas waktu", "Tunda" (di panel detail) -> "Jadwalkan ulang". Tombol notifikasi "Tunda 1 jam" tidak diubah.
- Tanggal dan jam: dua kolom berdampingan dengan tinggi sama, plus teks hasil terbaca di bawahnya (mis. "Kam, 5 Nov, 19:00"). Pemilih tetap bawaan sistem.
- Chip "Hari ini" memakai warna aksen, tidak lagi kuning seperti prioritas sedang.
- Chip proyek lebih tinggi dan lega (32px).
- Kalender Wawasan lebih kecil (sel 28px).
- Chip "Berikutnya": label di atas, judul penuh sampai 2 baris, tidak terpotong satu baris.

## [0.34.0] - 2026-11-06

### Revisi desain dari 12 peninjau desain simulasi
- Identitas: warna dasar hijau daun (teal) dan motif "cincin tuntas" (cincin + centang) di logo, layar kosong, dan favicon. Pilihan aksen: Hijau daun, Biru tinta, Merah bata, Cokelat kopi, Arang.
- Kartu sapaan lebih ringkas: satu chip "Berikutnya" yang bisa digeser, cincin lebih kecil.
- Keterbacaan: teks sekunder lebih besar dan lebih gelap; prioritas juga dibedakan lewat ketebalan cincin, bukan hanya warna.
- Filter: pudar di tepi kanan sebagai petunjuk bisa digeser (ponsel).
- Panel detail: judul tugas panjang membungkus ke beberapa baris; tombol "Tunda" dilipat dalam satu tombol.
- Wawasan: keadaan kosong yang jelas saat belum ada tugas selesai minggu ini.
- Mode gelap berlapis (latar, kartu, panel) dengan garis tepi tipis agar kedalaman terlihat.
- Area ketuk centang diperbesar; audit a11y menyesuaikan isi `<details>` yang tertutup.

## [0.33.2] - 2026-11-05

### Perbaikan dari uji 15 penguji simulasi (6 putaran masing-masing)
- Mode pilih banyak: mengetuk chip (mis. `@rumah`) di dalam baris tidak lagi berpindah tampilan dan membatalkan pilihan.
- Dialog "Kunci aplikasi" dan "Pengingat" menutup menu samping saat dibuka. Sebelumnya, setelah membuka kunci dengan PIN, menu tetap terbuka di belakang dan isi aplikasi tetap `inert` sampai menu ditutup manual (kolom tambah tugas tidak bisa dipakai).
- Dialog Kunci: setelah "Matikan kunci" fokus pindah ke "Selesai" sehingga Esc tetap menutup dialog.
- Area ketuk: tombol aksi toast ("Urungkan") 22px -> 44px; baris dan kolom subtugas, chip hero, dan chip saran diperbesar di ponsel.
- Layar sangat sempit (<= 380px): kolom tambah tugas tetap punya ruang mengetik; tombol detail disembunyikan di <= 260px.
- Tes baru: kunci dibuka dari menu di ponsel (menu tertutup, tambah tugas berfungsi, Esc menutup dialog Kunci).

## [0.33.1] - 2026-11-05

### Daftar tugas bersih
- Kredit pengembang, lisensi, dan donasi dipindah dari bawah daftar tugas ke dialog "Tentang aplikasi" (tombol di menu samping). Isinya: versi, pengembang, kampus, email, ringkasan GPL-3.0, tautan teks lisensi dan komponen pihak ketiga, serta tombol donasi. Daftar tugas kini tidak lagi mengintip di belakang kolom tambah tugas di ponsel.
- Dialog menutup menu samping saat dibuka, dan bisa ditutup dengan Esc; fokus kembali ke tombolnya.
- Teks baru tersedia dalam bahasa Inggris. Tes e2e diperbarui (daftar bebas dari kredit; dialog memuat email, donasi, dan tautan lisensi).

## [0.33.0] - 2026-11-05

### Desain ulang: modern (menggantikan tema "Buku besar")
- Gaya lama dibuang: judul serif, garis margin buku tulis, ornamen kuningan, sampul sidebar gelap, kotak centang persegi, tab bergaris, cap "terlambat" miring.
- Font Inter (SIL OFL 1.1, subset Latin, 4 bobot, total 88 KB) menggantikan Carlito + Tuntas Serif (167 KB).
- Permukaan putih bersudut besar di atas latar sejuk; bayangan tipis; tanpa garis tebal. Menu samping terang dengan penanda menu aktif berupa kartu putih.
- Daftar tugas: kartu dengan pemisah tipis, centang bulat berwarna prioritas, chip pil lembut (terlambat = merah muda, hari ini = jingga muda, proyek = warna proyek).
- Filter berupa pil (aktif = tinta pekat), sapaan berupa kartu aksen lembut dengan cincin kemajuan, Wawasan berupa kartu angka, lembar bawah dan dialog bersudut 26px.
- Warna aksen disegarkan (bawaan biru nila #3d5afe; teal, merah, cokelat, arang tetap bisa dipilih), mode gelap diselaraskan.
- Kontras teks diukur (WCAG): warna proyek, aksen-di-atas-lembut, dan cincin prioritas disesuaikan; audit aksesibilitas otomatis (nama, kontras, area ketuk 44px) lulus.
- `50-tema-buku.css`, `60-buku-tulis-lanjutan.css`, `90-buku-besar.css` diganti satu berkas `90-modern.css`; CSS 55 KB -> 50 KB.
- Kinerja daftar besar (content-visibility) tetap: 5000 tugas, "Semua tugas" ~440 ms (sebelum 0.32.0: 1221 ms).

## [0.32.0] - 2026-11-04

### Kinerja (diukur, 5000 tugas, viewport 390x844, Chromium headless tanpa throttle CPU)
- Baris daftar memakai `content-visibility: auto`: baris di luar layar dilewati saat layout/paint. Profil CPU menunjukkan >90% waktu ada di layout/style bawaan browser, bukan JavaScript.
- Indeks turunan dan id dihitung sekali per daftar tugas, bukan sekali per baris (sebelumnya kuadratik); dampak terukur kecil, tetapi menghilangkan pemindaian O(N) per baris.
- Hasil (sebelum -> sesudah): buka "Semua tugas" 1221 -> 372 ms; cari 1780 -> 758 ms; tambah satu tugas 527 -> 388 ms; muat awal 874 -> 583 ms. Pada 2000 tugas: semua tugas 463 -> 153 ms, cari 900 -> 380 ms.
- Piksel tampilan fokus baris identik sebelum/sesudah. Angka diambil di mesin pengembangan, bukan di ponsel; ponsel nyata akan lebih lambat.

## [0.31.0] - 2026-11-04

### Desain "Buku besar"
- Satu motif ornamen: garis kuningan tipis (di bawah judul halaman sebagai aturan ganda tinta + kuningan, di bawah judul dialog, dan di sela judul bagian sampul). Kuningan tidak dipakai sebagai warna teks di atas kertas; di sampul gelap memakai versi terang (kontras > 8:1). Mode gelap punya pasangan sendiri.
- Sampul sidebar lebih pekat (tinta), merek berbingkai kuningan, penanda menu aktif kuningan, kartu progres dan batang riwayat berwarna kuningan.
- Chip di daftar disederhanakan jadi satu bahasa: tanpa kotak/stempel miring; warna hanya untuk keadaan (terlambat, hari ini) dan proyek (titik berwarna).
- Kartu, dialog, laci, dan toast memakai bahan yang sama: kertas, garis tipis, bayangan lembut berlapis; kolom penulisan cepat berbayangan halus; tombol utama punya kedalaman dan respons tekan.
- Tipografi: angka tabular, judul 34px, judul grup 18px, rendering lebih tajam.

## [0.30.1] - 2026-11-04

### CI dan rantai pasokan
- Penandatanganan APK dengan keystore tetap dari GitHub Secret (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`): bila ada, workflow membangun `assembleRelease` dan mencetak sidik jari tanda tangan; bila tidak, tetap membangun debug (non-debuggable) dengan peringatan jelas. `tools/patch_android.js --signing` memasang `signingConfigs` yang membaca env.
- CI memakai `npm ci` bila `package-lock.json` ada (peringatan bila belum). `*.keystore`/`*.jks` masuk `.gitignore`. Panduan lengkap di README.

## [0.30.0] - 2026-11-03

### Keamanan (uji penetrasi mandiri, 6 ronde)
- Penerima widget (exported) tidak lagi menerima siaran `WIDGET_DONE` palsu dari aplikasi lain: uid harus sedang tampil di widget, panjang dibatasi, antrean maks 200, Parcel berbahaya ditangkap.
- APK dari varian debug sekarang `debuggable false` (sebelumnya `adb run-as` bisa membaca seluruh data aplikasi); `webContentsDebuggingEnabled: false`; CI hanya berizin `contents: read`.
- FLAG_SECURE saat PIN aktif: screenshot dan pratinjau "aplikasi terbaru" diblokir (sebelumnya daftar tugas tampak di pratinjau sebelum layar kunci muncul).
- `parseDue` dibatasi 100 karakter (sebelumnya 120 KB teks membuat penguraian kuadratik ~2 dtk); `handle()` tidak lagi melempar galat untuk body non-objek.
- PBKDF2 sinkron dinaikkan 200.000 -> 600.000 putaran (berkas lama tetap terbaca).
- Tes regresi baru: `test/hardening.test.js` (pencemaran prototipe, DoS, batas ukuran, body/rute aneh) dan serangan siaran palsu di tes Java widget.

## [0.29.0] - 2026-11-02

### Struktur
- `todo-core.js` (1.239 baris, satu fungsi besar) dipecah menjadi 11 modul di `src/core/` dengan `require` eksplisit (base, dates, recurrence, validate, quick, ids, sync, store, routes, reminders, history). Tidak ada siklus ketergantungan; lint `no-undef` bersih.
- `src/todo-core.js` tetap menjadi pintu masuk untuk tes (`require('../src/todo-core.js')` tidak berubah). `build.js` menggabungkan modul menjadi satu `www/todo-core.js` dengan pemuat mini, sehingga peramban tetap memuat satu berkas dan CSP tidak berubah.
- Perilaku tidak diubah: 28 ekspor yang sama persis, seluruh tes lulus.

## [0.28.0] - 2026-11-02

### CSS dibersihkan
- 292 deklarasi (dan 59 aturan yang jadi kosong) dibuang karena selalu kalah oleh aturan lain di semua keadaan UI yang diperiksa (8 lebar/tema x 31 keadaan: semua tampilan, laci, lembar, dialog, kunci PIN, keadaan kosong). Ukuran CSS 57,5 KB menjadi 50 KB.
- Pembuktian: 248 screenshot sebelum dan sesudah identik (toleransi 400 piksel untuk derau teks kecil). Aturan hover/fokus/pseudo-elemen, @media yang tidak terjangkau, dan yang tidak cocok dengan elemen mana pun sengaja tidak disentuh.

## [0.27.0] - 2026-11-01

### Struktur
- `app.js` (1.866 baris) dipecah menjadi 17 berkas di `src/app/`, `style.css` menjadi 8 berkas di `src/css/`; `build.js` menggabungkannya berurutan, jadi hasil `www/` tetap satu `app.js` dan satu `style.css` (CSP tidak berubah).
- `mobile.css` dilebur ke `src/css/80-mobile.css`; kolom cadangan kini memakai font aplikasi, bukan monospace.
- Bagian "Struktur kode" ditambahkan ke README.

## [0.26.0] - 2026-11-01

### Lisensi
- Lisensi diganti dari MIT ke **GPL-3.0-or-later** (teks resmi GNU di `LICENSE`). Rilis lama yang sudah dibagikan tetap berlisensi MIT.
- `NOTICE` ditulis ulang: pemberitahuan GPL, ringkasan kewajiban, dan syarat tambahan soal nama/logo.
- Header SPDX di semua berkas kode, `package.json`, README, dan kaki halaman ("GPL-3.0") diperbarui.

## [0.25.1] - 2026-11-01

### Lisensi dan hak cipta
- Berkas `NOTICE` baru: pemberitahuan hak cipta, pembatasan pemakaian nama/logo/ikon untuk karya turunan.
- `THIRD_PARTY_NOTICES.md` baru: daftar font dan pustaka pihak ketiga beserta lisensinya.
- Semua berkas kode kini memuat header hak cipta + `SPDX-License-Identifier: MIT`.
- `LICENSE`, `NOTICE`, dan daftar pihak ketiga ikut dikemas ke APK (`legal/`).
- Kaki halaman memuat baris "© 2026 Muhammad Ikhsan · MIT".

## [0.25.0] - 2026-11-01

### Desain
- Semua dialog (cadangan, pengingat, PIN, tambah massal, dll.) kini modal sungguhan: aplikasi tetap terlihat redup di belakang, kartu dialog lebih lebar di desktop, bisa digulir bila lebih tinggi dari layar, dengan bayangan.
- Jarak antarparagraf di dialog dirapatkan; kolom teks memakai font aplikasi.
- Layar kunci PIN tetap menutup penuh (tidak transparan).

## [0.24.1] - 2026-11-01

### Perbaikan
- Tab filter "Berulang" tidak lagi terpotong di layar HP 360–390px (semua empat tab muat).
- Pemeriksaan ulang: 3 putaran uji acak (monkey) tanpa galat; tidak ada tabrakan nama kelas lain seperti kasus `week`.

## [0.24.0] - 2026-11-01

### Desain
- Garis di bawah judul grup jadi satu garis tipis (bukan garis tebal bertumpuk).
- Hitungan grup berupa angka redup tanpa titik penyambung.
- Garis tebal di atas "Minggu ini" hilang (kelas `week` bentrok dengan kartu Wawasan).
- Kolom teks (tambah massal dll.) memakai font aplikasi, bukan monospace.

## [0.23.0] - 2026-11-01

### Desain (kerapian)
- Kepala hari di strip kalender tidak lagi HURUF BESAR berjarak lebar.
- Judul dialog tidak lagi menampilkan kotak fokus saat dialog dibuka (hanya elemen yang bisa diketuk yang berbingkai fokus).
- Keadaan kosong (mis. Sampah) rata kiri dengan garis margin, bukan ikon + teks di tengah.
- Kaki halaman (versi, pengembang, donasi) lebih tenang: rata kiri, tautan donasi berupa tautan biasa, bukan tombol pil.

### Perbaikan
- Pratinjau tambah-massal tidak lagi menimpa pesan kesalahan/konfirmasi templat (penyebab tes e2e templat kadang gagal).

## [0.22.1] - 2026-11-01

### Desain
- **Huruf judul** diganti dari Caladea (padanan Cambria bawaan Office) ke *Tuntas Serif*, turunan Latin Modern Roman Demi (huruf buku teks TeX/akademik),
  di-subset dan diganti namanya sesuai GUST Font License. Berkas Caladea dihapus.
- **Filter di HP**: tab bergulir sendiri dan urutan tetap terlihat (ikon di kanan), tidak lagi terpotong.

## [0.22.0] - 2026-11-01

### Desain (kurangi tampilan "template")
- Prinsip: kertas dan tinta, bukan kotak di mana-mana. Satu hal yang menonjol: daftar bergaris dengan margin merah dan cap *Terlambat*; sisanya tenang.
- **Layar selamat datang**: tanpa ikon tengah dan tanpa kartu bernomor 1-2-3 (isinya bukan urutan); rata kiri seperti halaman pertama buku.
- **Wawasan**: empat kotak angka diganti buku besar dengan titik-titik penuntun; batang mingguan berarsir seperti goresan tinta;
  kalender hari tuntas memakai cap hijau miring (hari tuntas), garis putus-putus (ada sisa), dan garis bawah (kosong); sejajar dengan kepala hari.
- **Filter** (Semua / Prioritas tinggi / Ber-jam / Berulang) menjadi tab indeks buku yang duduk di garis, bukan deretan tombol bulat.
- **Chip di baris**: tag, ulangan, dan catatan jadi teks tinta tanpa kotak; "Hari ini" bergaya stabilo; hanya "Terlambat" yang tetap berbingkai (cap).
- Sidebar: gambaran 7 hari menjadi goresan tally tipis, bukan tujuh petak putih.
- Dibersihkan: deklarasi `@font-face` "Lora" yang menunjuk ke berkas yang tidak ada.

## [0.21.0] - 2026-11-01

### Keamanan
- **Kunci aplikasi (PIN)**, opsional (menu samping > Kunci aplikasi): PIN 4–8 angka disimpan sebagai hash PBKDF2-SHA256 (garam acak, 150.000
  putaran), terkunci saat dibuka dan saat ditinggalkan lebih dari batas pilihan (segera / 30 detik / 1 / 5 menit). Salah PIN 5 kali memicu jeda
  yang makin lama. Dialog lain (mis. teks Bagikan, ketukan notifikasi) tidak bisa melewati layar kunci. Lupa PIN: hapus data lokal lalu pulihkan
  dari cadangan/sinkron. **Penting:** ini mengunci tampilan saja; data di perangkat tidak dienkripsi.
- **Pengaman data rusak**: bila data tugas tak terbaca, aplikasi tidak lagi diam-diam mulai kosong lalu menimpanya. Salinan mentah disimpan
  (yang pertama tidak ditimpa), spanduk menawarkan *Pulihkan dari snapshot*, *Bagikan salinan*, atau *Buang salinan*.
- Manifest Android: `usesCleartextTraffic="false"` eksplisit.
- Catatan terang di pengaturan sinkron: token dan kata sandi disimpan tanpa enkripsi tambahan dan bisa ikut cadangan otomatis Google.

### Diperbaiki
- Dialog yang dibuka saat ada dialog "teratas" tidak lagi otomatis dianggap aktif (dasar bagi layar kunci).

## [0.20.0] - 2026-11-01

### Diperbaiki / dipoles
- Dialog **Pengingat** ditata ulang: baris sakelar untuk ringkasan malam (area ketuk besar, penjelasan di bawah judulnya), pilihan jam diberi label
  "Kirim pukul" dan dikunci saat ringkasan dimatikan.
- Panel tugas: pilihan **Pengingat** kini disertai petunjuk untuk tugas tanpa jam, dan ikut berubah saat tanggal/jam diubah.
- Jarak ikon-teks pada tombol (mis. Duplikat) yang sebelumnya menempel.
- Pengaturan pengingat yang tiba lewat sinkron langsung memperbarui dialog dan panel yang sedang terbuka.

## [0.19.2] - 2026-11-01

### Diperbaiki
- **Centang di widget kini membatalkan pengingat tugas itu** tanpa menunggu aplikasi dibuka: notifikasi terkirim (id 2n, 2n+1) dihapus dan alarm
  terjadwalnya dibatalkan dari sisi native. Daftar widget kini membawa id tugas (`i`). Alarm dibatalkan lewat refleksi ke penerima milik plugin
  LocalNotifications (`TimedNotificationPublisher`); bila namanya berbeda di versi plugin yang terpasang, langkah ini dilewati tanpa galat dan
  perilaku lama berlaku (aplikasi membatalkan semuanya saat dibuka). Ringkasan malam/pagi tetap baru diperbarui saat aplikasi dibuka.

## [0.19.1] - 2026-10-31

### Diperbaiki
- **Slot notifikasi**: jadwal dibatasi 60, dan sebelumnya pengingat tugas bisa menggeser ringkasan (atau sebaliknya). Kini ringkasan pagi dan
  malam dijatah dulu (hingga 20 yang terdekat), lalu pengingat tugas terdekat mengisi sisanya.
- **Notifikasi basi di bilah notifikasi**: pengingat yang sudah terkirim dibersihkan otomatis saat tugasnya selesai atau dihapus, dan ringkasan
  malam/pagi dihapus saat tidak ada lagi tugas tersisa. Dijalankan setiap kali jadwal diperbarui (saat data berubah atau aplikasi dibuka).

## [0.19.0] - 2026-10-31

### Ditambahkan
- **Pengulangan lebih lengkap**: *Hari kerja* (Sen–Jum), *Hari tertentu…* (pilih hari, mis. Senin dan Kamis), dan *Setiap 2 minggu*.
  Tersedia di panel tugas, lembar tambah, dan chip tambah cepat. Teks bebas juga dikenali (`*senin,kamis`, `*hari kerja`).
  Aturan baru memakai bentuk `wd` dan `dow:1,4`; versi aplikasi lama menolak berkas sinkron yang memuatnya.
- **Riwayat hari tuntas** di Wawasan: kalender 5 minggu dan rekor beruntun. Streak tidak lagi terbatas 7 hari. Hari tuntas = ada tugas
  selesai dan tidak ada tugas dengan deadline hari itu yang tertinggal. Dihitung dari data yang ada, format data tidak berubah.
- **Menu Bagikan Android**: bagikan teks dari WhatsApp/browser ke Tuntas Harian; teks (satu atau banyak baris) membuka lembar
  "Tambah banyak" dengan pratinjau. Memerlukan build APK baru (perubahan manifest + MainActivity).
- **Pengaturan pengingat ikut sinkron** (berkas sinkron dan Gist): bidang opsional `settings`, yang lebih baru menang, pengaturan per
  tugas dikaitkan lewat uid. Versi lama mengabaikan bidang ini. Berkas tanpa pengaturan tetap persis seperti sebelumnya.

### Diubah
- Pengaturan pengingat per tugas kini disimpan per uid (kunci lama berbasis id dimigrasikan otomatis).

## [0.18.0] - 2026-10-31

### Dibersihkan
- Kode tak terpakai dihapus: tabel `UNIT_NAMES`, dua aturan CSS untuk kelas yang tak pernah dipakai (`.chip.prio1`, `.muted` di kartu samping), dan variabel tak terpakai di tes.

### Ditambahkan
- **Ringkasan malam**: notifikasi (bawaan pukul 20:00) berisi tugas yang belum tuntas, dengan tombol **Pindah ke besok**. Dilewati bila tidak ada
  yang tersisa. Bisa dimatikan atau diganti jamnya di menu samping > **Pengingat**.
- Tombol **Pindah sisa ke besok** di kartu Hari ini (memindahkan tugas utama yang belum selesai, hari ini dan terlambat; ada Urungkan).
- **Pengingat per tugas**: di panel detail, pilih Tanpa pengingat / Tepat waktu saja / 5, 15, 30 menit / 1 jam / 1 hari sebelumnya, atau ikut
  bawaan. Pengingat bawaan diatur di dialog Pengingat. Tugas tanpa jam dengan "1 hari sebelumnya" berbunyi pukul 08:00 sehari sebelumnya.
- Judul notifikasi pengingat kini ikut bahasa yang dipilih.

## [0.17.0] - 2026-10-31

### Diperbaiki
- **Tombol kembali Android** sebelumnya langsung menutup aplikasi. Kini menutup lapisan teratas (dialog, panel, menu, mode pilih, pencarian),
  lalu kembali ke Hari ini dari layar atau filter mana pun, dan baru keluar dari aplikasi di Hari ini. Memakai plugin `@capacitor/app`
  (ditambahkan ke dependensi; CI memasangnya lewat `npm install` dan `cap sync`).
- **Izin notifikasi ditolak** sebelumnya diam-diam (pengingat tidak berbunyi tanpa penjelasan). Kini muncul spanduk petunjuk bila ada tugas
  berjam; bisa ditutup, dan hilang sendiri setelah izin diberikan.
- Pencarian ditunda 120 md agar mengetik tetap lancar pada data besar.

### Diperiksa
- Performa dengan 2.000 tugas di Chromium: muat awal 0,9 dtk, tambah tugas 0,4 dtk, Semua tugas 1,0 dtk. Layak untuk pemakaian pribadi;
  di HP lambat bisa 3-5 kali lebih lama.
- Ganti hari saat aplikasi terbuka sudah tertangani oleh penyegaran berkala; kegagalan penyimpanan penuh sudah menampilkan pesan.

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
