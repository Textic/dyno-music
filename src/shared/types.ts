// Shared between the UI, the bridge and Rust (src-tauri/src/state.rs, commands.rs).

export type PlayerStatus = "idle" | "playing" | "paused" | "buffering" | "ended";

export interface Artist {
  name: string;
  id?: string;
}

export interface Track {
  videoId: string;
  title: string;
  artists: Artist[];
  album?: string;
  thumbnail: string;
  durationSec: number;
}

export interface PlayerState {
  status: PlayerStatus;
  track: Track | null;
  positionSec: number;
  /** 0–100 */
  volume: number;
  muted: boolean;
  isAd: boolean;
}

export const IDLE_STATE: PlayerState = {
  status: "idle",
  track: null,
  positionSec: 0,
  volume: 100,
  muted: false,
  isAd: false,
};

export interface SessionInfo {
  loggedIn: boolean;
  url: string;
}

export type PlayerCommand =
  | { type: "play" }
  | { type: "pause" }
  | { type: "toggle" }
  | { type: "next" }
  | { type: "previous" }
  | { type: "seek"; positionSec: number }
  | { type: "volume"; value: number }
  | { type: "playVideo"; videoId: string; playlistId?: string | null };

/** Sent from Rust into the page to run an InnerTube request. */
export interface BridgeRequest {
  id: number;
  endpoint: string;
  body: Record<string, unknown>;
}

/** Phase 0: measurements of how the hidden page behaves. */
export interface BridgeDiag {
  visibility: DocumentVisibilityState;
  /** Longest gap between ticks of a 1 s timer over the last 10 s. */
  maxTimerGapMs: number;
  avgTimerGapMs: number;
  /** Whether playback time moved since the previous report while playing; null when not playing. */
  playbackAdvancing: boolean | null;
  lastPlayMethod: string | null;
  userAgent: string;
}

export interface LogEntry {
  level: "info" | "warn" | "error";
  message: string;
}
