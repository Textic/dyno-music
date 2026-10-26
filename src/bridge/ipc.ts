import { invoke } from "@tauri-apps/api/core";
import type { LogEntry } from "../shared/types";

/** Calls a bridge_* command in Rust. Failures are only logged: the page must keep working. */
export async function send(command: string, args: Record<string, unknown>): Promise<void> {
  try {
    await invoke(command, args);
  } catch (err) {
    console.error(`[dyno] ${command} failed`, err);
  }
}

export function log(level: LogEntry["level"], message: string): void {
  void send("bridge_log", { level, message });
}
