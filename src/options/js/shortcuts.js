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
 * Редактирование списка ярлыков настройки виджета: добавление, удаление,
 * перерисовка строк пары «название + URL».
 */

import { getState, setState } from "./state.js";
import { persistSettings } from "./form.js";
import { flashSaved } from "./utils.js";

const shortcutsList = document.getElementById("shortcutsList");
const shortcutAddBtn = document.getElementById("shortcutAddBtn");

export function renderShortcutsList() {
  if (!shortcutsList) return;
  const s = getState() && getState().settings;
  const list = Array.isArray(s && s.shortcuts) ? s.shortcuts : [];
  shortcutsList.textContent = "";
  list.forEach((sc, i) => {
    const row = document.createElement("div");
    row.className = "shortcut-row";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.name = "shortcutTitle";
    titleInput.value = sc.title || "";
    titleInput.placeholder = t("placeholderShortcutTitle");
    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.name = "shortcutUrl";
    urlInput.value = sc.url || "";
    urlInput.placeholder = t("placeholderShortcutUrl");
    const del = document.createElement("button");
    del.type = "button";
    del.className = "city-list-delete";
    del.textContent = "✕";
    del.title = t("optShortcutsDelete");
    del.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeShortcut(i);
    });
    row.appendChild(titleInput);
    row.appendChild(urlInput);
    row.appendChild(del);
    shortcutsList.appendChild(row);

    // Автосохранение при вводе в поля ярлыка (они создаются динамически,
    // поэтому слушатели вешаются здесь, а не в wireEvents()).
    const saveDebounced = () => {
      clearTimeout(saveDebounced._t);
      saveDebounced._t = setTimeout(() => persistSettings().then(() => flashSaved()), 220);
    };
    titleInput.addEventListener("input", saveDebounced);
    titleInput.addEventListener("change", saveDebounced);
    urlInput.addEventListener("input", saveDebounced);
    urlInput.addEventListener("change", saveDebounced);
  });
}

async function addShortcut() {
  // Сохраняем текущие значения из полей перед добавлением нового ярлыка,
  // иначе введённое пользователем пропадёт при перерисовке списка.
  await persistSettings();
  await Storage.update((d) => {
    const list = Array.isArray(d.settings.shortcuts) ? d.settings.shortcuts.slice() : [];
    list.push({ id: cryptoId(), title: "", url: "" });
    d.settings.shortcuts = list;
  });
  setState(await Storage.get());
  renderShortcutsList();
  flashSaved();
}

async function removeShortcut(index) {
  await Storage.update((d) => {
    const list = Array.isArray(d.settings.shortcuts) ? d.settings.shortcuts.slice() : [];
    list.splice(index, 1);
    d.settings.shortcuts = list;
  });
  setState(await Storage.get());
  renderShortcutsList();
  flashSaved();
}

export function bindShortcutsEvents() {
  if (shortcutAddBtn) shortcutAddBtn.addEventListener("click", addShortcut);
}
