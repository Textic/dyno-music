import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { QueueEntry } from "./innertube/model";
import type { LogEntry, PlayerCommand, PlayerState, SessionInfo, Settings } from "./types";

export interface Snapshot {
  session: SessionInfo | null;
  state: PlayerState;
  /** null until the bridge first reports the queue. */
  queue: QueueEntry[] | null;
}

export const playerCmd = (cmd: PlayerCommand) => invoke<void>("player_cmd", { cmd });

export const ytmApi = <T = unknown>(endpoint: string, body: Record<string, unknown>) =>
  invoke<T>("ytm_api", { endpoint, body });

/** Opens Google's sign-in; resolves once signed in, rejects if cancelled or timed out. */
export const signIn = () => invoke<void>("sign_in");

/** Forgets the Google session; the bridge then reports the signed-out page. */
export const signOut = () => invoke<void>("sign_out");

export const getSettings = () => invoke<Settings>("get_settings");

export const setSettings = (settings: Settings) => invoke<void>("set_settings", { settings });

export const showPlayer = () => invoke<void>("show_player");

export const hidePlayer = () => invoke<void>("hide_player");

/** Swaps the main window for the always-on-top mini player. */
export const openMiniPlayer = () => invoke<void>("open_mini_player");

/** Closes the mini player and brings the main window back. */
export const closeMiniPlayer = () => invoke<void>("close_mini_player");

export const getSnapshot = () => invoke<Snapshot>("get_snapshot");

export const uiLog = (level: LogEntry["level"], message: string) => invoke<void>("ui_log", { level, message });

const on =
  <T>(event: string) =>
  (callback: (payload: T) => void): Promise<UnlistenFn> =>
    listen<T>(event, (e) => callback(e.payload));

export const onState = on<PlayerState>("player://state");
export const onSession = on<SessionInfo>("player://session");
export const onQueue = on<QueueEntry[]>("player://queue");
export const onLog = on<LogEntry>("player://log");
