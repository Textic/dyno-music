import { useRouter } from "vue-router";
import { usePlayerStore } from "@/main/stores/player";
import type { Link, MediaItem, QueueEntry } from "@/shared/innertube/model";
import { upsize } from "@/shared/innertube/parsers";
import type { Track } from "@/shared/types";

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

/** Resolves clickable artist links for the active track using queue metadata as enrichment. */
export function trackArtistLinks(track: Track, queue: QueueEntry[]): Link[] {
  const entry = queue.find((q) => q.videoId === track.videoId && q.selected) ?? queue.find((q) => q.videoId === track.videoId);
  if (entry?.artistLinks?.length) return entry.artistLinks;
  return track.artists.map((a) => ({ name: a.name, browseId: a.id }));
}

export function queueEntryToMediaItem(entry: QueueEntry): MediaItem {
  return {
    kind: "song",
    title: entry.title,
    subtitle: entry.artists,
    thumbnail: upsize(entry.thumbnail, 544),
    videoId: entry.videoId,
    artists: entry.artistLinks?.length ? entry.artistLinks : entry.artists ? [{ name: entry.artists }] : [],
    album: entry.album,
    duration: entry.duration,
  };
}

export function currentTrackToMediaItem(track: Track, queue: QueueEntry[]): MediaItem {
  const entry = queue.find((q) => q.videoId === track.videoId && q.selected) ?? queue.find((q) => q.videoId === track.videoId);
  const artists = trackArtistLinks(track, queue);
  return {
    kind: "song",
    title: track.title,
    subtitle: artists.map((a) => a.name).join(", "),
    thumbnail: track.thumbnail,
    videoId: track.videoId,
    artists,
    album: entry?.album ?? (track.album ? { name: track.album } : undefined),
  };
}

export function youtubeMusicUrl(item: MediaItem): string | null {
  if (item.videoId) return `https://music.youtube.com/watch?v=${encodeURIComponent(item.videoId)}`;
  if (item.playlistId) return `https://music.youtube.com/playlist?list=${encodeURIComponent(item.playlistId)}`;
  if (item.browseId) {
    if (item.browseId.startsWith("VL")) {
      return `https://music.youtube.com/playlist?list=${encodeURIComponent(item.browseId.slice(2))}`;
    }
    if (item.browseId.startsWith("UC")) {
      return `https://music.youtube.com/channel/${encodeURIComponent(item.browseId)}`;
    }
    return `https://music.youtube.com/browse/${encodeURIComponent(item.browseId)}`;
  }
  return null;
}
