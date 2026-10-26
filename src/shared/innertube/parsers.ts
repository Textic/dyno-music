// Turns raw InnerTube responses into the app's model (model.ts). The format is undocumented and
// changes, so everything here reads defensively and skips what it does not recognise.

import type {
  BrowsePage,
  ItemKind,
  Link,
  MediaItem,
  PageHeader,
  QueueEntry,
  SearchPage,
  SearchSuggestions,
  Shelf,
} from "./model";

type Json = any;

// --- Primitives ----------------------------------------------------------------

function runs(node: Json): Json[] {
  return Array.isArray(node?.runs) ? node.runs : [];
}

export function text(node: Json): string {
  if (!node) return "";
  if (typeof node.simpleText === "string") return node.simpleText;
  return runs(node)
    .map((r) => r.text ?? "")
    .join("");
}

/** Asks Google's image servers for a bigger version of a thumbnail. */
export function upsize(url: string | undefined, size = 544): string | undefined {
  if (!url) return url;
  if (/googleusercontent\.com|ggpht\.com/.test(url)) {
    return url.replace(/=(w\d+-h\d+|s\d+)[^/]*$/, `=w${size}-h${size}-l90-rj`);
  }
  return url;
}

function thumbnailOf(node: Json, size?: number): string | undefined {
  const list =
    node?.musicThumbnailRenderer?.thumbnail?.thumbnails ??
    node?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails ??
    node?.thumbnail?.thumbnails ??
    node?.thumbnails;
  if (!Array.isArray(list) || !list.length) return undefined;
  return upsize(list[list.length - 1].url, size);
}

function pageType(endpoint: Json): string | undefined {
  return endpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
}

const KIND_BY_PAGE_TYPE: Record<string, ItemKind> = {
  MUSIC_PAGE_TYPE_ALBUM: "album",
  MUSIC_PAGE_TYPE_AUDIOBOOK: "album",
  MUSIC_PAGE_TYPE_PLAYLIST: "playlist",
  MUSIC_PAGE_TYPE_ARTIST: "artist",
  MUSIC_PAGE_TYPE_LIBRARY_ARTIST: "artist",
  MUSIC_PAGE_TYPE_USER_CHANNEL: "profile",
  MUSIC_PAGE_TYPE_PODCAST_SHOW_DETAIL_PAGE: "podcast",
  MUSIC_PAGE_TYPE_NON_MUSIC_AUDIO_TRACK_PAGE: "episode",
};

function kindOf(endpoint: Json): ItemKind {
  if (endpoint?.watchEndpoint) {
    const type = endpoint.watchEndpoint.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType;
    if (type === "MUSIC_VIDEO_TYPE_PODCAST_EPISODE") return "episode";
    return !type || type === "MUSIC_VIDEO_TYPE_ATV" ? "song" : "video";
  }
  if (endpoint?.watchPlaylistEndpoint) return "playlist";
  const type = pageType(endpoint);
  return (type && KIND_BY_PAGE_TYPE[type]) || "unknown";
}

/** Artist and album links inside a run list ("Daft Punk • Discovery • 2001"). */
function linksIn(list: Json[]): { artists: Link[]; album?: Link } {
  const artists: Link[] = [];
  let album: Link | undefined;
  for (const run of list) {
    const kind = kindOf(run.navigationEndpoint);
    const link = { name: run.text, browseId: run.navigationEndpoint?.browseEndpoint?.browseId };
    if (kind === "artist" || kind === "profile") artists.push(link);
    else if (kind === "album") album = link;
  }
  return { artists, album };
}

function playlistIdFromBrowseId(browseId: string | undefined): string | undefined {
  return browseId?.startsWith("VL") ? browseId.slice(2) : undefined;
}

function isExplicit(badges: Json): boolean {
  return Array.isArray(badges) && badges.some((b) => b.musicInlineBadgeRenderer?.icon?.iconType === "MUSIC_EXPLICIT_BADGE");
}

const DURATION = /^\d{1,2}(:\d{2}){1,2}$/;

function playEndpointOf(overlay: Json): Json {
  return overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint;
}

/** Continuation token in either the old (nextContinuationData) or new (continuationItemRenderer) form. */
function continuationIn(node: Json): string | undefined {
  const old = node?.continuations?.[0]?.nextContinuationData?.continuation;
  if (old) return old;
  const list: Json[] = node?.contents ?? node?.items ?? node?.continuationItems ?? [];
  const last = list[list.length - 1]?.continuationItemRenderer;
  return last?.continuationEndpoint?.continuationCommand?.token;
}

// --- Items ---------------------------------------------------------------------

export function parseListItem(r: Json): MediaItem | null {
  const columns: Json[] = (r?.flexColumns ?? []).map((c: Json) => c.musicResponsiveListItemFlexColumnRenderer?.text);
  const title = text(columns[0]);
  if (!title) return null;

  const titleEndpoint = runs(columns[0])[0]?.navigationEndpoint;
  const playEndpoint = playEndpointOf(r.overlay);
  const videoId: string | undefined =
    r.playlistItemData?.videoId ?? titleEndpoint?.watchEndpoint?.videoId ?? playEndpoint?.watchEndpoint?.videoId;
  const navigation = r.navigationEndpoint ?? titleEndpoint;
  const browseId: string | undefined = videoId ? undefined : navigation?.browseEndpoint?.browseId;
  const subtitleRuns = columns.slice(1).flatMap(runs);
  const { artists, album } = linksIn(subtitleRuns);

  return {
    kind: videoId ? kindOf(titleEndpoint?.watchEndpoint ? titleEndpoint : playEndpoint) : kindOf(navigation),
    title,
    subtitle: columns.slice(1).map(text).filter(Boolean).join(" • "),
    thumbnail: thumbnailOf(r.thumbnail, 240),
    videoId,
    playlistId:
      titleEndpoint?.watchEndpoint?.playlistId ??
      playEndpoint?.watchPlaylistEndpoint?.playlistId ??
      playlistIdFromBrowseId(browseId),
    browseId,
    artists,
    album,
    duration:
      text(r.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text) ||
      subtitleRuns.map((run) => run.text).find((t: string) => DURATION.test(t)),
    setVideoId: r.playlistItemData?.playlistSetVideoId,
    explicit: isExplicit(r.badges),
  };
}

export function parseTwoRowItem(r: Json): MediaItem | null {
  const title = text(r?.title);
  if (!title) return null;
  const navigation = r.navigationEndpoint ?? runs(r.title)[0]?.navigationEndpoint;
  const playEndpoint = playEndpointOf(r.thumbnailOverlay);
  const browseId: string | undefined = navigation?.browseEndpoint?.browseId;
  const { artists, album } = linksIn(runs(r.subtitle));

  return {
    kind: kindOf(navigation),
    title,
    subtitle: text(r.subtitle),
    thumbnail: thumbnailOf(r.thumbnailRenderer),
    videoId: navigation?.watchEndpoint?.videoId,
    playlistId:
      navigation?.watchEndpoint?.playlistId ??
      playEndpoint?.watchPlaylistEndpoint?.playlistId ??
      playEndpoint?.watchEndpoint?.playlistId ??
      playlistIdFromBrowseId(browseId),
    browseId,
    artists,
    album,
    explicit: isExplicit(r.subtitleBadges),
  };
}

function parseItem(node: Json): MediaItem | null {
  if (node?.musicResponsiveListItemRenderer) return parseListItem(node.musicResponsiveListItemRenderer);
  if (node?.musicTwoRowItemRenderer) return parseTwoRowItem(node.musicTwoRowItemRenderer);
  return null;
}

function parseItems(list: Json): MediaItem[] {
  return (Array.isArray(list) ? list : []).map(parseItem).filter((i): i is MediaItem => i !== null);
}

// --- Shelves -------------------------------------------------------------------

function moreOf(endpoint: Json): Shelf["more"] {
  const browse = endpoint?.browseEndpoint;
  return browse?.browseId ? { browseId: browse.browseId, params: browse.params } : undefined;
}

function shelvesFrom(sections: Json): Shelf[] {
  const shelves: Shelf[] = [];
  for (const section of Array.isArray(sections) ? sections : []) {
    let shelf: Shelf | null = null;
    if (section.musicCarouselShelfRenderer) {
      const s = section.musicCarouselShelfRenderer;
      const header = s.header?.musicCarouselShelfBasicHeaderRenderer;
      shelf = {
        title: text(header?.title),
        style: "carousel",
        items: parseItems(s.contents),
        more: moreOf(header?.moreContentButton?.buttonRenderer?.navigationEndpoint ?? runs(header?.title)[0]?.navigationEndpoint),
      };
    } else if (section.musicShelfRenderer) {
      const s = section.musicShelfRenderer;
      shelf = { title: text(s.title), style: "list", items: parseItems(s.contents), more: moreOf(s.bottomEndpoint) };
    } else if (section.musicPlaylistShelfRenderer) {
      shelf = { title: "", style: "list", items: parseItems(section.musicPlaylistShelfRenderer.contents) };
    } else if (section.gridRenderer) {
      const s = section.gridRenderer;
      shelf = { title: text(s.header?.gridHeaderRenderer?.title), style: "grid", items: parseItems(s.items) };
    } else if (section.itemSectionRenderer) {
      shelves.push(...shelvesFrom(section.itemSectionRenderer.contents));
    }
    if (shelf?.items.length) shelves.push(shelf);
  }
  return shelves;
}

// --- Browse pages --------------------------------------------------------------

function firstPlaylistIdIn(node: Json, skipPrefix?: string): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const id = node.watchPlaylistEndpoint?.playlistId ?? node.watchEndpoint?.playlistId;
  if (typeof id === "string" && !(skipPrefix && id.startsWith(skipPrefix))) return id;
  for (const value of Object.values(node)) {
    const found = firstPlaylistIdIn(value, skipPrefix);
    if (found) return found;
  }
  return undefined;
}

function parseResponsiveHeader(h: Json, browseId: string): PageHeader {
  const strapline = runs(h.straplineTextOne);
  const linked = linksIn(strapline).artists;
  return {
    kind: browseId.startsWith("MPRE") ? "album" : browseId.startsWith("VL") ? "playlist" : "other",
    title: text(h.title),
    subtitle: text(h.subtitle),
    secondSubtitle: text(h.secondSubtitle) || undefined,
    description: text(h.description?.musicDescriptionShelfRenderer?.description) || undefined,
    thumbnail: thumbnailOf(h.thumbnail, 720),
    artists: linked.length ? linked : strapline.length ? [{ name: text(h.straplineTextOne) }] : [],
    // "Start mix" playlists (RDAMPL…) are radios, not the page itself.
    playlistId: playlistIdFromBrowseId(browseId) ?? firstPlaylistIdIn(h.buttons, "RDAMPL"),
  };
}

function parseArtistHeader(h: Json): PageHeader {
  return {
    kind: "artist",
    title: text(h.title),
    subtitle: text(h.monthlyListenerCount) || text(h.subscriptionButton?.subscribeButtonRenderer?.subscriberCountText),
    description: text(h.description) || undefined,
    thumbnail: thumbnailOf(h.thumbnail, 1200),
    artists: [],
    playlistId: firstPlaylistIdIn(h.playButton),
    radioPlaylistId: firstPlaylistIdIn(h.startRadioButton),
  };
}

function findHeader(raw: Json, browseId: string): PageHeader | undefined {
  let header: PageHeader | undefined;
  (function walk(node: Json, depth: number): void {
    if (header || !node || typeof node !== "object" || depth > 12) return;
    if (node.musicResponsiveHeaderRenderer) header = parseResponsiveHeader(node.musicResponsiveHeaderRenderer, browseId);
    else if (node.musicImmersiveHeaderRenderer) header = parseArtistHeader(node.musicImmersiveHeaderRenderer);
    else if (node.musicVisualHeaderRenderer) header = parseArtistHeader(node.musicVisualHeaderRenderer);
    else for (const value of Object.values(node)) walk(value, depth + 1);
  })(raw.header ?? raw.contents, 0);
  if (!header && raw.header) header = findHeader({ contents: raw.contents }, browseId);
  return header;
}

function sectionLists(raw: Json): Json[] {
  const c = raw?.contents;
  return [
    c?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer,
    c?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer,
  ].filter(Boolean);
}

export function parseBrowse(raw: Json, browseId: string): BrowsePage {
  const header = findHeader(raw, browseId);
  const lists = sectionLists(raw);
  const shelves = lists.flatMap((list) => shelvesFrom(list.contents));

  // Album tracks leave out what the header already says.
  if (header?.kind === "album") {
    const album = { name: header.title, browseId };
    for (const item of shelves[0]?.items ?? []) {
      if (!item.artists.length) item.artists = header.artists;
      item.thumbnail ??= header.thumbnail;
      item.album ??= album;
    }
  }

  // Playlists continue their track list; other pages continue with more shelves.
  const trackShelf = lists
    .flatMap((list) => list.contents ?? [])
    .find((s: Json) => s.musicPlaylistShelfRenderer)?.musicPlaylistShelfRenderer;
  const continuation = trackShelf
    ? continuationIn(trackShelf)
    : header?.kind === "album"
      ? undefined
      : lists.map(continuationIn).find(Boolean);

  return { header, shelves, continuation };
}

/** Next page of a browse (more shelves) or of a list (more tracks), in any of InnerTube's formats. */
export function parseContinuation(raw: Json): { shelves: Shelf[]; items: MediaItem[]; continuation?: string } {
  const c = raw?.continuationContents;
  if (c?.sectionListContinuation) {
    return { shelves: shelvesFrom(c.sectionListContinuation.contents), items: [], continuation: continuationIn(c.sectionListContinuation) };
  }
  const list = c?.musicPlaylistShelfContinuation ?? c?.musicShelfContinuation ?? c?.gridContinuation;
  if (list) {
    return { shelves: [], items: parseItems(list.contents ?? list.items), continuation: continuationIn(list) };
  }
  const appended = (raw?.onResponseReceivedActions ?? [])
    .map((a: Json) => a.appendContinuationItemsAction)
    .find(Boolean);
  if (appended) {
    return { shelves: [], items: parseItems(appended.continuationItems), continuation: continuationIn(appended) };
  }
  return { shelves: [], items: [] };
}

// --- Search --------------------------------------------------------------------

function parseTopResult(card: Json): SearchPage["top"] {
  const title = text(card.title);
  const navigation = runs(card.title)[0]?.navigationEndpoint ?? card.onTap;
  if (!title || !navigation) return undefined;
  const browseId: string | undefined = navigation.browseEndpoint?.browseId;
  const { artists, album } = linksIn(runs(card.subtitle));
  return {
    item: {
      kind: kindOf(navigation),
      title,
      subtitle: text(card.subtitle),
      thumbnail: thumbnailOf(card.thumbnail, 544),
      videoId: navigation.watchEndpoint?.videoId,
      playlistId: navigation.watchEndpoint?.playlistId ?? playlistIdFromBrowseId(browseId),
      browseId,
      artists,
      album,
    },
    related: parseItems(card.contents),
  };
}

export function parseSearch(raw: Json): SearchPage {
  const list = raw?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer;
  const filters = (list?.header?.chipCloudRenderer?.chips ?? [])
    .map((chip: Json) => chip.chipCloudChipRenderer)
    .map((chip: Json) => ({ label: text(chip?.text), params: chip?.navigationEndpoint?.searchEndpoint?.params }))
    .filter((f: { label: string; params?: string }) => f.label && f.params);

  const page: SearchPage = { filters, items: [] };
  for (const section of list?.contents ?? []) {
    if (section.musicCardShelfRenderer) page.top = parseTopResult(section.musicCardShelfRenderer);
    else if (section.musicShelfRenderer) {
      page.items.push(...parseItems(section.musicShelfRenderer.contents));
      page.continuation ??= continuationIn(section.musicShelfRenderer);
    } else if (section.itemSectionRenderer) page.items.push(...parseItems(section.itemSectionRenderer.contents));
  }
  return page;
}

export function parseSuggestions(raw: Json): SearchSuggestions {
  const queries: string[] = [];
  const items: MediaItem[] = [];
  for (const section of raw?.contents ?? []) {
    for (const entry of section.searchSuggestionsSectionRenderer?.contents ?? []) {
      const suggestion = entry.searchSuggestionRenderer;
      if (suggestion) queries.push(suggestion.navigationEndpoint?.searchEndpoint?.query ?? text(suggestion.suggestion));
      const item = parseItem(entry);
      if (item) items.push(item);
    }
  }
  return { queries, items };
}

// --- Queue ---------------------------------------------------------------------

/** One entry of YouTube Music's own queue (its page store holds these renderers). */
export function parseQueueItem(node: Json, index: number): QueueEntry | null {
  const r =
    node?.playlistPanelVideoRenderer ?? node?.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer;
  if (!r?.videoId) return null;
  return {
    index,
    videoId: r.videoId,
    title: text(r.title),
    artists: text(r.shortBylineText) || text(r.longBylineText),
    thumbnail: thumbnailOf(r.thumbnail, 120),
    duration: text(r.lengthText) || undefined,
    selected: Boolean(r.selected),
  };
}
