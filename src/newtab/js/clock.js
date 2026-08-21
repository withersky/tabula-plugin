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
 * Виджет часов: время и дата в топбаре, несколько городов (settings.clockCities
 * + clockActiveCityId), попап-переключатель активного города. timezone "" —
 * локальное время устройства.
 */

import { getState, setState, getLang } from "./state.js";
import { tx } from "./i18n.js";
import { pad2 } from "./utils.js";
// partsInTz / ensureCityTimezone — единый модуль таймзон (lib/timezone.js,
// подключён глобально в newtab.html перед ES-модулями).
const { partsInTz, ensureCityTimezone } = (typeof globalThis !== "undefined" && globalThis.partsInTz)
  ? globalThis
  : {};

const clockWidget = document.getElementById("clockWidget");
const clockTimeEl = document.getElementById("clockTime");
const clockDateEl = document.getElementById("clockDate");
const clockCityEl = document.getElementById("clockCity");
const clockPopupEl = document.getElementById("clockPopup");
const clockPopupListEl = document.getElementById("clockPopupList");

let clockTimer = null;
let _clockPopupTimer = null;
let _clockPopupClosing = false;

/** Активный город часов (или первый). null — локальное время. */
function activeClockCity(s) {
  const list = Array.isArray(s && s.clockCities) ? s.clockCities : [];
  const activeId = s && s.clockActiveCityId;
  return list.find(c => c && c.id === activeId) || list[0] || null;
}

// Расчёт времени в таймзоне города вынесен в единый модуль lib/timezone.js
// (функция partsInTz). Здесь только виджет-обвязка.

/** Числовые части текущего времени в таймзоне города (или локальные). */
function datePartsFor(city) {
  const tz = (city && city.timezone) || "";
  const days = tx("clockDays");
  const weekdayNames = Array.isArray(days) ? days : null;
  try {
    return partsInTz(new Date(), tz, { date: true, weekdayNames });
  } catch (e) {
    // Битый IANA-пояс города не должен ронять весь виджет часов (setInterval
    // updateClock). Логируем и откатываемся на локальное время устройства.
    console.error("[Tabula] partsInTz failed (clock) for tz=" + tz, e);
    const now = new Date();
    return {
      hour: now.getHours(),
      minute: now.getMinutes(),
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
      weekday: now.getDay(),
      date: now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0"),
      weekdayNames
    };
  }
}

export function updateClock() {
  // Вкладка не видна — тик пропускаем (браузер и так троттлит фоновые таймеры).
  if (document.hidden) return;
  if (!clockTimeEl || !clockDateEl) return;
  const state = getState();
  const s = state && state.settings;
  if (s && s.showClock === false) {
    clockTimeEl.textContent = "";
    clockDateEl.textContent = "";
    if (clockCityEl) clockCityEl.textContent = "";
    return;
  }
  const city = activeClockCity(s);
  const p = datePartsFor(city);
  clockTimeEl.textContent = pad2(p.hour) + ":" + pad2(p.minute);
  const days   = tx("clockDays");
  const dayName = (Array.isArray(days) && days[p.weekday]) ? days[p.weekday] : "";
  // Дата строится через formatDateFmt (глобал core.js) по настройке clockDateFmt,
  // которая поддерживает кастомные шаблоны ("custom:DD.MM.YYYY", "custom:D MMM" и т.п.).
  // Если шаблон "off" — дату не показываем вовсе.
  const dateFmt = (s && s.clockDateFmt) || "custom:DD.MM.YYYY";
  if (dateFmt === "off") {
    clockDateEl.textContent = dayName;
  } else {
    const dateOnly = new Date(p.year, p.month, p.day);
    const formatted = (typeof formatDateFmt === "function")
      ? formatDateFmt(dateOnly, dateFmt, getLang())
      : (p.day + " " + (tx("clockMonths") && tx("clockMonths")[p.month] || ""));
    clockDateEl.textContent = (dayName ? dayName + ", " : "") + formatted;
  }
  if (clockCityEl) clockCityEl.textContent = (city && city.name) || "";
}

export function startClock() {
  if (clockTimer) clearInterval(clockTimer);
  updateClock();
  clockTimer = setInterval(updateClock, 15 * 1000);
  // Догеокодируем часовые пояса для старых/мигрированных городов без timezone
  // (раньше у часов это не делалось — и в попапе показывалось локальное время
  // устройства вместо времени города). Используем единый модуль timezone.js.
  const s = getState() && getState().settings;
  const cities = Array.isArray(s && s.clockCities) ? s.clockCities : [];
  cities.forEach((c) => {
    if (c && !c.timezone) {
      ensureCityTimezone(c, {
        sendMessage: (m) => ext.runtime.sendMessage(m),
        storage: (typeof Storage !== "undefined" ? Storage : null),
        getState, setState, lang: getLang()
      }).catch(() => {});
    }
  });
}

function closeClockPopup() {
  if (!clockPopupEl || clockPopupEl.hidden) return;
  _clockPopupClosing = true;
  clockPopupEl.classList.add("closing");
  clearTimeout(_clockPopupTimer);
  _clockPopupTimer = setTimeout(() => {
    clockPopupEl.classList.remove("closing");
    _clockPopupClosing = false;
    clockPopupEl.hidden = true;
  }, 150);
}

function renderClockPopup() {
  if (!clockPopupEl || !clockPopupListEl) return;
  const state = getState();
  const s = state && state.settings;
  const list = Array.isArray(s && s.clockCities) ? s.clockCities : [];
  const activeId = activeClockCity(s) && activeClockCity(s).id;
  clockPopupListEl.textContent = "";
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "clock-popup-empty";
    empty.textContent = tx("clockNoCities");
    clockPopupListEl.appendChild(empty);
    return;
  }
  list.forEach(c => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "clock-popup-city" + (c.id === activeId ? " active" : "");
    const name = document.createElement("span");
    name.className = "clock-popup-city-name";
    name.textContent = c.name || "—";
    const time = document.createElement("span");
    time.className = "clock-popup-city-time";
    const p = datePartsFor(c);
    time.textContent = pad2(p.hour) + ":" + pad2(p.minute);
    row.appendChild(name);
    row.appendChild(time);
    row.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (c.id === activeId) {
        closeClockPopup();
        return;
      }
      await Storage.update((d) => { d.settings.clockActiveCityId = c.id; });
      setState(await Storage.get());
      updateClock();
      renderClockPopup();
      closeClockPopup();
    });
    clockPopupListEl.appendChild(row);
  });
}

export function toggleClockPopup() {
  if (!clockPopupEl) return;
  const s = getState() && getState().settings;
  const list = Array.isArray(s && s.clockCities) ? s.clockCities : [];
  if (list.length === 0) return;
  if (!clockPopupEl.hidden) {
    closeClockPopup();
    return;
  }
  renderClockPopup();
  clearTimeout(_clockPopupTimer);
  clockPopupEl.classList.remove("closing");
  _clockPopupClosing = false;
  clockPopupEl.hidden = false;
  // В режиме превью (iframe) позиционируем явно через fixed+координаты,
  // как в toggleWeatherPopup (см. positionPopupInIframe в weather.js).
  if (window.TabulaPreview && clockWidget) {
    const r = clockWidget.getBoundingClientRect();
    clockPopupEl.style.position = "fixed";
    clockPopupEl.style.top = (r.bottom + 6) + "px";
    clockPopupEl.style.right = "auto";
    clockPopupEl.style.left = Math.max(8, r.left) + "px";
    const maxH = Math.max(120, window.innerHeight - r.bottom - 12);
    clockPopupEl.style.maxHeight = maxH + "px";
  }
}

/** Слушает клики по виджету часов. */
export function bindClockEvents() {
  if (clockWidget) {
    clockWidget.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleClockPopup();
    });
    clockWidget.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        toggleClockPopup();
      }
    });
  }
  document.addEventListener("mousedown", (e) => {
    if (clockPopupEl && !clockPopupEl.hidden && !clockWidget.contains(e.target)) {
      closeClockPopup();
    }
  });
}

/** Закрывает попап часов при клике/тапе вне его (для режима превью). */
export function closeClockPopupOutside(e) {
  if (clockPopupEl && !clockPopupEl.hidden && !clockWidget.contains(e.target)) {
    closeClockPopup();
  }
}

export { clockWidget };
