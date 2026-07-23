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
    maxZoom: 19
  },
  satellite: {
    label: 'Satelit (Esri World Imagery)',
    urlTemplate: (x, y, z) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    attribution: 'Esri, Maxar, Earthstar Geographics',
    maxZoom: 19
  }
};

// in-memory cache: "provider|z|x|y" -> HTMLImageElement (or a rejected marker)
const _tileCache = new Map();
// in-memory cache for assembled thumbnails: "provider|lat|lng|zoom|size" -> dataURL
const _thumbCache = new Map();

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
 * Fetch a single tile as an Image, using fetch()+blob so the
 * resulting <img> can be safely drawn to canvas without tainting it.
 * Returns null on any failure (timeout, network error, 404, etc)
 * rather than throwing — callers should treat null as "draw fallback".
 */
async function fetchTileImage(provider, x, y, z, timeoutMs) {
  const key = `${provider}|${z}|${x}|${y}`;
  if (_tileCache.has(key)) return _tileCache.get(key);

  const cfg = MAP_PROVIDERS[provider];
  const url = cfg.urlTemplate(x, y, z);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 8000);

  try {
    const res = await fetch(url, { signal: controller.signal, mode: 'cors' });
    clearTimeout(timer);
    if (!res.ok) {
      _tileCache.set(key, null);
      return null;
    }
    const blob = await res.blob();

    // Prefer createImageBitmap: decoding a same-origin Blob this way
    // yields a bitmap that NEVER taints the canvas, which is critical
    // for PNG export to work. Fall back to objectURL+Image if the
    // browser lacks createImageBitmap.
    let img = null;
    if (typeof createImageBitmap === 'function') {
      try {
        img = await createImageBitmap(blob);
      } catch (e) {
        img = null;
      }
    }
    if (!img) {
      const objectUrl = URL.createObjectURL(blob);
      img = await new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = objectUrl;
      });
      URL.revokeObjectURL(objectUrl);
    }

    _tileCache.set(key, img);
    return img;
  } catch (err) {
    clearTimeout(timer);
    _tileCache.set(key, null);
    return null;
  }
}

/**
 * Build a map thumbnail (as a canvas) centered on lat/lng by fetching
 * the 3x3 grid of surrounding tiles at the given zoom and cropping/
 * compositing them to `width`x`height` pixels (defaults to a square
 * of `size`x`size` for backward compatibility — Template 1 always
 * uses a square; Template 2 can request any reasonable aspect ratio,
 * cropped from the same 3x3 grid rather than stretched, so there's
 * no distortion).
 *
 * Returns { canvas, ok } where ok=false means one or more tiles
 * failed to load (canvas will still contain whatever loaded,
 * composited over a neutral background) — caller can decide whether
 * to fall back to the fully-synthetic placeholder instead.
 */
async function buildMapThumbnail(lat, lng, opts) {
  const provider = opts.provider || 'street';
  const zoom = opts.zoom || 16;
  const size = opts.size || 256;
  const outW = opts.width || size;
  const outH = opts.height || size;
  const timeoutMs = opts.timeoutMs || 8000;

  const cacheKey = `${provider}|${lat.toFixed(5)}|${lng.toFixed(5)}|${zoom}|${outW}x${outH}`;
  if (_thumbCache.has(cacheKey)) {
    return _thumbCache.get(cacheKey);
  }

  const cfg = MAP_PROVIDERS[provider];
  const z = Math.min(zoom, cfg.maxZoom);

  const centerTileX = lonToTileX(lng, z);
  const centerTileY = latToTileY(lat, z);

  // fetch a 3x3 tile grid around the center so we can crop a
  // precisely-centered square regardless of pixel offset within tiles
  const grid = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      grid.push({ dx, dy, x: centerTileX + dx, y: centerTileY + dy });
    }
  }

  const results = await Promise.all(
    grid.map(g => fetchTileImage(provider, g.x, g.y, z, timeoutMs))
  );

  let successCount = 0;
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = MAP_TILE_SIZE * 3;
  gridCanvas.height = MAP_TILE_SIZE * 3;
  const gctx = gridCanvas.getContext('2d');
  gctx.fillStyle = '#3a4238';
  gctx.fillRect(0, 0, gridCanvas.width, gridCanvas.height);

  grid.forEach((g, i) => {
    const img = results[i];
    if (img) {
      successCount++;
      gctx.drawImage(img, (g.dx + 1) * MAP_TILE_SIZE, (g.dy + 1) * MAP_TILE_SIZE, MAP_TILE_SIZE, MAP_TILE_SIZE);
    }
  });

  // compute the pixel position of lat/lng within the center tile,
  // so we can crop a square exactly centered on the real coordinate
  const worldX = (lng + 180) / 360 * Math.pow(2, z) * MAP_TILE_SIZE;
  const latRad = lat * Math.PI / 180;
  const worldY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, z) * MAP_TILE_SIZE;

  const gridOriginWorldX = (centerTileX - 1) * MAP_TILE_SIZE;
  const gridOriginWorldY = (centerTileY - 1) * MAP_TILE_SIZE;

  const pxInGrid = worldX - gridOriginWorldX;
  const pyInGrid = worldY - gridOriginWorldY;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const octx = outCanvas.getContext('2d');
  octx.drawImage(
    gridCanvas,
    pxInGrid - outW / 2, pyInGrid - outH / 2, outW, outH,
    0, 0, outW, outH
  );

  const result = { canvas: outCanvas, ok: successCount === grid.length, successCount, total: grid.length };
  _thumbCache.set(cacheKey, result);
  return result;
}

/**
 * Convenience: draw a red map pin marker centered on a canvas/context
 * (used after compositing the map thumbnail, since the tile grid
 * itself has no marker).
 */
function drawMapPinMarker(ctx, cx, cy, r) {
  ctx.save();
  ctx.fillStyle = '#e5464f';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.7, cy + r * 0.5);
  ctx.lineTo(cx + r * 0.7, cy + r * 0.5);
  ctx.lineTo(cx, cy + r * 2.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function clearMapTileCache() {
  _tileCache.clear();
  _thumbCache.clear();
}
