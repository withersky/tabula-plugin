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
 */

// Cross-browser extension API wrapper.
// Provides a unified `ext.*` namespace that works in Chromium (chrome.*)
// and Firefox (browser.*) MV3 extensions.
//
// Background pages and content scripts can rely on:
//   - ext.runtime.sendMessage(...)
//   - ext.runtime.onMessage
//   - ext.runtime.openOptionsPage()
//   - ext.runtime.getManifest()
//   - ext.storage.local.get / set / remove
//   - ext.storage.onChanged
//
// All async APIs are promisified, even in Chromium where the underlying
// chrome.* APIs are callback-based. This keeps the call sites identical
// across browsers and avoids `chrome.runtime.lastError` boilerplate.

(function () {
  "use strict";

  const root = (typeof browser !== "undefined" && browser && browser.runtime)
    ? browser
    : (typeof chrome !== "undefined" && chrome && chrome.runtime)
      ? chrome
      : null;

  if (!root) {
    // Outside of an extension context (e.g. unit tests in a plain browser tab).
    // Provide harmless no-op shims so dependent scripts can still load.
    const noopAsync = () => Promise.resolve();
    const noopSync = () => undefined;
    const noopListener = { addListener() {}, removeListener() {}, hasListener() {} };
    const ext = {
      runtime: {
        sendMessage: noopAsync,
        openOptionsPage: noopSync,
        getManifest: () => ({ version: "0.0.0" }),
        onMessage: noopListener
      },
      action: {
        onClicked: noopListener
      },
      storage: {
        local: { get: noopAsync, set: noopAsync, remove: noopAsync },
        onChanged: noopListener
      }
    };
    if (typeof window !== "undefined") window.ext = ext;
    if (typeof globalThis !== "undefined") globalThis.ext = ext;
    return;
  }

  const isPromiseApi = typeof root.runtime.sendMessage === "function" &&
                       root.runtime.sendMessage.length <= 1;

  function sendMessage(msg) {
    try {
      // Firefox: browser.* returns a Promise directly.
      if (typeof browser !== "undefined" && browser && browser.runtime === root &&
          root.runtime.sendMessage.length <= 1) {
        return Promise.resolve(root.runtime.sendMessage(msg));
      }
      // Chromium: wrap callback API in a Promise.
      return new Promise((resolve, reject) => {
        try {
          root.runtime.sendMessage(msg, (resp) => {
            const err = root.runtime && root.runtime.lastError;
            if (err) reject(new Error(err.message || String(err)));
            else resolve(resp);
          });
        } catch (e) {
          reject(e);
        }
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function storageGet(keys) {
    return new Promise((resolve, reject) => {
      try {
        root.storage.local.get(keys, (val) => {
          const err = root.runtime && root.runtime.lastError;
          if (err) reject(new Error(err.message || String(err)));
          else resolve(val || {});
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  function storageSet(obj) {
    return new Promise((resolve, reject) => {
      try {
        root.storage.local.set(obj, () => {
          const err = root.runtime && root.runtime.lastError;
          if (err) reject(new Error(err.message || String(err)));
          else resolve();
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  function storageRemove(keys) {
    return new Promise((resolve, reject) => {
      try {
        root.storage.local.remove(keys, () => {
          const err = root.runtime && root.runtime.lastError;
          if (err) reject(new Error(err.message || String(err)));
          else resolve();
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  const ext = {
    runtime: {
      sendMessage: sendMessage,
      openOptionsPage: function () {
        try {
          if (root.runtime.openOptionsPage) {
            root.runtime.openOptionsPage();
            return;
          }
        } catch (_) { /* fall through */ }
        // Fallback for older browsers.
        try {
          window.open("options.html", "_blank");
        } catch (_) { /* ignore */ }
      },
      getManifest: function () {
        try { return root.runtime.getManifest() || {}; }
        catch (_) { return {}; }
      },
      onMessage: root.runtime.onMessage
    },
    action: root.action
      ? { onClicked: root.action.onClicked }
      : undefined,
    storage: {
      local: {
        get: storageGet,
        set: storageSet,
        remove: storageRemove
      },
      onChanged: root.storage.onChanged
    },
    // Expose the underlying root for advanced/rare APIs (e.g. browser-specific).
    _raw: root,
    _isFirefox: typeof browser !== "undefined" && browser && browser.runtime === root
  };

  if (typeof window !== "undefined") window.ext = ext;
  if (typeof globalThis !== "undefined") globalThis.ext = ext;
  // In service worker / background context there is no `window`, only `self`.
  if (typeof self !== "undefined" && typeof window === "undefined") self.ext = ext;
})();
