import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { BridgeDiag, LogEntry, PlayerCommand, PlayerState, SessionInfo } from "./types";

export interface Snapshot {
  session: SessionInfo | null;
  state: PlayerState;
}

export const playerCmd = (cmd: PlayerCommand) => invoke<void>("player_cmd", { cmd });

export const ytmApi = <T = unknown>(endpoint: string, body: Record<string, unknown>) =>
  invoke<T>("ytm_api", { endpoint, body });

/** Opens Google's sign-in; resolves once signed in, rejects if cancelled or timed out. */
export const signIn = () => invoke<void>("sign_in");

export const showPlayer = () => invoke<void>("show_player");

export const hidePlayer = () => invoke<void>("hide_player");

export const getSnapshot = () => invoke<Snapshot>("get_snapshot");

const on =
  <T>(event: string) =>
  (callback: (payload: T) => void): Promise<UnlistenFn> =>
    listen<T>(event, (e) => callback(e.payload));

export const onState = on<PlayerState>("player://state");
export const onSession = on<SessionInfo>("player://session");
export const onDiag = on<BridgeDiag>("player://diag");
export const onLog = on<LogEntry>("player://log");
