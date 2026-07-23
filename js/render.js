/* =========================================================
   render.js — Canvas rendering engine for the GPS-camera-
   style overlay. Everything is drawn with the Canvas API;
   no screenshots or cropped assets of any real app are used.
   ========================================================= */

/**
 * Format a date string according to the chosen display format.
 * @param {string} dateStr - raw date value from CSV (various formats accepted)
 * @param {string} formatKey - "short" | "long" | "iso" | "id"
 */
function formatDateForOverlay(dateStr, formatKey) {
  const d = parseFlexibleDate(dateStr);
  if (!d) return dateStr || '';

  const daysEn = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const daysId = ['Minggu','Senin','Selasa','Rabu','Kamis',"Jumat",'Sabtu'];
  const monthsEn = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthsId = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

  const dow = d.getDay();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();

  switch (formatKey) {
    case 'long':
      return `${daysEn[dow]}, ${monthsEn[d.getMonth()]} ${d.getDate()}, ${yyyy}`;
    case 'iso':
      return `${yyyy}-${mm}-${dd}`;
    case 'id':
      return `${daysId[dow]}, ${d.getDate()} ${monthsId[d.getMonth()]} ${yyyy}`;
    case 'short':
    default:
      return `${daysEn[dow]}, ${mm}/${dd}/${yyyy}`;
  }
}

/**
 * Parse common date formats found in geotag CSV exports:
 * DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY.
 */
function parseFlexibleDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();

  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

  // DD/MM/YYYY (assume day-first, common in Indonesian exports)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const a = +m[1], b = +m[2], y = +m[3];
    // if first segment > 12 it must be the day
    if (a > 12) return new Date(y, b - 1, a);
    return new Date(y, b - 1, a); // day/month/year default
  }

  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Normalize a time string (e.g. "9:13", "10:32 AM", "14:29") into
 * a 12-hour "h:mm AM/PM" display string.
 */
function formatTimeForOverlay(timeStr) {
  if (!timeStr) return '';
  const s = String(timeStr).trim();

  // already has AM/PM
  let m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/);
  if (m) {
    let h = +m[1];
    return `${h}:${m[2]} ${m[3].toUpperCase()}`;
  }

  // 24-hour "HH:MM"
  m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    let h = +m[1];
    const min = m[2];
    const ampm = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${min} ${ampm}`;
  }

  return s;
}

/**
 * Draw a red map pin marker, used on top of a real map tile thumbnail
 * to indicate the exact photo location.
 */
/**
 * Draw a classic map-pin marker (teardrop shape with a circular head)
 * where the SHARP TIP — not the circle — marks the exact location.
 * (cx, cy) is the ground-truth point (e.g. the center of the map
 * thumbnail); the pin's body is drawn entirely ABOVE that point, so
 * the tip touches down exactly on the coordinate it represents.
 */
function drawMapPinMarkerLocal(ctx, cx, cy, r) {
  ctx.save();
  const tipY = cy;              // the exact location — pin tip lands here
  const bodyCy = cy - r * 1.5;  // circular head sits above the tip

  ctx.fillStyle = '#e5464f';
  ctx.beginPath();
  ctx.arc(cx, bodyCy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.7, bodyCy + r * 0.75);
  ctx.lineTo(cx + r * 0.7, bodyCy + r * 0.75);
  ctx.lineTo(cx, tipY + 0.75); // tiny overshoot compensates AA rounding at the tip
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, bodyCy, r * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.arc(cx, bodyCy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a rounded rectangle path.
 */
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  addRoundRectSubpath(ctx, x, y, w, h, r);
}

/**
 * Append a rounded-rect subpath WITHOUT calling beginPath — used to
 * combine multiple shapes (e.g. text box + attached badge) into one
 * path so a single semi-transparent fill covers both with no seam
 * and no double-darkened overlap.
 */
function addRoundRectSubpath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Append a subpath rounded ONLY at the top corners (square bottom),
 * without beginPath — used for the app badge that sits attached on
 * top of the text box, visually merging into it.
 */
function addRoundRectTopSubpath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

/**
 * Draw the abstract placeholder "map" thumbnail directly with canvas
 * primitives (used when no custom thumbnail image is supplied).
 */
function drawPlaceholderMap(ctx, x, y, size, cornerRadius) {
  ctx.save();
  roundRectPath(ctx, x, y, size, size, cornerRadius);
  ctx.clip();

  // base tone
  ctx.fillStyle = '#3a4238';
  ctx.fillRect(x, y, size, size);

  // pseudo-random terrain blocks (deterministic per-tile, no external asset)
  let seed = 1337;
  function rnd() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }
  for (let i = 0; i < 26; i++) {
    const bw = 10 + rnd() * 30;
    const bh = 10 + rnd() * 30;
    const bx = x + rnd() * size;
    const by = y + rnd() * size;
    const tone = 55 + rnd() * 35;
    ctx.fillStyle = `rgb(${tone - 8},${tone},${tone - 12})`;
    ctx.fillRect(bx, by, bw, bh);
  }

  // roads
  ctx.strokeStyle = 'rgba(220,210,190,0.85)';
  ctx.lineWidth = size * 0.014;
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.42);
  ctx.lineTo(x + size, y + size * 0.58);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(200,195,180,0.7)';
  ctx.lineWidth = size * 0.01;
  ctx.beginPath();
  ctx.moveTo(x + size * 0.32, y);
  ctx.lineTo(x + size * 0.5, y + size);
  ctx.stroke();

  ctx.restore();

  // location pin marker
  const pinX = x + size * 0.42;
  const pinY = y + size * 0.46;
  const pinR = size * 0.055;
  ctx.fillStyle = '#e5464f';
  ctx.beginPath();
  ctx.arc(pinX, pinY, pinR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(pinX - pinR * 0.7, pinY + pinR * 0.5);
  ctx.lineTo(pinX + pinR * 0.7, pinY + pinR * 0.5);
  ctx.lineTo(pinX, pinY + pinR * 2.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(pinX, pinY, pinR * 0.38, 0, Math.PI * 2);
  ctx.fill();

  // subtle border
  ctx.save();
  roundRectPath(ctx, x, y, size, size, cornerRadius);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw the badge's CONTENT only (logo, or icon + text label). The
 * badge's dark background is NOT drawn here — it is filled together
 * with the text box as a single merged path in renderOverlay(), so
 * the badge fuses seamlessly onto the box with no seam and no
 * double-darkened overlap.
 *
 * Content sizing math matches measureBadgeWidth() exactly, so the
 * label can never wrap or clip.
 */
function drawBadgeContent(ctx, x, y, w, h, logoImg, appLabel, badgeStyle) {
  ctx.save();

  const padInner = h * 0.18;
  const useLogoImage = logoImg && logoImg.width && logoImg.height && badgeStyle === 'logo';

  if (useLogoImage) {
    // Letterbox the whole logo image (which may contain icon+wordmark
    // baked in, like the default GPS Map Camera asset) into the badge
    // area, preserving aspect ratio.
    const maxW = w - padInner * 2;
    const maxH = h - padInner * 2;
    const aspect = logoImg.width / logoImg.height;
    let drawW = maxW;
    let drawH = drawW / aspect;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH * aspect;
    }
    const drawX = x + (w - drawW) / 2;
    const drawY = y + (h - drawH) / 2;
    ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);
  } else {
    // Text styles: self-drawn circle glyph + single-line Canvas text
    // label, in white or dark, so it stays readable on the dark box
    // regardless of the uploaded logo's own colors.
    const textColor = (badgeStyle === 'text-dark') ? '#1a1a1a' : '#ffffff';
    const iconSize = h - padInner * 2;
    const iconX = x + padInner;
    const iconY = y + padInner;
    const labelFontPx = Math.round(h * 0.42);

    // small location-pin glyph
    ctx.fillStyle = '#3ddc97';
    ctx.beginPath();
    ctx.arc(iconX + iconSize / 2, iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#06251a';
    ctx.beginPath();
    ctx.arc(iconX + iconSize / 2, iconY + iconSize / 2, iconSize * 0.24, 0, Math.PI * 2);
    ctx.fill();

    if (appLabel) {
      ctx.fillStyle = textColor;
      ctx.font = `600 ${labelFontPx}px Inter, Arial, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(appLabel, iconX + iconSize + h * 0.22, y + h / 2 + h * 0.02);
    }
  }

  ctx.restore();
}

/**
 * Compute the badge pill's width, matching EXACTLY what drawBadgeContent
 * will draw for the same inputs. Called by renderOverlay() before
 * drawBadgeContent() so the badge is always sized correctly on the first
 * (and only) draw — never a source of clipped/wrapped text.
 */
function measureBadgeWidth(ctx, h, logoImg, appLabel, badgeStyle) {
  const padInner = h * 0.18;
  const useLogoImage = logoImg && logoImg.width && logoImg.height && badgeStyle === 'logo';

  if (useLogoImage) {
    // logo-image path: width is driven by the logo's own aspect ratio
    // letterboxed into the pill's height, same math as drawBadgeContent
    const maxH = h - padInner * 2;
    const aspect = logoImg.width / logoImg.height;
    const drawH = maxH;
    const drawW = drawH * aspect;
    return drawW + padInner * 2;
  } else {
    // icon + text path: width is icon slot + gap + measured text width
    const iconSize = h - padInner * 2;
    const labelFontPx = Math.round(h * 0.42);
    const gap = h * 0.22;
    ctx.font = `600 ${labelFontPx}px Inter, Arial, sans-serif`;
    const labelWidth = appLabel ? ctx.measureText(appLabel).width : 0;
    // small safety margin (+6%) guards against minor font-metric
    // rounding differences across browsers/platforms
    return (padInner + iconSize + gap + labelWidth + padInner * 1.4) * 1.06;
  }
}

/**
 * Main entry point: render one overlay onto a canvas element/context.
 * Dispatches to the selected preset template — each template is a
 * self-contained layout function so adding a future Template 3+
 * only means adding another render function + a case here.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object} row - normalized CSV row { file, lat, lng, date, time, city, address, location }
 * @param {Object} opts - rendering options
 * @param {string} [opts.template] - "classic" | "gpscam2" (default "classic")
 * @param {HTMLImageElement|null} opts.logoImg
 * @param {HTMLImageElement|null} opts.mapImg
 * @param {number} opts.width
 * @param {number} opts.height
 * @param {string} opts.dateFormat
 * @param {string} opts.overlayPos - "bottom" | "top"
 * @param {number} opts.overlayScale - percent, e.g. 100
 * @param {number} opts.bgOpacity - 0..100
 * @param {string} opts.fontColor - hex
 * @param {number} opts.fontScale - percent
 * @param {boolean} opts.showMap
 * @param {boolean} opts.showLocation
 * @param {Object|null} [opts.geo] - resolved reverse-geocode result (Template 2 only)
 * @param {HTMLImageElement|null} [opts.countryFlagImg] - resolved flag image (Template 2 only)
 * @param {string} [opts.gmtOffset] - e.g. "+08:00" (Template 2 only)
 * @param {boolean} [opts.showTime] - include time-of-day in the date line (Template 2 only)
 */
function renderOverlay(canvas, row, opts) {
  if (opts.template === 'gpscam2') {
    renderOverlayTemplate2(canvas, row, opts);
  } else {
    renderOverlayClassic(canvas, row, opts);
  }
}

/**
 * Template 1 ("Klasik") — the original rounded floating card layout.
 * See renderOverlay() above for the full option reference.
 */
function renderOverlayClassic(canvas, row, opts) {
  const W = opts.width;
  const H = opts.height;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // ---- base scale relative to a 1080-wide reference ----
  const refScale = W / 1080;
  const scale = refScale * (opts.overlayScale / 100);
  const fontScale = refScale * (opts.fontScale / 100);

  // ---- overlay geometry (proportions measured from the official
  // GPS Map Camera reference screenshot, normalized to a 1080-wide
  // design base):
  //   * the MAP is a SEPARATE rounded square on the left (own element,
  //     same height as the text box, with a gap between them)
  //   * the TEXT BOX is its own rounded rect to the right of the map
  //   * the "GPS Map Camera" badge sits ATTACHED flush on the text
  //     box's top-right corner (its right edge aligned exactly to the
  //     box's right edge — no gap — drawn as one merged path with the
  //     box so they visually fuse with zero seam or double-darkening)
  //   * corner radius is user-adjustable (opts.cornerRadius, px @ 1080)
  const margin = 34 * scale;
  // badge height is user-adjustable via badgeScale (percent). Base 45px @ 1080.
  const badgeScale = (opts.badgeScale != null ? opts.badgeScale : 100) / 100;
  const badgeH = 45 * scale * badgeScale;
  // adjustable fillet radius (default 10px @ 1080 base). Clamped so it
  // can't exceed sane bounds for the box/badge height.
  const radiusBase = (opts.cornerRadius != null ? opts.cornerRadius : 10);
  const boxRadius = Math.max(0, Math.min(radiusBase * scale, 45 * scale / 2));
  const boxH = Math.min(293 * scale, H - margin * 2 - badgeH);
  const mapGap = 20 * scale;
  const mapSize = boxH; // separate square map, same height as the text box

  const boxY = opts.overlayPos === 'top'
    ? margin + badgeH
    : H - margin - boxH;

  const mapX = margin;
  const mapY = boxY;
  const textBoxX = opts.showMap ? margin + mapSize + mapGap : margin;
  const textBoxW = W - margin - textBoxX;

  // ---- badge geometry (computed BEFORE the fill so badge + box can
  // be filled together as one path). Badge's RIGHT edge is aligned
  // flush with the text box's right edge (no gap), matching the
  // reference where the logo sits right in the top-right corner.
  const badgeLabel = 'GPS Map Camera';
  const badgeStyle = opts.badgeStyle || 'logo';
  let badgeW = measureBadgeWidth(ctx, badgeH, opts.logoImg, badgeLabel, badgeStyle);
  badgeW = Math.min(badgeW, textBoxW * 0.65); // extreme logo ratios can't dominate
  let badgeX = textBoxX + textBoxW - badgeW; // flush to box right edge
  badgeX = Math.max(badgeX, textBoxX + 4 * scale);
  const badgeY = boxY - badgeH;
  const drawBadge = badgeY >= 0;

  // ---- optional drop-shadow behind the whole overlay ----
  // Technique: (1) fill solid silhouettes WITH an active shadow, so a
  // strong shadow is cast around every element; (2) then punch out the
  // silhouette interiors with 'destination-out', leaving ONLY the soft
  // outer shadow. This way the semi-transparent box drawn afterwards
  // isn't darkened by a solid shape behind it. Strength 0 disables it.
  const shadowStrength = (opts.shadowStrength != null ? opts.shadowStrength : 0);
  if (shadowStrength > 0) {
    const s01 = shadowStrength / 100;

    function traceAllSilhouettes() {
      ctx.beginPath();
      if (opts.showMap) {
        addRoundRectSubpath(ctx, mapX, mapY, mapSize, mapSize, boxRadius);
      }
      addRoundRectSubpath(ctx, textBoxX, boxY, textBoxW, boxH, boxRadius);
      if (drawBadge) {
        addRoundRectTopSubpath(ctx, badgeX, badgeY, badgeW, badgeH + boxRadius, boxRadius);
      }
    }

    // 1) cast the shadow from solid shapes
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${0.15 + s01 * 0.5})`;
    ctx.shadowBlur = (4 + s01 * 30) * scale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = (2 + s01 * 8) * scale;
    ctx.fillStyle = '#000000';
    traceAllSilhouettes();
    ctx.fill();
    ctx.restore();

    // 2) remove the solid interiors, keeping only the outer shadow
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    traceAllSilhouettes();
    ctx.fill();
    ctx.restore();
  }

  // ---- text box + attached badge: ONE combined fill ----
  // The badge subpath extends slightly INTO the box; with a single
  // fill (nonzero winding) the overlap region is still painted only
  // once, so the semi-transparent color never stacks or seams.
  ctx.save();
  ctx.beginPath();
  addRoundRectSubpath(ctx, textBoxX, boxY, textBoxW, boxH, boxRadius);
  if (drawBadge) {
    addRoundRectTopSubpath(ctx, badgeX, badgeY, badgeW, badgeH + boxRadius, boxRadius);
  }
  ctx.fillStyle = hexToRgba('#141816', opts.bgOpacity / 100);
  ctx.fill();
  ctx.restore();

  // ---- badge content (logo, letterboxed; or icon + label) ----
  if (drawBadge) {
    drawBadgeContent(ctx, badgeX, badgeY, badgeW, badgeH, opts.logoImg, badgeLabel, badgeStyle);
  }

  // ---- map thumbnail: its own separate rounded square ----
  // opts.mapImg may be: null (use synthetic placeholder), an
  // HTMLImageElement, OR a pre-rendered <canvas> (real map tiles,
  // built asynchronously by maptile.js before renderOverlay is called).
  if (opts.showMap) {
    if (opts.mapImg) {
      ctx.save();
      roundRectPath(ctx, mapX, mapY, mapSize, mapSize, boxRadius);
      ctx.clip();
      ctx.drawImage(opts.mapImg, mapX, mapY, mapSize, mapSize);
      if (opts.showMapPin !== false) {
        drawMapPinMarkerLocal(ctx, mapX + mapSize / 2, mapY + mapSize / 2, mapSize * 0.05);
      }
      ctx.restore();
    } else {
      drawPlaceholderMap(ctx, mapX, mapY, mapSize, boxRadius);
      if (opts.showMapPin === false) {
        // placeholder draws its own pin; nothing extra needed when on
      }
    }
  }

  // ---- text block (inside the text box) ----
  const padX = 27 * scale;
  const padTop = 22 * scale;
  const textStartX = textBoxX + padX;
  const textAvailW = textBoxX + textBoxW - padX - textStartX;
  const bodyLineH = 40 * fontScale;

  ctx.textAlign = 'left';
  ctx.fillStyle = opts.fontColor;
  ctx.textBaseline = 'alphabetic';

  let cursorY = boxY + padTop;

  // City / main location line (bold, large)
  const cityFont = Math.round(38 * fontScale);
  ctx.font = `700 ${cityFont}px Inter, Arial, sans-serif`;
  const cityLine = row.city || row.location || '';
  cursorY += cityFont * 0.85;
  ctx.fillText(truncateToWidth(ctx, cityLine, textAvailW), textStartX, cursorY);
  cursorY += 6 * scale;

  // Address (up to 2 lines)
  const bodyFont = Math.round(28 * fontScale);
  ctx.font = `400 ${bodyFont}px Inter, Arial, sans-serif`;
  if (row.address) {
    cursorY = drawWrappedTextBaseline(ctx, row.address, textStartX, cursorY, textAvailW, bodyLineH, 2);
  }

  // Lat/Lng DMS line
  ctx.font = `400 ${bodyFont}px Inter, Arial, sans-serif`;
  const dmsLine = latLngToDMSLine(row.lat, row.lng);
  cursorY += bodyLineH;
  ctx.fillText(truncateToWidth(ctx, dmsLine, textAvailW), textStartX, cursorY);

  // Date + time line
  const dateDisplay = formatDateForOverlay(row.date, opts.dateFormat);
  const timeDisplay = formatTimeForOverlay(row.time);
  const dtLine = timeDisplay ? `${dateDisplay}  ${timeDisplay}` : dateDisplay;
  cursorY += bodyLineH;
  ctx.fillText(truncateToWidth(ctx, dtLine, textAvailW), textStartX, cursorY);

  // Location / Project Name line
  if (opts.showLocation && row.location) {
    cursorY += bodyLineH;
    ctx.fillText(truncateToWidth(ctx, `Project Name : ${row.location}`, textAvailW), textStartX, cursorY);
  }
}

/**
 * Format the decimal-degree "Lat X, Long Y" line used by Template 2
 * (as opposed to Template 1's DMS-formatted line).
 */
function formatDecimalLatLngLine(lat, lng) {
  if (isNaN(lat) || isNaN(lng)) return '';
  return `Lat ${lat.toFixed(6)}, Long ${lng.toFixed(6)}`;
}

/**
 * Format Template 2's date line: "DD/MM/YY[ h:mm AM/PM] GMT+HH:MM".
 */
function formatDateGmtLine(dateStr, timeStr, showTime, gmtOffset) {
  const d = parseFlexibleDate(dateStr);
  const offset = gmtOffset || '+08:00';
  if (!d) return `GMT${offset}`;
  const p = (n) => String(n).padStart(2, '0');
  let line = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
  if (showTime && timeStr) {
    line += ` ${formatTimeForOverlay(timeStr)}`;
  }
  return `${line} GMT${offset}`;
}

/**
 * Template 2 ("GPS Map Camera Style") — a self-drawn recreation of
 * the real GPS Map Camera app's on-photo watermark: a full-bleed bar
 * (no rounding, no margin) spanning the photo's full width, with the
 * app badge in the top-right corner, a bold "City,Province,Country"
 * title with a country flag, the full street address, a decimal
 * lat/long line, and a date + GMT-offset line. Location text comes
 * from opts.geo (reverse-geocoded from the coordinate) when
 * available, falling back to the row's manual CSV columns otherwise
 * — so the layout never ends up with blank fields even before/without
 * a geocoding result. See renderOverlay() for the full option
 * reference.
 */
function renderOverlayTemplate2(canvas, row, opts) {
  const W = opts.width;
  const H = opts.height;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const refScale = W / 1080;
  const scale = refScale * (opts.overlayScale / 100);
  const fontScale = refScale * (opts.fontScale / 100);

  const geo = opts.geo || {};
  const titleParts = [geo.city || row.city, geo.province, geo.country].filter(Boolean);
  const titleText = titleParts.length ? titleParts.join(',') : (row.city || row.location || '');
  const addressText = geo.address || row.address || '';

  // ---- geometry (fixed formula, same "worst-case" approach as the
  // classic template's fixed boxH: reserves enough room for a 2-line
  // address so nothing ever overflows the bar, regardless of how
  // short the actual text turns out to be) ----
  const padX = 30 * scale;
  const padTop = 16 * scale;
  const padBottom = 18 * scale;
  const badgeScale = (opts.badgeScale != null ? opts.badgeScale : 100) / 100;
  const badgeH = 36 * scale * badgeScale;
  const boxRadius = Math.max(0, Math.min((opts.cornerRadius != null ? opts.cornerRadius : 10) * scale, 20 * scale));

  const titleFont = Math.round(34 * fontScale);
  const bodyFont = Math.round(25 * fontScale);
  const titleLineH = titleFont * 1.15;
  const bodyLineH = bodyFont * 1.32;
  const rowsBelowTitle = 4; // up to 2 address lines + lat/long line + date line
  const barH = Math.min(
    padTop + badgeH + 6 * scale + titleLineH + 4 * scale + rowsBelowTitle * bodyLineH + padBottom,
    H - 2 * (10 * scale)
  );

  const barY = opts.overlayPos === 'top' ? 0 : H - barH;

  // ---- bar background: full-bleed, no rounding, no side margin ----
  ctx.fillStyle = hexToRgba('#0c1210', opts.bgOpacity / 100);
  ctx.fillRect(0, barY, W, barH);

  // ---- optional map thumbnail, inset on the left edge of the bar ----
  const mapMargin = 12 * scale;
  const mapSize = opts.showMap ? barH - mapMargin * 2 : 0;
  const mapX = mapMargin;
  const mapY = barY + mapMargin;
  if (opts.showMap) {
    if (opts.mapImg) {
      ctx.save();
      roundRectPath(ctx, mapX, mapY, mapSize, mapSize, boxRadius);
      ctx.clip();
      ctx.drawImage(opts.mapImg, mapX, mapY, mapSize, mapSize);
      if (opts.showMapPin !== false) {
        drawMapPinMarkerLocal(ctx, mapX + mapSize / 2, mapY + mapSize / 2, mapSize * 0.06);
      }
      ctx.restore();
    } else {
      drawPlaceholderMap(ctx, mapX, mapY, mapSize, boxRadius);
    }
  }

  const textStartX = (opts.showMap ? mapX + mapSize + mapMargin : padX);
  const textRightX = W - padX;

  // ---- badge: top-right corner of the bar ----
  const badgeLabel = 'GPS Map Camera';
  const badgeStyle = opts.badgeStyle || 'logo';
  let badgeW = measureBadgeWidth(ctx, badgeH, opts.logoImg, badgeLabel, badgeStyle);
  badgeW = Math.min(badgeW, (textRightX - textStartX) * 0.6);
  const badgeX = textRightX - badgeW;
  const badgeY = barY + padTop * 0.5;
  drawBadgeContent(ctx, badgeX, badgeY, badgeW, badgeH, opts.logoImg, badgeLabel, badgeStyle);

  // ---- text block ----
  const textAvailW = textRightX - textStartX;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = opts.fontColor;

  let cursorY = barY + padTop + badgeH + 6 * scale;

  // Title line: "City,Province,Country" + flag icon
  ctx.font = `700 ${titleFont}px Inter, Arial, sans-serif`;
  const flagImg = opts.countryFlagImg;
  const flagH = titleFont * 0.62;
  const flagW = flagImg ? flagH * (flagImg.width / flagImg.height) : 0;
  const flagGap = flagImg ? 10 * scale : 0;
  const titleMaxW = textAvailW - flagW - flagGap;
  const titleDrawn = truncateToWidth(ctx, titleText, Math.max(titleMaxW, 10));
  ctx.fillText(titleDrawn, textStartX, cursorY);
  if (flagImg) {
    const titleW = ctx.measureText(titleDrawn).width;
    ctx.drawImage(flagImg, textStartX + titleW + flagGap, cursorY - flagH * 0.86, flagW, flagH);
  }

  // Address (up to 2 lines)
  ctx.font = `400 ${bodyFont}px Inter, Arial, sans-serif`;
  if (addressText) {
    cursorY = drawWrappedTextBaseline(ctx, addressText, textStartX, cursorY, textAvailW, bodyLineH, 2);
  }

  // Decimal lat/long line
  cursorY += bodyLineH;
  ctx.fillText(truncateToWidth(ctx, formatDecimalLatLngLine(row.lat, row.lng), textAvailW), textStartX, cursorY);

  // Date + GMT offset line
  cursorY += bodyLineH;
  const dtLine = formatDateGmtLine(row.date, row.time, !!opts.showTime, opts.gmtOffset);
  ctx.fillText(truncateToWidth(ctx, dtLine, textAvailW), textStartX, cursorY);
}

/**
 * Truncate a single line of text with an ellipsis so it fits maxWidth.
 */
function truncateToWidth(ctx, text, maxWidth) {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + '…').width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

/**
 * Draw wrapped text using an alphabetic baseline cursor (matches the
 * rest of the text block's baseline-based layout). Returns the Y
 * position of the last drawn line's baseline.
 */
function drawWrappedTextBaseline(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  if (!text) return y;
  const words = String(text).split(' ');
  let line = '';
  let lines = [];

  for (let i = 0; i < words.length; i++) {
    const testLine = line ? line + ' ' + words[i] : words[i];
    const testWidth = ctx.measureText(testLine).width;
    if (testWidth > maxWidth && line) {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines) break;
    } else {
      line = testLine;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);

  if (lines.length === maxLines) {
    lines[maxLines - 1] = truncateToWidth(ctx, lines[maxLines - 1], maxWidth);
  }

  let curY = y;
  for (const l of lines) {
    curY += lineHeight;
    ctx.fillText(l, x, curY);
  }
  return curY;
}

/**
 * Convert a hex color + alpha (0..1) into an rgba() string.
 */
function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
