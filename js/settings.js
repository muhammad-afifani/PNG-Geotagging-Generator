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
  overlayPos: 'bottom',
  overlayScale: 100,
  bgOpacity: 65,
  fontColor: '#ffffff',
  fontScale: 100,
  showMap: true,
  showLocation: true,
  mapSource: 'street',
  mapZoom: 16,
  showMapPin: true,
  cornerRadius: 10,   // corner fillet radius (px @ 1080 base); smaller = sharper
  shadowStrength: 35, // drop-shadow intensity 0..100 (0 = none)
  badgeStyle: 'logo', // 'logo' | 'text-white' | 'text-dark'
  badgeScale: 100,    // badge size percent
  projectNameOverride: '', // if set, overrides the Project Name line for all rows

  template: 'classic',  // 'classic' (Template 1) | 'gpscam2' (Template 2)
  gmtOffset: '+08:00',  // GMT offset shown on Template 2's date line
  showTime: false,       // Template 2 only: include time-of-day on the date line
  autoGeocode: true,     // Template 2 only: auto-detect city/province/country/address from lat+lng
  mapAspect: '1:1',      // Template 2 only: map thumbnail aspect ratio (width:height)
  noteOverride: '',      // Template 2 only: "Note : ..." line for all rows (overrides CSV "note" column)
  contactOverride: ''    // Template 2 only: contact/phone line for all rows (overrides CSV "phone" column)
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
