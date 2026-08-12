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
 * Виджеты: списки городов погоды (weatherCities) и часов (clockCities) —
 * добавление через гео-модалку, выбор активного, удаление.
 * Слушатели собирает bindWidgetEvents(), вызываемый из main.wireEvents().
 */

import { getLang, getState, setState, tx } from "./state.js";
import { fillForm } from "./form.js";
import { flash, flashSaved } from "./utils.js";

const weatherCityList = document.getElementById("weatherCityList");
const clockCityList   = document.getElementById("clockCityList");
const weatherAddCityBtn = document.getElementById("weatherAddCityBtn");
const clockAddCityBtn   = document.getElementById("clockAddCityBtn");
const geoModal       = document.getElementById("geoModal");
const geoForm        = document.getElementById("geoForm");
const geoCityInput   = document.getElementById("geoCityInput");
const geoCancelBtn   = document.getElementById("geoCancelBtn");
const geoStatus      = document.getElementById("geoStatus");
const geoResults     = document.getElementById("geoResults");
const geoSearchBtn   = document.getElementById("geoSearchBtn");

let _geoInFlight = false;
let _geoLastQuery = "";
let _geoKind = "weather"; // "weather" | "clock" — куда добавляем найденный город

export function openGeoModal(kind) {
  if (!geoModal) return;
  _geoKind = (kind === "clock") ? "clock" : "weather";
  const s = getState() && getState().settings;
  const list = (_geoKind === "clock")
    ? (Array.isArray(s && s.clockCities) ? s.clockCities : [])
    : (Array.isArray(s && s.weatherCities) ? s.weatherCities : []);
  const activeId = (_geoKind === "clock") ? (s && s.clockActiveCityId) : (s && s.weatherActiveCityId);
  const active = list.find(c => c && c.id === activeId) || list[0];
  if (geoCityInput) geoCityInput.value = (active && active.name) || "";
  if (geoResults) { geoResults.innerHTML = ""; geoResults.hidden = true; }
  if (geoStatus) { geoStatus.hidden = true; geoStatus.textContent = ""; }
  geoModal.hidden = false;
  setTimeout(() => geoCityInput && geoCityInput.focus(), 0);
}

export function closeGeoModal() {
  if (!geoModal) return;
  geoModal.hidden = true;
  if (geoResults) { geoResults.innerHTML = ""; geoResults.hidden = true; }
  if (geoStatus) { geoStatus.hidden = true; geoStatus.textContent = ""; }
  if (geoSearchBtn) geoSearchBtn.disabled = false;
  _geoInFlight = false;
}

function setGeoStatus(text, isError) {
  if (!geoStatus) return;
  if (!text) { geoStatus.hidden = true; geoStatus.textContent = ""; return; }
  geoStatus.hidden = false;
  geoStatus.textContent = text;
  geoStatus.style.color = isError ? "rgba(255,150,150,0.95)" : "";
}

export async function runGeoSearch() {
  if (_geoInFlight || !geoCityInput) return;
  const city = geoCityInput.value.trim();
  if (!city) { setGeoStatus(tx("hintWeatherCity"), true); return; }
  _geoInFlight = true;
  if (geoSearchBtn) geoSearchBtn.disabled = true;
  setGeoStatus(tx("geoSearching"), false);
  if (geoResults) { geoResults.innerHTML = ""; geoResults.hidden = true; }
  _geoLastQuery = city;
  try {
    const resp = await ext.runtime.sendMessage({ type: "weatherGeocode", city: city, lang: getLang() });
    if (geoCityInput.value.trim() !== _geoLastQuery) return; // устаревший ответ
    if (!resp || resp.error || !resp.ok) throw new Error(resp && resp.error || "no response");
    const list = Array.isArray(resp.results) ? resp.results : [];
    if (list.length === 0) { setGeoStatus(tx("geoNotFound"), true); return; }
    setGeoStatus("", false);
    renderGeoResults(list);
  } catch (e) {
    setGeoStatus(tx("geoError"), true);
  } finally {
    _geoInFlight = false;
    if (geoSearchBtn) geoSearchBtn.disabled = false;
  }
}

function renderGeoResults(list) {
  if (!geoResults) return;
  geoResults.innerHTML = "";
  list.forEach((r) => {
    const li = document.createElement("li");
    li.className = "geo-result";
    li.tabIndex = 0;
    const title = document.createElement("div");
    title.className = "geo-result-title";
    const parts = [r.name];
    if (r.admin1) parts.push(r.admin1);
    if (r.country) parts.push(r.country);
    title.textContent = parts.join(", ");
    const coords = document.createElement("div");
    coords.className = "geo-result-coords";
    coords.textContent = "lat " + Number(r.lat).toFixed(4) + ", lon " + Number(r.lon).toFixed(4);
    const hint = document.createElement("div");
    hint.className = "geo-result-hint";
    hint.textContent = tx("geoPickHint");
    li.appendChild(title);
    li.appendChild(coords);
    li.appendChild(hint);
    li.addEventListener("click", () => pickGeoResult(r));
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickGeoResult(r); }
    });
    geoResults.appendChild(li);
  });
  geoResults.hidden = false;
}

export async function pickGeoResult(r) {
  try {
    const newCity = {
      id: cryptoId(),
      name: r.name || _geoLastQuery,
      country: r.country || "",
      lat: Number(r.lat),
      lon: Number(r.lon),
      timezone: r.timezone || ""
    };
    await Storage.update((d) => {
      if (_geoKind === "clock") {
        const cities = Array.isArray(d.settings.clockCities) ? d.settings.clockCities.slice() : [];
        cities.push({ id: newCity.id, name: newCity.name, timezone: newCity.timezone });
        d.settings.clockCities = cities;
        d.settings.clockActiveCityId = newCity.id;
      } else {
        const cities = Array.isArray(d.settings.weatherCities) ? d.settings.weatherCities.slice() : [];
        cities.push(newCity);
        d.settings.weatherCities = cities;
        d.settings.weatherActiveCityId = newCity.id;
        if (!d.weatherCaches || typeof d.weatherCaches !== "object") d.weatherCaches = {};
        d.weatherCaches[newCity.id] = null;
      }
    });
    setState(await Storage.get());
    fillForm();
    renderCityLists();
    flashSaved();
  } catch (e) {
    flash(tx("weatherLoadFailed"), true);
    return;
  }
  closeGeoModal();
}

/** Перерисовывает оба списка городов (погода и часы). */
export function renderCityLists() {
  const s = getState() && getState().settings;
  renderCityList(weatherCityList, Array.isArray(s && s.weatherCities) ? s.weatherCities : [], s && s.weatherActiveCityId, "weather");
  renderCityList(clockCityList, Array.isArray(s && s.clockCities) ? s.clockCities : [], s && s.clockActiveCityId, "clock");
}

function renderCityList(container, list, activeId, kind) {
  if (!container) return;
  container.textContent = "";
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "city-list-empty";
    empty.textContent = (kind === "clock") ? tx("clockNoCities") : tx("weatherNoCities");
    container.appendChild(empty);
    return;
  }
  list.forEach(c => {
    const row = document.createElement("div");
    row.className = "city-list-row" + (c.id === activeId ? " active" : "");
    row.tabIndex = 0;
    row.title = tx("cityMakeActive");
    const badge = document.createElement("span");
    badge.className = "city-list-active-badge";
    badge.textContent = "✓";
    const name = document.createElement("span");
    name.className = "city-list-name";
    name.textContent = c.name || "—";
    const meta = document.createElement("span");
    meta.className = "city-list-meta";
    meta.textContent = (kind === "clock")
      ? ((c.timezone && c.timezone !== "local") ? c.timezone : tx("clockLocalTime"))
      : ((c.country ? c.country + " · " : "") + "lat " + Number(c.lat).toFixed(2) + ", lon " + Number(c.lon).toFixed(2));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "city-list-delete";
    del.title = tx("cityDelete");
    del.textContent = "✕";
    del.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteCity(kind, c.id);
    });
    row.appendChild(badge);
    row.appendChild(name);
    row.appendChild(meta);
    row.appendChild(del);
    row.addEventListener("click", () => setActiveCity(kind, c.id));
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveCity(kind, c.id); }
    });
    container.appendChild(row);
  });
}

async function setActiveCity(kind, id) {
  await Storage.update((d) => {
    if (kind === "clock") d.settings.clockActiveCityId = id;
    else d.settings.weatherActiveCityId = id;
  });
  setState(await Storage.get());
  renderCityLists();
  flashSaved();
}

async function deleteCity(kind, id) {
  await Storage.update((d) => {
    if (kind === "clock") {
      const cities = (Array.isArray(d.settings.clockCities) ? d.settings.clockCities : []).filter(c => c.id !== id);
      d.settings.clockCities = cities;
      if (d.settings.clockActiveCityId === id) d.settings.clockActiveCityId = cities.length ? cities[0].id : null;
    } else {
      const cities = (Array.isArray(d.settings.weatherCities) ? d.settings.weatherCities : []).filter(c => c.id !== id);
      d.settings.weatherCities = cities;
      if (d.settings.weatherActiveCityId === id) d.settings.weatherActiveCityId = cities.length ? cities[0].id : null;
      if (d.weatherCaches && typeof d.weatherCaches === "object") delete d.weatherCaches[id];
    }
  });
  setState(await Storage.get());
  fillForm();
  renderCityLists();
  flashSaved();
}

/** Слушает гео-модалку: кнопки, форму, overlay, Escape. */
export function bindWidgetEvents() {
  if (weatherAddCityBtn) weatherAddCityBtn.addEventListener("click", () => openGeoModal("weather"));
  if (clockAddCityBtn) clockAddCityBtn.addEventListener("click", () => openGeoModal("clock"));
  if (geoCancelBtn) geoCancelBtn.addEventListener("click", closeGeoModal);
  if (geoModal) {
    geoModal.addEventListener("click", (e) => {
      if (e.target === geoModal) closeGeoModal();
    });
  }
  if (geoForm) {
    geoForm.addEventListener("submit", (e) => {
      e.preventDefault();
      runGeoSearch();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && geoModal && !geoModal.hidden) closeGeoModal();
  });
}
