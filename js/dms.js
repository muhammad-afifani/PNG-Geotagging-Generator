/* =========================================================
   dms.js — Decimal Degrees <-> Degrees Minutes Seconds
   ========================================================= */

/**
 * Convert a decimal-degree coordinate into a DMS string.
 * @param {number} decimal - decimal degree value (can be negative)
 * @param {"lat"|"lng"} axis - which axis this value represents
 * @returns {string} e.g. 6° 12' 31.55" S
 */
function decimalToDMS(decimal, axis) {
  if (decimal === null || decimal === undefined || isNaN(decimal)) return '';

  const abs = Math.abs(decimal);
  const degrees = Math.floor(abs);
  const minutesFloat = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;

  let hemisphere;
  if (axis === 'lat') {
    hemisphere = decimal >= 0 ? 'N' : 'S';
  } else {
    hemisphere = decimal >= 0 ? 'E' : 'W';
  }

  return `${degrees}\u00B0 ${minutes}' ${seconds.toFixed(2)}" ${hemisphere}`;
}

/**
 * Build the combined "lat, lng" DMS line as shown in GPS Map Camera overlays.
 * @param {number} lat
 * @param {number} lng
 * @returns {string}
 */
function latLngToDMSLine(lat, lng) {
  return `${decimalToDMS(lat, 'lat')}  ${decimalToDMS(lng, 'lng')}`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { decimalToDMS, latLngToDMSLine };
}
