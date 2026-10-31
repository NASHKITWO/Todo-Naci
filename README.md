# Tuntas Harian (Android)

Aplikasi to-do Android mandiri: **data tersimpan di HP**, tanpa server dan tanpa akun. Ada prioritas, deadline dengan jam,
subtugas, tugas berulang, notifikasi tepat waktu, widget layar utama, cadangan otomatis, dan sinkron antar HP.

## Mendapatkan APK (tanpa memasang apa pun)

APK dibuat otomatis oleh GitHub.

1. Di repo ini buka tab **Actions** > **android** > **Run workflow**.
2. Tunggu 5 sampai 10 menit sampai ada tanda centang hijau.
3. Buka hasil run itu, gulir ke **Artifacts**, unduh **todo-apk** (berkas zip berisi `app-debug.apk`).
4. Kirim ke HP (kabel, Drive, atau Telegram ke diri sendiri), buka dari aplikasi **File**, izinkan *Pasang dari sumber ini*.
   Bila ada peringatan Play Protect, pilih **Tetap instal** (APK ini bertanda kunci debug, bukan dari Play Store).

## Fitur

- **Tambah tugas tanpa simbol**: ketik judul biasa, lalu ketuk tombol pilihan di bawah kolom: tanggal (Hari ini, Besok, Akhir pekan, Minggu depan), jam (Pagi, Siang, Sore, Malam), prioritas, ulangi (Harian, Mingguan, Bulanan), dan proyekmu. "Lainnya…" membuka lembar lengkap (tag, tanggal bebas, catatan).
- **Bagikan daftar**: kirim daftar yang sedang tampil sebagai teks ke WhatsApp atau aplikasi lain (menu samping > Bagikan daftar).
- **Kelola**: "Pindah ke hari ini" untuk semua tugas terlambat (bisa diurungkan) dan "Ubah nama proyek" di tampilan proyek.
- **Tampilan**: Hari ini (sapaan + cincin progres), Mendatang, **Kalender** mingguan, Semua tugas, Selesai, **Wawasan**.
- **Filter dan urutan**, subtugas inline, pilih banyak (tekan lama), geser (kanan = selesai, kiri = tunda), tunda cepat.
- **Notifikasi lokal**: tepat waktu, 30 menit sebelumnya, dan ringkasan harian 08:00, dengan tombol aksi **Selesai** dan **Tunda 1 jam**.
- **Sampah 30 hari + Urungkan**: hapus tidak lagi menanyakan konfirmasi; tombol *Urungkan* muncul di toast, dan tugas bisa dipulihkan dari tampilan Sampah.
- **Tempel banyak baris dan templat**: tempel daftar dari catatan/chat (satu tugas per baris, butir dan baris menjorok = subtugas), atau simpan sebagai templat.
- **Dua bahasa**: Indonesia (bawaan) dan English, ganti dari menu samping.
- **Widget layar utama**: tugas terlambat dan hari ini (maks. 5). Centang lingkaran untuk menyelesaikan, tombol **+** untuk tambah cepat, mengikuti tema terang/gelap sistem.
- **Cadangan otomatis**: salinan harian (7 terakhir) di dalam aplikasi, berkas `Dokumen/Todo/todo-cadangan.json`, dan cadangan Google.
- **Sinkron antar perangkat**: lewat berkas (Drive/Dropbox) atau **otomatis lewat GitHub Gist** (opsional).
- Tema terang/gelap, lima warna aksen, pintasan keyboard saat dipakai di browser (`n` `/` `j` `k` `x` `e` `v`).

## Agar pengingat tepat waktu

- Izinkan notifikasi: **Setelan > Aplikasi > Tuntas Harian > Notifikasi**.
- Bila terlambat: **Setelan > Aplikasi > Tuntas Harian > Baterai > Tanpa pembatasan**. Xiaomi, Oppo, Vivo, dan Samsung sering mematikan
  aplikasi di latar belakang; matikan penghematan baterai untuk Todo.

## Widget layar utama

Tekan lama layar utama > **Widget** > **Tuntas Harian**. Daftar mengikuti isi aplikasi; bila aplikasi lama tidak dibuka, widget tetap
menyaring menurut tanggal hari ini.

- Lingkaran di kiri baris menandai tugas selesai: barisnya langsung hilang dari widget, dan tugasnya benar-benar diselesaikan
  saat aplikasi dibuka berikutnya (pengingat tugas itu bisa masih berbunyi sebelum aplikasi dibuka).
- Tombol **+** membuka aplikasi dengan kolom tambah tugas terfokus (keyboard layar mungkin perlu diketuk sekali). (Bila build gagal di bagian widget, jalankan workflow dengan opsi **widget** dimatikan.)

## Cadangan data

Ada tiga lapis, dari yang paling dekat:

1. **Salinan harian di dalam aplikasi** (7 terakhir): *Cadangan & sinkron > Cadangan otomatis di perangkat > Pulihkan*.
   Memulihkan membuat daftar persis seperti salinan itu; kondisi sebelumnya disimpan dulu sebagai salinan "sebelum pemulihan".
2. **Berkas `Dokumen/Todo/todo-cadangan.json`** (Android): ikut bertahan bila aplikasi dihapus. Setelah pasang ulang, pakai
   *Gabungkan dari berkas…* dan pilih berkas itu.
3. **Cadangan otomatis Google** (Setelan HP > Google > Cadangan): memulihkan data aplikasi saat ganti HP.

Tetap simpan cadangan manual (**Bagikan cadangan**) sebelum menghapus aplikasi atau mereset HP.

## Sinkron antar perangkat

**Lewat berkas** (tanpa akun): *Kirim berkas sinkron* (simpan ke Drive) dan *Gabungkan dari berkas…* di perangkat lain.

**Otomatis lewat GitHub Gist** (opsional): buat token klasik di GitHub (Settings > Developer settings > Personal access tokens >
Tokens (classic)) dengan izin **gist** saja, lalu di *Sinkron otomatis* isi token dan **kata sandi sinkron** (minimal 8 karakter).
Di HP lain isi token dan kata sandi yang sama; gist ditemukan otomatis. Sinkron berjalan saat aplikasi dibuka, setelah tugas
berubah, dan tiap 5 menit selama aplikasi terbuka.

- **Terenkripsi**: isi tugas dienkripsi di HP (AES-GCM, kunci PBKDF2 dari kata sandi) sebelum dikirim, jadi tidak terbaca di GitHub
  walau alamat gist bocor. Nama berkas, ukuran, dan waktu ubah tetap terlihat. **Lupa kata sandi = isi gist tidak bisa dibuka**
  (data di HP aman); pakai *Atur ulang gist*, lalu aktifkan lagi dengan kata sandi baru di tiap HP.
- **Tidak saling menimpa**: tiap HP hanya menulis berkasnya sendiri (`todo-sync-<id>.json`) dan membaca berkas semua HP.
- Token dan kata sandi disimpan di penyimpanan privat aplikasi (tanpa enkripsi tambahan di HP) dan ikut cadangan Google bila
  aktif. Gunakan token dengan izin `gist` saja dan cabut di GitHub bila HP hilang.
- Tanpa internet, sinkron berhenti dan data lokal tidak berubah.

Aturan penggabungan: versi tugas yang lebih baru menang, penghapusan menyebar, subtugas ikut induknya.

- Mulailah dari satu HP, lalu sinkronkan HP yang masih kosong (dua perangkat yang sudah berisi data sama akan menggandakan tugas).
- Jam semua perangkat harus benar, karena "yang terbaru menang".
- Tugas berulang yang diselesaikan di dua perangkat sebelum sempat sinkron menghasilkan tugas berikutnya yang sama (tidak ganda).

## Aksesibilitas

Dialog (detail tugas, cadangan & sinkron, menu) memakai peran dialog, latar `inert`, fokus pindah masuk dan kembali, Tab terjebak
di dalam, dan Esc menutup. Teks memenuhi kontras WCAG AA di tema terang/gelap, area ketuk di ponsel ≥44 px, dan animasi mati
bila "kurangi gerakan" aktif. Diperiksa dengan audit otomatis buatan sendiri; **belum diuji dengan TalkBack**.

## Bahasa

Antarmuka tersedia dalam Indonesia (bawaan) dan English; pilih dari menu samping (aplikasi dimuat ulang). Teks sumber berbahasa
Indonesia dipakai sebagai kunci di `T('…')`; kamus Inggris ada di `src/i18n-en.js`. Teks yang belum diterjemahkan tampil dalam
bahasa Indonesia, dan tes memindai semua layar mode Inggris untuk mencarinya. Keterbatasan: kata bagian hari pada penulisan cepat
(`pagi`, `sore`, …) hanya bahasa Indonesia, dan sebagian pesan galat internal yang tidak mungkin muncul dari antarmuka tidak diterjemahkan.
Menambah bahasa: tambah kamus baru di `DICT` dan nama bahasanya di `LANGS` (`src/i18n.js`).

## Dukung pengembang

Aplikasi ini gratis. Bila bermanfaat, donasi lewat [sociabuzz.com/nacitwo/tribe](https://sociabuzz.com/nacitwo/tribe)
(juga tersedia di bagian bawah daftar tugas di aplikasi).

## Pengembangan

Node 20+ saja; tanpa Python.

```bash
npm install
npm test                 # logika (dikunci ke hasil acuan), sinkron, alat build, widget Java (butuh javac; dilewati bila tak ada)
npx playwright install chromium && npm run test:e2e   # tes UI di browser
node build.js            # menyusun www/ dari src/
# membangun APK sendiri (butuh JDK 17 + Android SDK) mengikuti .github/workflows/android.yml
```

Struktur: `src/` (antarmuka + `todo-core.js` logika + `local-api.js` penghubung Capacitor, `autosync.js` sinkron Gist, `i18n*.js` terjemahan), `tools/` (ikon, splash, widget, patch Android),
`test/` (unit + `golden/` hasil acuan + `e2e/`).

**Belum teruji di perangkat nyata:** pembangunan APK, notifikasi native Android, widget (kode Java-nya hanya diperiksa
dengan kompilator terhadap kelas tiruan), penulisan ke folder Dokumen, cadangan Google, berbagi berkas ke Drive, sinkron Gist
ke GitHub sungguhan, dan gestur sentuh sungguhan. Semuanya baru diuji lewat tiruan di browser.

## Tentang

Pendiri dan pengembang: **Muhammad Ikhsan**, Teknik Informatika, Universitas Pamulang
([ican3192@gmail.com](mailto:ican3192@gmail.com)).

Lisensi: MIT.
