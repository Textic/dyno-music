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

export type RepeatMode = "NONE" | "ALL" | "ONE";
export type LikeStatus = "LIKE" | "DISLIKE" | "INDIFFERENT";

export interface PlayerState {
  status: PlayerStatus;
  track: Track | null;
  positionSec: number;
  /** 0–100 */
  volume: number;
  muted: boolean;
  isAd: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  /** Of the current track. */
  likeStatus: LikeStatus;
}

export const IDLE_STATE: PlayerState = {
  status: "idle",
  track: null,
  positionSec: 0,
  volume: 100,
  muted: false,
  isAd: false,
  repeat: "NONE",
  shuffle: false,
  likeStatus: "INDIFFERENT",
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
  /** Plays a track, a track within a list, or a whole list (album, playlist, mix). */
  | { type: "watch"; videoId?: string | null; playlistId?: string | null; params?: string | null }
  /** Cycles none → all → one, like YouTube Music's own button. */
  | { type: "repeat" }
  | { type: "shuffle" }
  /** Rates the current track. */
  | { type: "like"; status: LikeStatus }
  | { type: "queuePlay"; index: number }
  | { type: "queueMove"; from: number; to: number }
  | { type: "queueRemove"; index: number }
  | { type: "queueAdd"; videoId?: string | null; playlistId?: string | null; next: boolean };

/** Sent from Rust into the page to run an InnerTube request. */
/** Asking as YouTube Music's Android app, which gets some things the web player doesn't. */
export type InnertubeClient = "android";

export interface BridgeRequest {
  id: number;
  endpoint: string;
  body: Record<string, unknown>;
  /** Unset: the page's own web client. */
  client?: InnertubeClient | null;
}

export type Theme = "dark" | "light" | "system";
export type AudioQuality = "auto" | "low" | "normal" | "high";

/** Mirrors `Settings` in src-tauri/src/settings.rs. */
export interface Settings {
  /** Closing the window hides it to the tray and keeps the music playing. */
  closeToTray: boolean;
  /** Media keys and the system media panel. */
  mediaControls: boolean;
  /** "Listening to…" on the user's Discord profile. */
  discordPresence: boolean;
  /** Mutes and skips YouTube Music's ads. */
  skipAds: boolean;
  /** "auto" leaves the account's own setting alone; "high" needs Premium. */
  audioQuality: AudioQuality;
  theme: Theme;
  /** The accent colour follows the current song's artwork. */
  artworkAccent: boolean;
  /** Calmer animations, on top of the system's own reduced-motion setting. */
  reduceMotion: boolean;
  shortcuts: Record<ShortcutAction, ShortcutBinding>;
}

/** Mirrors `ShortcutAction` in src-tauri/src/shortcuts.rs. */
export type ShortcutAction =
  | "playPause"
  | "next"
  | "previous"
  | "volumeUp"
  | "volumeDown"
  | "like"
  | "miniPlayer"
  | "showWindow";

export interface ShortcutBinding {
  /** Modifiers then the key's `KeyboardEvent.code`, e.g. "Ctrl+Shift+KeyP". */
  keys: string | null;
  /** Works from any app, not only while a Dyno Music window has focus. */
  global: boolean;
}

export interface LogEntry {
  level: "info" | "warn" | "error";
  message: string;
}
