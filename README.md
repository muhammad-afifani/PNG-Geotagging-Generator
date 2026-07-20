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

1. **Upload CSV** — drag & drop atau klik untuk memilih file.
2. **(Opsional) Upload logo** — Mode A pakai logo bawaan (embedded), Mode B upload PNG sendiri.
3. **Atur pengaturan overlay** — resolusi, format tanggal, posisi, opacity, warna & ukuran font, sumber peta, dll.
4. **Preview** — cek tampilan overlay per baris sebelum generate massal.
5. **Generate & Download ZIP** — semua PNG dibuat secara batch/asynchronous lalu otomatis di-download sebagai satu file ZIP.

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
  render.js     -> mesin render Canvas (kotak overlay, badge, teks, komposisi peta)
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

## Fitur Utama

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
