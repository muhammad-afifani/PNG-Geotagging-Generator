/* =========================================================
   photostore.js — the one shared list of photo files, so a folder
   picked in Tab 1 ("Dari Folder Foto"), Tab 2 or Tab 4 is the same set
   everywhere: Tab 1 previews the watermark on the real photo, Tab 2
   burns it on, without picking the folder again.
   ========================================================= */
(function () {
  'use strict';

  let photos = [];
  const listeners = [];

  function baseName(name) {
    return String(name || '').replace(/\.[^.]+$/, '').toLowerCase();
  }

  function set(files) {
    photos = Array.from(files || []);
    photos.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    listeners.forEach(cb => { try { cb(photos); } catch (e) { console.error(e); } });
  }

  /**
   * Photo for a data row. mode 'filename' (default): same file name
   * without extension, else the photo at the same position; 'order':
   * position only; 'exact': name match only (null if none).
   */
  function findForRow(row, index, mode) {
    if (!photos.length || !row) return null;
    if (mode !== 'order') {
      const b = baseName(row.file);
      const hit = photos.find(p => baseName(p.name) === b);
      if (hit || mode === 'exact') return hit || null;
    }
    return photos[index] || null;
  }

  window.GeoStampPhotos = {
    set,
    get: () => photos,
    count: () => photos.length,
    findForRow,
    onChange: (cb) => listeners.push(cb)
  };
})();
