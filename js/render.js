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
 * Works for any w x h — not just a square — so it also serves
 * Template 2's adjustable map aspect ratio.
 */
function drawPlaceholderMap(ctx, x, y, w, h, cornerRadius) {
  const short = Math.min(w, h);
  ctx.save();
  roundRectPath(ctx, x, y, w, h, cornerRadius);
  ctx.clip();

  // base tone
  ctx.fillStyle = '#3a4238';
  ctx.fillRect(x, y, w, h);

  // pseudo-random terrain blocks (deterministic per-tile, no external asset)
  let seed = 1337;
  function rnd() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }
  for (let i = 0; i < 26; i++) {
    const bw = 10 + rnd() * 30;
    const bh = 10 + rnd() * 30;
    const bx = x + rnd() * w;
    const by = y + rnd() * h;
    const tone = 55 + rnd() * 35;
    ctx.fillStyle = `rgb(${tone - 8},${tone},${tone - 12})`;
    ctx.fillRect(bx, by, bw, bh);
  }

  // roads
  ctx.strokeStyle = 'rgba(220,210,190,0.85)';
  ctx.lineWidth = short * 0.014;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.42);
  ctx.lineTo(x + w, y + h * 0.58);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(200,195,180,0.7)';
  ctx.lineWidth = short * 0.01;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.32, y);
  ctx.lineTo(x + w * 0.5, y + h);
  ctx.stroke();

  ctx.restore();

  // location pin marker
  const pinX = x + w * 0.42;
  const pinY = y + h * 0.46;
  const pinR = short * 0.055;
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
  roundRectPath(ctx, x, y, w, h, cornerRadius);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.stroke();
  ctx.restore();
}

/**
 * Parse a "W:H" aspect ratio string (e.g. "4:3") into a width/height
 * ratio float. Falls back to 1 (square) for anything unparseable.
 */
function parseMapAspect(str) {
  const m = String(str || '1:1').match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if (!m) return 1;
  const w = parseFloat(m[1]), h = parseFloat(m[2]);
  return (w > 0 && h > 0) ? w / h : 1;
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
      drawPlaceholderMap(ctx, mapX, mapY, mapSize, mapSize, boxRadius);
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

  // City / main location line (bold, large) — falls back to the
  // reverse-geocoded city (opts.geo) when the CSV/manual entry didn't
  // provide one, so "Deteksi Otomatis dari Koordinat" also benefits
  // Template 1, not just Template 2.
  const geo = opts.geo || {};
  const cityFont = Math.round(38 * fontScale);
  ctx.font = `700 ${cityFont}px Inter, Arial, sans-serif`;
  const cityLine = row.city || row.location || geo.city || '';
  cursorY += cityFont * 0.85;
  const flagImg = opts.countryFlagImg;
  const flagH = cityFont * 0.6;
  const flagW = flagImg ? flagH * (flagImg.width / flagImg.height) : 0;
  const flagGap = flagImg ? 8 * scale : 0;
  const cityDrawn = truncateToWidth(ctx, cityLine, Math.max(textAvailW - flagW - flagGap, 10));
  ctx.fillText(cityDrawn, textStartX, cursorY);
  if (flagImg) {
    const cityW = ctx.measureText(cityDrawn).width;
    ctx.drawImage(flagImg, textStartX + cityW + flagGap, cursorY - flagH * 0.82, flagW, flagH);
  }
  cursorY += 6 * scale;

  // Address (up to 2 lines)
  const bodyFont = Math.round(28 * fontScale);
  ctx.font = `400 ${bodyFont}px Inter, Arial, sans-serif`;
  const addressLine = row.address || geo.address || '';
  if (addressLine) {
    cursorY = drawWrappedTextBaseline(ctx, addressLine, textStartX, cursorY, textAvailW, bodyLineH, 2);
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
/**
 * Format Template 2's lat/long line. English: "Lat 6.123456   Long
 * 106.123456" (signed decimal). Indonesian: "6.123456 LS   106.123456
 * BT" (Lintang Utara/Selatan, Bujur Timur/Barat — absolute value with
 * a direction suffix instead of a sign).
 */
function formatDecimalLatLngLine(lat, lng, lang) {
  if (isNaN(lat) || isNaN(lng)) return '';
  if (lang === 'id') {
    const latDir = lat >= 0 ? 'LU' : 'LS';
    const lngDir = lng >= 0 ? 'BT' : 'BB';
    return `${Math.abs(lat).toFixed(6)} ${latDir}   ${Math.abs(lng).toFixed(6)} ${lngDir}`;
  }
  return `Lat ${lat.toFixed(6)}   Long ${lng.toFixed(6)}`;
}

/**
 * Format Template 2's date line: "Weekday, DD/MM/YYYY[ h:mm AM/PM] GMT+HH:MM"
 * ("Hari, DD/MM/YYYY[ HH:mm] GMT+HH:MM" in Indonesian).
 */
function formatDateGmtLine(dateStr, timeStr, showTime, gmtOffset, lang) {
  const d = parseFlexibleDate(dateStr);
  const offset = gmtOffset || '+08:00';
  if (!d) return `GMT${offset}`;
  const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const daysId = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const days = lang === 'id' ? daysId : daysEn;
  const p = (n) => String(n).padStart(2, '0');
  let line = `${days[d.getDay()]}, ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  if (showTime && timeStr) {
    line += ` ${formatTimeForOverlay(timeStr)}`;
  }
  return `${line} GMT${offset}`;
}

function drawPhoneIconLocal(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(-r * 0.55, -r * 0.55, r * 0.42, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.55, r * 0.55, r * 0.42, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-r * 0.32, -r * 0.32, r * 0.64, r * 0.64);
  ctx.restore();
}

function drawSunIconLocal(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.58, cy + Math.sin(a) * r * 0.58);
    ctx.lineTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWindIconLocal(ctx, x, y, w, h, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, h * 0.13);
  ctx.lineCap = 'round';
  [[0.22, 0.92], [0.52, 0.7], [0.82, 0.5]].forEach(function (pair) {
    const yf = pair[0], wf = pair[1];
    ctx.beginPath();
    ctx.moveTo(x, y + h * yf);
    ctx.lineTo(x + w * wf, y + h * yf);
    ctx.stroke();
  });
  ctx.restore();
}

function drawMountainIconLocal(ctx, x, y, w, h, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w * 0.36, y + h * 0.12);
  ctx.lineTo(x + w * 0.6, y + h * 0.52);
  ctx.lineTo(x + w * 0.78, y + h * 0.3);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCompassIconLocal(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.62);
  ctx.lineTo(cx + r * 0.22, cy);
  ctx.lineTo(cx, cy + r * 0.2);
  ctx.lineTo(cx - r * 0.22, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Fixed, characteristic colors per icon type — these stay colorful
// regardless of the user's chosen font color, so the geo-info row
// reads at a glance instead of blending into plain white/dark text.
const GEO_ICON_COLORS = {
  temp: '#FFB300',      // amber sun
  wind: '#29B6F6',      // sky blue
  altitude: '#EF5350',  // red (matches a GPS-altitude pin)
  direction: '#AB47BC'  // purple compass
};

/**
 * Draw a horizontal row of up to 4 icon+value chips (temperature,
 * wind, altitude, compass direction) spaced evenly across `w`.
 * `items`: [{ icon: 'temp'|'wind'|'altitude'|'direction', text }]
 * `textColor` applies to the value text only — the icons always use
 * their own fixed colors (see GEO_ICON_COLORS) so they stay colorful.
 */
function drawGeoInfoRow(ctx, x, y, w, h, fontPx, textColor, items) {
  if (!items.length) return;
  const cellW = w / items.length;
  ctx.save();
  ctx.font = `600 ${fontPx}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  items.forEach(function (item, i) {
    const cellX = x + i * cellW;
    const iconSize = h * 0.85;
    const iconY = y + (h - iconSize) / 2;
    const iconColor = GEO_ICON_COLORS[item.icon] || textColor;
    if (item.icon === 'temp') drawSunIconLocal(ctx, cellX + iconSize / 2, iconY + iconSize / 2, iconSize / 2, iconColor);
    else if (item.icon === 'wind') drawWindIconLocal(ctx, cellX, iconY, iconSize, iconSize, iconColor);
    else if (item.icon === 'altitude') drawMountainIconLocal(ctx, cellX, iconY, iconSize, iconSize, iconColor);
    else if (item.icon === 'direction') drawCompassIconLocal(ctx, cellX + iconSize / 2, iconY + iconSize / 2, iconSize / 2, iconColor);
    ctx.fillStyle = textColor;
    ctx.fillText(truncateToWidth(ctx, item.text, cellW - iconSize - h * 0.16), cellX + iconSize + h * 0.16, y + h / 2);
  });
  ctx.restore();
}

/**
 * Template 2 ("GPS Map Camera Style") -- a self-drawn recreation of
 * the real GPS Map Camera app's on-photo watermark. Uses the SAME
 * floating rounded-card + top-right-attached-badge mechanic as
 * Template 1 (see renderOverlayClassic): the badge is positioned and
 * merged into the box exactly the same way, per the reference
 * screenshots, just with an adjustable map aspect ratio and more
 * optional content rows: a bold "City, Province, Country" title with
 * a country flag, the full street address, a decimal lat/long line,
 * a date+time+GMT-offset line, and three fully optional rows (Note,
 * Contact number, Geographic info) that only take up space when
 * there's actual data for them. Location text comes from opts.geo
 * (reverse-geocoded from the coordinate) when available, falling
 * back to the row's manual CSV columns otherwise. See renderOverlay()
 * for the full option reference.
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

  // ---- resolve content up front (drives box height below) ----
  const geo = opts.geo || {};
  const titleParts = [geo.city || row.city, geo.province, geo.country].filter(Boolean);
  const titleText = titleParts.length ? titleParts.join(', ') : (row.city || row.location || '');
  const addressText = geo.address || row.address || '';
  const noteText = row.note || '';
  const contactText = row.phone || '';
  // Manual CSV/form data always wins; "Deteksi Otomatis dari Koordinat"
  // (opts.weather/opts.elevation) only fills in whatever's missing.
  // Direction/bearing has no auto source (see index.html hint) — it's
  // always manual-only.
  const weather = opts.weather || {};
  const geoItems = [];
  const temperatureVal = row.temperature || weather.temperature;
  const windVal = row.wind || weather.wind;
  const altitudeVal = row.altitude || opts.elevation;
  if (temperatureVal) geoItems.push({ icon: 'temp', text: String(temperatureVal) });
  if (windVal) geoItems.push({ icon: 'wind', text: String(windVal) });
  if (altitudeVal) geoItems.push({ icon: 'altitude', text: String(altitudeVal) });
  if (row.direction) geoItems.push({ icon: 'direction', text: String(row.direction) });

  // ---- geometry: same floating-card layout as Template 1 (margin,
  // separate rounded map square/rect on the left, badge merged flush
  // onto the text box's top-right corner poking above it) -- only the
  // box height formula and the map's aspect ratio differ. ----
  const margin = 34 * scale;
  const badgeScale = (opts.badgeScale != null ? opts.badgeScale : 100) / 100;
  const badgeH = 45 * scale * badgeScale;
  const radiusBase = (opts.cornerRadius != null ? opts.cornerRadius : 10);
  const boxRadius = Math.max(0, Math.min(radiusBase * scale, 45 * scale / 2));
  const mapGap = 20 * scale;

  const titleFont = Math.round(32 * fontScale);
  const bodyFont = Math.round(24 * fontScale);
  const titleLineH = titleFont * 1.2;
  const bodyLineH = bodyFont * 1.3;
  const padTop = 20 * scale;
  const padBottom = 16 * scale;

  // each optional row (Note / Contact / Geo-info) costs exactly one
  // bodyLineH, matching how much the drawing code below advances the
  // cursor for each -- so the box is always sized exactly for what's
  // actually going to be drawn, never too short/tall.
  let extraRows = 0;
  if (noteText) extraRows++;
  if (contactText) extraRows++;
  if (geoItems.length) extraRows++;

  // Card HEIGHT is driven by `scale` (the "Ukuran Overlay" setting)
  // only -- deliberately NOT by fontScale ("Ukuran Font"), so bumping
  // the font size makes the text bigger without also inflating the
  // whole card, matching how Template 1's fixed-height card behaves.
  const layoutTitleLineH = 32 * 1.2 * scale;
  const layoutBodyLineH = 24 * 1.3 * scale;
  const boxH = Math.min(
    padTop + layoutTitleLineH + 4 * scale + layoutBodyLineH * 2 /* address, up to 2 lines */
      + layoutBodyLineH /* lat/long */ + layoutBodyLineH /* date */ + extraRows * layoutBodyLineH + padBottom,
    H - margin * 2 - badgeH
  );

  const mapAspect = parseMapAspect(opts.mapAspect);
  const mapH = boxH;
  const maxMapW = (W - margin * 2) * 0.55;
  const mapW = Math.min(mapH * mapAspect, maxMapW);

  const boxY = opts.overlayPos === 'top' ? margin + badgeH : H - margin - boxH;
  const mapX = margin;
  const mapY = boxY;
  const textBoxX = opts.showMap ? margin + mapW + mapGap : margin;
  const textBoxW = W - margin - textBoxX;

  // ---- badge geometry (flush to the box's top-right corner) ----
  const badgeLabel = 'GPS Map Camera';
  const badgeStyle = opts.badgeStyle || 'logo';
  let badgeW = measureBadgeWidth(ctx, badgeH, opts.logoImg, badgeLabel, badgeStyle);
  badgeW = Math.min(badgeW, textBoxW * 0.65);
  let badgeX = textBoxX + textBoxW - badgeW;
  badgeX = Math.max(badgeX, textBoxX + 4 * scale);
  const badgeY = boxY - badgeH;
  const drawBadge = badgeY >= 0;

  // ---- optional drop shadow (identical technique to Template 1) ----
  const shadowStrength = (opts.shadowStrength != null ? opts.shadowStrength : 0);
  if (shadowStrength > 0) {
    const s01 = shadowStrength / 100;

    function traceAllSilhouettes() {
      ctx.beginPath();
      if (opts.showMap) addRoundRectSubpath(ctx, mapX, mapY, mapW, mapH, boxRadius);
      addRoundRectSubpath(ctx, textBoxX, boxY, textBoxW, boxH, boxRadius);
      if (drawBadge) addRoundRectTopSubpath(ctx, badgeX, badgeY, badgeW, badgeH + boxRadius, boxRadius);
    }

    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${0.15 + s01 * 0.5})`;
    ctx.shadowBlur = (4 + s01 * 30) * scale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = (2 + s01 * 8) * scale;
    ctx.fillStyle = '#000000';
    traceAllSilhouettes();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    traceAllSilhouettes();
    ctx.fill();
    ctx.restore();
  }

  // ---- text box + attached badge: one merged fill (no seam) ----
  ctx.save();
  ctx.beginPath();
  addRoundRectSubpath(ctx, textBoxX, boxY, textBoxW, boxH, boxRadius);
  if (drawBadge) {
    addRoundRectTopSubpath(ctx, badgeX, badgeY, badgeW, badgeH + boxRadius, boxRadius);
  }
  ctx.fillStyle = hexToRgba('#141816', opts.bgOpacity / 100);
  ctx.fill();
  ctx.restore();

  // ---- badge content ----
  if (drawBadge) {
    drawBadgeContent(ctx, badgeX, badgeY, badgeW, badgeH, opts.logoImg, badgeLabel, badgeStyle);
  }

  // ---- map: separate rounded rect, aspect ratio adjustable ----
  if (opts.showMap) {
    if (opts.mapImg) {
      ctx.save();
      roundRectPath(ctx, mapX, mapY, mapW, mapH, boxRadius);
      ctx.clip();
      ctx.drawImage(opts.mapImg, mapX, mapY, mapW, mapH);
      if (opts.showMapPin !== false) {
        drawMapPinMarkerLocal(ctx, mapX + mapW / 2, mapY + mapH / 2, Math.min(mapW, mapH) * 0.06);
      }
      ctx.restore();
    } else {
      drawPlaceholderMap(ctx, mapX, mapY, mapW, mapH, boxRadius);
    }
  }

  // ---- text content ----
  const padX = 26 * scale;
  const textStartX = textBoxX + padX;
  const textAvailW = textBoxX + textBoxW - padX - textStartX;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = opts.fontColor;

  let cursorY = boxY + padTop;

  // Title + flag
  ctx.font = `700 ${titleFont}px Inter, Arial, sans-serif`;
  const flagImg = opts.countryFlagImg;
  const flagH = titleFont * 0.6;
  const flagW = flagImg ? flagH * (flagImg.width / flagImg.height) : 0;
  const flagGap = flagImg ? 8 * scale : 0;
  const titleMaxW = textAvailW - flagW - flagGap;
  cursorY += titleFont * 0.85;
  const titleDrawn = truncateToWidth(ctx, titleText, Math.max(titleMaxW, 10));
  ctx.fillText(titleDrawn, textStartX, cursorY);
  if (flagImg) {
    const titleW = ctx.measureText(titleDrawn).width;
    ctx.drawImage(flagImg, textStartX + titleW + flagGap, cursorY - flagH * 0.82, flagW, flagH);
  }
  cursorY += 4 * scale;

  // Address (up to 2 lines)
  ctx.font = `400 ${bodyFont}px Inter, Arial, sans-serif`;
  if (addressText) {
    cursorY = drawWrappedTextBaseline(ctx, addressText, textStartX, cursorY, textAvailW, bodyLineH, 2);
  }

  // Decimal lat/long line
  cursorY += bodyLineH;
  ctx.fillText(truncateToWidth(ctx, formatDecimalLatLngLine(row.lat, row.lng, opts.watermarkLang), textAvailW), textStartX, cursorY);

  // Date + time + GMT offset line
  cursorY += bodyLineH;
  ctx.fillText(truncateToWidth(ctx, formatDateGmtLine(row.date, row.time, !!opts.showTime, opts.gmtOffset, opts.watermarkLang), textAvailW), textStartX, cursorY);

  // Note (optional)
  if (noteText) {
    cursorY += bodyLineH;
    ctx.fillText(truncateToWidth(ctx, `Note : ${noteText}`, textAvailW), textStartX, cursorY);
  }

  // Contact number (optional, with phone icon)
  if (contactText) {
    cursorY += bodyLineH;
    const iconR = bodyFont * 0.4;
    drawPhoneIconLocal(ctx, textStartX + iconR, cursorY - bodyFont * 0.32, iconR, opts.fontColor);
    ctx.font = `400 ${bodyFont}px Inter, Arial, sans-serif`;
    ctx.fillStyle = opts.fontColor;
    ctx.fillText(truncateToWidth(ctx, contactText, textAvailW - iconR * 2 - 8 * scale), textStartX + iconR * 2 + 8 * scale, cursorY);
  }

  // Geographic info row (optional: temperature / wind / altitude / direction)
  if (geoItems.length) {
    cursorY += bodyLineH;
    drawGeoInfoRow(ctx, textStartX, cursorY - bodyFont * 0.85, textAvailW, bodyFont * 1.05, Math.round(bodyFont * 0.8), opts.fontColor, geoItems);
  }
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
