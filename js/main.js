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
    settings: loadSettings(),
    badgeIconImg: null,  // app icon for Template 2's badge (icon + "GPS Map Camera" text, like the app)
    mapLabelLogoImg: null // Google logo artwork for the map corner label
  };

  // preview drag/resize state (see "drag / resize the stamp" below)
  let lastStampBox = null; // stamp bounds in preview-canvas pixels (+ canvas W/H)
  let stampDrag = null;

  // Template 2 draws with the bundled Inter/Roboto; canvas text silently falls
  // back to another font if it isn't loaded yet, so every render waits
  // for it first (instant after the first time).
  const fontsReady = (document.fonts && document.fonts.load)
    ? Promise.all([
      '400 32px "GeoStamp Inter"', '400 32px "GeoStamp Roboto"', '500 32px "GeoStamp Roboto"'
    ].map(f => document.fonts.load(f, 'Aa0\u00B0'))).then(() => {}, () => {})
    : Promise.resolve();

  (function loadBadgeIcon() {
    const img = new Image();
    img.onload = () => { state.badgeIconImg = img; renderPreview(); };
    img.src = 'assets/badge-icon.png';
    const logo = new Image();
    logo.onload = () => { state.mapLabelLogoImg = logo; renderPreview(); };
    logo.src = 'assets/map-label-google.png';
  })();

  // ---------- element refs ----------
  const el = {
    dataInputModeRadios: document.querySelectorAll('input[name="dataInputMode"]'),
    csvModePanel: document.getElementById('csvModePanel'),
    manualModePanel: document.getElementById('manualModePanel'),
    folderModePanel: document.getElementById('folderModePanel'),
    folderDropZone: document.getElementById('folderDropZone'),
    folderPhotoInput: document.getElementById('folderPhotoInput'),
    folderDirInput: document.getElementById('folderDirInput'),
    folderInfo: document.getElementById('folderInfo'),
    folderDefaultLat: document.getElementById('folderDefaultLat'),
    folderDefaultLng: document.getElementById('folderDefaultLng'),
    folderApplyCoordsBtn: document.getElementById('folderApplyCoordsBtn'),
    previewOnPhotoRow: document.getElementById('previewOnPhotoRow'),
    previewStampFrame: document.getElementById('previewStampFrame'),
    previewStampHandle: document.getElementById('previewStampHandle'),
    resetPlacementBtn: document.getElementById('resetPlacementBtn'),
    previewOnPhoto: document.getElementById('previewOnPhoto'),
    previewPhotoName: document.getElementById('previewPhotoName'),
    linkedPhotosBox: document.getElementById('linkedPhotosBox'),
    linkedPhotosCount: document.getElementById('linkedPhotosCount'),
    goAttachBtn: document.getElementById('goAttachBtn'),
    dropZone: document.getElementById('dropZone'),
    csvInput: document.getElementById('csvInput'),
    csvInfo: document.getElementById('csvInfo'),
    csvColMap: document.getElementById('csvColMap'),
    csvColMapPlaceholder: document.getElementById('csvColMapPlaceholder'),
    dataFotoSummary: document.getElementById('dataFotoSummary'),

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
    autoElevation: document.getElementById('autoElevation'),
    autoWeather: document.getElementById('autoWeather'),
    showGeoCity: document.getElementById('showGeoCity'),
    showGeoProvince: document.getElementById('showGeoProvince'),
    showGeoCountry: document.getElementById('showGeoCountry'),
    showGeoFlag: document.getElementById('showGeoFlag'),
    mapAspect: document.getElementById('mapAspect'),
    watermarkLang: document.getElementById('watermarkLang'),
    latLngFormat: document.getElementById('latLngFormat'),
    stampFont: document.getElementById('stampFont'),
    timeFormat: document.getElementById('timeFormat'),
    exactPresetBtn: document.getElementById('exactPresetBtn'),
    noteOverride: document.getElementById('noteOverride'),
    contactOverride: document.getElementById('contactOverride'),

    canvasSize: document.getElementById('canvasSize'),
    customSizeRow: document.getElementById('customSizeRow'),
    customW: document.getElementById('customW'),
    customH: document.getElementById('customH'),
    dateFormat: document.getElementById('dateFormat'),
    overlayPos: document.getElementById('overlayPos'),
    overlayAlignH: document.getElementById('overlayAlignH'),
    overlayScale: document.getElementById('overlayScale'),
    overlayScaleVal: document.getElementById('overlayScaleVal'),
    overlayWidthPct: document.getElementById('overlayWidthPct'),
    overlayWidthPctVal: document.getElementById('overlayWidthPctVal'),
    offsetX: document.getElementById('offsetX'),
    offsetXVal: document.getElementById('offsetXVal'),
    offsetY: document.getElementById('offsetY'),
    offsetYVal: document.getElementById('offsetYVal'),
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
    badgeScaleField: document.getElementById('badgeScaleField'),
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
    mapDetailFields: document.getElementById('mapDetailFields'),
    mapScale: document.getElementById('mapScale'),
    mapScaleVal: document.getElementById('mapScaleVal'),
    mapLabelShow: document.getElementById('mapLabelShow'),
    mapLabelText: document.getElementById('mapLabelText'),
    showMapCone: document.getElementById('showMapCone'),
    mapConeBearing: document.getElementById('mapConeBearing'),
    mapConeBearingVal: document.getElementById('mapConeBearingVal'),
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

  // "97.5%", "-3.2%", "100%" — trims a trailing .0
  function fmtPct(v) {
    return (Math.round(Number(v) * 10) / 10) + '%';
  }

  // ---------- settings <-> UI ----------
  function applySettingsToUI(s) {
    el.overlayTemplate.value = s.template;
    el.gmtOffset.value = s.gmtOffset;
    el.showTime.checked = s.showTime;
    el.autoGeocode.checked = s.autoGeocode;
    el.autoElevation.checked = s.autoElevation;
    el.autoWeather.checked = s.autoWeather;
    el.showGeoCity.checked = s.showGeoCity;
    el.showGeoProvince.checked = s.showGeoProvince;
    el.showGeoCountry.checked = s.showGeoCountry;
    el.showGeoFlag.checked = s.showGeoFlag;
    el.mapAspect.value = s.mapAspect;
    el.watermarkLang.value = s.watermarkLang;
    el.latLngFormat.value = s.latLngFormat;
    el.stampFont.value = s.stampFont === 'roboto' ? 'roboto' : 'inter';
    el.timeFormat.value = s.timeFormat;
    el.noteOverride.value = s.noteOverride || '';
    el.contactOverride.value = s.contactOverride || '';
    updateTemplateFieldVisibility();

    el.canvasSize.value = s.canvasSize;
    el.customW.value = s.customW;
    el.customH.value = s.customH;
    el.customSizeRow.classList.toggle('hidden', s.canvasSize !== 'custom');
    el.dateFormat.value = s.dateFormat;
    el.overlayPos.value = s.overlayPos;
    el.overlayAlignH.value = s.overlayAlignH;
    el.overlayScale.value = s.overlayScale;
    el.overlayScaleVal.textContent = fmtPct(s.overlayScale);
    el.overlayWidthPct.value = s.overlayWidthPct;
    el.overlayWidthPctVal.textContent = s.overlayWidthPct + '%';
    el.offsetX.value = s.offsetX;
    el.offsetXVal.textContent = fmtPct(s.offsetX);
    el.offsetY.value = s.offsetY;
    el.offsetYVal.textContent = fmtPct(s.offsetY);
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
    el.badgeScaleField.classList.toggle('hidden', s.badgeStyle === 'none');
    el.projectNameOverride.value = s.projectNameOverride || '';
    el.showMap.checked = s.showMap;
    el.showLocation.checked = s.showLocation;
    el.mapSource.value = s.mapSource;
    el.mapZoom.value = s.mapZoom;
    el.mapZoomVal.textContent = s.mapZoom;
    el.showMapPin.checked = s.showMapPin;
    el.mapScale.value = s.mapScale;
    el.mapScaleVal.textContent = s.mapScale + '%';
    el.mapLabelShow.checked = s.mapLabelShow;
    el.mapLabelText.value = s.mapLabelText || '';
    el.showMapCone.checked = s.showMapCone;
    el.mapConeBearing.value = s.mapConeBearing;
    el.mapConeBearingVal.textContent = s.mapConeBearing + '\u00B0';
    updateMapFieldVisibility();
  }

  function readSettingsFromUI() {
    return {
      template: el.overlayTemplate.value,
      gmtOffset: el.gmtOffset.value,
      showTime: el.showTime.checked,
      autoGeocode: el.autoGeocode.checked,
      autoElevation: el.autoElevation.checked,
      autoWeather: el.autoWeather.checked,
      showGeoCity: el.showGeoCity.checked,
      showGeoProvince: el.showGeoProvince.checked,
      showGeoCountry: el.showGeoCountry.checked,
      showGeoFlag: el.showGeoFlag.checked,
      mapAspect: el.mapAspect.value,
      watermarkLang: el.watermarkLang.value,
      latLngFormat: el.latLngFormat.value,
      stampFont: el.stampFont.value,
      timeFormat: el.timeFormat.value,
      noteOverride: el.noteOverride.value,
      contactOverride: el.contactOverride.value,

      canvasSize: el.canvasSize.value,
      customW: parseInt(el.customW.value) || 1080,
      customH: parseInt(el.customH.value) || 500,
      dateFormat: el.dateFormat.value,
      overlayPos: el.overlayPos.value,
      overlayAlignH: el.overlayAlignH.value,
      overlayScale: parseFloat(el.overlayScale.value),
      overlayWidthPct: parseInt(el.overlayWidthPct.value),
      offsetX: parseFloat(el.offsetX.value),
      offsetY: parseFloat(el.offsetY.value),
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
      showMapPin: el.showMapPin.checked,
      mapScale: parseInt(el.mapScale.value),
      mapLabelShow: el.mapLabelShow.checked,
      mapLabelText: el.mapLabelText.value,
      showMapCone: el.showMapCone.checked,
      mapConeBearing: parseInt(el.mapConeBearing.value)
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
    el.mapDetailFields.classList.toggle('hidden', !mapOn);
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
    window.dispatchEvent(new CustomEvent('geostamp:settingschange'));
  }

  applySettingsToUI(state.settings);

  [el.canvasSize, el.dateFormat, el.overlayPos, el.overlayAlignH, el.showMap, el.showLocation, el.mapSource, el.showMapPin].forEach(node => {
    node.addEventListener('change', () => {
      el.customSizeRow.classList.toggle('hidden', el.canvasSize.value !== 'custom');
      updateMapFieldVisibility();
      onSettingsChanged();
    });
  });

  [el.overlayTemplate, el.gmtOffset, el.showTime, el.mapAspect, el.watermarkLang, el.latLngFormat, el.timeFormat, el.stampFont,
    el.mapLabelShow, el.showMapCone].forEach(node => {
    node.addEventListener('change', () => {
      updateTemplateFieldVisibility();
      onSettingsChanged();
    });
  });
  [el.autoGeocode, el.autoElevation, el.autoWeather, el.showGeoCity, el.showGeoProvince, el.showGeoCountry, el.showGeoFlag].forEach(node => {
    node.addEventListener('change', onSettingsChanged);
  });
  [el.noteOverride, el.contactOverride].forEach(node => node.addEventListener('input', onSettingsChanged));
  [el.customW, el.customH].forEach(node => node.addEventListener('input', onSettingsChanged));

  el.mapZoom.addEventListener('input', () => {
    el.mapZoomVal.textContent = el.mapZoom.value;
    onSettingsChanged();
  });
  el.mapScale.addEventListener('input', () => {
    el.mapScaleVal.textContent = el.mapScale.value + '%';
    onSettingsChanged();
  });
  el.mapConeBearing.addEventListener('input', () => {
    el.mapConeBearingVal.textContent = el.mapConeBearing.value + '\u00B0';
    onSettingsChanged();
  });
  el.mapLabelText.addEventListener('input', onSettingsChanged);

  el.exactPresetBtn.addEventListener('click', () => {
    state.settings = { ...state.settings, ...EXACT_GPSCAM_PRESET };
    saveSettings(state.settings);
    applySettingsToUI(state.settings);
    if (logoSource !== 'default') {
      // the app's own badge is the default icon + name
      document.querySelector('input[name="logoMode"][value="default"]').checked = true;
      el.logoUploadZone.classList.add('hidden');
      loadDefaultLogo();
    }
    onSettingsChanged();
  });

  el.overlayScale.addEventListener('input', () => {
    el.overlayScaleVal.textContent = fmtPct(el.overlayScale.value);
    onSettingsChanged();
  });
  el.overlayWidthPct.addEventListener('input', () => {
    el.overlayWidthPctVal.textContent = el.overlayWidthPct.value + '%';
    onSettingsChanged();
  });
  el.offsetX.addEventListener('input', () => {
    el.offsetXVal.textContent = fmtPct(el.offsetX.value);
    onSettingsChanged();
  });
  el.offsetY.addEventListener('input', () => {
    el.offsetYVal.textContent = fmtPct(el.offsetY.value);
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
  el.badgeStyle.addEventListener('change', () => {
    el.badgeScaleField.classList.toggle('hidden', el.badgeStyle.value === 'none');
    onSettingsChanged();
  });
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
      el.folderModePanel.classList.toggle('hidden', mode !== 'folder');
    });
  });

  function setDataInputMode(mode) {
    const radio = document.querySelector(`input[name="dataInputMode"][value="${mode}"]`);
    if (radio && !radio.checked) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
    }
  }

  // ---------- "Dari Folder Foto": rows straight from the photos' EXIF ----------
  function makeRow(idx, fields) {
    const location = fields.location || '';
    return {
      _index: idx,
      file: fields.file,
      lat: fields.lat == null || fields.lat === '' ? NaN : Number(fields.lat),
      lng: fields.lng == null || fields.lng === '' ? NaN : Number(fields.lng),
      date: fields.date || '',
      time: fields.time || '',
      location,
      address: fields.address || '',
      city: location,
      note: '', phone: '', temperature: '', wind: '', altitude: '',
      direction: '',
      // camera heading from the photo's EXIF: steers the map's direction
      // cone only (the visible "Arah" text stays a manual/CSV field)
      bearing: fields.bearing || ''
    };
  }

  function defaultFolderCoords() {
    const lat = parseFloat(String(el.folderDefaultLat.value).replace(',', '.'));
    const lng = parseFloat(String(el.folderDefaultLng.value).replace(',', '.'));
    return (isNaN(lat) || isNaN(lng)) ? null : { lat, lng };
  }

  async function importPhotoFolder(fileList) {
    const files = Array.from(fileList).filter(f => window.GeoStampPhotoMeta.isPhotoFile(f));
    if (!files.length) { alert('Tidak ada file foto yang terdeteksi.'); return; }
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    el.folderInfo.classList.remove('hidden');
    const def = defaultFolderCoords();
    const rows = [];
    let gpsCount = 0, defCount = 0, exifDateCount = 0;
    for (let i = 0; i < files.length; i++) {
      if (i % 5 === 0) {
        el.folderInfo.innerHTML = `<span>Membaca data foto ${i + 1} / ${files.length}…</span>`;
        await new Promise(r => setTimeout(r, 0));
      }
      const meta = await window.GeoStampPhotoMeta.extract(files[i]);
      let lat = meta.lat, lng = meta.lng;
      if (lat != null) gpsCount++;
      else if (def) { lat = def.lat; lng = def.lng; defCount++; }
      if (meta.dateSource === 'exif') exifDateCount++;
      rows.push(makeRow(i, {
        file: files[i].name.replace(/\.[^.]+$/, ''),
        lat, lng, date: meta.date, time: meta.time, bearing: meta.direction
      }));
    }
    state.rows = rows;
    state.headers = [];
    state.colMap = {};
    window.GeoStampPhotos.set(files);
    const noCoord = rows.filter(r => isNaN(r.lat)).length;
    el.folderInfo.innerHTML = `<span><strong>${files.length}</strong> foto — ${gpsCount} dengan GPS dari foto`
      + (defCount ? `, ${defCount} memakai koordinat yang kamu isi` : '')
      + (noCoord ? `, <strong>${noCoord} belum punya koordinat</strong> (isi koordinat di samping lalu klik "Terapkan", atau geser pin di peta)` : '')
      + `. Tanggal/jam: ${exifDateCount} dari EXIF, ${files.length - exifDateCount} dari tanggal file.</span>`;
    refreshAfterRowsChanged('first');
  }

  el.folderDropZone.addEventListener('click', () => el.folderPhotoInput.click());
  el.folderDropZone.addEventListener('dragover', (e) => { e.preventDefault(); el.folderDropZone.classList.add('dragover'); });
  el.folderDropZone.addEventListener('dragleave', () => el.folderDropZone.classList.remove('dragover'));
  el.folderDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.folderDropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) importPhotoFolder(e.dataTransfer.files);
  });
  [el.folderPhotoInput, el.folderDirInput].forEach(input => input.addEventListener('change', (e) => {
    if (e.target.files.length) importPhotoFolder(e.target.files);
    e.target.value = '';
  }));
  el.folderApplyCoordsBtn.addEventListener('click', () => {
    const def = defaultFolderCoords();
    if (!def) { alert('Isi Latitude dan Longitude dengan angka yang valid dulu.'); return; }
    let n = 0;
    state.rows.forEach(r => { if (isNaN(r.lat) || isNaN(r.lng)) { r.lat = def.lat; r.lng = def.lng; n++; } });
    if (!n) { alert('Semua baris sudah punya koordinat.'); return; }
    refreshAfterRowsChanged('clamp');
  });

  /** Used by Tab 4: load its (edited) rows + their photos into Tab 1. */
  function importPhotoRows(rows, files) {
    state.rows = rows.map((r, i) => makeRow(i, r));
    state.headers = [];
    state.colMap = {};
    window.GeoStampPhotos.set(files);
    setDataInputMode('folder');
    el.folderInfo.classList.remove('hidden');
    el.folderInfo.innerHTML = `<span><strong>${rows.length}</strong> foto dimuat dari menu Buat CSV dari Foto.</span>`;
    refreshAfterRowsChanged('first');
  }

  function updateLinkedPhotosUI() {
    const n = window.GeoStampPhotos.count();
    el.previewOnPhotoRow.classList.toggle('hidden', !n);
    el.linkedPhotosBox.classList.toggle('hidden', !(n && state.rows.length));
    el.linkedPhotosCount.textContent = n;
  }
  window.GeoStampPhotos.onChange(() => { updateLinkedPhotosUI(); renderPreview(); });
  el.previewOnPhoto.addEventListener('change', renderPreview);
  el.goAttachBtn.addEventListener('click', () => { if (window.GeoStampTabs) window.GeoStampTabs.activate('tab-attach'); });

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
    el.dataFotoSummary.textContent = state.rows.length ? `${state.rows.length} baris` : '';
    el.dataFotoSummary.classList.toggle('hidden', state.rows.length === 0);
    renderDataPreviewTable();
    renderPreview();
    notifyRowsChanged();
    updateLinkedPhotosUI();
  }

  // ---------- rows-changed pub/sub (used by mapview.js to keep the
  // map + calendar in sync without main.js needing to know it exists) ----------
  const rowsChangedListeners = [];
  function notifyRowsChanged() {
    rowsChangedListeners.forEach(cb => { try { cb(state.rows); } catch (e) { console.error(e); } });
  }

  /**
   * Update a single row's coordinates (used by the draggable map pin in
   * mapview.js) and refresh whatever depends on it — the data-preview
   * table cell and, if it's the currently-previewed row, the sample
   * preview canvas. Deliberately does NOT call notifyRowsChanged(): the
   * caller already owns the marker that triggered this, so re-broadcasting
   * would just make mapview.js rebuild the map it's already updating.
   */
  function updateRowCoords(index, lat, lng) {
    const row = state.rows[index];
    if (!row) return;
    row.lat = lat;
    row.lng = lng;
    renderDataPreviewTable();
    if (index === state.sampleIndex) renderPreview();
  }

  function setSampleIndex(index) {
    if (index < 0 || index >= state.rows.length) return;
    state.sampleIndex = index;
    el.previewRowTag.textContent = `Baris contoh #${state.sampleIndex + 1} dari ${state.rows.length}`;
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
    el.csvColMapPlaceholder.classList.remove('hidden');
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
    el.csvColMapPlaceholder.classList.add('hidden');
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

    // Request the thumbnail pre-cropped to the map's aspect ratio (so it
    // is never stretched), at zoom+1 with a 512px long side: the same
    // ground area as a 256px map at the chosen zoom, but with twice the
    // detail, so it stays sharp when burned onto full-resolution photos.
    const base = 512;
    const ratio = parseMapAspect(settings.mapAspect);
    const w = ratio >= 1 ? base : Math.round(base * ratio);
    const h = ratio >= 1 ? Math.round(base / ratio) : base;

    try {
      const result = await buildMapThumbnail(row.lat, row.lng, {
        provider: settings.mapSource,
        zoom: settings.mapZoom + 1,
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

  // ---------- reverse-geocoding (applies to both templates) ----------
  // Mirrors resolveMapForRow()'s contract exactly: async, network-
  // dependent, timeout-guarded, and NEVER throws or hangs — any
  // failure just resolves to no geo data, and the renderer falls back
  // to the row's manual CSV columns (Lokasi/Alamat) automatically.
  const GEO_FETCH_TIMEOUT_MS = 7000;
  const FLAG_FETCH_TIMEOUT_MS = 6000;

  async function resolveGeoForRow(row, settings) {
    if (!settings.autoGeocode) return { geo: null, flagImg: null };
    if (isNaN(row.lat) || isNaN(row.lng)) return { geo: null, flagImg: null };
    // (always fetch when enabled, even if city/address are already
    // filled in manually — the country flag has no other source, so
    // skipping here would mean the flag never shows for CSVs that
    // already provide their own city/address text)
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

  // ---------- elevation + weather (Open-Meteo, Template 2's Geo Info row) ----------
  const ELEVATION_FETCH_TIMEOUT_MS = 6000;
  const WEATHER_FETCH_TIMEOUT_MS = 7000;

  async function resolveElevationForRow(row, settings) {
    if (!settings.autoElevation) return null;
    if (row.altitude) return null; // already filled manually/CSV
    if (isNaN(row.lat) || isNaN(row.lng)) return null;
    try {
      const meters = await fetchElevation(row.lat, row.lng, ELEVATION_FETCH_TIMEOUT_MS);
      return meters != null ? `${meters} m` : null;
    } catch (err) {
      console.warn('Elevation lookup failed for row:', row.file, err);
      return null;
    }
  }

  async function resolveWeatherForRow(row, settings) {
    if (!settings.autoWeather) return null;
    if (row.temperature && row.wind) return null; // nothing missing to fill
    if (isNaN(row.lat) || isNaN(row.lng)) return null;
    try {
      const d = parseFlexibleDate(row.date);
      const isoDate = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;
      return await fetchWeather(row.lat, row.lng, isoDate, WEATHER_FETCH_TIMEOUT_MS);
    } catch (err) {
      console.warn('Weather lookup failed for row:', row.file, err);
      return null;
    }
  }

  /**
   * Combined resolver for everything under "Deteksi Otomatis dari
   * Koordinat" — runs geocoding/elevation/weather in parallel (each
   * independently timeout-guarded and skip-if-already-filled) and
   * returns one bundle for buildOverlayOpts.
   */
  async function resolveAutoDataForRow(row, settings) {
    const [geoResult, elevation, weather] = await Promise.all([
      resolveGeoForRow(row, settings),
      resolveElevationForRow(row, settings),
      resolveWeatherForRow(row, settings)
    ]);
    return { geo: geoResult.geo, flagImg: geoResult.flagImg, elevation, weather };
  }

  // ---------- preview ----------
  let previewRequestId = 0;
  // Last real map drawn in the preview, reused for the instant first
  // paint of the next preview of the same spot (e.g. while the zoom
  // slider moves) so the map never flashes blank while new tiles load.
  let lastPreviewMap = null; // { key, canvas }
  const PREVIEW_FETCH_DEBOUNCE_MS = 220;

  function previewMapKey(row, s) {
    return [row.lat, row.lng, s.mapSource, s.mapAspect].join('|');
  }

  async function renderPreview() {
    if (!state.rows.length) {
      el.previewEmpty.classList.remove('hidden');
      lastStampBox = null;
      positionStampFrame();
      return;
    }
    el.previewEmpty.classList.add('hidden');

    const myRequestId = ++previewRequestId;
    const row = state.rows[state.sampleIndex];
    const settingsSnapshot = { ...state.settings };
    const previewRow = applyProjectOverride(row, settingsSnapshot);
    el.previewRowTag.textContent = `Baris contoh #${state.sampleIndex + 1} dari ${state.rows.length} — ${row.file}`;

    const needsMap = settingsSnapshot.showMap && settingsSnapshot.mapSource !== 'offline';
    const needsAuto = settingsSnapshot.autoGeocode || settingsSnapshot.autoElevation || settingsSnapshot.autoWeather;
    const mapKey = previewMapKey(row, settingsSnapshot);
    const interimMap = needsMap && lastPreviewMap && lastPreviewMap.key === mapKey ? lastPreviewMap.canvas : null;

    // paint immediately (previous map if we have one for this spot, else
    // the placeholder) so the UI never looks frozen or blank
    await paintPreview(previewRow, settingsSnapshot, interimMap, lastPreviewAutoData(row), myRequestId);
    if (myRequestId !== previewRequestId) return;

    if (needsMap || needsAuto) {
      // let rapid slider changes settle before hitting the network
      await new Promise(r => setTimeout(r, PREVIEW_FETCH_DEBOUNCE_MS));
      if (myRequestId !== previewRequestId) return;
      const [mapCanvas, autoData] = await Promise.all([
        needsMap ? resolveMapForRow(row, settingsSnapshot) : Promise.resolve(null),
        needsAuto ? resolveAutoDataForRow(row, settingsSnapshot) : Promise.resolve(null)
      ]);
      if (myRequestId !== previewRequestId) return; // a newer preview request superseded this one
      if (mapCanvas) lastPreviewMap = { key: mapKey, canvas: mapCanvas };
      if (autoData) _lastAuto = { key: autoKey(row), data: autoData };
      await paintPreview(previewRow, settingsSnapshot, mapCanvas || interimMap, autoData, myRequestId);
    }
  }

  // auto-detected data (geocode etc.) for the previewed row, reused for
  // the instant first paint so the title/flag don't flicker either
  let _lastAuto = null;
  function autoKey(row) { return row.lat + '|' + row.lng; }
  function lastPreviewAutoData(row) {
    return _lastAuto && _lastAuto.key === autoKey(row) ? _lastAuto.data : null;
  }

  // ---------- preview on the real photo ----------
  // Rendered at up to this width (overlay geometry is proportional to
  // the photo width, so it looks exactly like the full-size result) to
  // keep slider changes instant even for 12+ MP photos.
  const PREVIEW_PHOTO_MAX_W = 1600;
  let previewPhotoCache = { file: null, promise: null };

  function previewPhotoForRow(row) {
    if (!el.previewOnPhoto.checked || !window.GeoStampPhotos.count()) return null;
    const matchEl = document.getElementById('attachMatchMode');
    return window.GeoStampPhotos.findForRow(row, state.sampleIndex, matchEl ? matchEl.value : 'filename');
  }

  function loadPreviewPhoto(file) {
    if (previewPhotoCache.file === file) return previewPhotoCache.promise;
    const old = previewPhotoCache.promise;
    if (old) old.then(r => r && URL.revokeObjectURL(r.url), () => {});
    const promise = window.GeoStampHeic.loadImageElement(file, (status) => {
      if (status === 'converting') el.previewRowTag.textContent = `Mengonversi foto HEIC "${file.name}"… mohon tunggu`;
    });
    previewPhotoCache = { file, promise };
    promise.catch(() => { if (previewPhotoCache.file === file) previewPhotoCache = { file: null, promise: null }; });
    return promise;
  }

  async function paintPreview(row, settings, mapCanvas, autoData, requestId) {
    await fontsReady;
    const photo = previewPhotoForRow(row);
    el.previewPhotoName.textContent = photo ? photo.name : 'tidak ada foto dengan nama yang cocok';
    if (photo) {
      let loaded = null;
      try { loaded = await loadPreviewPhoto(photo); } catch (e) { console.warn('Preview photo failed to load:', e); }
      if (requestId != null && requestId !== previewRequestId) return;
      if (loaded) {
        const img = loaded.img;
        const W = Math.min(img.naturalWidth, PREVIEW_PHOTO_MAX_W);
        const H = Math.round(W * img.naturalHeight / img.naturalWidth);
        const overlay = document.createElement('canvas');
        renderOverlay(overlay, row, buildOverlayOpts(row, { w: W, h: H }, settings, mapCanvas, autoData));
        lastStampBox = overlay.__stampBox ? { ...overlay.__stampBox, W, H } : null;
        const pc = el.previewCanvas;
        pc.width = W;
        pc.height = H;
        const pctx = pc.getContext('2d');
        pctx.drawImage(img, 0, 0, W, H);
        pctx.drawImage(overlay, 0, 0);
        el.previewRowTag.textContent = `Baris #${state.sampleIndex + 1} dari ${state.rows.length} — di atas foto ${photo.name}`;
        positionStampFrame();
        return;
      }
    }
    const dims = getCanvasDims(settings);
    renderOverlay(el.previewCanvas, row, buildOverlayOpts(row, dims, settings, mapCanvas, autoData));
    lastStampBox = el.previewCanvas.__stampBox ? { ...el.previewCanvas.__stampBox, W: dims.w, H: dims.h } : null;
    positionStampFrame();
  }

  // ---------- drag / resize the stamp directly in the preview ----------
  // A dashed frame (HTML, so it never ends up in "Download Sample PNG")
  // sits over the drawn stamp: dragging it changes "Geser Horizontal/
  // Vertikal", dragging its corner dot changes "Ukuran Overlay" — the
  // same settings the sliders control, so everything stays in sync.

  function stampAnchor(box, s) {
    // the corner that stays put while resizing (where the stamp is anchored)
    const ax = s.overlayAlignH === 'right' ? box.x + box.w : s.overlayAlignH === 'center' ? box.x + box.w / 2 : box.x;
    const ay = s.overlayPos === 'top' ? box.y : box.y + box.h;
    return { ax, ay };
  }

  function positionStampFrame() {
    const f = el.previewStampFrame;
    const pc = el.previewCanvas;
    if (!lastStampBox || !state.rows.length || !pc.width) { f.classList.add('hidden'); return; }
    const wrap = pc.parentElement.getBoundingClientRect();
    const r = pc.getBoundingClientRect();
    if (!r.width) { f.classList.add('hidden'); return; }
    const k = r.width / pc.width;
    const b = lastStampBox;
    f.style.left = `${r.left - wrap.left + b.x * k}px`;
    f.style.top = `${r.top - wrap.top + b.y * k}px`;
    f.style.width = `${b.w * k}px`;
    f.style.height = `${b.h * k}px`;
    const s = state.settings;
    f.dataset.handleX = s.overlayAlignH === 'right' ? 'left' : 'right';
    f.dataset.handleY = s.overlayPos === 'top' ? 'bottom' : 'top';
    f.classList.remove('hidden');
  }
  window.addEventListener('resize', positionStampFrame);
  window.addEventListener('geostamp:tabchange', () => setTimeout(positionStampFrame, 0));

  function clampNum(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  el.previewStampFrame.addEventListener('pointerdown', (e) => {
    if (!lastStampBox) return;
    e.preventDefault();
    el.previewStampFrame.setPointerCapture(e.pointerId);
    const r = el.previewCanvas.getBoundingClientRect();
    stampDrag = {
      mode: e.target === el.previewStampHandle ? 'resize' : 'move',
      sx: e.clientX, sy: e.clientY,
      k: r.width / el.previewCanvas.width,
      canvasLeft: r.left, canvasTop: r.top,
      box: { ...lastStampBox },
      start: { ...state.settings }
    };
    el.previewStampFrame.classList.add('dragging');
  });

  let stampDragFrame = 0;
  el.previewStampFrame.addEventListener('pointermove', (e) => {
    if (!stampDrag) return;
    const d = stampDrag;
    const s0 = d.start;
    if (d.mode === 'move') {
      const dx = (e.clientX - d.sx) / d.k;
      const dy = (e.clientY - d.sy) / d.k;
      const nx = clampNum(Math.round((s0.offsetX + dx / d.box.W * 100) * 10) / 10, -50, 50);
      const ny = clampNum(Math.round((s0.offsetY + dy / d.box.H * 100) * 10) / 10, -50, 50);
      el.offsetX.value = nx; el.offsetXVal.textContent = fmtPct(nx);
      el.offsetY.value = ny; el.offsetYVal.textContent = fmtPct(ny);
    } else {
      const { ax, ay } = stampAnchor(d.box, s0);
      const toCanvas = (cx, cy) => ({ x: (cx - d.canvasLeft) / d.k, y: (cy - d.canvasTop) / d.k });
      const p0 = toCanvas(d.sx, d.sy);
      const p1 = toCanvas(e.clientX, e.clientY);
      // the stamp keeps (almost) its full width when scaled — its height,
      // text and map shrink/grow — so the corner dot follows the pointer
      // vertically: drag toward the anchored edge to shrink, away to grow
      const d0 = Math.abs(p0.y - ay) || 1;
      const d1 = Math.max(0, (p1.y - ay) * Math.sign(p0.y - ay));
      const ns = clampNum(Math.round(s0.overlayScale * (d1 / d0) * 2) / 2, 50, 150);
      el.overlayScale.value = ns; el.overlayScaleVal.textContent = fmtPct(ns);
    }
    if (!stampDragFrame) {
      stampDragFrame = requestAnimationFrame(() => { stampDragFrame = 0; onSettingsChanged(); });
    }
  });

  function endStampDrag() {
    if (!stampDrag) return;
    stampDrag = null;
    el.previewStampFrame.classList.remove('dragging');
    onSettingsChanged();
  }
  el.previewStampFrame.addEventListener('pointerup', endStampDrag);
  el.previewStampFrame.addEventListener('pointercancel', endStampDrag);

  el.resetPlacementBtn.addEventListener('click', () => {
    el.overlayScale.value = DEFAULT_SETTINGS.overlayScale; el.overlayScaleVal.textContent = fmtPct(DEFAULT_SETTINGS.overlayScale);
    el.offsetX.value = 0; el.offsetXVal.textContent = fmtPct(0);
    el.offsetY.value = 0; el.offsetYVal.textContent = fmtPct(0);
    onSettingsChanged();
  });

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

  function buildOverlayOpts(row, dims, settings, mapCanvas, autoData) {
    return {
      template: settings.template,
      logoImg: state.logoImg,
      logoIsCustom: logoSource === 'upload',
      badgeIconImg: state.badgeIconImg,
      mapImg: mapCanvas,
      width: dims.w,
      height: dims.h,
      dateFormat: settings.dateFormat,
      overlayPos: settings.overlayPos,
      overlayAlignH: settings.overlayAlignH,
      overlayScale: settings.overlayScale,
      overlayWidthPct: settings.overlayWidthPct,
      offsetX: settings.offsetX,
      offsetY: settings.offsetY,
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
      mapScale: settings.mapScale,
      mapLabelShow: settings.mapLabelShow,
      mapLabelText: settings.mapLabelText,
      showMapCone: settings.showMapCone,
      mapConeBearing: settings.mapConeBearing,
      watermarkLang: settings.watermarkLang,
      latLngFormat: settings.latLngFormat,
      stampFont: settings.stampFont,
      mapLabelLogoImg: state.mapLabelLogoImg,
      timeFormat: settings.timeFormat,
      showGeoCity: settings.showGeoCity,
      showGeoProvince: settings.showGeoProvince,
      showGeoCountry: settings.showGeoCountry,
      showGeoFlag: settings.showGeoFlag,
      geo: autoData ? autoData.geo : null,
      countryFlagImg: autoData ? autoData.flagImg : null,
      elevation: autoData ? autoData.elevation : null,
      weather: autoData ? autoData.weather : null
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
    await fontsReady;
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
    const needsAuto = settingsSnapshot.autoGeocode || settingsSnapshot.autoElevation || settingsSnapshot.autoWeather;

    for (let i = 0; i < total; i++) {
      const row = state.rows[i];

      // 1) resolve map thumbnail for this row (timeout-guarded — never hangs)
      let mapCanvas = null;
      if (settingsSnapshot.showMap && settingsSnapshot.mapSource !== 'offline') {
        mapCanvas = await resolveMapForRow(row, settingsSnapshot);
        if (!mapCanvas) mapFailCount++;
      }

      // 1b) resolve "Deteksi Otomatis dari Koordinat" data for this row
      // (geocoding/elevation/weather; same timeout-guarded, never-hangs
      // contract as the map)
      let autoData = null;
      if (needsAuto) {
        autoData = await resolveAutoDataForRow(row, settingsSnapshot);
        if (settingsSnapshot.autoGeocode && !autoData.geo) geoFailCount++;
      }

      // 2) render the overlay (synchronous, fast, cannot hang)
      try {
        const renderRow = applyProjectOverride(row, settingsSnapshot);
        renderOverlay(workCanvas, renderRow, buildOverlayOpts(renderRow, dims, settingsSnapshot, mapCanvas, autoData));
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
    if (settingsSnapshot.autoGeocode && geoFailCount > 0) {
      extraMsg += ` ${geoFailCount} baris gagal deteksi lokasi otomatis, memakai kolom Lokasi/Alamat dari CSV sebagai gantinya.`;
    }
    el.doneMsg.innerHTML = `Selesai! ZIP berisi <strong>${total}</strong> file PNG telah diunduh.${extraMsg ? '<br><span style="color:var(--text-dim);font-size:11.5px;">' + extraMsg.trim() + '</span>' : ''}`
      + (window.coffeeCtaHtml ? window.coffeeCtaHtml() : '');
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
    importPhotoRows: (rows, files) => importPhotoRows(rows, files),
    fontsReady: () => fontsReady,
    getLogo: () => state.logoImg,
    getSettings: () => ({ ...state.settings }),
    getDims: () => getCanvasDims(state.settings),
    buildOverlayOpts: (row, dims, settings, mapImg, autoData) => buildOverlayOpts(row, dims, settings, mapImg, autoData),
    applyProjectOverride: (row, settings) => applyProjectOverride(row, settings),
    resolveMapForRow: (row, settings) => resolveMapForRow(row, settings),
    resolveGeoForRow: (row, settings) => resolveGeoForRow(row, settings),
    resolveAutoDataForRow: (row, settings) => resolveAutoDataForRow(row, settings),
    renderOverlay: (canvas, row, opts) => renderOverlay(canvas, row, opts),
    sanitizeFilename: (s) => sanitizeFilename(s),
    timestampSlug: () => timestampSlug(),
    getSampleIndex: () => state.sampleIndex,
    setSampleIndex: (index) => setSampleIndex(index),
    updateRowCoords: (index, lat, lng) => updateRowCoords(index, lat, lng),
    onRowsChanged: (cb) => { rowsChangedListeners.push(cb); }
  };

})();
