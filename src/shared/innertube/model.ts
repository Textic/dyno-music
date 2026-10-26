// The app's view of YouTube Music content, independent of InnerTube's renderer shapes.

export type ItemKind =
  | "song"
  | "video"
  | "episode"
  | "album"
  | "playlist"
  | "artist"
  | "profile"
  | "podcast"
  | "unknown";

export interface Link {
  name: string;
  browseId?: string;
}

export interface MediaItem {
  kind: ItemKind;
  title: string;
  /** Secondary line as YouTube Music shows it, e.g. "Song • Daft Punk • Discovery". */
  subtitle: string;
  thumbnail?: string;
  /** Set for playable tracks. */
  videoId?: string;
  /** Watch context: plays the album, playlist or mix this item belongs to. */
  playlistId?: string;
  /** Page this item opens (album, playlist, artist...). */
  browseId?: string;
  artists: Link[];
  album?: Link;
  duration?: string;
  /** Identifies the entry inside a playlist (needed to remove it). */
  setVideoId?: string;
  explicit?: boolean;
}

export interface Shelf {
  title: string;
  style: "carousel" | "list" | "grid";
  items: MediaItem[];
  /** "See all" target, when the shelf has one. */
  more?: { browseId: string; params?: string };
}

export interface PageHeader {
  kind: "album" | "playlist" | "artist" | "other";
  title: string;
  subtitle: string;
  secondSubtitle?: string;
  description?: string;
  thumbnail?: string;
  artists: Link[];
  /** Plays the whole page (album or playlist). */
  playlistId?: string;
  /** Artist pages: plays the artist's radio / shuffle. */
  radioPlaylistId?: string;
}

export interface BrowsePage {
  header?: PageHeader;
  shelves: Shelf[];
  /** Token for more shelves (home) or more tracks (long playlists). */
  continuation?: string;
}

export interface SearchFilter {
  label: string;
  params: string;
}

export interface SearchPage {
  filters: SearchFilter[];
  top?: { item: MediaItem; related: MediaItem[] };
  items: MediaItem[];
  continuation?: string;
}

export interface SearchSuggestions {
  queries: string[];
  items: MediaItem[];
}

export interface QueueEntry {
  index: number;
  videoId: string;
  title: string;
  artists: string;
  thumbnail?: string;
  duration?: string;
  selected: boolean;
}
