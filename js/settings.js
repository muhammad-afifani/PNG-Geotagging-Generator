/* =========================================================
   settings.js — reads/writes overlay settings to LocalStorage
   and supports export/import as a JSON preset file.
   ========================================================= */

const SETTINGS_STORAGE_KEY = 'gpsOverlayGenerator.settings.v1';
const THEME_STORAGE_KEY = 'gpsOverlayGenerator.theme.v1';

const DEFAULT_SETTINGS = {
  canvasSize: '1080x500',
  customW: 1080,
  customH: 500,
  dateFormat: 'short',
  overlayPos: 'bottom',    // vertical anchor: 'bottom' | 'top'
  overlayAlignH: 'left',   // horizontal anchor: 'left' | 'center' | 'right'
  overlayWidthPct: 100,    // overlay block's max width, as % of canvas width (50-100) — horizontal alignment only becomes visible below 100%
  offsetX: 0,              // manual horizontal slide, % of canvas width (-25..25), applied on top of the anchor above
  offsetY: 0,              // manual vertical slide, % of canvas height (-25..25)
  overlayScale: 100,
  bgOpacity: 65,
  fontColor: '#ffffff',
  fontScale: 100,
  showMap: true,
  showLocation: true,
  mapSource: 'street',
  mapZoom: 16,
  showMapPin: true,
  mapScale: 100,          // map height as % of the text box height (50-200)
  mapAspect: '1:1',       // map width:height (both templates)
  mapLabelShow: false,    // text label in the map's bottom-left corner
  mapLabelText: 'Google', // that label's text
  showMapCone: false,     // blue camera-direction cone from the pin
  mapConeBearing: 106,    // cone direction (compass degrees) when the row has no "Arah" value
  cornerRadius: 10,   // corner fillet radius (px @ 1080 base); smaller = sharper
  shadowStrength: 35, // drop-shadow intensity 0..100 (0 = none)
  badgeStyle: 'logo', // 'logo' | 'text-white' | 'text-dark' | 'none'
  badgeScale: 100,    // badge size percent
  projectNameOverride: '', // if set, overrides the Project Name line for all rows

  template: 'classic',  // 'classic' (Template 1) | 'gpscam2' (Template 2)
  gmtOffset: '+08:00',  // GMT offset shown on Template 2's date line
  showTime: true,        // Template 2 only: include time-of-day on the date line
  stampFont: 'inter',    // Template 2 only: 'inter' (closest free match to the iPhone app's SF Pro) | 'system' (device font: real SF Pro on Apple devices) | 'roboto' (Android)
  timeFormat: '12h0',    // Template 2 only: '12h0' "03:24 PM" (like the app) | '12h' "3:24 PM" | '24h' "15:24"
  latLngFormat: 'deg',   // Template 2 only: 'deg' "Lat -0.855322° Long 117.265612°" (like the app) | 'plain' | 'dir' (LS/BT)
  watermarkLang: 'en',   // Template 2 only: day-name language — 'en' (Thursday) | 'id' (Kamis)
  noteOverride: '',      // Template 2 only: "Note : ..." line for all rows (overrides CSV "note" column)
  contactOverride: '',   // Template 2 only: contact/phone line for all rows (overrides CSV "phone" column)

  // "Deteksi Otomatis dari Koordinat" — applies to Template 1 & 2 alike,
  // only fills in fields the CSV/manual entry left empty:
  autoGeocode: true,     // fill missing city/address via reverse geocoding
  autoElevation: false,  // fill missing "Ketinggian" via Open-Meteo elevation
  autoWeather: false,    // fill missing "Suhu"/"Angin" via Open-Meteo weather

  // which parts of the location title are drawn (Template 1 & 2 alike)
  showGeoCity: true,
  showGeoProvince: true,
  showGeoCountry: true,
  showGeoFlag: true
};

// "Samakan Persis dengan Contoh GPS Map Camera" — every look-related
// setting at the value measured from a genuine GPS Map Camera photo.
// Applied on top of the current settings, so data-related choices
// (resolution, GMT zone, date format for Template 1, overrides) stay.
const EXACT_GPSCAM_PRESET = {
  template: 'gpscam2',
  overlayScale: 100,
  fontScale: 100,
  fontColor: '#ffffff',
  bgOpacity: 63,
  cornerRadius: 10,
  shadowStrength: 0,
  badgeStyle: 'logo',
  badgeScale: 100,
  overlayPos: 'bottom',
  overlayAlignH: 'left',
  overlayWidthPct: 100,
  offsetX: 0,
  offsetY: 0,
  showMap: true,
  mapSource: 'satellite',
  mapZoom: 17,
  showMapPin: true,
  mapScale: 100,
  mapAspect: '1:1',
  mapLabelShow: true,
  mapLabelText: 'Google',
  showMapCone: true,
  mapConeBearing: 106,
  watermarkLang: 'id',
  showTime: true,
  stampFont: 'inter',
  timeFormat: '12h0',
  latLngFormat: 'deg',
  autoGeocode: true,
  showGeoCity: true,
  showGeoProvince: true,
  showGeoCountry: true,
  showGeoFlag: true
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('Failed to load settings, using defaults.', e);
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings.', e);
  }
}

function loadTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
  } catch (e) {
    return 'dark';
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (e) { /* ignore */ }
}

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  saveAs(blob, filename);
}
