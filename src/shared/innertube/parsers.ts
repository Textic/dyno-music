// Turns raw InnerTube responses into the app's types. The response format is undocumented
// and changes, so every parser reads defensively and skips what it does not recognise.

type Json = any;

export interface SearchItem {
  videoId: string;
  title: string;
  subtitle: string;
  thumbnail?: string;
}

function text(node: Json): string {
  if (!node) return "";
  if (typeof node.simpleText === "string") return node.simpleText;
  return Array.isArray(node.runs) ? node.runs.map((r: Json) => r.text ?? "").join("") : "";
}

function lastThumbnail(node: Json): string | undefined {
  const thumbnails = node?.musicThumbnailRenderer?.thumbnail?.thumbnails;
  return Array.isArray(thumbnails) && thumbnails.length ? thumbnails[thumbnails.length - 1].url : undefined;
}

/** First `watchEndpoint.videoId` anywhere under `node`. */
function findVideoId(node: Json): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  if (typeof node.watchEndpoint?.videoId === "string") return node.watchEndpoint.videoId;
  for (const value of Object.values(node)) {
    const found = findVideoId(value);
    if (found) return found;
  }
  return undefined;
}

function walk(node: Json, visit: (node: Json) => void): void {
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const value of Object.values(node)) walk(value, visit);
}

function fromListItem(item: Json): SearchItem | null {
  const columns: Json[] = item.flexColumns ?? [];
  const columnText = (c: Json) => text(c?.musicResponsiveListItemFlexColumnRenderer?.text);
  const videoId = item.playlistItemData?.videoId ?? findVideoId(item.overlay) ?? findVideoId(columns[0]);
  if (!videoId) return null; // albums, artists and playlists have no single video
  return {
    videoId,
    title: columnText(columns[0]),
    subtitle: columns.slice(1).map(columnText).filter(Boolean).join(" • "),
    thumbnail: lastThumbnail(item.thumbnail),
  };
}

function fromTopResult(card: Json): SearchItem | null {
  const videoId = card.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;
  if (!videoId) return null;
  return {
    videoId,
    title: text(card.title),
    subtitle: text(card.subtitle),
    thumbnail: lastThumbnail(card.thumbnail),
  };
}

/** Playable results (songs and videos) of a `search` response, top result first. */
export function parseSearch(raw: Json): SearchItem[] {
  const items: SearchItem[] = [];
  const seen = new Set<string>();
  walk(raw, (node) => {
    const item = node.musicCardShelfRenderer
      ? fromTopResult(node.musicCardShelfRenderer)
      : node.musicResponsiveListItemRenderer
        ? fromListItem(node.musicResponsiveListItemRenderer)
        : null;
    if (item && !seen.has(item.videoId)) {
      seen.add(item.videoId);
      items.push(item);
    }
  });
  return items;
}
