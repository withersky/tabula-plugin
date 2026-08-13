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
 * Фон страницы: применение фона (bing / URL / загрузка / градиент / цвет),
 * загрузка ежедневного изображения Bing и AutoColor — автоцвет выделения,
 * подбираемый под текущий фон (изображение, градиент или сплошной цвет).
 */

import { getState, setState } from "./state.js";
import { tx } from "./i18n.js";
import { toast, cssEscape } from "./utils.js";

const bgEl = document.getElementById("bg");

export function todayKey() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function applyBackground() {
  const state = getState();
  const s = state.settings;
  if (s.backgroundType === "bing") {
    const cached = state.bingCache;
    if (cached && cached.url && cached.date === todayKey()) {
      bgEl.style.background = `url("${cssEscape(cached.url)}") center / cover no-repeat, ${s.backgroundColor}`;
    } else {
      bgEl.style.background = s.backgroundColor;
    }
  } else if ((s.backgroundType === "imageUrl" || s.backgroundType === "imageUpload") && s.backgroundImage) {
    bgEl.style.background = `url("${cssEscape(s.backgroundImage)}") center / cover no-repeat, ${s.backgroundColor}`;
  } else if (s.backgroundType === "gradient") {
    bgEl.style.background = `${s.backgroundGradient}, ${s.backgroundColor}`;
  } else {
    bgEl.style.background = s.backgroundColor;
  }
}

// ---------- AutoColor: автоцвет выделения под фон ----------
// Акцентный цвет берётся из текущего фона — изображения (по пикселям),
// градиента или сплошного цвета (по палитре CSS-цветов).
// Результат кэшируется по ключу источника, чтобы не пересчитывать на каждом applySettings.
let _accentKey = null;
let _accentColor = null;

// Ключ источника акцента: "img:" + URL для изображений, "g:" + CSS градиента,
// "c:" + цвета для сплошного фона. null — источника нет (напр. bing ещё не загружен).
function accentSourceKey() {
  const state = getState();
  const s = state.settings;
  if (s.backgroundType === "bing") {
    const cached = state.bingCache;
    if (cached && cached.url && cached.date === todayKey()) return "img:" + cached.url;
    return null;
  }
  if ((s.backgroundType === "imageUrl" || s.backgroundType === "imageUpload") && s.backgroundImage) {
    return "img:" + s.backgroundImage;
  }
  if (s.backgroundType === "gradient" && s.backgroundGradient) return "g:" + s.backgroundGradient;
  if (s.backgroundType === "color" && s.backgroundColor) return "c:" + s.backgroundColor;
  return null;
}

export function applySelectionColor() {
  const state = getState();
  const s = state.settings;
  const fallback = s.cellSelectedColor || "#788cff";
  document.documentElement.style.setProperty("--cell-selected-color", fallback);
  if (s.cellSelectedMode !== "autoColor") { _accentKey = null; _accentColor = null; return; }
  const key = accentSourceKey();
  if (!key) return;
  if (key === _accentKey && _accentColor) {
    document.documentElement.style.setProperty("--cell-selected-color", _accentColor);
    return;
  }
  _accentKey = key;
  if (key.startsWith("c:")) {
    // Сплошной цвет: нормализуем его до акцентного (синхронно, без сети).
    _accentColor = accentFromCssColor(key.slice(2));
    if (_accentColor) document.documentElement.style.setProperty("--cell-selected-color", _accentColor);
  } else if (key.startsWith("g:")) {
    // Градиент: акцент по палитре CSS-цветов, из которых он состоит.
    const colors = parseCssColors(key.slice(2));
    _accentColor = colors && colors.length ? accentFromColors(colors) : null;
    if (_accentColor) document.documentElement.style.setProperty("--cell-selected-color", _accentColor);
  } else if (key.startsWith("img:")) {
    // Изображение: тянем пиксели через canvas (асинхронно).
    accentColorFromImage(key.slice(4)).then(color => {
      _accentColor = color;
      const cur = getState();
      if (color && cur.settings.cellSelectedMode === "autoColor" && accentSourceKey() === key) {
        document.documentElement.style.setProperty("--cell-selected-color", color);
      }
    }).catch(() => {
      // Картинка без CORS — остаётся ручной/дефолтный цвет.
    });
  }
}

// ---------- helpers: CSS-цвета (для градиента и сплошного фона) ----------

// Парсит любой валидный CSS-цвет (#rgb/#rrggbb/#rrggbbaa, rgb()/rgba(),
// hsl()/hsla(), именованные) в [r, g, b, a] через canvas 1×1.
// Возвращает null для прозрачных и непарсимых значений.
let _cssColorCtx = null;
function cssColorToRgba(css) {
  try {
    if (!_cssColorCtx) {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      _cssColorCtx = canvas.getContext("2d", { willReadFrequently: true });
    }
    const before = _cssColorCtx.fillStyle;
    _cssColorCtx.fillStyle = String(css).trim();
    const after = _cssColorCtx.fillStyle;
    if (after === before) return null; // невалидный CSS-цвет
    _cssColorCtx.clearRect(0, 0, 1, 1);
    _cssColorCtx.fillStyle = after;
    _cssColorCtx.fillRect(0, 0, 1, 1);
    const d = _cssColorCtx.getImageData(0, 0, 1, 1).data;
    if (d[3] < 20) return null;
    return [d[0], d[1], d[2], d[3]];
  } catch (err) {
    return null;
  }
}

// Вытаскивает из CSS-строки градиента все упоминания цветов: hex,
// rgb()/rgba(), hsl()/hsla(). Возвращает массив строк или null.
function parseCssColors(css) {
  const re = /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi;
  const found = String(css).match(re);
  return found && found.length ? found : null;
}

// Акцент из одного CSS-цвета (сплошной фон).
function accentFromCssColor(css) {
  const rgba = cssColorToRgba(css);
  if (!rgba) return null;
  return hslToHex(normalizeAccent(rgbToHsl(rgba[0], rgba[1], rgba[2])));
}

// Акцент из палитры CSS-цветов (градиент): строит псевдо-изображение и
// выбирает цвет тем же алгоритмом, что и для пикселей изображения.
function accentFromColors(colors) {
  const px = new Uint8ClampedArray(colors.length * 4);
  let ok = 0;
  colors.forEach((css, i) => {
    const rgba = cssColorToRgba(css);
    if (rgba) {
      px[i * 4] = rgba[0];
      px[i * 4 + 1] = rgba[1];
      px[i * 4 + 2] = rgba[2];
      px[i * 4 + 3] = 255;
      ok++;
    }
  });
  if (!ok) return null;
  return pickAccentColor(px);
}

async function accentColorFromImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("autoColor: http " + res.status);
  const blob = await res.blob();
  const W = 12, H = 12;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let src;
  if (typeof createImageBitmap === "function") {
    src = await createImageBitmap(blob);
  } else {
    const objUrl = URL.createObjectURL(blob);
    src = new Image();
    await new Promise((resolve, reject) => {
      src.onload = resolve;
      src.onerror = () => reject(new Error("autoColor: image load failed"));
      src.src = objUrl;
    });
    URL.revokeObjectURL(objUrl);
  }
  try {
    ctx.drawImage(src, 0, 0, W, H);
  } finally {
    if (src && typeof src.close === "function") src.close();
  }
  return pickAccentColor(ctx.getImageData(0, 0, W, H).data);
}

// Из пикселей RGBA выбирает акцент: самый «весомый» оттенок (по насыщенности ×
// светлоте); если картинка почти однотонная — средний цвет. Затем яркость
// нормализуется, чтобы цвет был виден и на светлом, и на тёмном фоне.
function pickAccentColor(px) {
  const BUCKETS = 24;
  const buckets = new Array(BUCKETS);
  for (let i = 0; i < BUCKETS; i++) buckets[i] = { w: 0, r: 0, g: 0, b: 0 };
  let total = 0, tr = 0, tg = 0, tb = 0;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
    if (a < 125) continue;
    const hsl = rgbToHsl(r, g, b);
    total++;
    tr += r; tg += g; tb += b;
    if (hsl.s < 0.18 || hsl.l < 0.12 || hsl.l > 0.88) continue;
    const bi = Math.min(BUCKETS - 1, Math.floor(hsl.h / (360 / BUCKETS)));
    const w = hsl.s * hsl.l;
    const bkt = buckets[bi];
    bkt.w += w; bkt.r += r * w; bkt.g += g * w; bkt.b += b * w;
  }
  let best = null, bestW = 0;
  for (const bkt of buckets) {
    if (bkt.w > bestW) { bestW = bkt.w; best = bkt; }
  }
  let color;
  if (best && best.w > 0 && total > 0) {
    color = { r: best.r / best.w, g: best.g / best.w, b: best.b / best.w };
  } else if (total > 0) {
    color = { r: tr / total, g: tg / total, b: tb / total };
  } else {
    return null;
  }
  return hslToHex(normalizeAccent(rgbToHsl(color.r, color.g, color.b)));
}

// Корректирует акцент: не слишком тёмный, не слишком блеклый.
function normalizeAccent(hsl) {
  let l = hsl.l;
  if (l < 0.32) l = 0.45;
  else if (l > 0.78) l = 0.58;
  return [hsl.h, Math.max(0.45, Math.min(0.95, hsl.s)), l];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

function hslToHex(hsl) {
  const h = hsl[0], s = hsl[1], l = hsl[2];
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const to = v => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return "#" + to(r) + to(g) + to(b);
}

export async function maybeLoadBingBackground() {
  const state = getState();
  const s = state.settings;
  if (s.backgroundType !== "bing") return;
  const cached = state.bingCache;
  if (cached && cached.url && cached.date === todayKey()) { applyBackground(); applySelectionColor(); return; }
  try {
    toast(tx("bingLoading"));
    const resp = await ext.runtime.sendMessage({ type: "bingDaily", mkt: s.bingMkt || "ru-RU" });
    if (!resp || resp.error || !resp.url) throw new Error(resp && resp.error || "no url");
    await Storage.update((d) => {
      d.bingCache = { date: todayKey(), url: resp.url, copyright: resp.copyright || "" };
    });
    setState(await Storage.get());
    applyBackground();
    applySelectionColor();
  } catch (err) {
    toast(tx("bingFailed"), true);
  }
}
