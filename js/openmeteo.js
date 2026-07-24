/* =========================================================
   openmeteo.js — optional auto-fill for the "Ketinggian" (altitude)
   and "Suhu"/"Angin" (temperature/wind) fields, using Open-Meteo's
   free, keyless APIs:
     - Elevation API  (https://open-meteo.com/en/docs/elevation-api)
     - Historical Weather / Forecast API
       (https://open-meteo.com/en/docs/historical-weather-api)

   Same defensive contract as maptile.js/geocode.js: every function is
   timeout-guarded, NEVER throws, and resolves to null on any failure
   so the caller can just leave that field blank rather than stall or
   crash a batch generate.
   ========================================================= */

const _elevationCache = new Map();
const _weatherCache = new Map();

/**
 * Fetch ground elevation (meters, rounded) for a coordinate.
 * Returns a number, or null on failure/timeout.
 */
async function fetchElevation(lat, lng, timeoutMs) {
  if (isNaN(lat) || isNaN(lng)) return null;
  const key = `${lat.toFixed(4)}|${lng.toFixed(4)}`;
  if (_elevationCache.has(key)) return _elevationCache.get(key);

  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 6000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) { _elevationCache.set(key, null); return null; }
    const data = await res.json();
    const val = data && Array.isArray(data.elevation) ? data.elevation[0] : null;
    const result = (typeof val === 'number' && !isNaN(val)) ? Math.round(val) : null;
    _elevationCache.set(key, result);
    return result;
  } catch (err) {
    clearTimeout(timer);
    _elevationCache.set(key, null);
    return null;
  }
}

/**
 * Fetch temperature + wind speed for a coordinate, on a specific date
 * if given (YYYY-MM-DD, via the historical archive API), otherwise
 * today's current weather. Returns { temperature: "27°C", wind: "12
 * km/h" }, or null if no data is available (e.g. the date is out of
 * the archive's supported range) or the request fails/times out.
 */
async function fetchWeather(lat, lng, isoDate, timeoutMs) {
  if (isNaN(lat) || isNaN(lng)) return null;
  const key = `${lat.toFixed(4)}|${lng.toFixed(4)}|${isoDate || 'current'}`;
  if (_weatherCache.has(key)) return _weatherCache.get(key);

  const url = isoDate
    ? `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${isoDate}&end_date=${isoDate}&daily=temperature_2m_mean,windspeed_10m_max&timezone=auto`
    : `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 7000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) { _weatherCache.set(key, null); return null; }
    const data = await res.json();

    let temp = null, wind = null;
    if (data.daily && Array.isArray(data.daily.temperature_2m_mean) && data.daily.temperature_2m_mean[0] != null) {
      temp = data.daily.temperature_2m_mean[0];
      wind = (data.daily.windspeed_10m_max && data.daily.windspeed_10m_max[0] != null) ? data.daily.windspeed_10m_max[0] : null;
    } else if (data.current) {
      temp = data.current.temperature_2m;
      wind = data.current.wind_speed_10m;
    }

    if (temp == null || isNaN(temp)) { _weatherCache.set(key, null); return null; }
    const result = {
      temperature: `${Math.round(temp)}°C`,
      wind: (wind != null && !isNaN(wind)) ? `${Math.round(wind)} km/h` : ''
    };
    _weatherCache.set(key, result);
    return result;
  } catch (err) {
    clearTimeout(timer);
    _weatherCache.set(key, null);
    return null;
  }
}

function clearOpenMeteoCache() {
  _elevationCache.clear();
  _weatherCache.clear();
}
