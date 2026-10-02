# GPS Map Camera — Overlay Generator

Aplikasi web 100% client-side (tanpa backend, tanpa server, tanpa Node/PHP/Python saat runtime) untuk menghasilkan overlay PNG transparan bergaya **GPS Map Camera**, dibuat dari file CSV berisi data geotag.

> Semua elemen visual (kotak info, badge logo, tipografi) digambar ulang menggunakan **HTML Canvas API** — bukan screenshot atau crop dari aplikasi manapun. Thumbnail peta (opsional) diambil dari tile server publik gratis Esri secara real-time saat generate.

---

## Cara Menjalankan

1. Buka `index.html` langsung di browser (Chrome/Edge/Firefox terbaru), **atau**
2. Jalankan lewat local server sederhana agar drag-drop lebih stabil di beberapa browser:
   ```bash
   npx serve .
   # atau
   python3 -m http.server 8080
   ```
3. Library inti (PapaParse, JSZip, FileSaver) sudah ada di folder `libs/` — tidak perlu internet untuk fungsi dasar.
4. **Jika memilih mode peta "Jalan" atau "Satelit"**, aplikasi butuh koneksi internet untuk mengambil gambar peta dari server publik saat proses generate (lihat bagian "Peta Otomatis" di bawah).

---

## Alur Penggunaan

1. **Isi data foto** — dua cara, bisa dipakai gantian atau digabung:
   - **Upload CSV** — drag & drop atau klik untuk memilih file. Belum punya CSV? Klik **"Download Contoh CSV"** yang tersedia di banner panduan (atas halaman) maupun di dalam card Data Foto, isi datamu mengikuti format itu, lalu upload.
   - **Input Manual (satu-satu)** — pilih mode ini kalau cuma mau tes cepat 1–5 foto tanpa bikin file CSV dulu. Isi form (Nama File, Latitude, Longitude, Tanggal, Waktu, Lokasi, Alamat, plus field opsional untuk Template 2), klik **"+ Tambah Baris"**, ulangi untuk foto berikutnya. Baris manual ikut ditambahkan ke baris yang sudah ada dari CSV (kalau ada) — dua-duanya bisa digabung.
   - **Dari Folder Foto (otomatis)** — pilih folder (atau beberapa foto) langsung, tanpa CSV. Tiap foto otomatis jadi satu baris: nama file, tanggal & jam (dari EXIF; kalau tidak ada, dari tanggal file), koordinat GPS (kalau fotonya punya). Untuk foto tanpa GPS (umum untuk kamera di area terbatas), isi Latitude/Longitude sekali lalu klik **"Terapkan ke foto tanpa GPS"**, atau geser pin per foto di peta. Lokasi & alamat dideteksi otomatis dari koordinat. Foto-fotonya langsung terhubung ke menu Tempel ke Foto, dan **preview di kanan menampilkan watermark di atas foto aslinya** — jadi ukuran, posisi, font, dll bisa dipaskan sambil dilihat hasil akhirnya. Setelah pas, klik **"Lanjut: Tempel ke Foto & Download"** di kartu Generate.
   - Setelah data masuk (dari cara manapun), cek tabel **Preview Data** yang muncul di bawahnya — semua baris ditampilkan lengkap dengan tombol hapus per baris, dan klik satu baris untuk langsung melihat preview overlay-nya di panel kanan. Ini supaya kamu bisa pastikan data yang dimasukkan sudah benar sebelum generate massal.
2. **(Opsional) Upload logo** — Mode A pakai logo bawaan (embedded), Mode B upload PNG sendiri.
3. **Atur pengaturan overlay** — resolusi, format tanggal, posisi, opacity, warna & ukuran font, sumber peta, dll.
4. **Preview** — cek tampilan overlay per baris sebelum generate massal.
5. **Generate & Download ZIP** — semua PNG dibuat secara batch/asynchronous lalu otomatis di-download sebagai satu file ZIP.

> **Penting:** Data (CSV maupun input manual), logo, dan semua pengaturan overlay yang kamu atur di menu **Watermark GPS** dipakai bersama oleh **Tempel ke Foto** dan **Geotag Metadata** — tidak perlu mengisi ulang di tab lain. Urutan ini (dan alasan tool ini dibuat) juga dijelaskan di banner panduan yang muncul otomatis di bagian atas halaman saat pertama kali dibuka (bisa dibuka/tutup lewat baris "Panduan Cara Pakai" di atas tab).

---

## Peta Otomatis (Baru)

Overlay bisa menampilkan thumbnail peta **asli** (bukan hanya placeholder abstrak), dengan 3 pilihan sumber:

| Mode | Sumber | Butuh Internet? | Keterangan |
|---|---|---|---|
| **Offline** | Placeholder digambar via Canvas | Tidak | Cepat, tanpa batas, tidak menunjukkan lokasi asli |
| **Jalan** | Esri World Street Map | Ya | Peta jalan, gratis, tanpa API key |
| **Satelit** | Esri World Imagery | Ya | Citra satelit, gratis, tanpa API key |

> **Catatan teknis:** kedua mode peta memakai infrastruktur tile gratis Esri (`server.arcgisonline.com`), bukan server OpenStreetMap langsung (`tile.openstreetmap.org`). Ini disengaja — kebijakan resmi OpenStreetMap secara eksplisit melarang pola "bulk download"/"offline use", yaitu persis apa yang terjadi saat men-generate peta untuk ratusan/ribuan foto sekaligus, dan permintaan semacam itu akan otomatis diblokir dengan pesan "403 Access blocked". Layanan tile Esri yang dipakai di sini tidak membawa pembatasan tersebut untuk pemakaian non-komersial seperti ini.

**Pin lokasi merah** otomatis digambar di titik tengah peta (bisa dimatikan lewat toggle "Tampilkan pin lokasi").

**Ketahanan terhadap gangguan jaringan:** setiap pengambilan tile peta punya batas waktu (timeout) sekitar 7 detik per titik. Jika gagal/lambat, baris tersebut otomatis memakai placeholder dan proses generate **tetap lanjut** — tidak akan macet/stuck menunggu satu titik yang bermasalah. Di akhir proses, aplikasi melaporkan berapa baris yang terpaksa memakai placeholder.

**Domain yang perlu diizinkan** (jika berada di jaringan kantor/firewall korporat, seperti Pertamina):
- `server.arcgisonline.com` — untuk mode Jalan dan Satelit (kedua mode memakai domain yang sama)

**Kecepatan:** karena setiap titik mengambil beberapa tile gambar dari internet, mode Jalan/Satelit jauh lebih lambat daripada mode Offline — untuk CSV ribuan baris, pertimbangkan menjalankannya bertahap atau memakai mode Offline untuk draft cepat, lalu Jalan/Satelit untuk hasil final.

**Atribusi:** sesuai kebijakan penyedia tile, aplikasi menampilkan teks atribusi otomatis di bagian bawah halaman saat mode peta non-offline aktif.

---

## Format CSV

Header kolom **fleksibel** — nama boleh Bahasa Indonesia atau Inggris, dengan/tanpa spasi atau underscore. Kolom yang dikenali otomatis:

| Field internal | Alias header yang dikenali |
|---|---|
| Nama file | `Nama File`, `nama_file`, `filename`, `file` |
| Latitude | `Latitude`, `lat` |
| Longitude | `Longitude`, `lng`, `long`, `lon` |
| Tanggal | `Tanggal`, `date` |
| Waktu | `Waktu`, `time`, `jam` |
| Lokasi | `Lokasi`, `location`, `project` |
| Alamat | `Alamat`, `address` |
| Kota | `Kota`, `city` (opsional — jika tidak ada, memakai kolom Lokasi) |

Contoh:
```csv
Nama File,Latitude,Longitude,Tanggal,Waktu,Lokasi
IMG_1001,-6.208763,106.845599,13/08/2025,10:32 AM,"Jl Sudirman No.12 Jakarta"
```

Format tanggal yang didukung: `DD/MM/YYYY`, `YYYY-MM-DD`. Format waktu: `HH:MM` (24 jam) atau `H:MM AM/PM`.

Nama file output mengikuti kolom Nama File pada CSV (contoh: `IMG_1001` → `IMG_1001.png`). Jika ada nama file duplikat, otomatis diberi suffix `_1`, `_2`, dst agar tidak saling menimpa dalam ZIP.

---

## Struktur Folder

```
index.html
css/
  style.css
js/
  dms.js        -> konversi Decimal Degrees <-> DMS (N/S/E/W)
  maptile.js    -> fetch tile peta asli (Esri) + cache, fallback ke zoom lebih rendah kalau tile tidak ada
  countries.js  -> tabel kode negara -> nama Indonesia + kode bendera (Template 2)
  geocode.js    -> reverse-geocoding (Esri) + fetch bendera negara (Template 2)
  openmeteo.js  -> ketinggian & cuaca historis (Open-Meteo, gratis tanpa API key)
  render.js     -> mesin render Canvas (dispatcher Template 1/2: kotak overlay, badge, teks, komposisi peta)
  csv.js        -> parsing CSV + auto-deteksi kolom
  settings.js   -> LocalStorage + export/import preset JSON
  main.js       -> controller UI, preview, batching & ZIP generation
  mapview.js    -> peta interaktif (Leaflet) + kalender tanggal import di menu Watermark GPS
  csvbuilder.js -> menu Buat CSV dari Foto, tool ekstraksi nama file/tanggal/GPS dari foto (berdiri sendiri)
  heicsupport.js -> konversi foto HEIC/HEIF (iPhone) -> JPEG, dipakai menu Watermark GPS (preview di foto), menu Tempel ke Foto & Geotag Metadata
  photometa.js  -> baca tanggal/jam + GPS + arah kamera dari EXIF foto (menu Watermark GPS "Dari Folder Foto" & menu Buat CSV dari Foto)
  photostore.js -> daftar foto bersama: folder yang dipilih di menu Watermark GPS, Tempel ke Foto & Buat CSV dari Foto langsung terpakai di semua tab
libs/
  papaparse.min.js
  jszip.min.js
  FileSaver.min.js
  piexif.min.js
  leaflet/leaflet.js, leaflet.css, images/  -> peta interaktif di menu Watermark GPS (MIT license)
  libheif/libheif-bundle.js -> decoder HEIC/HEIF resmi libheif berbasis WASM (LGPL-3.0, lihat "Dukungan Format HEIC/HEIF")
  fonts/inter/  -> font Inter (SIL OFL 1.1) — default Template 2, paling mirip SF Pro (font iPhone)
  fonts/roboto/ -> font Roboto (SIL OFL 1.1) — opsi font Android untuk Template 2
assets/
  logo-default.png     -> logo bawaan (Mode A)
  badge-icon.png       -> ikon aplikasi untuk badge Template 2 (ikon + teks "GPS Map Camera")
  map-label-google.png -> logo "Google" (transparan) untuk pojok peta
  placeholder-map.png  -> aset cadangan (peta placeholder utamanya digambar via Canvas)
README.md
```

---

## Preset Template Watermark

menu Watermark GPS punya pilihan **Preset Template** di bagian atas kartu "Pengaturan Overlay", supaya beberapa gaya watermark bisa dipakai tanpa saling menimpa pengaturan satu sama lain. Menambah Template 3 dan seterusnya di masa depan tidak akan mengubah Template 1/2 yang sudah ada.

### Template 1 — Klasik
Gaya asli tool ini: kartu mengambang dengan sudut membulat, peta kotak terpisah di kiri, badge logo menempel di pojok kanan-atas kotak teks, baris koordinat format DMS (`6° 12' 31.55" S`). Sama seperti Template 2, judul kota juga menampilkan bendera negara kalau "Deteksi Otomatis dari Koordinat" aktif.

### Template 2 — GPS Map Camera (persis aplikasi asli)
Rekonstruksi (digambar ulang lewat Canvas, bukan crop dari aplikasi manapun) dari watermark aplikasi GPS Map Camera, **dikalibrasi per piksel terhadap foto asli dari aplikasinya**: semua ukuran (margin, tinggi badge, ukuran peta, padding, sudut, ukuran font, jarak baris) diukur dari foto asli 1500×2000 lalu diskalakan mengikuti lebar foto — jadi di foto ukuran berapa pun posisinya sama seperti buatan aplikasi. Hasil verifikasi terhadap foto contoh: semua baris teks jatuh di posisi yang sama (selisih ≤1 px), dan pemotongan baris alamat terjadi di kata yang sama persis.
- **Font Watermark**: **"Seperti foto dari iPhone"** (default) memakai Inter — font gratis yang paling mirip SF Pro, font iPhone; cocok dengan foto asli tanpa koreksi spasi apa pun. **"Seperti foto dari Android"** memakai Roboto. Keduanya dibundel lokal (`libs/fonts/`).
- Judul `Kota, Provinsi, Negara` (tidak tebal, hingga 3 baris) + **bendera berkibar** di ujung judul, bentuknya seperti emoji bendera iPhone. Bendera Indonesia digambar sendiri, jadi selalu muncul walau internet/geocoding mati, asal koordinat/teks lokasinya di Indonesia.
- Alamat lengkap (hingga 4 baris) — dipotong per baris dengan cara yang sama seperti Android (baris dibuat serata mungkin, bukan sekadar "isi penuh lalu pindah baris").
- Koordinat: `Lat -0.855322° Long 117.265612°`
- Tanggal: `Kamis, 24/09/2026 03:24 PM GMT +08:00`
- Badge: ikon aplikasi + teks "GPS Map Camera", menempel di pojok kanan-atas kotak teks. Kotak hitam transparan ±63%.
- Peta: kotak di kiri setinggi kotak teks, pin merah gaya Google Maps, opsional **kerucut arah kamera biru** (memudar di ujung luarnya) dan **logo "Google"** di pojok peta (gambar logo asli, background-nya transparan; kalau teks label diganti selain "Google", digambar sebagai teks).
- **Note**, **Kontak**, dan **Info geografis** (suhu/angin/ketinggian/arah, ikon berwarna) tetap tersedia sebagai baris opsional — hanya muncul kalau ada isinya.

Tombol **"Samakan Persis dengan Contoh GPS Map Camera"** (paling atas di Pengaturan Overlay) mengatur semuanya sekali klik ke nilai yang diukur dari foto asli; setelah itu semua tetap bisa diubah.

Pengaturan khusus Template 2 (muncul otomatis saat template ini dipilih):
- **Zona Waktu (GMT Offset)** — dropdown WIB/WITA/WIT plus offset umum lainnya, ditulis di baris tanggal.
- **Bahasa Nama Hari** — English (Thursday) atau Indonesia (Kamis).
- **Format Koordinat** — `Lat -0.855322° Long 117.265612°` (seperti aplikasi, default), tanpa simbol derajat, atau `0.855322 LS 117.265612 BT`.
- **Format Jam** — `03:24 PM` (seperti aplikasi, default), `3:24 PM`, atau `15:24`; plus toggle **Tampilkan jam di baris tanggal** (default aktif).
- **Ukuran Font** mengubah ukuran teks; tinggi kotak teks (dan peta) ikut menyesuaikan isi, seperti di aplikasi.
- **Deteksi otomatis lokasi & alamat dari koordinat (reverse geocoding)** — aktif secara default. Saat aktif, judul (kota/provinsi/negara + bendera) dan baris alamat **otomatis dihitung dari Latitude/Longitude tiap baris**, tidak perlu mengisi kolom Lokasi/Alamat di CSV secara manual. Prosesnya:
  - Menggunakan layanan reverse-geocoding gratis & tanpa API key dari Esri (`geocode.arcgis.com`) — vendor yang sama dengan yang sudah dipakai untuk tile peta, dipilih dengan alasan yang sama: layanan geocoding OpenStreetMap (Nominatim) secara eksplisit melarang pemakaian otomatis/massal tanpa izin, sedangkan endpoint anonim Esri tidak membawa pembatasan itu untuk pemakaian ringan seperti ini.
  - Bendera negara diambil dari `flagcdn.com` (gratis, tanpa API key).
  - **Butuh koneksi internet** selama proses generate, dan sedikit lebih lambat untuk CSV berbaris banyak karena tiap baris melakukan satu permintaan lookup (ada cache internal per-koordinat supaya baris dengan titik yang sama/berdekatan tidak dihitung ulang).
  - Sama seperti fetch peta: **timeout-guarded per baris** (tidak akan pernah macet) — kalau lookup gagal/timeout untuk sebagian baris, baris itu otomatis jatuh ke kolom Lokasi/Alamat dari CSV, dan jumlah baris yang fallback dilaporkan di pesan setelah selesai generate.
  - Bisa dimatikan kapan saja lewat toggle ini kalau lebih suka mengontrol teks lokasi secara manual dari CSV (misal untuk kerja offline, atau saat sudah punya data alamat yang lebih akurat daripada hasil reverse-geocoding).
  - Daftar negara yang dikenali (untuk nama + bendera) mencakup ASEAN dan negara-negara umum lainnya; kode negara yang tidak dikenali tetap tampil (tanpa bendera) alih-alih gagal.
- **Catatan / Note** dan **Nomor Kontak** (override semua baris) — ketik sekali untuk dipakai di semua baris, sama seperti pola "Project Name". Kosongkan untuk memakai kolom CSV per baris.

Toggle **"Tampilkan thumbnail peta"** yang sudah ada di Template 1 berlaku juga untuk Template 2.

**Kolom CSV tambahan (semua opsional)** untuk Template 2 — hanya tampil kalau ada isinya, tidak wajib diisi:

| Field internal | Alias header yang dikenali |
|---|---|
| Catatan | `Catatan`, `Note`, `Keterangan` |
| Kontak | `Telepon`, `Phone`, `Kontak`, `Nomor Kontak`, `No Telp`, `No HP` |
| Suhu | `Suhu`, `Temperature`, `Temp` |
| Angin | `Angin`, `Wind`, `Kecepatan Angin` |
| Ketinggian | `Ketinggian`, `Altitude`, `Elevasi` |
| Arah | `Arah`, `Direction`, `Bearing` |

Catatan: suhu/angin/ketinggian/arah **tidak dihitung otomatis** oleh tool ini (butuh API cuaca berbayar atau sensor GPS asli saat pemotretan) — isi kolom-kolom ini dari data yang sudah kamu punya kalau ingin baris info geografis muncul; kalau kosong, barisnya otomatis disembunyikan (bukan tampil kosong).

---

## Fitur Utama

- **Input data fleksibel**: upload CSV untuk banyak baris sekaligus, atau **Input Manual (satu-satu)** untuk tes cepat 1–5 foto tanpa perlu bikin file CSV — keduanya bisa digabung
- **Preview Data**: tabel yang menampilkan semua baris yang sudah dimasukkan (dari CSV maupun manual), dengan tombol hapus per baris dan klik-untuk-preview, supaya data bisa diverifikasi sebelum generate massal
- **Peta & Kalender Data**: peta interaktif (Jalan/Satelit) menampilkan semua titik yang sudah diimport, dengan pin yang bisa digeser untuk mengoreksi koordinat langsung (otomatis update ke data & preview watermark), plus kalender yang menyorot tanggal-tanggal yang sudah ada datanya
- **Deteksi Otomatis dari Koordinat** (opsional, berlaku untuk Template 1 & 2): kalau kolom Kota/Alamat/Ketinggian/Suhu/Angin kosong di CSV, tool bisa mengisinya otomatis dari titik Latitude/Longitude — lokasi & alamat lewat reverse geocoding (Esri), ketinggian & cuaca historis lewat Open-Meteo. Semua gratis tanpa API key, opsional (bisa dicentang/tidak), dan tidak pernah menimpa data yang sudah kamu isi manual
- **2 preset template watermark** (Klasik / GPS Map Camera) yang bisa dipilih tanpa saling menimpa pengaturan, siap ditambah template baru ke depannya
- Template 1 & 2: judul kota/provinsi/negara + bendera negara, dengan baris info geografis (suhu/angin/ketinggian/arah) opsional memakai ikon berwarna (bukan hitam-putih)
- **Tampilan judul lokasi bisa diatur**: 4 checkbox terpisah (Kota / Provinsi / Negara / Bendera Negara) untuk memilih bagian mana saja yang tampil di judul — bisa dicentang sebagian saja (misal cuma Kota & Negara), berlaku untuk Template 1 & 2 sekaligus. Kalau Kota tidak ditemukan (umum untuk titik di laut/selat), judul otomatis "naik" memakai Provinsi atau Negara yang tersedia, bukan kosong sama sekali
- Template 2: opsi **Bahasa Watermark** (English / Indonesia) untuk nama hari dan notasi lintang-bujur (LU/LS/BT/BB)
- **Buat CSV dari Foto**: tool terpisah untuk mengekstrak nama file + tanggal/jam (EXIF atau file system) + koordinat GPS & lokasi (kalau ada di EXIF-nya) dari sekumpulan foto, dengan tabel hasil yang bisa dikoreksi manual sebelum diunduh sebagai CSV, dan tombol Reset untuk memproses file/folder lain
- **Foto HEIC/HEIF (iPhone)** didukung di menu Tempel ke Foto & Geotag Metadata — decode native instan di Safari, fallback otomatis ke konversi WASM (libheif resmi) di browser lain, biasanya hanya beberapa detik per foto (lihat "Dukungan Format HEIC/HEIF")
- Konversi otomatis Decimal Degrees → DMS (`6° 12' 31.55" S`)
- **Peta asli (Jalan/Satelit) atau placeholder offline**, dengan pin lokasi opsional
- Logo aplikasi otomatis menyesuaikan rasio gambar (tidak terpotong/gepeng, baik logo persegi maupun lebar) — atau bisa disembunyikan sepenuhnya lewat opsi **Tanpa Logo**
- Pilihan format tanggal: short / long / ISO / Indonesia
- Kustomisasi: opacity background, warna font, ukuran font, **posisi overlay fleksibel** (kombinasi atas/bawah + kiri/tengah/kanan, lebar overlay yang bisa diperkecil, dan geser manual halus/"slide" untuk penempatan presisi)
- Preview satu sample sebelum generate semua (termasuk preview peta asli)
- Progress bar + estimasi waktu (ETA) saat generate massal
- Rendering asynchronous & batched dengan **timeout guard di setiap langkah** (fetch peta & encode PNG) — proses tidak akan pernah macet permanen, otomatis fallback dan lanjut jika ada baris bermasalah
- Dark / Light theme toggle
- Simpan pengaturan terakhir otomatis (LocalStorage)
- Export & import preset sebagai file JSON

## Batasan yang Diketahui

- Gambar peta (jalan/satelit) selalu dari Esri, bukan Google — label "Google" di pojok peta hanya teks hiasan agar tampilannya sama dengan aplikasi, dan bisa diganti/dimatikan. Alamat hasil deteksi otomatis juga dari Esri, jadi susunan katanya bisa sedikit beda dari alamat versi Google di aplikasi asli; kalau mau persis, isi kolom Alamat sendiri.
- Kalau di zoom tinggi Esri tidak punya gambar untuk area itu (sering di daerah terpencil), peta otomatis memakai gambar dari zoom di bawahnya yang diperbesar — jadi peta tidak lagi kosong/blank, tapi bisa terlihat sedikit buram di zoom paling tinggi.

- Mode peta Jalan/Satelit butuh koneksi internet aktif selama proses generate; jika jaringan diblokir firewall, gunakan mode Offline atau pastikan domain tile server diizinkan (lihat bagian "Peta Otomatis").
- Untuk CSV sangat besar (ribuan baris) dengan mode peta online aktif, proses generate akan memakan waktu lebih lama karena menunggu respons server tile satu per satu; tidak ada batas jumlah baris, hanya soal waktu tunggu.
- Deteksi kolom CSV mengandalkan nama header yang mirip; jika header sangat tidak lazim, kolom bisa tidak terbaca — cek panel "kolom terdeteksi" di bawah upload CSV untuk verifikasi sebelum generate.
- "Deteksi Otomatis dari Koordinat" (lokasi/alamat/ketinggian/cuaca) butuh koneksi internet dan lebih lambat untuk CSV berbaris banyak (satu lookup per baris yang datanya kosong, dengan cache untuk koordinat yang sama/berdekatan); daftar nama+bendera negara yang dikenali belum mencakup seluruh dunia — kode negara yang tidak dikenali tetap tampil tanpa bendera.
- **Titik di laut lepas (selat, jalur pelayaran antar-pulau)** sering tidak punya Kota/Provinsi karena data referensi geocoding memang jarang mencakup area laut — untuk kasus ini, judul otomatis "naik" ke Provinsi lalu Negara (kalau Provinsi juga kosong), jadi tetap menampilkan sesuatu (mis. cuma "Indonesia" + bendera) alih-alih kosong sama sekali. Kalau geocoder Esri benar-benar tidak menemukan data apa pun untuk suatu titik laut, tool otomatis menganggapnya Indonesia (+ bendera merah-putih) selama koordinatnya masih berada di sekitar wilayah kepulauan Indonesia — ini perkiraan kasar berbasis bounding box, bukan lookup batas wilayah yang presisi.
- Cuaca historis (suhu/angin) dari Open-Meteo hanya tersedia untuk rentang tanggal yang didukung arsipnya (umumnya tidak termasuk beberapa hari paling akhir) — kalau tanggal fotonya di luar rentang itu, tool otomatis coba ambil cuaca hari ini sebagai perkiraan; kalau tetap gagal, baris itu dilewati tanpa menghentikan proses.
- **Catatan, Kontak, dan Arah/bearing tidak bisa dideteksi otomatis** — Catatan &amp; Kontak adalah data internal (tidak ada sumbernya di internet), dan Arah/bearing adalah arah kamera menghadap saat difoto yang dibaca dari sensor kompas HP saat pemotretan — informasi itu tidak tersimpan di mana pun setelah fotonya jadi, jadi memang harus diisi manual kalau dibutuhkan.
- Peta interaktif di kartu "Peta & Kalender Data" juga butuh koneksi internet untuk memuat gambar tile Jalan/Satelit (sama seperti mode peta di pengaturan overlay); tanpa internet, pin/drag-koordinat dan kalender tetap berfungsi normal, hanya latar peta yang kosong.
- **Foto HEIC (iPhone)** didukung di menu Tempel ke Foto & Geotag Metadata (lihat "Dukungan Format HEIC/HEIF") — instan di Safari (decode native), tapi di browser lain (Chrome/Firefox/Edge) konversinya lewat WebAssembly dan **bisa memakan waktu beberapa detik per foto** (bertambah untuk resolusi sangat tinggi/48 MP) — status "Mengonversi HEIC..." ditampilkan selama proses berlangsung, ini normal bukan macet. menu Buat CSV dari Foto belum bisa membaca tanggal EXIF asli dari dalam file HEIC (fallback ke tanggal file, sama seperti foto non-JPG lainnya).


---

## File Contoh CSV

File `contoh-format.csv` disertakan sebagai template. Buka dengan Excel/Google Sheets, ganti isinya dengan data kamu (pertahankan baris header di baris pertama), lalu upload. Kolom "Lokasi" menjadi baris "Project Name" pada overlay.

## Pengaturan Baru

- **Samakan Persis dengan Contoh GPS Map Camera**: satu klik mengatur Template 2 + semua ukuran/warna/posisi/peta/format ke nilai yang diukur dari foto asli aplikasi.
- **Peta** (berlaku untuk Template 1 & 2): **Ukuran Peta** 50–200% (dibanding tinggi kotak teks), **Rasio Peta** 1:1 / 4:3 / 3:4 / 16:9 / 9:16, **label teks di pojok peta** (default "Google", bisa diganti), dan **arah kamera** (kerucut biru dari pin; arah per foto diambil dari EXIF arah kamera kalau ada, atau dari kolom CSV `arah`, selain itu dari slider). **Zoom Peta** 10–19.
- **Gaya Logo "GPS Map Camera"**: pilih Teks Putih (default, jelas di background gelap), Teks Gelap, Gambar Logo dari file yang diupload, atau **Tanpa Logo** untuk menyembunyikan badge-nya sepenuhnya (tidak ada ruang kosong yang tersisa saat disembunyikan).
- **Ukuran Logo Badge**: 60–160% untuk memperbesar/memperkecil badge (disembunyikan otomatis kalau Gaya Logo diset ke Tanpa Logo, karena tidak relevan).
- **Posisi & Ukuran Overlay**: kombinasi 3 kontrol untuk menempatkan overlay di mana saja pada foto:
  - **Posisi Vertikal** (Bawah/Atas) + **Posisi Horizontal** (Kiri/Tengah/Kanan) — kombinasikan untuk posisi apa saja, misal Bawah + Tengah untuk "rata tengah bawah". Posisi Horizontal baru kelihatan bedanya kalau overlay-nya tidak selebar penuh (lihat poin berikutnya).
  - **Lebar Overlay Maksimal** (50–100%): perkecil dari 100% (default, selebar foto seperti sebelumnya) supaya overlay jadi kartu yang lebih ringkas dan Posisi Horizontal punya ruang untuk terlihat efeknya.
  - **Geser Horizontal / Geser Vertikal (slide manual)** (-50% s.d. +50%, per 0,1%): geser halus dari titik Posisi Vertikal/Horizontal di atas untuk penempatan presisi — batas geser dijaga otomatis supaya overlay tidak sampai keluar dari foto.
  - **Langsung di preview**: kotak putus-putus di sekeliling watermark bisa **digeser** dengan mouse/jari untuk memindah posisi, dan **titik bulat di pojoknya ditarik** untuk memperbesar/memperkecil (Ukuran Overlay 50–150%, per 0,5% — peta, tulisan, dan badge ikut menyesuaikan). Nilainya tersambung ke slider; tombol "Reset posisi & ukuran" mengembalikan ke ukuran asli. Catatan: tinggi kotak mengikuti isi seperti di aplikasi asli — judul yang lebih panjang (3 baris) membuat kotak dan peta sedikit lebih tinggi dibanding judul 2 baris.
- **Radius Sudut (fillet)**: 0–40px, atur ketajaman sudut kotak/peta/badge. 0 = sudut tajam.
- **Bayangan (shadow)**: 0–100%, efek bayangan di sekeliling overlay yang ikut ter-render ke PNG (berguna saat ditempel ke foto).
- **Project Name (override semua baris)**: ketik satu nilai untuk dipakai di semua overlay tanpa mengedit CSV. Kosongkan untuk memakai kolom Lokasi dari CSV.

## Catatan tentang Peta Online & Export

Beberapa browser/jaringan memblokir tile peta dari server publik karena kebijakan CORS. Jika ini terjadi, aplikasi otomatis beralih ke peta placeholder offline untuk seluruh batch (supaya export PNG tetap berhasil) dan memberi tahu di pesan hasil. Export ZIP tidak akan pernah gagal total karena masalah peta.

## Deploy ke GitHub Pages

1. Push **isi folder ini** (bukan foldernya sendiri) langsung ke root repo GitHub kamu — `index.html` harus terlihat langsung di halaman utama repo, sejajar dengan folder `css/`, `js/`, dll.
2. File `.nojekyll` sudah disertakan di root — ini **wajib** ada. Tanpa file ini, GitHub Pages menjalankan proses Jekyll secara default yang bisa menyebabkan CSS/JS gagal termuat (halaman tampil tanpa styling, cuma teks polos) meski semua file terlihat ada di repo.
3. Aktifkan di Settings → Pages, pilih branch `main` dan folder `/ (root)`.
4. Tunggu 1-2 menit untuk build pertama, lalu akses link yang diberikan GitHub.

Jika halaman masih tampil tanpa styling setelah `.nojekyll` ditambahkan, coba hard refresh (Ctrl+Shift+R) untuk membersihkan cache browser, atau cek tab Actions di repo untuk memastikan proses deploy Pages selesai tanpa error.

---

## Fitur Baru: 4 Menu

Aplikasi sekarang punya 4 tab dengan tujuan berbeda:

### Watermark GPS (fitur asli, sebelumnya bernama "Overlay PNG")
Generate watermark PNG transparan dari CSV, seperti sebelumnya. Titik mulai semua tab lain — data, logo, dan pengaturan yang diisi di sini dipakai bersama oleh menu Tempel ke Foto & Geotag Metadata.

#### Peta & Kalender Data

Setelah data diisi (CSV atau Input Manual), menu Watermark GPS menampilkan kartu **"Peta & Kalender Data"** di bagian bawah:

- **Peta interaktif** (pakai [Leaflet](https://leafletjs.com/), library gratis & open-source, dibundel lokal di `libs/leaflet/` — bukan lewat CDN) menampilkan setiap baris yang punya Latitude/Longitude valid sebagai pin. Kontrol di pojok kanan-atas peta bisa ganti tampilan antara **Jalan** dan **Satelit** (sumber tile sama dengan yang dipakai untuk thumbnail peta di watermark — Esri, gratis tanpa API key).
- **Geser pin untuk koreksi koordinat** — pin di peta ini bisa di-drag. Melepas pin di posisi baru langsung menimpa nilai Latitude/Longitude baris tersebut, dan otomatis ter-refleksi ke tabel Preview Data serta ke canvas Preview watermark (kalau baris itu sedang jadi contoh yang ditampilkan) — jadi tidak perlu edit CSV manual kalau cuma mau menggeser titik sedikit.
- **Kalender** di sebelah peta menyorot tanggal mana saja yang punya data (dihitung dari kolom Tanggal tiap baris, terlepas dari valid-tidaknya koordinat), dengan jumlah foto per tanggal. Klik satu tanggal untuk menyorot titik-titik pada tanggal itu di peta (titik lain jadi transparan) dan menampilkan daftar nama filenya; klik lagi (atau tombol "Tampilkan Semua") untuk membatalkan filter.
- Butuh koneksi internet untuk memuat gambar peta (tile Jalan/Satelit); tanpa internet peta tetap berfungsi untuk drag-koordinat dan kalender, hanya tampilan tile-nya kosong.

### Tempel ke Foto
Alih-alih PNG transparan terpisah, overlay langsung "dibakar" ke foto asli kamu. Upload foto (banyak sekaligus / satu folder), foto dipasangkan otomatis dengan baris CSV (dari menu Watermark GPS) berdasarkan nama file atau urutan. Mendukung **JPG, PNG, dan HEIC/HEIF** (format foto default iPhone). Ada opsi:
- **Acak koordinat** dalam radius tertentu (1–50 meter) — supaya titik tidak persis sama di setiap foto
- **Tulis GPS+tanggal ke EXIF** foto JPG hasil (opsional, bisa dimatikan)
- **Bersihkan metadata lain** — hasil jadi file bersih hanya berisi GPS+tanggal yang kamu tentukan
- Format output JPG (kompres, EXIF didukung) atau PNG (kualitas penuh, tanpa EXIF) — berlaku untuk foto apa pun yang diupload, termasuk HEIC

### Geotag Metadata
Hanya menulis GPS+tanggal ke metadata EXIF foto — **tanpa** overlay/watermark visual apa pun. Untuk foto dokumentasi asli yang GPS-nya tidak terekam kamera. Sumber koordinat bisa manual (satu titik untuk semua foto) atau dari CSV menu Watermark GPS (per foto berurutan). Sama seperti menu Tempel ke Foto, ada opsi acak koordinat dan bersihkan metadata lain. Menerima upload **JPG maupun HEIC**.

**Catatan teknis EXIF:** hanya file JPG yang mendukung EXIF (standar industri) — PNG tidak punya slot EXIF yang sama. HEIC punya struktur metadatanya sendiri yang tidak kompatibel dengan cara menu Geotag Metadata menulis EXIF, jadi foto **HEIC otomatis dikonversi ke JPG dulu** (di browser, lihat "Dukungan Format HEIC/HEIF") sebelum ditulisi metadata GPS — hasil downloadnya berformat `.jpg`, bukan `.heic`.

### Metadata Tambahan (opsional) — Geotag Metadata

Selain GPS + tanggal/waktu, menu Geotag Metadata sekarang punya field opsional yang juga ditulis ke EXIF setiap foto dalam satu batch (nilai sama untuk semua foto pada proses tersebut) — berguna untuk kelengkapan dokumentasi kepatuhan seperti **SIMPEL PPU**:

| Field | Ditulis ke tag EXIF |
|---|---|
| Ketinggian / Altitude (meter) | `GPS.GPSAltitude` + `GPSAltitudeRef` |
| Keterangan Foto | `0th.ImageDescription` |
| Nama Petugas / Surveyor | `0th.Artist` |
| Instansi / Perusahaan | `0th.Copyright` |

Semua field ini opsional — dikosongkan berarti tidak ditulis. Verifikasi hasilnya sama seperti GPS: klik-kanan foto → Properties → Details (Windows), atau lewat situs pengecek EXIF.

### Buat CSV dari Foto

Tool kecil yang **berdiri sendiri**, terpisah dari data/pengaturan menu lainnya — tidak berbagi apa pun dengan tab lain. Dibuat untuk kasus foto dokumentasi yang tanggal/jam pemotretannya sudah hilang atau salah, sehingga perlu dikoreksi manual sebelum dipakai sebagai CSV di menu Watermark GPS. Menerima file **JPG, PNG, dan HEIC**.

Cara pakai:
1. Klik **"Atau Pilih Folder Langsung"** untuk memilih seluruh folder foto sekaligus, atau drag & drop / pilih file satu-satu.
2. Untuk tiap foto, tanggal & jam diambil otomatis:
   - Dari metadata **EXIF** (`DateTimeOriginal`) kalau filenya JPG dan datanya ada — ditandai badge hijau **EXIF**.
   - Kalau tidak ada (bukan JPG, atau EXIF-nya kosong/hilang — termasuk **HEIC**, lihat catatan di bawah), fallback ke **tanggal terakhir file dimodifikasi** di file system — ditandai badge kuning **File System**, karena ini cuma perkiraan, bukan waktu pemotretan asli.
3. Kalau fotonya JPG dan punya **GPS di EXIF** (umum untuk foto dari aplikasi seperti GPS Map Camera — koordinatnya tetap tersimpan di metadata walau cuma teks watermark yang kelihatan di gambarnya), kolom **Latitude/Longitude otomatis terisi**, dan **Lokasi** otomatis dideteksi dari koordinat itu lewat reverse-geocoding yang sama dengan "Deteksi Otomatis dari Koordinat" di menu Watermark GPS (perlu koneksi internet; kalau gagal/offline, kolom itu dikosongkan seperti biasa).
4. Tabel hasil ekstraksi **bisa diedit langsung** — klik kolom Tanggal/Waktu/Latitude/Longitude/Lokasi tiap baris untuk mengoreksi manual, terutama baris bertanda "File System" atau yang GPS/Lokasi-nya masih kosong.
5. Klik **Download CSV** untuk mengunduh hasilnya — kolom CSV sama persis dengan format menu Watermark GPS (`Nama File, Latitude, Longitude, Tanggal, Waktu, Lokasi, Alamat`). Kolom yang tidak berhasil terisi otomatis (misalnya Alamat, atau semuanya kalau fotonya tidak punya GPS EXIF) dikosongkan untuk diisi manual lewat Excel/Google Sheets.
6. Klik **Reset** (di pojok kanan atas kartu "Hasil Ekstraksi") kapan saja untuk mengosongkan tabel & input file, lalu upload file/folder lain — tidak perlu reload halaman.

Semua pemrosesan (baca EXIF, baca tanggal file) terjadi 100% di browser — foto tidak pernah diunggah ke mana pun. Reverse-geocoding koordinat GPS memang butuh koneksi internet (lewat layanan Esri yang sama dipakai menu Watermark GPS), tapi hanya mengirim angka koordinat, bukan fotonya.

## Dukungan Format HEIC/HEIF (Foto iPhone)

iPhone (iOS 11+) menyimpan foto dalam format **HEIC** secara default. Menu Tempel ke Foto dan Geotag Metadata menanganinya dengan strategi dua lapis:

1. **Coba decode native browser dulu** — tercepat (instan), dan ini yang membuat **Safari langsung bisa** karena Safari punya dukungan HEIC bawaan di level OS. Berlaku otomatis, tidak perlu pengaturan apa pun.
2. **Kalau native gagal** (kasus paling umum: Chrome, Firefox, Edge — belum ada satu pun yang bisa decode HEIC lewat `<img>`/`<canvas>`), otomatis fallback ke [`libheif-js`](https://github.com/catdad-experiments/libheif-js) (LGPL-3.0, dibundel lokal di `libs/libheif/`, tidak pernah fetch dari CDN) — build resmi WebAssembly dari codec [`libheif`](https://github.com/strukturag/libheif) itu sendiri, dipakai langsung (bukan lewat wrapper pihak ketiga) supaya dapat dukungan format HEIC terluas dan performa terbaik yang tersedia untuk decode di browser.

Detail per tab:
- **Tempel ke Foto:** foto HEIC didecode (native atau via libheif-js) sebelum watermark digambar, lalu diekspor sesuai Format Output yang dipilih (JPG atau PNG) — sama seperti alur untuk foto JPG/PNG biasa.
- **Geotag Metadata:** foto HEIC **selalu** dikonversi lewat libheif-js ke JPEG dulu — walaupun di Safari (karena EXIF adalah konsep khusus struktur file JPEG; kemampuan Safari menampilkan HEIC secara native tidak membantu di sini, bytes aslinya tetap HEIC, bukan JPEG). File yang diunduh berekstensi `.jpg`, bukan `.heic`.
- **Buat CSV dari Foto:** **belum** membaca tanggal maupun GPS EXIF asli dari dalam file HEIC (perlu parser struktur HEIF terpisah yang fokus pada metadata, bukan konversi gambar) — foto HEIC otomatis memakai fallback tanggal-file-dimodifikasi (badge "File System") seperti foto non-JPG lainnya, dan kolom Latitude/Longitude/Lokasi-nya tetap kosong. Koreksi manual di tabel kalau datanya berbeda/dibutuhkan.
- menu **Watermark GPS** tidak memproses foto sama sekali (hanya CSV), jadi tidak terpengaruh format foto apa pun.

**Soal kecepatan:** jalur WASM (non-Safari) tetap melibatkan decoding gambar resolusi penuh tanpa akselerasi hardware, jadi ada jeda yang terasa — namun biasanya cuma **beberapa detik per foto** untuk resolusi standar (12 MP), bertambah untuk foto beresolusi sangat tinggi (48 MP). Menu Tempel ke Foto & Geotag Metadata menampilkan status "Mengonversi HEIC..." (di preview maupun progress bar) selama proses ini berlangsung, dan langsung terlihat sesaat setelah foto dipilih supaya tidak terkesan aplikasi berhenti merespons. Kalau konversi gagal (file rusak/format tidak didukung), pesan errornya sekarang spesifik menyebutkan tahap mana yang gagal, bukan pesan generik. Untuk banyak foto HEIC sekaligus, total waktunya berakumulasi (foto diproses satu per satu, bukan paralel) — pakai Safari kalau tersedia untuk hasil instan tanpa jeda konversi sama sekali.

## Kenapa Tool Ini Dibuat

Di beberapa lokasi kerja **restricted** (misalnya area proses/plant pada fasilitas migas atau industri sejenis), kamera/perangkat yang boleh dibawa masuk umumnya tidak diizinkan mengaktifkan fitur GPS/geotag karena kebijakan keamanan lokasi. Akibatnya, foto dokumentasi yang dihasilkan tidak memiliki informasi lokasi sama sekali. Tool ini dibuat untuk menambahkan koordinat, tanggal, dan info lokasi tersebut **secara manual** ke overlay PNG maupun langsung ke metadata EXIF foto, agar dokumentasi tetap bisa memenuhi ketentuan teknis pelaporan seperti **SIMPEL PPU** yang mensyaratkan bukti geotag pada foto pekerjaan.

## Traktir Kopi

Ada tombol "Traktir Kopi" di footer — kalau tool ini bermanfaat, bisa scan QRIS yang muncul di situ. Sepenuhnya opsional. Setelah generate berhasil di menu Watermark GPS, Tempel ke Foto, atau Geotag Metadata, pesan "Selesai!" juga menyertakan ajakan singkat untuk traktir kopi kalau tool-nya membantu pekerjaanmu — tinggal klik teksnya untuk langsung membuka QRIS yang sama.
