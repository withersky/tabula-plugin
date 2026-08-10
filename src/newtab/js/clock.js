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
 * Виджет часов: время и дата в топбаре.
 */

import { getState } from "./state.js";
import { tx } from "./i18n.js";
import { pad2 } from "./utils.js";

const clockWidget = document.getElementById("clockWidget");
const clockTimeEl = document.getElementById("clockTime");
const clockDateEl = document.getElementById("clockDate");

let clockTimer = null;

export function updateClock() {
  if (!clockTimeEl || !clockDateEl) return;
  const state = getState();
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

export function startClock() {
  if (clockTimer) clearInterval(clockTimer);
  updateClock();
  clockTimer = setInterval(updateClock, 15 * 1000);
}

export { clockWidget };
