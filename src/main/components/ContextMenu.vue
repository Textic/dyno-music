<script setup lang="ts">
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Copy,
  Disc3,
  ExternalLink,
  ListEnd,
  ListMinus,
  ListPlus,
  ListStart,
  MicVocal,
  Play,
  Radio,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-vue-next";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { browseRoute, youtubeMusicUrl } from "@/main/composables/useMedia";
import { rate, removeFromPlaylist } from "@/main/services/music";
import { useLibraryStore } from "@/main/stores/library";
import { usePlayerStore } from "@/main/stores/player";
import { useUiStore } from "@/main/stores/ui";
import type { LikeStatus } from "@/shared/types";

const ui = useUiStore();
const player = usePlayerStore();
const library = useLibraryStore();
const router = useRouter();
const panel = ref<HTMLElement | null>(null);
const position = ref({ left: 0, top: 0 });

interface Action {
  label: string;
  icon: unknown;
  danger?: boolean;
  run: () => void | Promise<void>;
}

const groups = computed<Action[][]>(() => {
  const menu = ui.menu;
  if (!menu) return [];
  const { item, context, playlistBrowseId, queueIndex, onRemoved } = menu;
  const result: Action[][] = [];

  // 1. Playback & Queue
  const playback: Action[] = [];
  const playable = Boolean(item.videoId || item.playlistId);
  if (queueIndex !== undefined) {
    playback.push({ label: "Play", icon: Play, run: () => player.queuePlay(queueIndex) });
  } else if (playable) {
    playback.push({ label: "Play", icon: Play, run: () => player.play(item, context) });
  }
  if (playable) {
    playback.push({ label: "Play next", icon: ListStart, run: () => queued(player.addToQueue(item, true), "Playing next") });
    playback.push({ label: "Add to queue", icon: ListEnd, run: () => queued(player.addToQueue(item, false), "Added to queue") });
  }
  if (item.videoId) {
    const vid = item.videoId;
    playback.push({ label: "Start song radio", icon: Radio, run: () => player.play({ ...item, playlistId: `RDAMVM${vid}` }) });
  }
  const inActiveQueueSlot = queueIndex !== undefined && player.queue.find((q) => q.index === queueIndex)?.selected;
  if (queueIndex !== undefined && !inActiveQueueSlot) {
    playback.push({
      label: "Remove from queue",
      icon: ListMinus,
      run: () => player.queueRemove(queueIndex),
    });
  }
  if (playback.length) result.push(playback);

  // 2. Library, Playlists & Ratings
  const libraryGroup: Action[] = [];
  if (item.videoId) {
    const vid = item.videoId;
    libraryGroup.push({
      label: "Add to playlist…",
      icon: ListPlus,
      run: () => openAddToPlaylist(item),
    });

    const isOwnedPlaylist =
      Boolean(playlistBrowseId && item.setVideoId) &&
      playlistBrowseId !== "VLLM" &&
      library.playlists.some((p) => p.browseId === playlistBrowseId);
    if (isOwnedPlaylist && playlistBrowseId && item.setVideoId) {
      const setId = item.setVideoId;
      libraryGroup.push({
        label: "Remove from playlist",
        icon: Trash2,
        danger: true,
        run: () => removeTrackFromPlaylist(playlistBrowseId, vid, setId, onRemoved),
      });
    }

    if (player.signedIn) {
      const isCurrent = player.track?.videoId === vid;
      const liked = isCurrent && player.state.likeStatus === "LIKE";
      const disliked = isCurrent && player.state.likeStatus === "DISLIKE";
      libraryGroup.push({
        label: liked ? "Remove like" : "Like",
        icon: ThumbsUp,
        run: () => rated(vid, liked ? "INDIFFERENT" : "LIKE"),
      });
      libraryGroup.push({
        label: disliked ? "Remove dislike" : "Dislike",
        icon: ThumbsDown,
        run: () => rated(vid, disliked ? "INDIFFERENT" : "DISLIKE"),
      });
    }
  }
  if (libraryGroup.length) result.push(libraryGroup);

  // 3. Navigation (Album & Artists)
  const navGroup: Action[] = [];
  if (item.album?.browseId) {
    const id = item.album.browseId;
    navGroup.push({ label: "Go to album", icon: Disc3, run: () => void router.push(browseRoute(id)) });
  }
  const seenArtists = new Set<string>();
  for (const artist of item.artists) {
    if (!artist.browseId || seenArtists.has(artist.browseId)) continue;
    seenArtists.add(artist.browseId);
    const id = artist.browseId;
    navGroup.push({ label: `Go to ${artist.name}`, icon: MicVocal, run: () => void router.push(browseRoute(id)) });
  }
  if (navGroup.length) result.push(navGroup);

  // 4. External / Share
  const url = youtubeMusicUrl(item);
  if (url) {
    result.push([
      { label: "Copy YouTube Music link", icon: Copy, run: () => copyLink(url) },
      { label: "Open in YouTube Music", icon: ExternalLink, run: () => openExternal(url) },
    ]);
  }

  return result;
});

function openAddToPlaylist(item: typeof ui.menu extends infer T ? (T extends { item: infer I } ? I : never) : never): void {
  if (!player.signedIn) {
    ui.toast("Sign in with Google to add songs to playlists");
    void player.signIn();
    return;
  }
  ui.addToPlaylistFor = item;
}

async function removeTrackFromPlaylist(
  playlistId: string,
  videoId: string,
  setVideoId: string,
  onRemoved?: () => void,
): Promise<void> {
  try {
    const ok = await removeFromPlaylist(playlistId, videoId, setVideoId);
    if (ok) {
      ui.toast("Removed from playlist");
      onRemoved?.();
    } else {
      ui.toast("Could not remove track from this playlist", "error");
    }
  } catch (err) {
    ui.toast(`Could not remove track: ${err}`, "error");
  }
}

async function queued(task: Promise<void>, message: string): Promise<void> {
  try {
    await task;
    ui.toast(message);
  } catch (err) {
    ui.toast(`Queue action failed: ${err}`, "error");
  }
}

async function rated(videoId: string, status: LikeStatus): Promise<void> {
  try {
    await rate(videoId, status);
    const message =
      status === "LIKE"
        ? "Added to your likes"
        : status === "DISLIKE"
          ? "Got it, you won't hear it as often"
          : "Rating removed";
    ui.toast(message);
  } catch (err) {
    ui.toast(`Could not rate: ${err}`, "error");
  }
}

async function copyLink(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    ui.toast("Link copied");
  } catch (err) {
    ui.toast(`Could not copy link: ${err}`, "error");
  }
}

async function openExternal(url: string): Promise<void> {
  try {
    await openUrl(url);
  } catch (err) {
    ui.toast(`Could not open browser: ${err}`, "error");
  }
}

function close(): void {
  ui.menu = null;
}

function run(action: Action): void {
  close();
  void action.run();
}

// Keep the menu inside the window. Use offsetWidth/Height so enter scale transforms never skew bounds.
watch(
  () => ui.menu,
  async (menu) => {
    if (!menu) return;
    position.value = { left: menu.x, top: menu.y };
    await nextTick();
    const el = panel.value;
    if (!el) return;
    position.value = {
      left: Math.max(8, Math.min(menu.x, window.innerWidth - el.offsetWidth - 8)),
      top: Math.max(8, Math.min(menu.y, window.innerHeight - el.offsetHeight - 8)),
    };
  },
);

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && ui.menu) close();
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Teleport to="body">
    <Transition name="context-menu" :duration="{ enter: 180, leave: 120 }">
      <div v-if="ui.menu" class="fixed inset-0 z-[60]" @click="close" @contextmenu.prevent="close">
        <div
          ref="panel"
          role="menu"
          class="context-menu-panel fixed max-h-[calc(100vh-16px)] min-w-56 origin-top-left overflow-y-auto rounded-2xl border border-white/10 bg-surface/95 p-1.5 shadow-2xl shadow-shade/60"
          :style="{ left: `${position.left}px`, top: `${position.top}px` }"
          @click.stop
        >
          <p class="max-w-64 truncate px-3 pt-1.5 pb-2 text-xs font-semibold text-ink-faint">{{ ui.menu.item.title }}</p>
          <template v-for="(group, gi) in groups" :key="gi">
            <div v-if="gi > 0" class="my-1 border-t border-white/10" role="separator" />
            <button
              v-for="action in group"
              :key="action.label"
              role="menuitem"
              class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/10"
              :class="action.danger ? 'text-red-300 hover:text-red-200' : ''"
              @click="run(action)"
            >
              <component :is="action.icon" class="size-4 shrink-0" :class="action.danger ? 'text-red-300' : 'text-ink-soft'" />
              <span class="truncate">{{ action.label }}</span>
            </button>
          </template>
          <p v-if="!groups.length" class="px-3 py-2 text-sm text-ink-faint">No actions available</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.context-menu-enter-active .context-menu-panel {
  transition:
    opacity 180ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.context-menu-leave-active .context-menu-panel {
  transition:
    opacity 120ms ease-in,
    transform 120ms ease-in;
}

.context-menu-enter-from .context-menu-panel,
.context-menu-leave-to .context-menu-panel {
  opacity: 0;
  transform: translateY(-4px) scale(0.95);
}
</style>
