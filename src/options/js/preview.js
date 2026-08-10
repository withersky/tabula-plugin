/*
 * Tabula — spreadsheet-style new tab page browser extension.
 *
 * Живой предпросмотр: отправка собранных настроек в iframe
 * (newtab.html?preview=1), который применяет их на лету без записи в storage.
 */

const previewFrame = document.getElementById("previewFrame");

/** Отправляет настройки в iframe-превью. settings — результат collectSettings(). */
export function sendPreview(settings) {
  if (!previewFrame || !previewFrame.contentWindow) return;
  previewFrame.contentWindow.postMessage({
    type: "tabula-preview-settings",
    settings
  }, "*");
}
