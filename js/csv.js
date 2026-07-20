/* =========================================================
   csv.js — CSV parsing (PapaParse) and flexible column mapping.
   Supports both Indonesian and English header names, since
   different exports (e.g. "Nama File" vs "nama_file") may be used.
   ========================================================= */

/** Candidate header names per logical field, checked case-insensitively
 *  and with separators (spaces/underscores) ignored. */
const COLUMN_ALIASES = {
  file:    ['namafile', 'nama file', 'filename', 'file name', 'file', 'nama'],
  lat:     ['latitude', 'lat'],
  lng:     ['longitude', 'lng', 'long', 'lon'],
  date:    ['tanggal', 'date'],
  time:    ['waktu', 'time', 'jam'],
  location:['lokasi', 'location', 'project', 'projectname', 'nama project'],
  address: ['alamat', 'address'],
  city:    ['kota', 'city']
};

function normalizeHeader(h) {
  return String(h || '').toLowerCase().replace(/[\s_]+/g, '');
}

/**
 * Given the array of raw CSV header strings, produce a map from
 * logical field name -> actual header string found in the file.
 */
function detectColumnMap(headers) {
  const normalized = headers.map(h => ({ raw: h, norm: normalizeHeader(h) }));
  const map = {};

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const normalizedAliases = aliases.map(normalizeHeader);
    const found = normalized.find(h => normalizedAliases.includes(h.norm));
    if (found) map[field] = found.raw;
  }
  return map;
}

/**
 * Parse a CSV File object using PapaParse.
 * @returns {Promise<{headers: string[], rows: object[]}>}
 */
function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        resolve({ headers, rows: results.data });
      },
      error: (err) => reject(err)
    });
  });
}

/**
 * Convert raw CSV rows + a column map into normalized row objects
 * ready for rendering: { file, lat, lng, date, time, location, address, city }
 */
function normalizeRows(rawRows, colMap) {
  return rawRows.map((r, idx) => {
    const get = (field) => colMap[field] ? r[colMap[field]] : '';
    const latRaw = get('lat');
    const lngRaw = get('lng');
    const locationVal = get('location');
    const addressVal = get('address');

    // If there's no dedicated "city" column, derive a short city line
    // from the location field (first comma segment) as a sensible default.
    let cityVal = get('city');
    if (!cityVal) {
      cityVal = locationVal ? String(locationVal).split(',').slice(0, 1).join(',').trim() + (String(locationVal).split(',').length > 1 ? ', ' + String(locationVal).split(',').slice(1).join(',').trim() : '') : '';
      cityVal = locationVal || '';
    }

    return {
      _index: idx,
      file: (get('file') || `IMG_${String(idx + 1).padStart(4, '0')}`).toString().trim(),
      lat: parseFloat(latRaw),
      lng: parseFloat(lngRaw),
      date: get('date'),
      time: get('time'),
      location: locationVal || '',
      address: addressVal || '',
      city: cityVal || locationVal || ''
    };
  }).filter(r => r.file); // drop fully blank lines
}

/**
 * Sanitize a filename fragment: strip characters illegal in filenames,
 * collapse whitespace, and ensure it's non-empty.
 */
function sanitizeFilename(name) {
  const cleaned = String(name)
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim();
  return cleaned || 'output';
}
