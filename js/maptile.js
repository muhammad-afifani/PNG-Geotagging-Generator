/* =========================================================
   maptile.js — fetches real map tiles (OpenStreetMap / Esri
   World Imagery) using the standard Slippy Map XYZ scheme,
   composites them into a small square thumbnail image, and
   caches results so repeat/nearby coordinates don't re-fetch.

   IMPORTANT: tiles are always fetched via fetch()+blob (never
   via a cross-origin <img> tag) specifically so the resulting
   canvas never becomes "tainted" — this is what lets us safely
   call canvas.toBlob()/toDataURL() afterwards during batch
   generation without SecurityErrors.
   ========================================================= */

const MAP_TILE_SIZE = 256;

// Both providers use Esri's free public ArcGIS Online tile infrastructure
// (server.arcgisonline.com) rather than OpenStreetMap's own tile servers.
// This is intentional: OpenStreetMap's official tile usage policy
// (operations.osmfoundation.org/policies/tiles) explicitly prohibits
// "bulk downloading" and "offline use" patterns — exactly what generating
// map thumbnails for hundreds/thousands of photos in one batch amounts
// to — and requests without a browser-native Referer (e.g. from a
// file:// page, or scripted fetches) get a "403 Access blocked" response.
// Esri's basemap tile services (World_Street_Map, World_Imagery) are
// served from the same free, keyless, public endpoint and do not carry
// that restriction, so both map styles use them for consistent, reliable
// access.
const MAP_PROVIDERS = {
  street: {
    label: 'Jalan (Esri World Street Map)',
    urlTemplate: (x, y, z) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`,
    attribution: 'Esri, HERE, Garmin, USGS, OpenStreetMap contributors',
    maxZoom: 20
  },
  satellite: {
    label: 'Satelit (Esri World Imagery)',
    urlTemplate: (x, y, z) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    attribution: 'Esri, Maxar, Earthstar Geographics',
    maxZoom: 20
  }
};

// in-memory cache: "provider|z|x|y" -> decoded tile image, or MISSING_TILE
// for a tile the server definitively doesn't have (404, or Esri's gray
// "Map data not yet available" placeholder). Transient failures
// (timeouts, network errors) are deliberately NOT cached, so a flaky
// moment never leaves a permanently blank map for the rest of the session.
const _tileCache = new Map();
const MISSING_TILE = { missing: true };
// in-memory cache for assembled thumbnails (only fully-successful ones)
const _thumbCache = new Map();

// Max parallel tile requests. Without this, dragging the zoom slider
// fires dozens of requests at once; the browser queues them and the
// ones that matter (the final zoom) time out behind the rest.
const MAX_CONCURRENT_TILE_FETCHES = 6;
let _activeTileFetches = 0;
const _tileFetchQueue = [];
function acquireTileSlot() {
  if (_activeTileFetches < MAX_CONCURRENT_TILE_FETCHES) {
    _activeTileFetches++;
    return Promise.resolve();
  }
  return new Promise((resolve) => _tileFetchQueue.push(resolve));
}
function releaseTileSlot() {
  const next = _tileFetchQueue.shift();
  if (next) next();
  else _activeTileFetches--;
}

function lonToTileX(lon, zoom) {
  return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
}
function latToTileY(lat, zoom) {
  const latRad = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom));
}
function tileXToLon(x, zoom) {
  return x / Math.pow(2, zoom) * 360 - 180;
}
function tileYToLat(y, zoom) {
  const n = Math.PI - 2 * Math.PI * y / Math.pow(2, zoom);
  return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/**
 * Esri answers requests beyond its imagery coverage (common at zoom
 * 17+ in rural Indonesia) with HTTP 200 and a flat light-gray "Map data
 * not yet available" tile. Detect that by sampling: almost every pixel
 * neutral gray in a narrow light band. Real imagery (even cloud or
 * open water) is never that uniformly neutral.
 */
function isNoDataTile(img) {
  try {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0, 16, 16);
    const d = cx.getImageData(0, 0, 16, 16).data;
    let gray = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (Math.abs(r - g) <= 6 && Math.abs(g - b) <= 6 && r >= 175 && r <= 235) gray++;
    }
    return gray / 256 >= 0.9;
  } catch (e) {
    return false;
  }
}

async function decodeTileBlob(blob) {
  // createImageBitmap on a same-origin Blob never taints the canvas,
  // which is critical for PNG export; objectURL+Image as a fallback.
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob); } catch (e) { /* fall through */ }
  }
  const objectUrl = URL.createObjectURL(blob);
  const img = await new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = objectUrl;
  });
  URL.revokeObjectURL(objectUrl);
  return img;
}

/**
 * Fetch a single tile via fetch()+blob (so drawing it never taints the
 * canvas). Resolves to an image, MISSING_TILE (server has no tile
 * there), or null (transient failure). Never throws.
 */
async function fetchTileImage(provider, x, y, z, timeoutMs) {
  const key = `${provider}|${z}|${x}|${y}`;
  if (_tileCache.has(key)) return _tileCache.get(key);

  const cfg = MAP_PROVIDERS[provider];
  const url = cfg.urlTemplate(x, y, z);

  await acquireTileSlot();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 8000);
  try {
    const res = await fetch(url, { signal: controller.signal, mode: 'cors' });
    if (res.status === 404) {
      _tileCache.set(key, MISSING_TILE);
      return MISSING_TILE;
    }
    if (!res.ok) return null;
    const blob = await res.blob();
    const img = await decodeTileBlob(blob);
    if (!img) return null;
    if (isNoDataTile(img)) {
      _tileCache.set(key, MISSING_TILE);
      return MISSING_TILE;
    }
    _tileCache.set(key, img);
    return img;
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
    releaseTileSlot();
  }
}

/**
 * Get the imagery for tile (x,y,z) as { img, sx, sy, sw, sh } (a source
 * rectangle to draw into the 256px slot), falling back to an ancestor
 * tile at a lower zoom — cropped to the matching quadrant and scaled up
 * — when the server has no tile at z. This is what keeps a map visible
 * at high zoom in areas where Esri's imagery stops at a lower level,
 * instead of going blank. Returns null if nothing could be loaded.
 */
async function fetchTileWithFallback(provider, x, y, z, timeoutMs, maxLevelsUp) {
  for (let up = 0; up <= maxLevelsUp && z - up >= 0; up++) {
    const pz = z - up;
    const px = x >> up;
    const py = y >> up;
    const img = await fetchTileImage(provider, px, py, pz, timeoutMs);
    if (img && img !== MISSING_TILE) {
      const span = MAP_TILE_SIZE >> up;
      const mask = (1 << up) - 1;
      return { img, sx: (x & mask) * span, sy: (y & mask) * span, sw: span, sh: span, levelsUp: up };
    }
    // a transient failure at this level: still try a parent rather than
    // leaving a hole, but don't treat it as "missing" for the cache
  }
  return null;
}

/**
 * Build a map thumbnail (as a canvas) centered exactly on lat/lng,
 * `width`x`height` pixels, cropped from the surrounding tile grid (never
 * stretched). Tiles missing at the requested zoom fall back to scaled
 * ancestor tiles (see fetchTileWithFallback).
 *
 * Returns { canvas, ok } — canvas is null only when NOTHING could be
 * loaded at all (caller then uses the offline placeholder rather than a
 * blank box). Only fully-successful thumbnails are cached, so a
 * transient failure is retried next time instead of sticking.
 */
async function buildMapThumbnail(lat, lng, opts) {
  const provider = opts.provider || 'street';
  const zoom = opts.zoom || 16;
  const size = opts.size || 256;
  const outW = Math.max(1, Math.round(opts.width || size));
  const outH = Math.max(1, Math.round(opts.height || size));
  const timeoutMs = opts.timeoutMs || 8000;

  const cfg = MAP_PROVIDERS[provider];
  const z = Math.max(1, Math.min(zoom, cfg.maxZoom));

  const cacheKey = `${provider}|${lat.toFixed(5)}|${lng.toFixed(5)}|${z}|${outW}x${outH}`;
  if (_thumbCache.has(cacheKey)) return _thumbCache.get(cacheKey);

  const centerTileX = lonToTileX(lng, z);
  const centerTileY = latToTileY(lat, z);
  // enough tiles around the center to cover the requested crop wherever
  // the coordinate falls inside its tile
  const rx = Math.max(1, Math.ceil(outW / 2 / MAP_TILE_SIZE));
  const ry = Math.max(1, Math.ceil(outH / 2 / MAP_TILE_SIZE));

  const grid = [];
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      grid.push({ dx, dy, x: centerTileX + dx, y: centerTileY + dy });
    }
  }

  const results = await Promise.all(
    grid.map(g => fetchTileWithFallback(provider, g.x, g.y, z, timeoutMs, 4))
  );

  let successCount = 0;
  let exactCount = 0;
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = MAP_TILE_SIZE * (rx * 2 + 1);
  gridCanvas.height = MAP_TILE_SIZE * (ry * 2 + 1);
  const gctx = gridCanvas.getContext('2d');
  gctx.fillStyle = '#3a4238';
  gctx.fillRect(0, 0, gridCanvas.width, gridCanvas.height);
  gctx.imageSmoothingQuality = 'high';

  grid.forEach((g, i) => {
    const t = results[i];
    if (!t) return;
    successCount++;
    if (t.levelsUp === 0) exactCount++;
    gctx.drawImage(t.img, t.sx, t.sy, t.sw, t.sh,
      (g.dx + rx) * MAP_TILE_SIZE, (g.dy + ry) * MAP_TILE_SIZE, MAP_TILE_SIZE, MAP_TILE_SIZE);
  });

  if (successCount === 0) {
    return { canvas: null, ok: false, successCount: 0, total: grid.length };
  }

  // pixel position of lat/lng inside the grid, to crop exactly centered
  const worldX = (lng + 180) / 360 * Math.pow(2, z) * MAP_TILE_SIZE;
  const latRad = lat * Math.PI / 180;
  const worldY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, z) * MAP_TILE_SIZE;
  const pxInGrid = worldX - (centerTileX - rx) * MAP_TILE_SIZE;
  const pyInGrid = worldY - (centerTileY - ry) * MAP_TILE_SIZE;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  outCanvas.getContext('2d').drawImage(
    gridCanvas,
    pxInGrid - outW / 2, pyInGrid - outH / 2, outW, outH,
    0, 0, outW, outH
  );

  const ok = successCount === grid.length;
  const result = { canvas: outCanvas, ok, successCount, exactCount, total: grid.length };
  if (ok) _thumbCache.set(cacheKey, result);
  return result;
}

function clearMapTileCache() {
  _tileCache.clear();
  _thumbCache.clear();
}
