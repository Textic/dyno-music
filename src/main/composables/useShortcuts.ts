import { isTauri } from "@tauri-apps/api/core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { onBeforeUnmount, onMounted, shallowRef } from "vue";
import * as api from "@/shared/api";
import type { Settings, ShortcutAction } from "@/shared/types";

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  playPause: "Play / pause",
  next: "Next song",
  previous: "Previous song",
  volumeUp: "Volume up",
  volumeDown: "Volume down",
  like: "Like the current song",
  miniPlayer: "Mini player",
  showWindow: "Show Dyno Music",
};

const MODIFIER_CODES = /^(Control|Shift|Alt|Meta|OS)(Left|Right)?$/;
const IS_MAC = navigator.userAgent.includes("Mac");

/** The combination an event stands for, as stored in settings; null for a lone modifier. */
export function comboFromEvent(event: KeyboardEvent): string | null {
  if (MODIFIER_CODES.test(event.code) || !event.code) return null;
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Super");
  parts.push(event.code);
  return parts.join("+");
}

/** A global shortcut needs a modifier (or an F or media key), or it would swallow typing. */
export function canBeGlobal(keys: string): boolean {
  return keys.includes("+") || /^(F\d+|Media\w+|AudioVolume\w+)$/.test(keys);
}

const KEY_NAMES: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Minus: "-",
  Equal: "=",
  Backquote: "`",
  BracketLeft: "[",
  BracketRight: "]",
  Semicolon: ";",
  Quote: "'",
  Backslash: "\\",
  Super: IS_MAC ? "⌘" : "Win",
  Alt: IS_MAC ? "⌥" : "Alt",
};

/**
 * What each physical key prints on the user's keyboard layout ("Semicolon" → "Ñ" on a Spanish
 * one). Shortcuts are stored by physical key, so they keep working if the layout changes; only
 * the labels follow it. Null where the WebView can't tell (WebKit), which falls back to US names.
 */
const layout = shallowRef<Map<string, string> | null>(null);

interface KeyboardWithLayout {
  getLayoutMap(): Promise<Map<string, string>>;
}

async function readLayout(): Promise<void> {
  const keyboard = (navigator as Navigator & { keyboard?: KeyboardWithLayout }).keyboard;
  if (!keyboard?.getLayoutMap) return;
  try {
    layout.value = new Map(await keyboard.getLayoutMap());
  } catch {
    // Not allowed here; the US names will do.
  }
}

void readLayout();
// The user may switch layouts while the app runs.
window.addEventListener("focus", () => void readLayout());

/** Each key of a stored combination, as it reads on the keyboard: "Ctrl+KeyL" → ["Ctrl", "L"]. */
export function keyLabels(keys: string): string[] {
  return keys.split("+").map((part) => {
    const printed = layout.value?.get(part);
    if (printed && printed.trim()) return printed.toUpperCase();
    return KEY_NAMES[part] ?? part.replace(/^Key(.)$/, "$1").replace(/^Digit(.)$/, "$1").replace(/^Numpad/, "Num ");
  });
}

/** Sliders, switches and buttons don't take text, so shortcuts still work while they have focus. */
const NON_TEXT_INPUTS = ["checkbox", "radio", "range", "button", "submit", "reset", "color"];

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.includes(target.type);
  return target.isContentEditable || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

/**
 * Runs the window's (non-global) shortcuts. Global ones are left to Rust: the system hands
 * those keys to it, even while this window has focus.
 */
export function useShortcuts(): void {
  let settings: Settings | null = null;
  let unlisten: UnlistenFn | undefined;

  function onKeydown(event: KeyboardEvent): void {
    if (!settings || event.defaultPrevented || isTyping(event.target)) return;
    const combo = comboFromEvent(event);
    if (!combo) return;
    const entry = Object.entries(settings.shortcuts).find(([, b]) => !b.global && b.keys === combo);
    if (!entry) return;
    event.preventDefault();
    const action = entry[0] as ShortcutAction;
    // Holding a key repeats volume changes, but shouldn't flip play/pause back and forth.
    if (event.repeat && action !== "volumeUp" && action !== "volumeDown") return;
    api.runShortcut(action).catch((err) => console.error(`[dyno] shortcut: ${err}`));
  }

  onMounted(async () => {
    if (!isTauri()) return;
    window.addEventListener("keydown", onKeydown);
    unlisten = await api.onSettings((next) => (settings = next));
    settings = await api.getSettings();
  });
  onBeforeUnmount(() => {
    window.removeEventListener("keydown", onKeydown);
    unlisten?.();
  });
}
