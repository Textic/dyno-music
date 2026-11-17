import { defineStore } from "pinia";
import { ref } from "vue";
import type { MediaItem } from "@/shared/innertube/model";

export interface Toast {
  id: number;
  message: string;
  kind: "info" | "error";
}

export interface OpenMenuOptions {
  /** Album or playlist watch context the item was opened from. */
  context?: string;
  /** Browse ID of the playlist page when opened inside a playlist (enables removing owned tracks). */
  playlistBrowseId?: string;
  /** Queue index when opened from Up Next / QueuePanel (enables Play now / Remove from queue). */
  queueIndex?: number;
  /** Callback invoked if the user removes this item from a playlist. */
  onRemoved?: () => void;
}

export interface ContextMenuState extends OpenMenuOptions {
  item: MediaItem;
  x: number;
  y: number;
}

/** App-wide UI state: menus, dialogs, panels and toasts. */
export const useUiStore = defineStore("ui", () => {
  const menu = ref<ContextMenuState | null>(null);
  const addToPlaylistFor = ref<MediaItem | null>(null);
  const queueOpen = ref(false);
  const nowPlayingOpen = ref(false);
  const toasts = ref<Toast[]>([]);
  let nextToastId = 0;

  function openMenu(event: MouseEvent, item: MediaItem, contextOrOptions?: string | OpenMenuOptions): void {
    event.preventDefault();
    const options: OpenMenuOptions =
      typeof contextOrOptions === "string" ? { context: contextOrOptions } : (contextOrOptions ?? {});
    menu.value = { item, x: event.clientX, y: event.clientY, ...options };
  }

  function toast(message: string, kind: Toast["kind"] = "info"): void {
    const id = nextToastId++;
    toasts.value.push({ id, message, kind });
    setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), 3200);
  }

  return { menu, addToPlaylistFor, queueOpen, nowPlayingOpen, toasts, openMenu, toast };
});
