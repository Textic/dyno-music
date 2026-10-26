import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { libraryPlaylists } from "@/main/services/music";
import { usePlayerStore } from "@/main/stores/player";
import type { MediaItem } from "@/shared/innertube/model";

/** The signed-in user's playlists, for the sidebar and "Add to playlist". */
export const useLibraryStore = defineStore("library", () => {
  const player = usePlayerStore();
  const playlists = ref<MediaItem[]>([]);
  const loading = ref(false);

  async function refresh(): Promise<void> {
    if (!player.signedIn) {
      playlists.value = [];
      return;
    }
    loading.value = true;
    try {
      playlists.value = await libraryPlaylists((fresh) => (playlists.value = fresh));
    } catch (err) {
      player.log({ level: "warn", message: `Could not load your playlists: ${err}` });
    } finally {
      loading.value = false;
    }
  }

  watch(() => player.signedIn, () => void refresh(), { immediate: true });

  return { playlists, loading, refresh };
});
