/* =========================================================
   render.js — Canvas rendering engine for the GPS-camera-
   style overlay. Everything is drawn with the Canvas API;
   no screenshots or cropped assets of any real app are used.
   ========================================================= */

/**
 * Build the location title text ("Kota, Provinsi, Negara") from a row
 * and its resolved geo data, honoring the showGeoCity/Province/Country
 * toggles so each part can be independently hidden. Shared by both
 * templates so the toggles behave identically everywhere.
 *
 * Falls back to the CSV's own Lokasi/Project Name column when nothing
 * toggled-on produced any text (either the toggles are all off, or
 * there's simply no city/province/country resolved for this row) —
 * Template 1's title line always occupies space, so it needs SOME
 * fallback rather than going empty and leaving an odd gap.
 */
function buildGeoTitleText(row, geo, opts) {
  const showCity = opts.showGeoCity !== false;
  const showProvince = opts.showGeoProvince !== false;
  const showCountry = opts.showGeoCountry !== false;
  const cityVal = row.city || geo.city; // CSV data always wins over auto-detected, same rule as everywhere else
  const parts = [];
  if (showCity && cityVal) parts.push(cityVal);
  if (showProvince && geo.province) parts.push(geo.province);
  if (showCountry && geo.country) parts.push(geo.country);
  if (parts.length) return parts.join(', ');
  return row.location || '';
}

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

// Template 2 text fonts ("Font Watermark" setting). Each profile carries
// its own calibration, fitted against a real stamp by matching the ink
// extents of every word/line: glyph sizes in px at a 1500px-wide photo,
// plus word-space / digit / number-punctuation width adjustments.
//   inter  — default. The iPhone app draws in Apple's SF Pro (licensed
//            for Apple platforms only); Inter is the closest free match and
//            fits the real stamp with no spacing adjustment at all
//            (mean residual ~2px, the JPEG limit).
//   roboto — Android's font (proportional digits, see
//            libs/fonts/roboto/README), with the spacing fixes it needs.
const STAMP_FONTS = {
  inter: { family: '"GeoStamp Inter", Inter, Arial, sans-serif', title: 49.1, body: 31, badge: 28.1, space: 0, digit: 1, punct: 1 },
  roboto: { family: '"GeoStamp Roboto", Roboto, Arial, sans-serif', title: 51.2, body: 32.2, badge: 29.8, space: 0.065, digit: 1.04, punct: 0.95 }
};
// active profile for the stamp-text helpers below; set at the start of
// each (synchronous) Template 2 render
let STAMP = STAMP_FONTS.inter;

// Roboto's vertical metrics (units/em 2048: hhea ascender 1900, descender
// 500). Android lays out TextView lines with exactly these, so baselines
// computed from them land where the real app puts its text.
const ROBOTO_ASCENT = 1900 / 2048;
const ROBOTO_DESCENT = 500 / 2048;
const ROBOTO_LINE = ROBOTO_ASCENT + ROBOTO_DESCENT;

function stampRuns(text) {
  const out = [];
  let cur = '', type = null;
  for (const ch of String(text)) {
    const t = ch === ' ' ? 's' : /[0-9]/.test(ch) ? 'd' : /[:.\u00B0+\-\/]/.test(ch) ? 'p' : 'l';
    if (t !== type && cur) { out.push([type, cur]); cur = ''; }
    type = t;
    cur += ch;
  }
  if (cur) out.push([type, cur]);
  return out;
}

/** Width of `text` as drawn by fillStampText (ctx.font must be set). */
function measureStampText(ctx, text, fontPx) {
  let w = 0;
  for (const [t, run] of stampRuns(text)) {
    if (t === 's') w += run.length * (ctx.measureText(' ').width + STAMP.space * fontPx);
    else w += ctx.measureText(run).width * (t === 'd' ? STAMP.digit : t === 'p' ? STAMP.punct : 1);
  }
  return w;
}

/** fillText with the active profile's spacing (see STAMP_FONTS). Returns the end x. */
function fillStampText(ctx, text, x, y, fontPx) {
  for (const [t, run] of stampRuns(text)) {
    if (t === 's') { x += run.length * (ctx.measureText(' ').width + STAMP.space * fontPx); continue; }
    const k = t === 'd' ? STAMP.digit : t === 'p' ? STAMP.punct : 1;
    if (k === 1) {
      ctx.fillText(run, x, y);
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(k, 1);
      ctx.fillText(run, 0, 0);
      ctx.restore();
    }
    x += ctx.measureText(run).width * k;
  }
  return x;
}

function truncateStampText(ctx, text, maxWidth, fontPx) {
  if (!text) return '';
  if (measureStampText(ctx, text, fontPx) <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && measureStampText(ctx, t + '\u2026', fontPx) > maxWidth) t = t.slice(0, -1);
  return t + '\u2026';
}

/**
 * Placement of the whole overlay block (map + text box + badge) from the
 * position settings: horizontal anchor (opts.overlayAlignH: left/center/
 * right) + vertical anchor (opts.overlayPos: bottom/top), plus the manual
 * "slide" offsets (opts.offsetX/offsetY, percent of canvas W/H). Shared by
 * both templates so positioning behaves identically everywhere.
 *
 * `topExtent` is how far the block reaches above the text box's top edge
 * (the badge, or a map taller than the box), so a top-anchored block keeps
 * that part inside the margin too. Horizontal alignment only becomes
 * visible once blockW is narrower than the space between the margins
 * (opts.overlayWidthPct < 100). The result is clamped so at least ~70% of
 * the block always stays on the canvas, whatever the slide offset.
 */
function resolveBlockPlacement(p) {
  const { W, H, mL, mR, mT, mB, blockW, boxH, topExtent, opts } = p;
  const alignH = opts.overlayAlignH || 'left';
  let blockX = mL;
  if (alignH === 'center') blockX = (mL + (W - mR - blockW)) / 2;
  else if (alignH === 'right') blockX = W - mR - blockW;

  let boxY = opts.overlayPos === 'top' ? mT + topExtent : H - mB - boxH;

  blockX += ((opts.offsetX || 0) / 100) * W;
  boxY += ((opts.offsetY || 0) / 100) * H;

  blockX = Math.max(-blockW * 0.3, Math.min(W - blockW * 0.7, blockX));
  boxY = Math.max(-boxH * 0.3, Math.min(H - boxH * 0.7, boxY));
  return { blockX, boxY };
}

/**
 * Remember where the whole stamp (map + box + badge) landed on the
 * canvas, so the preview can let the user drag/resize it directly.
 */
function recordStampBox(canvas, x, w, top, bottom) {
  canvas.__stampBox = { x, y: top, w, h: bottom - top };
}

/**
 * Size of the map thumbnail: height = text-box height x "Ukuran Peta"
 * (opts.mapScale, %), width from "Rasio Peta" (opts.mapAspect). Capped so
 * it can't swallow the text box or run off the canvas.
 */
function computeMapSize(boxH, blockW, H, opts) {
  const scale = (opts.mapScale != null ? opts.mapScale : 100) / 100;
  const aspect = parseMapAspect(opts.mapAspect);
  let mapH = Math.min(boxH * scale, H * 0.95);
  let mapW = mapH * aspect;
  const maxW = blockW * 0.6;
  if (mapW > maxW) {
    mapW = maxW;
    mapH = mapW / aspect;
  }
  return { mapW, mapH };
}

/**
 * Draw an image into (x,y,w,h) "cover"-style (crop, never stretch).
 */
function drawImageCover(ctx, img, x, y, w, h) {
  const iw = img.width, ih = img.height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale, sh = h / scale;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

/**
 * Google-Maps-style location pin: red teardrop with a dark-red center
 * dot, whose sharp TIP sits exactly on (tipX, tipY). Proportions measured
 * from a real GPS Map Camera stamp: total height 0.2 x map size, head
 * radius 0.059 x map size.
 */
function drawGooglePin(ctx, tipX, tipY, mapSize) {
  const R = mapSize * 0.059;
  const headY = tipY - R * 2.45;
  const a = 32 * Math.PI / 180; // where the sides leave the round head
  ctx.save();
  ctx.fillStyle = '#F44446';
  ctx.beginPath();
  ctx.arc(tipX, headY, R, Math.PI - a, a, false);
  ctx.quadraticCurveTo(tipX + R * 0.32, headY + R * 1.45, tipX, tipY);
  ctx.quadraticCurveTo(tipX - R * 0.32, headY + R * 1.45, tipX - R * Math.cos(a), headY + R * Math.sin(a));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5C0606';
  ctx.beginPath();
  ctx.arc(tipX, headY + R * 0.08, R * 0.56, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Blue "camera facing" cone from the pin tip, like the app draws from
 * the phone's compass: solid near the pin, fading out toward its outer
 * end. bearingDeg is a compass bearing (0 = north, 90 = east, clockwise).
 */
function drawDirectionCone(ctx, cx, cy, radius, bearingDeg) {
  const center = (bearingDeg - 90) * Math.PI / 180;
  const half = 30 * Math.PI / 180;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, 'rgba(40, 80, 200, 0.62)');
  g.addColorStop(0.55, 'rgba(40, 80, 200, 0.55)');
  g.addColorStop(0.85, 'rgba(40, 80, 200, 0.25)');
  g.addColorStop(1, 'rgba(40, 80, 200, 0)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, radius, center - half, center + half, false);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Parse a bearing out of a free-text direction value ("165", "165°",
 * "165 S", "112° SE"). Returns degrees 0..359 or null.
 */
function parseBearing(value) {
  if (value == null || value === '') return null;
  const m = String(value).match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const deg = ((parseFloat(m[0]) % 360) + 360) % 360;
  return isNaN(deg) ? null : deg;
}

/**
 * Small text label in the map's bottom-left corner (white with a dark
 * outline, like the map-provider logo in the app's thumbnail). Size and
 * position measured relative to the map from a real stamp.
 */
function drawMapCornerLabel(ctx, x, y, w, h, text, logoImg) {
  const s = Math.min(w, h);
  if (logoImg && /^google$/i.test(String(text).trim())) {
    // the real logo artwork (white letters + dark halo, transparent
    // background — assets/map-label-google.png). Its white letters span
    // MAP_LOGO_INK within the image; placed so they land where a real
    // stamp has them: 0.0925 x map in from the left, 0.705 x map wide,
    // descender 0.11 x map above the bottom.
    const ink = MAP_LOGO_INK;
    const k = (s * 0.705) / (ink.x1 - ink.x0);
    const dx = x + s * 0.0925 - ink.x0 * k;
    const dy = y + h - s * 0.11 - ink.y1 * k;
    ctx.drawImage(logoImg, dx, dy, logoImg.width * k, logoImg.height * k);
    return;
  }
  const fontPx = s * 0.218;
  ctx.save();
  ctx.font = `400 ${fontPx}px ${STAMP.family}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(fontPx * 0.038).toFixed(2)}px`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  const tx = x + s * 0.082;
  const ty = y + h - s * 0.168;
  ctx.lineWidth = fontPx * 0.2;
  ctx.strokeStyle = 'rgba(15, 15, 15, 0.82)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = fontPx * 0.06;
  ctx.strokeText(text, tx, ty);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, tx, ty);
  ctx.restore();
}
// white-letter bounds inside assets/map-label-google.png (1046x368)
const MAP_LOGO_INK = { x0: 31, x1: 1014, y0: 32, y1: 336 };

/**
 * Draw the whole map thumbnail: imagery (or the offline placeholder),
 * then — clipped to the rounded map — the optional direction cone, the
 * pin (tip on the exact coordinate = map center) and the corner label.
 */
function drawMapThumb(ctx, x, y, w, h, radius, opts, row) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.clip();
  if (opts.mapImg) {
    drawImageCover(ctx, opts.mapImg, x, y, w, h);
  } else {
    drawPlaceholderMap(ctx, x, y, w, h, radius);
  }
  const s = Math.min(w, h);
  const cx = x + w / 2, cy = y + h / 2;
  if (opts.showMapCone) {
    const rowBearing = row ? parseBearing(row.bearing || row.direction) : null;
    const bearing = rowBearing != null ? rowBearing : (opts.mapConeBearing != null ? opts.mapConeBearing : 106);
    drawDirectionCone(ctx, cx, cy, s * 0.25, bearing);
  }
  if (opts.showMapPin !== false) drawGooglePin(ctx, cx, cy, s);
  if (opts.mapLabelShow && opts.mapLabelText) drawMapCornerLabel(ctx, x, y, w, h, opts.mapLabelText, opts.mapLabelLogoImg);
  ctx.restore();
}

/**
 * Which flag (if any) goes after the location title:
 *   - the geocoded country (Indonesia is drawn locally, so it never
 *     depends on the flag CDN being reachable);
 *   - otherwise, if the title/address text is clearly Indonesian (names
 *     Indonesia or an Indonesian admin level/island), Indonesia — so the
 *     flag still shows when the title comes straight from the CSV/manual
 *     input or reverse-geocoding is off/offline.
 * Returns { kind: 'id' } | { kind: 'img', img } | null.
 */
const INDONESIA_TEXT_RE = /\b(indonesia|kabupaten|kecamatan|kelurahan|provinsi|kalimantan|sumatera|sumatra|sulawesi|papua|jawa|nusa tenggara|maluku|daerah istimewa|dki jakarta)\b/i;
function resolveTitleFlag(row, geo, opts, titleText) {
  if (opts.showGeoFlag === false) return null;
  const code = String(geo.countryCode || '').toUpperCase();
  const iso2 = String(geo.flagIso2 || '').toLowerCase();
  if (code === 'IDN' || iso2 === 'id') return { kind: 'id' };
  if (opts.countryFlagImg) return { kind: 'img', img: opts.countryFlagImg };
  if (code || iso2) return null; // a known non-Indonesian country whose flag image didn't load
  const text = `${titleText || ''} ${row.address || ''} ${row.location || ''} ${row.city || ''}`;
  if (INDONESIA_TEXT_RE.test(text)) return { kind: 'id' };
  return null;
}

/**
 * Draw a flag in the (x,y,w,h) box, shaped like the iPhone (Apple) emoji
 * flag the app appends to the title: a 3:2 flag with small rounded
 * corners whose top and bottom edges ripple together (sag left of
 * center, rising toward the right end),
 * a soft cloth sheen, and a faint edge. Indonesia is self-drawn (never
 * depends on the flag CDN); other countries use their fetched image,
 * clipped to the same shape.
 */
function drawFlagBox(ctx, flag, x, y, w, h) {
  if (!flag) return;
  const N = 24;
  // ripple measured from the iPhone emoji: both edges sag slightly just
  // left of the middle and rise toward the fly (right) end
  const wave = (t) => h * (0.042 + 0.168 * t - 0.21 * t * t);
  const top = (t) => y + wave(t);
  const bottom = (t) => y + h * 0.924 + wave(t);
  const r = h * 0.07;
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(x + r, top(r / w));
    for (let i = 1; i <= N; i++) { const t = i / N; ctx.lineTo(x + w * t - (i === N ? r : 0), top(Math.min(t, 1 - r / w))); }
    ctx.quadraticCurveTo(x + w, top(1), x + w, top(1) + r);
    ctx.lineTo(x + w, bottom(1) - r);
    ctx.quadraticCurveTo(x + w, bottom(1), x + w - r, bottom(1 - r / w));
    for (let i = N - 1; i >= 0; i--) { const t = i / N; ctx.lineTo(x + w * t + (i === 0 ? r : 0), bottom(Math.max(t, r / w))); }
    ctx.quadraticCurveTo(x, bottom(0), x, bottom(0) - r);
    ctx.lineTo(x, top(0) + r);
    ctx.quadraticCurveTo(x, top(0), x + r, top(r / w));
    ctx.closePath();
  };
  ctx.save();
  outline();
  ctx.clip();
  if (flag.kind === 'id') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#FF1010';
    ctx.beginPath();
    ctx.moveTo(x, y - 1);
    ctx.lineTo(x + w, y - 1);
    for (let i = N; i >= 0; i--) { const t = i / N; ctx.lineTo(x + w * t, (top(t) + bottom(t)) / 2); }
    ctx.closePath();
    ctx.fill();
  } else if (flag.img) {
    drawImageCover(ctx, flag.img, x, y, w, h);
  }
  // soft cloth sheen along the ripple
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.10)');
  g.addColorStop(0.3, 'rgba(0,0,0,0.04)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.08)');
  g.addColorStop(0.85, 'rgba(0,0,0,0.05)');
  g.addColorStop(1, 'rgba(255,255,255,0.06)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.save();
  outline();
  ctx.lineWidth = Math.max(1, h * 0.03);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.stroke();
  ctx.restore();
}

/**
 * Break text into lines that fit maxWidth, the way Android's TextView
 * does by default (BREAK_STRATEGY_HIGH_QUALITY): among all ways to break
 * at spaces, pick the one with the most even line lengths (least summed
 * squared slack, the last line exempt) — not simply "fill each line as
 * much as possible". This is why the app's address wraps where it does.
 *
 * `tailWidth` reserves room after the last word (e.g. the flag); it may
 * also wrap onto its own line if it doesn't fit. Returns { lines: [[word
 * indices]], tailOnOwnLine } — or, when more than maxLines would be
 * needed, greedy lines with the last one ellipsized (flag dropped).
 */
function wrapBalanced(ctx, text, maxWidth, maxLines, tailWidth, fontPx) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const tokens = words.map(w => measureStampText(ctx, w, fontPx));
  const hasTail = tailWidth > 0;
  if (hasTail) tokens.push(tailWidth);
  const n = tokens.length;
  if (!n) return { lines: [], words };
  const space = ctx.measureText(' ').width + STAMP.space * fontPx;
  const lineW = (i, j) => { // tokens i..j inclusive
    let w = 0;
    for (let k = i; k <= j; k++) w += tokens[k];
    return w + space * (j - i);
  };

  // best[i] = min cost to lay out tokens i..n-1; next[i] = end of first line
  const best = new Array(n + 1).fill(Infinity);
  const next = new Array(n + 1).fill(-1);
  const lines = new Array(n + 1).fill(0);
  best[n] = 0; lines[n] = 0;
  const linePenalty = (maxWidth * 0.5) * (maxWidth * 0.5);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = i; j < n; j++) {
      const w = lineW(i, j);
      if (w > maxWidth && j > i) break;
      const isLast = j === n - 1;
      const slack = Math.max(0, maxWidth - w);
      const cost = (isLast ? 0 : slack * slack) + linePenalty + best[j + 1];
      if (cost < best[i]) { best[i] = cost; next[i] = j; lines[i] = 1 + lines[j + 1]; }
    }
  }

  const out = [];
  let i = 0;
  while (i < n) { const j = next[i]; out.push([i, j]); i = j + 1; }

  if (out.length <= maxLines) return { lines: out, words, tokens, hasTail, overflow: false };

  // too many lines: greedy-fill maxLines lines of words only, ellipsize the last
  const wOnly = words.length;
  const greedy = [];
  let start = 0;
  while (start < wOnly && greedy.length < maxLines) {
    let end = start;
    while (end + 1 < wOnly && lineW(start, end + 1) <= maxWidth) end++;
    greedy.push([start, end]);
    start = end + 1;
  }
  if (start < wOnly) greedy[greedy.length - 1][1] = wOnly - 1; // rest goes on the last line (ellipsized when drawn)
  return { lines: greedy, words, tokens, hasTail: false, overflow: true };
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
 * @param {string} opts.overlayPos - vertical anchor: "bottom" | "top"
 * @param {string} [opts.overlayAlignH] - horizontal anchor: "left" | "center" | "right" (default "left")
 * @param {number} opts.overlayScale - percent, e.g. 100
 * @param {number} [opts.overlayWidthPct] - overlay block's max width as % of canvas width, 50..100 (default 100 = full width, matches the original fixed layout; only below 100 does overlayAlignH become visible)
 * @param {number} [opts.offsetX] - manual horizontal "slide" offset, percent of canvas width, e.g. -25..25 (default 0)
 * @param {number} [opts.offsetY] - manual vertical "slide" offset, percent of canvas height, e.g. -25..25 (default 0)
 * @param {number} opts.bgOpacity - 0..100
 * @param {string} opts.fontColor - hex
 * @param {number} opts.fontScale - percent
 * @param {string} [opts.badgeStyle] - "logo" | "text-white" | "text-dark" | "none" (default "logo"; "none" hides the app badge/logo entirely)
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
  // badge height is user-adjustable via badgeScale (percent), or 0 when
  // badgeStyle is 'none' (logo hidden entirely) so no space is reserved
  // for it at all. Base 45px @ 1080.
  const badgeScale = (opts.badgeScale != null ? opts.badgeScale : 100) / 100;
  const badgeStyle = opts.badgeStyle || 'logo';
  const badgeH = badgeStyle === 'none' ? 0 : 45 * scale * badgeScale;
  // adjustable fillet radius (default 10px @ 1080 base). Clamped so it
  // can't exceed sane bounds for the box/badge height.
  const radiusBase = (opts.cornerRadius != null ? opts.cornerRadius : 10);
  const boxRadius = Math.max(0, Math.min(radiusBase * scale, 45 * scale / 2));
  const boxH = Math.min(293 * scale, H - margin * 2 - badgeH);
  const mapGap = 20 * scale;

  // overlay block's max width, as a fraction of the canvas width — 100%
  // (the default) reproduces the original fixed full-width layout
  // exactly; a narrower value is what makes Posisi Horizontal
  // (left/center/right) visually apparent. See resolveBlockPlacement().
  const widthPct = (opts.overlayWidthPct != null ? opts.overlayWidthPct : 100) / 100;
  const blockW = Math.max((W - margin * 2) * widthPct, boxH + mapGap + 80 * scale);
  // map: height = box height x "Ukuran Peta", width from "Rasio Peta",
  // bottom-aligned with the text box
  const { mapW, mapH } = opts.showMap ? computeMapSize(boxH, blockW, H, opts) : { mapW: 0, mapH: 0 };
  const topExtent = Math.max(badgeH, mapH - boxH);
  const { blockX, boxY } = resolveBlockPlacement({ W, H, mL: margin, mR: margin, mT: margin, mB: margin, blockW, boxH, topExtent, opts });

  const mapX = blockX;
  const mapY = boxY + boxH - mapH;
  const textBoxX = opts.showMap ? blockX + mapW + mapGap : blockX;
  const textBoxW = blockX + blockW - textBoxX;

  // ---- badge geometry (computed BEFORE the fill so badge + box can
  // be filled together as one path). Badge's RIGHT edge is aligned
  // flush with the text box's right edge (no gap), matching the
  // reference where the logo sits right in the top-right corner.
  const badgeLabel = 'GPS Map Camera';
  let badgeW = measureBadgeWidth(ctx, badgeH, opts.logoImg, badgeLabel, badgeStyle);
  badgeW = Math.min(badgeW, textBoxW * 0.65); // extreme logo ratios can't dominate
  let badgeX = textBoxX + textBoxW - badgeW; // flush to box right edge
  badgeX = Math.max(badgeX, textBoxX + 4 * scale);
  const badgeY = boxY - badgeH;
  const drawBadge = badgeStyle !== 'none' && badgeY >= 0;
  recordStampBox(canvas, blockX, blockW, Math.min(boxY, opts.showMap ? mapY : boxY, drawBadge ? badgeY : boxY), boxY + boxH);

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
        addRoundRectSubpath(ctx, mapX, mapY, mapW, mapH, boxRadius);
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

  // ---- map thumbnail: its own separate rounded rect ----
  if (opts.showMap) drawMapThumb(ctx, mapX, mapY, mapW, mapH, boxRadius, opts, row);

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

  // City / main location line (bold, large) — "Kota, Provinsi, Negara"
  // built from the CSV row and/or reverse-geocoded data (opts.geo), with
  // each part independently togglable via opts.showGeoCity/Province/Country.
  const geo = opts.geo || {};
  const cityFont = Math.round(38 * fontScale);
  ctx.font = `700 ${cityFont}px Inter, Arial, sans-serif`;
  const cityLine = buildGeoTitleText(row, geo, opts);
  cursorY += cityFont * 0.85;
  const flag = cityLine ? resolveTitleFlag(row, geo, opts, cityLine) : null;
  const flagH = cityFont * 0.62;
  const flagW = flag ? flagH * 1.5 : 0;
  const flagGap = flag ? 10 * scale : 0;
  const cityDrawn = truncateToWidth(ctx, cityLine, Math.max(textAvailW - flagW - flagGap, 10));
  ctx.fillText(cityDrawn, textStartX, cursorY);
  if (flag) {
    const cityW = ctx.measureText(cityDrawn).width;
    drawFlagBox(ctx, flag, textStartX + cityW + flagGap, cursorY - flagH * 0.9, flagW, flagH);
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
 * Format Template 2's lat/long line.
 *   'deg'   (default, exactly like the GPS Map Camera app): "Lat -0.855322° Long 117.265612°"
 *   'plain' "Lat -0.855322 Long 117.265612"
 *   'dir'   absolute values with a hemisphere suffix — "0.855322 LS 117.265612 BT"
 *           in Indonesian (LU/LS/BT/BB), "0.855322 S 117.265612 E" in English
 */
function formatDecimalLatLngLine(lat, lng, format, lang) {
  if (isNaN(lat) || isNaN(lng)) return '';
  if (format === 'dir') {
    const id = lang === 'id';
    const latDir = lat >= 0 ? (id ? 'LU' : 'N') : (id ? 'LS' : 'S');
    const lngDir = lng >= 0 ? (id ? 'BT' : 'E') : (id ? 'BB' : 'W');
    return `${Math.abs(lat).toFixed(6)} ${latDir} ${Math.abs(lng).toFixed(6)} ${lngDir}`;
  }
  if (format === 'plain') return `Lat ${lat.toFixed(6)} Long ${lng.toFixed(6)}`;
  return `Lat ${lat.toFixed(6)}\u00B0 Long ${lng.toFixed(6)}\u00B0`;
}

/**
 * Parse "15:24", "3:24 PM", "03:24 pm", "15.24" into { h (0-23), m } or null.
 */
function parseTimeParts(timeStr) {
  if (!timeStr) return null;
  const m = String(timeStr).trim().match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (!m) return null;
  let h = +m[1];
  const min = +m[2];
  if (m[3]) {
    const pm = m[3].toUpperCase() === 'PM';
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  }
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

/**
 * Format a time per Template 2's "Format Jam" setting:
 *   '12h0' (default, like the app) "03:24 PM"; '12h' "3:24 PM"; '24h' "15:24".
 */
function formatTimeStyled(timeStr, timeFormat) {
  const t = parseTimeParts(timeStr);
  if (!t) return timeStr ? String(timeStr).trim() : '';
  const p = (n) => String(n).padStart(2, '0');
  if (timeFormat === '24h') return `${p(t.h)}:${p(t.m)}`;
  const ampm = t.h >= 12 ? 'PM' : 'AM';
  let h12 = t.h % 12;
  if (h12 === 0) h12 = 12;
  return timeFormat === '12h' ? `${h12}:${p(t.m)} ${ampm}` : `${p(h12)}:${p(t.m)} ${ampm}`;
}

/**
 * Format Template 2's date line exactly like the app:
 * "Kamis, 24/09/2026 03:24 PM GMT +08:00" (time optional).
 */
function formatDateGmtLine(dateStr, timeStr, showTime, gmtOffset, lang, timeFormat) {
  const d = parseFlexibleDate(dateStr);
  const offset = gmtOffset || '+08:00';
  if (!d) return `GMT ${offset}`;
  const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const daysId = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const days = lang === 'id' ? daysId : daysEn;
  const p = (n) => String(n).padStart(2, '0');
  let line = `${days[d.getDay()]}, ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  if (showTime && timeStr) line += ` ${formatTimeStyled(timeStr, timeFormat)}`;
  return `${line} GMT ${offset}`;
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
 * Template 2 ("GPS Map Camera") — a self-drawn, measurement-calibrated
 * recreation of the real GPS Map Camera app's stamp. Every size below is
 * in "U" units = 1px of a 1500px-wide photo, measured from a genuine
 * app photo, so on any photo it lands at the same relative place/size
 * the app would use:
 *   - margins: left 77, right 75, bottom 33; map 32 left of the box
 *   - text box: black at ~63% opacity, radius 13, padding top 48.5 /
 *     left 31 / bottom 44; height grows with the content
 *   - map: square (by default) with the same height as the text box,
 *     bottom-aligned with it
 *   - badge: 77 tall, flush on the box's top-right, app icon 46 + "GPS Map
 *     Camera" in Roboto 30
 *   - title Roboto 51.2 (regular), up to 3 lines + flag; body Roboto 32;
 *     line spacing = Roboto's own ascent+descent, exactly like Android
 * fontScale / overlayScale / badgeScale / mapScale scale from there.
 * See renderOverlay() for the option reference.
 */
function renderOverlayTemplate2(canvas, row, opts) {
  const W = opts.width;
  const H = opts.height;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const U = (W / 1500) * ((opts.overlayScale != null ? opts.overlayScale : 100) / 100);
  const F = (opts.fontScale != null ? opts.fontScale : 100) / 100;

  // ---- content ----
  const geo = opts.geo || {};
  const titleText = buildGeoTitleText(row, geo, opts);
  const addressText = row.address || geo.address || '';
  const noteText = row.note || '';
  const contactText = row.phone || '';
  const weather = opts.weather || {};
  const geoItems = [];
  const temperatureVal = row.temperature || weather.temperature;
  const windVal = row.wind || weather.wind;
  const altitudeVal = row.altitude || opts.elevation;
  if (temperatureVal) geoItems.push({ icon: 'temp', text: String(temperatureVal) });
  if (windVal) geoItems.push({ icon: 'wind', text: String(windVal) });
  if (altitudeVal) geoItems.push({ icon: 'altitude', text: String(altitudeVal) });
  if (row.direction) geoItems.push({ icon: 'direction', text: String(row.direction) });
  const latLngLine = formatDecimalLatLngLine(row.lat, row.lng, opts.latLngFormat || 'deg', opts.watermarkLang);
  const dateLine = formatDateGmtLine(row.date, row.time, !!opts.showTime, opts.gmtOffset, opts.watermarkLang, opts.timeFormat);
  const flag = titleText ? resolveTitleFlag(row, geo, opts, titleText) : null;

  // ---- fixed geometry ----
  const mL = 77 * U, mR = 75 * U, mB = 33 * U, mT = 33 * U;
  const mapGap = 32 * U;
  const padTop = 48.5 * U, padBottom = 44 * U, padLeft = 31 * U, padRight = 2 * U;
  const radius = Math.max(0, (opts.cornerRadius != null ? opts.cornerRadius : 10) * 1.3 * U);
  // glyphs are drawn at the font profile's sizes; line spacing and the
  // flag follow the stamp's measured metrics (title 51.2 / body 32 units)
  STAMP = STAMP_FONTS[opts.stampFont] || STAMP_FONTS.inter;
  const titleFont = STAMP.title * U * F;
  const bodyFont = STAMP.body * U * F;
  const titleMetric = 51.2 * U * F;
  const bodyMetric = 32 * U * F;
  const titleFontCss = `400 ${titleFont}px ${STAMP.family}`;
  const bodyFontCss = `400 ${bodyFont}px ${STAMP.family}`;
  const flagW = titleMetric * (60 / 51.2);
  const flagH = titleMetric * (40 / 51.2);
  const flagGap = titleMetric * (17 / 51.2);

  const widthPct = (opts.overlayWidthPct != null ? opts.overlayWidthPct : 100) / 100;
  const blockW = Math.max((W - mL - mR) * widthPct, 360 * U);

  // ---- badge (app icon + name), measured: 77 tall, icon 46 ----
  const badgeStyle = opts.badgeStyle || 'logo';
  const bS = (opts.badgeScale != null ? opts.badgeScale : 100) / 100;
  const badgeH = badgeStyle === 'none' ? 0 : 77 * U * bS;
  const badgeLabel = 'GPS Map Camera';
  const badgeFont = STAMP.badge * U * bS;
  const useIconBadge = badgeStyle === 'logo' && !opts.logoIsCustom && opts.badgeIconImg;

  // ---- layout: text wrapping depends on the box width, which depends on
  // the map width, which follows the box height — iterate to a fixed point
  // (converges in 1-2 passes since line counts rarely change) ----
  let layout = null;
  let mapGuess = computeMapSize(400 * U, blockW, H, opts);
  for (let pass = 0; pass < 4; pass++) {
    const boxW = blockW - (opts.showMap ? mapGuess.mapW + mapGap : 0);
    const textW = Math.max(20, boxW - padLeft - padRight);
    ctx.font = titleFontCss;
    const titleSpace = ctx.measureText(' ').width + STAMP.space * titleFont;
    const titleWrap = titleText ? wrapBalanced(ctx, titleText, textW, 3, flag ? flagGap + flagW - titleSpace : 0, titleFont) : null;
    ctx.font = bodyFontCss;
    const addrWrap = addressText ? wrapBalanced(ctx, addressText, textW, 4, 0, bodyFont) : null;

    const groups = [];
    if (titleWrap && titleWrap.lines.length) groups.push({ font: titleMetric, count: titleWrap.lines.length });
    let bodyCount = (addrWrap ? addrWrap.lines.length : 0);
    if (latLngLine) bodyCount++;
    if (dateLine) bodyCount++;
    if (noteText) bodyCount++;
    if (contactText) bodyCount++;
    if (geoItems.length) bodyCount++;
    if (bodyCount) groups.push({ font: bodyMetric, count: bodyCount });

    let contentH = 0;
    groups.forEach((g, gi) => {
      contentH += (gi === 0 ? ROBOTO_ASCENT * g.font : ROBOTO_DESCENT * groups[gi - 1].font + ROBOTO_ASCENT * g.font);
      contentH += (g.count - 1) * ROBOTO_LINE * g.font;
    });
    if (groups.length) contentH += ROBOTO_DESCENT * groups[groups.length - 1].font;

    const boxH = Math.min(padTop + contentH + padBottom, H - mB - mT - badgeH);
    const mapSize = computeMapSize(boxH, blockW, H, opts);
    layout = { boxW, textW, titleWrap, addrWrap, groups, boxH, mapSize };
    if (!opts.showMap || Math.abs(mapSize.mapW - mapGuess.mapW) < 0.5) break;
    mapGuess = mapSize;
  }

  const { textW, titleWrap, addrWrap, boxH } = layout;
  const mapW = opts.showMap ? layout.mapSize.mapW : 0;
  const mapH = opts.showMap ? layout.mapSize.mapH : 0;
  const topExtent = Math.max(badgeH, mapH - boxH);
  const { blockX, boxY } = resolveBlockPlacement({ W, H, mL, mR, mT, mB, blockW, boxH, topExtent, opts });
  const mapX = blockX;
  const mapY = boxY + boxH - mapH;
  const boxX = opts.showMap ? blockX + mapW + mapGap : blockX;
  const boxW = blockX + blockW - boxX;

  // ---- badge geometry: right edge flush with the box's right edge ----
  let badgeW = 0;
  if (badgeH) {
    if (useIconBadge) {
      ctx.font = `400 ${badgeFont}px ${STAMP.family}`;
      badgeW = (15 + 46 + 16.5 + 18.5) * U * bS + measureStampText(ctx, badgeLabel, badgeFont);
    } else {
      badgeW = measureBadgeWidth(ctx, badgeH, opts.logoImg, badgeLabel, badgeStyle);
    }
    badgeW = Math.min(badgeW, boxW);
  }
  const badgeX = boxX + boxW - badgeW;
  const badgeY = boxY - badgeH;
  const drawBadge = badgeH > 0 && badgeY >= -badgeH * 0.5;
  recordStampBox(canvas, blockX, blockW, Math.min(boxY, opts.showMap ? mapY : boxY, drawBadge ? badgeY : boxY), boxY + boxH);

  // ---- optional drop shadow (same technique as Template 1) ----
  const shadowStrength = opts.shadowStrength || 0;
  if (shadowStrength > 0) {
    const s01 = shadowStrength / 100;
    const trace = () => {
      ctx.beginPath();
      if (opts.showMap) addRoundRectSubpath(ctx, mapX, mapY, mapW, mapH, radius);
      addRoundRectSubpath(ctx, boxX, boxY, boxW, boxH, radius);
      if (drawBadge) addRoundRectTopSubpath(ctx, badgeX, badgeY, badgeW, badgeH + radius, radius);
    };
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${0.15 + s01 * 0.5})`;
    ctx.shadowBlur = (4 + s01 * 30) * U;
    ctx.shadowOffsetY = (2 + s01 * 8) * U;
    ctx.fillStyle = '#000';
    trace();
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    trace();
    ctx.fill();
    ctx.restore();
  }

  // ---- text box + badge: one merged fill, pure black like the app ----
  ctx.save();
  ctx.beginPath();
  addRoundRectSubpath(ctx, boxX, boxY, boxW, boxH, radius);
  if (drawBadge) addRoundRectTopSubpath(ctx, badgeX, badgeY, badgeW, badgeH + radius, radius);
  ctx.fillStyle = `rgba(0,0,0,${(opts.bgOpacity != null ? opts.bgOpacity : 63) / 100})`;
  ctx.fill();
  ctx.restore();

  // ---- badge content ----
  if (drawBadge) {
    if (useIconBadge) {
      const iconS = 46 * U * bS;
      ctx.drawImage(opts.badgeIconImg, badgeX + 15 * U * bS, badgeY + (badgeH - iconS) / 2, iconS, iconS);
      ctx.save();
      ctx.font = `400 ${badgeFont}px ${STAMP.family}`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      fillStampText(ctx, badgeLabel, badgeX + (15 + 46 + 16.5) * U * bS, badgeY + badgeH / 2 + badgeFont * 0.711 / 2, badgeFont);
      ctx.restore();
    } else {
      drawBadgeContent(ctx, badgeX, badgeY, badgeW, badgeH, opts.logoImg, badgeLabel, badgeStyle);
    }
  }

  // ---- map ----
  if (opts.showMap) drawMapThumb(ctx, mapX, mapY, mapW, mapH, radius, opts, row);

  // ---- text ----
  const penX = boxX + padLeft;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = opts.fontColor || '#ffffff';
  let baseline = null;
  let prevFont = null;
  const nextBaseline = (font) => {
    if (baseline == null) baseline = boxY + padTop + ROBOTO_ASCENT * font;
    else if (prevFont !== font) baseline += ROBOTO_DESCENT * prevFont + ROBOTO_ASCENT * font;
    else baseline += ROBOTO_LINE * font;
    prevFont = font;
    return baseline;
  };

  // title (+ flag after the last word)
  if (titleWrap && titleWrap.lines.length) {
    ctx.font = titleFontCss;
    const nWords = titleWrap.words.length;
    titleWrap.lines.forEach(([i, j], li) => {
      const y = nextBaseline(titleMetric);
      const lastWordIdx = Math.min(j, nWords - 1);
      let lineText = i < nWords ? titleWrap.words.slice(i, lastWordIdx + 1).join(' ') : '';
      if (titleWrap.overflow && li === titleWrap.lines.length - 1) lineText = truncateStampText(ctx, lineText, textW, titleFont);
      const lineEnd = lineText ? fillStampText(ctx, lineText, penX, y, titleFont) : penX;
      const hasFlagHere = titleWrap.hasTail && j === titleWrap.tokens.length - 1;
      if (flag && hasFlagHere) {
        const fx = lineText ? lineEnd + flagGap : penX;
        drawFlagBox(ctx, flag, fx, y + titleMetric * (2 / 51.2) - flagH, flagW, flagH);
      }
    });
  }

  // body lines
  ctx.font = bodyFontCss;
  if (addrWrap) {
    addrWrap.lines.forEach(([i, j], li) => {
      const y = nextBaseline(bodyMetric);
      let t = addrWrap.words.slice(i, j + 1).join(' ');
      if (addrWrap.overflow && li === addrWrap.lines.length - 1) t = truncateStampText(ctx, t, textW, bodyFont);
      fillStampText(ctx, t, penX, y, bodyFont);
    });
  }
  if (latLngLine) fillStampText(ctx, truncateStampText(ctx, latLngLine, textW, bodyFont), penX, nextBaseline(bodyMetric), bodyFont);
  if (dateLine) fillStampText(ctx, truncateStampText(ctx, dateLine, textW, bodyFont), penX, nextBaseline(bodyMetric), bodyFont);
  if (noteText) fillStampText(ctx, truncateStampText(ctx, `Note : ${noteText}`, textW, bodyFont), penX, nextBaseline(bodyMetric), bodyFont);
  if (contactText) {
    const y = nextBaseline(bodyMetric);
    const iconR = bodyFont * 0.4;
    drawPhoneIconLocal(ctx, penX + iconR, y - bodyFont * 0.32, iconR, opts.fontColor || '#ffffff');
    ctx.font = bodyFontCss;
    ctx.fillStyle = opts.fontColor || '#ffffff';
    fillStampText(ctx, truncateStampText(ctx, contactText, textW - iconR * 2 - 8 * U, bodyFont), penX + iconR * 2 + 8 * U, y, bodyFont);
  }
  if (geoItems.length) {
    const y = nextBaseline(bodyMetric);
    drawGeoInfoRow(ctx, penX, y - bodyFont * 0.85, textW, bodyFont * 1.05, Math.round(bodyFont * 0.8), opts.fontColor || '#ffffff', geoItems);
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
