// YouTube Music content for the UI: InnerTube requests through the bridge, parsed into model.ts.

import { ytmApi } from "@/shared/api";
import type { BrowsePage, MediaItem, SearchPage, SearchSuggestions, Shelf } from "@/shared/innertube/model";
import { parseBrowse, parseContinuation, parseSearch, parseSuggestions } from "@/shared/innertube/parsers";
import type { LikeStatus } from "@/shared/types";

export const HOME = "FEmusic_home";
export const LIKED_SONGS = "VLLM";
export const LIBRARY = {
  playlists: "FEmusic_liked_playlists",
  albums: "FEmusic_liked_albums",
  artists: "FEmusic_library_corpus_track_artists",
} as const;

/** YouTube Music's "Shuffle play" params for a watch-playlist endpoint. */
export const SHUFFLE_PARAMS = "wAEB8gECKAE%3D";

export async function browse(browseId: string, params?: string): Promise<BrowsePage> {
  const raw = await ytmApi("browse", params ? { browseId, params } : { browseId });
  return parseBrowse(raw, browseId);
}

export async function browseMore(
  continuation: string,
): Promise<{ shelves: Shelf[]; items: MediaItem[]; continuation?: string }> {
  return parseContinuation(await ytmApi("browse", { continuation }));
}

export async function search(query: string, params?: string): Promise<SearchPage> {
  return parseSearch(await ytmApi("search", params ? { query, params } : { query }));
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
}

/** Returns false when YouTube Music refused, e.g. because the track is already there. */
export async function addToPlaylist(playlistId: string, videoId: string): Promise<boolean> {
  const response = await ytmApi<{ status?: string }>("browse/edit_playlist", {
    playlistId: playlistId.replace(/^VL/, ""),
    actions: [{ action: "ACTION_ADD_VIDEO", addedVideoId: videoId }],
  });
  return response?.status === "STATUS_SUCCEEDED";
}

/** Playlists in the user's library, without YouTube Music's "New playlist" tile. */
export async function libraryPlaylists(): Promise<MediaItem[]> {
  const page = await browse(LIBRARY.playlists);
  return page.shelves.flatMap((s) => s.items).filter((i) => i.kind === "playlist" && i.browseId);
}

export function isTrack(item: MediaItem): boolean {
  return Boolean(item.videoId);
}
