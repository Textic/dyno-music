import { isTauri } from "@tauri-apps/api/core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { accentPair, artworkColor } from "@/main/composables/artworkColor";
import { usePlayerStore } from "@/main/stores/player";
import * as api from "@/shared/api";
import type { Settings } from "@/shared/types";

const root = document.documentElement;
const systemLight = window.matchMedia("(prefers-color-scheme: light)");

/** The last theme shown, applied before settings load so a light window doesn't flash dark. */
const THEME_KEY = "dyno.theme";
try {
  const last = localStorage.getItem(THEME_KEY);
  if (last === "light" || last === "dark") root.dataset.theme = last;
} catch {
  // No storage: settings will set the theme a moment later.
}

/**
 * Applies the appearance settings to this window: theme and reduced motion as attributes on
 * <html> (styles.css does the rest), and the accent colour of the current artwork.
 */
export function useAppearance(): void {
  const player = usePlayerStore();
  const settings = ref<Settings | null>(null);
  /** Bumped when the system switches light/dark, for the "system" theme. */
  const systemTheme = ref(systemLight.matches ? "light" : "dark");
  let unlisten: UnlistenFn | undefined;

  const onSystemChange = () => (systemTheme.value = systemLight.matches ? "light" : "dark");

  function resolvedTheme(): "dark" | "light" {
    const theme = settings.value?.theme ?? "dark";
    return theme === "system" ? (systemTheme.value as "dark" | "light") : theme;
  }

  watch([settings, systemTheme], () => {
    if (!settings.value) return;
    const theme = resolvedTheme();
    root.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Only costs a flash of the dark theme on the next start.
    }
    if (settings.value?.reduceMotion) root.dataset.motion = "reduced";
    else delete root.dataset.motion;
  });

  // Each new artwork measures its colour; a late answer for an older song is dropped.
  let request = 0;
  watch(
    [() => player.track?.thumbnail, () => settings.value?.artworkAccent, settings, systemTheme],
    async ([thumbnail, enabled]) => {
      const mine = ++request;
      let color = null;
      if (enabled && thumbnail) {
        try {
          color = await artworkColor(thumbnail);
        } catch (err) {
          player.log({ level: "warn", message: `Artwork colour of ${thumbnail}: ${err}` });
        }
      }
      if (mine !== request) return;
      if (!color) {
        root.style.removeProperty("--color-accent");
        root.style.removeProperty("--color-accent-soft");
        return;
      }
      const { accent, soft } = accentPair(color, resolvedTheme());
      root.style.setProperty("--color-accent", accent);
      root.style.setProperty("--color-accent-soft", soft);
    },
  );

  onMounted(async () => {
    systemLight.addEventListener("change", onSystemChange);
    if (!isTauri()) return;
    unlisten = await api.onSettings((next) => (settings.value = next));
    settings.value = await api.getSettings();
  });
  onBeforeUnmount(() => {
    systemLight.removeEventListener("change", onSystemChange);
    unlisten?.();
  });
}
