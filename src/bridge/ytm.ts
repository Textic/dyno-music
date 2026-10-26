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
    ytcfg?: { get(key: string): unknown };
  }
}

export function ytcfg(key: string): unknown {
  return window.ytcfg?.get?.(key);
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
