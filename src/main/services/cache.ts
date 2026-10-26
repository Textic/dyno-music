// Stale-while-revalidate cache for YouTube Music content, so pages you come back to show at once.
//
// - Fresh entries (younger than FRESH_FOR_MS, fetched in this session) are served as they are.
// - Older entries, and entries saved by a previous launch, are served immediately and refreshed in
//   the background; `onUpdate` receives the new value.
// Entries are also kept in localStorage (when `persist`), so the app opens with content.
// Artwork needs nothing here: the webview's HTTP cache already keeps Google's images for a day.

const FRESH_FOR_MS = 5 * 60_000;
const MAX_ENTRIES = 60;
const STORAGE_PREFIX = "dyno.cache.v1:";

interface Entry {
  value: unknown;
  at: number;
  /** Loaded from storage: may belong to an earlier session, so always refreshed once. */
  fromStorage?: boolean;
}

/** Insertion order doubles as recency: entries are re-inserted when used. */
const memory = new Map<string, Entry>();

function remember(key: string, entry: Entry): void {
  memory.delete(key);
  memory.set(key, entry);
  while (memory.size > MAX_ENTRIES) {
    const oldest = memory.keys().next().value as string;
    memory.delete(oldest);
    removeStored(oldest);
  }
}

function readStored(key: string): Entry | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return undefined;
    const { value, at } = JSON.parse(raw) as Entry;
    return { value, at, fromStorage: true };
  } catch {
    return undefined;
  }
}

function writeStored(key: string, entry: Entry): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ value: entry.value, at: entry.at }));
  } catch {
    // Storage full or unavailable: the in-memory copy still works.
  }
}

function removeStored(key: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // Nothing to do.
  }
}

export interface CacheOptions<T> {
  /** Also keep it across launches. */
  persist?: boolean;
  /** Called with the refreshed value when a stale entry was served. */
  onUpdate?: (value: T) => void;
}

/**
 * Returns the cached value for `key` or loads it with `load`. Callers get their own copy, so
 * they can add continuation items to it without touching the cache.
 */
export async function cached<T>(key: string, load: () => Promise<T>, options: CacheOptions<T> = {}): Promise<T> {
  const { persist = true, onUpdate } = options;
  const save = (value: T) => {
    const entry = { value, at: Date.now() };
    remember(key, entry);
    if (persist) writeStored(key, entry);
  };

  const hit = memory.get(key) ?? (persist ? readStored(key) : undefined);
  if (hit) {
    remember(key, hit);
    if (hit.fromStorage || Date.now() - hit.at > FRESH_FOR_MS) {
      // Mark it so the same stale entry isn't refreshed again by every caller meanwhile.
      hit.fromStorage = false;
      hit.at = Date.now();
      load()
        .then((value) => {
          save(value);
          onUpdate?.(structuredClone(value));
        })
        .catch(() => {});
    }
    return structuredClone(hit.value as T);
  }

  const value = await load();
  save(value);
  return structuredClone(value);
}

/** Forgets one entry, e.g. a playlist after adding a track to it. */
export function invalidate(key: string): void {
  memory.delete(key);
  removeStored(key);
}

/** Forgets everything, e.g. when the account changes. */
export function clearCache(): void {
  memory.clear();
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Nothing to do.
  }
}
