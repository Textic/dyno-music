import { useRouter } from "vue-router";
import { usePlayerStore } from "@/main/stores/player";
import type { MediaItem } from "@/shared/innertube/model";

/** What happens when an item is clicked: tracks play, everything else opens its page. */
export function useOpenItem() {
  const router = useRouter();
  const player = usePlayerStore();

  return function open(item: MediaItem, context?: string): void {
    if (item.videoId) void player.play(item, context);
    else if (item.browseId) void router.push({ name: "browse", params: { id: item.browseId } });
    else if (item.playlistId) void player.play(item);
  };
}

export function browseRoute(browseId: string, params?: string) {
  return { name: "browse", params: { id: browseId }, query: params ? { params } : {} };
}
