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
 * Всплывающие подсказки настроек: при наведении на блок с атрибутом
 * data-preview-key показываем попап со схематичным «скриншотом» изменения
 * (src/options/previews/<key>.svg) и кратким описанием из i18n
 * (previewDesc_<key>). Один переиспользуемый попап + делегирование событий,
 * чтобы не плодить десятки DOM-узлов.
 */

import { tx } from "./state.js";

const POPUP_ID = "hoverPreview";
const SVG_BASE = "previews/";

function ensurePopup() {
  let el = document.getElementById(POPUP_ID);
  if (el) return el;
  el = document.createElement("div");
  el.id = POPUP_ID;
  el.className = "hover-preview";
  el.setAttribute("role", "tooltip");
  el.hidden = true;
  el.innerHTML =
    '<div class="hp-imgwrap"><img class="hp-img" alt="" decoding="async" /></div>' +
    '<div class="hp-body">' +
      '<div class="hp-title"></div>' +
      '<div class="hp-desc"></div>' +
    '</div>';
  document.body.appendChild(el);

  // Прячем при скролле: попап fixed, а элемент уезжает из-под курсора.
  window.addEventListener("scroll", () => hidePopup(), true);
  return el;
}

function keyOf(target) {
  const node = target && target.closest ? target.closest("[data-preview-key]") : null;
  return node && node.dataset ? node.dataset.previewKey : null;
}

function labelText(node) {
  // Заголовок попапа — текст первого data-i18n внутри блока настройки.
  const span = node.querySelector("[data-i18n]");
  if (span && span.textContent) return span.textContent.trim();
  const out = node.querySelector(".group-title, .widget-block-title, .widget-subsection-title");
  return out ? out.textContent.trim() : "";
}

function showPopup(node) {
  const key = node.dataset.previewKey;
  if (!key) return;
  const popup = ensurePopup();

  const titleEl = popup.querySelector(".hp-title");
  const descEl = popup.querySelector(".hp-desc");
  const imgWrap = popup.querySelector(".hp-imgwrap");
  const imgEl = popup.querySelector(".hp-img");

  const title = labelText(node);
  titleEl.textContent = title;
  titleEl.hidden = !title;

  const desc = tx("previewDesc_" + key);
  descEl.textContent = desc || "";
  descEl.hidden = !desc;

  imgWrap.hidden = false;
  imgEl.onerror = () => { imgWrap.hidden = true; };
  imgEl.src = SVG_BASE + key + ".svg";

  popup.hidden = false;

  // Позиционируем после того, как попап отрисован (нужны его размеры).
  requestAnimationFrame(() => positionPopup(node, popup));
}

function positionPopup(node, popup) {
  const r = node.getBoundingClientRect();
  const pr = popup.getBoundingClientRect();
  const gap = 12;
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  // По умолчанию — справа от блока (правая панель превью убрана, место есть).
  let top = Math.max(gap, Math.min(r.top, vh - pr.height - gap));
  let left = r.right + gap;

  if (left + pr.width > vw - gap) {
    // Справа не влезает — пробуем слева.
    left = r.left - pr.width - gap;
    if (left < gap) {
      // Слева тоже не влезает — размещаем под блоком, центрируем по ширине.
      left = Math.max(gap, Math.min(r.left + r.width / 2 - pr.width / 2, vw - pr.width - gap));
      top = r.bottom + gap;
      if (top + pr.height > vh - gap) top = Math.max(gap, r.top - pr.height - gap);
    }
  }

  popup.style.top = Math.round(top) + "px";
  popup.style.left = Math.round(left) + "px";
}

function hidePopup() {
  const popup = document.getElementById(POPUP_ID);
  if (popup) popup.hidden = true;
}

let activeNode = null;

export function initHoverPreview() {
  document.addEventListener("mouseover", (e) => {
    const node = e.target.closest && e.target.closest("[data-preview-key]");
    if (node && node !== activeNode) {
      activeNode = node;
      showPopup(node);
    }
  });

  document.addEventListener("mouseout", (e) => {
    const node = e.target.closest && e.target.closest("[data-preview-key]");
    if (node) {
      const to = e.relatedTarget;
      if (!to || !node.contains(to)) {
        activeNode = null;
        hidePopup();
      }
    }
  });

  // Доступность с клавиатуры: показываем при фокусе внутри блока.
  document.addEventListener("focusin", (e) => {
    const node = e.target.closest && e.target.closest("[data-preview-key]");
    if (node && node !== activeNode) {
      activeNode = node;
      showPopup(node);
    }
  });
  document.addEventListener("focusout", (e) => {
    const node = e.target.closest && e.target.closest("[data-preview-key]");
    if (node) {
      activeNode = null;
      hidePopup();
    }
  });
}
