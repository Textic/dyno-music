import { defineStore } from "pinia";
import { ref } from "vue";
import type { MediaItem } from "@/shared/innertube/model";

export interface Toast {
  id: number;
  message: string;
  kind: "info" | "error";
}

export interface ContextMenuState {
  item: MediaItem;
  x: number;
  y: number;
  /** Album or playlist the item was opened from. */
  context?: string;
}

/** App-wide UI state: menus, dialogs, panels and toasts. */
export const useUiStore = defineStore("ui", () => {
  const menu = ref<ContextMenuState | null>(null);
  const addToPlaylistFor = ref<MediaItem | null>(null);
  const queueOpen = ref(false);
  const nowPlayingOpen = ref(false);
  const toasts = ref<Toast[]>([]);
  let nextToastId = 0;

  function openMenu(event: MouseEvent, item: MediaItem, context?: string): void {
    event.preventDefault();
    menu.value = { item, x: event.clientX, y: event.clientY, context };
  }

  function toast(message: string, kind: Toast["kind"] = "info"): void {
    const id = nextToastId++;
    toasts.value.push({ id, message, kind });
    setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), 3200);
  }

  return { menu, addToPlaylistFor, queueOpen, nowPlayingOpen, toasts, openMenu, toast };
});
