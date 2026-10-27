// YouTube Music content for the UI: InnerTube requests through the bridge, parsed into model.ts.

import { cached, invalidate, type CacheOptions } from "@/main/services/cache";
import { ytmApi } from "@/shared/api";
import type { BrowsePage, MediaItem, SearchPage, SearchSuggestions, Shelf } from "@/shared/innertube/model";
import { parseBrowse, parseContinuation, parseSearch, parseSuggestions } from "@/shared/innertube/parsers";
import type { LikeStatus } from "@/shared/types";

export const HOME = "FEmusic_home";
export const LIKED_SONGS = "VLLM";
/** YouTube Music's own listening history, across all devices. */
export const HISTORY = "FEmusic_history";
export const LIBRARY = {
  playlists: "FEmusic_liked_playlists",
  albums: "FEmusic_liked_albums",
  artists: "FEmusic_library_corpus_track_artists",
} as const;

/** YouTube Music's "Shuffle play" params for a watch-playlist endpoint. */
export const SHUFFLE_PARAMS = "wAEB8gECKAE%3D";

function browseKey(browseId: string, params?: string): string {
  return `browse:${browseId}:${params ?? ""}`;
}

async function fetchBrowse(browseId: string, params?: string): Promise<BrowsePage> {
  const raw = await ytmApi("browse", params ? { browseId, params } : { browseId });
  return parseBrowse(raw, browseId);
}

/** Cached (see cache.ts); `onUpdate` gets the refreshed page when a stale one was shown. */
export function browse(
  browseId: string,
  params?: string,
  options: Pick<CacheOptions<BrowsePage>, "onUpdate"> = {},
): Promise<BrowsePage> {
  // History should always be current.
  if (browseId === HISTORY) return fetchBrowse(browseId, params);
  // Home reshuffles from one visit to the next: waiting for the current one beats showing the
  // last one and swapping it a few seconds later. It isn't kept across launches either.
  if (browseId === HOME) {
    return cached(browseKey(browseId, params), () => fetchBrowse(browseId, params), {
      ...options,
      persist: false,
      serveStale: false,
    });
  }
  return cached(browseKey(browseId, params), () => fetchBrowse(browseId, params), options);
}

export async function browseMore(
  continuation: string,
): Promise<{ shelves: Shelf[]; items: MediaItem[]; continuation?: string }> {
  return parseContinuation(await ytmApi("browse", { continuation }));
}

/** Cached for this session only: going back to a search shows it at once. */
export function search(query: string, params?: string): Promise<SearchPage> {
  return cached(
    `search:${query}:${params ?? ""}`,
    async () => parseSearch(await ytmApi("search", params ? { query, params } : { query })),
    { persist: false },
  );
}

export async function searchMore(continuation: string): Promise<{ items: MediaItem[]; continuation?: string }> {
  const { items, continuation: next } = parseContinuation(await ytmApi("search", { continuation }));
  return { items, continuation: next };
}

export async function suggestions(input: string): Promise<SearchSuggestions> {
  return parseSuggestions(await ytmApi("music/get_search_suggestions", { input }));
}

const RATE_ENDPOINT: Record<LikeStatus, string> = {
  LIKE: "like/like",
  DISLIKE: "like/dislike",
  INDIFFERENT: "like/removelike",
};

/** Rates any track, not only the current one. */
export async function rate(videoId: string, status: LikeStatus): Promise<void> {
  await ytmApi(RATE_ENDPOINT[status], { target: { videoId } });
  invalidate(browseKey(LIKED_SONGS));
}

/** Returns false when YouTube Music refused, e.g. because the track is already there. */
export async function addToPlaylist(playlistId: string, videoId: string): Promise<boolean> {
  const response = await ytmApi<{ status?: string }>("browse/edit_playlist", {
    playlistId: playlistId.replace(/^VL/, ""),
    actions: [{ action: "ACTION_ADD_VIDEO", addedVideoId: videoId }],
  });
  const added = response?.status === "STATUS_SUCCEEDED";
  if (added) {
    invalidate(browseKey(`VL${playlistId.replace(/^VL/, "")}`));
    invalidate(browseKey(LIBRARY.playlists));
  }
  return added;
}

/** Playlists in the user's library, without YouTube Music's "New playlist" tile. */
export async function libraryPlaylists(onUpdate?: (playlists: MediaItem[]) => void): Promise<MediaItem[]> {
  const pick = (page: BrowsePage) =>
    page.shelves.flatMap((s) => s.items).filter((i) => i.kind === "playlist" && i.browseId);
  const page = await browse(LIBRARY.playlists, undefined, { onUpdate: onUpdate && ((fresh) => onUpdate(pick(fresh))) });
  return pick(page);
}

export function isTrack(item: MediaItem): boolean {
  return Boolean(item.videoId);
}
