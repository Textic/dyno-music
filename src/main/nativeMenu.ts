// The WebView's own right-click menu (Back, Reload, Inspect…) makes the app feel like a web
// page. It stays in text fields, for copy and paste. In development, the devtools still open
// with Ctrl+Shift+I (Cmd+Option+I on macOS).

/** Inputs that take no text: sliders (the progress and volume bars), switches, buttons. */
const NON_TEXT_INPUTS = ["range", "checkbox", "radio", "button", "submit", "reset", "color", "file", "image"];

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.includes(target.type);
  return target.isContentEditable || target.closest("textarea") !== null;
}

export function hideNativeMenu(): void {
  document.addEventListener("contextmenu", (event) => {
    if (!isEditable(event.target)) event.preventDefault();
  });
}
