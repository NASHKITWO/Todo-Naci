# Pemberitahuan pihak ketiga

Tuntas Harian memuat atau dibangun di atas komponen berikut. Setiap komponen tetap berada
di bawah lisensinya sendiri. Teks lisensi lengkap ada di repositori masing-masing dan di paket npm
yang diunduh saat build.

Semua komponen di bawah ini kompatibel dengan GPL-3.0 (MIT, Apache-2.0 versi 2.0, OFL 1.1, dan GUST). Kompatibilitas dinilai dari ketentuan umum lisensi-lisensi itu, bukan nasihat hukum.

## Disertakan dalam aplikasi

| Komponen | Lisensi | Keterangan |
|---|---|---|
| Inter (font teks dan judul) | SIL Open Font License 1.1 | © 2016 The Inter Project Authors (https://github.com/rsms/inter). Subset Latin, glyph tidak diubah. |
| Bricolage Grotesque (font judul dan angka besar) | SIL Open Font License 1.1 | Copyright 2022 The Bricolage Grotesque Project Authors (https://github.com/ateliertriay/bricolage). Subset Latin, glyph tidak diubah. |
| @capacitor/core, /android, /app, /filesystem, /local-notifications, /share | MIT | © Ionic. Dipakai sebagai kerangka aplikasi Android. |
| AndroidX dan pustaka Android Gradle yang ditarik Capacitor | Apache License 2.0 | Ditarik otomatis saat build APK. |

Teks lisensi font: OFL 1.1 di https://openfontlicense.org/ ; GUST di http://tug.org/fonts/licenses/GUST-FONT-LICENSE.txt .
Font tidak dijual terpisah dan nama aslinya tidak dipakai untuk versi yang dimodifikasi.

## Hanya untuk pengembangan (tidak dikirim di APK)

| Komponen | Lisensi |
|---|---|
| Playwright | Apache License 2.0 |
| @capacitor/cli | MIT |

Daftar ini disusun dari dependensi yang dideklarasikan di `package.json` dan berkas font di `src/fonts/`.
Periksa ulang jika dependensi ditambah, dan jalankan alat pemindai lisensi (mis. `npx license-checker`) sebelum rilis publik.
