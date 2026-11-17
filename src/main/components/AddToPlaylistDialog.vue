<script setup lang="ts">
import { Search, X } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import CoverImage from "@/main/components/CoverImage.vue";
import { addToPlaylist } from "@/main/services/music";
import { useLibraryStore } from "@/main/stores/library";
import { useUiStore } from "@/main/stores/ui";
import type { MediaItem } from "@/shared/innertube/model";

const ui = useUiStore();
const library = useLibraryStore();
const saving = ref<string | null>(null);
const filter = ref("");

const filteredPlaylists = computed(() => {
  const q = filter.value.trim().toLowerCase();
  if (!q) return library.playlists;
  return library.playlists.filter(
    (p) => p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q),
  );
});

watch(
  () => ui.addToPlaylistFor,
  (item) => {
    filter.value = "";
    if (item && !library.playlists.length) void library.refresh();
  },
);

function close(): void {
  ui.addToPlaylistFor = null;
}

async function choose(playlist: MediaItem): Promise<void> {
  const videoId = ui.addToPlaylistFor?.videoId;
  if (!videoId || !playlist.browseId) return;
  saving.value = playlist.browseId;
  try {
    const added = await addToPlaylist(playlist.browseId, videoId);
    ui.toast(added ? `Added to ${playlist.title}` : `Already in ${playlist.title}`);
    close();
  } catch (err) {
    ui.toast(`Could not add it: ${err}`, "error");
  } finally {
    saving.value = null;
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && ui.addToPlaylistFor) close();
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200"
      leave-active-class="transition duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="ui.addToPlaylistFor"
        class="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-6"
        @click.self="close"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-to-playlist-title"
          class="flex max-h-[70vh] w-full max-w-md flex-col rounded-3xl border border-white/10 bg-surface shadow-2xl"
        >
          <header class="flex items-center gap-3 border-b border-white/5 px-5 py-4">
            <div class="min-w-0 flex-1">
              <h2 id="add-to-playlist-title" class="text-base font-bold">Add to playlist</h2>
              <p class="truncate text-xs text-ink-faint">{{ ui.addToPlaylistFor.title }}</p>
            </div>
            <button class="grid size-8 place-items-center rounded-full hover:bg-white/10" aria-label="Close" @click="close">
              <X class="size-4" />
            </button>
          </header>

          <div v-if="library.playlists.length > 5" class="border-b border-white/5 px-4 py-2.5">
            <div class="relative">
              <Search class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ink-faint" />
              <input
                v-model="filter"
                type="search"
                placeholder="Filter playlists…"
                class="w-full rounded-xl bg-white/5 py-1.5 pr-3 pl-8 text-sm outline-none placeholder:text-ink-faint focus:bg-white/10"
                @keydown.stop
              />
            </div>
          </div>

          <ul class="flex-1 overflow-y-auto p-2">
            <li v-if="library.loading && !library.playlists.length" class="px-3 py-4 text-sm text-ink-faint">
              Loading your playlists…
            </li>
            <li v-else-if="!library.playlists.length" class="px-3 py-4 text-sm text-ink-faint">No playlists found.</li>
            <li v-else-if="!filteredPlaylists.length" class="px-3 py-4 text-sm text-ink-faint">
              No matching playlists.
            </li>
            <li v-for="playlist in filteredPlaylists" :key="playlist.browseId">
              <button
                class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/10 disabled:opacity-50"
                :disabled="saving !== null"
                @click="choose(playlist)"
              >
                <span class="size-10 shrink-0 overflow-hidden rounded-lg bg-white/5">
                  <CoverImage :src="playlist.thumbnail" />
                </span>
                <span class="min-w-0">
                  <span class="block truncate text-sm font-medium">{{ playlist.title }}</span>
                  <span class="block truncate text-xs text-ink-faint">{{ playlist.subtitle }}</span>
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
