/* =========================================================
   heicsupport.js — shared helper for Apple's HEIC/HEIF photos.
   No browser can decode HEIC in an <img>/<canvas> (Safari is the
   closest, but support is inconsistent), so uploads in that format
   otherwise silently fail wherever the app loads a photo into an
   Image element or hands it to piexif for EXIF writing.

   Uses heic2any (bundled locally in libs/heic2any/, MIT license,
   wraps libheif compiled to WASM, fully self-contained — no CDN
   fetch at runtime) to convert to a JPEG Blob up front, so the rest
   of the existing JPEG/PNG-based pipeline (canvas drawing, piexif)
   can process it unchanged. Note: heic2any does not carry over the
   original file's EXIF metadata, so this is only used where the
   pipeline doesn't depend on reading EXIF that was already inside
   the HEIC (Tab 4's date-extraction already has its own file-
   timestamp fallback for exactly this case).
   ========================================================= */
(function () {
  'use strict';

  function isHeicFile(file) {
    const name = (file.name || '').toLowerCase();
    const type = (file.type || '').toLowerCase();
    return /\.hei[cf]$/.test(name) || type === 'image/heic' || type === 'image/heif';
  }

  /**
   * If `file` is HEIC/HEIF, converts it to a JPEG File (same base
   * name, .jpg extension) via heic2any. Otherwise resolves the
   * original file unchanged. Rejects with a clear Indonesian error
   * message on conversion failure (corrupt file, unsupported variant).
   */
  async function toProcessableFile(file) {
    if (!isHeicFile(file)) return file;
    if (typeof heic2any !== 'function') {
      throw new Error('Dukungan HEIC tidak tersedia (library gagal dimuat).');
    }
    try {
      const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
      const outBlob = Array.isArray(result) ? result[0] : result;
      const newName = file.name.replace(/\.hei[cf]$/i, '.jpg');
      return new File([outBlob], newName, { type: 'image/jpeg' });
    } catch (e) {
      throw new Error(`Gagal mengonversi foto HEIC "${file.name}" — file mungkin rusak atau formatnya tidak didukung.`);
    }
  }

  window.GeoStampHeic = { isHeicFile, toProcessableFile };
})();
