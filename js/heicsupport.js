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
      users) fall back to libheif-js (bundled locally in libs/libheif/,
      LGPL-3.0, the actively-maintained official JS/WASM build of the
      libheif C library — fully self-contained, no CDN fetch at
      runtime). This path is genuinely slow — a real full-resolution
      iPhone photo (12+ MP) can take anywhere from several seconds to
      over a minute to decode in pure-WASM software HEVC, since
      there's no hardware acceleration available to JS. Callers MUST
      surface a "converting, this can take a while" status via the
      onStatus callback, or the wait reads as the app being frozen.

   Note: this conversion does not carry over the original file's EXIF,
   so toProcessableFile() is only appropriate where the pipeline
   doesn't depend on reading EXIF that was already inside the HEIC
   (Tab 4's date-extraction already has its own file-timestamp
   fallback for exactly this case).
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

  // libheif's WASM module is expensive to instantiate — reuse a single
  // initialized instance across every HEIC file in a batch instead of
  // re-instantiating per file.
  let _libheifModulePromise = null;
  function getLibheifModule() {
    if (!_libheifModulePromise) {
      if (typeof libheif !== 'function') {
        return Promise.reject(new Error('Dukungan HEIC tidak tersedia (library gagal dimuat).'));
      }
      // normalize to a real Promise -- libheif() can return a thenable
      // that isn't a full native Promise (lacks .catch etc.)
      _libheifModulePromise = Promise.resolve(libheif());
    }
    return _libheifModulePromise;
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Gagal membaca file ' + file.name));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Converts a HEIC/HEIF Blob to a JPEG File via libheif-js, with a
   * generous timeout so a stuck/corrupt file fails with a clear error
   * instead of hanging forever. Rejects with a specific, actionable
   * Indonesian message identifying exactly which step failed (reading
   * the file, decoding it, or rendering pixels) rather than one generic
   * "conversion failed" for every possible cause.
   */
  async function convertHeicToJpeg(file) {
    const work = (async () => {
      const mod = await getLibheifModule().catch((e) => {
        throw new Error(`${(e && e.message) || 'Library HEIC gagal dimuat'}`);
      });

      let bytes;
      try {
        bytes = new Uint8Array(await readFileAsArrayBuffer(file));
      } catch (e) {
        throw new Error(`Gagal membaca file "${file.name}" — ${(e && e.message) || 'file mungkin rusak'}.`);
      }

      let images;
      try {
        const decoder = new mod.HeifDecoder();
        images = decoder.decode(bytes);
      } catch (e) {
        throw new Error(`Gagal decode HEIC "${file.name}" — ${(e && e.message) || 'format HEIC ini mungkin tidak didukung'}.`);
      }
      if (!images || !images.length) {
        throw new Error(`Tidak ada gambar yang ditemukan di dalam file "${file.name}" — file mungkin rusak atau bukan HEIC/HEIF yang valid.`);
      }

      const image = images[0];
      const width = image.get_width();
      const height = image.get_height();
      if (!width || !height) {
        throw new Error(`Dimensi gambar tidak valid untuk "${file.name}" (${width}x${height}).`);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.createImageData(width, height);

      try {
        await new Promise((resolve, reject) => {
          image.display(imageData, (displayData) => {
            if (!displayData) { reject(new Error('proses render piksel gagal (kemungkinan varian HEIC yang tidak didukung)')); return; }
            resolve();
          });
        });
      } catch (e) {
        throw new Error(`Gagal merender foto "${file.name}" — ${(e && e.message) || 'error tidak diketahui'}.`);
      }
      ctx.putImageData(imageData, 0, 0);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) {
        throw new Error(`Gagal mengekspor hasil konversi "${file.name}" ke JPEG.`);
      }

      const newName = file.name.replace(/\.hei[cf]$/i, '.jpg');
      return new File([blob], newName, { type: 'image/jpeg' });
    })();

    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Konversi HEIC "${file.name}" memakan waktu terlalu lama (lebih dari 3 menit) — coba foto dengan resolusi lebih kecil.`)),
        HEIC_CONVERT_TIMEOUT_MS
      );
    });
    try {
      return await Promise.race([work, timeout]);
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
