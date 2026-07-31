(() => {
  "use strict";

  const gridEl     = document.getElementById("grid");
  const bgEl       = document.getElementById("bg");
  const sheetTabsEl= document.getElementById("sheetTabs");
  const addSheetBtn= document.getElementById("addSheetBtn");
  const sheetBar   = document.getElementById("sheetBar");
  const sheetScrollLeft  = document.getElementById("sheetScrollLeft");
  const sheetScrollRight = document.getElementById("sheetScrollRight");
  const modalEl    = document.getElementById("modal");
  const modalTitle = document.getElementById("modalTitle");
  const tabForm    = document.getElementById("tabForm");
  const ctxMenu    = document.getElementById("ctxMenu");
  const ctxEmpty   = document.getElementById("ctxMenuEmpty");
  const sheetCtx   = document.getElementById("sheetCtx");
  const toastEl    = document.getElementById("toast");
  const quickGo    = document.getElementById("quickGo");
  const quickInput = document.getElementById("quickGoInput");
  const clockWidget   = document.getElementById("clockWidget");
  const clockTimeEl   = document.getElementById("clockTime");
  const clockDateEl   = document.getElementById("clockDate");
  const weatherWidget = document.getElementById("weatherWidget");
  const weatherIconEl = document.getElementById("weatherIcon");
  const weatherTempEl = document.getElementById("weatherTemp");
  const weatherDescEl = document.getElementById("weatherDesc");
  const weatherCityEl = document.getElementById("weatherCity");

  let state = null;
  let lang = "ru";
  let editingBookmark = null;
  let editingTargetKey = null;
  let ctxCellKey = null;
  let ctxBookmarkId = null;
  let sheetCtxTargetId = null;
  let dragBookmarkId = null;
  let dragFromKey = null;
  let sheetDragId = null;
  let selectedCellKey = null;
  let suppressClick = false;
  let clockTimer = null;
  let weatherTimer = null;
  let _weatherGeoInFlight = false;
  let _weatherHasError = false;
  let _weatherInFlight = false;
  let _weatherGen = 0;

  function tx(key) { return t(key, lang); }

  function applyI18nStatic() {
    document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = tx(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => { el.placeholder = tx(el.dataset.i18nPlaceholder); });
    document.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = tx(el.dataset.i18nTitle); });
    document.documentElement.lang = lang;
    applyPageTitle();
  }

  function applyPageTitle() {
    const custom = state && state.settings && state.settings.pageTitle;
    document.title = (custom && String(custom).trim()) || tx("newTabTitle");
  }

  function pad2(n) { n = String(n); return n.length < 2 ? "0" + n : n; }

  function updateClock() {
    if (!clockTimeEl || !clockDateEl) return;
    const s = state && state.settings;
    if (s && s.showClock === false) {
      clockTimeEl.textContent = "";
      clockDateEl.textContent = "";
      return;
    }
    const d = new Date();
    clockTimeEl.textContent = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    const days   = tx("clockDays");
    const months = tx("clockMonths");
    let dayName = "";
    if (Array.isArray(days) && days[d.getDay()]) dayName = days[d.getDay()];
    let monthName = "";
    if (Array.isArray(months) && months[d.getMonth()]) monthName = months[d.getMonth()];
    clockDateEl.textContent = (dayName ? dayName + ", " : "") + d.getDate() + " " + monthName;
  }

  function startClock() {
    if (clockTimer) clearInterval(clockTimer);
    updateClock();
    clockTimer = setInterval(updateClock, 15 * 1000);
  }

  const WEATHER_ICON_EMOJI = {
    113: "☀️", 116: "⛅️", 119: "☁️", 122: "☁️",
    143: "🌫", 176: "🌦", 179: "🌧", 182: "🌧", 185: "🌧",
    200: "⛈", 227: "🌨", 230: "❄️", 248: "🌫", 260: "🌫",
    263: "🌦", 266: "🌧", 281: "🌧", 284: "🌧", 293: "🌦",
    296: "🌧", 299: "🌧", 302: "🌧", 305: "🌧", 308: "🌧",
    311: "🌧", 314: "🌧", 317: "🌧", 320: "🌨", 323: "🌨",
    326: "🌨", 329: "❄️", 332: "❄️", 335: "❄️", 338: "❄️",
    350: "🌧", 353: "🌦", 356: "🌧", 359: "🌧", 362: "🌦",
    365: "🌧", 368: "🌨", 371: "❄️", 374: "🌧", 377: "🌧",
    386: "⛈", 389: "⛈", 392: "🌨", 395: "❄️"
  };

  // Человеко-понятные описания symbol_code met.no.
  // База — это symbol без суффиксов _day / _night / _polartwilight.
  const SYMBOL_DESC = {
    ru: {
      clearsky:                     "Ясно",
      fair:                         "Преимущественно ясно",
      partlycloudy:                 "Переменная облачность",
      cloudy:                       "Облачно",
      rainshowers:                  "Ливни",
      rainshowersandthunder:        "Гроза с ливнем",
      sleetshowers:                 "Мокрый снег",
      snowshowers:                  "Снегопад",
      rain:                         "Дождь",
      heavyrain:                    "Сильный дождь",
      sleet:                        "Мокрый снег",
      snow:                         "Снег",
      heavysnow:                    "Сильный снегопад",
      fog:                          "Туман",
      lightrain:                    "Небольшой дождь",
      lightsleet:                   "Слабый мокрый снег",
      heavysleet:                   "Сильный мокрый снег",
      lightsnow:                    "Небольшой снег",
      lightfog:                     "Лёгкий туман",
      lightrainshowers:             "Небольшие ливни",
      heavyrainshowers:             "Сильные ливни",
      lightsleetshowers:            "Слабый мокрый снег",
      heavysleetshowers:            "Сильный мокрый снег",
      lightsnowshowers:             "Небольшой снег",
      heavysnowshowers:             "Сильный снег",
      lightrainshowersandthunder:   "Небольшая гроза",
      heavyrainshowersandthunder:   "Сильная гроза",
      lightsleetshowersandthunder:  "Гроза, мокрый снег",
      heavysleetshowersandthunder:  "Сильная гроза с мокрым снегом",
      lightsnowshowersandthunder:   "Гроза со снегом",
      heavysnowshowersandthunder:   "Сильная гроза со снегом",
      rainandthunder:               "Дождь с грозой",
      heavyrainandthunder:          "Сильный дождь с грозой",
      snowandthunder:               "Снег с грозой",
      heavysnowandthunder:          "Сильный снег с грозой"
    },
    en: {
      clearsky:                     "Clear",
      fair:                         "Mostly clear",
      partlycloudy:                 "Partly cloudy",
      cloudy:                       "Cloudy",
      rainshowers:                  "Showers",
      rainshowersandthunder:        "Thunder showers",
      sleetshowers:                 "Sleet showers",
      snowshowers:                  "Snow showers",
      rain:                         "Rain",
      heavyrain:                    "Heavy rain",
      sleet:                        "Sleet",
      snow:                         "Snow",
      heavysnow:                    "Heavy snow",
      fog:                          "Fog",
      lightrain:                    "Light rain",
      lightsleet:                   "Light sleet",
      heavysleet:                   "Heavy sleet",
      lightsnow:                    "Light snow",
      lightfog:                     "Light fog",
      lightrainshowers:             "Light showers",
      heavyrainshowers:             "Heavy showers",
      lightsleetshowers:            "Light sleet showers",
      heavysleetshowers:            "Heavy sleet showers",
      lightsnowshowers:             "Light snow showers",
      heavysnowshowers:             "Heavy snow showers",
      lightrainshowersandthunder:   "Light thunder showers",
      heavyrainshowersandthunder:   "Heavy thunder showers",
      lightsleetshowersandthunder:  "Thunder with sleet",
      heavysleetshowersandthunder:  "Heavy thunder with sleet",
      lightsnowshowersandthunder:   "Thunder with snow",
      heavysnowshowersandthunder:   "Heavy thunder with snow",
      rainandthunder:               "Rain with thunder",
      heavyrainandthunder:          "Heavy rain with thunder",
      snowandthunder:               "Snow with thunder",
      heavysnowandthunder:          "Heavy snow with thunder"
    }
  };
  function describeSymbol(symbol) {
    if (!symbol) return "";
    const base = String(symbol).replace(/_day$|_night$|_polartwilight$/, "");
    const dict = SYMBOL_DESC[lang] || SYMBOL_DESC.ru;
    if (dict[base]) return dict[base];
    // Если базовый ключ не нашёлся, попробуем снять префиксы light/heavy.
    const stripped = base.replace(/^(light|heavy)/, "");
    if (dict[stripped]) return dict[stripped];
    return base;
  }

  function weatherIconFor(code) {
    return WEATHER_ICON_EMOJI[code] || "⛅️";
  }

  function setWeatherText(icon, temp, desc, city) {
    if (weatherIconEl) weatherIconEl.textContent = icon;
    if (weatherTempEl) weatherTempEl.textContent = temp;
    if (weatherDescEl) weatherDescEl.textContent = desc;
    if (weatherCityEl) weatherCityEl.textContent = city;
  }

  function renderWeather() {
    if (!weatherWidget) return;
    const s = state && state.settings;
    if (!s || s.showWeather === false) {
      setWeatherText("", "", "", "");
      return;
    }
    weatherIconEl.className = "weather-icon";
    const cache = state.weatherCache || null;
    if (cache && cache.ok) {
      _weatherHasError = false;
      weatherIconEl.textContent = weatherIconFor(cache.code);
      const temp = (cache.tempC != null) ? (Math.round(cache.tempC) + "°") : "—";
      const desc = cache.desc || "";
      const city = cache.city
        ? (cache.city + (cache.country ? ", " + cache.country : ""))
        : (s.weatherCity || "");
      setWeatherText(weatherIconEl.textContent, temp, desc, city);
      return;
    }
    // Нет валидного кэша — показываем либо загрузку, либо ошибку.
    const cityFallback = s.weatherCity || "";
    if (_weatherHasError) {
      setWeatherText("⚠️", "—", tx("weatherLoadFailed"), cityFallback);
    } else {
      setWeatherText("⏳", "—", tx("weatherLoading"), cityFallback);
    }
  }

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout")), ms);
      promise.then(
        (v) => { clearTimeout(t); resolve(v); },
        (e) => { clearTimeout(t); reject(e); }
      );
    });
  }

  async function geocodeAndSave(city) {
    if (_weatherGeoInFlight) return false;
    _weatherGeoInFlight = true;
    try {
      const resp = await withTimeout(
        ext.runtime.sendMessage({ type: "weatherGeocode", city: city, lang: lang }),
        8000
      );
      const list = (resp && resp.results) || [];
      const r = list[0];
      if (!resp || resp.error || !resp.ok || !r) return false;
      await Storage.update((d) => {
        d.settings.weatherLat = r.lat;
        d.settings.weatherLon = r.lon;
        d.settings.weatherCity = r.name || city;
        d.weatherCache = null;
      });
      state = await Storage.get();
      return true;
    } catch (_) {
      return false;
    } finally {
      _weatherGeoInFlight = false;
    }
  }

  async function refreshWeather() {
    const s0 = state && state.settings;
    if (!s0 || s0.showWeather === false) return;
    const myGen = ++_weatherGen;
    _weatherInFlight = true;
    _weatherHasError = false;
    renderWeather();
    try {
      let s = state && state.settings;
      let lat = Number(s && s.weatherLat);
      let lon = Number(s && s.weatherLon);
      if (!isFinite(lat) || !isFinite(lon)) {
        const city = (s && s.weatherCity || "").trim();
        if (city) {
          const ok = await geocodeAndSave(city);
          if (myGen !== _weatherGen) return;
          if (!ok) {
            _weatherHasError = true;
            renderWeather();
            toast(tx("weatherNoLocation"), true);
            return;
          }
          s = state && state.settings;
          lat = Number(s && s.weatherLat);
          lon = Number(s && s.weatherLon);
        } else {
          _weatherHasError = true;
          renderWeather();
          toast(tx("weatherNoLocation"), true);
          return;
        }
      }
      if (!isFinite(lat) || !isFinite(lon)) {
        _weatherHasError = true;
        renderWeather();
        return;
      }
      const resp = await withTimeout(
        ext.runtime.sendMessage({ type: "weather", lat: lat, lon: lon, lang: lang }),
        8000
      );
      if (myGen !== _weatherGen) return;
      if (!resp || resp.error || !resp.ok) throw new Error(resp && resp.error || "no response");
      const humanDesc = describeSymbol(resp.symbol);
      if (humanDesc) resp.desc = humanDesc;
      const s2 = state && state.settings;
      resp.city = (s2 && s2.weatherCity) || resp.city || "";
      await Storage.update((d) => { d.weatherCache = resp; });
      state = await Storage.get();
      _weatherHasError = false;
    } catch (err) {
      if (myGen !== _weatherGen) return;
      console.warn("[Tabula] weather fetch failed:", err && err.message || err);
      _weatherHasError = true;
      toast(tx("weatherLoadFailed"), true);
    } finally {
      if (myGen === _weatherGen) {
        _weatherInFlight = false;
        renderWeather();
      }
    }
  }

  function startWeather() {
    if (weatherTimer) clearInterval(weatherTimer);
    // Инвалидируем все текущие запросы — старые ответы не должны затирать новые настройки.
    _weatherGen++;
    _weatherInFlight = false;
    _weatherHasError = false;
    renderWeather();
    const minutes = Math.max(5, Number((state && state.settings && state.settings.weatherRefreshMin) || 30));
    const ms = minutes * 60 * 1000;
    weatherTimer = setInterval(refreshWeather, ms);
    // Кэш считается свежим только если у него валидный ok.
    // Иначе виджет зависает в «⏳ Загружаем погоду» до перезапуска.
    const cache = state && state.weatherCache;
    const cacheFresh =
      cache && cache.ok &&
      cache.fetchedAt &&
      (Date.now() - cache.fetchedAt) <= ms;
    if (!cacheFresh) {
      refreshWeather();
    }
  }

  function aggregatorUrl(lat, lon, cityName) {
    // Используем Яндекс.Погоду по координатам, формат вида
    // https://yandex.ru/pogoda/ru?lat=55.75581741&lon=37.61764526
    const hasCoords = isFinite(Number(lat)) && isFinite(Number(lon));
    if (hasCoords) {
      const langPath = (lang === "en") ? "en" : "ru";
      return "https://yandex.ru/pogoda/" + langPath + "?lat=" + encodeURIComponent(String(lat)) + "&lon=" + encodeURIComponent(String(lon));
    }
    const name = (cityName || "").trim();
    if (name) return "https://yandex.ru/pogoda/search?request=" + encodeURIComponent(name);
    return "https://yandex.ru/pogoda";
  }

  function openWeatherAggregator(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const s = state && state.settings;
    const url = aggregatorUrl(s && s.weatherLat, s && s.weatherLon, (s && s.weatherCity) || "");
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function normalizeUrl(u) {
    if (!u) return "#";
    let s = String(u).trim();
    if (!/^https?:\/\//i.test(s) && !s.startsWith("chrome://") && !s.startsWith("file://")) {
      s = "https://" + s;
    }
    return s;
  }

  function faviconUrl(u) {
    try {
      const url = normalizeUrl(u);
      const host = new URL(url).hostname;
      if (!host) return "";
      return "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(host) + "&sz=64";
    } catch (_) {
      return "";
    }
  }

  function cssEscape(v) { return String(v).replace(/"/g, '\\"'); }

  function letterBadge(title) {
    const span = document.createElement("span");
    span.className = "letter";
    span.textContent = (title || "?").trim().charAt(0).toUpperCase();
    return span;
  }

  function activeSheet() {
    if (!state || !Array.isArray(state.sheets) || state.sheets.length === 0) return null;
    return state.sheets.find(s => s.id === state.activeSheetId) || state.sheets[0];
  }

  async function init() {
    state = await Storage.get();
    lang = state.settings.language || "ru";
    applySettings();
    applyLayoutFlags();
    applyI18nStatic();
    renderGrid();
    renderSheetBar();
    applySheetBarHeight();
    bindEvents();
    maybeLoadBingBackground();
    startClock();
    startWeather();

    // Динамический отступ грида от топбара (часы могут менять высоту).
    const tb = document.querySelector(".topbar");
    if (tb && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => applyTopbarHeight());
      ro.observe(tb);
    } else {
      window.addEventListener("resize", applyTopbarHeight);
    }
    const sb = document.querySelector(".sheet-bar");
    if (sb && typeof ResizeObserver !== "undefined") {
      const ro2 = new ResizeObserver(() => applySheetBarHeight());
      ro2.observe(sb);
    }
    requestAnimationFrame(() => { applyTopbarHeight(); applySheetBarHeight(); applyCellScale(); });
    window.addEventListener("resize", applyCellScale);

    Storage.onChanged((next) => {
      if (!next) return;
      const langChanged = (next.settings && next.settings.language) !== lang;
      const prevSettings = state.settings || {};
      const nextSettings = Object.assign({}, prevSettings, next.settings || {});
      state = {
        sheets:        Array.isArray(next.sheets) ? next.sheets : state.sheets,
        activeSheetId: next.activeSheetId || state.activeSheetId,
        settings:      nextSettings,
        bingCache:     next.bingCache !== undefined ? next.bingCache : state.bingCache,
        weatherCache:  next.weatherCache !== undefined ? next.weatherCache : state.weatherCache
      };
      lang = nextSettings.language || "ru";
      applySettings();
      applyLayoutFlags();
      if (langChanged) applyI18nStatic();
      else applyPageTitle();
      renderGrid();
      renderSheetBar();
      refreshSheetCtx();
      startClock();
      // Рестартим погоду только при изменении значимых полей,
      // иначе каждый апдейт weatherCache зацикливает себя.
      const weatherSettingsChanged =
        nextSettings.showWeather   !== prevSettings.showWeather   ||
        nextSettings.weatherLat    !== prevSettings.weatherLat    ||
        nextSettings.weatherLon    !== prevSettings.weatherLon    ||
        nextSettings.weatherCity   !== prevSettings.weatherCity   ||
        nextSettings.weatherRefreshMin !== prevSettings.weatherRefreshMin;
      if (weatherSettingsChanged) {
        startWeather();
      } else {
        renderWeather();
      }
    });
  }

  function applySettings() {
    const s = state.settings;
    const root = document.documentElement.style;
    root.setProperty("--columns",     String(s.defaultColumns));
    root.setProperty("--font-family", resolveFont(s.fontFamilyKey, s.fontFamily));
    // --cell-height (px) рассчитывается в applyCellScale() на основе cellHeight (%)
    // и реального размера окна — чтобы ячейки были пропорциональны окну.
    applyCellScale();
    root.setProperty("--font-size",   s.fontSize + "px");
    root.setProperty("--text-color",  s.textColor);
    root.setProperty("--clock-font",  resolveClockFont(s));
    root.setProperty("--clock-size",  (s.clockSize || 28) + "px");
    root.setProperty("--weather-size", (s.weatherSize || 13) + "px");
    applyBackground();
    requestAnimationFrame(applyTopbarHeight);
  }

  function applyLayoutFlags() {
    const s = state.settings;
    document.body.classList.toggle("no-quick-go", !s.showQuickGo);
    document.body.classList.toggle("no-sheet-bar", !s.showSheetTabs);
    document.body.classList.toggle("no-row-nums", !s.showRowNumbers);
    document.body.classList.toggle("no-col-letters", !s.showColLetters);
    document.body.classList.toggle("no-clock", !s.showClock);
    document.body.classList.toggle("no-weather", !s.showWeather);
    // Виджеты остаются в DOM, чтобы сохранять колонки топбара и не «прыгать» строке поиска.
    // Скрываем только визуально через CSS-класс is-off.
    if (clockWidget)   clockWidget.classList.toggle("is-off",   !s.showClock);
    if (weatherWidget) weatherWidget.classList.toggle("is-off", !s.showWeather);
    applyTopbarHeight();
    applySheetBarHeight();
  }

  function applyTopbarHeight() {
    const tb = document.querySelector(".topbar");
    if (!tb) return;
    const s = state && state.settings;
    const hidden = s && (s.showClock === false && s.showWeather === false && s.showQuickGo === false);
    const h = hidden ? 0 : tb.getBoundingClientRect().height;
    document.documentElement.style.setProperty("--topbar-height", Math.ceil(h) + "px");
  }

  // Пересчитывает --cell-height (px) как
  //   baseHeight = window.innerHeight / 8  (clamp 40..120)
  //   cellHeight = baseHeight * (cellHeight_setting / 100)
  // Запускается при ресайзе окна и при изменении cellHeight в настройках.
  function applyCellScale() {
    const s = state && state.settings;
    if (!s) return;
    const scale = (Number(s.cellHeight) || 100) / 100;
    // Базовая высота пропорциональна размеру окна: на ~600px окне ~75px.
    const base = Math.max(40, Math.min(120, window.innerHeight / 8));
    let px = Math.round(base * scale);
    // Защита: не меньше 28, иначе ячейки схлопнутся.
    if (px < 28) px = 28;
    document.documentElement.style.setProperty("--cell-height", px + "px");
  }

  // Обновляет --sheet-bar-height по реальной высоте sheet-bar.
  // Нужно, потому что вкладки теперь переносятся на новую строку и бар растёт.
  function applySheetBarHeight() {
    const bar = document.querySelector(".sheet-bar");
    if (!bar) return;
    const s = state && state.settings;
    if (!s || s.showSheetTabs === false) {
      document.documentElement.style.setProperty("--sheet-bar-height", "0px");
      return;
    }
    const h = bar.getBoundingClientRect().height;
    document.documentElement.style.setProperty("--sheet-bar-height", Math.ceil(h) + "px");
  }

  function applyBackground() {
    const s = state.settings;
    if (s.backgroundType === "bing") {
      const cached = state.bingCache;
      if (cached && cached.url && cached.date === todayKey()) {
        bgEl.style.background = `url("${cssEscape(cached.url)}") center / cover no-repeat, ${s.backgroundColor}`;
      } else {
        bgEl.style.background = s.backgroundColor;
      }
    } else if ((s.backgroundType === "imageUrl" || s.backgroundType === "imageUpload") && s.backgroundImage) {
      bgEl.style.background = `url("${cssEscape(s.backgroundImage)}") center / cover no-repeat, ${s.backgroundColor}`;
    } else if (s.backgroundType === "gradient") {
      bgEl.style.background = `${s.backgroundGradient}, ${s.backgroundColor}`;
    } else {
      bgEl.style.background = s.backgroundColor;
    }
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  async function maybeLoadBingBackground() {
    const s = state.settings;
    if (s.backgroundType !== "bing") return;
    const cached = state.bingCache;
    if (cached && cached.url && cached.date === todayKey()) { applyBackground(); return; }
    try {
      toast(tx("bingLoading"));
      const resp = await ext.runtime.sendMessage({ type: "bingDaily", mkt: s.bingMkt || "ru-RU" });
      if (!resp || resp.error || !resp.url) throw new Error(resp && resp.error || "no url");
      await Storage.update((d) => {
        d.bingCache = { date: todayKey(), url: resp.url, copyright: resp.copyright || "" };
      });
      state = await Storage.get();
      applyBackground();
    } catch (err) {
      console.warn("Bing fetch failed:", err);
      toast(tx("bingFailed"), true);
    }
  }

  function renderGrid() {
    selectedCellKey = null;
    gridEl.innerHTML = "";
    const sh = activeSheet();
    if (!sh) return;

    const cols = clampCols(state.settings.defaultColumns);
    const rows = computeFillRows(sh);
    const showCol = !!state.settings.showColLetters;
    const showRow = !!state.settings.showRowNumbers;

    gridEl.classList.toggle("has-col-letters", showCol);
    gridEl.classList.toggle("has-row-nums",    showRow);
    gridEl.classList.toggle("show-grid",       !!state.settings.showGrid);

    if (showCol) {
      const headerRow = document.createElement("div");
      headerRow.className = "grid-row header";
      const corner = document.createElement("div");
      corner.className = "corner";
      headerRow.appendChild(corner);
      for (let c = 0; c < cols; c++) {
        const letter = document.createElement("div");
        letter.className = "col-letter";
        letter.textContent = colLetter(c);
        headerRow.appendChild(letter);
      }
      gridEl.appendChild(headerRow);
    }

    for (let r = 0; r < rows; r++) {
      const rowEl = document.createElement("div");
      const isLast = (r === rows - 1);
      rowEl.className = "grid-row" + (isLast ? " fill" : "");
      if (showRow) {
        const rnum = document.createElement("div");
        rnum.className = "row-num";
        rnum.textContent = String(r + 1);
        rowEl.appendChild(rnum);
      }
      for (let c = 0; c < cols; c++) {
        const key = r + "," + c;
        const bm = sh.cells[key];
        rowEl.appendChild(createCellEl(key, bm));
      }
      gridEl.appendChild(rowEl);
    }
  }

  function computeFillRows(sheet) {
    // Грид растягивается на всю доступную высоту (flex: 1 1 0 у каждой строки),
    // поэтому нам нужно лишь столько строк, сколько нужно для контента
    // + минимальный запас, чтобы сетка не схлопывалась на маленьком окне.
    const contentRows = computeRowsForSheet(sheet, 0);
    return Math.max(contentRows, 6);
  }

  function createCellEl(key, bm) {
    const cell = document.createElement("div");
    cell.className = "cell " + (bm ? "filled" : "empty");
    cell.dataset.key = key;
    if (bm) {
      cell.dataset.id = bm.id;
      cell.draggable = true;
      cell.title = bm.title + "\n" + bm.url;
      const fav = document.createElement("span");
      fav.className = "favicon";
      if (state.settings.showFavicon) {
        const img = document.createElement("img");
        img.alt = "";
        img.draggable = false;
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        const src = faviconUrl(bm.url);
        if (src) {
          img.src = src;
          img.onerror = () => { fav.replaceChildren(letterBadge(bm.title)); };
          fav.appendChild(img);
        } else {
          fav.appendChild(letterBadge(bm.title));
        }
      } else {
        fav.appendChild(letterBadge(bm.title));
      }
      const title = document.createElement("span");
      title.className = "title-text";
      title.textContent = bm.title;
      cell.append(fav, title);
    }
    return cell;
  }

  function clearSheetDragStyles() {
    if (!sheetTabsEl) return;
    sheetTabsEl.querySelectorAll(".sheet-tab").forEach(el => {
      el.style.opacity = "";
      el.classList.remove("sheet-drop-target");
    });
  }

  const _justAddedIds = new Set();
  function renderSheetBar() {
    sheetTabsEl.innerHTML = "";
    for (const sh of state.sheets) {
      const tab = document.createElement("div");
      tab.className = "sheet-tab" + (sh.id === state.activeSheetId ? " active" : "");
      tab.dataset.id = sh.id;
      tab.draggable = true;
      if (_justAddedIds.has(sh.id)) {
        tab.classList.add("newly-added");
        tab.addEventListener("animationend", () => tab.classList.remove("newly-added"), { once: true });
      }
      const iconEl = document.createElement("span");
      iconEl.className = "sheet-icon";
      iconEl.textContent = sh.icon || "";
      iconEl.title = tx("sheetIcon");
      iconEl.addEventListener("dblclick", (e) => {
        if (tab.querySelector("input.sheet-name-input")) return;
        e.stopPropagation();
        beginRenameIcon(tab, sh);
      });
      const nameEl = document.createElement("span");
      nameEl.className = "name";
      nameEl.textContent = sh.name;
      tab.append(iconEl, nameEl);

      tab.addEventListener("click", (e) => {
        if (tab.querySelector("input.sheet-name-input")) return;
        if (sh.id !== state.activeSheetId) switchSheet(sh.id);
      });
      tab.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        beginRenameSheet(tab, sh);
      });
      tab.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        sheetCtxTargetId = sh.id;
        refreshSheetCtx();
        positionMenu(sheetCtx, e.clientX, e.clientY);
        sheetCtx.hidden = false;
      });

      // Sheet drag-and-drop reorder
      tab.addEventListener("dragstart", (e) => {
        if (tab.querySelector("input.sheet-name-input")) { e.preventDefault(); return; }
        e.stopPropagation();
        sheetDragId = sh.id;
        try {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/sheet", sh.id);
          e.dataTransfer.setData("text/plain",  sh.id);
        } catch (_) {}
        tab.style.opacity = "0.4";
      });
      tab.addEventListener("dragover", (e) => {
        if (sheetDragId && sheetDragId !== sh.id) {
          e.preventDefault();
          try { e.dataTransfer.dropEffect = "move"; } catch (_) {}
          tab.classList.add("sheet-drop-target");
        }
      });
      tab.addEventListener("dragleave", () => {
        tab.classList.remove("sheet-drop-target");
      });
      tab.addEventListener("drop", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        tab.classList.remove("sheet-drop-target");
        tab.style.opacity = "";
        const fromId = sheetDragId || e.dataTransfer.getData("text/sheet") || e.dataTransfer.getData("text/plain");
        sheetDragId = null;
        clearSheetDragStyles();
        if (!fromId || fromId === sh.id) return;
        await Storage.update((d) => {
          const fromIdx = d.sheets.findIndex(s => s.id === fromId);
          const toIdx   = d.sheets.findIndex(s => s.id === sh.id);
          if (fromIdx < 0 || toIdx < 0) return;
          const moved = d.sheets.splice(fromIdx, 1)[0];
          const insertAt = (fromIdx < toIdx) ? (toIdx - 1) : toIdx;
          d.sheets.splice(insertAt, 0, moved);
        });
        state = await Storage.get();
        renderSheetBar();
        renderGrid();
        updateSheetScrollArrows();
      });
      tab.addEventListener("dragend", () => {
        sheetDragId = null;
        clearSheetDragStyles();
      });

      sheetTabsEl.appendChild(tab);
    }
    refreshSheetCtx();
    updateSheetScrollArrows();
  }

  function refreshSheetCtx() {
    // No per-sheet columns any more — column count is global (settings.defaultColumns).
  }

  function updateSheetScrollArrows() {
    if (!sheetTabsEl || !sheetScrollLeft || !sheetScrollRight) return;
    const max = sheetTabsEl.scrollWidth - sheetTabsEl.clientWidth;
    sheetScrollLeft.disabled  = sheetTabsEl.scrollLeft <= 1;
    sheetScrollRight.disabled = sheetTabsEl.scrollLeft >= max - 1;
  }

  async function switchSheet(id) {
    await Storage.update((d) => { d.activeSheetId = id; });
    state = await Storage.get();
    renderSheetBar();
    renderGrid();
    if (sheetTabsEl) {
      const tabEl = sheetTabsEl.querySelector('.sheet-tab[data-id="' + id + '"]');
      if (tabEl && tabEl.scrollIntoView) tabEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
    updateSheetScrollArrows();
  }

  async function addSheetPrompt() {
    const name = prompt(tx("promptSheetName"), tx("newSheetDefault"));
    if (name == null) return;
    const trimmed = String(name).trim();
    if (!trimmed) return;
    if (state.sheets.some(s => s.name === trimmed)) { toast(tx("sheetExists"), true); return; }
    const icon = randomSheetIcon();
    const cols = clampCols(state.settings.defaultColumns || 8);
    const newSheet = { id: cryptoId(), name: trimmed, icon: icon, columns: cols, cells: {} };
    await Storage.update((d) => {
      d.sheets.push(newSheet);
      d.activeSheetId = newSheet.id;
    });
    state = await Storage.get();
    // remember the new sheet id so its tab plays entrance animation only this once
    _justAddedIds.add(newSheet.id);
    setTimeout(() => _justAddedIds.delete(newSheet.id), 800);
    renderSheetBar(); renderGrid();
    if (sheetTabsEl) sheetTabsEl.scrollLeft = sheetTabsEl.scrollWidth;
    toast(tx("sheetAdded"));
  }

  async function deleteSheet(sh) {
    if (state.sheets.length <= 1) { toast(tx("needOneSheet"), true); return; }
    const count = Object.keys(sh.cells || {}).length;
    if (count > 0 && !confirm(tx("confirmDeleteSheet")(count))) return;
    await Storage.update((d) => {
      d.sheets = d.sheets.filter(s => s.id !== sh.id);
      if (d.activeSheetId === sh.id) d.activeSheetId = d.sheets[0].id;
    });
    state = await Storage.get();
    renderSheetBar(); renderGrid();
    toast(tx("removed"));
  }

  function beginRenameIcon(tabEl, sheet) {
    if (tabEl.querySelector("input.sheet-icon-input")) return;
    const iconEl = tabEl.querySelector(".sheet-icon");
    if (!iconEl) return;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "sheet-icon-input";
    input.value = sheet.icon || "";
    input.maxLength = 4;
    iconEl.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    const finish = async (commit) => {
      if (done) return;
      done = true;
      const newIcon = (input.value || "").trim() || (sheet.icon || "");
      // restore span first
      const restored = document.createElement("span");
      restored.className = "sheet-icon";
      restored.textContent = sheet.icon || "";
      restored.title = tx("sheetIcon");
      restored.addEventListener("dblclick", (e) => {
        if (tabEl.querySelector("input.sheet-name-input")) return;
        e.stopPropagation();
        beginRenameIcon(tabEl, sheet);
      });
      input.replaceWith(restored);
      if (!commit || newIcon === (sheet.icon || "")) return;
      await Storage.update((d) => {
        const s = d.sheets.find(x => x.id === sheet.id);
        if (s) s.icon = newIcon;
      });
      state = await Storage.get();
      renderSheetBar();
      toast(tx("renamed"));
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      else if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
    input.addEventListener("blur", () => finish(true));
  }

  function beginRenameSheet(tabEl, sheet) {
    if (tabEl.querySelector("input.sheet-name-input")) return;
    const nameEl = tabEl.querySelector(".name");
    if (!nameEl) return;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "sheet-name-input";
    input.value = sheet.name;
    input.maxLength = 40;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    const finish = async (commit) => {
      if (done) return;
      done = true;
      const newName = (input.value || "").trim() || sheet.name;
      input.replaceWith(nameEl);
      if (!commit || newName === sheet.name) { nameEl.textContent = sheet.name; return; }
      if (state.sheets.some(s => s.id !== sheet.id && s.name === newName)) {
        toast(tx("sheetExists"), true);
        nameEl.textContent = sheet.name;
        return;
      }
      await Storage.update((d) => {
        const s = d.sheets.find(x => x.id === sheet.id);
        if (s) s.name = newName;
      });
      state = await Storage.get();
      renderSheetBar();
      toast(tx("renamed"));
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter")      { e.preventDefault(); finish(true); }
      else if (e.key === "Escape"){ e.preventDefault(); finish(false); }
    });
    input.addEventListener("blur", () => finish(true));
  }

  function bindEvents() {
    document.getElementById("optsBtn").addEventListener("click", () => {
      if (ext.runtime.openOptionsPage) ext.runtime.openOptionsPage();
      else window.open("options.html", "_blank");
    });
    document.getElementById("cancelBtn").addEventListener("click", closeModal);
    tabForm.addEventListener("submit", onSubmitBookmark);
    quickGo.addEventListener("submit", onQuickGo);

    if (weatherWidget) {
      weatherWidget.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openWeatherAggregator(e);
      });
      weatherWidget.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          openWeatherAggregator(e);
        }
      });
    }

    // Close modal on click outside the card
    modalEl.addEventListener("mousedown", (e) => {
      if (e.target === modalEl) closeModal();
    });

    addSheetBtn.addEventListener("click", addSheetPrompt);

    if (sheetScrollLeft) {
      sheetScrollLeft.addEventListener("click", () => {
        if (sheetTabsEl) sheetTabsEl.scrollBy({ left: -240, behavior: "smooth" });
      });
    }
    if (sheetScrollRight) {
      sheetScrollRight.addEventListener("click", () => {
        if (sheetTabsEl) sheetTabsEl.scrollBy({ left:  240, behavior: "smooth" });
      });
    }

    if (sheetTabsEl) {
      sheetTabsEl.addEventListener("scroll", updateSheetScrollArrows, { passive: true });
      window.addEventListener("resize", () => {
        updateSheetScrollArrows();
        applySheetBarHeight();
      });
    }
    // Горизонтальный скролл листов по колесу мыши над sheet-bar.
    if (sheetBar && sheetTabsEl) {
      sheetBar.addEventListener("wheel", (e) => {
        // Не перехватываем, когда пользователь крутит колесо над инпутом (переименование листа).
        if (e.target && e.target.closest && e.target.closest("input")) return;
        // Не перехватываем горизонтальный жест трекпада.
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        e.preventDefault();
        sheetTabsEl.scrollBy({ left: e.deltaY, behavior: "auto" });
      }, { passive: false });
    }

    // Click on a cell: open bookmark if filled, do nothing if empty (use context menu)
    gridEl.addEventListener("click", onCellClick);
    gridEl.addEventListener("auxclick", onCellAuxClick);
    gridEl.addEventListener("contextmenu", onCellContextMenu);
    gridEl.addEventListener("dragstart", onCellDragStart);
    gridEl.addEventListener("dragover",  onCellDragOver);
    gridEl.addEventListener("dragleave", onCellDragLeave);
    gridEl.addEventListener("drop",      onCellDrop);
    gridEl.addEventListener("dragend",   onCellDragEnd);

    ctxMenu.addEventListener("click", onCtxAction);
    ctxEmpty.addEventListener("click", onCtxEmptyAction);
    sheetCtx.addEventListener("click", onSheetCtxAction);

    gridEl.addEventListener("contextmenu", (e) => {
      if (!e.target.closest(".cell")) e.preventDefault();
    });

    document.addEventListener("mousedown", (e) => {
      if (!modalEl.hidden) return; // don't interfere with the open modal
      if (!ctxMenu.hidden && !ctxMenu.contains(e.target)) hideCtx();
      if (!ctxEmpty.hidden && !ctxEmpty.contains(e.target)) hideCtxEmpty();
      if (!sheetCtx.hidden && !sheetCtx.contains(e.target)) hideSheetCtx();
      if (!e.target.closest(".cell") && !e.target.closest(".ctx-menu") && !e.target.closest(".modal")) {
        selectCell(null);
      }
    });
    document.addEventListener("scroll", () => {
      hideCtx(); hideCtxEmpty(); hideSheetCtx();
    }, true);

    document.addEventListener("keydown", (e) => {
      if (!modalEl.hidden) { if (e.key === "Escape") closeModal(); return; }
      if (e.key === "Escape") {
        hideCtx(); hideCtxEmpty(); hideSheetCtx();
        if (document.activeElement === quickInput) quickInput.blur();
        return;
      }
      if (document.activeElement === quickInput) {
        if (e.key === "Escape") quickInput.blur();
        return;
      }
      if (e.key === "/" && document.activeElement.tagName !== "INPUT") {
        e.preventDefault(); quickInput.focus(); quickInput.select();
      }
    });

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderGrid, 80);
    });
  }

  function selectCell(key) {
    selectedCellKey = key;
    gridEl.querySelectorAll(".cell.selected").forEach(el => el.classList.remove("selected"));
    if (key) {
      const el = gridEl.querySelector('.cell[data-key="' + cssAttr(key) + '"]');
      if (el) el.classList.add("selected");
    }
  }

  function cssAttr(v) { return String(v).replace(/"/g, '\\"'); }

  function onCellClick(e) {
    if (suppressClick) { suppressClick = false; return; }
    const cell = e.target.closest(".cell");
    if (!cell) return;
    e.preventDefault();
    e.stopPropagation();
    const key = cell.dataset.key;
    if (!key) return;
    selectCell(key);
    const bm = cell.classList.contains("filled") ? currentBookmarkAt(key) : null;
    if (!bm) return; // empty cells: only via context menu
    const target = normalizeUrl(bm.url);
    if (state.settings.openInNewTab) window.open(target, "_blank", "noopener");
    else window.location.href = target;
  }

  function onCellAuxClick(e) {
    // СКМ по заполненной ячейке: открыть в новой вкладке всегда (независимо от openInNewTab).
    if (e.button !== 1) return;
    const cell = e.target.closest(".cell");
    if (!cell) return;
    e.preventDefault();
    e.stopPropagation();
    // Подавляем последующий обычный click, чтобы не открыть ссылку повторно.
    suppressClick = true;
    const bm = cell.classList.contains("filled") ? currentBookmarkAt(cell.dataset.key) : null;
    if (!bm) return;
    const target = normalizeUrl(bm.url);
    window.open(target, "_blank", "noopener");
  }

  function currentBookmarkAt(key) {
    const sh = activeSheet();
    return sh && sh.cells ? sh.cells[key] : null;
  }

  function onCellContextMenu(e) {
    const cell = e.target.closest(".cell");
    if (!cell) return;
    e.preventDefault();
    e.stopPropagation();
    hideCtx(); hideCtxEmpty();
    const key = cell.dataset.key;
    if (!key) return;
    selectCell(key);
    const bm = cell.classList.contains("filled") ? currentBookmarkAt(key) : null;

    if (bm) {
      ctxBookmarkId = bm.id;
      ctxCellKey = key;
      positionMenu(ctxMenu, e.clientX, e.clientY);
      ctxMenu.hidden = false;
    } else {
      ctxBookmarkId = null;
      ctxCellKey = key;
      positionMenu(ctxEmpty, e.clientX, e.clientY);
      ctxEmpty.hidden = false;
    }
  }

  function positionMenu(menu, x, y) {
    menu.style.left = "0px"; menu.style.top = "0px";
    menu.hidden = false;
    const r = menu.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth  - r.width  - 4);
    const top  = Math.min(y, window.innerHeight - r.height - 4);
    menu.style.left = Math.max(0, left) + "px";
    menu.style.top  = Math.max(0, top)  + "px";
  }
  function hideCtx()       { ctxMenu.hidden = true;    ctxBookmarkId = null; ctxCellKey = null; }
  function hideCtxEmpty()  { ctxEmpty.hidden = true;   ctxCellKey = null; }
  function hideSheetCtx()  { sheetCtx.hidden = true;   sheetCtxTargetId = null; }

  async function onCtxAction(e) {
    const li = e.target.closest('li[data-act]');
    if (!li || !ctxMenu.contains(li)) return;
    const act = li.dataset.act;
    const id = ctxBookmarkId;
    const key = ctxCellKey;
    hideCtx();
    if (!id || !act || !key) return;
    const sh = activeSheet();
    if (!sh) return;
    const bm = sh.cells[key];
    if (!bm || bm.id !== id) return;

    switch (act) {
      case "open":
        window.location.href = normalizeUrl(bm.url);
        break;
      case "open-new":
        window.open(normalizeUrl(bm.url), "_blank", "noopener");
        break;
      case "edit":
        openEditModal(bm, key);
        break;
      case "duplicate": {
        const newKey = nextEmptyAfter(sh, key);
        const dupTitle = bm.title + " (" + tx("duplicate").toLowerCase() + ")";
        await Storage.update((d) => {
          const cur = d.sheets.find(s => s.id === d.activeSheetId);
          if (cur && newKey) cur.cells[newKey] = { id: cryptoId(), title: dupTitle, url: bm.url };
        });
        state = await Storage.get(); renderGrid();
        toast(tx("duplicated"));
        break;
      }
      case "delete":
        await Storage.update((d) => {
          const cur = d.sheets.find(s => s.id === d.activeSheetId);
          if (cur) delete cur.cells[key];
        });
        state = await Storage.get(); renderGrid();
        toast(tx("deleted"));
        break;
    }
  }

  function onCtxEmptyAction(e) {
    const li = e.target.closest('li[data-act]');
    if (!li || !ctxEmpty.contains(li)) return;
    const act = li.dataset.act;
    const key = ctxCellKey;
    hideCtxEmpty();
    if (act === "add" && key) openAddModal(key);
  }

  async function onSheetCtxAction(e) {
    const li = e.target.closest('li[data-act]');
    if (!li || !sheetCtx.contains(li)) return;
    const act = li.dataset.act;
    const id = sheetCtxTargetId;
    hideSheetCtx();
    if (!id || !act) return;
    const sh = state.sheets.find(s => s.id === id);
    if (!sh) return;

    if (act === "rename") {
      const tabEl = sheetTabsEl.querySelector('.sheet-tab[data-id="' + id + '"]');
      if (tabEl) beginRenameSheet(tabEl, sh);
    } else if (act === "delete") {
      deleteSheet(sh);
    } else if (act === "icon") {
      const tabEl = sheetTabsEl.querySelector('.sheet-tab[data-id="' + id + '"]');
      if (tabEl) beginRenameIcon(tabEl, sh);
    }
  }
  const SHEET_ICON_PALETTE = ["📋","🏠","💼","📰","📚","🎵","🎬","🛒","💡","⚙️","🚀","📷","🎮","✉️","📊","🔥","⭐","❤️","🌐","🧠","📁","📅","📞","🛠","💬","🧩"];
  function randomSheetIcon() {
    return SHEET_ICON_PALETTE[Math.floor(Math.random() * SHEET_ICON_PALETTE.length)];
  }


  function nextEmptyAfter(sh, key) {
    const parts = key.split(",");
    const r = parseInt(parts[0], 10) || 0;
    const c = parseInt(parts[1], 10) || 0;
    const cols = clampCols(state.settings.defaultColumns);
    for (let dr = 0; dr < 100; dr++) {
      for (let dc = 0; dc < cols; dc++) {
        const rr = r + dr;
        const cc = (dr === 0 ? c + 1 : 0) + dc;
        if (cc >= cols) continue;
        const k = rr + "," + cc;
        if (!sh.cells[k]) return k;
      }
    }
    return null;
  }

  async function onAddBookmarkTop() {
    const sh = activeSheet();
    if (!sh) return;
    const key = findFirstEmptyCell(sh, 12, clampCols(state.settings.defaultColumns)) || "0,0";
    openAddModal(key);
  }

  function resolveDrag(e) {
    if (dragBookmarkId && dragFromKey) return { id: dragBookmarkId, from: dragFromKey };
    try {
      const raw = e.dataTransfer && e.dataTransfer.getData("text/plain");
      if (!raw) return null;
      const sh = activeSheet();
      if (!sh) return null;
      let from = null;
      for (const k of Object.keys(sh.cells || {})) {
        if (sh.cells[k] && sh.cells[k].id === raw) { from = k; break; }
      }
      if (!from) return null;
      dragBookmarkId = raw;
      dragFromKey = from;
      return { id: raw, from };
    } catch (_) { return null; }
  }

  function onCellDragStart(e) {
    const cell = e.target.closest(".cell");
    if (!cell || !cell.classList.contains("filled")) return;
    const key = cell.dataset.key;
    const sh = activeSheet();
    if (!sh || !sh.cells[key]) return;
    dragBookmarkId = sh.cells[key].id;
    dragFromKey = key;
    cell.classList.add("dragging");
    try {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(dragBookmarkId));
    } catch (_) {}
  }
  function onCellDragOver(e) {
    const cell = e.target.closest(".cell");
    if (!cell) return;
    const drag = resolveDrag(e);
    if (!drag) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = "move"; } catch (_) {}
    gridEl.querySelectorAll(".cell.drop-target, .cell.drop-swap").forEach(el => {
      el.classList.remove("drop-target", "drop-swap");
    });
    if (cell.dataset.key === drag.from) return;
    if (cell.classList.contains("filled")) cell.classList.add("drop-swap");
    else cell.classList.add("drop-target");
  }
  function onCellDragLeave(e) {
    const cell = e.target.closest(".cell");
    if (cell) cell.classList.remove("drop-target", "drop-swap");
  }
  async function onCellDrop(e) {
    const cell = e.target.closest(".cell");
    if (!cell) return;
    e.preventDefault();
    const drag = resolveDrag(e);
    if (!drag) return;
    const targetKey = cell.dataset.key;
    if (!targetKey || targetKey === drag.from) return;

    const willSwap = !!currentBookmarkAt(targetKey);
    await Storage.update((d) => {
      const cur = d.sheets.find(s => s.id === d.activeSheetId);
      if (!cur) return;
      const moving = cur.cells[drag.from];
      if (!moving) return;
      if (cur.cells[targetKey]) {
        const tmp = cur.cells[targetKey];
        cur.cells[drag.from] = tmp;
        cur.cells[targetKey] = moving;
      } else {
        delete cur.cells[drag.from];
        cur.cells[targetKey] = moving;
      }
    });
    state = await Storage.get(); renderGrid();
    toast(willSwap ? tx("swapped") : tx("moved"));
  }
  function onCellDragEnd(e) {
    dragBookmarkId = null;
    dragFromKey = null;
    gridEl.querySelectorAll(".cell.dragging, .cell.drop-target, .cell.drop-swap")
          .forEach(el => el.classList.remove("dragging", "drop-target", "drop-swap"));
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 50);
  }

  function openAddModal(key) {
    editingBookmark = null;
    editingTargetKey = key || null;
    modalTitle.textContent = tx("modalAdd");
    tabForm.elements.title.value = "";
    tabForm.elements.url.value   = "";
    modalEl.hidden = false;
    // restart modal animation
    const card = modalEl.querySelector(".modal-card");
    if (card) { card.style.animation = "none"; void card.offsetWidth; card.style.animation = ""; }
    // Defer focus to next tick so the modal can paint first.
    setTimeout(() => {
      try { tabForm.elements.title.focus({ preventScroll: true }); } catch (_) {}
      try { tabForm.elements.title.select(); } catch (_) {}
    }, 0);
  }
  function openEditModal(bm, key) {
    editingBookmark = { id: bm.id, key };
    editingTargetKey = key;
    modalTitle.textContent = tx("modalEdit");
    tabForm.elements.title.value = bm.title || "";
    tabForm.elements.url.value   = bm.url   || "";
    modalEl.hidden = false;
    const card = modalEl.querySelector(".modal-card");
    if (card) { card.style.animation = "none"; void card.offsetWidth; card.style.animation = ""; }
    setTimeout(() => {
      try { tabForm.elements.title.focus({ preventScroll: true }); } catch (_) {}
      try { tabForm.elements.title.select(); } catch (_) {}
    }, 0);
  }
  function closeModal() {
    modalEl.hidden = true;
    editingBookmark = null;
    editingTargetKey = null;
  }

  async function onSubmitBookmark(e) {
    e.preventDefault();
    if (!tabForm) return;
    const titleEl = tabForm.elements.title;
    const urlEl   = tabForm.elements.url;
    if (!titleEl || !urlEl) return;
    const title = (titleEl.value || "").trim();
    const url   = (urlEl.value   || "").trim();
    if (!title || !url) return;

    await Storage.update((d) => {
      const cur = d.sheets.find(s => s.id === d.activeSheetId);
      if (!cur) return;
      if (editingBookmark) {
        const x = cur.cells[editingBookmark.key];
        if (x && x.id === editingBookmark.id) {
          x.title = title;
          x.url   = url;
        }
      } else {
        const k = editingTargetKey || findFirstEmptyCell(cur, 12, clampCols(state.settings.defaultColumns)) || "0,0";
        cur.cells[k] = { id: cryptoId(), title, url };
      }
    });
    state = await Storage.get();
    renderGrid();
    closeModal();
    toast(editingBookmark ? tx("saved") : tx("added"));
  }

  function onQuickGo(e) {
    e.preventDefault();
    const v = quickInput.value.trim();
    if (!v) return;
    let target;
    if (/^https?:\/\//i.test(v) || (/\.[a-z]{2,}/i.test(v) && !v.includes(" "))) {
      target = normalizeUrl(v);
    } else {
      target = "https://www.google.com/search?q=" + encodeURIComponent(v);
    }
    window.location.href = target;
  }

  let toastTimer;
  function toast(msg, isErr) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.classList.remove("fade");
    toastEl.style.borderColor = isErr ? "rgba(255,90,90,0.5)" : "";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.add("fade");
      setTimeout(() => { toastEl.hidden = true; }, 220);
    }, 1800);
  }

  init().catch(err => {
    console.error("Tabula init failed:", err);
    document.body.innerHTML = "<pre style='padding:20px;color:#f88'>" +
      "Tabula failed to initialize.\n\n" + (err && err.message || err) + "</pre>";
  });
})();
