<script setup lang="ts">
import { Disc3, ListEnd, ListPlus, ListStart, MicVocal, Play, ThumbsDown, ThumbsUp } from "lucide-vue-next";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { browseRoute } from "@/main/composables/useMedia";
import { rate } from "@/main/services/music";
import { usePlayerStore } from "@/main/stores/player";
import { useUiStore } from "@/main/stores/ui";
import type { LikeStatus } from "@/shared/types";

const ui = useUiStore();
const player = usePlayerStore();
const router = useRouter();
const panel = ref<HTMLElement | null>(null);
const position = ref({ left: 0, top: 0 });

interface Action {
  label: string;
  icon: unknown;
  run: () => void | Promise<void>;
}

const actions = computed<Action[]>(() => {
  const menu = ui.menu;
  if (!menu) return [];
  const { item, context } = menu;
  const list: Action[] = [];
  const playable = item.videoId || item.playlistId;
  if (playable) {
    list.push({ label: "Play", icon: Play, run: () => player.play(item, context) });
    list.push({ label: "Play next", icon: ListStart, run: () => queued(player.addToQueue(item, true), "Playing next") });
    list.push({ label: "Add to queue", icon: ListEnd, run: () => queued(player.addToQueue(item, false), "Added to queue") });
  }
  if (item.videoId && player.signedIn) {
    list.push({ label: "Add to playlist…", icon: ListPlus, run: () => void (ui.addToPlaylistFor = item) });
    list.push({ label: "Like", icon: ThumbsUp, run: () => rated(item.videoId!, "LIKE") });
    list.push({ label: "Dislike", icon: ThumbsDown, run: () => rated(item.videoId!, "DISLIKE") });
  }
  if (item.album?.browseId) {
    const id = item.album.browseId;
    list.push({ label: "Go to album", icon: Disc3, run: () => void router.push(browseRoute(id)) });
  }
  const artist = item.artists.find((a) => a.browseId);
  if (artist?.browseId) {
    const id = artist.browseId;
    list.push({ label: `Go to ${artist.name}`, icon: MicVocal, run: () => void router.push(browseRoute(id)) });
  }
  return list;
});

async function queued(task: Promise<void>, message: string): Promise<void> {
  await task;
  ui.toast(message);
}

async function rated(videoId: string, status: LikeStatus): Promise<void> {
  try {
    await rate(videoId, status);
    ui.toast(status === "LIKE" ? "Added to your likes" : "Got it, you won't hear it as often");
  } catch (err) {
    ui.toast(`Could not rate: ${err}`, "error");
  }
}

function close(): void {
  ui.menu = null;
}

function run(action: Action): void {
  close();
  void action.run();
}

// Keep the menu inside the window.
watch(
  () => ui.menu,
  async (menu) => {
    if (!menu) return;
    position.value = { left: menu.x, top: menu.y };
    await nextTick();
    const rect = panel.value?.getBoundingClientRect();
    if (!rect) return;
    position.value = {
      left: Math.min(menu.x, window.innerWidth - rect.width - 8),
      top: Math.min(menu.y, window.innerHeight - rect.height - 8),
    };
  },
);

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") close();
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Teleport to="body">
    <div v-if="ui.menu" class="fixed inset-0 z-50" @click="close" @contextmenu.prevent="close">
      <div
        ref="panel"
        role="menu"
        class="fixed min-w-52 rounded-2xl border border-white/10 bg-[#18171f]/95 p-1.5 shadow-2xl shadow-black/60"
        :style="{ left: `${position.left}px`, top: `${position.top}px` }"
        @click.stop
      >
        <p class="truncate px-3 pt-1.5 pb-2 text-xs font-semibold text-ink-faint">{{ ui.menu.item.title }}</p>
        <button
          v-for="action in actions"
          :key="action.label"
          role="menuitem"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/10"
          @click="run(action)"
        >
          <component :is="action.icon" class="size-4 text-ink-soft" />
          {{ action.label }}
        </button>
        <p v-if="!actions.length" class="px-3 py-2 text-sm text-ink-faint">No actions available</p>
      </div>
    </div>
  </Teleport>
</template>
