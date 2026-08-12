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
 * Справка по горячим клавишам: оверлей-модалка со списком хоткеев
 * (F1 или «?»). Список собирается из конфига SHORTCUT_GROUPS, описания —
 * из i18n-ключей, поэтому автоматически переводится.
 */

import { tx } from "./i18n.js";

const shortcutModal   = document.getElementById("shortcutModal");
const shortcutList    = document.getElementById("shortcutList");
const shortcutCloseBtn = document.getElementById("shortcutCloseBtn");

// Группы хоткеев: keys — клавиши для kbd-бейджей, label — i18n-ключ описания.
const SHORTCUT_GROUPS = [
  {
    group: "shGroupNavigate",
    items: [
      { keys: ["↑", "↓", "←", "→"], label: "shMove" },
      { keys: ["Home"],              label: "shRowStart" },
      { keys: ["End"],               label: "shRowEnd" },
      { keys: ["Ctrl", "Home"],      label: "shGridStart" },
      { keys: ["Ctrl", "End"],       label: "shGridEnd" },
      { keys: ["PageUp"],            label: "shPrevSheet" },
      { keys: ["PageDown"],          label: "shNextSheet" },
    ],
  },
  {
    group: "shGroupActions",
    items: [
      { keys: ["Enter", "Space"],    label: "shOpen" },
      { keys: ["Ctrl", "Enter"],     label: "shOpenNew" },
      { keys: ["F2"],                label: "shEdit" },
      { keys: ["Insert"],            label: "shAdd" },
      { keys: ["Delete"],            label: "shDelete" },
      { keys: ["Ctrl", "D"],         label: "shDuplicate" },
      { keys: ["Shift", "F10"],      label: "shContext" },
    ],
  },
  {
    group: "shGroupSearch",
    items: [
      { keys: ["Ctrl", "F"],         label: "shSearch" },
      { keys: ["Ctrl", "K"],         label: "shQuickGo" },
    ],
  },
  {
    group: "shGroupGeneral",
    items: [
      { keys: ["F1", "?"],           label: "shHelp" },
      { keys: ["Esc"],               label: "shClose" },
    ],
  },
];

/** Перерисовывает список хоткеев из конфига и i18n. */
function renderShortcuts() {
  if (!shortcutList) return;
  shortcutList.textContent = "";
  for (const group of SHORTCUT_GROUPS) {
    const groupDiv = document.createElement("div");
    groupDiv.className = "shortcut-group";
    const titleDiv = document.createElement("div");
    titleDiv.className = "shortcut-group-title";
    titleDiv.textContent = tx(group.group);
    groupDiv.appendChild(titleDiv);
    for (const item of group.items) {
      const rowDiv = document.createElement("div");
      rowDiv.className = "shortcut-row";
      const keysDiv = document.createElement("div");
      keysDiv.className = "shortcut-keys";
      for (const k of item.keys) {
        const kbd = document.createElement("kbd");
        kbd.textContent = k;
        keysDiv.appendChild(kbd);
      }
      const labelDiv = document.createElement("div");
      labelDiv.className = "shortcut-label";
      labelDiv.textContent = tx(item.label);
      rowDiv.appendChild(keysDiv);
      rowDiv.appendChild(labelDiv);
      groupDiv.appendChild(rowDiv);
    }
    shortcutList.appendChild(groupDiv);
  }
}

/** Открыта ли справка по горячим клавишам. */
export function isShortcutsOpen() {
  return shortcutModal && !shortcutModal.hidden;
}

/** Открывает справку по горячим клавишам (F1 / «?»). */
export function showShortcuts() {
  if (!shortcutModal) return;
  renderShortcuts();
  shortcutModal.hidden = false;
  // restart modal animation
  const card = shortcutModal.querySelector(".modal-card");
  if (card) { card.style.animation = "none"; void card.offsetWidth; card.style.animation = ""; }
}

/** Закрывает справку по горячим клавишам. */
export function hideShortcuts() {
  if (shortcutModal) shortcutModal.hidden = true;
}

/** Слушает кнопку закрытия и клик по фону оверлея. */
export function bindShortcutEvents() {
  if (shortcutCloseBtn) shortcutCloseBtn.addEventListener("click", hideShortcuts);
  if (shortcutModal) {
    shortcutModal.addEventListener("mousedown", (e) => {
      if (e.target === shortcutModal) hideShortcuts();
    });
  }
}
