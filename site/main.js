/* Tabula landing page — fetch the latest GitHub release and wire up
   the download buttons. If the API is unreachable, the buttons keep
   their default link to the "latest release" page. */

(function () {
  "use strict";

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
      var chrome = findAsset(assets, /^tabula-chrome-v.+\.zip$/i);
      var firefox = findAsset(assets, /^tabula-firefox-v.+\.zip$/i);

      if (chrome) {
        chromeBtn.href = chrome.browser_download_url;
      }
      if (firefox) {
        firefoxBtn.href = firefox.browser_download_url;
      }

      if (release.tag_name) {
        versionNote.textContent =
          "Актуальная версия: " + release.tag_name + " · " +
          (chrome || firefox ? "архивы готовы к скачиванию" : "смотрите раздел Releases");
      } else {
        versionNote.textContent = "";
      }

      if (!chrome && !firefox) {
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
