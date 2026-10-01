/* =========================================================
   csvbuilder.js — Tab 4: a small STANDALONE tool, unrelated to
   Tab 1/2/3's data. Given a folder/selection of photos, it extracts
   filename + date/time (from EXIF DateTimeOriginal when the file is
   a JPG that has it, otherwise falling back to the file's last-
   modified timestamp) into an editable table, then exports a CSV
   with the same columns as Tab 1's template (Nama File, Latitude,
   Longitude, Tanggal, Waktu, Lokasi, Alamat).

   When a JPG carries GPS EXIF (very common for photos taken with
   GPS Map Camera-style apps, which embed real GPS coordinates even
   though they only *draw* the watermark text onto the image),
   Latitude/Longitude are read straight from that GPS EXIF and the
   Lokasi/Alamat text is auto-filled via the same reverse-geocoding
   used elsewhere in the app (geocode.js — Esri's free geocoder).
   Photos without GPS EXIF (most photos from restricted-area cameras,
   which is this whole app's premise) simply leave those columns
   blank for manual entry, exactly as before.

   Extraction itself lives in photometa.js (shared with Tab 1's "Dari
   Folder Foto"), and "Lanjut" hands rows + photos straight to Tab 1.

   Built for cameras/photos that lost their capture date/location, so
   every auto-filled value is clearly editable and never treated as
   ground truth the user can't double-check.
   ========================================================= */
(function () {
  'use strict';

  const state = { rows: [] }; // { file, date, time, dateSource: 'exif'|'file', lat, lng, location, address, gpsSource: 'exif'|null }

  const el = {
    dropZone: document.getElementById('cbDropZone'),
    fileInput: document.getElementById('cbFileInput'),
    folderInput: document.getElementById('cbFolderInput'),
    fileInfo: document.getElementById('cbFileInfo'),
    count: document.getElementById('cbCount'),
    tableWrap: document.getElementById('cbTableWrap'),
    tableBody: document.getElementById('cbTableBody'),
    empty: document.getElementById('cbEmpty'),
    downloadBtn: document.getElementById('cbDownloadBtn'),
    resetBtn: document.getElementById('cbResetBtn'),
    useBtn: document.getElementById('cbUseBtn')
  };
  let files = []; // the photos behind state.rows, same order

  el.dropZone.addEventListener('click', () => el.fileInput.click());
  el.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); el.dropZone.classList.add('dragover'); });
  el.dropZone.addEventListener('dragleave', () => el.dropZone.classList.remove('dragover'));
  el.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });
  el.fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFiles(e.target.files); });
  el.folderInput.addEventListener('change', (e) => { if (e.target.files.length) handleFiles(e.target.files); });
  el.resetBtn.addEventListener('click', resetAll);

  async function handleFiles(fileList) {
    const picked = Array.from(fileList).filter(f => window.GeoStampPhotoMeta.isPhotoFile(f));
    if (!picked.length) { alert('Tidak ada file gambar yang terdeteksi.'); return; }
    picked.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    files = picked;

    el.fileInfo.classList.remove('hidden');
    el.fileInfo.innerHTML = `<span>Memproses <strong>${files.length}</strong> foto…</span>`;
    el.downloadBtn.disabled = true;
    el.useBtn.disabled = true;
    el.resetBtn.disabled = true;

    const rows = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const nameNoExt = file.name.replace(/\.[^.]+$/, '');
      const meta = await window.GeoStampPhotoMeta.extract(file);
      rows.push({
        file: nameNoExt, date: meta.date, time: meta.time, dateSource: meta.dateSource,
        lat: meta.lat, lng: meta.lng, direction: meta.direction || '',
        location: '', address: '',
        gpsSource: meta.lat != null ? 'exif' : null
      });
      if (i % 8 === 0) await new Promise(r => setTimeout(r, 0)); // keep UI responsive
    }

    state.rows = rows;
    el.fileInfo.innerHTML = `<span><strong>${files.length}</strong> foto diproses.</span>`;
    renderTable();
    el.resetBtn.disabled = false;

    await geocodeGpsRows(rows);
  }

  /**
   * For every row that got GPS coordinates from EXIF, reverse-geocode
   * it into a Lokasi/Alamat via geocode.js (never throws — resolves
   * null on any failure, leaving those columns blank for manual entry
   * exactly like a GPS-less photo). Runs sequentially and updates the
   * table progressively so results appear as they resolve rather than
   * blocking the whole batch behind network calls.
   */
  async function geocodeGpsRows(rows) {
    const gpsRows = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.lat != null && row.lng != null);
    if (!gpsRows.length) return;

    el.fileInfo.innerHTML = `<span>Mendeteksi lokasi dari <strong>${gpsRows.length}</strong> foto berkoordinat GPS…</span>`;
    for (const { row, index } of gpsRows) {
      try {
        const geo = await reverseGeocode(row.lat, row.lng);
        if (geo) {
          row.location = geo.city || geo.province || geo.country || '';
          row.address = geo.address || '';
        }
      } catch (e) { /* keep going — leave blank, same as a GPS-less photo */ }
      updateRowLocationCells(index);
    }
    el.fileInfo.innerHTML = `<span><strong>${state.rows.length}</strong> foto diproses.</span>`;
  }

  function renderTable() {
    const total = state.rows.length;
    el.empty.classList.toggle('hidden', total > 0);
    el.tableWrap.classList.toggle('hidden', total === 0);
    el.downloadBtn.disabled = total === 0;
    el.useBtn.disabled = total === 0;
    if (!total) { el.tableBody.innerHTML = ''; el.count.textContent = ''; return; }

    const exifCount = state.rows.filter(r => r.dateSource === 'exif').length;
    const gpsCount = state.rows.filter(r => r.gpsSource === 'exif').length;
    el.count.textContent = `${total} foto — ${exifCount} tanggal dari EXIF, ${gpsCount} punya GPS`;

    el.tableBody.innerHTML = state.rows.map((row, i) => `
      <tr data-index="${i}">
        <td>${i + 1}</td>
        <td class="dp-file">${escapeHtml(row.file)}</td>
        <td><input type="date" class="cb-date-input" data-index="${i}" value="${row.date}"></td>
        <td><input type="time" class="cb-time-input" data-index="${i}" value="${row.time}"></td>
        <td><input type="text" class="cb-lat-input" data-index="${i}" value="${row.lat != null ? row.lat.toFixed(6) : ''}" placeholder="-"></td>
        <td><input type="text" class="cb-lng-input" data-index="${i}" value="${row.lng != null ? row.lng.toFixed(6) : ''}" placeholder="-"></td>
        <td><input type="text" class="cb-loc-input" data-index="${i}" value="${escapeHtml(row.location)}" placeholder="-"></td>
        <td><span class="cb-source-badge ${row.dateSource === 'exif' ? 'cb-source-exif' : 'cb-source-file'}">${row.dateSource === 'exif' ? 'EXIF' : 'File System'}</span></td>
      </tr>
    `).join('');
  }

  /** Updates just one row's lat/lng/lokasi cells in place (used while
   * geocoding results trickle in), instead of re-rendering the whole
   * table and risking clobbering an edit the user is mid-typing. */
  function updateRowLocationCells(index) {
    const row = state.rows[index];
    const tr = el.tableBody.querySelector(`tr[data-index="${index}"]`);
    if (!row || !tr) return;
    const latInput = tr.querySelector('.cb-lat-input');
    const lngInput = tr.querySelector('.cb-lng-input');
    const locInput = tr.querySelector('.cb-loc-input');
    if (latInput) latInput.value = row.lat != null ? row.lat.toFixed(6) : '';
    if (lngInput) lngInput.value = row.lng != null ? row.lng.toFixed(6) : '';
    if (locInput) locInput.value = row.location || '';
  }

  function parseCoordInput(v) {
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  el.tableBody.addEventListener('change', (e) => {
    const dateInput = e.target.closest('.cb-date-input');
    const timeInput = e.target.closest('.cb-time-input');
    const latInput = e.target.closest('.cb-lat-input');
    const lngInput = e.target.closest('.cb-lng-input');
    const locInput = e.target.closest('.cb-loc-input');
    if (dateInput) state.rows[Number(dateInput.dataset.index)].date = dateInput.value;
    if (timeInput) state.rows[Number(timeInput.dataset.index)].time = timeInput.value;
    if (latInput) state.rows[Number(latInput.dataset.index)].lat = parseCoordInput(latInput.value);
    if (lngInput) state.rows[Number(lngInput.dataset.index)].lng = parseCoordInput(lngInput.value);
    if (locInput) state.rows[Number(locInput.dataset.index)].location = locInput.value;
  });

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function csvField(val) {
    const s = String(val == null ? '' : val);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  el.downloadBtn.addEventListener('click', () => {
    if (!state.rows.length) return;
    const header = ['Nama File', 'Latitude', 'Longitude', 'Tanggal', 'Waktu', 'Lokasi', 'Alamat'];
    const lines = [header.join(',')];
    state.rows.forEach((row) => {
      lines.push([
        csvField(row.file),
        csvField(row.lat != null ? row.lat.toFixed(6) : ''),
        csvField(row.lng != null ? row.lng.toFixed(6) : ''),
        csvField(row.date),
        csvField(row.time),
        csvField(row.location),
        csvField(row.address)
      ].join(','));
    });
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const stamp = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const name = `csv-dari-foto_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}.csv`;
    saveAs(blob, name);
  });

  /** Clears all extracted results and both file inputs so the user can
   * upload a different file/folder without reloading the page. */
  // hand the extracted rows + their photos straight to Tab 1 (no CSV
  // download/upload round trip): watermark settings with live preview
  // on the real photos, then Tab 2 burns it onto all of them
  el.useBtn.addEventListener('click', () => {
    if (!state.rows.length || !window.GeoStamp) return;
    window.GeoStamp.importPhotoRows(state.rows.map(r => ({
      file: r.file, lat: r.lat, lng: r.lng, date: r.date, time: r.time,
      location: r.location, address: r.address, bearing: r.direction
    })), files);
    if (window.GeoStampTabs) window.GeoStampTabs.activate('tab-overlay');
  });

  function resetAll() {
    files = [];
    state.rows = [];
    el.fileInput.value = '';
    el.folderInput.value = '';
    el.fileInfo.classList.add('hidden');
    el.fileInfo.innerHTML = '';
    renderTable();
  }
})();
