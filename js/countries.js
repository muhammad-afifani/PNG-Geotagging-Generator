/* =========================================================
   countries.js — lookup table from the 3-letter country code
   returned by the reverse-geocoding service (ISO 3166-1 alpha-3)
   to a 2-letter code (ISO 3166-1 alpha-2, used to fetch the flag
   image from flagcdn.com) and an Indonesian-language country name
   (used in the Template 2 overlay title).

   Not exhaustive — covers ASEAN + the countries most likely to
   show up in practice for this tool's users. An unrecognized code
   simply falls back to showing the raw code with no flag, so
   missing entries degrade gracefully rather than breaking anything.
   ========================================================= */

const COUNTRY_ISO3_TO_INFO = {
  IDN: { iso2: 'id', name: 'Indonesia' },
  MYS: { iso2: 'my', name: 'Malaysia' },
  SGP: { iso2: 'sg', name: 'Singapura' },
  THA: { iso2: 'th', name: 'Thailand' },
  VNM: { iso2: 'vn', name: 'Vietnam' },
  PHL: { iso2: 'ph', name: 'Filipina' },
  MMR: { iso2: 'mm', name: 'Myanmar' },
  KHM: { iso2: 'kh', name: 'Kamboja' },
  LAO: { iso2: 'la', name: 'Laos' },
  BRN: { iso2: 'bn', name: 'Brunei Darussalam' },
  TLS: { iso2: 'tl', name: 'Timor Leste' },

  AUS: { iso2: 'au', name: 'Australia' },
  NZL: { iso2: 'nz', name: 'Selandia Baru' },
  PNG: { iso2: 'pg', name: 'Papua Nugini' },

  CHN: { iso2: 'cn', name: 'Tiongkok' },
  HKG: { iso2: 'hk', name: 'Hong Kong' },
  TWN: { iso2: 'tw', name: 'Taiwan' },
  JPN: { iso2: 'jp', name: 'Jepang' },
  KOR: { iso2: 'kr', name: 'Korea Selatan' },
  PRK: { iso2: 'kp', name: 'Korea Utara' },
  IND: { iso2: 'in', name: 'India' },
  PAK: { iso2: 'pk', name: 'Pakistan' },
  BGD: { iso2: 'bd', name: 'Bangladesh' },
  LKA: { iso2: 'lk', name: 'Sri Lanka' },
  NPL: { iso2: 'np', name: 'Nepal' },

  SAU: { iso2: 'sa', name: 'Arab Saudi' },
  ARE: { iso2: 'ae', name: 'Uni Emirat Arab' },
  QAT: { iso2: 'qa', name: 'Qatar' },
  KWT: { iso2: 'kw', name: 'Kuwait' },
  BHR: { iso2: 'bh', name: 'Bahrain' },
  OMN: { iso2: 'om', name: 'Oman' },
  JOR: { iso2: 'jo', name: 'Yordania' },
  ISR: { iso2: 'il', name: 'Israel' },
  TUR: { iso2: 'tr', name: 'Turki' },
  IRQ: { iso2: 'iq', name: 'Irak' },
  IRN: { iso2: 'ir', name: 'Iran' },
  EGY: { iso2: 'eg', name: 'Mesir' },

  GBR: { iso2: 'gb', name: 'Inggris' },
  IRL: { iso2: 'ie', name: 'Irlandia' },
  FRA: { iso2: 'fr', name: 'Prancis' },
  DEU: { iso2: 'de', name: 'Jerman' },
  NLD: { iso2: 'nl', name: 'Belanda' },
  BEL: { iso2: 'be', name: 'Belgia' },
  CHE: { iso2: 'ch', name: 'Swiss' },
  AUT: { iso2: 'at', name: 'Austria' },
  ESP: { iso2: 'es', name: 'Spanyol' },
  PRT: { iso2: 'pt', name: 'Portugal' },
  ITA: { iso2: 'it', name: 'Italia' },
  GRC: { iso2: 'gr', name: 'Yunani' },
  SWE: { iso2: 'se', name: 'Swedia' },
  NOR: { iso2: 'no', name: 'Norwegia' },
  DNK: { iso2: 'dk', name: 'Denmark' },
  FIN: { iso2: 'fi', name: 'Finlandia' },
  POL: { iso2: 'pl', name: 'Polandia' },
  RUS: { iso2: 'ru', name: 'Rusia' },
  UKR: { iso2: 'ua', name: 'Ukraina' },
  CZE: { iso2: 'cz', name: 'Ceko' },

  USA: { iso2: 'us', name: 'Amerika Serikat' },
  CAN: { iso2: 'ca', name: 'Kanada' },
  MEX: { iso2: 'mx', name: 'Meksiko' },
  BRA: { iso2: 'br', name: 'Brasil' },
  ARG: { iso2: 'ar', name: 'Argentina' },
  CHL: { iso2: 'cl', name: 'Chili' },
  COL: { iso2: 'co', name: 'Kolombia' },
  PER: { iso2: 'pe', name: 'Peru' },

  ZAF: { iso2: 'za', name: 'Afrika Selatan' },
  NGA: { iso2: 'ng', name: 'Nigeria' },
  KEN: { iso2: 'ke', name: 'Kenya' },
  MAR: { iso2: 'ma', name: 'Maroko' },

  FJI: { iso2: 'fj', name: 'Fiji' }
};

/**
 * Look up display info for a 3-letter country code from the
 * geocoding service. Returns null if unknown (caller should fall
 * back to showing the raw code, no flag).
 */
function getCountryInfo(iso3) {
  if (!iso3) return null;
  return COUNTRY_ISO3_TO_INFO[String(iso3).toUpperCase()] || null;
}
