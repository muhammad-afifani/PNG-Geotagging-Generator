/* geotag.js — Tab 3: write GPS + date/time into JPG EXIF metadata
 * ONLY (no overlay burned in). For field photos missing geotags. */
(function () {
  'use strict';

  const state = { photos: [] };

  const el = {
    dropZone: document.getElementById('geotagDropZone'),
    input: document.getElementById('geotagInput'),
    fileInfo: document.getElementById('geotagFileInfo'),
    source: document.getElementById('geotagSource'),
    manualFields: document.getElementById('geotagManualFields'),
    lat: document.getElementById('geotagLat'),
    lng: document.getElementById('geotagLng'),
    dateTime: document.getElementById('geotagDateTime'),
    scatter: document.getElementById('geotagScatter'),
    scatterRow: document.getElementById('geotagScatterRow'),
    scatterMeters: document.getElementById('geotagScatterMeters'),
    scatterMetersVal: document.getElementById('geotagScatterMetersVal'),
    clean: document.getElementById('geotagClean'),
    statPhotos: document.getElementById('geotagStatPhotos'),
    generateBtn: document.getElementById('geotagGenerateBtn'),
    progressWrap: document.getElementById('geotagProgressWrap'),
    progressFill: document.getElementById('geotagProgressFill'),
    progressText: document.getElementById('geotagProgressText'),
    doneMsg: document.getElementById('geotagDoneMsg')
  };

  el.dropZone.addEventListener('click', () => el.input.click());
  el.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); el.dropZone.classList.add('dragover'); });
  el.dropZone.addEventListener('dragleave', () => el.dropZone.classList.remove('dragover'));
  el.dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); el.dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  el.input.addEventListener('change', () => handleFiles(el.input.files));

  function handleFiles(fileList) {
    const files = Array.from(fileList).filter(f => /\.jpe?g$/i.test(f.name) || (f.type || '').includes('jpeg'));
    if (!files.length) { alert('Hanya file JPG yang didukung untuk penulisan metadata EXIF.'); return; }
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    state.photos = files;
    el.fileInfo.classList.remove('hidden');
    el.fileInfo.innerHTML = `<strong>${files.length}</strong> foto JPG dimuat.`;
    refresh();
  }

  el.source.addEventListener('change', () => {
    el.manualFields.style.display = el.source.value === 'manual' ? '' : 'none';
    refresh();
  });
  el.scatter.addEventListener('change', () => {
    el.scatterRow.style.display = el.scatter.checked ? '' : 'none';
  });
  el.scatterRow.style.display = 'none';
  el.scatterMeters.addEventListener('input', () => {
    el.scatterMetersVal.textContent = el.scatterMeters.value + ' m';
  });

  function refresh() {
    el.statPhotos.textContent = state.photos.length;
    el.generateBtn.disabled = state.photos.length === 0;
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('read fail'));
      r.readAsDataURL(file);
    });
  }

  el.generateBtn.addEventListener('click', run);

  async function run() {
    if (!state.photos.length) return;

    // resolve coordinate source
    const useCsv = el.source.value === 'csv';
    let rows = [];
    if (useCsv) {
      rows = (window.GeoStamp ? window.GeoStamp.getRows() : []) || [];
      if (!rows.length) { alert('CSV belum dimuat di Tab 1. Muat CSV dulu, atau pakai input manual.'); return; }
    } else {
      const lat = parseFloat(el.lat.value), lng = parseFloat(el.lng.value);
      if (isNaN(lat) || isNaN(lng)) { alert('Masukkan Latitude dan Longitude yang valid.'); return; }
    }

    el.generateBtn.disabled = true;
    el.doneMsg.classList.add('hidden');
    el.progressWrap.classList.remove('hidden');
    el.progressFill.style.width = '0%';

    try {
      const zip = new JSZip();
      const total = state.photos.length;
      const used = new Set();
      let ok = 0, warn = 0;

      for (let i = 0; i < total; i++) {
        const photo = state.photos[i];

        // determine coord + date for this photo
        let lat, lng, dateObj;
        if (useCsv) {
          const row = rows[i] || rows[rows.length - 1];
          lat = Number(row.lat); lng = Number(row.lng);
          dateObj = parseRowDate(row);
        } else {
          lat = parseFloat(el.lat.value);
          lng = parseFloat(el.lng.value);
          dateObj = el.dateTime.value ? new Date(el.dateTime.value) : null;
        }

        if (el.scatter.checked) {
          const s = scatterCoordinate(lat, lng, Number(el.scatterMeters.value));
          lat = s.lat; lng = s.lng;
        }

        try {
          const res = await writeGeotagToJpeg(photo, {
            lat, lng, date: dateObj, stripOthers: el.clean.checked
          });
          if (res.blob) {
            let base = (window.GeoStamp ? window.GeoStamp.sanitizeFilename(photo.name.replace(/\.[^.]+$/, '')) : photo.name.replace(/\.[^.]+$/, ''));
            let name = base, dc = 1;
            while (used.has(name)) name = base + '_' + (dc++);
            used.add(name);
            zip.file(name + '.jpg', res.blob);
            ok++;
          } else { warn++; }
        } catch (e) { console.error(e); warn++; }

        const pct = Math.round(((i + 1) / total) * 100);
        el.progressFill.style.width = pct + '%';
        el.progressText.textContent = `Menulis metadata ${i + 1}/${total}…`;
        if (i % 4 === 0) await new Promise(r => setTimeout(r, 0));
      }

      if (ok === 0) {
        el.progressWrap.classList.add('hidden');
        alert('Tidak ada foto yang berhasil diproses. Pastikan file berformat JPG.');
        return;
      }

      el.progressText.textContent = 'Membuat ZIP…';
      const zipBlob = await zip.generateAsync({ type: 'blob' }, (m) => {
        el.progressFill.style.width = m.percent.toFixed(0) + '%';
      });
      saveAs(zipBlob, `geotagged-photos_${window.GeoStamp ? window.GeoStamp.timestampSlug() : Date.now()}.zip`);

      el.progressWrap.classList.add('hidden');
      el.doneMsg.classList.remove('hidden');
      el.doneMsg.innerHTML = `✔ Selesai! <strong>${ok}</strong> foto JPG dengan metadata GPS+tanggal telah diunduh.`
        + (warn ? `<br><span style="color:var(--text-dim);font-size:11.5px;">${warn} foto dilewati (bukan JPG valid).</span>` : '');
    } catch (err) {
      console.error(err);
      el.progressWrap.classList.add('hidden');
      alert('Terjadi kesalahan: ' + (err.message || err));
    } finally {
      el.generateBtn.disabled = false;
    }
  }

  function parseRowDate(row) {
    if (!row.date) return null;
    try {
      let y, mo, d;
      if (/^\d{4}-\d{2}-\d{2}/.test(row.date)) {
        [y, mo, d] = row.date.split('-').map(Number);
      } else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(row.date)) {
        const parts = row.date.split('/').map(Number);
        d = parts[0]; mo = parts[1]; y = parts[2];
      } else { return null; }
      let hh = 0, mm = 0;
      if (row.time) {
        const m = String(row.time).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (m) {
          hh = Number(m[1]); mm = Number(m[2]);
          if (m[3]) { const pm = /PM/i.test(m[3]); if (pm && hh < 12) hh += 12; if (!pm && hh === 12) hh = 0; }
        }
      }
      return new Date(y, mo - 1, d, hh, mm, 0);
    } catch (e) { return null; }
  }
})();
