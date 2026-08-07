/* =========================================================
   heicsupport.js — shared helper for Apple's HEIC/HEIF photos.
   No mainstream browser can decode HEIC in an <img>/<canvas> — Safari
   is the one exception (it decodes HEIC natively, instantly, with no
   conversion needed). Everywhere else, uploads in this format
   otherwise silently fail wherever the app loads a photo into an
   Image element or hands it to piexif for EXIF writing.

   Two-tier strategy:
   1) Always try the browser's OWN decoder first (works for every
      format, and is what makes Safari instant for HEIC too — no need
      to special-case it).
   2) Only if that fails (HEIC on Chrome/Firefox/Edge, i.e. most
      users) fall back to heic2any (bundled locally in libs/heic2any/,
      MIT license, wraps libheif compiled to WASM, fully self-
      contained — no CDN fetch at runtime). This path is genuinely
      slow — a real full-resolution iPhone photo (12+ MP) can take
      anywhere from several seconds to over a minute to decode in
      pure-WASM software HEVC, since there's no hardware acceleration
      available to JS. Callers MUST surface a "converting, this can
      take a while" status via the onStatus callback, or the wait
      reads as the app being frozen/broken.

   Note: heic2any does not carry over the original file's EXIF, so
   toProcessableFile() is only appropriate where the pipeline doesn't
   depend on reading EXIF that was already inside the HEIC (Tab 4's
   date-extraction already has its own file-timestamp fallback for
   exactly this case).
   ========================================================= */
(function () {
  'use strict';

  const HEIC_CONVERT_TIMEOUT_MS = 180000; // generous — large photos can legitimately take over a minute in software WASM decode

  function isHeicFile(file) {
    const name = (file.name || '').toLowerCase();
    const type = (file.type || '').toLowerCase();
    return /\.hei[cf]$/.test(name) || type === 'image/heic' || type === 'image/heif';
  }

  /**
   * Try to decode ANY file straight through the browser's native
   * <img> pipeline. Instant when it works (every format on every
   * browser, plus HEIC specifically on Safari). Never throws —
   * resolves { img, url } on success or null on failure/timeout, so
   * callers can fall back cleanly.
   */
  function tryNativeImageDecode(file, timeoutMs) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      let settled = false;
      const img = new Image();
      const timer = setTimeout(() => finish(null), timeoutMs || 4000);
      function finish(result) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!result) URL.revokeObjectURL(url);
        resolve(result);
      }
      img.onload = () => finish(img.naturalWidth > 0 && img.naturalHeight > 0 ? { img, url } : null);
      img.onerror = () => finish(null);
      img.src = url;
    });
  }

  /**
   * Converts a HEIC/HEIF Blob to a JPEG File via heic2any, with a
   * generous timeout so a stuck/corrupt file fails with a clear error
   * instead of hanging forever. Rejects with an Indonesian message on
   * any failure.
   */
  async function convertHeicToJpeg(file) {
    if (typeof heic2any !== 'function') {
      throw new Error('Dukungan HEIC tidak tersedia (library gagal dimuat).');
    }
    let timer;
    try {
      const conversion = heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Konversi HEIC memakan waktu terlalu lama (lebih dari 3 menit) — coba foto dengan resolusi lebih kecil.')),
          HEIC_CONVERT_TIMEOUT_MS
        );
      });
      const result = await Promise.race([conversion, timeout]);
      const outBlob = Array.isArray(result) ? result[0] : result;
      const newName = file.name.replace(/\.hei[cf]$/i, '.jpg');
      return new File([outBlob], newName, { type: 'image/jpeg' });
    } catch (e) {
      throw new Error(`Gagal mengonversi foto HEIC "${file.name}" — ${(e && e.message) || 'file mungkin rusak atau formatnya tidak didukung'}.`);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Load any photo File (JPG/PNG/HEIC/...) into an <img>, as fast as
   * possible: native browser decode first (instant, and the only path
   * non-HEIC files ever need), falling back to the slow HEIC->JPEG
   * WASM conversion only when that fails (HEIC on a browser without
   * native support, which today is most non-Safari browsers).
   *
   * `onStatus('converting')` fires right before the slow fallback
   * starts, so callers can show a "this may take a while" message.
   * Returns { img, url } — caller owns `url` and must revoke it.
   */
  async function loadImageElement(file, onStatus) {
    const native = await tryNativeImageDecode(file, isHeicFile(file) ? 1500 : 4000);
    if (native) return native;
    if (!isHeicFile(file)) {
      throw new Error('Gagal memuat foto ' + file.name + ' (format tidak didukung browser).');
    }
    if (onStatus) onStatus('converting');
    const jpegFile = await convertHeicToJpeg(file);
    const converted = await tryNativeImageDecode(jpegFile, 8000);
    if (!converted) throw new Error('Gagal memuat foto hasil konversi HEIC "' + file.name + '".');
    return converted;
  }

  /**
   * Always returns a real JPEG File — used where actual JPEG BYTES are
   * required (e.g. writing EXIF with piexif), not just pixels. Native
   * HEIC rendering support (Safari) doesn't help here: the underlying
   * bytes are still HEIC, and piexif can only parse JPEG's structure,
   * so this always goes through the WASM conversion for HEIC input.
   */
  async function toProcessableFile(file, onStatus) {
    if (!isHeicFile(file)) return file;
    if (onStatus) onStatus('converting');
    return convertHeicToJpeg(file);
  }

  window.GeoStampHeic = { isHeicFile, loadImageElement, toProcessableFile };
})();
