/* =========================================================
   geocode.js — reverse-geocode a lat/lng into a human-readable
   address (used by Template 2 to auto-detect the location text
   from just the coordinate, like the real GPS Map Camera app
   does on-device) and fetch a small country-flag image.

   Uses Esri's free, keyless "World Geocoding Service" for
   reverse geocoding — the same vendor already used for map tiles
   in maptile.js, chosen for the same reason documented there:
   OpenStreetMap's Nominatim geocoder explicitly disallows bulk/
   automated use without prior permission, which is exactly what
   geocoding every row of a CSV batch amounts to. Esri's anonymous
   geocode endpoint does not carry that restriction for light,
   non-commercial use like this.

   Flags are fetched from flagcdn.com (free, keyless, CORS-enabled)
   using the fetch()+blob technique so the resulting image never
   taints the export canvas, exactly like maptile.js does for tiles.

   Both operations are timeout-guarded and cached, and NEVER throw
   — on any failure they resolve to null so the caller can fall
   back to whatever manual CSV columns (Lokasi/Alamat) are
   available, the same "always keep going" guarantee the map
   thumbnail fetch already provides.
   ========================================================= */

const REVERSE_GEOCODE_URL = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode';

// in-memory cache: "lat.round|lng.round" -> geo result (or null)
const _geocodeCache = new Map();
// in-memory cache: iso2 code -> HTMLImageElement/ImageBitmap (or null)
const _flagCache = new Map();

/**
 * Reverse-geocode one coordinate into { city, province, country,
 * countryCode, address, flagIso2 }. Returns null on any failure,
 * timeout, or missing address data — never throws.
 */
async function reverseGeocode(lat, lng, timeoutMs) {
  if (isNaN(lat) || isNaN(lng)) return null;

  const cacheKey = `${lat.toFixed(4)}|${lng.toFixed(4)}`;
  if (_geocodeCache.has(cacheKey)) return _geocodeCache.get(cacheKey);

  const url = `${REVERSE_GEOCODE_URL}?f=json&location=${lng},${lat}&langCode=id`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 7000);

  try {
    const res = await fetch(url, { signal: controller.signal, mode: 'cors' });
    clearTimeout(timer);
    if (!res.ok) { _geocodeCache.set(cacheKey, null); return null; }

    const data = await res.json();
    const a = data && data.address;
    if (!a) { _geocodeCache.set(cacheKey, null); return null; }

    const countryInfo = getCountryInfo(a.CountryCode);
    const countryName = (countryInfo && countryInfo.name) || a.CountryCode || '';

    const city = a.City || a.Subregion || '';
    const province = a.Region || '';

    // build the wrapped street-address line: "Jalan X, Kecamatan, Kota, Provinsi Kodepos, Negara"
    const addrParts = [];
    if (a.Address) {
      addrParts.push(/^(jalan|jl\.?)\s/i.test(a.Address) ? a.Address : `Jalan ${a.Address}`);
    }
    if (a.District && a.District !== city) addrParts.push(a.District);
    else if (a.Neighborhood && a.Neighborhood !== city) addrParts.push(a.Neighborhood);
    if (city) addrParts.push(city);
    if (province) addrParts.push(a.Postal ? `${province} ${a.Postal}` : province);
    if (countryName) addrParts.push(countryName);

    const result = {
      city,
      province,
      country: countryName,
      countryCode: a.CountryCode || '',
      flagIso2: countryInfo ? countryInfo.iso2 : null,
      address: addrParts.join(', ')
    };

    _geocodeCache.set(cacheKey, result);
    return result;
  } catch (err) {
    clearTimeout(timer);
    _geocodeCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Fetch a small flag PNG for a 2-letter country code from flagcdn.com.
 * Returns an ImageBitmap/HTMLImageElement, or null on any failure.
 * Uses fetch()+blob (never a plain <img src>) so the export canvas
 * is never tainted, matching maptile.js's approach exactly.
 */
async function fetchCountryFlag(iso2, timeoutMs) {
  if (!iso2) return null;
  const key = iso2.toLowerCase();
  if (_flagCache.has(key)) return _flagCache.get(key);

  const url = `https://flagcdn.com/w80/${key}.png`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 6000);

  try {
    const res = await fetch(url, { signal: controller.signal, mode: 'cors' });
    clearTimeout(timer);
    if (!res.ok) { _flagCache.set(key, null); return null; }
    const blob = await res.blob();

    let img = null;
    if (typeof createImageBitmap === 'function') {
      try { img = await createImageBitmap(blob); } catch (e) { img = null; }
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

    _flagCache.set(key, img);
    return img;
  } catch (err) {
    clearTimeout(timer);
    _flagCache.set(key, null);
    return null;
  }
}

function clearGeocodeCache() {
  _geocodeCache.clear();
  _flagCache.clear();
}
