/*
 * Tabula — spreadsheet-style new tab page browser extension.
 *
 * Виджеты: геокодер-модалка для подбора координат города по названию.
 * Слушатели собирает bindWidgetEvents(), вызываемый из main.wireEvents().
 */

import { getLang, setState, tx } from "./state.js";
import { fillForm } from "./form.js";
import { flash, flashSaved } from "./utils.js";

const weatherGeoBtn = document.getElementById("weatherGeoBtn");
const geoModal       = document.getElementById("geoModal");
const geoForm        = document.getElementById("geoForm");
const geoCityInput   = document.getElementById("geoCityInput");
const geoCancelBtn   = document.getElementById("geoCancelBtn");
const geoStatus      = document.getElementById("geoStatus");
const geoResults     = document.getElementById("geoResults");
const geoSearchBtn   = document.getElementById("geoSearchBtn");

let _geoInFlight = false;
let _geoLastQuery = "";

export function openGeoModal() {
  if (!geoModal) return;
  const cityEl = document.querySelector('input[name="weatherCity"]');
  const preset = (cityEl && cityEl.value || "").trim();
  if (geoCityInput) geoCityInput.value = preset;
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
    await Storage.update((d) => {
      d.settings.weatherLat = r.lat;
      d.settings.weatherLon = r.lon;
      d.settings.weatherCity = r.name || _geoLastQuery;
      d.weatherCache = null;
    });
    setState(await Storage.get());
    fillForm();
    flashSaved();
  } catch (e) {
    flash(tx("weatherLoadFailed"), true);
    return;
  }
  closeGeoModal();
}

/** Слушает гео-модалку: кнопки, форму, overlay, Escape. */
export function bindWidgetEvents() {
  if (weatherGeoBtn) weatherGeoBtn.addEventListener("click", () => openGeoModal());
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
