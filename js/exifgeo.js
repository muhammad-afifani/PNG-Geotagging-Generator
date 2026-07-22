/* exifgeo.js — write GPS + date/time into JPEG EXIF metadata, fully
 * client-side, using piexifjs (bundled in libs/piexif.min.js).
 *
 * Use case: field-inspection photos whose camera/phone didn't record
 * GPS. The real location is known (from a CSV or manual entry) and
 * simply needs to be embedded into the photo's metadata.
 *
 * Only JPEG supports EXIF. PNG/WebP/etc. don't carry EXIF the same
 * way, so those are reported as unsupported for metadata embedding
 * (they can still be used for the burn-in overlay feature).
 */

/**
 * Convert a decimal degree value into the EXIF rational DMS format
 * piexif expects: [[deg,1],[min,1],[sec,100]].
 */
function _degToDmsRational(dec) {
  const abs = Math.abs(dec);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Math.round((minFloat - min) * 60 * 100); // 2-decimal precision
  return [[deg, 1], [min, 1], [sec, 100]];
}

/**
 * Format a JS Date into EXIF datetime string "YYYY:MM:DD HH:MM:SS".
 */
function _exifDateTime(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}:${p(date.getMonth() + 1)}:${p(date.getDate())} `
    + `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

/**
 * Build a piexif "exifObj" for the given lat/lng and optional date.
 * If stripOthers is true, the result contains ONLY the GPS + date
 * fields (a clean file with no leftover camera/software metadata).
 * If false, the caller should merge this into the photo's existing
 * EXIF (handled in writeGeotagToJpeg).
 *
 * opts (all optional):
 *   altitude    number, meters (can be negative for below sea level)
 *   description string -> ImageDescription (0th IFD)
 *   artist      string -> Artist / surveyor-photographer name (0th IFD)
 *   copyright   string -> Copyright / instansi-perusahaan (0th IFD)
 */
function buildExifObj(lat, lng, dateObj, opts) {
  opts = opts || {};
  const gps = {};
  gps[piexif.GPSIFD.GPSVersionID] = [2, 3, 0, 0];
  gps[piexif.GPSIFD.GPSLatitudeRef] = lat >= 0 ? 'N' : 'S';
  gps[piexif.GPSIFD.GPSLatitude] = _degToDmsRational(lat);
  gps[piexif.GPSIFD.GPSLongitudeRef] = lng >= 0 ? 'E' : 'W';
  gps[piexif.GPSIFD.GPSLongitude] = _degToDmsRational(lng);

  if (opts.altitude !== undefined && opts.altitude !== null && !isNaN(opts.altitude)) {
    gps[piexif.GPSIFD.GPSAltitudeRef] = opts.altitude < 0 ? 1 : 0;
    gps[piexif.GPSIFD.GPSAltitude] = [Math.round(Math.abs(opts.altitude) * 100), 100];
  }

  const exif = {};
  const zeroth = {};
  if (dateObj) {
    const dt = _exifDateTime(dateObj);
    exif[piexif.ExifIFD.DateTimeOriginal] = dt;
    exif[piexif.ExifIFD.DateTimeDigitized] = dt;
    zeroth[piexif.ImageIFD.DateTime] = dt;
    // also record GPS date/time stamp
    const p = (n) => String(n).padStart(2, '0');
    gps[piexif.GPSIFD.GPSDateStamp] = `${dateObj.getUTCFullYear()}:${p(dateObj.getUTCMonth() + 1)}:${p(dateObj.getUTCDate())}`;
    gps[piexif.GPSIFD.GPSTimeStamp] = [
      [dateObj.getUTCHours(), 1],
      [dateObj.getUTCMinutes(), 1],
      [dateObj.getUTCSeconds(), 1]
    ];
  }

  if (opts.description) zeroth[piexif.ImageIFD.ImageDescription] = String(opts.description);
  if (opts.artist) zeroth[piexif.ImageIFD.Artist] = String(opts.artist);
  if (opts.copyright) zeroth[piexif.ImageIFD.Copyright] = String(opts.copyright);

  return { '0th': zeroth, 'Exif': exif, 'GPS': gps, 'Interop': {}, '1st': {}, 'thumbnail': null };
}

/**
 * Read a File (JPEG) as a binary string that piexif can operate on.
 */
function _readFileAsBinaryString(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Write GPS + date/time into a JPEG File, returning a Blob of the
 * new JPEG.
 *
 * options:
 *   lat, lng      (numbers, required)
 *   date          (JS Date, optional)
 *   altitude      (number, optional, meters)
 *   description   (string, optional) -> ImageDescription
 *   artist        (string, optional) -> Artist (petugas/surveyor)
 *   copyright     (string, optional) -> Copyright (instansi/perusahaan)
 *   stripOthers   (bool) — if true, remove ALL pre-existing metadata
 *                 and write only GPS + date (clean file). If false,
 *                 keep existing EXIF and only add/replace GPS + date.
 *
 * Returns { blob, warning } where warning is set if the file wasn't
 * a JPEG (in which case blob is null).
 */
async function writeGeotagToJpeg(file, options) {
  const isJpeg = /\.jpe?g$/i.test(file.name || '') ||
    (file.type || '').toLowerCase().includes('jpeg') ||
    (file.type || '').toLowerCase().includes('jpg');

  if (!isJpeg) {
    return { blob: null, warning: `${file.name}: bukan JPEG — EXIF hanya didukung untuk file .jpg/.jpeg` };
  }

  const binary = await _readFileAsBinaryString(file);
  const dataURL = 'data:image/jpeg;base64,' + btoa(binary);

  const extraOpts = {
    altitude: options.altitude,
    description: options.description,
    artist: options.artist,
    copyright: options.copyright
  };

  let exifObj;
  if (options.stripOthers) {
    // clean slate: only our fields
    exifObj = buildExifObj(options.lat, options.lng, options.date || null, extraOpts);
  } else {
    // merge into existing metadata
    let existing;
    try {
      existing = piexif.load(dataURL);
    } catch (e) {
      existing = { '0th': {}, 'Exif': {}, 'GPS': {}, 'Interop': {}, '1st': {}, 'thumbnail': null };
    }
    const ours = buildExifObj(options.lat, options.lng, options.date || null, extraOpts);
    existing.GPS = ours.GPS;
    Object.keys(ours.Exif).forEach(k => { existing.Exif[k] = ours.Exif[k]; });
    Object.keys(ours['0th']).forEach(k => { existing['0th'][k] = ours['0th'][k]; });
    exifObj = existing;
  }

  const exifBytes = piexif.dump(exifObj);
  let newDataURL;
  if (options.stripOthers) {
    // remove any existing EXIF first, then insert only ours -> clean file
    const stripped = piexif.remove(dataURL);
    newDataURL = piexif.insert(exifBytes, stripped);
  } else {
    newDataURL = piexif.insert(exifBytes, dataURL);
  }

  // dataURL -> Blob
  const base64 = newDataURL.split(',')[1];
  const bin = atob(base64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return { blob: new Blob([bytes], { type: 'image/jpeg' }), warning: null };
}

/**
 * Offset a lat/lng by a random distance (0..maxMeters) in a random
 * direction. Used by the "scatter/randomize coordinates" option so
 * batches don't all sit on the exact same CSV point.
 * Returns { lat, lng }.
 */
function scatterCoordinate(lat, lng, maxMeters) {
  if (!maxMeters || maxMeters <= 0) return { lat, lng };
  // random distance and bearing
  const dist = Math.random() * maxMeters;          // meters
  const bearing = Math.random() * 2 * Math.PI;     // radians
  // meters -> degrees (approx). 1 deg lat ~= 111,320 m.
  const dLat = (dist * Math.cos(bearing)) / 111320;
  const dLng = (dist * Math.sin(bearing)) / (111320 * Math.cos(lat * Math.PI / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}
