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
 * Виджет ярлыков на верхней панели: кнопки в стиле иконок-топбара
 * (search-palette / opts), каждая ведёт на свой URL.
 * Расположение (до / после строки поиска) — настраивается.
 * Иконка берётся из фавикона сайта (как у клеток сетки), с фолбэком
 * на буквенный бейдж из первой буквы названия.
 */

import { getState } from "./state.js";
import { cachedSrc } from "./favicons.js";
// faviconHost, letterChar — глобальные функции из lib/core.js (классический скрипт,
// подключается до ES-модулей в newtab.html).

const shortcutsWidget = document.getElementById("shortcutsWidget");
const quickGo         = document.getElementById("quickGo");
const weatherWidget   = document.getElementById("weatherWidget");

let _renderScheduled = false;

/** Рендерит кнопки ярлыков из настроек (все shortcuts из списка). */
export function renderShortcuts() {
  if (!shortcutsWidget) return;
  const state = getState();
  const s     = state && state.settings;
  const show  = s && s.showShortcuts !== false;
  const list  = Array.isArray(s && s.shortcuts) ? s.shortcuts : [];

  // Скрываем виджет полностью когда выключено или нет ярлыков.
  const shouldShow = show && list.length > 0;
  shortcutsWidget.hidden = !shouldShow;
  shortcutsWidget.classList.toggle("is-off", !shouldShow);
  shortcutsWidget.style.display = shouldShow ? "" : "none";

  if (!shouldShow) return;

  shortcutsWidget.textContent = "";
  list.forEach((sc) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn shortcut-btn";
    btn.title = (sc.title ? sc.title + "\n" + sc.url : sc.url || "");
    btn.setAttribute("aria-label", sc.title || sc.url || "");
    btn.dataset.url = sc.url || "";

    const fav = document.createElement("span");
    fav.className = "shortcut-favicon";
    const src = cachedSrc(sc.url);
    if (src) {
      const img = document.createElement("img");
      img.alt = "";
      img.draggable = false;
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.src = src;
      img.onerror = () => { fav.replaceChildren(letterBadge(sc.title)); };
      fav.appendChild(img);
    } else {
      fav.appendChild(letterBadge(sc.title));
    }
    btn.appendChild(fav);

    btn.addEventListener("click", () => {
      const url = btn.dataset.url;
      if (url) window.location.href = normalizeUrl(url);
    });
    shortcutsWidget.appendChild(btn);
  });
}

function letterBadge(title) {
  const span = document.createElement("span");
  span.className = "shortcut-letter";
  span.textContent = letterChar(title || "");
  return span;
}

/** Ярлыки перед поиском (колонка 2), погода после поиска (колонка 4 при ярлыках, 3 без них). */
export function applyShortcutsPosition() {
  if (!shortcutsWidget || !weatherWidget) return;
  const state = getState();
  const s     = state && state.settings;
  const show  = s && s.showShortcuts !== false;
  const list  = Array.isArray(s && s.shortcuts) ? s.shortcuts : [];
  const shouldShow = show && list.length > 0;
  const topbar = document.querySelector(".topbar");

  if (shouldShow) {
    // 5 колонок: часы | ярлыки | поиск | погода | кнопки
    topbar.style.gridTemplateColumns = "auto auto 1fr auto auto";
    shortcutsWidget.style.gridColumn = "2";
    shortcutsWidget.style.justifySelf = "start";
    quickGo.style.gridColumn = "3";
    weatherWidget.style.gridColumn = "4";
    weatherWidget.style.justifySelf = "center";
  } else {
    // 4 колонки: часы | поиск | погода | кнопки (как в исходной версии)
    topbar.style.gridTemplateColumns = "auto 1fr auto auto";
    shortcutsWidget.style.gridColumn = "";
    shortcutsWidget.style.justifySelf = "";
    quickGo.style.gridColumn = "2";
    weatherWidget.style.gridColumn = "3";
    weatherWidget.style.justifySelf = "center";
  }
}

/** Планирует перерисовку (debounce через rAF, чтобы не лавинить при каждом нажатии). */
export function scheduleRender() {
  if (_renderScheduled) return;
  _renderScheduled = true;
  requestAnimationFrame(() => {
    _renderScheduled = false;
    renderShortcuts();
    applyShortcutsPosition();
  });
}

export { shortcutsWidget };
