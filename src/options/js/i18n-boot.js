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
 * along with this <https://www.gnu.org/licenses/>.
 *
 * Boot-скрипт локализации страницы настроек (классический <script>, без
 * модулей). Задача — убрать мигание (FOUT) русским фолбэком в data-i18n при
 * открытии настроек на другом языке.
 *
 * Проблема: HTML отрисовывается браузером сразу с русскими фолбэками в
 * data-i18n, а основной модуль js/main.js применяет перевод только
 * асинхронно (после await Storage.get()). Между первой отрисовкой и
 * локализацией пользователь видит русский текст на долю секунды.
 *
 * Решение: этот скрипт подключается в <head>/конце body СРАЗУ после
 * i18n-shared.js, но до ES-модуля main.js. Он читает сохранённый язык
 * напрямую из chrome.storage.local.get (callback-форма выполняется
 * синхронно с уже загруженными данными) и применяет applyI18nStaticCommon
 * до того, как браузер отрисует переведённый контент. Затем снимает класс
 * .i18n-ready, открывающий контент (см. options.css: body:not(.i18n-ready)
 * скрывает .layout и .settings-head).
 *
 * Если storage недоступен (например, в тестовом окружении) — просто
 * снимаем скрытие, оставляя русский фолбэк (он же и так виден).
 */
(function () {
  try {
    var root = (typeof chrome !== "undefined" && chrome.storage)
      ? chrome
      : ((typeof browser !== "undefined" && browser.storage) ? browser : null);

    var apply = function (lang) {
      try {
        if (window.applyI18nStaticCommon) {
          window.applyI18nStaticCommon(
            function (k) { return (window.t ? window.t(k, lang) : (k || "")); },
            function () { return lang; }
          );
        }
        document.documentElement.lang = lang;
        var rtlLangs = { ar: 1, he: 1, fa: 1, ur: 1 };
        document.documentElement.dir = rtlLangs[lang] ? "rtl" : "ltr";
      } catch (e) { /* не критично для boot */ }
      document.body.classList.add("i18n-ready");
    };

    if (root && root.storage && root.storage.local) {
      root.storage.local.get(["tabula_data"], function (val) {
        var data = (val && val.tabula_data) || null;
        var lang = (data && data.settings && data.settings.language) || "ru";
        if (!/^[a-z]{2,3}$/.test(lang)) lang = "ru";
        apply(lang);
      });
    } else {
      apply("ru");
    }
  } catch (e) {
    // Гарантируем, что контент не останется скрытым при любой ошибке.
    if (document.body) document.body.classList.add("i18n-ready");
  }
})();
