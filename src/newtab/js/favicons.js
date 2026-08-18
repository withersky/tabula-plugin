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
 * Кэш фавиконок в chrome.storage.local.
 *
 * Зачем: фавиконки грузятся напрямую с сайтов (faviconUrl → /favicon.ico)
 * и сохраняются как data URL, поэтому:
 *   - офлайн: иконки уже закэшированных сайтов показываются без сети;
 *   - приватность: никаких внешних сервисов (Google s2 и т.п.) — запросы
 *     идут только на сайты самих закладок;
 *   - экономия: повторные рендеры сетки не дёргают сеть.
 *
 * Структура ключа storage: tabula_favicons = { "<host>": { data, ts } }.
 * data — data:image/png;base64 ("" для неудачных попыток), ts — epoch ms.
 * Обрезка (LRU по ts) — чистая функция pruneFaviconCache из lib/core.js.
 *
 * Глобалы lib/core.js (faviconHost, faviconUrl, pruneFaviconCache) и
 * lib/browser.js (ext) остаются классическими скриптами.
 */

const CACHE_KEY = "tabula_favicons";

// Лимиты кэша: 400 хостов, ~8 МБ суммарно, исходный blob до 96 КБ,
// итоговый PNG-дата URL до 64 КБ.
const MAX_ENTRIES = 400;
const MAX_TOTAL   = 8 * 1024 * 1024;
const MAX_SRC_LEN = 96 * 1024;
const MAX_PNG_LEN = 64 * 1024;
const ICON_SIZE   = 64; // сторона квадрата, в который пережимается иконка

// Неудачные попытки повторяем не чаще раза в сутки, успешные обновляем
// не чаще раза в 30 дней (старые записи всё равно показываются).
const RETRY_MS   = 24 * 60 * 60 * 1000;
const REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

let cache = new Map();      // host -> { data, ts }
let loaded = false;
const inflight = new Map(); // host -> Promise<void> (дедупликация загрузок)
const listeners = new Set();
// Сырые ссылки на /favicon.ico для хостов, чьи иконки не удалось прочитать
// в data URL (CORS/сеть). Хранятся только в памяти (не persist): браузер грузит
// <img> кросс-доменно без CORS, поэтому иконка отображается, но оффлайн — нет.
const fallbackUrls = new Map(); // host -> "https://host/favicon.ico"

/**
 * Внешний сброс кэша (кнопка «Сбросить кэш иконок» в настройках): при удалении
 * ключа tabula_favicons чистим память и просим новую вкладку перезагрузить
 * видимые иконки. Наши собственные записи (persist) содержат объект в newValue —
 * их игнорируем, чтобы не спамить перезагрузками.
 */
function bindCacheClearListener() {
  ext.storage.onChanged.addListener((changes, area) => {
    if (area && area !== "local") return;
    if (!changes || !(CACHE_KEY in changes)) return;
    const nv = changes[CACHE_KEY] && changes[CACHE_KEY].newValue;
    if (!nv) {
      cache = new Map();
      fallbackUrls.clear();
      try { window.dispatchEvent(new CustomEvent("tabula:favicons-reset")); } catch (_) {}
    }
  });
}

/** Читает кэш из storage в память. Безопасно вызывать повторно. */
export async function initFavicons() {
  if (loaded) return;
  loaded = true;
  bindCacheClearListener();
  try {
    const stored = await ext.storage.local.get([CACHE_KEY]);
    const raw = stored && stored[CACHE_KEY];
    if (raw && typeof raw === "object") {
      const now = Date.now();
      for (const [host, v] of Object.entries(raw)) {
        if (!host || !v || typeof v !== "object") continue;
        if (typeof v.data !== "string" ||
            !(v.data.startsWith("data:image/") || v.data === "")) continue;
        if (typeof v.ts !== "number" || now - v.ts > REFRESH_MS) continue;
        cache.set(host, { data: v.data, ts: v.ts });
      }
    }
  } catch (_) {
    // Кэш недоступен — работаем без него (ячейки получат letter-бейджи).
  }
}

/**
 * Синхронно возвращает data URL фавиконки для URL закладки.
 * "" — фавиконка ещё не закэширована (или хост не распознан).
 */
export function cachedSrc(url) {
  const host = faviconHost(url);
  if (!host) return "";
  const e = cache.get(host);
  if (e && e.data) return e.data;
  const fb = fallbackUrls.get(host);
  if (fb) return fb;
  return "";
}

/** Фоновая загрузка фавиконок для списка URL (дедупликация по хосту). */
export function prefetchFavicons(urls) {
  if (!Array.isArray(urls)) return;
  for (const u of urls) {
    const host = faviconHost(u);
    if (host) ensureHost(host, u);
  }
}

/** Подписка: cb(host) вызывается после загрузки фавиконки хоста. Возвращает отписку. */
export function onFaviconLoaded(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function ensureHost(host, sampleUrl) {
  const now = Date.now();
  const e = cache.get(host);
  if (e) {
    if (e.data && now - e.ts < REFRESH_MS) return Promise.resolve();
    if (!e.data && now - e.ts < RETRY_MS) return Promise.resolve();
  }
  if (inflight.has(host)) return inflight.get(host);
  const p = doFetch(host, sampleUrl)
    .catch(() => {})
    .finally(() => inflight.delete(host));
  inflight.set(host, p);
  return p;
}

async function doFetch(host, sampleUrl) {
  const proto = (() => {
    try {
      const p = new URL(normalizeUrl(sampleUrl));
      return p.protocol === "http:" ? "http:" : "https:";
    } catch (_) {
      return "https:";
    }
  })();
  // Сначала пробуем современный SVG-логотип сайта (/favicon.svg), затем
  // классический /favicon.ico. SVG даёт чёткую векторную иконку без растра
  // и весит меньше; .ico — запасной вариант для старых/простых сайтов.
  const candidates = [
    proto + "//" + host + "/favicon.svg",
    faviconUrl(sampleUrl), // .../favicon.ico
  ].filter(Boolean);
  const now = Date.now();
  let data = "";
  let lastUrl = "";
  for (const url of candidates) {
    lastUrl = url;
    try {
      const res = await fetch(url, { credentials: "omit" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const blob = await res.blob();
      if (!blob || blob.size === 0 || blob.size > MAX_SRC_LEN) throw new Error("bad blob");
      data = await blobToSquarePng(blob, ICON_SIZE);
      if (data.length > MAX_PNG_LEN) data = "";
      if (data) break; // нашли рабочую иконку — дальше не идём
    } catch (_) {
      data = "";
    }
  }
  if (!data) {
    // Не удалось получить data URL (CORS/сеть/битый файл): показываем иконку
    // напрямую через <img src>. Браузер грузит кросс-доменные картинки без
    // CORS, поэтому иконка отобразится, хоть и без оффлайн-кэша. Это решает
    // проблему «иконки не грузятся совсем» для сайтов без CORS-заголовков
    // (типично при импорте из закладок). Используем .ico как наиболее
    // универсальный фолбэк для прямой отрисовки <img>.
    fallbackUrls.set(host, faviconUrl(sampleUrl) || lastUrl);
  }
  cache.set(host, { data, ts: now });
  await persist();
  emit(host);
}

// blob (favicon.ico) -> квадратный PNG 64x64 как data URL.
// Через objectURL + canvas: источник — локальный blob, canvas не tainted,
// поэтому не нужен CORS, а .ico любого формата конвертируется в PNG.
function blobToSquarePng(blob, size) {
  return new Promise((resolve) => {
    const objUrl = URL.createObjectURL(blob);
    const img = new Image();
    const timer = setTimeout(() => { URL.revokeObjectURL(objUrl); resolve(""); }, 5000);
    img.onload = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(objUrl);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.min(size / img.width, size / img.height);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, Math.round((size - w) / 2), Math.round((size - h) / 2), w, h);
        resolve(canvas.toDataURL("image/png"));
      } catch (_) {
        resolve("");
      }
    };
    img.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(objUrl); resolve(""); };
    img.src = objUrl;
  });
}

async function persist() {
  const now = Date.now();
  const obj = {};
  for (const [host, e] of cache) obj[host] = e;
  const pruned = pruneFaviconCache(obj, now, { maxEntries: MAX_ENTRIES, maxTotal: MAX_TOTAL });
  cache = new Map(Object.entries(pruned).map(([h, v]) => [h, { data: v.data, ts: v.ts }]));
  try {
    await ext.storage.local.set({ [CACHE_KEY]: pruned });
  } catch (_) {
    // Квота storage: повторная жёсткая обрезка.
    const tight = pruneFaviconCache(Object.fromEntries(cache), now, { maxEntries: 100, maxTotal: 1024 * 1024 });
    cache = new Map(Object.entries(tight));
    try {
      await ext.storage.local.set({ [CACHE_KEY]: tight });
    } catch (_2) { /* кэш не пишется — работаем из памяти */ }
  }
}

function emit(host) {
  for (const cb of listeners) {
    try { cb(host); } catch (_) { /* слушатель не должен ломать загрузку */ }
  }
}
