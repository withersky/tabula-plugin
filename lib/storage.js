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
  { key: "custom",       css: "",                                                          i18n: "optClockFontCustom" }
];

const DEFAULT_FONT_CSS = FONT_FAMILIES[0].css;

function resolveFont(key, customCss) {
  const preset = FONT_FAMILIES.find(f => f.key === key);
  if (preset && key !== "custom") return preset.css;
  return (customCss && customCss.trim()) || DEFAULT_FONT_CSS;
}

function resolveClockFont(settings) {
  if (!settings) return DEFAULT_FONT_CSS;
  return resolveFont(settings.clockFontKey, settings.clockFont);
}

// ---------- i18n ----------
const I18N = {
  ru: {
    appName: "Tabula",
    newTabTitle: "Новая вкладка",
    pageTitleHint: "Используется как заголовок окна и вкладки",
    search: "Поиск или введите URL  (нажмите / для фокуса)",
    addBookmark: "Добавить закладку",

    sectionWidgets: "Виджеты",
    navWidgets: "Виджеты",
    widgetClockTitle: "Часы",
    widgetSearchTitle: "Поиск",
    widgetWeatherTitle: "Погода",
    widgetSubsectionAppearance: "Внешний вид",
    widgetSubsectionLocation: "Локация",
    optShowClock: "Показывать часы",
    optClockFont: "Шрифт часов",
    optClockFontHint: "Шрифт системный",
    optClockFontCustom: "Свой CSS",
    optClockSize: "Размер часов",
    fontSystem: "Системный",
    fontInter: "Inter",
    fontRoboto: "Roboto",
    fontSegoe: "Segoe UI",
    fontHelvetica: "Helvetica Neue",
    fontSF: "SF Pro / San Francisco",
    fontMono: "Моноширинный",
    fontRobotoMono: "Roboto Mono",
    fontJetBrains: "JetBrains Mono",
    fontFira: "Fira Code",
    fontGeorgia: "Georgia (с засечками)",
    fontMerriweather: "Merriweather",
    optClockSizeDate: "Размер даты пропорционален размеру часов",
    sectionAbout: "О расширении",
    aboutText: "Tabula — настраиваемая новая вкладка в стиле электронной таблицы. Хранит данные локально.",
    aboutAuthor: "Автор",
    aboutAuthorName: "withersky",
    aboutVersion: "Версия",
    aboutRepository: "Репозиторий",
    aboutSite: "Сайт",
    aboutRepositoryHint: "Открыть исходный код на GitHub",
    aboutSiteHint: "Открыть сайт",
    aboutThanks: "Спасибо, что пользуетесь Tabula!",
    optShowWeather: "Показывать погоду",
    optWeatherCity: "Город",
    weatherLoadFailed: "Не удалось получить погоду",
    weatherLoading: "Загружаем погоду…",
    weatherOpenExternal: "Открыть подробный прогноз",
    close: "Закрыть",
    clockDays: ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"],
    clockDaysShort: ["вс","пн","вт","ср","чт","пт","сб"],
    clockMonths: ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"],
    hintWeatherCity: "например, Москва, Berlin, Tokyo",
    hintClockFont: "CSS-шрифт",

    optWeatherLat: "Широта",
    optWeatherLon: "Долгота",
    optWeatherCityAuto: "Получить координаты по городу",
    optWeatherCoordsHint: "Координаты для met.no",
    optWeatherRefreshMin: "Интервал обновления погоды",
    unitMin: "мин.",
    optWeatherForecastDays: "Дней в прогнозе",
    unitDay: "дн.",
    optWeatherPopupOpacity: "Прозрачность подложки прогноза",
    optWeatherDateFmt: "Формат даты в прогнозе",
    weatherDateFmtDdMm: "дд.мм (15.08)",
    weatherDateFmtDdMmYy: "дд.мм.гг (15.08.26)",
    weatherDateFmtDdMmYyyy: "дд.мм.гггг (15.08.2026)",
    weatherDateFmtDdMon: "дд месяц кр. (15 авг)",
    weatherDateFmtDdMonth: "дд месяц полн. (15 августа)",
    weatherDateFmtOff: "Не показывать",
 weatherForecastTitle: "Прогноз погоды",
 weatherToday: "Сегодня",
 weatherTomorrow: "Завтра",
 weatherOpenForecast: "Открыть прогноз",
 weatherNoData: "Прогноз пока недоступен",
    optWeatherSize: "Размер виджета погоды",
    optWeatherPack: "Пак иконок",
    weatherNoLocation: "Укажите координаты",
    weatherSymbolPrefix: "met.no: ",
    geoModalTitle: "Получить координаты по городу",
    geoModalHint: "Введите название города — выберите подходящий вариант из списка.",
    geoSearch: "Найти",
    geoSearching: "Идёт поиск…",
    geoNotFound: "Ничего не найдено. Попробуйте другой запрос.",
    geoError: "Не удалось выполнить поиск. Проверьте соединение.",
    geoPickHint: "Нажмите, чтобы выбрать",

    optShowGrid: "Показывать линии сетки",
    sheetIcon: "Иконка листа",
    promptSheetIcon: "Иконка (emoji), например 📋",
    iconOpen: "🔗",
    iconOpenNew: "↗",
    iconEdit: "✏️",
    iconDuplicate: "⎘",
    iconDelete: "🗑",
    iconAdd: "➕",
    iconRename: "✏️",
    iconColumns: "⋮⋮",
    iconIcon: "😀",
    iconAddSheet: "＋",
    settings: "Настройки",
    open: "Открыть",
    openInNewTab: "Открыть в новой вкладке",
    edit: "Изменить",
    duplicate: "Дублировать",
    delete: "Удалить",
    cancel: "Отмена",
    save: "Сохранить",
    saved: "Сохранено",
    added: "Добавлено",
    deleted: "Удалено",
    duplicated: "Дублировано",
    moved: "Перемещено",
    swapped: "Поменяли местами",
    cellOccupied: "Здесь уже есть закладка",
    renamed: "Переименовано",
    removed: "Удалено",
    sheetAdded: "Лист добавлен",
    sheetExists: "Лист с таким именем уже есть",
    needOneSheet: "Должен остаться хотя бы один лист",
    addHere: "Добавить сюда",
    modalAdd: "Добавить закладку",
    modalEdit: "Изменить закладку",
    placeholderTitle: "Название",
    placeholderUrl: "https://example.com",
    fieldTitle: "Название",
    fieldUrl: "URL",
    addSheet: "Добавить лист",
    renameSheet: "Переименовать лист",
    setColumns: "Колонок",
    deleteSheet: "Удалить лист",
    scrollLeft: "Прокрутить влево",
    scrollRight: "Прокрутить вправо",
    sheetName: "Название листа",
    newSheetDefault: "Новый лист",
    promptSheetName: "Название листа",
    promptColumns: "Сколько колонок (3–12)?",
    confirmDeleteSheet: function(n) { return "Удалить лист и " + n + " закладку(и) в нём?"; },
    settingsTitle: "Tabula — Настройки",
    sectionGrid: "Сетка",
    sectionTypography: "Текст",
    sectionBackground: "Фон",
    sectionBehaviour: "Поведение",
    sectionData: "Данные",
    navGrid: "Сетка",
    navTypography: "Текст",
    navBackground: "Фон",
    navBehaviour: "Поведение",
    navData: "Данные",
    navLanguage: "Язык",
    navAbout: "О расширении",
    labelDefaultColumns: "Колонок по умолчанию",
    labelGridRows: "Строк по умолчанию",
    hintDefaultColumns: "используется при создании новых листов",
    labelGridOpacity: "Прозрачность ячеек",
    labelCellSelectedColor: "Цвет выделения",
    labelFontFamily: "Шрифт",
    labelFontFamilyHint: "Название шрифта или CSS-список",
    labelFontSize: "Размер шрифта",
    labelTextColor: "Цвет текста",
    labelBgType: "Тип фона",
    bgColor: "Сплошной цвет",
    bgGradient: "Градиент",
    bgImageUrl: "URL изображения",
    bgImageUpload: "Загрузить своё изображение",
    bgBing: "Bing: изображение дня",
    labelBgColor: "Цвет фона",
    labelBgGradient: "Градиент",
    labelBgImage: "URL изображения",
    labelBingMkt: "Регион Bing",
    labelPageTitle: "Заголовок вкладки",
    placeholderGradient: "linear-gradient(135deg, #0f0f1a 0%, #1a1a3e 100%)",
    uploadImage: "Загрузить изображение",
    uploadHint: "Перетащите файл сюда или нажмите кнопку",
    dropHere: "Отпустите файл для загрузки",
    clearImage: "Удалить",
    imageTooLarge: "Файл слишком большой (макс. 2 МБ)",
    optShowFavicon: "Показывать иконки сайтов",
    optOpenInNewTab: "Открывать закладки в новой вкладке",
    optShowRowNumbers: "Показывать номера строк",
    optShowColLetters: "Показывать буквы колонок",
    optShowSheetTabs: "Показывать вкладки листов",
    optShowQuickGo: "Показывать поисковую строку",
    optSearchEngine: "Поисковая машина",
    optQuickGoSuggest: "Подсказки поиска",
    optQuickGoSuggestOpacity: "Прозрачность подложки",
    searchEngineGoogle: "Google",
    searchEngineYandex: "Yandex",
    searchEngineBing: "Bing",
    optLanguage: "Язык интерфейса",
    dataHint: "Все данные хранятся локально. Экспортируйте, чтобы сделать резервную копию.",
    export: "Экспорт",
    import: "Импорт",
    importBookmarks: "Из папки закладок",
    bookmarksModalTitle: "Импорт из закладок",
    bookmarksModalHint: "Выберите папку закладок браузера — её содержимое добавится на новый лист.",
    bookmarksFolderLabel: "Папка",
    bookmarksImportBtn: "Импортировать",
    bookmarksFolderInfo: function(n) { return "Закладок в папке: " + n; },
    bookmarksFolderEmpty: "В этой папке нет закладок.",
    bookmarksUnavailable: "Доступ к закладкам браузера недоступен.",
    bookmarksConfirm: function(name, n) { return "Создать лист «" + name + "» и добавить " + n + " закладок?"; },
    bookmarksImported: function(n) { return "Импортировано закладок: " + n; },
    bookmarksSheetDefault: "Закладки",
    reset: "Сбросить настройки",
    confirmReset: "Сбросить все настройки и данные на значения по умолчанию?",
    confirmImport: "Заменить текущие данные импортированными?",
    confirmTitle: "Подтверждение",
    confirmOk: "Подтвердить",
    invalidImport: "Неверный формат файла",
    importFailed: "Ошибка импорта: ",
    exported: "Экспортировано",
    imported: "Импортировано",
    resetDone: "Сброшено к значениям по умолчанию",
    unitPx: "пикс.",
    bingLoading: "Загружаем картинку дня…",
    bingFailed: "Не удалось загрузить Bing — оставлен прежний фон",
    bgPreview: "Предпросмотр фона",
    fontPreview: "Пример текста",
    navHome: "Главная",
    backToGrid: "Открыть новую вкладку",
    savedAuto: "Автосохранение",
    dragImageHere: "Перетащите изображение сюда"
  },
  en: {
    appName: "Tabula",
    newTabTitle: "New Tab",
    pageTitleHint: "Used as the window and tab title",
    search: "Search or enter URL  (press / to focus)",
    addBookmark: "Add bookmark",

    sectionWidgets: "Widgets",
    navWidgets: "Widgets",
    widgetClockTitle: "Clock",
    widgetSearchTitle: "Search",
    widgetWeatherTitle: "Weather",
    widgetSubsectionAppearance: "Appearance",
    widgetSubsectionLocation: "Location",
    optShowClock: "Show clock",
    optClockFont: "Clock font",
    optClockFontHint: "System font",
    optClockFontCustom: "Custom CSS",
    optClockSize: "Clock size",
    fontSystem: "System default",
    fontInter: "Inter",
    fontRoboto: "Roboto",
    fontSegoe: "Segoe UI",
    fontHelvetica: "Helvetica Neue",
    fontSF: "SF Pro / San Francisco",
    fontMono: "Monospace",
    fontRobotoMono: "Roboto Mono",
    fontJetBrains: "JetBrains Mono",
    fontFira: "Fira Code",
    fontGeorgia: "Georgia (serif)",
    fontMerriweather: "Merriweather",
    optClockSizeDate: "Date size scales with clock size",
    sectionAbout: "About",
    aboutText: "Tabula is a customizable spreadsheet-style new tab page. All data is stored locally.",
    aboutAuthor: "Author",
    aboutAuthorName: "withersky",
    aboutVersion: "Version",
    aboutRepository: "Repository",
    aboutSite: "Site",
    aboutRepositoryHint: "Open source on GitHub",
    aboutSiteHint: "Open website",
    aboutThanks: "Thanks for using Tabula!",
    optShowWeather: "Show weather",
    optWeatherCity: "City",
    weatherLoadFailed: "Failed to fetch weather",
    weatherLoading: "Loading weather…",
    weatherOpenExternal: "Open detailed forecast",
    close: "Close",
    clockDays: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    clockDaysShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    clockMonths: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    hintWeatherCity: "e.g., Moscow, Berlin, Tokyo",
    hintClockFont: "CSS font",

    optWeatherLat: "Latitude",
    optWeatherLon: "Longitude",
    optWeatherCityAuto: "Get coordinates by city",
    optWeatherCoordsHint: "Coordinates for met.no",
    optWeatherRefreshMin: "Weather refresh interval",
    unitMin: "min",
    optWeatherForecastDays: "Forecast days",
    unitDay: "day(s)",
    optWeatherPopupOpacity: "Forecast popup background opacity",
    optWeatherDateFmt: "Date format in forecast",
    weatherDateFmtDdMm: "dd.mm (15.08)",
    weatherDateFmtDdMmYy: "dd.mm.yy (15.08.26)",
    weatherDateFmtDdMmYyyy: "dd.mm.yyyy (15.08.2026)",
    weatherDateFmtDdMon: "dd short month (15 Aug)",
    weatherDateFmtDdMonth: "dd full month (15 August)",
    weatherDateFmtOff: "Don't show",
 weatherForecastTitle: "Weather forecast",
 weatherToday: "Today",
 weatherTomorrow: "Tomorrow",
 weatherOpenForecast: "Open forecast",
 weatherNoData: "Forecast not available yet",
    optWeatherSize: "Weather widget size",
    optWeatherPack: "Icon pack",
    weatherNoLocation: "Set coordinates",
    weatherSymbolPrefix: "met.no: ",
    geoModalTitle: "Get coordinates by city",
    geoModalHint: "Type a city name and pick a match from the list.",
    geoSearch: "Search",
    geoSearching: "Searching…",
    geoNotFound: "Nothing found. Try a different query.",
    geoError: "Search failed. Check your connection.",
    geoPickHint: "Click to select",

    optShowGrid: "Show grid lines",
    sheetIcon: "Sheet icon",
    promptSheetIcon: "Icon (emoji), e.g. 📋",
    iconOpen: "🔗",
    iconOpenNew: "↗",
    iconEdit: "✏️",
    iconDuplicate: "⎘",
    iconDelete: "🗑",
    iconAdd: "➕",
    iconRename: "✏️",
    iconColumns: "⋮⋮",
    iconIcon: "😀",
    iconAddSheet: "＋",
    settings: "Settings",
    open: "Open",
    openInNewTab: "Open in new tab",
    edit: "Edit",
    duplicate: "Duplicate",
    delete: "Delete",
    cancel: "Cancel",
    save: "Save",
    saved: "Saved",
    added: "Added",
    deleted: "Deleted",
    duplicated: "Duplicated",
    moved: "Moved",
    swapped: "Swapped",
    cellOccupied: "This cell already has a bookmark",
    renamed: "Renamed",
    removed: "Removed",
    sheetAdded: "Sheet added",
    sheetExists: "A sheet with this name already exists",
    needOneSheet: "Need at least one sheet",
    addHere: "Add here",
    modalAdd: "Add bookmark",
    modalEdit: "Edit bookmark",
    placeholderTitle: "Title",
    placeholderUrl: "https://example.com",
    fieldTitle: "Title",
    fieldUrl: "URL",
    addSheet: "Add sheet",
    renameSheet: "Rename sheet",
    setColumns: "Columns",
    deleteSheet: "Delete sheet",
    scrollLeft: "Scroll left",
    scrollRight: "Scroll right",
    sheetName: "Sheet name",
    newSheetDefault: "New sheet",
    promptSheetName: "Sheet name",
    promptColumns: "How many columns (3–12)?",
    confirmDeleteSheet: function(n) { return "Delete this sheet and " + n + " bookmark(s) in it?"; },
    settingsTitle: "Tabula — Settings",
    sectionGrid: "Grid",
    sectionTypography: "Typography",
    sectionBackground: "Background",
    sectionBehaviour: "Behaviour",
    sectionData: "Data",
    navGrid: "Grid",
    navTypography: "Text",
    navBackground: "Background",
    navBehaviour: "Behaviour",
    navData: "Data",
    navLanguage: "Language",
    navAbout: "About",
    labelDefaultColumns: "Default columns",
    labelGridRows: "Default rows",
    hintDefaultColumns: "used when creating new sheets",
    labelGridOpacity: "Cell opacity",
    labelCellSelectedColor: "Selection color",
    labelFontFamily: "Font family",
    labelFontFamilyHint: "Font name or CSS font list",
    labelFontSize: "Font size",
    labelTextColor: "Text color",
    labelBgType: "Background type",
    bgColor: "Solid color",
    bgGradient: "Gradient",
    bgImageUrl: "Image URL",
    bgImageUpload: "Upload your own image",
    bgBing: "Bing: image of the day",
    labelBgColor: "Background color",
    labelBgGradient: "Gradient",
    labelBgImage: "Image URL",
    labelBingMkt: "Bing region",
    labelPageTitle: "Tab title",
    placeholderGradient: "linear-gradient(135deg, #0f0f1a 0%, #1a1a3e 100%)",
    uploadImage: "Upload image",
    uploadHint: "Drag a file here or click the button",
    dropHere: "Drop the file to upload",
    clearImage: "Remove",
    imageTooLarge: "File too large (max 2 MB)",
    optShowFavicon: "Show site favicons",
    optOpenInNewTab: "Open bookmarks in new tab",
    optShowRowNumbers: "Show row numbers",
    optShowColLetters: "Show column letters",
    optShowSheetTabs: "Show sheet tabs",
    optShowQuickGo: "Show search bar",
    optSearchEngine: "Search engine",
    optQuickGoSuggest: "Search suggestions",
    optQuickGoSuggestOpacity: "Suggestions background opacity",
    searchEngineGoogle: "Google",
    searchEngineYandex: "Yandex",
    searchEngineBing: "Bing",
    optLanguage: "Interface language",
    dataHint: "All data is stored locally. Export to make a backup.",
    export: "Export",
    import: "Import",
    importBookmarks: "From bookmarks folder",
    bookmarksModalTitle: "Import from bookmarks",
    bookmarksModalHint: "Choose a browser bookmarks folder — its contents will be added to a new sheet.",
    bookmarksFolderLabel: "Folder",
    bookmarksImportBtn: "Import",
    bookmarksFolderInfo: function(n) { return "Bookmarks in this folder: " + n; },
    bookmarksFolderEmpty: "This folder has no bookmarks.",
    bookmarksUnavailable: "Browser bookmarks are not accessible.",
    bookmarksConfirm: function(name, n) { return "Create sheet \"" + name + "\" with " + n + " bookmarks?"; },
    bookmarksImported: function(n) { return "Imported bookmarks: " + n; },
    bookmarksSheetDefault: "Bookmarks",
    reset: "Reset settings",
    confirmReset: "Reset all settings and data to defaults?",
    confirmImport: "Replace current data with imported?",
    confirmTitle: "Confirmation",
    confirmOk: "Confirm",
    invalidImport: "Invalid file format",
    importFailed: "Import failed: ",
    exported: "Exported",
    imported: "Imported",
    resetDone: "Reset to defaults",
    unitPx: "px",
    bingLoading: "Loading image of the day…",
    bingFailed: "Failed to load Bing — previous background kept",
    bgPreview: "Background preview",
    fontPreview: "Text preview",
    navHome: "Home",
    backToGrid: "Open new tab",
    savedAuto: "Auto-save",
    dragImageHere: "Drop the image here"
  }
};

function t(key, lang) {
  const dict = I18N[lang] || I18N.ru;
  if (dict && dict[key] != null) return dict[key];
  return (I18N.en[key] != null) ? I18N.en[key] : key;
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
      gridOpacity: 0,
      cellSelectedColor: "#788cff",
      gridRows: 6,
      fontFamilyKey: "system",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      fontSize: 13,
      textColor: "#e8e8f0",
      pageTitle: "",
      backgroundType: "gradient",
      backgroundColor: "#000000",
      backgroundGradient: "linear-gradient(135deg, #0f0f1a 0%, #1a1a3e 100%)",
      backgroundImage: "",
      bingMkt: "ru-RU",
      showFavicon: true,
      openInNewTab: false,
      showRowNumbers: false,
      showColLetters: false,
      showSheetTabs: true,
      showQuickGo: true,
      searchEngine: "google",
      quickGoSuggest: true,
      quickGoSuggestOpacity: 90,
      showGrid: true,
      showClock: true,
      clockFontKey: "system",
      clockFont: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      clockSize: 28,
      showWeather: true,
      weatherCity: "Нижний Новгород",
      weatherLat: 56.3286,
      weatherLon: 44.0020,
      weatherSize: 13,
      weatherRefreshMin: 90,
      weatherForecastDays: 5,
      weatherPopupOpacity: 90,
      weatherDateFmt: "dd.mm",
      language: "ru"
    },
    bingCache: null,
    weatherCache: null
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
    return {
      sheets,
      activeSheetId: active,
      settings: cleanedSettings,
      bingCache: oldData.bingCache || null,
      weatherCache: oldData.weatherCache || null
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
    return {
      sheets,
      activeSheetId: sheets[0].id,
      settings: cleanedSettings,
      bingCache: null,
      weatherCache: null
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
  if (data && data.weatherCache) out.weatherCache = data.weatherCache;
  if (data && data.settings && typeof data.settings === "object") {
    out.settings = Object.assign({}, out.settings, data.settings);
    out.settings.defaultColumns = clampCols(out.settings.defaultColumns);
    delete out.settings.cellBg;
    delete out.settings.cellBgHover;
    delete out.settings.cellBorder;
    delete out.settings.zebra;
    delete out.settings.cellHeight;
    delete out.settings.weatherPopupWidth;
    const systemPreset = FONT_FAMILIES.find(f => f.key === "system");
    if (!out.settings.clockFontKey) {
      out.settings.clockFontKey = (systemPreset && out.settings.clockFont && out.settings.clockFont === systemPreset.css)
        ? "system"
        : "custom";
    }
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
