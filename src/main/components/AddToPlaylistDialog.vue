<script setup lang="ts">
import { ListMusic, X } from "lucide-vue-next";
import { ref, watch } from "vue";
import { addToPlaylist } from "@/main/services/music";
import { useLibraryStore } from "@/main/stores/library";
import { useUiStore } from "@/main/stores/ui";
import type { MediaItem } from "@/shared/innertube/model";

const ui = useUiStore();
const library = useLibraryStore();
const saving = ref<string | null>(null);

watch(
  () => ui.addToPlaylistFor,
  (item) => {
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
        class="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6"
        @click.self="close"
        @keydown.esc="close"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-to-playlist-title"
          class="flex max-h-[70vh] w-full max-w-md flex-col rounded-3xl border border-white/10 bg-[#16151c] shadow-2xl"
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
          <ul class="flex-1 overflow-y-auto p-2">
            <li v-if="library.loading && !library.playlists.length" class="px-3 py-4 text-sm text-ink-faint">
              Loading your playlists…
            </li>
            <li v-else-if="!library.playlists.length" class="px-3 py-4 text-sm text-ink-faint">No playlists found.</li>
            <li v-for="playlist in library.playlists" :key="playlist.browseId">
              <button
                class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/10 disabled:opacity-50"
                :disabled="saving !== null"
                @click="choose(playlist)"
              >
                <img v-if="playlist.thumbnail" :src="playlist.thumbnail" alt="" class="size-10 rounded-lg object-cover" />
                <ListMusic v-else class="size-10 rounded-lg bg-white/5 p-2.5 text-ink-faint" />
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
