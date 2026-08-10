/*
 * Tabula — spreadsheet-style new tab page browser extension.
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
