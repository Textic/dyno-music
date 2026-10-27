// The WebView's own right-click menu (Back, Reload, Inspect…) makes the app feel like a web
// page. It stays in text fields, for copy and paste. In development, the devtools still open
// with Ctrl+Shift+I (Cmd+Option+I on macOS).

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.closest("input, textarea") !== null;
}

export function hideNativeMenu(): void {
  document.addEventListener("contextmenu", (event) => {
    if (!isEditable(event.target)) event.preventDefault();
  });
}
