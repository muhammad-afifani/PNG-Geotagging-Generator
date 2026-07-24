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
   - Setelah data masuk (dari cara manapun), cek tabel **Preview Data** yang muncul di bawahnya — semua baris ditampilkan lengkap dengan tombol hapus per baris, dan klik satu baris untuk langsung melihat preview overlay-nya di panel kanan. Ini supaya kamu bisa pastikan data yang dimasukkan sudah benar sebelum generate massal.
2. **(Opsional) Upload logo** — Mode A pakai logo bawaan (embedded), Mode B upload PNG sendiri.
3. **Atur pengaturan overlay** — resolusi, format tanggal, posisi, opacity, warna & ukuran font, sumber peta, dll.
4. **Preview** — cek tampilan overlay per baris sebelum generate massal.
5. **Generate & Download ZIP** — semua PNG dibuat secara batch/asynchronous lalu otomatis di-download sebagai satu file ZIP.

> **Penting:** Data (CSV maupun input manual), logo, dan semua pengaturan overlay yang kamu atur di **Tab 1** dipakai bersama oleh **Tab 2 (Tempel ke Foto)** dan **Tab 3 (Geotag Metadata)** — tidak perlu mengisi ulang di tab lain. Urutan ini (dan alasan tool ini dibuat) juga dijelaskan di banner panduan yang muncul otomatis di bagian atas halaman saat pertama kali dibuka (bisa dibuka/tutup lewat baris "Panduan Cara Pakai" di atas tab).

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
  maptile.js    -> fetch tile peta asli (OSM/Esri) + cache + pin marker
  countries.js  -> tabel kode negara -> nama Indonesia + kode bendera (Template 2)
  geocode.js    -> reverse-geocoding (Esri) + fetch bendera negara (Template 2)
  render.js     -> mesin render Canvas (dispatcher Template 1/2: kotak overlay, badge, teks, komposisi peta)
  csv.js        -> parsing CSV + auto-deteksi kolom
  settings.js   -> LocalStorage + export/import preset JSON
  main.js       -> controller UI, preview, batching & ZIP generation
libs/
  papaparse.min.js
  jszip.min.js
  FileSaver.min.js
assets/
  logo-default.png     -> logo bawaan (Mode A)
  placeholder-map.png  -> aset cadangan (peta placeholder utamanya digambar via Canvas)
README.md
```

---

## Preset Template Watermark

Tab 1 punya pilihan **Preset Template** di bagian atas kartu "Pengaturan Overlay", supaya beberapa gaya watermark bisa dipakai tanpa saling menimpa pengaturan satu sama lain. Menambah Template 3 dan seterusnya di masa depan tidak akan mengubah Template 1/2 yang sudah ada.

### Template 1 — Klasik
Gaya asli tool ini: kartu mengambang dengan sudut membulat, peta kotak terpisah di kiri, badge logo menempel di pojok kanan-atas kotak teks, baris koordinat format DMS (`6° 12' 31.55" S`).

### Template 2 — GPS Map Camera
Rekonstruksi (digambar ulang lewat Canvas, bukan crop dari aplikasi manapun) dari tampilan watermark asli aplikasi GPS Map Camera. Sama seperti Template 1: kartu mengambang dengan sudut membulat dan badge logo menempel di pojok kanan-atas kotak teks (keluar/nongol di ujung, persis mekanisme Template 1) — bedanya ada baris data yang lebih lengkap:
- Judul tebal `Kota, Provinsi, Negara` + bendera negara
- Alamat lengkap (wrap hingga 2 baris)
- Baris koordinat desimal: `Lat 40.689298   Long -74.044495`
- Baris tanggal + jam (opsional) + zona waktu: `Thursday, 20/03/2025 GMT+08:00`
- **Note** (opsional): `Note : <teks bebas>`
- **Kontak** (opsional): nomor telepon/kontak dengan ikon telepon
- **Info geografis** (opsional): suhu, kecepatan angin, ketinggian, dan arah/bearing — masing-masing dengan ikon sendiri (matahari, angin, gunung, kompas), tampil berjejer hanya untuk field yang ada datanya

Pengaturan khusus Template 2 (muncul otomatis saat template ini dipilih):
- **Zona Waktu (GMT Offset)** — dropdown WIB/WITA/WIT plus offset umum lainnya, ditulis di baris tanggal.
- **Rasio Peta** — 1:1 / 4:3 / 3:4 / 16:9 / 9:16. Thumbnail peta di-crop (bukan di-stretch) dari grid tile yang sama, jadi bentuknya berubah sesuai rasio tanpa gambar jadi gepeng/molor.
- **Tampilkan jam di baris tanggal** — opsional, default mati.
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
- **2 preset template watermark** (Klasik / GPS Map Camera) yang bisa dipilih tanpa saling menimpa pengaturan, siap ditambah template baru ke depannya
- Template 2: deteksi otomatis kota/provinsi/negara + alamat + bendera negara langsung dari koordinat (reverse geocoding), dengan pengaturan zona waktu (GMT offset)
- Konversi otomatis Decimal Degrees → DMS (`6° 12' 31.55" S`)
- **Peta asli (Jalan/Satelit) atau placeholder offline**, dengan pin lokasi opsional
- Logo aplikasi otomatis menyesuaikan rasio gambar (tidak terpotong/gepeng, baik logo persegi maupun lebar)
- Pilihan format tanggal: short / long / ISO / Indonesia
- Kustomisasi: opacity background, warna font, ukuran font, posisi & ukuran overlay
- Preview satu sample sebelum generate semua (termasuk preview peta asli)
- Progress bar + estimasi waktu (ETA) saat generate massal
- Rendering asynchronous & batched dengan **timeout guard di setiap langkah** (fetch peta & encode PNG) — proses tidak akan pernah macet permanen, otomatis fallback dan lanjut jika ada baris bermasalah
- Dark / Light theme toggle
- Simpan pengaturan terakhir otomatis (LocalStorage)
- Export & import preset sebagai file JSON

## Batasan yang Diketahui

- Mode peta Jalan/Satelit butuh koneksi internet aktif selama proses generate; jika jaringan diblokir firewall, gunakan mode Offline atau pastikan domain tile server diizinkan (lihat bagian "Peta Otomatis").
- Untuk CSV sangat besar (ribuan baris) dengan mode peta online aktif, proses generate akan memakan waktu lebih lama karena menunggu respons server tile satu per satu; tidak ada batas jumlah baris, hanya soal waktu tunggu.
- Fitur cuaca (weather) belum tersedia — memerlukan API cuaca historis terpisah yang umumnya berbayar/terbatas.
- Deteksi kolom CSV mengandalkan nama header yang mirip; jika header sangat tidak lazim, kolom bisa tidak terbaca — cek panel "kolom terdeteksi" di bawah upload CSV untuk verifikasi sebelum generate.
- Template 2 dengan reverse-geocoding otomatis aktif butuh koneksi internet dan lebih lambat untuk CSV berbaris banyak (satu lookup per baris, dengan cache untuk koordinat yang sama/berdekatan); daftar nama+bendera negara yang dikenali belum mencakup seluruh dunia — kode negara yang tidak dikenali tetap tampil tanpa bendera.


---

## File Contoh CSV

File `contoh-format.csv` disertakan sebagai template. Buka dengan Excel/Google Sheets, ganti isinya dengan data kamu (pertahankan baris header di baris pertama), lalu upload. Kolom "Lokasi" menjadi baris "Project Name" pada overlay.

## Pengaturan Baru

- **Gaya Logo "GPS Map Camera"**: pilih Teks Putih (default, jelas di background gelap), Teks Gelap, atau Gambar Logo dari file yang diupload.
- **Ukuran Logo Badge**: 60–160% untuk memperbesar/memperkecil badge.
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

## Fitur Baru: 3-Tab Workflow

Aplikasi sekarang punya 3 tab dengan tujuan berbeda:

### Tab 1 — Overlay PNG (fitur asli)
Generate watermark PNG transparan dari CSV, seperti sebelumnya.

### Tab 2 — Tempel ke Foto
Alih-alih PNG transparan terpisah, overlay langsung "dibakar" ke foto asli kamu. Upload foto (banyak sekaligus / satu folder), foto dipasangkan otomatis dengan baris CSV (dari Tab 1) berdasarkan nama file atau urutan. Ada opsi:
- **Acak koordinat** dalam radius tertentu (1–50 meter) — supaya titik tidak persis sama di setiap foto
- **Tulis GPS+tanggal ke EXIF** foto JPG hasil (opsional, bisa dimatikan)
- **Bersihkan metadata lain** — hasil jadi file bersih hanya berisi GPS+tanggal yang kamu tentukan
- Format output JPG (kompres, EXIF didukung) atau PNG (kualitas penuh, tanpa EXIF)

### Tab 3 — Geotag Metadata
Hanya menulis GPS+tanggal ke metadata EXIF foto JPG — **tanpa** overlay/watermark visual apa pun. Untuk foto dokumentasi asli yang GPS-nya tidak terekam kamera. Sumber koordinat bisa manual (satu titik untuk semua foto) atau dari CSV Tab 1 (per foto berurutan). Sama seperti Tab 2, ada opsi acak koordinat dan bersihkan metadata lain.

**Catatan teknis EXIF:** hanya file JPG yang mendukung EXIF (standar industri). PNG tidak punya slot EXIF yang sama, jadi Tab 3 hanya menerima JPG.

### Metadata Tambahan (opsional) — Tab 3

Selain GPS + tanggal/waktu, Tab 3 sekarang punya field opsional yang juga ditulis ke EXIF setiap foto dalam satu batch (nilai sama untuk semua foto pada proses tersebut) — berguna untuk kelengkapan dokumentasi kepatuhan seperti **SIMPEL PPU**:

| Field | Ditulis ke tag EXIF |
|---|---|
| Ketinggian / Altitude (meter) | `GPS.GPSAltitude` + `GPSAltitudeRef` |
| Keterangan Foto | `0th.ImageDescription` |
| Nama Petugas / Surveyor | `0th.Artist` |
| Instansi / Perusahaan | `0th.Copyright` |

Semua field ini opsional — dikosongkan berarti tidak ditulis. Verifikasi hasilnya sama seperti GPS: klik-kanan foto → Properties → Details (Windows), atau lewat situs pengecek EXIF.

## Kenapa Tool Ini Dibuat

Di beberapa lokasi kerja **restricted** (misalnya area proses/plant pada fasilitas migas atau industri sejenis), kamera/perangkat yang boleh dibawa masuk umumnya tidak diizinkan mengaktifkan fitur GPS/geotag karena kebijakan keamanan lokasi. Akibatnya, foto dokumentasi yang dihasilkan tidak memiliki informasi lokasi sama sekali. Tool ini dibuat untuk menambahkan koordinat, tanggal, dan info lokasi tersebut **secara manual** ke overlay PNG maupun langsung ke metadata EXIF foto, agar dokumentasi tetap bisa memenuhi ketentuan teknis pelaporan seperti **SIMPEL PPU** yang mensyaratkan bukti geotag pada foto pekerjaan.

## Traktir Kopi

Ada tombol "☕ Traktir Kopi" di footer — kalau tool ini bermanfaat, bisa scan QRIS yang muncul di situ. Sepenuhnya opsional.
