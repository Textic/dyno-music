import type { BridgeDiag, PlayerState, PlayerStatus } from "../shared/types";
import { send } from "./ipc";
import { getLastPlayMethod, setOnChange } from "./player";
import { isAdShowing, videoElement, ytPlayer } from "./ytm";

const POLL_MS = 500;
/** While playing, position updates go out at most this often; the UI interpolates in between. */
const POSITION_EVERY_MS = 1000;

const STATUS_BY_CODE: Record<number, PlayerStatus> = {
  0: "ended",
  1: "playing",
  2: "paused",
  3: "buffering",
  5: "paused",
};

function largestArtwork(): string {
  const artwork = navigator.mediaSession?.metadata?.artwork ?? [];
  const best = [...artwork].sort((a, b) => parseInt(b.sizes ?? "0") - parseInt(a.sizes ?? "0"))[0];
  return best?.src ?? "";
}

function readState(): PlayerState {
  const player = ytPlayer();
  const video = videoElement();
  const code = player?.getPlayerState() ?? (video ? (video.paused ? 2 : 1) : -1);
  const data = player?.getVideoData();
  const meta = navigator.mediaSession?.metadata;
  const videoId = data?.video_id ?? "";
  const artist = meta?.artist || data?.author || "";

  return {
    status: STATUS_BY_CODE[code] ?? "idle",
    track: videoId
      ? {
          videoId,
          title: meta?.title || data?.title || "",
          artists: artist ? [{ name: artist }] : [],
          album: meta?.album || undefined,
          thumbnail: largestArtwork(),
          durationSec: player?.getDuration() || video?.duration || 0,
        }
      : null,
    positionSec: player?.getCurrentTime() ?? video?.currentTime ?? 0,
    volume: player?.getVolume() ?? (video ? video.volume * 100 : 100),
    muted: player?.isMuted() ?? video?.muted ?? false,
    isAd: isAdShowing(),
  };
}

export function startStateWatcher(): void {
  let lastKey = "";
  let lastPosition = 0;
  let lastSentAt = 0;

  const push = (force = false) => {
    const state = readState();
    const { positionSec, ...rest } = state;
    const key = JSON.stringify(rest);
    const now = Date.now();
    const elapsed = now - lastSentAt;
    // A jump larger than the time elapsed means a seek.
    const jumped = Math.abs(positionSec - lastPosition - elapsed / 1000) > 2;
    const positionDue = state.status === "playing" && elapsed >= POSITION_EVERY_MS;
    if (!force && key === lastKey && !jumped && !positionDue) return;
    lastKey = key;
    lastPosition = positionSec;
    lastSentAt = now;
    void send("bridge_state", { state });
  };

  setInterval(() => push(), POLL_MS);
  setOnChange(() => push(true));
  // Media events don't bubble, but they can be captured at the document, whichever <video> emits them.
  for (const type of ["play", "pause", "playing", "waiting", "ended", "seeked", "volumechange", "loadedmetadata"]) {
    document.addEventListener(type, () => push(true), true);
  }
}

/** Phase 0: measures whether the page keeps running normally while its window is hidden. */
export function startDiagnostics(): void {
  const gaps: number[] = [];
  let lastTick = performance.now();
  let lastPlaybackTime: number | null = null;

  setInterval(() => {
    const now = performance.now();
    gaps.push(now - lastTick);
    if (gaps.length > 10) gaps.shift();
    lastTick = now;
  }, 1000);

  setInterval(() => {
    const state = readState();
    let playbackAdvancing: boolean | null = null;
    if (state.status === "playing") {
      playbackAdvancing = lastPlaybackTime !== null && state.positionSec > lastPlaybackTime;
      lastPlaybackTime = state.positionSec;
    } else {
      lastPlaybackTime = null;
    }
    const diag: BridgeDiag = {
      visibility: document.visibilityState,
      maxTimerGapMs: Math.round(Math.max(0, ...gaps)),
      avgTimerGapMs: Math.round(gaps.reduce((a, b) => a + b, 0) / Math.max(gaps.length, 1)),
      playbackAdvancing,
      lastPlayMethod: getLastPlayMethod(),
      userAgent: navigator.userAgent,
    };
    void send("bridge_diag", { diag });
  }, 5000);
}
