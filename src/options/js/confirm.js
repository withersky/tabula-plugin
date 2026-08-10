/*
 * Tabula — spreadsheet-style new tab page browser extension.
 *
 * Модалка подтверждения (#confirmModal) с Promise-интерфейсом.
 */

const confirmModal     = document.getElementById("confirmModal");
const confirmText      = document.getElementById("confirmText");
const confirmOkBtn     = document.getElementById("confirmOkBtn");
const confirmCancelBtn = document.getElementById("confirmCancelBtn");

export function confirmDialog(message) {
  return new Promise((resolve) => {
    if (!confirmModal || !confirmText || !confirmOkBtn || !confirmCancelBtn) { resolve(true); return; }
    confirmText.textContent = message;
    confirmModal.hidden = false;

    let settled = false;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      confirmModal.hidden = true;
      cleanup();
      resolve(val);
    };
    const onOk = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onCancel();
    };
    const onOverlay = (e) => {
      if (e.target === confirmModal) onCancel();
    };
    function cleanup() {
      confirmOkBtn.removeEventListener("click", onOk);
      confirmCancelBtn.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onKey);
      confirmModal.removeEventListener("mousedown", onOverlay);
    }
    confirmOkBtn.addEventListener("click", onOk);
    confirmCancelBtn.addEventListener("click", onCancel);
    document.addEventListener("keydown", onKey);
    confirmModal.addEventListener("mousedown", onOverlay);
    // Фокус на безопасную кнопку (Отмена), чтобы Enter не сработал случайно.
    setTimeout(() => {
      try { confirmCancelBtn.focus({ preventScroll: true }); } catch (_) {}
    }, 0);
  });
}
