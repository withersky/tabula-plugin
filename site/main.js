/* Tabula landing page — fetch the latest GitHub release and wire up
   the download buttons. If the API is unreachable, the buttons keep
   their default link to the "latest release" page. */

(function () {
"use strict";

/* Живые часы в мокапе: время и дата обновляются каждую секунду. */
function pad2(n) {
return n < 10 ? "0" + n : String(n);
}

function updateMockClock() {
var timeEl = document.querySelector(".mock-time");
var dateEl = document.querySelector(".mock-date");
if (!timeEl && !dateEl) return;

var now = new Date();
if (timeEl) {
timeEl.textContent = pad2(now.getHours()) + ":" + pad2(now.getMinutes());
}
if (dateEl) {
var days = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
var months = ["января", "февраля", "марта", "апреля", "мая", "июня",
"июля", "августа", "сентября", "октября", "ноября", "декабря"];
dateEl.textContent = now.getDate() + " " + months[now.getMonth()] +
", " + days[now.getDay()];
}
}

updateMockClock();
setInterval(updateMockClock, 1000);

var REPO = "withersky/tabula-plugin";
  var API_URL = "https://api.github.com/repos/" + REPO + "/releases/latest";
  var RELEASES_URL = "https://github.com/" + REPO + "/releases";

  var chromeBtn = document.querySelector('[data-browser="chrome"]');
  var firefoxBtn = document.querySelector('[data-browser="firefox"]');
  var versionNote = document.getElementById("version-note");

  if (!chromeBtn || !firefoxBtn) {
    return; // страница частично не разметлена — не мешаем
  }

function findAsset(assets, pattern) {
for (var i = 0; i < assets.length; i++) {
if (pattern.test(assets[i].name)) {
return assets[i];
}
}
return null;
}

// Приоритет: сначала подписанные архивы (-sign), затем неподписанные (-unsign).
function findDownloadAsset(assets, browser) {
var signed = findAsset(assets, browser === "firefox"
? /^tabula-firefox-v.+-sign\.xpi$/i
: /^tabula-chrome-v.+-sign\.zip$/i);
if (signed) {
return { asset: signed, signed: true };
}
var unsigned = findAsset(assets, browser === "firefox"
? /^tabula-firefox-v.+-unsign\.xpi$/i
: /^tabula-chrome-v.+-unsign\.zip$/i);
if (unsigned) {
return { asset: unsigned, signed: false };
}
return null;
}

  fetch(API_URL, {
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

if (chromeDL) {
chromeBtn.href = chromeDL.asset.browser_download_url;
}
if (firefoxDL) {
firefoxBtn.href = firefoxDL.asset.browser_download_url;
}

var signNotes = [];
if (chromeDL && chromeDL.signed) signNotes.push("Chrome: подписан");
if (chromeDL &&!chromeDL.signed) signNotes.push("Chrome: неподписан");
if (firefoxDL && firefoxDL.signed) signNotes.push("Firefox: подписан");
if (firefoxDL &&!firefoxDL.signed) signNotes.push("Firefox: неподписан");

if (release.tag_name) {
versionNote.textContent =
"Актуальная версия: " + release.tag_name + " · " +
(signNotes.length? signNotes.join(", "): "смотрите раздел Releases");
} else {
versionNote.textContent = "";
}

if (!chromeDL &&!firefoxDL) {
versionNote.textContent =
"В последнем релизе нет архивов — откройте раздел Releases.";
}
    })
    .catch(function () {
      // Оставляем кнопки по умолчанию (ссылка на latest release) и поясняем.
      versionNote.textContent =
        "Не удалось получить данные о релизе — кнопки ведут в раздел Releases.";
    });
})();
