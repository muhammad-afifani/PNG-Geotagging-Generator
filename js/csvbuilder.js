/* =========================================================
   csvbuilder.js — Tab 4: a small STANDALONE tool, unrelated to
   Tab 1/2/3's data. Given a folder/selection of photos, it extracts
   filename + date/time (from EXIF DateTimeOriginal when the file is
   a JPG that has it, otherwise falling back to the file's last-
   modified timestamp) into an editable table, then exports a CSV
   with the same columns as Tab 1's template (Nama File, Latitude,
   Longitude, Tanggal, Waktu, Lokasi, Alamat) — Latitude/Longitude/
   Lokasi/Alamat left blank for the user to fill in afterward.

   Built for cameras/photos that lost their capture date (matching
   this whole app's premise: devices in restricted areas often can't
   record proper metadata), so the file-system fallback is clearly
   labeled as an estimate the user should double-check, not treated
   as ground truth.
   ========================================================= */
(function () {
  'use strict';

  const state = { rows: [] }; // { file, date: 'YYYY-MM-DD', time: 'HH:MM', source: 'exif'|'file' }

  const el = {
    dropZone: document.getElementById('cbDropZone'),
    fileInput: document.getElementById('cbFileInput'),
    folderInput: document.getElementById('cbFolderInput'),
    fileInfo: document.getElementById('cbFileInfo'),
    count: document.getElementById('cbCount'),
    tableWrap: document.getElementById('cbTableWrap'),
    tableBody: document.getElementById('cbTableBody'),
    empty: document.getElementById('cbEmpty'),
    downloadBtn: document.getElementById('cbDownloadBtn')
  };

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

  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter(f => (f.type || '').startsWith('image/') || /\.(jpe?g|png)$/i.test(f.name));
    if (!files.length) { alert('Tidak ada file gambar yang terdeteksi.'); return; }
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    el.fileInfo.classList.remove('hidden');
    el.fileInfo.innerHTML = `<span>Memproses <strong>${files.length}</strong> foto…</span>`;
    el.downloadBtn.disabled = true;

    const rows = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const nameNoExt = file.name.replace(/\.[^.]+$/, '');
      let dt = await extractExifDateTime(file);
      let source = 'exif';
      if (!dt) {
        dt = fileTimestampToDateTime(file);
        source = 'file';
      }
      rows.push({ file: nameNoExt, date: dt.date, time: dt.time, source });
      if (i % 8 === 0) await new Promise(r => setTimeout(r, 0)); // keep UI responsive
    }

    state.rows = rows;
    el.fileInfo.innerHTML = `<span><strong>${files.length}</strong> foto diproses.</span>`;
    renderTable();
  }

  /**
   * Try to read DateTimeOriginal (falls back to 0th.DateTime) from a
   * JPEG's EXIF via piexif. Returns { date, time } or null — never
   * throws (non-JPEGs, missing EXIF, or corrupt data all just mean
   * "no EXIF date available", handled by the file-timestamp fallback).
   */
  async function extractExifDateTime(file) {
    const isJpeg = /\.jpe?g$/i.test(file.name || '') || (file.type || '').toLowerCase().includes('jpeg');
    if (!isJpeg) return null;
    try {
      const binary = await readFileAsBinaryString(file);
      const dataURL = 'data:image/jpeg;base64,' + btoa(binary);
      const exifObj = piexif.load(dataURL);
      const raw = (exifObj.Exif && exifObj.Exif[piexif.ExifIFD.DateTimeOriginal])
        || (exifObj['0th'] && exifObj['0th'][piexif.ImageIFD.DateTime]);
      if (!raw) return null;
      const m = String(raw).match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/);
      if (!m) return null;
      return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };
    } catch (e) {
      return null;
    }
  }

  function fileTimestampToDateTime(file) {
    const d = new Date(file.lastModified);
    const p = (n) => String(n).padStart(2, '0');
    return {
      date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
      time: `${p(d.getHours())}:${p(d.getMinutes())}`
    };
  }

  function readFileAsBinaryString(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Gagal membaca file.'));
      reader.readAsBinaryString(file);
    });
  }

  function renderTable() {
    const total = state.rows.length;
    el.empty.classList.toggle('hidden', total > 0);
    el.tableWrap.classList.toggle('hidden', total === 0);
    el.downloadBtn.disabled = total === 0;
    if (!total) { el.tableBody.innerHTML = ''; el.count.textContent = ''; return; }

    const exifCount = state.rows.filter(r => r.source === 'exif').length;
    el.count.textContent = `${total} foto — ${exifCount} dari EXIF, ${total - exifCount} dari file system`;

    el.tableBody.innerHTML = state.rows.map((row, i) => `
      <tr data-index="${i}">
        <td>${i + 1}</td>
        <td class="dp-file">${escapeHtml(row.file)}</td>
        <td><input type="date" class="cb-date-input" data-index="${i}" value="${row.date}"></td>
        <td><input type="time" class="cb-time-input" data-index="${i}" value="${row.time}"></td>
        <td><span class="cb-source-badge ${row.source === 'exif' ? 'cb-source-exif' : 'cb-source-file'}">${row.source === 'exif' ? 'EXIF' : 'File System'}</span></td>
      </tr>
    `).join('');
  }

  el.tableBody.addEventListener('change', (e) => {
    const dateInput = e.target.closest('.cb-date-input');
    const timeInput = e.target.closest('.cb-time-input');
    if (dateInput) state.rows[Number(dateInput.dataset.index)].date = dateInput.value;
    if (timeInput) state.rows[Number(timeInput.dataset.index)].time = timeInput.value;
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
      lines.push([csvField(row.file), '', '', csvField(row.date), csvField(row.time), '', ''].join(','));
    });
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const stamp = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const name = `csv-dari-foto_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}.csv`;
    saveAs(blob, name);
  });
})();
