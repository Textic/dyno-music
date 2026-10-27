// Lyrics from two sources, asked at the same time:
// - YouTube Music itself (licensed from LyricFind or Musixmatch), found by the song's videoId so
//   always the right recording. The web player only gets plain text; asking as the Android app
//   gets the timed version when there is one.
// - LRCLIB (lrclib.net), a free, open lyrics database, often time-synced. Only the song's title,
//   artist, album and length are sent.
// Synced beats plain, and YouTube Music wins a tie.

import { ytmApi } from "@/shared/api";

const API = "https://lrclib.net/api";
/** Matches with a length this far from the song's are a different recording. */
const DURATION_TOLERANCE_SEC = 4;

export interface LyricLine {
  timeSec: number;
  text: string;
}

export type Lyrics =
  /** `source` is shown under the lyrics, e.g. "YouTube Music · LyricFind". */
  | { kind: "synced"; lines: LyricLine[]; source: string }
  | { kind: "plain"; text: string; source: string }
  | { kind: "instrumental" }
  | { kind: "none" };

export interface LyricsQuery {
  videoId: string;
  title: string;
  artist: string;
  album?: string;
  durationSec: number;
}

interface LrclibRecord {
  trackName: string;
  artistName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

/** Song → lyrics, for this session; the same song often comes back around. */
const cache = new Map<string, Lyrics>();

/** "[01:23.45] text" lines; a line can carry several timestamps. */
export function parseSynced(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (!stamps.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, "").trim();
    for (const [, min, sec] of stamps) lines.push({ timeSec: Number(min) * 60 + Number(sec), text });
  }
  return lines.sort((a, b) => a.timeSec - b.timeSec);
}

const LRCLIB = "LRCLIB";

function fromRecord(record: LrclibRecord): Lyrics {
  if (record.instrumental) return { kind: "instrumental" };
  if (record.syncedLyrics) {
    const lines = parseSynced(record.syncedLyrics);
    if (lines.length) return { kind: "synced", lines, source: LRCLIB };
  }
  if (record.plainLyrics?.trim()) return { kind: "plain", text: record.plainLyrics.trim(), source: LRCLIB };
  return { kind: "none" };
}

/** "Song (feat. X) [Remastered]" → "Song": LRCLIB's titles usually leave those out. */
function cleanTitle(title: string): string {
  return title.replace(/\s*[([][^)\]]*[)\]]/g, "").replace(/\s+-\s+.*$/, "").trim() || title;
}

async function getJson<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T | null> {
  const response = await fetch(`${API}/${path}?${new URLSearchParams(params)}`, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`LRCLIB answered ${response.status}`);
  return (await response.json()) as T;
}

function closeInLength(record: LrclibRecord, durationSec: number): boolean {
  return !durationSec || Math.abs(record.duration - durationSec) <= DURATION_TOLERANCE_SEC;
}

async function fromLrclib(query: LyricsQuery, signal?: AbortSignal): Promise<Lyrics> {
  // An exact match first: LRCLIB picks the right recording from the title, artist and length.
  const exact = await getJson<LrclibRecord>(
    "get",
    {
      track_name: query.title,
      artist_name: query.artist,
      ...(query.album ? { album_name: query.album } : {}),
      ...(query.durationSec ? { duration: String(Math.round(query.durationSec)) } : {}),
    },
    signal,
  );
  if (exact) return fromRecord(exact);

  // Then a search with a cleaned-up title, keeping only results of about the same length.
  const results =
    (await getJson<LrclibRecord[]>("search", { track_name: cleanTitle(query.title), artist_name: query.artist }, signal)) ??
    [];
  const candidates = results.filter((r) => closeInLength(r, query.durationSec));
  const best = candidates.find((r) => r.syncedLyrics) ?? candidates.find((r) => r.plainLyrics || r.instrumental);
  return best ? fromRecord(best) : { kind: "none" };
}

// --- YouTube Music (raw InnerTube JSON, hence the `any`s) ---

/** The song's lyrics page ("MPLY…"), from the "Lyrics" tab of its watch page; null if it has none. */
async function lyricsBrowseId(videoId: string): Promise<string | null> {
  const next: any = await ytmApi("next", { videoId });
  const tabs: any[] =
    next?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs ?? [];
  const tab = tabs.find(
    (t) =>
      t?.tabRenderer?.endpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig
        ?.pageType === "MUSIC_PAGE_TYPE_TRACK_LYRICS",
  );
  if (!tab || tab.tabRenderer.unselectable) return null;
  return tab.tabRenderer.endpoint.browseEndpoint.browseId ?? null;
}

/** "Source: LyricFind" → "YouTube Music · LyricFind". */
function youtubeSource(message: unknown): string {
  const provider = typeof message === "string" ? message.replace(/^[^:]*:\s*/, "").trim() : "";
  return provider ? `YouTube Music · ${provider}` : "YouTube Music";
}

/** As the Android app: timed lines, when YouTube Music has them. */
async function youtubeTimed(browseId: string): Promise<Lyrics> {
  const page: any = await ytmApi("browse", { browseId }, "android");
  const data = page?.contents?.elementRenderer?.newElement?.type?.componentType?.model?.timedLyricsModel?.lyricsData;
  const lines: LyricLine[] = (data?.timedLyricsData ?? [])
    .map((line: any) => ({
      timeSec: Number(line?.cueRange?.startTimeMilliseconds) / 1000,
      // Instrumental stretches come as "♪"; the panel shows those itself.
      text: line?.lyricLine === "♪" ? "" : String(line?.lyricLine ?? "").trim(),
    }))
    .filter((line: LyricLine) => Number.isFinite(line.timeSec));
  if (!lines.some((line) => line.text)) return { kind: "none" };
  return { kind: "synced", lines, source: youtubeSource(data?.sourceMessage) };
}

/** As the web player: plain text. */
async function youtubePlain(browseId: string): Promise<Lyrics> {
  const page: any = await ytmApi("browse", { browseId });
  const shelf = page?.contents?.sectionListRenderer?.contents?.[0]?.musicDescriptionShelfRenderer;
  const text = (shelf?.description?.runs ?? [])
    .map((run: any) => run?.text ?? "")
    .join("")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!text) return { kind: "none" };
  return { kind: "plain", text, source: youtubeSource(shelf?.footer?.runs?.[0]?.text) };
}

/** YouTube Music's own lyrics: timed if it has them, plain otherwise. */
async function fromYouTubeMusic(videoId: string): Promise<Lyrics> {
  const browseId = await lyricsBrowseId(videoId);
  if (!browseId) return { kind: "none" };
  try {
    const timed = await youtubeTimed(browseId);
    if (timed.kind === "synced") return timed;
  } catch {
    // The Android client is a borrowed one; if it stops working, the plain lyrics still do.
  }
  return youtubePlain(browseId);
}

// --- Both ---

/** Settles to the lyrics or to the error, so one failing source doesn't sink the other. */
function settle(promise: Promise<Lyrics>): Promise<Lyrics | Error> {
  return promise.catch((err: unknown) => (err instanceof Error ? err : new Error(String(err))));
}

const isKind = (result: Lyrics | Error, kind: Lyrics["kind"]) => !(result instanceof Error) && result.kind === kind;

async function lookUp(query: LyricsQuery, signal?: AbortSignal): Promise<Lyrics> {
  const youtube = settle(fromYouTubeMusic(query.videoId));
  const lrclib = settle(fromLrclib(query, signal));

  // YouTube Music's synced lyrics don't need to wait for LRCLIB.
  const fromYoutube = await youtube;
  if (isKind(fromYoutube, "synced")) return fromYoutube as Lyrics;
  const fromLrc = await lrclib;
  if (isKind(fromLrc, "synced")) return fromLrc as Lyrics;
  if (isKind(fromYoutube, "plain")) return fromYoutube as Lyrics;
  if (isKind(fromLrc, "plain") || isKind(fromLrc, "instrumental")) return fromLrc as Lyrics;
  // Nothing found is an answer; only both sources failing is an error.
  if (fromYoutube instanceof Error && fromLrc instanceof Error) throw fromLrc;
  return { kind: "none" };
}

export async function fetchLyrics(query: LyricsQuery, signal?: AbortSignal): Promise<Lyrics> {
  const key = `${query.videoId}|${query.title}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const lyrics = await lookUp(query, signal);
  cache.set(key, lyrics);
  return lyrics;
}
