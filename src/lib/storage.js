/*
 * Tabula — spreadsheet-style new tab page browser extension.
 *
 * Copyright (C) 2026 withersky
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// Storage, defaults, migration, i18n, helpers for Tabula.

function cryptoId() {
  return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

function colLetter(idx) {
  let n = idx;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function clampCols(n) {
  n = parseInt(n, 10);
  if (isNaN(n)) n = 8;
  if (n < 3) n = 3;
  if (n > 12) n = 12;
  return n;
}

function makeBlankSheet(name, cols, icon) {
  return { id: cryptoId(), name: name || "Лист", columns: clampCols(cols || 8), icon: icon || "📋", cells: {} };
}

function computeRowsForSheet(sheet, minRows) {
  minRows = minRows || 12;
  let maxRow = -1;
  for (const k of Object.keys(sheet.cells || {})) {
    const r = parseInt(k.split(",")[0], 10);
    if (!isNaN(r) && r > maxRow) maxRow = r;
  }
  return Math.max(minRows, maxRow + 4);
}

function findFirstEmptyCell(sheet, maxRows, cols) {
  maxRows = maxRows || computeRowsForSheet(sheet, 12);
  cols = cols || (sheet.columns || 8);
  for (let r = 0; r < maxRows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!sheet.cells || !sheet.cells[r + "," + c]) return r + "," + c;
    }
  }
  return null;
}

function getActiveSheet(data) {
  if (!data || !Array.isArray(data.sheets) || data.sheets.length === 0) return null;
  return data.sheets.find(s => s.id === data.activeSheetId) || data.sheets[0];
}

// ---------- font family presets ----------
const FONT_FAMILIES = [
  { key: "system",       css: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", i18n: "fontSystem" },
  { key: "inter",        css: "'Inter', system-ui, sans-serif",                            i18n: "fontInter" },
  { key: "roboto",       css: "'Roboto', system-ui, sans-serif",                           i18n: "fontRoboto" },
  { key: "segoe",        css: "'Segoe UI', system-ui, sans-serif",                         i18n: "fontSegoe" },
  { key: "helvetica",    css: "'Helvetica Neue', Helvetica, Arial, sans-serif",            i18n: "fontHelvetica" },
  { key: "sf",           css: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif", i18n: "fontSF" },
  { key: "mono",         css: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", i18n: "fontMono" },
  { key: "roboto-mono",  css: "'Roboto Mono', ui-monospace, monospace",                    i18n: "fontRobotoMono" },
  { key: "jetbrains",    css: "'JetBrains Mono', ui-monospace, monospace",                 i18n: "fontJetBrains" },
  { key: "fira",         css: "'Fira Code', ui-monospace, monospace",                      i18n: "fontFira" },
  { key: "georgia",      css: "Georgia, 'Times New Roman', serif",                         i18n: "fontGeorgia" },
  { key: "merriweather", css: "Merriweather, Georgia, serif",                               i18n: "fontMerriweather" },
  { key: "custom",       css: "",                                                          i18n: "fontCustom" }
];

const DEFAULT_FONT_CSS = FONT_FAMILIES[0].css;

function resolveFont(key, customCss) {
  const preset = FONT_FAMILIES.find(f => f.key === key);
  if (preset && key !== "custom") return preset.css;
  return (customCss && customCss.trim()) || DEFAULT_FONT_CSS;
}

// ---------- i18n ----------
// Переводы интерфейса вынесены в отдельные JSON-файлы (src/i18n/*.json),
// чтобы сообщество могло добавлять языки без правки кода.
// В браузере данные подставляет src/i18n/generated/ui.js (глобал I18N_DATA);
// в Node (юнит-тесты) читаем JSON напрямую.
const I18N =
  (typeof globalThis !== "undefined" && globalThis.I18N_DATA) ||
  (typeof module === "object" && module.exports
    ? { ru: require("../i18n/ru.json"), en: require("../i18n/en.json") }
    : { ru: {}, en: {} });

// t() возвращает перевод; для строк с плейсхолдерами {name}/{n} —
// функцию-форматтер, которую вызывают с объектом параметров:
//   t("bookmarksConfirm")({ name, n });   → "Создать лист «x» и добавить 3 закладок?"
function t(key, lang) {
  const dict = I18N[lang] || I18N.ru;
  const v = (dict && dict[key] != null) ? dict[key] : I18N.en[key];
  if (typeof v === "string" && /\{\w+\}/.test(v)) {
    return (params) => v.replace(/\{(\w+)\}/g, (m, name) => {
      const val = params && params[name];
      return val != null ? String(val) : m;
    });
  }
  return v != null ? v : key;
}

// ---------- defaults ----------
function defaultData() {
  const cols = 8;
  const seed = [
    ["Google",    "https://google.com"],
    ["YouTube",   "https://youtube.com"],
    ["GitHub",    "https://github.com"],
    ["Wikipedia", "https://wikipedia.org"],
    ["Gmail",     "https://mail.google.com"],
    ["Maps",      "https://maps.google.com"]
  ];
  const cells = {};
  seed.forEach((pair, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    cells[r + "," + c] = { id: cryptoId(), title: pair[0], url: pair[1] };
  });
  return {
    sheets: [
      { id: cryptoId(), name: "Главная", columns: cols, icon: "🏠", cells },
      { id: cryptoId(), name: "Работа",  columns: cols, icon: "💼", cells: {} },
      { id: cryptoId(), name: "Новости", columns: cols, icon: "📰", cells: {} }
    ],
    activeSheetId: null,
    settings: {
      defaultColumns: cols,
      uiOpacity: 90,
      uiScale: 100,
      cellSelectedColor: "#788cff",
      cellSelectedMode: "custom",
      gridRows: 6,
      fontFamilyKey: "system",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      fontSize: 13,
      textColor: "#e8e8f0",
      cellTextAlign: "left",
      faviconPosition: "left",
      pageTitle: "",
      backgroundType: "gradient",
      backgroundColor: "#000000",
      backgroundGradient: "linear-gradient(135deg, #0f0f1a 0%, #1a1a3e 100%)",
      backgroundImage: "",
      bingMkt: "ru-RU",
      showFavicon: true,
      touchGestures: true,
      openInNewTab: false,
      showRowNumbers: false,
      showColLetters: false,
      showSheetTabs: true,
      showQuickGo: true,
      searchEngine: "google",
      quickGoSuggest: true,
      showGrid: true,
      showClock: true,
      clockSize: 28,
      showWeather: true,
      weatherCity: "",
      weatherLat: null,
      weatherLon: null,
      weatherCities: [],
      weatherActiveCityId: null,
      clockCities: [],
      clockActiveCityId: null,
      weatherSize: 13,
      weatherRefreshMin: 90,
      weatherForecastDays: 5,
      weatherDateFmt: "dd.mm",
      language: "ru"
    },
    bingCache: null,
    weatherCache: null,
    weatherCaches: {}
  };
}

const DEFAULT_DATA = defaultData();

if (!DEFAULT_DATA.activeSheetId && DEFAULT_DATA.sheets[0]) {
  DEFAULT_DATA.activeSheetId = DEFAULT_DATA.sheets[0].id;
}

// ---------- migration ----------
function migrateSheet(oldSheet) {
  if (oldSheet && oldSheet.cells && typeof oldSheet.cells === "object" && !Array.isArray(oldSheet.cells)) {
    return {
      id: oldSheet.id || cryptoId(),
      name: String(oldSheet.name || "Лист"),
      icon: String(oldSheet.icon || "📋"),
      columns: clampCols(oldSheet.columns || 8),
      cells: oldSheet.cells
    };
  }
  const cols = clampCols((oldSheet && oldSheet.columns) || 8);
  const cells = {};
  const tabs = (oldSheet && Array.isArray(oldSheet.tabs)) ? oldSheet.tabs : [];
  tabs.forEach((tab, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    cells[r + "," + c] = { id: tab.id || cryptoId(), title: String(tab.title || ""), url: String(tab.url || "") };
  });
  return {
    id: (oldSheet && oldSheet.id) || cryptoId(),
    name: String((oldSheet && oldSheet.name) || "Лист"),
    icon: String((oldSheet && oldSheet.icon) || "📋"),
    columns: cols,
    cells
  };
}

function migrate(oldData) {
  if (!oldData) return defaultData();

  if (Array.isArray(oldData.sheets) && oldData.sheets.length > 0) {
    const sheets = oldData.sheets.map(migrateSheet);
    const active = oldData.activeSheetId && sheets.find(s => s.id === oldData.activeSheetId)
      ? oldData.activeSheetId
      : sheets[0].id;
    const cleanedSettings = Object.assign({}, oldData.settings || {});
    delete cleanedSettings.cellBg;
    delete cleanedSettings.cellBgHover;
    delete cleanedSettings.cellBorder;
    delete cleanedSettings.zebra;
    delete cleanedSettings.gridOpacity;
    delete cleanedSettings.quickGoSuggestOpacity;
    delete cleanedSettings.weatherPopupOpacity;
    return {
      sheets,
      activeSheetId: active,
      settings: cleanedSettings,
      bingCache: oldData.bingCache || null,
      weatherCache: oldData.weatherCache || null,
      weatherCaches: (oldData.weatherCaches && typeof oldData.weatherCaches === "object")
        ? oldData.weatherCaches
        : {}
    };
  }

  if (Array.isArray(oldData.tabs)) {
    const oldTabs = oldData.tabs;
    const oldGroups = Array.isArray(oldData.groups) && oldData.groups.length > 0 ? oldData.groups : ["Главная"];
    const cols = clampCols(8);
    const sheets = oldGroups.map(g => {
      const cells = {};
      const groupTabs = oldTabs.filter(t => (t.group || oldGroups[0]) === g);
      groupTabs.forEach((tab, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        cells[r + "," + c] = { id: tab.id || cryptoId(), title: String(tab.title || ""), url: String(tab.url || "") };
      });
      return { id: cryptoId(), name: g, columns: cols, cells };
    });
    const cleanedSettings = Object.assign({}, oldData.settings || {});
    delete cleanedSettings.cellBg;
    delete cleanedSettings.cellBgHover;
    delete cleanedSettings.cellBorder;
    delete cleanedSettings.zebra;
    delete cleanedSettings.gridOpacity;
    delete cleanedSettings.quickGoSuggestOpacity;
    delete cleanedSettings.weatherPopupOpacity;
    return {
      sheets,
      activeSheetId: sheets[0].id,
      settings: cleanedSettings,
      bingCache: null,
      weatherCache: null,
      weatherCaches: {}
    };
  }

  return defaultData();
}

function mergeWithDefaults(data) {
  const out = defaultData();
  if (data && Array.isArray(data.sheets)) {
    out.sheets = data.sheets.map(s => ({
      id: s.id || cryptoId(),
      name: String(s.name || "Лист"),
      icon: String(s.icon || "📋"),
      columns: clampCols(s.columns || out.settings.defaultColumns),
      cells: (s.cells && typeof s.cells === "object") ? s.cells : {}
    }));
    out.activeSheetId = data.activeSheetId || out.sheets[0].id;
    if (!out.sheets.find(s => s.id === out.activeSheetId)) out.activeSheetId = out.sheets[0].id;
  }
  if (data && data.bingCache) out.bingCache = data.bingCache;
  if (data && data.weatherCaches && typeof data.weatherCaches === "object") {
    out.weatherCaches = Object.assign({}, data.weatherCaches);
  }
  if (data && data.settings && typeof data.settings === "object") {
    out.settings = Object.assign({}, out.settings, data.settings);
    out.settings.defaultColumns = clampCols(out.settings.defaultColumns);
    // cellSelectedMode: "custom" (ручной цвет) | "autoColor" (автоцвет из фона).
    if (!["custom", "autoColor"].includes(out.settings.cellSelectedMode)) {
      out.settings.cellSelectedMode = "custom";
    }
    // Нормализация городов погоды: приводим записи к единому виду, при
    // отсутствии списка создаём город из легаси weatherLat/weatherLon/weatherCity.
    let weatherCities = Array.isArray(out.settings.weatherCities)
      ? out.settings.weatherCities
      : [];
    weatherCities = weatherCities
      .map(c => ({
        id: String((c && c.id) || cryptoId()),
        name: String((c && c.name) || ""),
        country: String((c && c.country) || ""),
        lat: Number(c && c.lat),
        lon: Number(c && c.lon)
      }))
      .filter(c => c.name && isFinite(c.lat) && isFinite(c.lon));
    if (weatherCities.length === 0 &&
        out.settings.weatherCity && out.settings.weatherLat != null && out.settings.weatherLon != null) {
      weatherCities = [{
        id: cryptoId(),
        name: String(out.settings.weatherCity),
        country: "",
        lat: Number(out.settings.weatherLat),
        lon: Number(out.settings.weatherLon)
      }];
    }
    if (weatherCities.length === 0) {
      weatherCities = out.settings.weatherCities;
    }
    if (!weatherCities.find(c => c.id === out.settings.weatherActiveCityId)) {
      out.settings.weatherActiveCityId = weatherCities.length > 0 ? weatherCities[0].id : null;
    }
    out.settings.weatherCities = weatherCities;
    // Нормализация городов часов (timezone "" — локальное время устройства).
    let clockCities = Array.isArray(out.settings.clockCities)
      ? out.settings.clockCities
      : [];
    clockCities = clockCities
      .map(c => ({
        id: String((c && c.id) || cryptoId()),
        name: String((c && c.name) || ""),
        timezone: String((c && c.timezone) || "")
      }))
      .filter(c => c.name);
    out.settings.clockCities = clockCities;
    if (!clockCities.find(c => c.id === out.settings.clockActiveCityId)) {
      out.settings.clockActiveCityId = clockCities.length > 0 ? clockCities[0].id : null;
    }
    // Перенос legacy-кэша погоды на активный город (старый единственный город).
    if (data && data.weatherCache && out.settings.weatherActiveCityId &&
        !out.weatherCaches[out.settings.weatherActiveCityId]) {
      out.weatherCaches[out.settings.weatherActiveCityId] = data.weatherCache;
    }
    delete out.settings.cellBg;
    delete out.settings.cellBgHover;
    delete out.settings.cellBorder;
    delete out.settings.zebra;
    delete out.settings.cellHeight;
    delete out.settings.weatherPopupWidth;
    delete out.settings.clockFontKey;
    delete out.settings.clockFont;
    delete out.settings.gridOpacity;
    delete out.settings.quickGoSuggestOpacity;
    delete out.settings.weatherPopupOpacity;
    const systemPreset = FONT_FAMILIES.find(f => f.key === "system");
    if (!out.settings.fontFamilyKey) {
      out.settings.fontFamilyKey = (systemPreset && out.settings.fontFamily && out.settings.fontFamily === systemPreset.css)
        ? "system"
        : "custom";
    }
  }
  return out;
}

// ---------- Storage API ----------
const Storage = {
  async get() {
    const stored = await ext.storage.local.get(["tabula_data"]);
    if (stored && stored.tabula_data) {
      const migrated = migrate(stored.tabula_data);
      const changed = !Array.isArray(stored.tabula_data.sheets)
        || stored.tabula_data.sheets.some(s => Array.isArray(s.tabs));
      if (changed) await ext.storage.local.set({ tabula_data: migrated });
      return mergeWithDefaults(migrated);
    }
    const fresh = mergeWithDefaults(defaultData());
    await ext.storage.local.set({ tabula_data: fresh });
    return fresh;
  },
  async set(data) {
    await ext.storage.local.set({ tabula_data: data });
  },
  async update(mutator) {
    const data = await Storage.get();
    mutator(data);
    await Storage.set(data);
    return data;
  },
  async reset() {
    const fresh = mergeWithDefaults(defaultData());
    await ext.storage.local.set({ tabula_data: fresh });
    return fresh;
  },
  onChanged(cb) {
    ext.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.tabula_data) {
        cb(changes.tabula_data.newValue);
      }
    });
  }
};

window.Storage  = Storage;
window.t        = t;
window.colLetter= colLetter;
window.clampCols = clampCols;
window.makeBlankSheet = makeBlankSheet;
window.computeRowsForSheet = computeRowsForSheet;
window.findFirstEmptyCell = findFirstEmptyCell;
window.getActiveSheet = getActiveSheet;
window.cryptoId = cryptoId;

// CommonJS-экспорт для юнит-тестов (Robot Framework / Node).
// В браузере этот блок не выполняется: module не определён.
if (typeof module === "object" && module.exports) {
  module.exports = {
    Storage, t, colLetter, clampCols, makeBlankSheet, computeRowsForSheet,
    findFirstEmptyCell, getActiveSheet, cryptoId, resolveFont, FONT_FAMILIES,
    I18N, DEFAULT_DATA, defaultData, migrate, migrateSheet, mergeWithDefaults
  };
}
