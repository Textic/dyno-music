// Access to YouTube Music's page internals. Everything that depends on the page's
// DOM or globals lives here, so breakages after YouTube updates stay contained.

/** Subset of the YouTube player API exposed by the #movie_player element. */
export interface YtPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  getVolume(): number;
  isMuted(): boolean;
  /** -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued */
  getPlayerState(): number;
  getCurrentTime(): number;
  getDuration(): number;
  getVideoData(): { video_id?: string; title?: string; author?: string };
  loadVideoById?(videoId: string): void;
}

declare global {
  interface Window {
    ytcfg?: { get(key: string): unknown; set?(key: string, value: unknown): void };
  }
}

export function ytcfg(key: string): unknown {
  return window.ytcfg?.get?.(key);
}

/**
 * YouTube Music answers in the account's language, but the app is in English. Its own client
 * reads the language from this config on every request (an `hl` URL parameter is ignored for
 * signed-in accounts), so switching it here makes shelf titles, "Song", "Single"... English.
 */
export function preferEnglish(): void {
  const context = ytcfg("INNERTUBE_CONTEXT") as { client?: { hl?: string } } | undefined;
  if (context?.client) context.client.hl = "en";
  window.ytcfg?.set?.("HL", "en");
}

export function ytPlayer(): YtPlayer | null {
  const el = document.querySelector("#movie_player") as unknown as Partial<YtPlayer> | null;
  return el && typeof el.playVideo === "function" ? (el as YtPlayer) : null;
}

export function videoElement(): HTMLVideoElement | null {
  return document.querySelector("video");
}

export function ytmApp(): HTMLElement | null {
  return document.querySelector("ytmusic-app");
}

/** YouTube Music's own API client: it adds the session, context and visitor data itself. */
interface NetworkManager {
  fetch<T = unknown>(path: string, body: Record<string, unknown>): Promise<T>;
}

export function networkManager(): NetworkManager | null {
  const manager = (ytmApp() as unknown as { networkManager?: NetworkManager } | null)?.networkManager;
  return typeof manager?.fetch === "function" ? manager : null;
}

/** The page keeps its queue in a Redux-like store, reachable through the #queue element. */
interface QueueStoreState {
  queue?: {
    items?: unknown[];
    selectedItemIndex?: number;
    repeatMode?: "NONE" | "ALL" | "ONE";
    queueContextParams?: string;
    nextQueueItemId?: number;
  };
  likeStatus?: { videos?: Record<string, "LIKE" | "DISLIKE" | "INDIFFERENT"> };
}

export interface QueueElement extends HTMLElement {
  dispatch(action: { type: string; payload?: unknown }): void;
  queue: {
    getItems(): unknown[];
    store: {
      store: {
        getState(): QueueStoreState;
        subscribe(listener: () => void): () => void;
      };
    };
  };
}

export function queueElement(): QueueElement | null {
  const el = document.querySelector("#queue") as QueueElement | null;
  return typeof el?.dispatch === "function" && el.queue?.store?.store ? el : null;
}

export function pageStore() {
  return queueElement()?.queue.store.store ?? null;
}

/** <ytmusic-player-bar> exposes the same handlers its buttons use. */
export interface PlayerBarElement extends HTMLElement {
  onRepeatButtonClick?(): void;
  queue?: { shuffle?(): void };
}

export function playerBar(): PlayerBarElement | null {
  return document.querySelector("ytmusic-player-bar");
}

export function isAdShowing(): boolean {
  return document.querySelector("#movie_player.ad-showing") !== null;
}

/** Clicks a button in YouTube Music's own player bar; false if it is not there. */
export function clickPlayerBar(selector: string): boolean {
  const button = document.querySelector<HTMLElement>(`ytmusic-player-bar ${selector}`);
  button?.click();
  return button !== null;
}

export function waitFor(predicate: () => boolean, timeoutMs: number, intervalMs = 100): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      if (predicate()) return resolve(true);
      if (Date.now() - started >= timeoutMs) return resolve(false);
      setTimeout(check, intervalMs);
    };
    check();
  });
}
