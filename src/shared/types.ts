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

export interface LogEntry {
  level: "info" | "warn" | "error";
  message: string;
}
