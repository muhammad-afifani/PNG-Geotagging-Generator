/* =========================================================
   photometa.js — read capture date/time and GPS coordinates from a
   photo's EXIF (JPEG), falling back to the file's last-modified time
   for the date. Shared by Tab 1's "Dari Folder Foto" import and Tab 4.
   ========================================================= */
(function () {
  'use strict';

  // EXIF lives in the APP1 segment at the very start of a JPEG; reading
  // only the head keeps big folders fast (no full multi-MB decode).
  const EXIF_HEAD_BYTES = 256 * 1024;

  function isPhotoFile(f) {
    return (f.type || '').startsWith('image/') || /\.(jpe?g|png|hei[cf])$/i.test(f.name || '');
  }

  function isJpeg(file) {
    return /\.jpe?g$/i.test(file.name || '') || (file.type || '').toLowerCase().includes('jpeg');
  }

  function readAsBinaryString(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Gagal membaca file.'));
      reader.readAsBinaryString(blob);
    });
  }

  function loadExif(binary) {
    return piexif.load('data:image/jpeg;base64,' + btoa(binary));
  }

  function fileTimestamp(file) {
    const d = new Date(file.lastModified);
    const p = (n) => String(n).padStart(2, '0');
    return {
      date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
      time: `${p(d.getHours())}:${p(d.getMinutes())}`
    };
  }

  /**
   * Returns { date: 'YYYY-MM-DD', time: 'HH:MM', dateSource: 'exif'|'file',
   * lat, lng, direction } — lat/lng/direction null when not in the EXIF.
   * Never throws.
   */
  async function extract(file) {
    let exifObj = null;
    if (isJpeg(file)) {
      try {
        exifObj = loadExif(await readAsBinaryString(file.slice(0, EXIF_HEAD_BYTES)));
      } catch (e) {
        try { exifObj = loadExif(await readAsBinaryString(file)); } catch (e2) { exifObj = null; }
      }
    }

    let date = null, time = null;
    if (exifObj) {
      const raw = (exifObj.Exif && exifObj.Exif[piexif.ExifIFD.DateTimeOriginal])
        || (exifObj['0th'] && exifObj['0th'][piexif.ImageIFD.DateTime]);
      const m = raw && String(raw).match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/);
      if (m) { date = `${m[1]}-${m[2]}-${m[3]}`; time = `${m[4]}:${m[5]}`; }
    }
    let dateSource = 'exif';
    if (!date) {
      const t = fileTimestamp(file);
      date = t.date; time = t.time; dateSource = 'file';
    }

    let lat = null, lng = null, direction = null;
    const gps = exifObj && exifObj.GPS;
    if (gps && gps[piexif.GPSIFD.GPSLatitude] && gps[piexif.GPSIFD.GPSLongitude]) {
      try {
        const la = piexif.GPSHelper.dmsRationalToDeg(gps[piexif.GPSIFD.GPSLatitude], gps[piexif.GPSIFD.GPSLatitudeRef] || 'N');
        const lo = piexif.GPSHelper.dmsRationalToDeg(gps[piexif.GPSIFD.GPSLongitude], gps[piexif.GPSIFD.GPSLongitudeRef] || 'E');
        if (!isNaN(la) && !isNaN(lo) && !(la === 0 && lo === 0)) { lat = la; lng = lo; }
      } catch (e) { /* no usable GPS */ }
    }
    const dir = gps && gps[piexif.GPSIFD.GPSImgDirection];
    if (dir && dir[1]) {
      const deg = dir[0] / dir[1];
      if (!isNaN(deg)) direction = String(Math.round(deg) % 360);
    }
    return { date, time, dateSource, lat, lng, direction };
  }

  window.GeoStampPhotoMeta = { extract, isPhotoFile };
})();
