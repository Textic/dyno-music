// Lyrics from LRCLIB (lrclib.net), a free, open lyrics database: time-synced when it has them,
// plain text otherwise. Only the song's title, artist, album and length are sent.

const API = "https://lrclib.net/api";
/** Matches with a length this far from the song's are a different recording. */
const DURATION_TOLERANCE_SEC = 4;

export interface LyricLine {
  timeSec: number;
  text: string;
}

export type Lyrics =
  | { kind: "synced"; lines: LyricLine[] }
  | { kind: "plain"; text: string }
  | { kind: "instrumental" }
  | { kind: "none" };

export interface LyricsQuery {
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

function fromRecord(record: LrclibRecord): Lyrics {
  if (record.instrumental) return { kind: "instrumental" };
  if (record.syncedLyrics) {
    const lines = parseSynced(record.syncedLyrics);
    if (lines.length) return { kind: "synced", lines };
  }
  if (record.plainLyrics?.trim()) return { kind: "plain", text: record.plainLyrics.trim() };
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

async function lookUp(query: LyricsQuery, signal?: AbortSignal): Promise<Lyrics> {
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

export async function fetchLyrics(query: LyricsQuery, signal?: AbortSignal): Promise<Lyrics> {
  const key = `${query.title}|${query.artist}|${Math.round(query.durationSec)}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const lyrics = await lookUp(query, signal);
  cache.set(key, lyrics);
  return lyrics;
}
