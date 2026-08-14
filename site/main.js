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

/* Tabula landing page — fetch the latest GitHub release, wire up the
   download buttons, run the live mock clock and provide a ru/en
   language switch. If the API is unreachable, the buttons keep their
   default link to the "latest release" page. */

(function () {
"use strict";

/* ---------- i18n dictionaries ---------- */
var I18N = {
  ru: {
    metaTitle: "Tabula — новая вкладка как электронная таблица",
    metaDesc: "Tabula — бесплатное расширение для браузера: новая вкладка в виде электронной таблицы с листами, темами, фоном, часами и погодой. Без телеметрии, всё хранится локально.",
    metaOgDesc: "Закладки в виде сетки Excel: листы, темы, фон, часы и погода. Локально и без телеметрии.",
    navLabel: "Основное меню",
    navFeatures: "Возможности",
    navInstall: "Установка",
    heroTitle: "Новая вкладка —<br>как электронная таблица",
    heroSubtitle: "Раскладывайте закладки по ячейкам сетки, как в Excel: листы, темы, фон, часы и погода. Всё хранится локально, без телеметрии и подписок.",
    versionLoading: "Ищем последний релиз…",
    releasesLink: "Все релизы на GitHub →",
    mockSearch: "🔍&nbsp; Поиск или введите URL",
    mockWeather: "<b>21°</b>&nbsp; Облачно",
    mockCity: "Нижний Новгород",
    mockCell_vk: { fav: "В", title: "ВКонтакте" },
    mockCell_yandex: { fav: "Я", title: "Яндекс" },
    mockCell_news: { fav: "Н", title: "Новости" },
    mockCell_music: { fav: "М", title: "Музыка" },
    mockCell_kinopoisk: { fav: "К", title: "Кинопоиск" },
    mockCell_twitter: { fav: "Т", title: "Твиттер" },
    mockTabHome: "📋 Главная",
    mockTabWork: "💼 Работа",
    mockTabGames: "🎮 Игры",
    mockTabMusic: "🎵 Музыка",
    featuresTitle: "Возможности",
    f1Title: "Листы как в Excel",
    f1Text: "Несколько листов-вкладок с emoji-иконками, перетаскиванием для смены порядка и своим числом колонок (3–12).",
    f2Title: "Сетка ячеек",
    f2Text: "Каждая ячейка — одна закладка. Перетаскивайте их, меняйте местами, открывайте в новой вкладке и редактируйте правым кликом.",
    f3Title: "Оформление",
    f3Text: "Цветовая палитра, шрифты, CSS-градиент, своя картинка или Bing-обои дня — всё настраивается в один клик.",
    f4Title: "Часы и погода",
    f4Text: "Крупные часы и виджет погоды (данные — открытый сервис met.no). Настраиваются шрифт, размер и период обновления.",
    f5Title: "Быстрый поиск",
    f5Text: "Строка быстрого перехода с подсказками и выбором поисковой системы: Google, Яндекс или Bing.",
    f6Title: "Приватность",
    f6Text: "Никакой телеметрии и облаков: все данные живут локально в вашем браузере и никуда не отправляются.",
    installTitle: "Установка",
    installChromeGet: "Скачайте архив <b>Chrome</b> с кнопки выше.",
    installUnpack: "Распакуйте его в любую папку.",
    installChromeExt: "Откройте <code>chrome://extensions</code> и включите «Режим разработчика».",
    installChromeLoad: "Нажмите «Загрузить распакованное расширение» и выберите папку.",
    installFfDynamicHint: "Инструкция ниже подстраивается под файл, на который ведёт кнопка скачивания.",
    installFfSignedTitle: "Подписанная версия (.xpi)",
    installFfSigned1: "Скачайте файл <code>.xpi</code> с кнопки выше.",
    installFfSigned2: "Откройте скачанный файл — Firefox предложит добавить дополнение.",
    installFfSigned3: "Нажмите «Добавить» и подтвердите установку.",
    installFfSignedNote: "Подписанная версия обновляется автоматически.",
    installFfUnsignedTitle: "Неподписанная версия (-unsign.xpi)",
    installFfUnsigned1: "Скачайте файл <code>.xpi</code> с кнопки выше.",
    installFfUnsigned2: "Откройте <code>about:debugging#/runtime/this-firefox</code>.",
    installFfUnsigned3: "Нажмите «Загрузить временное дополнение…» и выберите скачанный <code>.xpi</code>.",
    installFfUnsigned4: "Дополнение действует только в текущем сеансе — после перезапуска Firefox загрузите его снова.",
    installFfUnsignedNote: "Неподписанная версия не обновляется автоматически.",
    installHint: "Если другое расширение уже переопределяет новую вкладку, отключите его — браузер использует только одно такое расширение одновременно.",
    installYandexTitle: "Яндекс Браузер",
    btnOsYandex: "Яндекс Браузер · из панели",
    installYandexHint: "Яндекс Браузер не переопределяет страницу новой вкладки, поэтому расширение запускается кликом по иконке из панели расширений.",
    installYandex1: "Скачайте архив <b>Yandex</b> с кнопки выше.",
    installYandex3: "Откройте <code>browser://extensions</code> и включите «Режим разработчика» (внизу страницы).",
    installYandex4: "Нажмите «Загрузить расширение» и выберите распакованную папку.",
    installYandex5: "Закрепите иконку Tabula в панели расширений (через меню «Показать на панели»), чтобы она всегда была под рукой.",
    installYandex6: "Клик по иконке открывает новую вкладку с таблицей. Настройки — иконка ⚙ в её правом верхнем углу.",
    footerBy: "автор",
    footerSource: "Исходный код на GitHub",
    versionActual: "Актуальная версия: ",
    yandexLabel: "Yandex",
    versionNoArchives: "В последнем релизе нет архивов — откройте раздел Releases.",
    versionError: "Не удалось получить данные о релизе — кнопки ведут в раздел Releases."
  },
  en: {
    metaTitle: "Tabula — a new tab like a spreadsheet",
    metaDesc: "Tabula — a free browser extension: a new tab as a spreadsheet with sheets, themes, background, clock and weather. No telemetry, everything is stored locally.",
    metaOgDesc: "Bookmarks in an Excel-style grid: sheets, themes, background, clock and weather. Local and telemetry-free.",
    navLabel: "Main menu",
    navFeatures: "Features",
    navInstall: "Install",
    heroTitle: "A new tab that<br>works like a spreadsheet",
    heroSubtitle: "Arrange bookmarks in a spreadsheet-style grid: sheets, themes, background, clock and weather. Everything stays local — no telemetry, no subscriptions.",
    versionLoading: "Looking for the latest release…",
    releasesLink: "All releases on GitHub →",
    mockSearch: "🔍&nbsp; Search or enter a URL",
    mockWeather: "<b>21°</b>&nbsp; Cloudy",
    mockCity: "Nizhny Novgorod",
    mockCell_vk: { fav: "V", title: "VK" },
    mockCell_yandex: { fav: "Y", title: "Yandex" },
    mockCell_news: { fav: "N", title: "News" },
    mockCell_music: { fav: "M", title: "Music" },
    mockCell_kinopoisk: { fav: "T", title: "Twitch" },
    mockCell_twitter: { fav: "X", title: "X" },
    mockTabHome: "📋 Home",
    mockTabWork: "💼 Work",
    mockTabGames: "🎮 Games",
    mockTabMusic: "🎵 Music",
    featuresTitle: "Features",
    f1Title: "Sheets like Excel",
    f1Text: "Multiple sheet tabs with emoji icons, drag-and-drop reordering and a per-sheet column count (3–12).",
    f2Title: "Cell grid",
    f2Text: "Each cell is one bookmark. Drag them around, swap places, open in a new tab and edit with a right click.",
    f3Title: "Styling",
    f3Text: "Color palette, fonts, a CSS gradient, your own image or Bing's daily wallpaper — everything is one click away.",
    f4Title: "Clock & weather",
    f4Text: "A large clock and a weather widget (data from the open met.no service). Font, size and refresh interval are configurable.",
    f5Title: "Quick search",
    f5Text: "A quick-go bar with suggestions and a search engine of your choice: Google, Yandex or Bing.",
    f6Title: "Privacy",
    f6Text: "No telemetry, no cloud: all data lives locally in your browser and never leaves it.",
    installTitle: "Installation",
    installChromeGet: "Download the <b>Chrome</b> archive from the button above.",
    installUnpack: "Unpack it into any folder.",
    installChromeExt: "Open <code>chrome://extensions</code> and enable “Developer mode”.",
    installChromeLoad: "Click “Load unpacked” and select the folder.",
    installFfDynamicHint: "The instructions below adjust to the file the download button points to.",
    installFfSignedTitle: "Signed version (.xpi)",
    installFfSigned1: "Download the <code>.xpi</code> file from the button above.",
    installFfSigned2: "Open the downloaded file — Firefox will offer to add the extension.",
    installFfSigned3: "Click “Add” and confirm the installation.",
    installFfSignedNote: "The signed version updates automatically.",
    installFfUnsignedTitle: "Unsigned version (-unsign.xpi)",
    installFfUnsigned1: "Download the <code>.xpi</code> file from the button above.",
    installFfUnsigned2: "Open <code>about:debugging#/runtime/this-firefox</code>.",
    installFfUnsigned3: "Click “Load Temporary Add-on…” and select the downloaded <code>.xpi</code>.",
    installFfUnsigned4: "The extension only works for the current session — reload it after restarting Firefox.",
    installFfUnsignedNote: "The unsigned version does not update automatically.",
    installHint: "If another extension already overrides the new tab page, disable it — the browser only uses one such extension at a time.",
    installYandexTitle: "Yandex Browser",
    btnOsYandex: "Yandex Browser · from toolbar",
    installYandexHint: "Yandex Browser does not override the new tab page, so the extension launches from its toolbar icon.",
    installYandex1: "Download the <b>Yandex</b> archive from the button above.",
    installYandex3: "Open <code>browser://extensions</code> and enable “Developer mode” (at the bottom of the page).",
    installYandex4: "Click “Load extension” and select the unpacked folder.",
    installYandex5: "Pin the Tabula icon to the extensions bar (via “Show on the bar”) so it is always at hand.",
    installYandex6: "Clicking the icon opens a new tab with the table. Settings — the ⚙ icon in its top-right corner.",
    footerBy: "by",
    footerSource: "Source code on GitHub",
    versionActual: "Current version: ",
    yandexLabel: "Yandex",
    versionNoArchives: "The latest release has no archives — open the Releases section.",
    versionError: "Couldn't fetch release data — the buttons point to the Releases section."
  }
};

var STORAGE_KEY = "tabula-site-lang";
var lang = detectLang();

function detectLang() {
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "ru" || saved === "en") return saved;
  } catch (e) { /* localStorage unavailable — fall through */ }
  var nav = String(navigator.language || navigator.userLanguage || "en").toLowerCase();
  return nav.indexOf("ru") === 0 ? "ru" : "en";
}

function t(key) {
  var dict = I18N[lang] || I18N.ru;
  if (key in dict) return dict[key];
  if (key in I18N.ru) return I18N.ru[key];
  return key;
}

/* ---------- Live clock in the mockup ---------- */
function pad2(n) {
  return n < 10 ? "0" + n : String(n);
}

var DAYS = {
  ru: ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
};

var MONTHS = {
  ru: ["января", "февраля", "марта", "апреля", "мая", "июня",
       "июля", "августа", "сентября", "октября", "ноября", "декабря"],
  en: ["January", "February", "March", "April", "May", "June",
       "July", "August", "September", "October", "November", "December"]
};

function updateMockClock() {
  var timeEl = document.querySelector(".mock-time");
  var dateEl = document.querySelector(".mock-date");
  if (!timeEl && !dateEl) return;

  var now = new Date();
  if (timeEl) {
    timeEl.textContent = pad2(now.getHours()) + ":" + pad2(now.getMinutes());
  }
  if (dateEl) {
    var days = DAYS[lang] || DAYS.ru;
    var months = MONTHS[lang] || MONTHS.ru;
    if (lang === "en") {
      dateEl.textContent = days[now.getDay()] + ", " +
        months[now.getMonth()] + " " + now.getDate();
    } else {
      dateEl.textContent = now.getDate() + " " + months[now.getMonth()] +
        ", " + days[now.getDay()];
    }
  }
}

/* ---------- Version note (re-rendered on language switch) ---------- */
var loaded = false;
var versionState = null;

function renderVersionNote() {
  var versionNote = document.getElementById("version-note");
  if (!versionNote) return;
  if (!loaded) {
    versionNote.textContent = t("versionLoading");
    return;
  }
  var s = versionState;
  if (!s) {
    versionNote.textContent = "";
    return;
  }
  if (s.error) {
    versionNote.textContent = t("versionError");
    return;
  }
  if (s.noArchives) {
    versionNote.textContent = t("versionNoArchives");
    return;
  }
  if (s.tag) {
    versionNote.textContent = t("versionActual") + s.tag;
  } else {
    versionNote.textContent = "";
  }
}

/* ---------- Apply the active language ---------- */
function applyLang() {
  var i, el;

  document.documentElement.lang = lang;

  var els = document.querySelectorAll("[data-i18n]");
  for (i = 0; i < els.length; i++) {
    els[i].textContent = t(els[i].getAttribute("data-i18n"));
  }

  var htmlEls = document.querySelectorAll("[data-i18n-html]");
  for (i = 0; i < htmlEls.length; i++) {
    htmlEls[i].innerHTML = t(htmlEls[i].getAttribute("data-i18n-html"));
  }

  var ariaEls = document.querySelectorAll("[data-i18n-aria]");
  for (i = 0; i < ariaEls.length; i++) {
    ariaEls[i].setAttribute("aria-label", t(ariaEls[i].getAttribute("data-i18n-aria")));
  }

  var cells = document.querySelectorAll("[data-mock-cell]");
  for (i = 0; i < cells.length; i++) {
    var cell = t("mockCell_" + cells[i].getAttribute("data-mock-cell"));
    if (!cell) continue;
    var fav = cells[i].querySelector(".mock-fav");
    var title = cells[i].querySelector(".mock-title");
    if (fav) fav.textContent = cell.fav;
    if (title) title.textContent = cell.title;
  }

  document.title = t("metaTitle");
  var metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", t("metaDesc"));
  var ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute("content", t("metaTitle"));
  var ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute("content", t("metaOgDesc"));

  var btns = document.querySelectorAll(".lang-btn");
  for (i = 0; i < btns.length; i++) {
    var active = btns[i].getAttribute("data-lang") === lang;
    btns[i].setAttribute("aria-pressed", active ? "true" : "false");
    if (active) btns[i].classList.add("active");
    else btns[i].classList.remove("active");
  }

  renderVersionNote();
  updateMockClock();
}

/* ---------- Download buttons ---------- */
var REPO = "withersky/tabula-plugin";
var API_URL = "https://api.github.com/repos/" + REPO + "/releases/latest";
var RELEASES_URL = "https://github.com/" + REPO + "/releases";
var LATEST_FILE = "latest.json"; // статический снимок последнего релиза (обновляется release workflow)

var chromeBtn = document.querySelector('[data-browser="chrome"]');
var firefoxBtn = document.querySelector('[data-browser="firefox"]');
var yandexBtn = document.querySelector('[data-browser="yandex"]');

applyLang();
updateMockClock();
setInterval(updateMockClock, 1000);

/* Language switch */
var langBtns = document.querySelectorAll(".lang-btn");
for (var li = 0; li < langBtns.length; li++) {
  langBtns[li].addEventListener("click", function () {
    var l = this.getAttribute("data-lang");
    if (l === lang) return;
    lang = l;
    try { localStorage.setItem(STORAGE_KEY, l); } catch (e) { /* ignore */ }
    applyLang();
  });
}

if (!chromeBtn || !firefoxBtn) {
  return; // страница частично не разметлена — не мешаем
}

function findAsset(assets, pattern) {
  for (var i = 0; i < assets.length; i++) {
    if (typeof pattern === "function" ? pattern(assets[i].name) : pattern.test(assets[i].name)) {
      return assets[i];
    }
  }
  return null;
}

// Приоритет: сначала подписанные архивы (без суффикса -unsign),
// затем неподписанные (-unsign). Важно: обычный .xpi/.zip паттерн
// НЕ должен захватывать файлы с суффиксом -unsign.
function findDownloadAsset(assets, browser) {
  var isFirefox = browser === "firefox";
  // Regex обязан учитывать расширение браузера: .xpi для Firefox, .zip для Chrome.
  // Иначе "-unsign" матчер может найти чужой файл (например chrome .zip для Firefox).
  var extRe = isFirefox ? /\.xpi$/i : /\.zip$/i;
  var unsignedRe = isFirefox ? /-unsign\.xpi$/i : /-unsign\.zip$/i;

  // Яндекс-сборка — обычный .zip расширения (без подписи). Ищем строго
  // по суффиксу -yandex, иначе можем случайно захватить chrome-архив.
  if (browser === "yandex") {
    var yandexAsset = findAsset(assets, /-yandex.*\.zip$/i);
    if (yandexAsset) {
      return { asset: yandexAsset, signed: false };
    }
    return null;
  }

  var signed = findAsset(assets, function (name) {
    return extRe.test(name) && !unsignedRe.test(name);
  });
  if (signed) {
    return { asset: signed, signed: true };
  }
  var unsigned = findAsset(assets, unsignedRe);
  if (unsigned) {
    return { asset: unsigned, signed: false };
  }
  // Запасной вариант: любой .xpi для Firefox и любой .zip для Chrome.
  var any = findAsset(assets, extRe);
  if (any) {
    return { asset: any, signed: null };
  }
  return null;
}

/* Показываем блок инструкции в зависимости от файла Firefox:
   *-unsign.xpi -> временная загрузка (unsigned), иначе обычная установка (signed).
   Пока файл неизвестен, показываем оба варианта. */
function applyFirefoxVariant(name) {
  var variants = document.querySelectorAll("[data-install-variant]");
  if (!variants.length) return;
  var unsigned = /-unsign\.xpi$/i.test(name);
  var signed = /\.xpi$/i.test(name) && !unsigned;
  for (var i = 0; i < variants.length; i++) {
    var kind = variants[i].getAttribute("data-install-variant");
    variants[i].style.display = (signed && kind === "signed") ||
      (unsigned && kind === "unsigned") ||
      (!signed && !unsigned) ? "" : "none";
  }
}

function applyLinks(tag, chromeName, firefoxName, yandexName) {
  if (chromeName) {
    chromeBtn.href = "https://github.com/" + REPO + "/releases/download/" +
      tag + "/" + chromeName;
  }
  if (firefoxName) {
    firefoxBtn.href = "https://github.com/" + REPO + "/releases/download/" +
      tag + "/" + firefoxName;
  }
  if (yandexBtn && yandexName) {
    yandexBtn.href = "https://github.com/" + REPO + "/releases/download/" +
      tag + "/" + yandexName;
  }
  applyFirefoxVariant(firefoxName || "");
  loaded = true;
  versionState = {
    tag: tag || null,
    noArchives: !chromeName && !firefoxName && !yandexName
  };
  renderVersionNote();
}

function finishWithError() {
  // Оставляем кнопки по умолчанию (ссылка на latest release) и поясняем.
  loaded = true;
  versionState = { error: true };
  renderVersionNote();
}

function loadFromApi() {
  return fetch(API_URL, {
    headers: { Accept: "application/vnd.github+json" }
  })
    .then(function (res) {
      if (!res.ok) {
        throw new Error("GitHub API status: " + res.status);
      }
      return res.json();
    })
    .then(function (release) {
      var assets = release.assets || [];
      var chromeDL = findDownloadAsset(assets, "chrome");
      var firefoxDL = findDownloadAsset(assets, "firefox");
      var yandexDL = yandexBtn ? findDownloadAsset(assets, "yandex") : null;

      if (chromeDL) chromeBtn.href = chromeDL.asset.browser_download_url;
      if (firefoxDL) firefoxBtn.href = firefoxDL.asset.browser_download_url;
      if (yandexDL) yandexBtn.href = yandexDL.asset.browser_download_url;
      applyFirefoxVariant(firefoxDL ? firefoxDL.asset.name : "");

      loaded = true;
      versionState = {
        tag: release.tag_name || null,
        noArchives: !chromeDL && !firefoxDL && !yandexDL
      };
      renderVersionNote();
    });
}

// Статический снимок релиза лежит на том же origin (GitHub Pages) и работает
// даже если api.github.com недоступен/заблокирован. Если снимка нет —
// пробуем GitHub API, а при неудаче оставляем ссылку на страницу релизов.
fetch(LATEST_FILE)
  .then(function (res) {
    if (!res.ok) throw new Error("latest.json status: " + res.status);
    return res.json();
  })
  .then(function (snap) {
    if (!snap || !snap.tag || !(snap.chrome || snap.firefox || snap.yandex)) {
      throw new Error("latest.json is empty");
    }
    applyLinks(snap.tag, snap.chrome || "", snap.firefox || "", snap.yandex || "");
    // Фоном уточняем через API (на случай ручного релиза мимо workflow).
    loadFromApi().catch(function () { /* снимок уже применили */ });
  })
  .catch(function () {
    loadFromApi().catch(finishWithError);
  });
})();
