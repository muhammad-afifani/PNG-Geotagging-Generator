/* attach.js — Tab 2: burn the GPS Map Camera overlay directly onto
 * uploaded photos (instead of exporting a transparent PNG), matched
 * to CSV rows, with optional coordinate scatter and EXIF embedding. */
(function () {
  'use strict';

  const state = {
    photos: [],          // array of File
  };

  const el = {
    dropZone: document.getElementById('attachDropZone'),
    input: document.getElementById('attachInput'),
    fileInfo: document.getElementById('attachFileInfo'),
    matchMode: document.getElementById('attachMatchMode'),
    scatter: document.getElementById('attachScatter'),
    scatterRow: document.getElementById('attachScatterRow'),
    scatterMeters: document.getElementById('attachScatterMeters'),
    scatterMetersVal: document.getElementById('attachScatterMetersVal'),
    writeExif: document.getElementById('attachWriteExif'),
    cleanExif: document.getElementById('attachCleanExif'),
    format: document.getElementById('attachFormat'),
    quality: document.getElementById('attachQuality'),
    qualityVal: document.getElementById('attachQualityVal'),
    previewCanvas: document.getElementById('attachPreviewCanvas'),
    previewHint: document.getElementById('attachPreviewHint'),
    statPhotos: document.getElementById('attachStatPhotos'),
    statRows: document.getElementById('attachStatRows'),
    generateBtn: document.getElementById('attachGenerateBtn'),
    progressWrap: document.getElementById('attachProgressWrap'),
    progressFill: document.getElementById('attachProgressFill'),
    progressText: document.getElementById('attachProgressText'),
    doneMsg: document.getElementById('attachDoneMsg')
  };

  // ---------- file input ----------
  el.dropZone.addEventListener('click', () => el.input.click());
  el.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); el.dropZone.classList.add('dragover'); });
  el.dropZone.addEventListener('dragleave', () => el.dropZone.classList.remove('dragover'));
  el.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  el.input.addEventListener('change', () => handleFiles(el.input.files));

  function handleFiles(fileList) {
    const files = Array.from(fileList).filter(f =>
      /\.(jpe?g|png)$/i.test(f.name) || (f.type || '').startsWith('image/'));
    if (!files.length) return;
    // natural sort by filename so "order" matching is intuitive
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    state.photos = files;
    el.fileInfo.classList.remove('hidden');
    el.fileInfo.innerHTML = `<strong>${files.length}</strong> foto dimuat.`;
    refresh();
    renderPreview();
  }

  // ---------- options UI ----------
  el.scatter.addEventListener('change', () => {
    el.scatterRow.style.display = el.scatter.checked ? '' : 'none';
    renderPreview();
  });
  el.scatterRow.style.display = 'none';
  el.scatterMeters.addEventListener('input', () => {
    el.scatterMetersVal.textContent = el.scatterMeters.value + ' m';
  });
  el.quality.addEventListener('input', () => {
    el.qualityVal.textContent = el.quality.value + '%';
  });
  el.format.addEventListener('change', () => {
    // EXIF only applies to JPG
    const isJpg = el.format.value === 'image/jpeg';
    el.writeExif.disabled = !isJpg;
    el.cleanExif.disabled = !isJpg || !el.writeExif.checked;
  });
  el.writeExif.addEventListener('change', () => {
    el.cleanExif.disabled = !el.writeExif.checked;
  });
  el.matchMode.addEventListener('change', renderPreview);

  // ---------- stats ----------
  function refresh() {
    const rows = (window.GeoStamp ? window.GeoStamp.getRows() : []) || [];
    el.statPhotos.textContent = state.photos.length;
    el.statRows.textContent = rows.length;
    el.generateBtn.disabled = !(state.photos.length && rows.length);
    if (!rows.length) {
      el.previewHint.textContent = 'CSV belum dimuat. Buka Tab 1 dan upload CSV dulu.';
    }
  }
  window.addEventListener('geostamp:tabchange', (e) => {
    if (e.detail.tab === 'tab-attach') refresh();
  });

  // ---------- pairing photo <-> CSV row ----------
  function rowForPhoto(photo, index, rows) {
    if (el.matchMode.value === 'filename') {
      const base = photo.name.replace(/\.[^.]+$/, '').toLowerCase();
      const found = rows.find(r => String(r.file || '').replace(/\.[^.]+$/, '').toLowerCase() === base);
      if (found) return found;
      // fall back to order if no filename match
    }
    return rows[index] || rows[rows.length - 1] || null;
  }

  // ---------- load a File into an HTMLImageElement ----------
  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { resolve({ img, url }); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gagal memuat foto ' + file.name)); };
      img.src = url;
    });
  }

  // ---------- compose overlay onto a photo ----------
  async function composePhoto(photo, row, settings) {
    const { img, url } = await loadImageFromFile(photo);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // build an overlay-sized transparent canvas at the photo's width,
      // then draw it onto the photo. The overlay renderer sizes itself
      // to the canvas dims it's given.
      const overlayCanvas = document.createElement('canvas');
      overlayCanvas.width = canvas.width;
      overlayCanvas.height = canvas.height;

      let renderRow = window.GeoStamp.applyProjectOverride(row, settings);
      // apply scatter to the row's coords for display + (later) EXIF
      let effLat = renderRow.lat, effLng = renderRow.lng;
      if (el.scatter.checked) {
        const s = scatterCoordinate(Number(renderRow.lat), Number(renderRow.lng), Number(el.scatterMeters.value));
        effLat = s.lat; effLng = s.lng;
        renderRow = { ...renderRow, lat: effLat, lng: effLng };
      }

      // resolve map (uses the same online/offline logic as tab 1)
      let mapImg = null;
      if (settings.showMap && settings.mapSource !== 'offline') {
        mapImg = await window.GeoStamp.resolveMapForRow(renderRow, settings);
      }
      const opts = window.GeoStamp.buildOverlayOpts(renderRow, { w: canvas.width, h: canvas.height }, settings, mapImg);
      window.GeoStamp.renderOverlay(overlayCanvas, renderRow, opts);
      ctx.drawImage(overlayCanvas, 0, 0);

      return { canvas, effLat, effLng };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ---------- preview ----------
  let previewToken = 0;
  async function renderPreview() {
    if (!window.GeoStamp) return;
    const rows = window.GeoStamp.getRows() || [];
    if (!state.photos.length || !rows.length) return;
    const myToken = ++previewToken;
    const settings = window.GeoStamp.getSettings();
    const photo = state.photos[0];
    const row = rowForPhoto(photo, 0, rows);
    if (!row) return;
    try {
      const { canvas } = await composePhoto(photo, row, settings);
      if (myToken !== previewToken) return;
      const pc = el.previewCanvas;
      pc.width = canvas.width;
      pc.height = canvas.height;
      pc.getContext('2d').drawImage(canvas, 0, 0);
      el.previewHint.textContent = `Preview: ${photo.name} (${canvas.width}×${canvas.height})`;
    } catch (err) {
      el.previewHint.textContent = 'Gagal membuat preview: ' + err.message;
    }
  }

  // ---------- canvas -> blob ----------
  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => {
      try {
        canvas.toBlob((b) => resolve(b), type, quality);
      } catch (e) { resolve(null); }
    });
  }

  // ---------- generate ----------
  el.generateBtn.addEventListener('click', runAttach);

  async function runAttach() {
    const rows = window.GeoStamp.getRows() || [];
    if (!state.photos.length || !rows.length) return;

    el.generateBtn.disabled = true;
    el.doneMsg.classList.add('hidden');
    el.progressWrap.classList.remove('hidden');
    el.progressFill.style.width = '0%';

    try {
      const settings = window.GeoStamp.getSettings();
      const zip = new JSZip();
      const total = state.photos.length;
      const fmt = el.format.value;
      const isJpg = fmt === 'image/jpeg';
      const quality = Number(el.quality.value) / 100;
      const ext = isJpg ? 'jpg' : 'png';
      const used = new Set();
      let exifWarn = 0, encoded = 0;

      for (let i = 0; i < total; i++) {
        const photo = state.photos[i];
        const row = rowForPhoto(photo, i, rows);
        if (!row) continue;

        let composed;
        try {
          composed = await composePhoto(photo, row, settings);
        } catch (e) {
          console.error('compose failed', photo.name, e);
          continue;
        }

        let blob = await canvasToBlob(composed.canvas, fmt, quality);
        if (!blob) continue;

        // optionally write EXIF GPS + date into the JPG output
        if (isJpg && el.writeExif.checked && !el.writeExif.disabled) {
          try {
            const dateObj = parseRowDate(row);
            const jpgFile = new File([blob], 'tmp.jpg', { type: 'image/jpeg' });
            const res = await writeGeotagToJpeg(jpgFile, {
              lat: Number(composed.effLat),
              lng: Number(composed.effLng),
              date: dateObj,
              stripOthers: el.cleanExif.checked
            });
            if (res.blob) blob = res.blob;
            else if (res.warning) exifWarn++;
          } catch (e) { exifWarn++; }
        }

        let base = window.GeoStamp.sanitizeFilename(row.file || photo.name.replace(/\.[^.]+$/, ''));
        let name = base, dc = 1;
        while (used.has(name)) name = base + '_' + (dc++);
        used.add(name);
        zip.file(name + '.' + ext, blob);
        encoded++;

        const pct = Math.round(((i + 1) / total) * 100);
        el.progressFill.style.width = pct + '%';
        el.progressText.textContent = `Memproses ${i + 1}/${total} foto…`;
        if (i % 3 === 0) await new Promise(r => setTimeout(r, 0));
      }

      if (encoded === 0) {
        el.progressWrap.classList.add('hidden');
        alert('Tidak ada foto yang berhasil diproses.');
        return;
      }

      el.progressText.textContent = 'Membuat ZIP…';
      const zipBlob = await zip.generateAsync({ type: 'blob' }, (m) => {
        el.progressFill.style.width = m.percent.toFixed(0) + '%';
      });
      saveAs(zipBlob, `geostamp-photos_${window.GeoStamp.timestampSlug()}.zip`);

      el.progressWrap.classList.add('hidden');
      el.doneMsg.classList.remove('hidden');
      el.doneMsg.innerHTML = `Selesai! <strong>${encoded}</strong> foto ter-overlay telah diunduh sebagai ZIP.`
        + (exifWarn ? `<br><span style="color:var(--text-dim);font-size:11.5px;">${exifWarn} foto tidak bisa ditulisi EXIF (bukan JPG).</span>` : '');
    } catch (err) {
      console.error(err);
      el.progressWrap.classList.add('hidden');
      alert('Terjadi kesalahan: ' + (err.message || err));
    } finally {
      el.generateBtn.disabled = false;
    }
  }

  // parse a normalized row's date+time into a JS Date (best effort)
  function parseRowDate(row) {
    if (!row.date) return null;
    try {
      // date can be DD/MM/YYYY or YYYY-MM-DD; time "HH:MM" or "H:MM AM/PM"
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
          if (m[3]) {
            const pm = /PM/i.test(m[3]);
            if (pm && hh < 12) hh += 12;
            if (!pm && hh === 12) hh = 0;
          }
        }
      }
      return new Date(y, mo - 1, d, hh, mm, 0);
    } catch (e) { return null; }
  }
})();
