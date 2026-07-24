/* =========================================================
   mapview.js — Tab 1's "Peta & Kalender Data" panel: an
   interactive Leaflet map (street/satellite) showing every
   imported row as a draggable pin, plus a calendar highlighting
   which dates are represented in the data. Reads/writes through
   window.GeoStamp (exposed by main.js) so it has no direct
   access to main.js's internal state.

   Dragging a pin calls GeoStamp.updateRowCoords(), which is the
   same row array used for preview/generation — so the watermark
   preview and the "Preview Data" table reflect the drag live.
   ========================================================= */
(function () {
  'use strict';

  if (typeof L === 'undefined' || !window.GeoStamp) return; // Leaflet or main.js missing — feature quietly unavailable

  const el = {
    mapEl: document.getElementById('mcMap'),
    mapEmpty: document.getElementById('mcMapEmpty'),
    count: document.getElementById('mcCount'),
    calendarEmpty: document.getElementById('mcCalendarEmpty'),
    calendarMonths: document.getElementById('mcCalendarMonths'),
    filterInfo: document.getElementById('mcFilterInfo'),
    filterLabel: document.getElementById('mcFilterLabel'),
    filterList: document.getElementById('mcFilterList'),
    filterClearBtn: document.getElementById('mcFilterClearBtn')
  };
  if (!el.mapEl) return;

  const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  let map = null;
  let markersLayer = null;
  const markerByIndex = new Map(); // rowIndex -> L.Marker
  let selectedDateKey = null;

  function initMap() {
    if (map) return;
    map = L.map(el.mapEl, { center: [-2.5, 118], zoom: 4, scrollWheelZoom: true });

    // Same free, keyless Esri tile services already used for the
    // generated watermark's map thumbnail (js/maptile.js) — kept
    // consistent rather than pointing at OpenStreetMap's own tile
    // servers, whose usage policy prohibits this kind of automated use.
    const street = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Esri, HERE, Garmin, USGS, OpenStreetMap contributors'
    }).addTo(map);
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Esri, Maxar, Earthstar Geographics'
    });
    L.control.layers({ 'Jalan': street, 'Satelit': satellite }, null, { position: 'topright' }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
  }

  function dateKeyOf(row) {
    const d = parseFlexibleDate(row.date);
    if (!d) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function refresh() {
    initMap();
    const rows = window.GeoStamp.getRows();
    const validRows = [];
    rows.forEach((row, i) => {
      if (!isNaN(row.lat) && !isNaN(row.lng)) validRows.push({ row, i });
    });

    el.count.textContent = validRows.length ? `${validRows.length} titik di peta` : '';
    el.mapEmpty.classList.toggle('hidden', validRows.length > 0);

    markersLayer.clearLayers();
    markerByIndex.clear();

    validRows.forEach(({ row, i }) => {
      const marker = L.marker([row.lat, row.lng], { draggable: true });
      marker.bindPopup(popupHtml(row, i));
      marker.on('click', () => window.GeoStamp.setSampleIndex(i));
      marker.on('dragend', (e) => {
        const ll = e.target.getLatLng();
        window.GeoStamp.updateRowCoords(i, ll.lat, ll.lng);
      });
      marker.addTo(markersLayer);
      markerByIndex.set(i, marker);
    });

    if (validRows.length) {
      const bounds = L.latLngBounds(validRows.map(({ row }) => [row.lat, row.lng]));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }

    // in case the container was resized/hidden (e.g. tab switch) since
    // the map was created, Leaflet needs a nudge to recompute its size
    setTimeout(() => { if (map) map.invalidateSize(); }, 50);

    renderCalendar(rows);
    applyDateFilter();
  }

  function popupHtml(row, i) {
    let html = `<strong>${escapeHtml(row.file || ('Baris ' + (i + 1)))}</strong>`;
    if (row.date) html += `<br>${escapeHtml(row.date)}${row.time ? ' ' + escapeHtml(row.time) : ''}`;
    return html;
  }

  function renderCalendar(rows) {
    const byDate = new Map(); // dateKey -> [{row,i}]
    rows.forEach((row, i) => {
      const key = dateKeyOf(row);
      if (!key) return;
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key).push({ row, i });
    });

    if (!byDate.size) {
      el.calendarEmpty.classList.remove('hidden');
      el.calendarMonths.innerHTML = '';
      selectedDateKey = null;
      return;
    }
    el.calendarEmpty.classList.add('hidden');

    const keys = Array.from(byDate.keys()).sort();
    const [fy, fm] = keys[0].split('-').map(Number);
    const [ly, lm] = keys[keys.length - 1].split('-').map(Number);

    let y = fy, m = fm - 1;
    const months = [];
    while (y < ly || (y === ly && m <= lm - 1)) {
      months.push({ y, m });
      m++;
      if (m > 11) { m = 0; y++; }
    }

    el.calendarMonths.innerHTML = months.map(({ y, m }) => buildMonthHtml(y, m, byDate)).join('');
  }

  function buildMonthHtml(y, m, byDate) {
    const firstDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    let cells = '';
    for (let i = 0; i < firstDow; i++) cells += '<div class="mc-cal-cell mc-cal-cell-blank"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const items = byDate.get(key);
      const has = !!items;
      const activeClass = key === selectedDateKey ? ' active' : '';
      cells += `<button type="button" class="mc-cal-cell${has ? ' has-data' + activeClass : ''}" data-date="${key}" ${has ? '' : 'disabled'} title="${has ? items.length + ' foto pada tanggal ini' : ''}">`
        + `<span class="mc-cal-daynum">${d}</span>`
        + (has ? `<span class="mc-cal-dot">${items.length}</span>` : '')
        + '</button>';
    }
    return `<div class="mc-month">
      <div class="mc-month-title">${MONTH_NAMES[m]} ${y}</div>
      <div class="mc-cal-daylabels">${DAY_NAMES.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="mc-cal-grid">${cells}</div>
    </div>`;
  }

  el.calendarMonths.addEventListener('click', (e) => {
    const btn = e.target.closest('.mc-cal-cell.has-data');
    if (!btn) return;
    const key = btn.dataset.date;
    selectedDateKey = (selectedDateKey === key) ? null : key;
    renderCalendar(window.GeoStamp.getRows());
    applyDateFilter();
  });

  el.filterClearBtn.addEventListener('click', () => {
    selectedDateKey = null;
    renderCalendar(window.GeoStamp.getRows());
    applyDateFilter();
  });

  function applyDateFilter() {
    const rows = window.GeoStamp.getRows();
    if (!selectedDateKey) {
      el.filterInfo.classList.add('hidden');
      markerByIndex.forEach(marker => marker.setOpacity(1));
      return;
    }
    const matches = [];
    markerByIndex.forEach((marker, i) => {
      const row = rows[i];
      const on = row && dateKeyOf(row) === selectedDateKey;
      marker.setOpacity(on ? 1 : 0.25);
      if (on) matches.push(row);
    });

    el.filterInfo.classList.remove('hidden');
    const [y, m, d] = selectedDateKey.split('-').map(Number);
    el.filterLabel.textContent = `${d} ${MONTH_NAMES[m - 1]} ${y} — ${matches.length} foto`;
    el.filterList.textContent = matches.length ? matches.map(r => r.file).join(', ') : 'Tidak ada foto valid (koordinat kosong) pada tanggal ini.';

    const validMatches = matches.filter(r => !isNaN(r.lat) && !isNaN(r.lng));
    if (validMatches.length) {
      const bounds = L.latLngBounds(validMatches.map(r => [r.lat, r.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }

  window.addEventListener('geostamp:tabchange', (e) => {
    if (e.detail && e.detail.tab === 'tab-overlay' && map) {
      setTimeout(() => map.invalidateSize(), 50);
    }
  });

  // Leaflet mis-measures its container while it's display:none, so
  // nudge it right after the card's own collapse toggle runs (deferred
  // via setTimeout so it always reads the class AFTER tabs.js's generic
  // collapse-toggle listener has already flipped it, regardless of
  // which of the two click listeners on this button fires first).
  const mcToggleBtn = document.getElementById('mcToggleBtn');
  if (mcToggleBtn) {
    mcToggleBtn.addEventListener('click', () => {
      setTimeout(() => { if (map) map.invalidateSize(); }, 50);
    });
  }

  window.GeoStamp.onRowsChanged(refresh);
  refresh(); // initial paint (covers reload before any explicit rows-changed event)
})();
