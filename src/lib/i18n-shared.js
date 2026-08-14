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
 *
 * Общая часть интернационализации для страниц newtab и options.
 * Классический скрипт (как core.js/storage.js): подключается до ES-модулей
 * и выставляет глобал applyI18nStaticCommon, чтобы newtab/js/i18n.js и
 * options/js/i18n.js не дублировали одну и ту же обвязку data-i18n*.
 */

(function () {
  "use strict";

  /**
   * Заполняет статические data-i18n*-атрибуты и язык документа.
   * Страницы-потребители (newtab/options) сами дописывают заголовок,
   * селект шрифтов и индекс поиска — здесь только общая часть.
   *
   * @param {function(string):string} tx  перевод ключа в текущей локали
   * @param {function():string} getLang   текущая локаль ("ru"/"en")
   */
  function applyI18nStaticCommon(tx, getLang) {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = tx(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      el.placeholder = tx(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      el.title = tx(el.dataset.i18nTitle);
    });
    document.documentElement.lang = getLang();
  }

  // Классический скрипт: выставляем глобал (ES-модули вызывают его напрямую).
  window.applyI18nStaticCommon = applyI18nStaticCommon;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { applyI18nStaticCommon: applyI18nStaticCommon };
  }
})();
