/* =========================================================
   main.js — application controller: wires up UI, drives the
   preview, and runs the batched async ZIP generation.
   ========================================================= */

(function () {
  'use strict';

  // ---------- state ----------
  const state = {
    headers: [],
    colMap: {},
    rows: [],           // normalized rows
    logoImg: null,       // HTMLImageElement or null (null = self-drawn default)
    mapImg: null,        // reserved (unused directly; map thumbnails are built per-row now)
    sampleIndex: 0,
    settings: loadSettings()
  };

  // ---------- element refs ----------
  const el = {
    dataInputModeRadios: document.querySelectorAll('input[name="dataInputMode"]'),
    csvModePanel: document.getElementById('csvModePanel'),
    manualModePanel: document.getElementById('manualModePanel'),
    dropZone: document.getElementById('dropZone'),
    csvInput: document.getElementById('csvInput'),
    csvInfo: document.getElementById('csvInfo'),
    csvColMap: document.getElementById('csvColMap'),

    manualFile: document.getElementById('manualFile'),
    manualLat: document.getElementById('manualLat'),
    manualLng: document.getElementById('manualLng'),
    manualDate: document.getElementById('manualDate'),
    manualTime: document.getElementById('manualTime'),
    manualLocation: document.getElementById('manualLocation'),
    manualAddress: document.getElementById('manualAddress'),
    manualNote: document.getElementById('manualNote'),
    manualPhone: document.getElementById('manualPhone'),
    manualTemperature: document.getElementById('manualTemperature'),
    manualWind: document.getElementById('manualWind'),
    manualAltitude: document.getElementById('manualAltitude'),
    manualDirection: document.getElementById('manualDirection'),
    addManualRowBtn: document.getElementById('addManualRowBtn'),

    dataPreviewSection: document.getElementById('dataPreviewSection'),
    dataPreviewCount: document.getElementById('dataPreviewCount'),
    dataPreviewBody: document.getElementById('dataPreviewBody'),
    clearRowsBtn: document.getElementById('clearRowsBtn'),

    logoModeRadios: document.querySelectorAll('input[name="logoMode"]'),
    logoUploadZone: document.getElementById('logoUploadZone'),
    logoInput: document.getElementById('logoInput'),
    logoPreview: document.getElementById('logoPreview'),
    logoStatus: document.getElementById('logoStatus'),

    overlayTemplate: document.getElementById('overlayTemplate'),
    template2Fields: document.getElementById('template2Fields'),
    gmtOffset: document.getElementById('gmtOffset'),
    showTime: document.getElementById('showTime'),
    autoGeocode: document.getElementById('autoGeocode'),
    mapAspect: document.getElementById('mapAspect'),
    noteOverride: document.getElementById('noteOverride'),
    contactOverride: document.getElementById('contactOverride'),

    canvasSize: document.getElementById('canvasSize'),
    customSizeRow: document.getElementById('customSizeRow'),
    customW: document.getElementById('customW'),
    customH: document.getElementById('customH'),
    dateFormat: document.getElementById('dateFormat'),
    overlayPos: document.getElementById('overlayPos'),
    overlayScale: document.getElementById('overlayScale'),
    overlayScaleVal: document.getElementById('overlayScaleVal'),
    bgOpacity: document.getElementById('bgOpacity'),
    bgOpacityVal: document.getElementById('bgOpacityVal'),
    fontColor: document.getElementById('fontColor'),
    fontColorHex: document.getElementById('fontColorHex'),
    fontScale: document.getElementById('fontScale'),
    fontScaleVal: document.getElementById('fontScaleVal'),
    cornerRadius: document.getElementById('cornerRadius'),
    cornerRadiusVal: document.getElementById('cornerRadiusVal'),
    shadowStrength: document.getElementById('shadowStrength'),
    shadowStrengthVal: document.getElementById('shadowStrengthVal'),
    badgeStyle: document.getElementById('badgeStyle'),
    badgeScale: document.getElementById('badgeScale'),
    badgeScaleVal: document.getElementById('badgeScaleVal'),
    projectNameOverride: document.getElementById('projectNameOverride'),
    showMap: document.getElementById('showMap'),
    showLocation: document.getElementById('showLocation'),
    resetSettingsBtn: document.getElementById('resetSettingsBtn'),

    mapSource: document.getElementById('mapSource'),
    mapSourceField: document.getElementById('mapSourceField'),
    mapZoom: document.getElementById('mapZoom'),
    mapZoomVal: document.getElementById('mapZoomVal'),
    mapZoomField: document.getElementById('mapZoomField'),
    showMapPin: document.getElementById('showMapPin'),
    mapPinField: document.getElementById('mapPinField'),
    mapNoticeField: document.getElementById('mapNoticeField'),
    mapNoticeText: document.getElementById('mapNoticeText'),
    mapAttribution: document.getElementById('mapAttribution'),

    exportPresetBtn: document.getElementById('exportPresetBtn'),
    importPresetInput: document.getElementById('importPresetInput'),

    previewCanvas: document.getElementById('previewCanvas'),
    previewEmpty: document.getElementById('previewEmpty'),
    previewRowTag: document.getElementById('previewRowTag'),
    prevSampleBtn: document.getElementById('prevSampleBtn'),
    nextSampleBtn: document.getElementById('nextSampleBtn'),
    downloadSampleBtn: document.getElementById('downloadSampleBtn'),

    statTotal: document.getElementById('statTotal'),
    generateBtn: document.getElementById('generateBtn'),
    progressWrap: document.getElementById('progressWrap'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    progressEta: document.getElementById('progressEta'),
    doneMsg: document.getElementById('doneMsg'),
    doneCount: document.getElementById('doneCount'),

    themeToggle: document.getElementById('themeToggle'),
    themeLabel: document.getElementById('themeLabel'),
    themeIcon: document.getElementById('themeIcon')
  };

  // ---------- theme ----------
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    el.themeLabel.textContent = theme === 'dark' ? 'Light' : 'Dark';
    saveTheme(theme);
  }
  el.themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
  applyTheme(loadTheme());

  // ---------- settings <-> UI ----------
  function applySettingsToUI(s) {
    el.overlayTemplate.value = s.template;
    el.gmtOffset.value = s.gmtOffset;
    el.showTime.checked = s.showTime;
    el.autoGeocode.checked = s.autoGeocode;
    el.mapAspect.value = s.mapAspect;
    el.noteOverride.value = s.noteOverride || '';
    el.contactOverride.value = s.contactOverride || '';
    updateTemplateFieldVisibility();

    el.canvasSize.value = s.canvasSize;
    el.customW.value = s.customW;
    el.customH.value = s.customH;
    el.customSizeRow.classList.toggle('hidden', s.canvasSize !== 'custom');
    el.dateFormat.value = s.dateFormat;
    el.overlayPos.value = s.overlayPos;
    el.overlayScale.value = s.overlayScale;
    el.overlayScaleVal.textContent = s.overlayScale + '%';
    el.bgOpacity.value = s.bgOpacity;
    el.bgOpacityVal.textContent = s.bgOpacity + '%';
    el.fontColor.value = s.fontColor;
    el.fontColorHex.value = s.fontColor;
    el.fontScale.value = s.fontScale;
    el.fontScaleVal.textContent = s.fontScale + '%';
    el.cornerRadius.value = s.cornerRadius;
    el.cornerRadiusVal.textContent = s.cornerRadius + 'px';
    el.shadowStrength.value = s.shadowStrength;
    el.shadowStrengthVal.textContent = s.shadowStrength + '%';
    el.badgeStyle.value = s.badgeStyle;
    el.badgeScale.value = s.badgeScale;
    el.badgeScaleVal.textContent = s.badgeScale + '%';
    el.projectNameOverride.value = s.projectNameOverride || '';
    el.showMap.checked = s.showMap;
    el.showLocation.checked = s.showLocation;
    el.mapSource.value = s.mapSource;
    el.mapZoom.value = s.mapZoom;
    el.mapZoomVal.textContent = s.mapZoom;
    el.showMapPin.checked = s.showMapPin;
    updateMapFieldVisibility();
  }

  function readSettingsFromUI() {
    return {
      template: el.overlayTemplate.value,
      gmtOffset: el.gmtOffset.value,
      showTime: el.showTime.checked,
      autoGeocode: el.autoGeocode.checked,
      mapAspect: el.mapAspect.value,
      noteOverride: el.noteOverride.value,
      contactOverride: el.contactOverride.value,

      canvasSize: el.canvasSize.value,
      customW: parseInt(el.customW.value) || 1080,
      customH: parseInt(el.customH.value) || 500,
      dateFormat: el.dateFormat.value,
      overlayPos: el.overlayPos.value,
      overlayScale: parseInt(el.overlayScale.value),
      bgOpacity: parseInt(el.bgOpacity.value),
      fontColor: el.fontColorHex.value,
      fontScale: parseInt(el.fontScale.value),
      cornerRadius: parseInt(el.cornerRadius.value),
      shadowStrength: parseInt(el.shadowStrength.value),
      badgeStyle: el.badgeStyle.value,
      badgeScale: parseInt(el.badgeScale.value),
      projectNameOverride: el.projectNameOverride.value,
      showMap: el.showMap.checked,
      showLocation: el.showLocation.checked,
      mapSource: el.mapSource.value,
      mapZoom: parseInt(el.mapZoom.value),
      showMapPin: el.showMapPin.checked
    };
  }

  function updateTemplateFieldVisibility() {
    el.template2Fields.classList.toggle('hidden', el.overlayTemplate.value !== 'gpscam2');
  }

  function updateMapFieldVisibility() {
    const mapOn = el.showMap.checked;
    const isOffline = el.mapSource.value === 'offline';
    el.mapSourceField.classList.toggle('hidden', !mapOn);
    el.mapZoomField.classList.toggle('hidden', !mapOn || isOffline);
    el.mapPinField.classList.toggle('hidden', !mapOn);
    el.mapNoticeField.classList.toggle('hidden', !mapOn || isOffline);
    el.mapAttribution.classList.toggle('hidden', !mapOn || isOffline);
    if (mapOn && !isOffline) {
      el.mapNoticeText.textContent = 'Mode ini mengambil gambar peta asli dari internet saat generate — pastikan koneksi stabil. Jika sebuah titik gagal dimuat, sistem otomatis memakai placeholder untuk baris tersebut agar proses tetap lanjut.';
    }
  }

  function getCanvasDims(s) {
    if (s.canvasSize === 'custom') return { w: s.customW, h: s.customH };
    const [w, h] = s.canvasSize.split('x').map(Number);
    return { w, h };
  }

  function onSettingsChanged() {
    state.settings = readSettingsFromUI();
    saveSettings(state.settings);
    renderPreview();
  }

  applySettingsToUI(state.settings);

  [el.canvasSize, el.dateFormat, el.overlayPos, el.showMap, el.showLocation, el.mapSource, el.showMapPin].forEach(node => {
    node.addEventListener('change', () => {
      el.customSizeRow.classList.toggle('hidden', el.canvasSize.value !== 'custom');
      updateMapFieldVisibility();
      onSettingsChanged();
    });
  });

  [el.overlayTemplate, el.gmtOffset, el.showTime, el.autoGeocode, el.mapAspect].forEach(node => {
    node.addEventListener('change', () => {
      updateTemplateFieldVisibility();
      onSettingsChanged();
    });
  });
  [el.noteOverride, el.contactOverride].forEach(node => node.addEventListener('input', onSettingsChanged));
  [el.customW, el.customH].forEach(node => node.addEventListener('input', onSettingsChanged));

  el.mapZoom.addEventListener('input', () => {
    el.mapZoomVal.textContent = el.mapZoom.value;
    onSettingsChanged();
  });

  el.overlayScale.addEventListener('input', () => {
    el.overlayScaleVal.textContent = el.overlayScale.value + '%';
    onSettingsChanged();
  });
  el.bgOpacity.addEventListener('input', () => {
    el.bgOpacityVal.textContent = el.bgOpacity.value + '%';
    onSettingsChanged();
  });
  el.fontScale.addEventListener('input', () => {
    el.fontScaleVal.textContent = el.fontScale.value + '%';
    onSettingsChanged();
  });
  el.cornerRadius.addEventListener('input', () => {
    el.cornerRadiusVal.textContent = el.cornerRadius.value + 'px';
    onSettingsChanged();
  });
  el.shadowStrength.addEventListener('input', () => {
    el.shadowStrengthVal.textContent = el.shadowStrength.value + '%';
    onSettingsChanged();
  });
  el.badgeStyle.addEventListener('change', onSettingsChanged);
  el.badgeScale.addEventListener('input', () => {
    el.badgeScaleVal.textContent = el.badgeScale.value + '%';
    onSettingsChanged();
  });
  el.projectNameOverride.addEventListener('input', onSettingsChanged);
  el.fontColor.addEventListener('input', () => {
    el.fontColorHex.value = el.fontColor.value;
    onSettingsChanged();
  });
  el.fontColorHex.addEventListener('change', () => {
    if (/^#[0-9a-fA-F]{6}$/.test(el.fontColorHex.value)) {
      el.fontColor.value = el.fontColorHex.value;
      onSettingsChanged();
    }
  });

  el.resetSettingsBtn.addEventListener('click', () => {
    state.settings = { ...DEFAULT_SETTINGS };
    saveSettings(state.settings);
    applySettingsToUI(state.settings);
    renderPreview();
  });

  el.exportPresetBtn.addEventListener('click', () => {
    downloadJSON(state.settings, 'gps-overlay-preset.json');
  });

  el.importPresetInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        state.settings = { ...DEFAULT_SETTINGS, ...imported };
        saveSettings(state.settings);
        applySettingsToUI(state.settings);
        renderPreview();
      } catch (err) {
        alert('File preset JSON tidak valid.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // ---------- data input mode (CSV vs manual) ----------
  el.dataInputModeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const mode = document.querySelector('input[name="dataInputMode"]:checked').value;
      el.csvModePanel.classList.toggle('hidden', mode !== 'csv');
      el.manualModePanel.classList.toggle('hidden', mode !== 'manual');
    });
  });

  /**
   * Shared refresh after state.rows changes for ANY reason (CSV load,
   * manual add, manual delete) — keeps stats, the generate button, the
   * sample preview, and the data-preview table all in sync in one place.
   *
   * sampleIndexMode:
   *   'first'  - jump to row 0 (fresh CSV load)
   *   'last'   - jump to the last row (a new manual row was just added)
   *   'clamp'  - keep the current index, only pull it back in bounds if
   *              it now overflows (a row was deleted)
   */
  function refreshAfterRowsChanged(sampleIndexMode) {
    if (sampleIndexMode === 'first') {
      state.sampleIndex = 0;
    } else if (sampleIndexMode === 'last') {
      state.sampleIndex = state.rows.length ? state.rows.length - 1 : 0;
    } else if (state.sampleIndex >= state.rows.length) {
      state.sampleIndex = state.rows.length ? state.rows.length - 1 : 0;
    }
    el.statTotal.textContent = state.rows.length;
    el.generateBtn.disabled = state.rows.length === 0;
    el.previewRowTag.textContent = state.rows.length
      ? `Baris contoh #${state.sampleIndex + 1} dari ${state.rows.length}`
      : '—';
    renderDataPreviewTable();
    renderPreview();
  }

  // ---------- CSV upload ----------
  el.dropZone.addEventListener('click', () => el.csvInput.click());
  el.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); el.dropZone.classList.add('dragover'); });
  el.dropZone.addEventListener('dragleave', () => el.dropZone.classList.remove('dragover'));
  el.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleCSVFile(e.dataTransfer.files[0]);
  });
  el.csvInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleCSVFile(e.target.files[0]);
  });

  async function handleCSVFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Mohon upload file .csv');
      return;
    }
    try {
      const { headers, rows } = await parseCSVFile(file);
      state.headers = headers;
      state.colMap = detectColumnMap(headers);
      state.rows = normalizeRows(rows, state.colMap);
      state.sampleIndex = 0;

      el.csvInfo.classList.remove('hidden');
      el.csvInfo.innerHTML = `<span><strong>${file.name}</strong> — ${state.rows.length} baris</span>`;

      renderColMapUI();
      refreshAfterRowsChanged('first');
    } catch (err) {
      console.error(err);
      alert('Gagal membaca CSV. Pastikan format file benar.');
    }
  }

  // ---------- manual single-row input ----------
  function addManualRow() {
    const lat = parseFloat(el.manualLat.value);
    const lng = parseFloat(el.manualLng.value);
    if (isNaN(lat) || isNaN(lng)) {
      alert('Latitude dan Longitude wajib diisi dengan angka yang valid.');
      return;
    }
    const idx = state.rows.length;
    const fileName = el.manualFile.value.trim() || `IMG_${String(idx + 1).padStart(4, '0')}`;
    const location = el.manualLocation.value.trim();

    const row = {
      _index: idx,
      file: fileName,
      lat, lng,
      date: el.manualDate.value || '',
      time: el.manualTime.value || '',
      location,
      address: el.manualAddress.value.trim(),
      city: location,
      note: el.manualNote.value.trim(),
      phone: el.manualPhone.value.trim(),
      temperature: el.manualTemperature.value.trim(),
      wind: el.manualWind.value.trim(),
      altitude: el.manualAltitude.value.trim(),
      direction: el.manualDirection.value.trim()
    };
    state.rows.push(row);

    // clear the form for the next entry, ready for the next test photo
    [el.manualFile, el.manualLat, el.manualLng, el.manualLocation, el.manualAddress,
      el.manualNote, el.manualPhone, el.manualTemperature, el.manualWind, el.manualAltitude, el.manualDirection]
      .forEach(input => { input.value = ''; });

    refreshAfterRowsChanged('last');
    el.manualFile.focus();
  }
  el.addManualRowBtn.addEventListener('click', addManualRow);

  function deleteRow(index) {
    state.rows.splice(index, 1);
    state.rows.forEach((r, i) => { r._index = i; });
    refreshAfterRowsChanged('clamp');
  }

  el.clearRowsBtn.addEventListener('click', () => {
    if (!state.rows.length) return;
    if (!confirm(`Kosongkan semua ${state.rows.length} baris data?`)) return;
    state.rows = [];
    el.csvInfo.classList.add('hidden');
    el.csvColMap.classList.add('hidden');
    refreshAfterRowsChanged('first');
  });

  // ---------- data preview table ----------
  const DATA_PREVIEW_MAX_ROWS = 300;

  function renderDataPreviewTable() {
    const total = state.rows.length;
    el.dataPreviewSection.classList.toggle('hidden', total === 0);
    if (!total) { el.dataPreviewBody.innerHTML = ''; return; }

    const shown = state.rows.slice(0, DATA_PREVIEW_MAX_ROWS);
    el.dataPreviewCount.textContent = total > DATA_PREVIEW_MAX_ROWS
      ? `${total} baris (menampilkan ${DATA_PREVIEW_MAX_ROWS} pertama)`
      : `${total} baris`;

    el.dataPreviewBody.innerHTML = shown.map((row, i) => `
      <tr data-index="${i}" class="${i === state.sampleIndex ? 'active' : ''}">
        <td>${i + 1}</td>
        <td class="dp-file">${escapeHtml(row.file)}</td>
        <td>${isNaN(row.lat) ? '' : row.lat}</td>
        <td>${isNaN(row.lng) ? '' : row.lng}</td>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.time)}</td>
        <td>${escapeHtml(row.location)}</td>
        <td>${escapeHtml(row.address)}</td>
        <td><button class="dp-delete-btn" type="button" data-index="${i}" aria-label="Hapus baris">×</button></td>
      </tr>
    `).join('');
  }

  el.dataPreviewBody.addEventListener('click', (e) => {
    const delBtn = e.target.closest('.dp-delete-btn');
    if (delBtn) {
      deleteRow(Number(delBtn.dataset.index));
      return;
    }
    const tr = e.target.closest('tr[data-index]');
    if (tr) {
      state.sampleIndex = Number(tr.dataset.index);
      el.previewRowTag.textContent = `Baris contoh #${state.sampleIndex + 1} dari ${state.rows.length}`;
      renderDataPreviewTable();
      renderPreview();
    }
  });

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function renderColMapUI() {
    const labels = {
      file: 'Nama File', lat: 'Latitude', lng: 'Longitude',
      date: 'Tanggal', time: 'Waktu', location: 'Lokasi', address: 'Alamat', city: 'Kota',
      note: 'Catatan (opsional)', phone: 'Kontak (opsional)',
      temperature: 'Suhu (opsional)', wind: 'Angin (opsional)',
      altitude: 'Ketinggian (opsional)', direction: 'Arah (opsional)'
    };
    const entries = Object.entries(labels).map(([field, label]) => {
      const found = state.colMap[field];
      return `<div>${label}:</div><div>${found ? '<b>' + found + '</b>' : '<span style="color:var(--text-faint)">tidak ditemukan</span>'}</div>`;
    });
    el.csvColMap.innerHTML = entries.join('');
    el.csvColMap.classList.remove('hidden');
  }

  // ---------- logo upload ----------
  let logoSource = 'default'; // tracks whether state.logoImg came from 'default' or 'upload'

  el.logoModeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const mode = document.querySelector('input[name="logoMode"]:checked').value;
      el.logoUploadZone.classList.toggle('hidden', mode !== 'upload');
      if (mode === 'default') {
        loadDefaultLogo();
      } else if (logoSource !== 'upload') {
        state.logoImg = null;
        el.logoPreview.src = '';
        el.logoStatus.textContent = 'Silakan upload logo PNG.';
        renderPreview();
      }
    });
  });

  el.logoUploadZone.addEventListener('click', () => el.logoInput.click());
  el.logoUploadZone.addEventListener('dragover', (e) => { e.preventDefault(); el.logoUploadZone.classList.add('dragover'); });
  el.logoUploadZone.addEventListener('dragleave', () => el.logoUploadZone.classList.remove('dragover'));
  el.logoUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.logoUploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleLogoFile(e.dataTransfer.files[0]);
  });
  el.logoInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleLogoFile(e.target.files[0]);
  });

  function handleLogoFile(file) {
    if (!file) return;
    // MIME type is unreliable across OS/browsers (can be empty, or
    // "image/x-png"), so accept if EITHER the MIME says PNG OR the
    // filename ends in .png.
    const nameLooksPng = /\.png$/i.test(file.name || '');
    const mimeLooksPng = (file.type || '').toLowerCase().includes('png');
    if (!nameLooksPng && !mimeLooksPng) {
      alert('Mohon upload file PNG (berakhiran .png).');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (!img.width || !img.height) {
        el.logoStatus.textContent = 'File gambar tidak valid atau kosong.';
        URL.revokeObjectURL(url);
        return;
      }
      logoSource = 'upload';
      state.logoImg = img;
      el.logoPreview.src = url;
      el.logoStatus.textContent = `Logo custom aktif: ${file.name}`;
      renderPreview();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      el.logoStatus.textContent = 'Gagal memuat gambar. Pastikan file PNG valid dan tidak rusak.';
      alert('Gagal memuat gambar logo. Pastikan file PNG-nya valid.');
    };
    img.src = url;
  }

  function loadDefaultLogo() {
    const img = new Image();
    img.onload = () => {
      logoSource = 'default';
      state.logoImg = img;
      el.logoPreview.src = 'assets/logo-default.png';
      el.logoStatus.textContent = 'Menggunakan logo bawaan.';
      renderPreview();
    };
    img.onerror = () => {
      logoSource = 'default';
      state.logoImg = null; // falls back to self-drawn glyph in render.js
      el.logoStatus.textContent = 'Logo bawaan tidak ditemukan — menggunakan ikon default.';
      renderPreview();
    };
    img.src = 'assets/logo-default.png';
  }
  loadDefaultLogo();

  // ---------- map thumbnail settings ----------
  // Real map tiles (street/satellite) are fetched fresh per-row via
  // maptile.js. This is asynchronous and network-dependent, so every
  // fetch has a hard timeout — if it's slow or fails, we fall back to
  // the synthetic placeholder for that row and continue immediately.
  // This is what guarantees Generate can never hang indefinitely.
  const MAP_FETCH_TIMEOUT_MS = 7000;

  /**
   * Resolve the map thumbnail to use for a single row, given current
   * settings. Never throws and never hangs past the timeout — always
   * resolves to either a canvas (real map) or null (use placeholder).
   */
  async function resolveMapForRow(row, settings) {
    if (!settings.showMap) return null;
    if (settings.mapSource === 'offline') return null;
    if (isNaN(row.lat) || isNaN(row.lng)) return null;

    // Template 2's map can be a non-square aspect ratio; request the
    // thumbnail pre-cropped to that ratio (max dimension 256) so it
    // never needs to be stretched when drawn.
    const base = 256;
    const ratio = settings.template === 'gpscam2' ? parseMapAspect(settings.mapAspect) : 1;
    const w = ratio >= 1 ? base : Math.round(base * ratio);
    const h = ratio >= 1 ? Math.round(base / ratio) : base;

    try {
      const result = await buildMapThumbnail(row.lat, row.lng, {
        provider: settings.mapSource,
        zoom: settings.mapZoom,
        width: w,
        height: h,
        timeoutMs: MAP_FETCH_TIMEOUT_MS
      });
      return result && result.canvas ? result.canvas : null;
    } catch (err) {
      console.warn('Map fetch failed for row, using placeholder:', row.file, err);
      return null;
    }
  }

  // ---------- Template 2 reverse-geocoding ----------
  // Mirrors resolveMapForRow()'s contract exactly: async, network-
  // dependent, timeout-guarded, and NEVER throws or hangs — any
  // failure just resolves to no geo data, and the renderer falls back
  // to the row's manual CSV columns (Lokasi/Alamat) automatically.
  const GEO_FETCH_TIMEOUT_MS = 7000;
  const FLAG_FETCH_TIMEOUT_MS = 6000;

  async function resolveGeoForRow(row, settings) {
    if (settings.template !== 'gpscam2' || !settings.autoGeocode) return { geo: null, flagImg: null };
    if (isNaN(row.lat) || isNaN(row.lng)) return { geo: null, flagImg: null };
    try {
      const geo = await reverseGeocode(row.lat, row.lng, GEO_FETCH_TIMEOUT_MS);
      if (!geo) return { geo: null, flagImg: null };
      const flagImg = geo.flagIso2 ? await fetchCountryFlag(geo.flagIso2, FLAG_FETCH_TIMEOUT_MS) : null;
      return { geo, flagImg };
    } catch (err) {
      console.warn('Reverse geocode failed for row, using manual CSV columns instead:', row.file, err);
      return { geo: null, flagImg: null };
    }
  }

  // ---------- preview ----------
  let previewRequestId = 0;

  async function renderPreview() {
    if (!state.rows.length) {
      el.previewEmpty.classList.remove('hidden');
      return;
    }
    el.previewEmpty.classList.add('hidden');

    const myRequestId = ++previewRequestId;
    const row = state.rows[state.sampleIndex];
    const dims = getCanvasDims(state.settings);
    const settingsSnapshot = { ...state.settings };

    // draw immediately with a placeholder/no-map first so the UI never
    // looks frozen while we wait on the network for real tiles
    const previewRow = applyProjectOverride(row, settingsSnapshot);
    renderOverlay(el.previewCanvas, previewRow, buildOverlayOpts(previewRow, dims, settingsSnapshot, null));
    el.previewRowTag.textContent = `Baris contoh #${state.sampleIndex + 1} dari ${state.rows.length} — ${row.file}`;

    const needsMap = settingsSnapshot.showMap && settingsSnapshot.mapSource !== 'offline';
    const needsGeo = settingsSnapshot.template === 'gpscam2' && settingsSnapshot.autoGeocode;
    if (needsMap || needsGeo) {
      const [mapCanvas, geoResult] = await Promise.all([
        needsMap ? resolveMapForRow(row, settingsSnapshot) : Promise.resolve(null),
        needsGeo ? resolveGeoForRow(row, settingsSnapshot) : Promise.resolve({ geo: null, flagImg: null })
      ]);
      if (myRequestId !== previewRequestId) return; // a newer preview request superseded this one
      renderOverlay(el.previewCanvas, previewRow, buildOverlayOpts(previewRow, dims, settingsSnapshot, mapCanvas, geoResult));
    }
  }

  /**
   * Apply Tab 1's "override all rows" settings (Project Name, and for
   * Template 2, Note/Contact) onto a row, returning a shallow copy
   * only if at least one override is actually set — otherwise returns
   * the row as-is so callers that don't care can skip the copy.
   */
  function applyProjectOverride(row, settings) {
    const projectOv = settings.projectNameOverride && settings.projectNameOverride.trim();
    const noteOv = settings.noteOverride && settings.noteOverride.trim();
    const contactOv = settings.contactOverride && settings.contactOverride.trim();
    if (!projectOv && !noteOv && !contactOv) return row;
    const next = { ...row };
    if (projectOv) next.location = projectOv;
    if (noteOv) next.note = noteOv;
    if (contactOv) next.phone = contactOv;
    return next;
  }

  function buildOverlayOpts(row, dims, settings, mapCanvas, geoResult) {
    return {
      template: settings.template,
      logoImg: state.logoImg,
      mapImg: mapCanvas,
      width: dims.w,
      height: dims.h,
      dateFormat: settings.dateFormat,
      overlayPos: settings.overlayPos,
      overlayScale: settings.overlayScale,
      bgOpacity: settings.bgOpacity,
      fontColor: settings.fontColor,
      fontScale: settings.fontScale,
      cornerRadius: settings.cornerRadius,
      shadowStrength: settings.shadowStrength,
      badgeStyle: settings.badgeStyle,
      badgeScale: settings.badgeScale,
      showMap: settings.showMap,
      showMapPin: settings.showMapPin,
      showLocation: settings.showLocation,
      gmtOffset: settings.gmtOffset,
      showTime: settings.showTime,
      mapAspect: settings.mapAspect,
      geo: geoResult ? geoResult.geo : null,
      countryFlagImg: geoResult ? geoResult.flagImg : null
    };
  }

  el.prevSampleBtn.addEventListener('click', () => {
    if (!state.rows.length) return;
    state.sampleIndex = (state.sampleIndex - 1 + state.rows.length) % state.rows.length;
    renderPreview();
  });
  el.nextSampleBtn.addEventListener('click', () => {
    if (!state.rows.length) return;
    state.sampleIndex = (state.sampleIndex + 1) % state.rows.length;
    renderPreview();
  });
  el.downloadSampleBtn.addEventListener('click', () => {
    if (!state.rows.length) return;
    el.previewCanvas.toBlob((blob) => {
      const row = state.rows[state.sampleIndex];
      saveAs(blob, `${sanitizeFilename(row.file)}.png`);
    }, 'image/png');
  });

  // ---------- batched generation ----------
  el.generateBtn.addEventListener('click', runGeneration);

  /**
   * Convert a canvas to a PNG Blob as robustly as possible.
   *
   * Primary path: canvas.toBlob (async, memory-efficient). If that
   * returns null OR times out — which can happen on some browsers, or
   * if the canvas was tainted — we fall back to the synchronous
   * toDataURL path and convert the data URL to a Blob manually. This
   * guarantees we almost never lose a frame, which is what previously
   * caused an *empty ZIP* (every row silently skipped).
   *
   * Resolves to a Blob, or null only if BOTH paths fail.
   */
  function canvasToBlobSafe(canvas, timeoutMs) {
    return new Promise((resolve) => {
      let settled = false;

      function finish(result) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (result) { resolve(result); return; }
        // fallback: toDataURL -> Blob (synchronous, very reliable)
        resolve(dataURLToBlobSafe(canvas));
      }

      const timer = setTimeout(() => finish(null), timeoutMs || 10000);

      try {
        if (typeof canvas.toBlob === 'function') {
          canvas.toBlob((blob) => finish(blob), 'image/png');
        } else {
          finish(null); // no toBlob support -> straight to fallback
        }
      } catch (err) {
        finish(null);
      }
    });
  }

  /**
   * Synchronous fallback: canvas.toDataURL('image/png') -> Blob.
   * Returns null if even this fails (e.g. a genuinely tainted canvas,
   * which would throw a SecurityError).
   */
  function dataURLToBlobSafe(canvas) {
    try {
      const dataURL = canvas.toDataURL('image/png');
      const comma = dataURL.indexOf(',');
      const base64 = dataURL.slice(comma + 1);
      const binary = atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: 'image/png' });
    } catch (err) {
      console.error('toDataURL fallback also failed (canvas may be tainted):', err);
      return null;
    }
  }

  async function runGeneration() {
    if (!state.rows.length) return;

    el.generateBtn.disabled = true;
    el.doneMsg.classList.add('hidden');
    el.progressWrap.classList.remove('hidden');
    el.progressFill.style.width = '0%';

    try {
      await runGenerationInner();
    } catch (err) {
      console.error('Generation failed:', err);
      el.progressWrap.classList.add('hidden');
      alert('Terjadi kesalahan saat membuat file: ' + (err && err.message ? err.message : err)
        + '\n\nCoba lagi, atau gunakan mode Peta "Offline" di pengaturan jika masalah berlanjut.');
    } finally {
      el.generateBtn.disabled = false;
    }
  }

  async function runGenerationInner() {
    const dims = getCanvasDims(state.settings);
    if (!dims.w || !dims.h || isNaN(dims.w) || isNaN(dims.h)) {
      throw new Error('Ukuran kanvas tidak valid (' + dims.w + 'x' + dims.h + ').');
    }
    const workCanvas = document.createElement('canvas');
    const settingsSnapshot = { ...state.settings };

    // ---- pre-flight canvas-taint check ----
    // Online map tiles can silently "taint" the canvas if the tile
    // server doesn't send CORS headers, which makes toBlob/toDataURL
    // fail for EVERY row -> empty ZIP. Detect that ONCE up front using
    // the first row's real map, and if the canvas is tainted, transparently
    // switch the whole batch to offline placeholder maps so export works.
    let mapTaintFallback = false;
    if (settingsSnapshot.showMap && settingsSnapshot.mapSource !== 'offline') {
      const probeRow = state.rows[0];
      const probeMap = await resolveMapForRow(probeRow, settingsSnapshot);
      if (probeMap) {
        try {
          renderOverlay(workCanvas, probeRow, buildOverlayOpts(probeRow, dims, settingsSnapshot, probeMap));
          // this throws a SecurityError if the canvas is tainted:
          workCanvas.toDataURL('image/png');
        } catch (err) {
          console.warn('Canvas tainted by online map tiles — falling back to offline maps for this batch.', err);
          mapTaintFallback = true;
          settingsSnapshot.mapSource = 'offline';
        }
      }
    }

    const zip = new JSZip();
    const total = state.rows.length;
    const batchSize = 15;
    const startTime = performance.now();
    const usedNames = new Set();

    let mapFailCount = 0;
    let renderFailCount = 0;
    let geoFailCount = 0;
    const needsGeo = settingsSnapshot.template === 'gpscam2' && settingsSnapshot.autoGeocode;

    for (let i = 0; i < total; i++) {
      const row = state.rows[i];

      // 1) resolve map thumbnail for this row (timeout-guarded — never hangs)
      let mapCanvas = null;
      if (settingsSnapshot.showMap && settingsSnapshot.mapSource !== 'offline') {
        mapCanvas = await resolveMapForRow(row, settingsSnapshot);
        if (!mapCanvas) mapFailCount++;
      }

      // 1b) resolve reverse-geocoded location for this row (Template 2
      // only; same timeout-guarded, never-hangs contract as the map)
      let geoResult = null;
      if (needsGeo) {
        geoResult = await resolveGeoForRow(row, settingsSnapshot);
        if (!geoResult.geo) geoFailCount++;
      }

      // 2) render the overlay (synchronous, fast, cannot hang)
      try {
        const renderRow = applyProjectOverride(row, settingsSnapshot);
        renderOverlay(workCanvas, renderRow, buildOverlayOpts(renderRow, dims, settingsSnapshot, mapCanvas, geoResult));
      } catch (err) {
        console.error('Render failed for row', row.file, err);
        renderFailCount++;
        // draw a blank transparent canvas at the target size so the
        // ZIP still gets a file for this row instead of skipping it
        workCanvas.width = dims.w;
        workCanvas.height = dims.h;
        workCanvas.getContext('2d').clearRect(0, 0, dims.w, dims.h);
      }

      // 3) encode to PNG blob (timeout-guarded — never hangs)
      const blob = await canvasToBlobSafe(workCanvas, 12000);

      if (blob) {
        let name = sanitizeFilename(row.file);
        let finalName = name;
        let dupeCount = 1;
        while (usedNames.has(finalName)) {
          finalName = `${name}_${dupeCount++}`;
        }
        usedNames.add(finalName);
        zip.file(`${finalName}.png`, blob);
      } else {
        console.error('Failed to encode PNG for row', row.file, '— skipped from ZIP');
        renderFailCount++;
      }

      // update progress + yield to the browser every batch, so the UI never freezes
      if (i % batchSize === 0 || i === total - 1) {
        const elapsed = performance.now() - startTime;
        const rate = (i + 1) / elapsed; // items per ms
        const remaining = total - (i + 1);
        const etaMs = remaining / rate;
        updateProgress(i + 1, total, etaMs);
        await new Promise(r => setTimeout(r, 0));
      }
    }

    el.progressText.textContent = `Membuat file ZIP…`;

    // Guard: never hand the user a silently-empty ZIP. If literally
    // nothing encoded, surface a clear error instead.
    const fileCount = Object.keys(zip.files).length;
    if (fileCount === 0) {
      el.progressWrap.classList.add('hidden');
      el.generateBtn.disabled = false;
      alert('Tidak ada satu pun gambar yang berhasil dibuat, jadi ZIP tidak dibuat. '
        + 'Coba lagi dengan mode Peta "Offline" di pengaturan — jika ini menyelesaikannya, '
        + 'berarti masalahnya pada pengambilan peta online (firewall/CORS).');
      return;
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
      el.progressFill.style.width = metadata.percent.toFixed(0) + '%';
      el.progressText.textContent = `Membuat ZIP… ${metadata.percent.toFixed(0)}%`;
    });

    saveAs(zipBlob, `gps-overlay-output_${timestampSlug()}.zip`);

    el.progressWrap.classList.add('hidden');
    el.doneMsg.classList.remove('hidden');
    el.doneCount.textContent = total;

    let extraMsg = '';
    if (mapTaintFallback) {
      extraMsg += ` Peta online tidak bisa dipakai untuk export di browser ini (pembatasan CORS), jadi semua baris memakai peta placeholder offline.`;
    } else if (mapFailCount > 0) {
      extraMsg += ` ${mapFailCount} baris memakai peta placeholder (gagal ambil tile dari internet).`;
    }
    if (renderFailCount > 0) {
      extraMsg += ` ${renderFailCount} baris mengalami masalah saat render/encode.`;
    }
    if (needsGeo && geoFailCount > 0) {
      extraMsg += ` ${geoFailCount} baris gagal deteksi lokasi otomatis, memakai kolom Lokasi/Alamat dari CSV sebagai gantinya.`;
    }
    el.doneMsg.innerHTML = `Selesai! ZIP berisi <strong>${total}</strong> file PNG telah diunduh.${extraMsg ? '<br><span style="color:var(--text-dim);font-size:11.5px;">' + extraMsg.trim() + '</span>' : ''}`;
  }

  function updateProgress(done, total, etaMs) {
    const pct = (done / total) * 100;
    el.progressFill.style.width = pct.toFixed(1) + '%';
    el.progressText.textContent = `Generating… ${done} / ${total}`;
    el.progressEta.textContent = `ETA: ${formatETA(etaMs)}`;
  }

  function formatETA(ms) {
    if (!isFinite(ms) || ms < 0) return '—';
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}m ${sec}s`;
  }

  function timestampSlug() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  // ---------- shared bridge for the other tabs (attach.js, geotag.js) ----------
  // Exposes read access to CSV rows / logo / settings and the overlay
  // rendering pipeline, so the photo-attach and metadata tabs can reuse
  // exactly the same data and look the user configured on tab 1.
  window.GeoStamp = {
    getRows: () => state.rows,
    getLogo: () => state.logoImg,
    getSettings: () => ({ ...state.settings }),
    getDims: () => getCanvasDims(state.settings),
    buildOverlayOpts: (row, dims, settings, mapImg) => buildOverlayOpts(row, dims, settings, mapImg),
    applyProjectOverride: (row, settings) => applyProjectOverride(row, settings),
    resolveMapForRow: (row, settings) => resolveMapForRow(row, settings),
    resolveGeoForRow: (row, settings) => resolveGeoForRow(row, settings),
    renderOverlay: (canvas, row, opts) => renderOverlay(canvas, row, opts),
    sanitizeFilename: (s) => sanitizeFilename(s),
    timestampSlug: () => timestampSlug()
  };

})();
